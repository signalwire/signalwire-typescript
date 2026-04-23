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

/**
 * Rotating "Did you know?" tips printed to stderr by the LiveWire banner.
 * Exported for tests; reorder or extend to change what's displayed.
 */
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

  /**
   * Log the given message the first time this key is seen.
   *
   * @param key - Dedup key. Subsequent calls with the same key are silent.
   * @param message - Message to write to stderr on first occurrence.
   */
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
  /** TTS voice identifier (e.g. `"en-US-Standard-A"`). */
  voice: string;
  /** TTS engine identifier (e.g. `"google"`, `"elevenlabs"`). */
  engine: string;
  /** BCP-47 language code (e.g. `"en-US"`). */
  language: string;
}

// ---------------------------------------------------------------------------
// FunctionTool
// ---------------------------------------------------------------------------

/** A tool definition that can be registered on an {@link Agent}. */
export interface FunctionTool {
  /** Tool name. Populated when the tool is attached to an `Agent.tools` map. */
  name: string;
  /** Human-readable description shown to the LLM. */
  description: string;
  /** JSON schema (or Zod schema passthrough) for the tool's parameters. */
  parameters?: Record<string, unknown>;
  /** Handler invoked by the platform when the LLM calls this tool. */
  execute: (params: any, context: { ctx: RunContext }) => any;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/**
 * Mirrors a LiveKit `voice.Agent` — holds instructions and tool definitions.
 *
 * Pipeline options (`stt`, `tts`, `vad`, `llm`, `turnDetection`) are accepted
 * for API parity but are **no-ops** — SignalWire's control plane handles the
 * entire AI pipeline server-side. Set instructions and tools; everything else
 * just logs once and continues.
 *
 * @example Minimal LiveKit-compatible agent
 * ```ts
 * import { livewire } from '@signalwire/sdk';
 *
 * const timeTool = livewire.tool({
 *   description: 'Return the current time.',
 *   execute: () => new Date().toISOString(),
 * });
 *
 * const agent = new livewire.Agent({
 *   instructions: 'You are a friendly helper.',
 *   tools: [{ ...timeTool, name: 'time' }],
 * });
 *
 * const session = new livewire.AgentSession();
 * await session.start({ agent });
 * ```
 */
export class Agent<UserData = any> {
  /** System instructions passed through to the SignalWire AI prompt. */
  instructions: string;
  /** Registered tools keyed by name. Mutated by {@link updateTools}. */
  tools: Record<string, FunctionTool>;
  /** Arbitrary per-session user data passed to tool handlers via {@link RunContext.userData}. */
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

  /** The currently-bound {@link AgentSession}, or `undefined` until {@link AgentSession.start} is called. */
  get session(): AgentSession<UserData> | undefined {
    return this._session;
  }

  set session(value: AgentSession<UserData> | undefined) {
    this._session = value;
  }

  // ------------------------------------------------------------------
  // Lifecycle hooks (override in subclass)
  // ------------------------------------------------------------------

  /**
   * Lifecycle hook called when the agent enters an active call.
   * Override in a subclass to run setup logic — the default is a no-op.
   */
  async onEnter(): Promise<void> {}

  /**
   * Lifecycle hook called when the agent exits (call ended or handoff).
   * Override in a subclass to run teardown logic — the default is a no-op.
   */
  async onExit(): Promise<void> {}

  /**
   * Lifecycle hook called when the user finishes speaking.
   * Override in a subclass to inspect / mutate the turn context before the
   * LLM responds — the default is a no-op.
   *
   * @param _turnCtx - Turn context (LiveKit shape; passed through opaquely).
   * @param _newMessage - Newly-captured user message.
   */
  async onUserTurnCompleted(_turnCtx?: unknown, _newMessage?: unknown): Promise<void> {}

  // ------------------------------------------------------------------
  // Pipeline nodes -- all noop + log (SignalWire handles these)
  // ------------------------------------------------------------------

  /**
   * LiveKit-compatible STT node. **No-op** on SignalWire — the control plane
   * handles speech recognition server-side.
   *
   * @param _audio - Audio input (ignored).
   * @param _modelSettings - Model settings (ignored).
   */
  async sttNode(_audio?: unknown, _modelSettings?: unknown): Promise<void> {
    globalNoop.once(
      'stt_node',
      "Agent.sttNode(): SignalWire's control plane handles speech recognition -- this node is a no-op",
    );
  }

  /**
   * LiveKit-compatible LLM node. **No-op** on SignalWire — the control plane
   * handles LLM inference server-side.
   *
   * @param _chatCtx - Chat context (ignored).
   * @param _tools - Tool list (ignored).
   * @param _modelSettings - Model settings (ignored).
   */
  async llmNode(_chatCtx?: unknown, _tools?: unknown, _modelSettings?: unknown): Promise<void> {
    globalNoop.once(
      'llm_node',
      "Agent.llmNode(): SignalWire's control plane handles LLM inference -- this node is a no-op",
    );
  }

  /**
   * LiveKit-compatible TTS node. **No-op** on SignalWire — the control plane
   * handles text-to-speech server-side.
   *
   * @param _text - Text to synthesise (ignored).
   * @param _modelSettings - Model settings (ignored).
   */
  async ttsNode(_text?: unknown, _modelSettings?: unknown): Promise<void> {
    globalNoop.once(
      'tts_node',
      "Agent.ttsNode(): SignalWire's control plane handles text-to-speech -- this node is a no-op",
    );
  }

  // ------------------------------------------------------------------
  // Dynamic updates
  // ------------------------------------------------------------------

  /**
   * Update the agent's instructions mid-session.
   *
   * @param instructions - New system-instructions string for the agent.
   */
  async updateInstructions(instructions: string): Promise<void> {
    this.instructions = instructions;
  }

  /**
   * Update the agent's tool list mid-session.
   *
   * Replaces the current tool record with one built from the given array,
   * keyed by `tool.name`. Useful for dynamic tool injection based on
   * conversation state.
   *
   * @param tools - Ordered array of {@link FunctionTool} definitions. Each
   *   tool's `name` is used as its map key.
   */
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

/**
 * Mirrors a LiveKit `RunContext` — passed to tool handlers so they can
 * read the current session, call handle, and user data.
 */
export class RunContext<UserData = any> {
  /** The owning {@link AgentSession}, when one is bound. */
  session?: AgentSession<UserData>;
  /** Opaque speech-turn handle (LiveKit shape; passed through untouched). */
  speechHandle?: unknown;
  /** Opaque function-call descriptor (LiveKit shape; passed through untouched). */
  functionCall?: unknown;

  /**
   * @param session - Owning session, when available.
   * @param options - Optional pass-through values.
   * @param options.speechHandle - Opaque LiveKit speech handle.
   * @param options.functionCall - Opaque LiveKit function-call descriptor.
   */
  constructor(
    session?: AgentSession<UserData>,
    options?: { speechHandle?: unknown; functionCall?: unknown },
  ) {
    this.session = session;
    this.speechHandle = options?.speechHandle;
    this.functionCall = options?.functionCall;
  }

  /**
   * Per-session user data, or an empty object when no session is bound.
   *
   * @returns The {@link AgentSession.userData} payload cast to `UserData`.
   */
  get userData(): UserData {
    return (this.session?.userData ?? {}) as UserData;
  }
}

// ---------------------------------------------------------------------------
// AgentSession
// ---------------------------------------------------------------------------

/**
 * Mirrors a LiveKit `AgentSession` — binds an {@link Agent} to SignalWire.
 *
 * Call {@link AgentSession.start} with an `Agent` to construct an internal
 * {@link AgentBase} and begin serving SWML. Pipeline-related options are
 * accepted for API parity but are no-ops server-side.
 */
export class AgentSession<UserData = any> {
  private _llm: any;
  private _tools: FunctionTool[];
  private _userData: UserData;
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
  }) {
    this._llm = options?.llm;
    this._tools = options?.tools ? [...options.tools] : [];
    this._userData = (options?.userData ?? {}) as UserData;
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

  /**
   * Start the session by binding the agent to a freshly-constructed
   * {@link AgentBase}, mapping LiveKit-style options onto SignalWire AI params.
   *
   * Must be called before any other method on this session. The underlying
   * `AgentBase` is not started here — use {@link runApp} or an `AgentServer`
   * to serve it.
   *
   * @param params - Start parameters.
   * @param params.agent - The {@link Agent} to bind.
   * @param params.room - LiveKit room placeholder; ignored on SignalWire.
   * @param params.record - Call-recording flag placeholder; ignored on SignalWire.
   * @returns Resolves once the underlying `AgentBase` has been built.
   */
  async start(params: { agent: Agent<UserData>; room?: any; record?: boolean }): Promise<void> {
    this._agent = params.agent;
    params.agent.session = this;

    // Mirrors Python _build_sw_agent(): alias self._agent for subsequent reads
    const agent = this._agent;

    // Build a real SignalWire AgentBase
    const swAgent = new AgentBase({
      name: 'LiveWireAgent',
      route: '/',
    });

    swAgent.setPromptText(agent.instructions);

    // Map LLM model if provided (session-level takes priority, then agent-level hint)
    const llmModel = this._llm ?? agent._llmHint;
    if (llmModel != null) {
      let model = String(llmModel);
      const slashIdx = model.indexOf('/');
      if (slashIdx >= 0) model = model.slice(slashIdx + 1);
      swAgent.setParam('model', model);
    }

    // Map interruption / barge settings
    let allowInterruptions = this._allowInterruptions;
    if (agent._allowInterruptions != null) {
      allowInterruptions = agent._allowInterruptions as boolean;
    }
    if (!allowInterruptions) {
      swAgent.setParam('barge_confidence', 1.0);
    }

    // Map endpointing delays
    let minEp: number = this._minEndpointingDelay;
    if (agent._minEndpointingDelay != null) {
      minEp = agent._minEndpointingDelay as number;
    }
    if (minEp > 0) {
      swAgent.setParam('end_of_speech_timeout', Math.round(minEp * 1000));
    }

    let maxEp: number = this._maxEndpointingDelay;
    if (agent._maxEndpointingDelay != null) {
      maxEp = agent._maxEndpointingDelay as number;
    }
    if (maxEp > 0) {
      swAgent.setParam('attention_timeout', Math.round(maxEp * 1000));
    }

    // Register all tools from the agent + session-level tools
    const allTools: [string, FunctionTool][] = [
      ...Object.entries(agent.tools),
      ...this._tools.map((t) => [t.name, t] as [string, FunctionTool]),
    ];
    for (const [name, toolDef] of allTools) {
      const handler: SwaigHandler = async (args, _rawData) => {
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

  /**
   * Queue text to be spoken by the agent.
   *
   * Before {@link start} is called, text is buffered and injected at start
   * time as the agent's initial greeting. After start, text is added as an
   * additional prompt section.
   *
   * @param text - Line for the agent to speak.
   */
  say(text: string): void {
    // If the session is already started, inject directly into the SWML flow.
    // Otherwise queue the text so it is replayed when start() is called.
    if (this._swAgent) {
      this._swAgent.promptAddSection('Say', { body: text });
    } else {
      this._sayQueue.push(text);
    }
  }

  /**
   * Trigger the agent to generate a reply, optionally with extra instructions.
   *
   * @param options - Generation options.
   * @param options.instructions - Extra instructions injected as a new prompt
   *   section before the next LLM turn.
   */
  generateReply(options?: { instructions?: string }): void {
    if (options?.instructions && this._swAgent) {
      this._swAgent.promptAddSection('Initial Greeting', { body: options.instructions });
    }
  }

  /**
   * Interrupt current speech. **No-op** on SignalWire — barge-in is handled
   * automatically by the control plane.
   */
  interrupt(): void {
    this.noop.once('interrupt', "Interrupt(): SignalWire handles barge-in automatically via its control plane");
  }

  /**
   * Swap the {@link Agent} bound to this session.
   *
   * Preserves the underlying `AgentBase` but replaces its prompt with the new
   * agent's instructions.
   *
   * @param agent - Replacement agent.
   */
  updateAgent(agent: Agent<UserData>): void {
    this._agent = agent;
    agent.session = this;
    if (this._swAgent) {
      this._swAgent.setPromptText(agent.instructions);
    }
  }

  /** Current per-session user data. Set by the constructor or via the setter. */
  get userData(): UserData {
    return this._userData;
  }

  set userData(val: UserData) {
    this._userData = val;
  }

  /** Conversation history entries captured over the session's lifetime. */
  get history(): Array<Record<string, string>> {
    return this._history;
  }

  /**
   * Return the underlying SignalWire {@link AgentBase}. Useful for tests and
   * advanced use cases that need to reach past the LiveKit facade.
   *
   * @returns The wrapped `AgentBase`, or `undefined` before {@link start}.
   */
  getSwAgent(): AgentBase | undefined {
    return this._swAgent;
  }
}

// ---------------------------------------------------------------------------
// tool()
// ---------------------------------------------------------------------------

/**
 * Create a tool definition — mirrors `llm.tool()` from `@livekit/agents-js`.
 *
 * The returned tool has an empty `name` — the caller assigns it when the tool
 * is attached to an agent's tools map (see the {@link Agent} example).
 *
 * @typeParam P - Parameter type passed into `execute`.
 * @param options - Tool configuration.
 * @param options.description - Human-readable tool description exposed to the LLM.
 * @param options.parameters - JSON Schema or Zod schema describing the tool's inputs.
 * @param options.execute - Handler invoked when the LLM calls the tool.
 * @returns A {@link FunctionTool} ready to be attached to an agent.
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

/**
 * Create an {@link AgentHandoff} descriptor for multi-agent scenarios.
 *
 * @param options - Handoff parameters.
 * @param options.agent - Agent to transfer control to.
 * @param options.returns - Optional string returned to the current agent when
 *   the handoff completes.
 * @returns A handoff descriptor that can be returned from a tool handler.
 */
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
  /** Target agent that should take over the conversation. */
  agent!: Agent;
  /** Optional return value surfaced when the handoff completes. */
  returns?: string;
}

/** Signals that a tool should not trigger another LLM reply. */
export class StopResponse extends Error {
  /**
   * @param message - Optional error message. Defaults to `"StopResponse"`.
   */
  constructor(message?: string) {
    super(message ?? 'StopResponse');
    this.name = 'StopResponse';
  }
}

/** Error thrown from a tool to signal failure back to the LLM. */
export class ToolError extends Error {
  /**
   * @param message - Error message surfaced to the LLM.
   */
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

// ---------------------------------------------------------------------------
// JobProcess
// ---------------------------------------------------------------------------

/**
 * Mirrors a LiveKit `JobProcess` — placeholder for prewarm / setup hooks.
 *
 * On SignalWire the control plane pre-warms infrastructure at scale, so this
 * class carries no real state beyond the LiveKit-compatible `userData` bag.
 */
export class JobProcess {
  /** Mutable bag shared across prewarm and entry-point callbacks. */
  userData: Record<string, any> = {};
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

/**
 * Stub `Room` — SignalWire does not use the LiveKit room abstraction.
 *
 * Present purely for API parity so LiveKit-shaped code compiles; its only
 * meaningful attribute is the constant name.
 */
export class Room {
  /** Always `"livewire-room"` — SignalWire has no per-call room identity. */
  readonly name: string = 'livewire-room';
}

// ---------------------------------------------------------------------------
// JobContext
// ---------------------------------------------------------------------------

/**
 * Mirrors a LiveKit `JobContext` — provides room and connection info to the
 * entry-point callback registered via {@link defineAgent}.
 */
export class JobContext {
  /** Placeholder {@link Room} (see class docs). */
  room: Room;
  /** Shared {@link JobProcess} instance for prewarm-to-entry data passing. */
  proc: JobProcess;
  /** @internal */
  _swAgent?: AgentBase;

  constructor() {
    this.room = new Room();
    this.proc = new JobProcess();
  }

  /**
   * Connect to the platform. **No-op** on SignalWire — the control plane
   * manages connection lifecycle automatically.
   *
   * @returns Resolves immediately.
   */
  async connect(): Promise<void> {
    globalNoop.once(
      'connect',
      "JobContext.connect(): SignalWire's control plane handles connection lifecycle at scale automatically",
    );
  }

  /**
   * Wait for a participant to join. **No-op** on SignalWire — returns an
   * immediate stub participant.
   *
   * @param options - Participant match options.
   * @param options.identity - Requested identity; echoed back in the stub.
   *   Defaults to `"caller"`.
   * @returns A stub participant `{ identity }` record.
   */
  async waitForParticipant(options?: { identity?: string }): Promise<any> {
    return { identity: options?.identity ?? 'caller' };
  }
}

// ---------------------------------------------------------------------------
// defineAgent
// ---------------------------------------------------------------------------

/**
 * Mirrors `@livekit/agents.defineAgent()`.
 *
 * Packages an entry function (plus an optional prewarm hook) for later
 * execution by {@link runApp}. Pass-through — no side effects.
 *
 * @param agent - Entry and (optional) prewarm functions.
 * @param agent.entry - Main callback invoked with a {@link JobContext} when
 *   the agent runs.
 * @param agent.prewarm - Optional prewarm callback invoked with a
 *   {@link JobProcess} before `entry`.
 * @returns The same record (pass-through), typed consistently.
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
 * Mirrors `cli.runApp()` from `@livekit/agents-js`.
 *
 * 1. Prints the LiveWire banner
 * 2. Runs the registered prewarm callback (if any) with a fresh {@link JobProcess}
 * 3. Creates a fresh {@link JobContext}
 * 4. Prints a random tip
 * 5. Invokes the entry function with the context
 * 6. Starts the underlying SignalWire `AgentBase` once the entry function
 *    binds one (via an `AgentSession.start()` call)
 *
 * Accepts either an object `{ entry, prewarm? }`, a bare entry function, or
 * an {@link AgentServer} instance.
 *
 * @param options - Agent descriptor, entry function, or `AgentServer`.
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

/**
 * Stub class mirroring LiveKit's `WorkerOptions`.
 *
 * Accepts any configuration for source-compatibility with LiveKit code;
 * SignalWire ignores these settings.
 */
export class WorkerOptions {
  /** @param _opts - LiveKit-shaped worker options (ignored). */
  constructor(_opts?: any) {}
}

/**
 * Stub class mirroring LiveKit's `ServerOptions`.
 *
 * Accepts any configuration for source-compatibility with LiveKit code;
 * SignalWire ignores these settings.
 */
export class ServerOptions {
  /** @param _opts - LiveKit-shaped server options (ignored). */
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

/**
 * Stub providers matching common LiveKit plugin packages.
 *
 * None of these do anything — they exist so LiveKit code that imports and
 * constructs these classes still compiles and runs under SignalWire. The
 * first construction of each logs an advisory to stderr.
 */
export namespace plugins {
  /** LiveKit Deepgram-STT plugin stub. No-op on SignalWire. */
  export class DeepgramSTT {
    /** @param _opts - Deepgram options (ignored). */
    constructor(_opts?: any) {
      globalNoop.once(
        'stt_plugin',
        'DeepgramSTT: SignalWire\'s control plane handles the full media pipeline at scale',
      );
    }
  }

  /**
   * LiveKit OpenAI-LLM plugin stub.
   *
   * The `model` string is captured and mapped to the SignalWire AI `model`
   * param by {@link AgentSession.start}. Other options are ignored.
   */
  export class OpenAILLM {
    /** Model identifier captured from the constructor options. */
    model: string;
    /** @param _opts - OpenAI options. `_opts.model` is captured; everything else ignored. */
    constructor(_opts?: any) {
      this.model = ((_opts as any)?.model as string) ?? '';
      globalNoop.once(
        'openai_llm',
        'OpenAILLM(): model selection is mapped to SignalWire AI params -- OpenAI plugin wrapper is a no-op',
      );
    }
  }

  /** LiveKit Cartesia-TTS plugin stub. No-op on SignalWire. */
  export class CartesiaTTS {
    /** @param _opts - Cartesia options (ignored). */
    constructor(_opts?: any) {
      globalNoop.once(
        'cartesia_tts',
        "CartesiaTTS: SignalWire's control plane handles the full media pipeline at scale",
      );
    }
  }

  /** LiveKit ElevenLabs-TTS plugin stub. No-op on SignalWire. */
  export class ElevenLabsTTS {
    /** @param _opts - ElevenLabs options (ignored). */
    constructor(_opts?: any) {
      globalNoop.once(
        'elevenlabs_tts',
        "ElevenLabsTTS: SignalWire's control plane handles the full media pipeline at scale",
      );
    }
  }

  /** LiveKit Silero-VAD plugin stub. No-op on SignalWire. */
  export class SileroVAD {
    /** @param _opts - Silero VAD options (ignored). */
    constructor(_opts?: Record<string, unknown>) {}

    /**
     * Load a Silero VAD model.
     *
     * **No-op** on SignalWire — returns a fresh stub instance and emits a
     * one-time advisory to stderr.
     *
     * @returns A new `SileroVAD` stub.
     */
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

/**
 * Stub inference types matching LiveKit's `inference` namespace.
 *
 * None of these run inference on the client — SignalWire performs STT / LLM /
 * TTS in its control plane. These classes exist so LiveKit code that imports
 * and instantiates them still compiles.
 */
export namespace inference {
  /** LiveKit inference-STT stub. Captures the model name; runs no inference locally. */
  export class STT {
    /** Model identifier captured from the constructor. */
    model: string;
    /**
     * @param model - Model identifier (captured).
     * @param _opts - Additional options (ignored).
     */
    constructor(model: string = '', _opts?: any) {
      this.model = model;
      globalNoop.once(
        'inference_stt',
        'inference.STT: SignalWire\'s control plane handles speech recognition at scale',
      );
    }
  }

  /** LiveKit inference-LLM stub. Captures the model name; runs no inference locally. */
  export class LLM {
    /** Model identifier captured from the constructor. */
    model: string;
    /**
     * @param model - Model identifier (captured).
     * @param _opts - Additional options (ignored).
     */
    constructor(model: string = '', _opts?: any) {
      this.model = model;
    }
  }

  /** LiveKit inference-TTS stub. Captures the model name; runs no inference locally. */
  export class TTS {
    /** Model identifier captured from the constructor. */
    model: string;
    /**
     * @param model - Model identifier (captured).
     * @param _opts - Additional options (ignored).
     */
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

/** Minimal `ChatContext` matching LiveKit's `ChatContext`. */
export class ChatContext {
  /** Ordered chat messages, each `{ role, content }`. */
  messages: Array<Record<string, string>> = [];

  /**
   * Append a chat message.
   *
   * @param options - Message content.
   * @param options.role - Speaker role (`"user"`, `"assistant"`, or `"system"`).
   *   Defaults to `"user"`.
   * @param options.text - Message text. Defaults to `""`.
   * @returns This instance for chaining.
   */
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
