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
  /** Agent-level override for allow_interruptions (undefined = use session value). */
  readonly allowInterruptions?: boolean;
  /** Agent-level override for min_endpointing_delay in seconds (undefined = use session value). */
  readonly minEndpointingDelay?: number;
  /** Agent-level override for max_endpointing_delay in seconds (undefined = use session value). */
  readonly maxEndpointingDelay?: number;

  constructor(options: {
    instructions: string;
    tools?: Record<string, FunctionTool>;
    userData?: UserData;
    /** When set, overrides the session-level allowInterruptions. */
    allowInterruptions?: boolean;
    /** When set, overrides the session-level minEndpointingDelay (seconds). */
    minEndpointingDelay?: number;
    /** When set, overrides the session-level maxEndpointingDelay (seconds). */
    maxEndpointingDelay?: number;
  }) {
    this.instructions = options.instructions;
    this.tools = options.tools ?? {};
    this.userData = options.userData;
    this.allowInterruptions = options.allowInterruptions;
    this.minEndpointingDelay = options.minEndpointingDelay;
    this.maxEndpointingDelay = options.maxEndpointingDelay;
  }
}

// ---------------------------------------------------------------------------
// RunContext
// ---------------------------------------------------------------------------

/** Mirrors a LiveKit RunContext -- available inside tool handlers. */
export class RunContext<UserData = any> {
  readonly session: AgentSession<UserData>;
  readonly speechHandle: any;
  readonly functionCall: any;

  constructor(session: AgentSession<UserData>, options?: {
    speechHandle?: any;
    functionCall?: any;
  }) {
    this.session = session;
    this.speechHandle = options?.speechHandle ?? null;
    this.functionCall = options?.functionCall ?? null;
  }

  get userData(): UserData {
    return this.session.userData;
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
  private _mcpServers: any;
  private _userData: UserData;
  private _allowInterruptions: boolean;
  private _minInterruptionDuration: number;
  private _minEndpointingDelay: number;
  private _maxEndpointingDelay: number;
  private _maxToolSteps: number;
  private _preemptiveGeneration: boolean;
  private _voiceOptions?: Partial<VoiceOptions>;
  private _agent?: Agent<UserData>;
  private _swAgent?: AgentBase;
  private _history: Array<{ role: string; content: string }> = [];
  private noop = new NoopTracker();

  constructor(options?: {
    stt?: any;
    tts?: any;
    llm?: any;
    vad?: any;
    turnDetection?: any;
    tools?: FunctionTool[];
    mcpServers?: any;
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
    this._tools = options?.tools ?? [];
    this._mcpServers = options?.mcpServers;
    this._userData = (options?.userData ?? {}) as UserData;
    this._allowInterruptions = options?.allowInterruptions ?? true;
    this._minInterruptionDuration = options?.minInterruptionDuration ?? 0.5;
    this._minEndpointingDelay = options?.minEndpointingDelay ?? 0.5;
    this._maxEndpointingDelay = options?.maxEndpointingDelay ?? 3.0;
    this._maxToolSteps = options?.maxToolSteps ?? 3;
    this._preemptiveGeneration = options?.preemptiveGeneration ?? false;
    this._voiceOptions = options?.voiceOptions;

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
        "AgentSession(mcpServers=...): MCP servers are not yet supported in LiveWire — tools should be registered via tool()",
      );
    }
    if (options?.maxToolSteps != null && options.maxToolSteps !== 3) {
      this.noop.once(
        'max_tool_steps',
        `AgentSession(maxToolSteps=${options.maxToolSteps}): SignalWire's control plane handles tool execution depth at scale automatically`,
      );
    }
  }

  /** Read-only access to conversation history accumulated during the session. */
  get history(): Array<{ role: string; content: string }> {
    return this._history;
  }

  /** Start the session by binding the agent to a SignalWire AgentBase. */
  async start(params: { agent: Agent<UserData>; room?: any; record?: boolean }): Promise<void> {
    this._agent = params.agent;

    // Build a real SignalWire AgentBase
    const swAgent = new AgentBase({
      name: 'LiveWireAgent',
      route: '/',
    });

    swAgent.setPromptText(params.agent.instructions);

    // Map LLM model if provided
    if (this._llm) {
      let model = String(this._llm);
      const slashIdx = model.indexOf('/');
      if (slashIdx >= 0) model = model.slice(slashIdx + 1);
      swAgent.setParam('model', model);
    }

    // Map interruption / barge-in setting.
    // Agent-level value takes precedence over session-level (mirrors Python's
    // getattr(agent, "_allow_interruptions", NOT_GIVEN) override logic).
    const allowInterruptions =
      params.agent.allowInterruptions !== undefined
        ? params.agent.allowInterruptions
        : this._allowInterruptions;
    if (!allowInterruptions) {
      swAgent.setParam('barge_confidence', 1.0);
    }

    // Map endpointing delays.
    // Agent-level values take precedence over session-level values (mirrors
    // Python's getattr(agent, "_min_endpointing_delay", NOT_GIVEN) logic).
    const minEndpointingDelay =
      params.agent.minEndpointingDelay !== undefined
        ? params.agent.minEndpointingDelay
        : this._minEndpointingDelay;
    if (minEndpointingDelay > 0) {
      swAgent.setParam('end_of_speech_timeout', Math.round(minEndpointingDelay * 1000));
    }

    const maxEndpointingDelay =
      params.agent.maxEndpointingDelay !== undefined
        ? params.agent.maxEndpointingDelay
        : this._maxEndpointingDelay;
    if (maxEndpointingDelay > 0) {
      swAgent.setParam('attention_timeout', Math.round(maxEndpointingDelay * 1000));
    }

    // Map record param
    if (params.record) {
      swAgent.setParam('record', true);
    }

    // Register all tools from the agent + session-level tools
    const allTools: Array<[string, FunctionTool]> = [
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

    this._swAgent = swAgent;
  }

  /** Queue text to be spoken by the agent. */
  say(text: string): void {
    // In a full implementation this would inject into the SWML flow.
    // For now we append a prompt section so the AI speaks the text.
    if (this._swAgent) {
      this._swAgent.promptAddSection('Say', { body: text });
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
  name = 'livewire-room';
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

  /** Wait for a participant -- noop on SignalWire (handles participant management automatically). */
  async waitForParticipant(options?: { identity?: string }): Promise<void> {
    globalNoop.once(
      'wait_for_participant',
      "JobContext.waitForParticipant(): SignalWire's control plane handles participant management automatically",
    );
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

  const agentDef = options?.agent ?? options;

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
    constructor(_opts?: any) {}
  }

  export class CartesiaTTS {
    constructor(_opts?: any) {}
  }

  export class ElevenLabsTTS {
    constructor(_opts?: any) {}
  }

  export class SileroVAD {
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
    constructor(_model: string, _opts?: any) {
      globalNoop.once(
        'inference_stt',
        'inference.STT: SignalWire\'s control plane handles speech recognition at scale',
      );
    }
  }

  export class LLM {
    constructor(_model: string, _opts?: any) {}
  }

  export class TTS {
    constructor(_model: string, _opts?: any) {
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

/** Minimal stub mirroring LiveKit ChatContext. */
export class ChatContext {
  messages: Array<{ role: string; content: string }> = [];

  append({ role = 'user', text = '' }: { role?: string; text?: string } = {}): this {
    this.messages.push({ role, content: text });
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
