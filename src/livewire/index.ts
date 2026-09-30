/**
 * LiveWire: LiveKit-compatible agents powered by SignalWire.
 *
 * Provides the same class and function names as @livekit/agents-js, so
 * developers can change their import path and run on SignalWire. SignalWire's
 * control plane runs STT, TTS, VAD, LLM orchestration and call control. The
 * pipeline options LiveWire ignores are accepted, and each logs a message
 * once, so existing code keeps compiling.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
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
 * "Did you know?" tips. `runApp()` prints one, chosen at random, to stderr.
 * Exported for tests; edit the list to change what's displayed.
 */
export const tips: string[] = [
  'SignalWire agents support DataMap tools, which the platform runs server-side, so you host no webhook for them. See: docs/datamap-guide.md',
  'SignalWire Contexts & Steps control which step a conversation is in and which tools each step allows. See: docs/contexts-guide.md',
  'SignalWire agents can transfer a call to another agent with one FunctionResult action: swmlTransfer()',
  "SignalWire built-in skills (datetime, math, web_search and more) add tools to an agent in one call: agent.addSkillByName('datetime')",
  'SignalWire agents can send SMS, join conferences, record calls and use SIP, all from the same agent',
  "Your agent's AI pipeline (STT, LLM, TTS, VAD) runs in SignalWire's cloud, so you don't run those services yourself",
  'SignalWire prefab agents (InfoGathererAgent, SurveyAgent, ReceptionistAgent, FAQBotAgent, ConciergeAgent) give you ready-made agents for common call flows',
  "SignalWire's RELAY client gives you real-time call control over WebSocket: play, record, detect, conference and more",
  'SignalWire agents generate SWML documents, and the platform handles media, turn detection and barge-in',
  'You can host multiple agents on one server with AgentServer, each with its own route, prompt and tools',
];

function printTip(): void {
  const tip = tips[Math.floor(Math.random() * tips.length)];
  process.stderr.write(`\nDid you know?  ${tip}\n\n`);
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
  /** Tool name. Set from the key when the tool is passed in a name-keyed `tools` object. */
  name: string;
  /** Human-readable description shown to the LLM. */
  description: string;
  /** JSON schema (or Zod schema passthrough) for the tool's parameters. */
  parameters?: Record<string, unknown>;
  /** Handler invoked by the platform when the LLM calls this tool. */
  execute: (params: unknown, context: { ctx: RunContext }) => unknown;
}

/**
 * Normalize a tool list to `[name, tool]` pairs. Accepts Python's list shape
 * (each tool carries its `name`) and the name-keyed object that LiveKit
 * agents-js uses (`tools: { getWeather }`), where the key is the tool name.
 */
function toolEntries(
  tools: FunctionTool[] | Record<string, FunctionTool> | undefined,
): [string, FunctionTool][] {
  if (!tools) return [];
  if (Array.isArray(tools)) return tools.map((t) => [t.name, t]);
  return Object.entries(tools).map(([name, t]) => [name, { ...t, name }]);
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

/**
 * Mirrors a LiveKit `voice.Agent`, and holds instructions and tool definitions.
 *
 * The `stt`, `tts`, `vad`, `turnDetection` and `mcpServers` options are accepted
 * for API compatibility and ignored, because SignalWire's control plane runs the
 * AI pipeline. Each one logs a message once. `llm` sets the model, and
 * `allowInterruptions` and the endpointing delays map to AI params when
 * {@link AgentSession.start} builds the agent.
 *
 * `tools` takes an object keyed by tool name, as LiveKit agents-js does, or
 * an array of tools that each have a `name`, as the Python SDK does.
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
 *   tools: { time: timeTool },
 * });
 *
 * const session = new livewire.AgentSession();
 * await session.start({ agent });
 * ```
 */
export class Agent<UserData = unknown> {
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
    tools?: FunctionTool[] | Record<string, FunctionTool>;
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
    // Python takes a list; LiveKit agents-js takes a name-keyed object. Both
    // are stored as a name-keyed map.
    this.tools = Object.fromEntries(toolEntries(options?.tools));
    this.userData = options?.userData;

    // Pipeline noop advisories (matching Python behavior)
    if (options?.stt != null) {
      globalNoop.once(
        'agent_stt',
        "Agent({ stt }): ignored. SignalWire's control plane handles speech recognition.",
      );
    }
    if (options?.tts != null) {
      globalNoop.once(
        'agent_tts',
        "Agent({ tts }): ignored. SignalWire's control plane handles text-to-speech.",
      );
    }
    if (options?.vad != null) {
      globalNoop.once(
        'agent_vad',
        "Agent({ vad }): ignored. SignalWire's control plane handles voice activity detection.",
      );
    }
    if (options?.turnDetection != null) {
      globalNoop.once(
        'agent_turn_detection',
        "Agent({ turnDetection }): ignored. SignalWire's control plane handles turn detection.",
      );
    }
    if (options?.mcpServers != null) {
      globalNoop.once(
        'agent_mcp_servers',
        "Agent({ mcpServers }): ignored. LiveWire doesn't support MCP servers; register tools with tool().",
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
   * LiveKit lifecycle hook, kept for API compatibility. LiveWire doesn't call
   * it, so an override doesn't run. The default does nothing.
   */
  async onEnter(): Promise<void> {}

  /**
   * LiveKit lifecycle hook, kept for API compatibility. LiveWire doesn't call
   * it, so an override doesn't run. The default does nothing.
   */
  async onExit(): Promise<void> {}

  /**
   * LiveKit lifecycle hook, kept for API compatibility. LiveWire doesn't call
   * it, so an override doesn't run. The default does nothing.
   *
   * @param _turnCtx - Turn context (LiveKit shape; passed through opaquely).
   * @param _newMessage - Newly-captured user message.
   */
  async onUserTurnCompleted(_turnCtx?: unknown, _newMessage?: unknown): Promise<void> {}

  // ------------------------------------------------------------------
  // Pipeline nodes: each does nothing and logs once (SignalWire handles these)
  // ------------------------------------------------------------------

  /**
   * LiveKit-compatible STT node. Does nothing on SignalWire, where the control
   * plane handles speech recognition. Logs a message once.
   *
   * @param _audio - Audio input (ignored).
   * @param _modelSettings - Model settings (ignored).
   */
  async sttNode(_audio?: unknown, _modelSettings?: unknown): Promise<void> {
    globalNoop.once(
      'stt_node',
      "Agent.sttNode(): does nothing. SignalWire's control plane handles speech recognition.",
    );
  }

  /**
   * LiveKit-compatible LLM node. Does nothing on SignalWire, where the control
   * plane handles LLM inference. Logs a message once.
   *
   * @param _chatCtx - Chat context (ignored).
   * @param _tools - Tool list (ignored).
   * @param _modelSettings - Model settings (ignored).
   */
  async llmNode(_chatCtx?: unknown, _tools?: unknown, _modelSettings?: unknown): Promise<void> {
    globalNoop.once(
      'llm_node',
      "Agent.llmNode(): does nothing. SignalWire's control plane handles LLM inference.",
    );
  }

  /**
   * LiveKit-compatible TTS node. Does nothing on SignalWire, where the control
   * plane handles text-to-speech. Logs a message once.
   *
   * @param _text - Text to synthesise (ignored).
   * @param _modelSettings - Model settings (ignored).
   */
  async ttsNode(_text?: unknown, _modelSettings?: unknown): Promise<void> {
    globalNoop.once(
      'tts_node',
      "Agent.ttsNode(): does nothing. SignalWire's control plane handles text-to-speech.",
    );
  }

  // ------------------------------------------------------------------
  // Dynamic updates
  // ------------------------------------------------------------------

  /**
   * Replace the agent's instructions.
   *
   * This changes the `Agent` object only. A session that has already started
   * keeps the prompt it built; {@link AgentSession.updateAgent} replaces that
   * prompt.
   *
   * @param instructions - New system-instructions string for the agent.
   */
  async updateInstructions(instructions: string): Promise<void> {
    this.instructions = instructions;
  }

  /**
   * Replace the agent's tool list.
   *
   * Replaces the current tool record with one built from the given tools.
   * This changes the `Agent` object only: tools are registered when
   * {@link AgentSession.start} runs, so a session that has already started
   * keeps its tools.
   *
   * @param tools - An array of {@link FunctionTool} definitions, each keyed
   *   by its `name`, or an object keyed by tool name (the LiveKit agents-js
   *   shape), whose keys become the tool names.
   */
  async updateTools(tools: FunctionTool[] | Record<string, FunctionTool>): Promise<void> {
    this.tools = Object.fromEntries(toolEntries(tools));
  }
}

// ---------------------------------------------------------------------------
// RunContext
// ---------------------------------------------------------------------------

/**
 * Mirrors a LiveKit `RunContext`. Tool handlers receive one as `context.ctx`,
 * and read the session and its user data from it.
 */
export class RunContext<UserData = unknown> {
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
 * Mirrors a LiveKit `AgentSession`, and binds an {@link Agent} to SignalWire.
 *
 * Call {@link AgentSession.start} with an `Agent` to build an internal
 * {@link AgentBase}. The `stt`, `tts`, `vad`, `turnDetection` and `mcpServers`
 * options are accepted for API compatibility and ignored; each logs a message
 * once. `llm`, `allowInterruptions` and the endpointing delays map to AI
 * params. `minInterruptionDuration` and `preemptiveGeneration` are stored and
 * not used.
 */
export class AgentSession<UserData = unknown> {
  private _llm: unknown;
  private _tools: [string, FunctionTool][];
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
    stt?: unknown;
    tts?: unknown;
    llm?: unknown;
    vad?: unknown;
    turnDetection?: unknown;
    tools?: FunctionTool[] | Record<string, FunctionTool>;
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
    this._tools = toolEntries(options?.tools);
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
        `AgentSession({ stt: "${options.stt}" }): ignored. SignalWire's control plane handles speech recognition.`,
      );
    }
    if (options?.tts != null) {
      this.noop.once(
        'tts',
        `AgentSession({ tts: "${options.tts}" }): ignored. SignalWire's control plane handles text-to-speech.`,
      );
    }
    if (options?.vad != null) {
      this.noop.once(
        'vad',
        "AgentSession({ vad }): ignored. SignalWire's control plane handles voice activity detection.",
      );
    }
    if (options?.turnDetection != null) {
      this.noop.once(
        'turn_detection',
        `AgentSession({ turnDetection: "${options.turnDetection}" }): ignored. SignalWire's control plane handles turn detection.`,
      );
    }
    if (options?.mcpServers != null) {
      this.noop.once(
        'mcp_servers',
        "AgentSession({ mcpServers }): ignored. LiveWire doesn't support MCP servers; register tools with tool().",
      );
    }
    if (options?.maxToolSteps != null && options.maxToolSteps !== 3) {
      this.noop.once(
        'max_tool_steps',
        `AgentSession({ maxToolSteps: ${options.maxToolSteps} }): ignored. SignalWire's control plane handles tool execution depth.`,
      );
    }
  }

  /**
   * Start the session by binding the agent to a new {@link AgentBase}, and map
   * LiveKit-style options onto SignalWire AI params.
   *
   * The `AgentBase` gets the agent's instructions as its prompt, and a tool for
   * each entry in the agent's and the session's tool lists. The `llm` value,
   * a model name or an LLM plugin object such as `plugins.OpenAILLM` whose
   * `model` is used, sets the `model` param, with any `provider/` prefix
   * removed.
   * `allowInterruptions: false` sets the `enable_barge` param to `false`, which
   * turns barge-in off. The minimum and
   * maximum endpointing delays, in seconds, set `end_of_speech_timeout` and
   * `attention_timeout` in milliseconds. Text queued with {@link say} becomes
   * an "Initial Greeting" prompt section.
   *
   * This method doesn't start an HTTP server. Called from an entry function
   * that {@link runApp} runs, it hands the built `AgentBase` to that job, and
   * `runApp()` serves it once the entry function returns. {@link getSwAgent}
   * returns the built `AgentBase`.
   *
   * @param params - Start parameters.
   * @param params.agent - The {@link Agent} to bind.
   * @param params.room - LiveKit room placeholder; ignored on SignalWire.
   * @param params.record - Call-recording flag placeholder; ignored on SignalWire.
   * @returns Resolves once the underlying `AgentBase` has been built.
   */
  async start(params: { agent: Agent<UserData>; room?: unknown; record?: boolean }): Promise<void> {
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

    // Map LLM model if provided (session-level takes priority, then agent-level hint).
    // An LLM plugin object (plugins.OpenAILLM, inference.LLM) carries its
    // model name in `model`.
    const llmModel = this._llm ?? agent._llmHint;
    let model: string | undefined;
    if (typeof llmModel === 'string') {
      model = llmModel;
    } else if (llmModel != null && typeof (llmModel as { model?: unknown }).model === 'string') {
      model = (llmModel as { model: string }).model;
    }
    if (model) {
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
      // The platform's switch for barge-in; barge_confidence does nothing
      swAgent.setParam('enable_barge', false);
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
    const allTools: [string, FunctionTool][] = [...Object.entries(agent.tools), ...this._tools];
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

    // Inside a runApp() entry function, hand the agent to that job, which
    // serves it once the entry function returns.
    const job = currentJob.getStore();
    if (job) job._swAgent = swAgent;
  }

  /**
   * Add text to the agent's prompt, for the model to use in what it says.
   *
   * The text isn't spoken verbatim. Before {@link start}, it's queued and added
   * as an "Initial Greeting" prompt section at start time. After start, it's
   * added as a "Say" prompt section.
   *
   * @param text - Text to add to the prompt.
   */
  say(text: string): void {
    // If the session has started, add a prompt section now. Otherwise queue
    // the text so start() adds it.
    if (this._swAgent) {
      this._swAgent.promptAddSection('Say', { body: text });
    } else {
      this._sayQueue.push(text);
    }
  }

  /**
   * Add instructions for the agent's reply to its prompt.
   *
   * After {@link start}, `options.instructions` is added as an "Initial
   * Greeting" prompt section. Before start, or without instructions, the call
   * does nothing. It doesn't make the agent speak by itself.
   *
   * @param options - Generation options.
   * @param options.instructions - Instructions added as a prompt section.
   */
  generateReply(options?: { instructions?: string }): void {
    if (options?.instructions && this._swAgent) {
      this._swAgent.promptAddSection('Initial Greeting', { body: options.instructions });
    }
  }

  /**
   * Interrupt current speech. Does nothing on SignalWire, where the control
   * plane handles barge-in. Logs a message once.
   */
  interrupt(): void {
    this.noop.once(
      'interrupt',
      "AgentSession.interrupt(): does nothing. SignalWire's control plane handles barge-in.",
    );
  }

  /**
   * Swap the {@link Agent} bound to this session.
   *
   * Keeps the underlying `AgentBase` and replaces its prompt with the new
   * agent's instructions. The new agent's tools aren't registered; the tools
   * from {@link start} stay.
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

  /**
   * Conversation history, kept for API compatibility. LiveWire doesn't record
   * turns, so the array stays empty.
   */
  get history(): Array<Record<string, string>> {
    return this._history;
  }

  /**
   * Return the underlying SignalWire {@link AgentBase}, for tests and for code
   * that needs the full SignalWire API.
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
 * Create a tool definition. Mirrors `llm.tool()` from `@livekit/agents-js`.
 *
 * The returned tool has an empty `name`. It gets its name from its key when
 * you add it to an agent's `tools` object (see the {@link Agent} example), or
 * from the `name` you set when you pass `tools` as an array.
 *
 * `parameters` is stored as given and sent as the tool's SWAIG parameters, so
 * pass a JSON Schema object. A Zod schema isn't converted to JSON Schema.
 *
 * The handler's return value becomes the tool result: a `FunctionResult` as is,
 * a string as the response text, and any other value as JSON text.
 *
 * @typeParam P - Parameter type passed into `execute`.
 * @param options - Tool configuration.
 * @param options.description - Human-readable tool description exposed to the LLM.
 * @param options.parameters - JSON Schema object describing the tool's inputs.
 * @param options.execute - Handler invoked when the LLM calls the tool.
 * @returns A {@link FunctionTool} ready to be attached to an agent.
 */
export function tool<P = unknown>(options: {
  description: string;
  parameters?: unknown;
  execute: (params: P, context: { ctx: RunContext }) => unknown;
}): FunctionTool {
  // Extract JSON schema from parameters if provided
  let jsonSchema: Record<string, unknown> | undefined;
  if (options.parameters) {
    // If it looks like a Zod schema (has a .shape or ._def), try to extract
    if (typeof options.parameters === 'object' && '_def' in options.parameters) {
      // A Zod schema is stored as is; it isn't converted to JSON Schema.
      jsonSchema = options.parameters as Record<string, unknown>;
    } else {
      jsonSchema = options.parameters as Record<string, unknown>;
    }
  }

  return {
    name: '', // Filled in when assigned to agent.tools
    description: options.description,
    parameters: jsonSchema,
    // The generic `P` is caller-facing sugar; FunctionTool stores the handler
    // with an `unknown` param. At runtime the platform forwards parsed args
    // verbatim, so widening the param type here is provably safe.
    execute: options.execute as FunctionTool['execute'],
  };
}

// ---------------------------------------------------------------------------
// handoff()
// ---------------------------------------------------------------------------

/**
 * Create an {@link AgentHandoff} descriptor, for LiveKit API compatibility.
 *
 * LiveWire doesn't act on a returned descriptor: the session keeps its agent.
 * To switch agents, call {@link AgentSession.updateAgent}.
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

/** A handoff to another agent. LiveWire doesn't act on it; see {@link handoff}. */
export class AgentHandoff {
  /** Target agent that should take over the conversation. */
  agent!: Agent;
  /** Optional return value surfaced when the handoff completes. */
  returns?: string;
}

/**
 * LiveKit's signal that a tool shouldn't trigger another LLM reply. LiveWire
 * doesn't handle it specially: a tool that throws it gets the SDK's generic
 * tool error response, like any other exception.
 */
export class StopResponse extends Error {
  /**
   * @param message - Optional error message. Defaults to `"StopResponse"`.
   */
  constructor(message?: string) {
    super(message ?? 'StopResponse');
    this.name = 'StopResponse';
  }
}

/**
 * LiveKit's error for a failed tool. LiveWire doesn't handle it specially: a
 * tool that throws it gets the SDK's generic tool error response, and the
 * message isn't sent to the model.
 */
export class ToolError extends Error {
  /**
   * @param message - Error message (logged; not sent to the model).
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
 * Mirrors a LiveKit `JobProcess`, passed to the prewarm hook.
 *
 * SignalWire has no worker processes to prewarm, so this class holds only
 * the LiveKit-compatible `userData` object.
 */
export class JobProcess {
  /** Mutable object for data passed between callbacks. */
  userData: Record<string, unknown> = {};
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

/**
 * Stub `Room`. SignalWire doesn't use the LiveKit room abstraction.
 *
 * It exists for API compatibility, so LiveKit-shaped code compiles. Its only
 * attribute is a constant name.
 */
export class Room {
  /** Always `"livewire-room"`; SignalWire has no per-call room identity. */
  readonly name: string = 'livewire-room';
}

// ---------------------------------------------------------------------------
// JobContext
// ---------------------------------------------------------------------------

/**
 * Mirrors a LiveKit `JobContext`, passed to the entry function that
 * {@link runApp} calls.
 */
export class JobContext {
  /** Placeholder {@link Room} (see class docs). */
  room: Room;
  /** A {@link JobProcess}. `runApp()` creates it separately from the one passed to prewarm. */
  proc: JobProcess;
  /**
   * @internal The `AgentBase` of the last session started while this job's
   * entry function ran; `runApp()` serves it.
   */
  _swAgent?: AgentBase;

  constructor() {
    this.room = new Room();
    this.proc = new JobProcess();
  }

  /**
   * Connect to the platform. Does nothing on SignalWire, where the platform
   * connects when it requests the agent's SWML. Logs a message once.
   *
   * @returns Resolves immediately.
   */
  async connect(): Promise<void> {
    globalNoop.once(
      'connect',
      "JobContext.connect(): does nothing. SignalWire connects when it requests the agent's SWML.",
    );
  }

  /**
   * Wait for a participant to join. On SignalWire it returns a stub
   * participant at once.
   *
   * @param options - Participant match options.
   * @param options.identity - Requested identity; echoed back in the stub.
   *   Defaults to `"caller"`.
   * @returns A stub participant `{ identity }` record.
   */
  async waitForParticipant(options?: { identity?: string }): Promise<{ identity: string }> {
    return { identity: options?.identity ?? 'caller' };
  }
}

/**
 * The {@link JobContext} whose entry function is running, so that
 * {@link AgentSession.start} can hand its agent to the job for
 * {@link runApp} to serve.
 */
const currentJob = new AsyncLocalStorage<JobContext>();

// ---------------------------------------------------------------------------
// defineAgent
// ---------------------------------------------------------------------------

/**
 * A LiveKit-compatible agent definition: a required `entry` callback and an
 * optional `prewarm` hook. The `prewarm` return value is ignored.
 */
export interface AgentDefinition {
  /** Main callback invoked with a {@link JobContext} when the agent runs. */
  entry: (ctx: JobContext) => Promise<void>;
  /** Optional prewarm callback invoked with a {@link JobProcess} before `entry`. */
  prewarm?: (proc: JobProcess) => unknown;
}

/**
 * Mirrors `@livekit/agents.defineAgent()`.
 *
 * Packages an entry function, and an optional prewarm hook, for
 * {@link runApp}. It returns its argument unchanged.
 *
 * @param agent - Entry and (optional) prewarm functions.
 * @param agent.entry - Main callback invoked with a {@link JobContext} when
 *   the agent runs.
 * @param agent.prewarm - Optional prewarm callback invoked with a
 *   {@link JobProcess} before `entry`.
 * @returns The same object.
 */
export function defineAgent(agent: AgentDefinition): AgentDefinition {
  return agent;
}

// ---------------------------------------------------------------------------
// runApp
// ---------------------------------------------------------------------------

/**
 * Mirrors `cli.runApp()` from `@livekit/agents-js`.
 *
 * It takes these steps:
 *
 * 1. Prints the LiveWire banner
 * 2. Runs the prewarm callback, if any, with a new {@link JobProcess}
 * 3. Creates a new {@link JobContext}
 * 4. Prints a random tip
 * 5. Calls the entry function with the context
 * 6. When the entry function resolves, serves the `AgentBase` of the last
 *    {@link AgentSession} the entry function started, by calling its
 *    `serve()`. The server listens on `PORT` (default 3000), with the route
 *    `/`, and runs until the process exits.
 *
 * It accepts an object `{ entry, prewarm? }`, a bare entry function, or an
 * {@link AgentServer} instance. Errors from the entry function are written to
 * stderr, as is a message when the entry function starts no session.
 *
 * When `SWAIG_CLI_MODE=true` is set as `runApp()` is called (the `swaig-test`
 * CLI sets it while it imports an agent file), the entry function runs and
 * nothing is served.
 *
 * @param options - Agent descriptor, entry function, or `AgentServer`.
 */
export function runApp(
  options:
    | AgentServer
    | AgentDefinition
    | ((ctx: JobContext) => unknown)
    | { agent?: AgentDefinition }
    | undefined,
): void {
  printBanner();

  // If passed an AgentServer instance, convert it to an agentDef-compatible object.
  // Otherwise the value is an AgentDefinition, a bare entry function, or a
  // wrapper carrying `.agent`, each detected by its shape.
  const agentDef: unknown =
    options instanceof AgentServer
      ? options._toAgentDef()
      : ((options as { agent?: unknown })?.agent ?? options);

  // Run prewarm if registered
  const def = agentDef as { prewarm?: (proc: JobProcess) => unknown; entry?: unknown } | undefined;
  if (def?.prewarm) {
    const proc = new JobProcess();
    globalNoop.once(
      'prewarm',
      "prewarm: the callback runs, but SignalWire's control plane manages media infrastructure, so there are no worker processes to prewarm.",
    );
    def.prewarm(proc);
  }

  // Create a JobContext
  const ctx = new JobContext();

  // Print a random tip
  printTip();

  // Read now: swaig-test sets SWAIG_CLI_MODE only while it imports the agent
  // file, and the entry function's session is built after that.
  const cliMode = process.env['SWAIG_CLI_MODE'] === 'true';

  // Call the entry function. A session started inside it hands its agent to
  // ctx (see AgentSession.start).
  const entryFn = def?.entry ?? agentDef;
  if (typeof entryFn === 'function') {
    let result: unknown;
    try {
      result = currentJob.run(ctx, () => (entryFn as (ctx: JobContext) => unknown)(ctx));
    } catch (err) {
      result = Promise.reject(err);
    }
    Promise.resolve(result)
      .then(() => {
        // After entry completes, serve the AgentBase stored on ctx, if any.
        if (!ctx._swAgent) {
          process.stderr.write(
            '[LiveWire] no agent was started: call session.start({ agent }) in the entry function.\n',
          );
        } else if (!cliMode) {
          ctx._swAgent.serve().catch((err: Error) => {
            process.stderr.write(`[LiveWire] agent error: ${err.message}\n`);
          });
        }
      })
      .catch((err: Error) => {
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
 * Accepts any configuration, for source compatibility with LiveKit code.
 * SignalWire ignores these settings.
 */
export class WorkerOptions {
  /** @param _opts - LiveKit-shaped worker options (ignored). */
  constructor(_opts?: unknown) {}
}

/**
 * Stub class mirroring LiveKit's `ServerOptions`.
 *
 * Accepts any configuration, for source compatibility with LiveKit code.
 * SignalWire ignores these settings.
 */
export class ServerOptions {
  /** @param _opts - LiveKit-shaped server options (ignored). */
  constructor(_opts?: unknown) {}
}

// ---------------------------------------------------------------------------
// AgentServer
// ---------------------------------------------------------------------------

/**
 * Mirrors a LiveKit AgentServer: registers an entry function for
 * {@link runApp}.
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
  /** Optional prewarm hook, called before the entry function. Mirrors Python's `setup_fnc`. */
  setupFnc?: (proc: JobProcess) => void;

  /** @internal Registered entrypoint function. */
  private _entryFn?: (ctx: JobContext) => Promise<void>;

  /** @internal Agent name hint registered via rtcSession(). */
  private _agentName: string = '';

  constructor(_opts?: unknown) {}

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
          onRequest?: ((...args: unknown[]) => unknown) | null;
          onSessionEnd?: ((...args: unknown[]) => unknown) | null;
        },
    opts?: {
      agentName?: string;
      type?: string;
      onRequest?: ((...args: unknown[]) => unknown) | null;
      onSessionEnd?: ((...args: unknown[]) => unknown) | null;
    },
  ): ((fn: (ctx: JobContext) => Promise<void>) => (ctx: JobContext) => Promise<void>) | void {
    // Determine whether first arg is a function or an options object
    let fn: ((ctx: JobContext) => Promise<void>) | undefined;
    let resolvedOpts: typeof opts;

    if (typeof fnOrOpts === 'function') {
      fn = fnOrOpts;
      resolvedOpts = opts;
    } else {
      // fnOrOpts is an options object (or undefined): parameterized decorator usage
      resolvedOpts = fnOrOpts;
    }

    if (resolvedOpts?.type && resolvedOpts.type !== 'room') {
      globalNoop.once(
        'server_type',
        `AgentServer.rtcSession({ type: ${JSON.stringify(resolvedOpts.type)} }): ignored. SignalWire's control plane handles server topology.`,
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
 * None of these do anything. They exist so LiveKit code that imports and
 * constructs these classes still compiles and runs under SignalWire. The
 * first construction of most of them logs a message to stderr.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace -- LiveKit-compat namespace; preserves the exact public API shape (value + type access for `plugins.X`)
export namespace plugins {
  /** LiveKit Deepgram-STT plugin stub. Does nothing on SignalWire. */
  export class DeepgramSTT {
    /** @param _opts - Deepgram options (ignored). */
    constructor(_opts?: unknown) {
      globalNoop.once(
        'stt_plugin',
        "DeepgramSTT: ignored. SignalWire's control plane handles speech recognition.",
      );
    }
  }

  /**
   * LiveKit OpenAI-LLM plugin stub.
   *
   * Captures the `model` string. Passed as the `llm` option of
   * `AgentSession` or `Agent`, it sets the `model` AI param. Other options
   * are ignored.
   */
  export class OpenAILLM {
    /** Model identifier captured from the constructor options. */
    model: string;
    /** @param _opts - OpenAI options. `_opts.model` is captured; everything else ignored. */
    constructor(_opts?: unknown) {
      this.model = (_opts as { model?: string })?.model ?? '';
      globalNoop.once(
        'openai_llm',
        "OpenAILLM(): only its model option is used, to set the model AI param. SignalWire's control plane runs the LLM.",
      );
    }
  }

  /** LiveKit Cartesia-TTS plugin stub. Does nothing on SignalWire. */
  export class CartesiaTTS {
    /** @param _opts - Cartesia options (ignored). */
    constructor(_opts?: unknown) {
      globalNoop.once(
        'cartesia_tts',
        "CartesiaTTS: ignored. SignalWire's control plane handles text-to-speech.",
      );
    }
  }

  /** LiveKit ElevenLabs-TTS plugin stub. Does nothing on SignalWire. */
  export class ElevenLabsTTS {
    /** @param _opts - ElevenLabs options (ignored). */
    constructor(_opts?: unknown) {
      globalNoop.once(
        'elevenlabs_tts',
        "ElevenLabsTTS: ignored. SignalWire's control plane handles text-to-speech.",
      );
    }
  }

  /** LiveKit Silero-VAD plugin stub. Does nothing on SignalWire. */
  export class SileroVAD {
    /** @param _opts - Silero VAD options (ignored). */
    constructor(_opts?: Record<string, unknown>) {}

    /**
     * Load a Silero VAD model.
     *
     * Does nothing on SignalWire: returns a new stub instance, and logs a
     * message to stderr once.
     *
     * @returns A new `SileroVAD` stub.
     */
    static load(): SileroVAD {
      globalNoop.once(
        'vad_plugin',
        "SileroVAD.load(): ignored. SignalWire's control plane handles voice activity detection.",
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
 * None of these run inference on the client. SignalWire runs STT, LLM and TTS
 * in its control plane. These classes exist so LiveKit code that imports and
 * constructs them still compiles.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace -- LiveKit-compat namespace; preserves the exact public API shape (value + type access for `inference.X`)
export namespace inference {
  /** LiveKit inference-STT stub. Captures the model name; runs no inference locally. */
  export class STT {
    /** Model identifier captured from the constructor. */
    model: string;
    /**
     * @param model - Model identifier (captured).
     * @param _opts - Additional options (ignored).
     */
    constructor(model: string = '', _opts?: unknown) {
      this.model = model;
      globalNoop.once(
        'inference_stt',
        "inference.STT: ignored. SignalWire's control plane handles speech recognition.",
      );
    }
  }

  /**
   * LiveKit inference-LLM stub. Captures the model name; runs no inference
   * locally. Passed as the `llm` option, it sets the `model` AI param.
   */
  export class LLM {
    /** Model identifier captured from the constructor. */
    model: string;
    /**
     * @param model - Model identifier (captured).
     * @param _opts - Additional options (ignored).
     */
    constructor(model: string = '', _opts?: unknown) {
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
    constructor(model: string = '', _opts?: unknown) {
      this.model = model;
      globalNoop.once(
        'inference_tts',
        "inference.TTS: ignored. SignalWire's control plane handles text-to-speech.",
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
