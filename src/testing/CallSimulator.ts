/**
 * A call, simulated in a test: the agent's tools, steps and state, without the
 * platform or a model.
 *
 * {@link CallSimulator} reads the agent's rendered SWML, as the platform would,
 * and plays the model's side: the test says what the caller says and which
 * tools the model calls. Each call is checked as the platform checks it: a tool
 * the current step doesn't offer doesn't run, and a gated tool runs only when
 * the test's gate callback lets it. A result's actions change the simulated
 * call: global data and `semantic_state`, the step and context, which functions
 * are on, `say`, and the end of the call.
 *
 * It's an approximation of the platform, for testing your code's decisions. It
 * doesn't run a model, DataMap tools (give a stub), gather questions, or the
 * gates' decision model (give a callback). It renders and runs tools on the
 * agent itself: a dynamic config callback's per-request copy isn't made.
 *
 * {@link RequestRecorder} records real tool requests for
 * {@link CallSimulator.replay}.
 */

import { appendFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import type { AgentBase } from '../AgentBase.js';
import { FunctionResult } from '../FunctionResult.js';
import { RESERVED_FUNCTION_NAMES } from '../SemanticGate.js';
import { SwaigFunction } from '../SwaigFunction.js';
import type { CallNext, ToolMiddleware } from '../ToolMiddleware.js';

type Json = Record<string, unknown>;

/**
 * A gate callback: `gates(gate, simulator, args)` returns true or a probability
 * at or above the gate's threshold to pass, false or one below it to fail, or
 * "unclear". It may return a promise of the answer.
 */
export type GateCallback = (gate: Json, simulator: CallSimulator, args: Json) => unknown;

/** A result for a tool that doesn't run locally: a FunctionResult, a result dict or text. */
export type ToolStub = (args: Json) => unknown;

const NAVIGATION = ['next_step', 'change_context'];
// The most gate marks the platform keeps for a call
const MAX_MARKS = 16;
const VARIABLE = /\$\{([A-Za-z0-9_.]+)\}/g;

/** What one tool call came to in the simulation. */
export class SimulatedCall {
  /** The tool's name. */
  name: string;
  /** The arguments the model sent. */
  args: Json;
  /** The result, as the platform gets it. */
  result: Json;
  /** Whether the tool's handler (or stub) ran. */
  ran: boolean;
  /**
   * Why it didn't: "step" for a tool the step doesn't offer, or the id of the
   * gate that blocked it.
   */
  blockedBy: string | null;

  /**
   * @param name - The tool's name.
   * @param args - The arguments the model sent.
   * @param result - The result, as the platform gets it.
   * @param opts - `ran`, and `blockedBy` for a call that didn't run.
   */
  constructor(
    name: string,
    args: Json,
    result: Json,
    opts: { ran: boolean; blockedBy?: string | null },
  ) {
    this.name = name;
    this.args = args;
    this.result = result;
    this.ran = opts.ran;
    this.blockedBy = opts.blockedBy ?? null;
  }

  /** The result's text: its response, or its tool_result. */
  get response(): string {
    const response = this.result['response'] ?? '';
    if (isRecord(response)) return String(response['tool_result'] ?? '');
    return String(response);
  }

  /** The result's tool_prompt, or null when it has none. */
  get toolPrompt(): string | null {
    const response = this.result['response'];
    if (!isRecord(response) || response['tool_prompt'] === undefined) return null;
    return response['tool_prompt'] as string;
  }

  /** The result's actions. */
  get actions(): Json[] {
    const action = this.result['action'] ?? [];
    return (Array.isArray(action) ? action : [action]) as Json[];
  }

  /** The call, for a test's failure message. */
  toString(): string {
    const state = this.ran ? 'ran' : `blocked by ${this.blockedBy}`;
    return `<SimulatedCall ${this.name} ${state}: ${JSON.stringify(this.response)}>`;
  }
}

/** Options for a {@link CallSimulator}. */
export interface CallSimulatorOptions {
  /** The call's id, as the agent's tools see it. Default "simulated-call". */
  callId?: string;
  /** The answer to each semantic gate, in place of the decision model. Without one, every gate passes. */
  gates?: GateCallback;
  /**
   * Results for tools that don't run locally, such as DataMap tools, by name:
   * `fn(args)` returning a FunctionResult, a dict or text, or a promise of one.
   */
  stubs?: Record<string, ToolStub>;
  /** Global data to start with, over the agent's own. */
  globalData?: Json;
}

/**
 * A simulated call to an agent, for tests.
 *
 * @example
 * ```ts
 * const sim = new CallSimulator(agent, { gates: () => true });
 * sim.caller("I'd like a large tea");
 * expect((await sim.call('place_order', { item: 'tea' })).ran).toBe(false); // not offered yet
 * await sim.call('review_order', { item: 'large tea' });
 * sim.caller('yes');
 * expect((await sim.call('place_order')).ran).toBe(true);
 * expect(sim.step).toBe('done');
 * ```
 */
export class CallSimulator {
  /** The agent. */
  agent: AgentBase;
  /** The call's id, as the agent's tools see it. */
  callId: string;
  /** The AI verb's params, as rendered. */
  params: Json;
  /** The call's global data. */
  globalData: Json;
  /** The agent's functions, as rendered, by name. */
  functions: Record<string, Json>;
  /** The conversation so far, as call log entries. */
  callLog: Json[] = [];
  /** Whether a result ended the call. */
  ended = false;
  /** The back_to_back_functions setting, as the last result left it. */
  chaining: unknown = 'forever';
  /** Whether a result asked the model to wait for the caller. */
  waitingForUser = false;
  /** Every tool call so far. */
  calls: SimulatedCall[] = [];
  /**
   * The semantic gate marks set, by name: the length of the call log when each
   * was set, so `callLog.slice(marks.get(name))` is since it.
   */
  marks = new Map<string, number>();
  /** The current context, null without contexts. */
  context: string | null = null;
  /** The current step, null without contexts. */
  step: string | null = null;

  private readonly gates?: GateCallback;
  private readonly stubs: Record<string, ToolStub>;
  private readonly contexts: Record<string, Json>;
  private readonly toggled = new Map<string, boolean>();
  private toolCalls = 0;
  private stepFunctions: Set<string>;

  /**
   * @param agent - The agent.
   * @param opts - `callId`, `gates`, `stubs` and `globalData`.
   */
  constructor(agent: AgentBase, opts: CallSimulatorOptions = {}) {
    this.agent = agent;
    this.callId = opts.callId ?? 'simulated-call';
    this.gates = opts.gates;
    this.stubs = { ...(opts.stubs ?? {}) };
    const ai = aiVerb(JSON.parse(agent.renderSwml(this.callId)) as Json);
    this.params = structuredClone(asRecord(ai['params']));
    this.globalData = {
      ...structuredClone(asRecord(ai['global_data'])),
      ...structuredClone(opts.globalData ?? {}),
    };
    const swaig = asRecord(ai['SWAIG']);
    const functions = Array.isArray(swaig['functions']) ? (swaig['functions'] as unknown[]) : [];
    // No prototype, so a tool named __proto__ is a tool like any other
    this.functions = Object.create(null) as Record<string, Json>;
    for (const f of functions) {
      if (isRecord(f) && 'function' in f) this.functions[String(f['function'])] = f;
    }
    const prompt = ai['prompt'];
    this.contexts = isRecord(prompt) ? (asRecord(prompt['contexts']) as Record<string, Json>) : {};
    this.stepFunctions = new Set(this.tools());
    const names = Object.keys(this.contexts);
    if (names.length > 0) this.enterContext(names.includes('default') ? 'default' : names[0]!);
  }

  // ── The conversation ────────────────────────────────────────────────

  /**
   * The caller says `text`.
   * @param text - What they say.
   * @returns This simulator, for chaining.
   */
  caller(text: string): this {
    this.log({ role: 'user', content: text });
    this.waitingForUser = false;
    return this;
  }

  /**
   * The agent says `text`, as the model's reply.
   * @param text - What it says.
   * @returns This simulator, for chaining.
   */
  agentSays(text: string): this {
    this.log({ role: 'assistant', content: text });
    return this;
  }

  /** `globalData.semantic_state`, or undefined. */
  get semanticState(): unknown {
    return this.globalData['semantic_state'];
  }

  /**
   * The tools the model is offered now, as the current step allows, in the
   * agent's order, with the navigation tools after them.
   * @returns Their names.
   */
  offered(): string[] {
    const offered = Object.keys(this.functions).filter(
      (name) => this.toggled.get(name) ?? this.stepFunctions.has(name),
    );
    const step = this.currentStep();
    if (step && isNonEmpty(step['valid_steps'])) offered.push('next_step');
    if (this.validContexts().length > 0) offered.push('change_context');
    return offered;
  }

  // ── Tool calls ──────────────────────────────────────────────────────

  /**
   * The model calls `name` with `args`.
   *
   * The call is checked as the platform checks it: a tool the current step
   * doesn't offer, or one the platform doesn't know, doesn't run, and the model
   * gets the platform's reply naming the tools it has. A gated tool runs only
   * when every gate passes. Otherwise the tool runs as the `/swaig` route runs
   * it, with a request like the platform's, and its result's actions change
   * the call.
   *
   * @param name - The tool.
   * @param args - Its arguments.
   * @returns What the call came to.
   * @throws Error when the call has ended, or for a DataMap tool without a stub.
   */
  async call(name: string, args: Json = {}): Promise<SimulatedCall> {
    if (this.ended) throw new Error('the call has ended');
    const callArgs = { ...args };
    this.log({
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name, arguments: JSON.stringify(callArgs) } }],
    });
    let outcome: SimulatedCall;
    if (!this.offered().includes(name)) {
      outcome = new SimulatedCall(
        name,
        callArgs,
        { response: this.unavailable(name) },
        { ran: false, blockedBy: 'step' },
      );
    } else if (NAVIGATION.includes(name)) {
      outcome = this.navigate(name, callArgs);
    } else {
      outcome = await this.dispatch(name, callArgs);
    }
    this.log({ role: 'tool', content: outcome.response });
    this.calls.push(outcome);
    return outcome;
  }

  /**
   * Run recorded tool requests against the agent again, as they came.
   *
   * Each request is a SWAIG request body, as {@link RequestRecorder} records
   * it, with its own call data; the simulated call's state isn't used or
   * changed. Use it to check that changed code still gives the results it gave
   * on real calls.
   *
   * @param requests - The requests.
   * @returns What each request came to, in order.
   */
  async replay(requests: Iterable<Json>): Promise<SimulatedCall[]> {
    const outcomes: SimulatedCall[] = [];
    for (const body of requests) {
      const name = String(body['function'] ?? '');
      const args = { ...this.agent._extractSwaigArgs(body) };
      const result = await this.run(name, args, structuredClone(body));
      outcomes.push(new SimulatedCall(name, args, result, { ran: true }));
    }
    return outcomes;
  }

  // ── Internals ───────────────────────────────────────────────────────

  /** The agent's answer to a call, as the `/swaig` route gives it. */
  private async run(name: string, args: Json, rawData: Json): Promise<Json> {
    const hookResult = await this.agent.onFunctionCall(name, args, rawData);
    if (hookResult !== undefined && hookResult !== null) return asResult(hookResult);
    const fn = this.agent.getTool(name);
    // A function the SWML has that isn't a local tool was registered as a dict
    if (fn === undefined && !Object.hasOwn(this.functions, name)) {
      return { response: `Function '${name}' not found` };
    }
    if (!(fn instanceof SwaigFunction)) {
      return {
        response: `Data map function '${name}' should be executed by SignalWire server, not locally`,
      };
    }
    if (fn.webhookUrl) {
      return {
        response: `External webhook function '${name}' should be executed by SignalWire at ${fn.webhookUrl}, not locally`,
      };
    }
    return asResult(await this.agent._executeFunction(fn, args, rawData));
  }

  private async dispatch(name: string, args: Json): Promise<SimulatedCall> {
    const definition = this.functions[name]!;
    const blocked = await this.checkGates(name, definition, args);
    if (blocked !== null) return blocked;
    let result: Json;
    const stub = Object.hasOwn(this.stubs, name) ? this.stubs[name] : undefined;
    if (stub) {
      result = asResult(await stub(args));
    } else if ('data_map' in definition) {
      throw new Error(
        `${name} is a DataMap tool, which runs on the platform; give a stub for it: ` +
          'new CallSimulator(agent, { stubs: {...} })',
      );
    } else {
      result = await this.run(name, args, this.request(name, args));
    }
    this.apply(result);
    return new SimulatedCall(name, args, result, { ran: true });
  }

  private async checkGates(
    name: string,
    definition: Json,
    args: Json,
  ): Promise<SimulatedCall | null> {
    const gates = Array.isArray(definition['gates']) ? (definition['gates'] as Json[]) : [];
    let unclear: Json | null = null;
    for (const [index, gate] of gates.entries()) {
      const answer = this.gates === undefined ? true : await this.gates(gate, this, args);
      const gateId = String(gate['id'] ?? `gate_${index + 1}`);
      if (answer === 'unclear') {
        unclear ??= { ...gate, id: gateId };
        continue;
      }
      const passed =
        typeof answer === 'number' ? answer >= Number(gate['threshold'] ?? 1) : Boolean(answer);
      if (!passed) return this.blocked(name, args, asRecord(gate['on_fail']), gateId);
    }
    if (unclear !== null) {
      const onUnclear = isRecord(unclear['on_unclear'])
        ? unclear['on_unclear']
        : { response: `${name} was not run. Ask the caller again.` };
      return this.blocked(name, args, onUnclear, String(unclear['id']));
    }
    return null;
  }

  private blocked(name: string, args: Json, output: Json, gateId: string): SimulatedCall {
    const result = expand(structuredClone(output), {
      global_data: this.globalData,
      args,
    }) as Json;
    this.apply(result);
    return new SimulatedCall(name, args, result, { ran: false, blockedBy: gateId });
  }

  private navigate(name: string, args: Json): SimulatedCall {
    if (name === 'next_step') {
      const requested = String(args['step'] ?? '');
      const valid = this.currentStep()?.['valid_steps'];
      const target = requested === 'next' ? this.followingStep() : requested;
      if (!Array.isArray(valid) || !valid.includes(requested) || target === null) {
        return new SimulatedCall(
          name,
          args,
          { response: `${requested} is not a step you can go to.` },
          { ran: false, blockedBy: 'step' },
        );
      }
      this.enterStep(target);
      return new SimulatedCall(name, args, { response: `Moved to step ${target}.` }, { ran: true });
    }
    const target = String(args['context'] ?? '');
    if (!this.validContexts().includes(target) || !Object.hasOwn(this.contexts, target)) {
      return new SimulatedCall(
        name,
        args,
        { response: `${target} is not a context you can go to.` },
        { ran: false, blockedBy: 'step' },
      );
    }
    this.enterContext(target);
    return new SimulatedCall(
      name,
      args,
      { response: `Moved to context ${target}.` },
      { ran: true },
    );
  }

  private request(name: string, args: Json): Json {
    this.toolCalls += 1;
    const request: Json = {
      function: name,
      argument: { parsed: [args], raw: JSON.stringify(args) },
      call_id: this.callId,
      tool_call_id: `${this.callId}-tool-${this.toolCalls}`,
      global_data: structuredClone(this.globalData),
      content_type: 'text/swaig',
      version: '2.0',
    };
    if (this.params['swaig_post_conversation']) {
      request['call_log'] = structuredClone(this.callLog);
      request['raw_call_log'] = structuredClone(this.callLog);
    }
    return request;
  }

  private apply(result: Json): void {
    const actions = result['action'] ?? [];
    for (const action of Array.isArray(actions) ? actions : [actions]) {
      if (!isRecord(action)) continue;
      for (const [key, value] of Object.entries(action)) this.applyOne(key, value);
    }
  }

  private applyOne(key: string, value: unknown): void {
    if (key === 'say') {
      this.log({ role: 'assistant', content: String(value) });
    } else if (key === 'set_global_data' && isRecord(value)) {
      Object.assign(this.globalData, structuredClone(value));
    } else if (key === 'unset_global_data') {
      const names = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
      for (const name of names) delete this.globalData[String(name)];
    } else if (key === 'change_step') {
      this.enterStep(String(value));
    } else if (key === 'change_context') {
      this.enterContext(String(value));
    } else if (key === 'toggle_functions' && Array.isArray(value)) {
      for (const toggle of value) {
        if (isRecord(toggle) && 'function' in toggle) {
          this.toggled.set(String(toggle['function']), Boolean(toggle['active'] ?? true));
        }
      }
    } else if (key === 'back_to_back_functions') {
      this.chaining = value;
    } else if (key === 'semantic_gate_mark') {
      // The platform keeps a call's 16 newest names; setting one moves it
      this.marks.delete(String(value));
      this.marks.set(String(value), this.callLog.length);
      while (this.marks.size > MAX_MARKS) this.marks.delete(this.marks.keys().next().value!);
    } else if (key === 'wait_for_user') {
      this.waitingForUser = Boolean(value);
    } else if (key === 'hangup' || key === 'stop') {
      this.ended = true;
    }
  }

  private enterContext(name: string): void {
    if (!Object.hasOwn(this.contexts, name)) {
      throw new Error(`the agent has no context ${JSON.stringify(name)}`);
    }
    const steps = this.stepsOf(name);
    this.context = name;
    this.stepFunctions = new Set(this.tools());
    const initial = this.contexts[name]!['initial_step'] || (steps[0]?.['name'] ?? null);
    if (initial) this.enterStep(String(initial));
  }

  private enterStep(name: string): void {
    if (this.context === null) return;
    const step = this.findStep(name);
    if (step === null) {
      throw new Error(
        `context ${JSON.stringify(this.context)} has no step ${JSON.stringify(name)}`,
      );
    }
    this.step = name;
    const functions = step['functions'];
    if (functions === 'none' || (Array.isArray(functions) && functions.length === 0)) {
      this.stepFunctions = new Set();
    } else if (Array.isArray(functions)) {
      this.stepFunctions = new Set(functions.map(String));
    }
    // A step without a function list keeps the set before it
  }

  private stepsOf(context: string | null): Json[] {
    if (context === null) return [];
    const steps = this.contexts[context]?.['steps'];
    return Array.isArray(steps) ? (steps as unknown[]).filter(isRecord) : [];
  }

  private currentStep(): Json | null {
    return this.step === null ? null : this.findStep(this.step);
  }

  private findStep(name: string): Json | null {
    const step = this.stepsOf(this.context).find((s) => s['name'] === name);
    return step ? { ...step } : null;
  }

  private followingStep(): string | null {
    const names = this.stepsOf(this.context).map((s) => s['name']);
    const at = names.indexOf(this.step);
    return at >= 0 && at + 1 < names.length ? String(names[at + 1]) : null;
  }

  private validContexts(): string[] {
    const step = this.currentStep() ?? {};
    if (step['valid_contexts'] !== undefined && step['valid_contexts'] !== null) {
      return (step['valid_contexts'] as unknown[]).map(String);
    }
    if (this.context !== null) {
      const valid = this.contexts[this.context]!['valid_contexts'];
      return Array.isArray(valid) ? valid.map(String) : [];
    }
    return [];
  }

  private tools(): string[] {
    return Object.keys(this.functions).filter((name) => !RESERVED_FUNCTION_NAMES.has(name));
  }

  /** The current context's other steps whose functions include `name`, in step order. */
  private stepsOffering(name: string): string[] {
    return this.stepsOf(this.context)
      .filter(
        (step) =>
          step['name'] !== this.step &&
          Array.isArray(step['functions']) &&
          step['functions'].includes(name),
      )
      .map((step) => String(step['name']));
  }

  /** The platform's reply to a call of a tool it won't run now. */
  private unavailable(name: string): string {
    const offered = this.offered();
    const tools = offered.join(', ');
    const known = Object.hasOwn(this.functions, name);
    const steps = known ? this.stepsOffering(name).join(', ') : '';
    const template = this.params['unavailable_function_response'];
    if (typeof template === 'string' && template) {
      return template
        .replaceAll('${function}', () => name)
        .replaceAll('${tools}', () => tools)
        .replaceAll('${steps}', () => steps);
    }
    let text: string;
    if (known) {
      text = `Nothing ran: ${name} isn't available at this point in the call.`;
      if (steps) text += ` The steps that offer it: ${steps}.`;
    } else {
      text = `Nothing ran: there is no tool named ${name}.`;
    }
    if (offered.length > 0) return `${text} The tools available now are: ${tools}.\n`;
    return `${text} No tools are available now.\n`;
  }

  private log(entry: Json): void {
    this.callLog.push({ ...entry, timestamp: Date.now() * 1000 });
  }
}

/** Options for a {@link RequestRecorder}. */
export interface RequestRecorderOptions {
  /** The most requests kept in `requests`, newest kept. Default 1000. */
  limit?: number;
}

/**
 * Tool middleware that records each tool request, for
 * {@link CallSimulator.replay}.
 *
 * @example
 * ```ts
 * const recorder = new RequestRecorder('tool_requests.jsonl');
 * agent.addToolMiddleware(recorder.middleware);
 * // ...
 * await new CallSimulator(agent).replay(RequestRecorder.load('tool_requests.jsonl'));
 * ```
 *
 * The requests carry what the caller said and the call's data: keep the file
 * where you'd keep call recordings.
 */
export class RequestRecorder {
  /** A file each request is appended to, one JSON object a line. */
  readonly path: string | null;
  /** The most requests kept in `requests`. */
  readonly limit: number;
  /** The requests recorded, oldest first. */
  requests: Json[] = [];
  /** The file's writes, in the order the requests came. */
  private writes: Promise<void> = Promise.resolve();

  /**
   * @param path - A file to append each request to, one JSON object a line.
   * @param opts - `limit`.
   */
  constructor(path?: string | null, opts: RequestRecorderOptions = {}) {
    this.path = path ?? null;
    this.limit = opts.limit ?? 1000;
  }

  /** This recorder as a {@link ToolMiddleware}. */
  readonly middleware: ToolMiddleware = (name, args, rawData, callNext) =>
    this.handle(name, args, rawData, callNext);

  /**
   * Record a request, then run the rest of the chain.
   * @param name - The tool's name.
   * @param args - The arguments.
   * @param rawData - The SWAIG request.
   * @param callNext - The rest of the chain.
   * @returns The call's result.
   */
  async handle(name: string, args: Json, rawData: Json, callNext: CallNext): Promise<unknown> {
    const request = structuredClone(rawData);
    if (!('function' in request)) request['function'] = name;
    if (!('argument' in request)) {
      request['argument'] = { parsed: [args], raw: JSON.stringify(args) };
    }
    this.requests.push(request);
    this.requests.splice(0, Math.max(0, this.requests.length - this.limit));
    if (this.path !== null) {
      const line = JSON.stringify(request, (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
      const path = this.path;
      const write = this.writes.then(() => appendFile(path, `${line}\n`, 'utf-8'));
      // A failed write doesn't stop the writes after it
      this.writes = write.catch(() => undefined);
      await write;
    }
    return await callNext(args, rawData);
  }

  /**
   * The requests a recorder wrote to `path`.
   * @param path - The file.
   * @returns The requests, in order.
   */
  static load(path: string): Json[] {
    return readFileSync(path, 'utf-8')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as Json);
  }
}

function aiVerb(swml: Json): Json {
  const main = asRecord(swml['sections'])['main'];
  for (const verb of Array.isArray(main) ? main : []) {
    if (isRecord(verb) && isRecord(verb['ai'])) return verb['ai'];
  }
  throw new Error("the agent's SWML has no ai verb");
}

function asResult(result: unknown): Json {
  if (result instanceof FunctionResult) return result.toDict() as unknown as Json;
  if (isRecord(result)) return result;
  return { response: String(result) };
}

/**
 * `${...}` variables in a gate's output, from the call's data, as the platform
 * expands them once; a variable it can't find is left as it is.
 */
function expand(value: unknown, data: Json): unknown {
  if (typeof value === 'string') {
    return value.replace(VARIABLE, (match, path: string) => {
      let found: unknown = data;
      for (const part of path.split('.')) {
        if (!isRecord(found) || !Object.hasOwn(found, part)) return match;
        found = found[part];
      }
      return typeof found === 'string' ? found : JSON.stringify(found);
    });
  }
  if (Array.isArray(value)) return value.map((v) => expand(v, data));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v, data)]));
  }
  return value;
}

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Json {
  return isRecord(value) ? value : {};
}

function isNonEmpty(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}
