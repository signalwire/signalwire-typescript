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
 * doesn't run a model, DataMap tools (give a stub), gather questions,
 * consolidation, the sliding window, or the gates' decision model (give a
 * callback). {@link CallSimulator.modelView} shows what the model gets after
 * the steps' history modes, and {@link CallSimulator.gateConversation} the
 * dialogue a gate judges. It renders and runs tools on the
 * agent itself: a dynamic config callback's per-request copy isn't made.
 *
 * {@link RequestRecorder} records real tool requests for
 * {@link CallSimulator.replay}.
 */

import { appendFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import type { AgentBase } from '../AgentBase.js';
import { namedTools } from '../ContextBuilder.js';
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

/** What a call log entry is, for the history modes. */
type EntryKind = 'spoken' | 'tool_call' | 'tool_result' | 'note' | 'instruction';

/** A tool result named a tool the step it left the call in doesn't offer. */
export class ToolMentionError extends Error {
  override name = 'ToolMentionError';
}

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
  /**
   * True to fail a call whose result, or the gate output that blocked it,
   * names a tool the step it leaves the call in doesn't offer, after its own
   * step or context change: the model reads the name and may call a tool it
   * doesn't have. `call()` then rejects with a {@link ToolMentionError}. Names
   * are found as rendering finds them in step text ({@link namedTools}).
   */
  checkToolMentions?: boolean;
}

/**
 * A simulated call to an agent, for tests.
 *
 * @example
 * ```ts
 * import assert from 'node:assert';
 * import { AgentBase, CallSimulator } from '@signalwire/sdk';
 *
 * declare const agent: AgentBase; // an agent with review_order and place_order steps
 * const sim = new CallSimulator(agent, { gates: () => true });
 * sim.caller("I'd like a large tea");
 * assert.equal((await sim.call('place_order', { item: 'tea' })).ran, false); // not offered yet
 * await sim.call('review_order', { item: 'large tea' });
 * sim.caller('yes');
 * assert.equal((await sim.call('place_order')).ran, true);
 * assert.equal(sim.step, 'done');
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
   * The semantic gate marks set, by name: the call log position where the
   * action list that set each began, so `callLog.slice(marks.get(name))` is
   * since it.
   */
  marks = new Map<string, number>();
  /** The current context, null without contexts. */
  context: string | null = null;
  /** The current step, null without contexts. */
  step: string | null = null;

  private readonly gates?: GateCallback;
  private readonly stubs: Record<string, ToolStub>;
  private readonly checkToolMentions: boolean;
  private readonly contexts: Record<string, Json>;
  private readonly toggled = new Map<string, boolean>();
  private toolCalls = 0;
  private stepFunctions: Set<string>;
  // What the model sees: each call log entry's kind, and which are out of its
  // view (see modelView)
  private readonly kinds = new Map<number, EntryKind>();
  private readonly hidden = new Set<number>();
  private readonly isolatedEntries = new Set<number>();
  private readonly cleared = new Set<number>();
  // The entries that are a result's say
  private readonly says = new Set<number>();
  private injectPending = false;
  // Where the call whose actions are running started, and where the exchange
  // that entered the current step starts: spoken, hide and isolate keep it.
  // Null when nothing is kept: a change by next_step
  private callStart: number | null = null;
  private enteredAt: number | null = 0;
  // A post_process result's actions, waiting for the model's reply, and where
  // their call started
  private deferred: { actions: unknown[]; callStart: number | null } | null = null;
  // The current step's instruction entry and its text before expansion, and
  // each instruction's text as the model gets it now, when the platform
  // expanded it again
  private instruction: { index: number; text: string } | null = null;
  private readonly shown = new Map<number, string>();
  // Where the proposal (semantic_state's last change) starts in the call log
  private proposalAt: number | null = null;
  private actionStart = 0;

  /**
   * @param agent - The agent.
   * @param opts - `callId`, `gates`, `stubs` and `globalData`.
   */
  constructor(agent: AgentBase, opts: CallSimulatorOptions = {}) {
    this.agent = agent;
    this.callId = opts.callId ?? 'simulated-call';
    this.gates = opts.gates;
    this.stubs = { ...(opts.stubs ?? {}) };
    this.checkToolMentions = opts.checkToolMentions ?? false;
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
    this.inject();
  }

  // ── The conversation ────────────────────────────────────────────────

  /**
   * The caller says `text`.
   * @param text - What they say.
   * @returns This simulator, for chaining.
   */
  caller(text: string): this {
    // Stored before the next request, which is when a pending step is injected
    this.log({ role: 'user', content: text }, 'spoken');
    this.waitingForUser = false;
    return this;
  }

  /**
   * The agent says `text`, as the model's reply. The actions of a
   * `post_process` result waiting for it run after it.
   * @param text - What it says.
   * @returns This simulator, for chaining.
   */
  agentSays(text: string): this {
    this.inject();
    this.log({ role: 'assistant', content: text }, 'spoken');
    if (this.deferred !== null) {
      const { actions, callStart } = this.deferred;
      this.deferred = null;
      this.callStart = callStart;
      this.runActions(actions);
      this.callStart = null;
    }
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
   * the call. A result with `post_process` runs its actions after the model's
   * reply to it, as the platform does: give the reply with {@link agentSays}. A
   * newer such result replaces actions still waiting.
   *
   * @param name - The tool.
   * @param args - Its arguments.
   * @returns What the call came to.
   * @throws Error when the call has ended, or for a DataMap tool without a stub.
   * @throws {ToolMentionError} With `checkToolMentions`, for a result that names a
   *   tool the step it leaves the call in doesn't offer.
   */
  async call(name: string, args: Json = {}): Promise<SimulatedCall> {
    if (this.ended) throw new Error('the call has ended');
    const callArgs = { ...args };
    this.inject();
    this.callStart = this.callLog.length;
    this.log(
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name, arguments: JSON.stringify(callArgs) } }],
      },
      'tool_call',
    );
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
    this.log({ role: 'tool', content: outcome.response }, 'tool_result');
    if (outcome.toolPrompt) {
      // The platform adds a result's tool_prompt as a system note
      this.log({ role: 'system', content: outcome.toolPrompt }, 'note');
    }
    this.calls.push(outcome);
    this.callStart = null;
    // A call whose result changed the step gets its follow-up request right
    // away, and the new step is injected before it
    this.inject();
    if (this.checkToolMentions && outcome.blockedBy !== 'step') this.checkMentions(outcome);
    return outcome;
  }

  private checkMentions(outcome: SimulatedCall): void {
    const text = `${outcome.response} ${outcome.toolPrompt ?? ''}`;
    const offered = new Set(this.offered());
    const named = [...namedTools(text, this.tools())].filter((t) => !offered.has(t)).sort();
    if (named.length > 0) {
      const where = this.step ? `step '${this.step}'` : 'the call';
      throw new ToolMentionError(
        `${outcome.name}'s result names ${named.join(', ')}, which ${where} doesn't offer: ` +
          JSON.stringify(text.trim()),
      );
    }
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
      this.enteredAt = null; // next_step keeps nothing of its own
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
    const given = result['action'] ?? [];
    const actions: unknown[] = Array.isArray(given) ? given : [given];
    if (result['post_process'] && actions.length > 0) {
      this.deferred = { actions, callStart: this.callStart };
      return;
    }
    this.runActions(actions);
  }

  private runActions(actions: unknown[]): void {
    // A proposal or mark is set as of the start of the result's action list,
    // so a say anywhere in the list is after it
    this.actionStart = this.callLog.length;
    for (const action of actions) {
      if (!isRecord(action)) continue;
      for (const [key, value] of Object.entries(action)) this.applyOne(key, value);
    }
  }

  private applyOne(key: string, value: unknown): void {
    if (key === 'say') {
      this.says.add(this.callLog.length);
      this.log({ role: 'assistant', content: String(value) }, 'spoken');
    } else if (key === 'set_global_data' && isRecord(value)) {
      if (
        'semantic_state' in value &&
        !sameJson(value['semantic_state'], this.globalData['semantic_state'])
      ) {
        // Setting the same state again marks nothing; {} leaves none
        this.proposalAt = pyTruthy(value['semantic_state']) ? this.actionStart : null;
      }
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
      this.marks.set(String(value), this.actionStart);
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
    // The platform injects the step's instructions, and applies its history
    // mode, before the next request to the model: for a tool that changed the
    // step, the follow-up right after its result. The call is the new step's
    // start, with everything stored from it on: for a post_process change, the
    // reply and the caller's words too
    this.injectPending = true;
    this.enteredAt = this.callStart ?? this.callLog.length;
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

  private log(entry: Json, kind: EntryKind = 'spoken'): void {
    this.kinds.set(this.callLog.length, kind);
    this.callLog.push({ ...entry, timestamp: Date.now() * 1000 });
  }

  // ── What the model sees ─────────────────────────────────────────────

  /**
   * The current step's history mode: its own, its context's, or "default".
   * @returns The mode.
   */
  historyMode(): string {
    const step = this.currentStep() ?? {};
    const context = this.context !== null ? (this.contexts[this.context] ?? {}) : {};
    return String(step['history'] || context['history'] || 'default');
  }

  /**
   * The conversation entries the model gets now, oldest first, after the
   * history modes of the steps entered so far.
   *
   * At each step's injection, the platform first restores what an isolate
   * step hid, then applies the new step's mode to everything before it:
   *
   * - `keep`: nothing leaves.
   * - `default`: earlier step instructions leave.
   * - `hide`: earlier instructions, and every earlier spoken turn, tool call,
   *   tool result and system note, leave for the rest of the call.
   * - `isolate`: as `hide`, until the call leaves the step.
   * - `spoken`: earlier instructions, and every earlier tool call, tool result
   *   and system note, leave for the rest of the call; every spoken turn stays.
   *
   * `hide`, `isolate` and `spoken` keep the exchange that entered the step, as
   * its start: the call whose action changed it, its result, notes and say,
   * and caller words stored before the step was injected. For a `post_process`
   * action's change, which runs after the model's reply, that's the call and
   * everything stored from it on, the reply included. A change by `next_step`
   * keeps nothing. After that they're ordinary entries, which each later
   * step's mode treats like the rest.
   *
   * It's the view for the model's next request: a step entered by a `say` or
   * another action outside a tool call is injected before it, as the platform
   * injects a step before the next request. A result's `say` is the agent's
   * turn after the call's result and notes: the platform holds it until the
   * next caller or agent turn, past system entries such as a step's
   * instructions, or to the end. The current step's instructions are its text
   * expanded with the global data now, as the platform expands it again when a
   * value it reads changes; `callLog` keeps the text as it went in. An end
   * step, or one with a reset, keeps the text it went in with, and brings back
   * what an `isolate` step hid, as steps end there. The base prompt isn't
   * included.
   *
   * @returns The entries, without their timestamps.
   */
  modelView(): Json[] {
    this.inject();
    const view: Json[] = [];
    const held: Json[] = [];
    this.callLog.forEach((entry, index) => {
      if (this.hidden.has(index) || this.isolatedEntries.has(index) || this.cleared.has(index)) {
        return;
      }
      const shown: Json = { ...entry };
      delete shown['timestamp'];
      if (this.shown.has(index)) shown['content'] = this.shown.get(index);
      if (this.says.has(index)) {
        held.push(shown);
        return;
      }
      if ((shown['role'] === 'user' || shown['role'] === 'assistant') && !shown['tool_calls']) {
        view.push(...held);
        held.length = 0;
      }
      view.push(shown);
    });
    return [...view, ...held];
  }

  /**
   * The dialogue a semantic gate judges now, as `"role: text"` lines, oldest
   * first: the spoken turns the model sees ({@link modelView}), chosen as the
   * platform chooses them.
   *
   * With the gate's `since` mark set, the turns from the agent's first turn at
   * or after the mark. Otherwise, with `dialogue` "proposal" (the gate's, or
   * the agent's `semantic_gate_dialogue`) and a proposal marked, the turns
   * from the agent's first turn after `semantic_state` last changed. Otherwise
   * the window. Then at most `history` of the newest (the gate's, the agent's
   * `semantic_gate_history`, or 20).
   *
   * Give it to a gate callback: `gates: (gate, sim) =>
   * judge(gate['question'], sim.gateConversation(gate))`.
   *
   * @param gate - The gate, as rendered; default none.
   * @returns The lines.
   */
  gateConversation(gate: Json = {}): string[] {
    this.inject();
    let spoken = this.callLog
      .map((_, i) => i)
      .filter(
        (i) =>
          !this.hidden.has(i) &&
          !this.isolatedEntries.has(i) &&
          this.kinds.get(i) === 'spoken' &&
          Boolean(this.callLog[i]!['content']),
      );
    let start: number | null = null;
    const since = gate['since'];
    const dialogue = gate['dialogue'] || this.params['semantic_gate_dialogue'];
    if (typeof since === 'string' && this.marks.has(since)) {
      start = this.marks.get(since)!;
    } else if (String(dialogue ?? '').toLowerCase() === 'proposal' && this.proposalAt !== null) {
      start = this.proposalAt;
    }
    if (start !== null) {
      const from = start;
      const firstAgent = spoken.find((i) => i >= from && this.callLog[i]!['role'] === 'assistant');
      spoken = firstAgent === undefined ? [] : spoken.filter((i) => i >= firstAgent);
    }
    const history = Math.trunc(
      Number(gate['history'] || this.params['semantic_gate_history'] || 20),
    );
    const newest = history > 0 ? spoken.slice(-history) : [];
    return newest.map((i) => `${this.callLog[i]!['role']}: ${this.callLog[i]!['content']}`);
  }

  /**
   * Before a request to the model: inject the current step's instructions,
   * applying its history mode to what came before, once a step change is
   * pending; otherwise expand the current step's text again.
   */
  private inject(): void {
    if (!this.injectPending) {
      this.refresh();
      return;
    }
    this.injectPending = false;
    this.isolatedEntries.clear();
    const mode = this.historyMode();
    const before = this.callLog.length;
    if (mode !== 'keep') {
      for (let i = 0; i < before; i++) {
        if (this.kinds.get(i) === 'instruction') this.cleared.add(i);
      }
    }
    if (mode === 'hide' || mode === 'isolate' || mode === 'spoken') {
      // The exchange that entered the step stays: it's the step's start
      const keptFrom = this.enteredAt ?? before;
      const target = mode === 'isolate' ? this.isolatedEntries : this.hidden;
      for (let i = 0; i < keptFrom; i++) {
        const kind = this.kinds.get(i);
        if (kind === 'instruction' || this.hidden.has(i)) continue;
        if (mode === 'spoken' && kind === 'spoken') continue;
        target.add(i);
      }
    }
    const step = this.currentStep() ?? {};
    const context = this.context !== null ? (this.contexts[this.context] ?? {}) : {};
    const text = [String(context['prompt'] || ''), String(step['text'] || '')]
      .filter((part) => part)
      .join('\n\n');
    // An end step, or one with a reset, ends steps mode once it's in: its text
    // isn't expanded again, and what an isolate step hid is back
    const terminal = Boolean(step['end']) || isRecord(step['reset']);
    this.instruction = terminal ? null : { index: this.callLog.length, text };
    if (terminal) this.isolatedEntries.clear();
    this.log(
      {
        role: 'system',
        content: expand(text, { global_data: this.globalData }, '') as string,
      },
      'instruction',
    );
  }

  /**
   * The platform rewrites the step's instruction entry in place when its
   * expansion changes; the call log keeps the text as it went in.
   */
  private refresh(): void {
    if (this.instruction === null) return;
    const { index, text } = this.instruction;
    const expanded = expand(text, { global_data: this.globalData }, '') as string;
    if (expanded === this.callLog[index]!['content']) this.shown.delete(index);
    else this.shown.set(index, expanded);
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
 * import { AgentBase, CallSimulator, RequestRecorder } from '@signalwire/sdk';
 *
 * declare const agent: AgentBase;
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
 * `${...}` variables from the call's data, as the platform expands them once. A
 * variable it can't find becomes `missing`, or is left as it is without one.
 */
function expand(value: unknown, data: Json, missing?: string): unknown {
  if (typeof value === 'string') {
    return value.replace(VARIABLE, (match, path: string) => {
      let found: unknown = data;
      for (const part of path.split('.')) {
        if (!isRecord(found) || !Object.hasOwn(found, part)) return missing ?? match;
        found = found[part];
      }
      return typeof found === 'string' ? found : JSON.stringify(found);
    });
  }
  if (Array.isArray(value)) return value.map((v) => expand(v, data, missing));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v, data, missing)]));
  }
  return value;
}

/** Whether two JSON values are equal, whatever their keys' order. */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((k) => Object.hasOwn(b, k) && sameJson(a[k], b[k]))
    );
  }
  return false;
}

/** A value's truth as the reference reads it: an empty object or list is false. */
function pyTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return Boolean(value);
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
