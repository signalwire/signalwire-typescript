/**
 * LiveWire -- LiveKit-compatible agents powered by SignalWire.
 *
 * Provides the same class/function names as @livekit/agents-js so that
 * developers can swap their import path and run on SignalWire's
 * infrastructure.  STT, TTS, VAD, LLM orchestration, and call control
 * are all handled by SignalWire's control plane -- the noop'd options
 * are accepted silently (logged once) to keep existing code compiling.
 */

import { AgentBase } from '../AgentBase.js';
import { FunctionResult } from '../FunctionResult.js';
import type { SwaigHandler } from '../SwaigFunction.js';

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

const banner = `
    __    _            _       ___
   / /   (_)   _____  | |     / (_)_______
  / /   / / | / / _ \\ | | /| / / / ___/ _ \\
 / /___/ /| |/ /  __/ | |/ |/ / / /  /  __/
/_____/_/ |___/\\___/  |__/|__/_/_/   \\___/

 LiveKit-compatible agents powered by SignalWire
`;

/** Print the ASCII banner to stderr, using ANSI cyan when stderr is a TTY. */
function printBanner(): void {
  if (process.stderr.isTTY) {
    process.stderr.write(`\x1b[36m${banner}\x1b[0m\n`);
  } else {
    process.stderr.write(`${banner}\n`);
  }
}

// ---------------------------------------------------------------------------
// "Did You Know?" Tips
// ---------------------------------------------------------------------------

export const tips: string[] = [
  "SignalWire agents support DataMap tools that execute server-side — no webhook infrastructure needed. See: docs/datamap-guide.md",
  "SignalWire Contexts & Steps give you mechanical state control over conversations — no prompt engineering needed. See: docs/contexts-guide.md",
  "SignalWire agents can transfer calls between agents with a single SwmlTransfer() action",
  "SignalWire handles 18 built-in skills (datetime, math, web search, etc.) with one-liner integration via agent.addSkill()",
  "SignalWire agents support SMS, conferencing, call recording, and SIP — all from the same agent",
  "Your agent's entire AI pipeline (STT, LLM, TTS, VAD) runs in SignalWire's cloud — zero infrastructure to manage",
  "SignalWire prefab agents (Survey, Receptionist, FAQ, Concierge) give you production patterns in 10 lines of code",
  "SignalWire's RELAY client gives you real-time WebSocket call control with 57+ methods — play, record, detect, conference, and more",
  "SignalWire agents auto-generate SWML documents — the platform handles media, turn detection, and barge-in for you",
  "You can host multiple agents on one server with AgentServer — each with its own route, prompt, and tools",
];

function printTip(): void {
  const tip = tips[Math.floor(Math.random() * tips.length)];
  process.stderr.write(`\n\u{1f4a1} Did you know?  ${tip}\n\n`);
}

// ---------------------------------------------------------------------------
// Noop logging helpers
// ---------------------------------------------------------------------------

/**
 * NoopTracker ensures each informational message is logged at most once,
 * preventing spam when the same noop path is exercised repeatedly.
 */
class NoopTracker {
  private logged = new Set<string>();

  once(key: string, message: string): void {
    if (this.logged.has(key)) return;
    this.logged.add(key);
    process.stderr.write(`[LiveWire] ${message}\n`);
  }

  /** Expose whether a key has been logged (for testing). */
  hasLogged(key: string): boolean {
    return this.logged.has(key);
  }

  /** Reset all tracked keys (for testing). */
  reset(): void {
    this.logged.clear();
  }
}

const globalNoop = new NoopTracker();

// Re-export for testing
export { NoopTracker, globalNoop };

// ---------------------------------------------------------------------------
// VoiceOptions
// ---------------------------------------------------------------------------

/** Voice configuration options passed through to the SignalWire AI config. */
export interface VoiceOptions {
  voice: string;
  engine: string;
  language: string;
}

// ---------------------------------------------------------------------------
// FunctionTool
// ---------------------------------------------------------------------------

/** A tool definition that can be registered on an Agent. */
export interface FunctionTool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute: (params: any, context: { ctx: RunContext }) => any;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/** Mirrors a LiveKit voice.Agent -- holds instructions and tool definitions. */
export class Agent<UserData = any> {
  instructions: string;
  tools: Record<string, FunctionTool>;
  userData?: UserData;

  /** @internal Pipeline hint stored for AgentSession mapping. */
  _llmHint: unknown;
  /** @internal */
  _allowInterruptions: unknown;
  /** @internal */
  _minEndpointingDelay: unknown;
  /** @internal */
  _maxEndpointingDelay: unknown;

  private _session?: AgentSession<UserData>;

  constructor(options?: {
    instructions?: string;
    tools?: FunctionTool[];
    userData?: UserData;
    chatCtx?: unknown;
    stt?: unknown;
    tts?: unknown;
    llm?: unknown;
    vad?: unknown;
    turnDetection?: unknown;
    mcpServers?: unknown;
    allowInterruptions?: boolean;
    minEndpointingDelay?: number;
    maxEndpointingDelay?: number;
  }) {
    this.instructions = options?.instructions ?? '';
    // Mirror Python: tools is Optional[List[Any]], stored internally as a name-keyed map.
    // Build the record from the array using the same pattern as updateTools().
    if (options?.tools) {
      const record: Record<string, FunctionTool> = {};
      for (const t of options.tools) {
        record[t.name] = t;
      }
      this.tools = record;
    } else {
      this.tools = {};
    }
    this.userData = options?.userData;

    // Pipeline noop advisories (matching Python behavior)
    if (options?.stt != null) {
      globalNoop.once(
        'agent_stt',
        "Agent(stt=...): SignalWire's control plane handles speech recognition at scale -- no configuration needed",
      );
    }
    if (options?.tts != null) {
      globalNoop.once(
        'agent_tts',
        "Agent(tts=...): SignalWire's control plane handles text-to-speech at scale -- no configuration needed",
      );
    }
    if (options?.vad != null) {
      globalNoop.once(
        'agent_vad',
        "Agent(vad=...): SignalWire's control plane handles voice activity detection at scale automatically",
      );
    }
    if (options?.turnDetection != null) {
      globalNoop.once(
        'agent_turn_detection',
        "Agent(turnDetection=...): SignalWire's control plane handles turn detection at scale automatically",
      );
    }
    if (options?.mcpServers != null) {
      globalNoop.once(
        'agent_mcp_servers',
        'Agent(mcpServers=...): MCP servers are not yet supported in LiveWire -- tools should be registered via tool()',
      );
    }

    // Store pipeline hints for later mapping (used by AgentSession.start)
    this._llmHint = options?.llm;
    this._allowInterruptions = options?.allowInterruptions;
    this._minEndpointingDelay = options?.minEndpointingDelay;
    this._maxEndpointingDelay = options?.maxEndpointingDelay;
  }

  // ------------------------------------------------------------------
  // session property
  // ------------------------------------------------------------------

  get session(): AgentSession<UserData> | undefined {
    return this._session;
  }

  set session(value: AgentSession<UserData> | undefined) {
    this._session = value;
  }

  // ------------------------------------------------------------------
  // Lifecycle hooks (override in subclass)
  // ------------------------------------------------------------------

  /** Called when the agent enters. Override in subclass. */
  async onEnter(): Promise<void> {}

  /** Called when the agent exits. Override in subclass. */
  async onExit(): Promise<void> {}

  /** Called when the user finishes speaking. Override in subclass. */
  async onUserTurnCompleted(turnCtx?: unknown, newMessage?: unknown): Promise<void> {}

  // ------------------------------------------------------------------
  // Pipeline nodes -- all noop + log (SignalWire handles these)
  // ------------------------------------------------------------------

  /** Noop -- SignalWire handles STT in its control plane. */
  async sttNode(audio?: unknown, modelSettings?: unknown): Promise<void> {
    globalNoop.once(
      'stt_node',
      "Agent.sttNode(): SignalWire's control plane handles speech recognition -- this node is a no-op",
    );
  }

  /** Noop -- SignalWire handles LLM in its control plane. */
  async llmNode(chatCtx?: unknown, tools?: unknown, modelSettings?: unknown): Promise<void> {
    globalNoop.once(
      'llm_node',
      "Agent.llmNode(): SignalWire's control plane handles LLM inference -- this node is a no-op",
    );
  }

  /** Noop -- SignalWire handles TTS in its control plane. */
  async ttsNode(text?: unknown, modelSettings?: unknown): Promise<void> {
    globalNoop.once(
      'tts_node',
      "Agent.ttsNode(): SignalWire's control plane handles text-to-speech -- this node is a no-op",
    );
  }

  // ------------------------------------------------------------------
  // Dynamic updates
  // ------------------------------------------------------------------

  /** Update the agent's instructions mid-session. */
  async updateInstructions(instructions: string): Promise<void> {
    this.instructions = instructions;
  }

  /** Update the agent's tool list mid-session. */
  async updateTools(tools: FunctionTool[]): Promise<void> {
    const record: Record<string, FunctionTool> = {};
    for (const t of tools) {
      record[t.name] = t;
    }
    this.tools = record;
  }
}

// ---------------------------------------------------------------------------
// RunContext
// ---------------------------------------------------------------------------

/** Mirrors a LiveKit RunContext -- available inside tool handlers. */
export class RunContext<UserData = any> {
  session?: AgentSession<UserData>;
  speechHandle?: unknown;
  functionCall?: unknown;

  constructor(
    session?: AgentSession<UserData>,
    options?: { speechHandle?: unknown; functionCall?: unknown },
  ) {
    this.session = session;
    this.speechHandle = options?.speechHandle;
    this.functionCall = options?.functionCall;
  }

  get userData(): UserData {
    return (this.session?.userData ?? {}) as UserData;
  }
}

// ---------------------------------------------------------------------------
// AgentSession
// ---------------------------------------------------------------------------

/** Mirrors a LiveKit AgentSession -- binds an Agent to SignalWire. */
export class AgentSession<UserData = any> {
  private _stt: any;
  private _tts: any;
  private _llm: any;
  private _vad: any;
  private _turnDetection: any;
  private _tools: FunctionTool[];
  private _userData: UserData;
  private _voiceOptions?: Partial<VoiceOptions>;
  private _agent?: Agent<UserData>;
  private _swAgent?: AgentBase;
  private _allowInterruptions: boolean;
  private _minInterruptionDuration: number;
  private _minEndpointingDelay: number;
  private _maxEndpointingDelay: number;
  private _maxToolSteps: number;
  private _preemptiveGeneration: boolean;
  private _history: Array<Record<string, string>> = [];
  private _sayQueue: string[] = [];
  private noop = new NoopTracker();

  constructor(options?: {
    stt?: any;
    tts?: any;
    llm?: any;
    vad?: any;
    turnDetection?: any;
    tools?: FunctionTool[];
    mcpServers?: unknown;
    userData?: UserData;
    allowInterruptions?: boolean;
    minInterruptionDuration?: number;
    minEndpointingDelay?: number;
    maxEndpointingDelay?: number;
    maxToolSteps?: number;
    preemptiveGeneration?: boolean;
    voiceOptions?: Partial<VoiceOptions>;
  }) {
    this._stt = options?.stt;
    this._tts = options?.tts;
    this._llm = options?.llm;
    this._vad = options?.vad;
    this._turnDetection = options?.turnDetection;
    this._tools = options?.tools ? [...options.tools] : [];
    this._userData = (options?.userData ?? {}) as UserData;
    this._voiceOptions = options?.voiceOptions;
    this._allowInterruptions = options?.allowInterruptions ?? true;
    this._minInterruptionDuration = options?.minInterruptionDuration ?? 0.5;
    this._minEndpointingDelay = options?.minEndpointingDelay ?? 0.5;
    this._maxEndpointingDelay = options?.maxEndpointingDelay ?? 3.0;
    this._maxToolSteps = options?.maxToolSteps ?? 3;
    this._preemptiveGeneration = options?.preemptiveGeneration ?? false;

    if (options?.stt != null) {
      this.noop.once(
        'stt',
        `WithSTT("${options.stt}"): SignalWire's control plane handles speech recognition at scale — no configuration needed`,
      );
    }
    if (options?.tts != null) {
      this.noop.once(
        'tts',
        `WithTTS("${options.tts}"): SignalWire's control plane handles text-to-speech at scale — no configuration needed`,
      );
    }
    if (options?.vad != null) {
      this.noop.once(
        'vad',
        "WithVAD(): SignalWire's control plane handles voice activity detection at scale automatically",
      );
    }
    if (options?.turnDetection != null) {
      this.noop.once(
        'turn_detection',
        `WithTurnDetection("${options.turnDetection}"): SignalWire's control plane handles turn detection at scale automatically`,
      );
    }
    if (options?.mcpServers != null) {
      this.noop.once(
        'mcp_servers',
        'AgentSession(mcpServers=...): MCP servers are not yet supported in LiveWire -- tools should be registered via tool()',
      );
    }
    if (options?.maxToolSteps != null && options.maxToolSteps !== 3) {
      this.noop.once(
        'max_tool_steps',
        `AgentSession(maxToolSteps=${options.maxToolSteps}): SignalWire's control plane handles tool execution depth at scale automatically`,
      );
    }
  }

  /** Start the session by binding the agent to a SignalWire AgentBase. */
  async start(params: { agent: Agent<UserData>; room?: any; record?: boolean }): Promise<void> {
    this._agent = params.agent;
    params.agent.session = this;

    // Build a real SignalWire AgentBase
    const swAgent = new AgentBase({
      name: 'LiveWireAgent',
      route: '/',
    });

    swAgent.setPromptText(params.agent.instructions);

    // Map LLM model if provided (session-level takes priority, then agent-level hint)
    const llmModel = this._llm ?? params.agent._llmHint;
    if (llmModel != null) {
      let model = String(llmModel);
      const slashIdx = model.indexOf('/');
      if (slashIdx >= 0) model = model.slice(slashIdx + 1);
      swAgent.setParam('model', model);
    }

    // Map interruption / barge settings
    let allowInterruptions = this._allowInterruptions;
    if (params.agent._allowInterruptions != null) {
      allowInterruptions = params.agent._allowInterruptions as boolean;
    }
    if (!allowInterruptions) {
      swAgent.setParam('barge_confidence', 1.0);
    }

    // Map endpointing delays
    let minEp: number = this._minEndpointingDelay;
    if (params.agent._minEndpointingDelay != null) {
      minEp = params.agent._minEndpointingDelay as number;
    }
    if (minEp > 0) {
      swAgent.setParam('end_of_speech_timeout', Math.round(minEp * 1000));
    }

    let maxEp: number = this._maxEndpointingDelay;
    if (params.agent._maxEndpointingDelay != null) {
      maxEp = params.agent._maxEndpointingDelay as number;
    }
    if (maxEp > 0) {
      swAgent.setParam('attention_timeout', Math.round(maxEp * 1000));
    }

    // Register all tools from the agent + session-level tools
    const allTools: [string, FunctionTool][] = [
      ...Object.entries(params.agent.tools),
      ...this._tools.map((t) => [t.name, t] as [string, FunctionTool]),
    ];
    for (const [name, toolDef] of allTools) {
      const handler: SwaigHandler = async (args, rawData) => {
        const ctx = new RunContext<UserData>(this);
        const result = await toolDef.execute(args, { ctx });
        if (result instanceof FunctionResult) return result;
        if (typeof result === 'string') return new FunctionResult(result);
        return new FunctionResult(JSON.stringify(result));
      };
      swAgent.defineTool({
        name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        handler,
      });
    }

    // Initial greeting (say queue)
    for (const text of this._sayQueue) {
      swAgent.promptAddSection('Initial Greeting', { body: text });
    }

    this._swAgent = swAgent;
  }

  /** Queue text to be spoken by the agent. */
  say(text: string): void {
    // If the session is already started, inject directly into the SWML flow.
    // Otherwise queue the text so it is replayed when start() is called.
    if (this._swAgent) {
      this._swAgent.promptAddSection('Say', { body: text });
    } else {
      this._sayQueue.push(text);
    }
  }

  /** Trigger the agent to generate a reply, optionally with extra instructions. */
  generateReply(options?: { instructions?: string }): void {
    if (options?.instructions && this._swAgent) {
      this._swAgent.promptAddSection('Initial Greeting', { body: options.instructions });
    }
  }

  /** Interrupt current speech -- noop on SignalWire (barge-in is automatic). */
  interrupt(): void {
    this.noop.once('interrupt', "Interrupt(): SignalWire handles barge-in automatically via its control plane");
  }

  /** Update the agent bound to this session. */
  updateAgent(agent: Agent<UserData>): void {
    this._agent = agent;
    agent.session = this;
    if (this._swAgent) {
      this._swAgent.setPromptText(agent.instructions);
    }
  }

  get userData(): UserData {
    return this._userData;
  }

  set userData(val: UserData) {
    this._userData = val;
  }

  /** Conversation history entries. */
  get history(): Array<Record<string, string>> {
    return this._history;
  }

  /** Return the underlying SignalWire AgentBase (for testing / advanced use). */
  getSwAgent(): AgentBase | undefined {
    return this._swAgent;
  }
}

// ---------------------------------------------------------------------------
// tool()
// ---------------------------------------------------------------------------

/**
 * Create a tool definition -- mirrors llm.tool() from @livekit/agents-js.
 * Accepts a description, optional parameters (Zod or JSON schema), and an
 * execute function.
 */
export function tool<P = any>(options: {
  description: string;
  parameters?: any;
  execute: (params: P, context: { ctx: RunContext }) => any;
}): FunctionTool {
  // Extract JSON schema from parameters if provided
  let jsonSchema: Record<string, unknown> | undefined;
  if (options.parameters) {
    // If it looks like a Zod schema (has a .shape or ._def), try to extract
    if (typeof options.parameters === 'object' && options.parameters._def) {
      // Best-effort Zod extraction -- store as-is for now
      jsonSchema = options.parameters;
    } else {
      jsonSchema = options.parameters;
    }
  }

  return {
    name: '', // Filled in when assigned to agent.tools
    description: options.description,
    parameters: jsonSchema,
    execute: options.execute,
  };
}

// ---------------------------------------------------------------------------
// handoff()
// ---------------------------------------------------------------------------

/** Create an AgentHandoff descriptor for multi-agent scenarios. */
export function handoff(options: { agent: Agent; returns?: string }): AgentHandoff {
  const h = new AgentHandoff();
  h.agent = options.agent;
  h.returns = options.returns;
  return h;
}

// ---------------------------------------------------------------------------
// AgentHandoff / StopResponse / ToolError
// ---------------------------------------------------------------------------

/** Signals a handoff to another agent in multi-agent scenarios. */
export class AgentHandoff {
  agent!: Agent;
  returns?: string;
}

/** Signals that a tool should not trigger another LLM reply. */
export class StopResponse extends Error {
  constructor(message?: string) {
    super(message ?? 'StopResponse');
    this.name = 'StopResponse';
  }
}

/** Error thrown from a tool to signal failure back to the LLM. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

// ---------------------------------------------------------------------------
// JobProcess
// ---------------------------------------------------------------------------

/** Mirrors a LiveKit JobProcess -- used for prewarm/setup. */
export class JobProcess {
  userData: Record<string, any> = {};
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

/** Stub -- SignalWire doesn't use the LiveKit room abstraction. */
export class Room {
  readonly name: string = 'livewire-room';
}

// ---------------------------------------------------------------------------
// JobContext
// ---------------------------------------------------------------------------

/** Mirrors a LiveKit JobContext -- provides room and connection info. */
export class JobContext {
  room: Room;
  proc: JobProcess;
  /** @internal */
  _swAgent?: AgentBase;

  constructor() {
    this.room = new Room();
    this.proc = new JobProcess();
  }

  /** Connect is a noop on SignalWire -- the platform handles connection lifecycle. */
  async connect(): Promise<void> {
    globalNoop.once(
      'connect',
      "JobContext.connect(): SignalWire's control plane handles connection lifecycle at scale automatically",
    );
  }

  /** Wait for a participant -- noop on SignalWire. */
  async waitForParticipant(options?: { identity?: string }): Promise<any> {
    return { identity: options?.identity ?? 'caller' };
  }
}

// ---------------------------------------------------------------------------
// defineAgent
// ---------------------------------------------------------------------------

/**
 * Mirrors @livekit/agents defineAgent().
 * Wraps an entry function (and optional prewarm) for later execution by runApp.
 */
export function defineAgent(agent: {
  entry: (ctx: JobContext) => Promise<void>;
  prewarm?: (proc: JobProcess) => any;
}): { entry: (ctx: JobContext) => Promise<void>; prewarm?: (proc: JobProcess) => any } {
  return agent;
}

// ---------------------------------------------------------------------------
// runApp
// ---------------------------------------------------------------------------

/**
 * Mirrors cli.runApp() from @livekit/agents-js.
 *
 * 1. Prints the LiveWire banner
 * 2. Prints a random tip
 * 3. Creates a SignalWire AgentBase from the LiveKit-style config
 * 4. Calls the entry function with a fake JobContext
 * 5. Maps tools from llm.tool() format to SignalWire defineTool format
 * 6. Starts the agent with agent.run()
 */
export function runApp(options: any): void {
  printBanner();

  // If passed an AgentServer instance, convert it to an agentDef-compatible object
  const agentDef = options instanceof AgentServer
    ? options._toAgentDef()
    : (options?.agent ?? options);

  // Run prewarm if registered
  if (agentDef?.prewarm) {
    const proc = new JobProcess();
    globalNoop.once(
      'prewarm',
      "prewarm: Warm process pools not needed — SignalWire's control plane manages media infrastructure at scale",
    );
    agentDef.prewarm(proc);
  }

  // Create a JobContext
  const ctx = new JobContext();

  // Print a random tip
  printTip();

  // Call the entry function
  const entryFn = agentDef?.entry ?? agentDef;
  if (typeof entryFn === 'function') {
    Promise.resolve(entryFn(ctx)).then(() => {
      // After entry completes, the session should have bound a swAgent to ctx
      // If someone stored it on ctx, start it
      if (ctx._swAgent) {
        ctx._swAgent.run().catch((err: Error) => {
          process.stderr.write(`[LiveWire] agent error: ${err.message}\n`);
        });
      }
    }).catch((err: Error) => {
      process.stderr.write(`[LiveWire] entry function error: ${err.message}\n`);
    });
  }
}

// ---------------------------------------------------------------------------
// WorkerOptions / ServerOptions
// ---------------------------------------------------------------------------

/** Stub for LiveKit WorkerOptions. */
export class WorkerOptions {
  constructor(_opts?: any) {}
}

/** Stub for LiveKit ServerOptions. */
export class ServerOptions {
  constructor(_opts?: any) {}
}

// ---------------------------------------------------------------------------
// AgentServer
// ---------------------------------------------------------------------------

/**
 * Mirrors a LiveKit AgentServer -- registers entrypoints and starts.
 *
 * Usage:
 *   const server = new AgentServer();
 *   server.setupFnc = async (proc) => { ... };
 *
 *   // Bare decorator usage:
 *   server.rtcSession(myEntryFn);
 *
 *   // Parameterized decorator usage:
 *   server.rtcSession({ agentName: 'myAgent' })(myEntryFn);
 *
 *   cli.runApp(server);
 */
export class AgentServer {
  /** Optional prewarm hook called before the entrypoint. Mirrors Python's setup_fnc. */
  setupFnc?: (proc: JobProcess) => void;

  /** @internal Registered entrypoint function. */
  private _entryFn?: (ctx: JobContext) => Promise<void>;

  /** @internal Agent name hint registered via rtcSession(). */
  private _agentName: string = '';

  constructor(_opts?: any) {}

  /**
   * Decorator that registers the session entrypoint.
   *
   * Supports both bare and parameterized usage:
   *   server.rtcSession(fn)                       // bare
   *   server.rtcSession(fn, { agentName: 'x' })   // with opts, explicit fn
   *   server.rtcSession({ agentName: 'x' })(fn)   // parameterized decorator
   *   @server.rtcSession                           // decorator (bare)
   *   @server.rtcSession({ agentName: 'x' })       // decorator (parameterized)
   */
  rtcSession(
    fnOrOpts?:
      | ((ctx: JobContext) => Promise<void>)
      | {
          agentName?: string;
          type?: string;
          onRequest?: ((...args: any[]) => any) | null;
          onSessionEnd?: ((...args: any[]) => any) | null;
        },
    opts?: {
      agentName?: string;
      type?: string;
      onRequest?: ((...args: any[]) => any) | null;
      onSessionEnd?: ((...args: any[]) => any) | null;
    },
  ): ((fn: (ctx: JobContext) => Promise<void>) => (ctx: JobContext) => Promise<void>) | void {
    // Determine whether first arg is a function or an options object
    let fn: ((ctx: JobContext) => Promise<void>) | undefined;
    let resolvedOpts: typeof opts;

    if (typeof fnOrOpts === 'function') {
      fn = fnOrOpts;
      resolvedOpts = opts;
    } else {
      // fnOrOpts is an options object (or undefined) — parameterized decorator usage
      resolvedOpts = fnOrOpts;
    }

    if (resolvedOpts?.type && resolvedOpts.type !== 'room') {
      globalNoop.once(
        'server_type',
        `AgentServer.rtcSession(type=${JSON.stringify(resolvedOpts.type)}): SignalWire's control plane handles server topology at scale automatically`,
      );
    }

    const register = (entryFn: (ctx: JobContext) => Promise<void>) => {
      this._entryFn = entryFn;
      if (resolvedOpts?.agentName) this._agentName = resolvedOpts.agentName;
      return entryFn;
    };

    if (fn) {
      register(fn);
      return;
    }
    return register;
  }

  /** @internal Extract agentDef-compatible shape for use by runApp. */
  _toAgentDef(): {
    entry: (ctx: JobContext) => Promise<void>;
    prewarm?: (proc: JobProcess) => void;
  } {
    return {
      entry: this._entryFn ?? (async (_ctx: JobContext) => {}),
      prewarm: this.setupFnc,
    };
  }
}

// ---------------------------------------------------------------------------
// Plugin stubs
// ---------------------------------------------------------------------------

/** Stub providers matching common LiveKit plugin packages. */
export namespace plugins {
  export class DeepgramSTT {
    constructor(_opts?: any) {
      globalNoop.once(
        'stt_plugin',
        'DeepgramSTT: SignalWire\'s control plane handles the full media pipeline at scale',
      );
    }
  }

  export class OpenAILLM {
    model: string;
    constructor(_opts?: any) {
      this.model = ((_opts as any)?.model as string) ?? '';
      globalNoop.once(
        'openai_llm',
        'OpenAILLM(): model selection is mapped to SignalWire AI params -- OpenAI plugin wrapper is a no-op',
      );
    }
  }

  export class CartesiaTTS {
    constructor(_opts?: any) {
      globalNoop.once(
        'cartesia_tts',
        "CartesiaTTS: SignalWire's control plane handles the full media pipeline at scale",
      );
    }
  }

  export class ElevenLabsTTS {
    constructor(_opts?: any) {
      globalNoop.once(
        'elevenlabs_tts',
        "ElevenLabsTTS: SignalWire's control plane handles the full media pipeline at scale",
      );
    }
  }

  export class SileroVAD {
    constructor(_opts?: Record<string, unknown>) {}

    static load(): SileroVAD {
      globalNoop.once(
        'vad_plugin',
        "SileroVAD.load(): SignalWire's control plane handles voice activity detection at scale automatically",
      );
      return new SileroVAD();
    }
  }
}

// ---------------------------------------------------------------------------
// Inference module stubs
// ---------------------------------------------------------------------------

/** Stub inference types matching LiveKit's inference namespace. */
export namespace inference {
  export class STT {
    model: string;
    constructor(model: string = '', _opts?: any) {
      this.model = model;
      globalNoop.once(
        'inference_stt',
        'inference.STT: SignalWire\'s control plane handles speech recognition at scale',
      );
    }
  }

  export class LLM {
    model: string;
    constructor(model: string = '', _opts?: any) {
      this.model = model;
    }
  }

  export class TTS {
    model: string;
    constructor(model: string = '', _opts?: any) {
      this.model = model;
      globalNoop.once(
        'inference_tts',
        'inference.TTS: SignalWire\'s control plane handles text-to-speech at scale',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Namespace re-exports matching @livekit/agents
// ---------------------------------------------------------------------------

/** LiveKit voice namespace equivalent. */
export const voice = {
  Agent,
  AgentSession,
  AgentSessionEventTypes: {} as Record<string, string>,
};

/** Minimal ChatContext matching livekit ChatContext. */
export class ChatContext {
  messages: Array<Record<string, string>> = [];

  append(options: { role?: string; text?: string }): this {
    this.messages.push({ role: options.role ?? 'user', content: options.text ?? '' });
    return this;
  }
}

/** LiveKit llm namespace equivalent. */
export const llm = {
  tool,
  handoff,
  ToolError,
  ChatContext,
};

/** LiveKit cli namespace equivalent. */
export const cli = {
  runApp,
};

// Re-export banner/tip functions for testing
export { printBanner, printTip, banner };
