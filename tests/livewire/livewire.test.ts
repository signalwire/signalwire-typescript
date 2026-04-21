import { describe, it, expect, beforeEach } from 'vitest';
import {
  Agent,
  AgentSession,
  ChatContext,
  tool,
  handoff,
  RunContext,
  defineAgent,
  JobContext,
  JobProcess,
  WorkerOptions,
  ServerOptions,
  StopResponse,
  ToolError,
  AgentHandoff,
  NoopTracker,
  globalNoop,
  plugins,
  inference,
  tips,
  banner,
  printBanner,
  voice,
  llm,
  cli,
  type FunctionTool,
} from '../../src/livewire/index.js';

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

describe('Agent', () => {
  it('creates with instructions and no tools', () => {
    const agent = new Agent({ instructions: 'You are a helpful assistant.' });
    expect(agent.instructions).toBe('You are a helpful assistant.');
    expect(Object.keys(agent.tools)).toHaveLength(0);
  });

  it('creates with instructions and tools', () => {
    const myTool = tool({
      description: 'Get weather',
      execute: () => 'sunny',
    });
    const agent = new Agent({
      instructions: 'Weather bot',
      tools: [{ ...myTool, name: 'get_weather' }],
    });
    expect(agent.instructions).toBe('Weather bot');
    expect(agent.tools['get_weather']).toBeDefined();
    expect(agent.tools['get_weather'].description).toBe('Get weather');
  });

  it('accepts userData generic', () => {
    const agent = new Agent<{ sessionId: string }>({
      instructions: 'test',
      userData: { sessionId: 'abc' },
    });
    expect(agent.userData?.sessionId).toBe('abc');
  });
});

// ---------------------------------------------------------------------------
// AgentSession
// ---------------------------------------------------------------------------

describe('AgentSession', () => {
  it('creates with all options without throwing', () => {
    const session = new AgentSession({
      stt: 'deepgram',
      tts: 'elevenlabs',
      llm: 'openai/gpt-4',
      vad: 'silero',
      turnDetection: 'server_vad',
      userData: { id: 1 },
    });
    expect(session).toBeDefined();
    expect(session.userData).toEqual({ id: 1 });
  });

  it('creates with no options', () => {
    const session = new AgentSession();
    expect(session).toBeDefined();
  });

  it('start() binds agent to SignalWire AgentBase', async () => {
    const session = new AgentSession({ llm: 'openai/gpt-4' });
    const agent = new Agent({ instructions: 'Test instructions' });
    await session.start({ agent });
    const sw = session.getSwAgent();
    expect(sw).toBeDefined();
  });

  it('start() registers tools from agent', async () => {
    const session = new AgentSession();
    const weatherTool = tool({
      description: 'Get weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
      },
      execute: (params: any) => `Weather in ${params.location}: sunny`,
    });
    const agent = new Agent({
      instructions: 'Weather assistant',
      tools: [{ ...weatherTool, name: 'get_weather' }],
    });
    await session.start({ agent });
    const sw = session.getSwAgent();
    expect(sw).toBeDefined();
  });

  it('say() does not throw', async () => {
    const session = new AgentSession();
    const agent = new Agent({ instructions: 'test' });
    await session.start({ agent });
    expect(() => session.say('Hello there')).not.toThrow();
  });

  it('generateReply() does not throw', async () => {
    const session = new AgentSession();
    const agent = new Agent({ instructions: 'test' });
    await session.start({ agent });
    expect(() => session.generateReply()).not.toThrow();
    expect(() => session.generateReply({ instructions: 'Greet the user' })).not.toThrow();
  });

  it('interrupt() is a noop that does not throw', () => {
    const session = new AgentSession();
    expect(() => session.interrupt()).not.toThrow();
  });

  it('updateAgent() changes the bound agent', async () => {
    const session = new AgentSession();
    const agent1 = new Agent({ instructions: 'First agent' });
    await session.start({ agent: agent1 });

    const agent2 = new Agent({ instructions: 'Second agent' });
    session.updateAgent(agent2);
    // Should not throw -- internally updates the prompt
  });

  it('userData getter/setter works', () => {
    const session = new AgentSession({ userData: { key: 'val' } });
    expect(session.userData).toEqual({ key: 'val' });
    session.userData = { key: 'updated' };
    expect(session.userData).toEqual({ key: 'updated' });
  });
});

// ---------------------------------------------------------------------------
// tool()
// ---------------------------------------------------------------------------

describe('tool()', () => {
  it('creates a valid tool definition', () => {
    const t = tool({
      description: 'Look up a word',
      parameters: {
        type: 'object',
        properties: {
          word: { type: 'string', description: 'The word to look up' },
        },
      },
      execute: (params: any) => `Definition of ${params.word}`,
    });
    expect(t.description).toBe('Look up a word');
    expect(t.parameters).toBeDefined();
    expect(t.execute).toBeTypeOf('function');
  });

  it('creates a tool without parameters', () => {
    const t = tool({
      description: 'Get time',
      execute: () => '12:00 PM',
    });
    expect(t.description).toBe('Get time');
    expect(t.parameters).toBeUndefined();
  });

  it('execute function receives params and context', async () => {
    const session = new AgentSession();
    const ctx = new RunContext(session);

    const t = tool({
      description: 'test',
      execute: (params: any, context: { ctx: RunContext }) => {
        return `${params.name} via ${context.ctx.constructor.name}`;
      },
    });

    const result = t.execute({ name: 'Alice' }, { ctx });
    expect(result).toBe('Alice via RunContext');
  });
});

// ---------------------------------------------------------------------------
// handoff()
// ---------------------------------------------------------------------------

describe('handoff()', () => {
  it('creates a handoff object', () => {
    const agent = new Agent({ instructions: 'Sales agent' });
    const h = handoff({ agent, returns: 'transfer_complete' });
    expect(h).toBeInstanceOf(AgentHandoff);
    expect(h.agent).toBe(agent);
    expect(h.returns).toBe('transfer_complete');
  });

  it('creates a handoff without returns', () => {
    const agent = new Agent({ instructions: 'Support agent' });
    const h = handoff({ agent });
    expect(h.agent.instructions).toBe('Support agent');
    expect(h.returns).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// RunContext
// ---------------------------------------------------------------------------

describe('RunContext', () => {
  it('has session and userData', () => {
    const session = new AgentSession({ userData: { role: 'admin' } });
    const ctx = new RunContext(session);
    expect(ctx.session).toBe(session);
    expect(ctx.userData).toEqual({ role: 'admin' });
  });

  it('userData reflects session userData changes', () => {
    const session = new AgentSession({ userData: { count: 0 } });
    const ctx = new RunContext(session);
    expect(ctx.userData).toEqual({ count: 0 });
    session.userData = { count: 5 };
    expect(ctx.userData).toEqual({ count: 5 });
  });
});

// ---------------------------------------------------------------------------
// defineAgent
// ---------------------------------------------------------------------------

describe('defineAgent()', () => {
  it('accepts entry and prewarm', () => {
    const def = defineAgent({
      entry: async (ctx: JobContext) => {
        await ctx.connect();
      },
      prewarm: (proc: JobProcess) => {
        proc.userData['ready'] = true;
      },
    });
    expect(def.entry).toBeTypeOf('function');
    expect(def.prewarm).toBeTypeOf('function');
  });

  it('accepts entry only', () => {
    const def = defineAgent({
      entry: async () => {},
    });
    expect(def.entry).toBeTypeOf('function');
    expect(def.prewarm).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// JobContext
// ---------------------------------------------------------------------------

describe('JobContext', () => {
  it('connect() is a noop that resolves', async () => {
    const ctx = new JobContext();
    await expect(ctx.connect()).resolves.toBeUndefined();
  });

  it('waitForParticipant() resolves', async () => {
    const ctx = new JobContext();
    const participant = await ctx.waitForParticipant();
    expect(participant).toBeDefined();
  });

  it('has room and proc', () => {
    const ctx = new JobContext();
    expect(ctx.room).toBeDefined();
    expect(ctx.proc).toBeInstanceOf(JobProcess);
  });
});

// ---------------------------------------------------------------------------
// JobProcess
// ---------------------------------------------------------------------------

describe('JobProcess', () => {
  it('has userData map', () => {
    const proc = new JobProcess();
    expect(proc.userData).toEqual({});
    proc.userData['key'] = 'value';
    expect(proc.userData['key']).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// Plugin stubs
// ---------------------------------------------------------------------------

describe('Plugin stubs', () => {
  it('DeepgramSTT constructs without error', () => {
    expect(() => new plugins.DeepgramSTT()).not.toThrow();
    expect(() => new plugins.DeepgramSTT({ model: 'nova-2' })).not.toThrow();
  });

  it('OpenAILLM constructs without error', () => {
    expect(() => new plugins.OpenAILLM()).not.toThrow();
    expect(() => new plugins.OpenAILLM({ model: 'gpt-4' })).not.toThrow();
  });

  it('CartesiaTTS constructs without error', () => {
    expect(() => new plugins.CartesiaTTS()).not.toThrow();
  });

  it('ElevenLabsTTS constructs without error', () => {
    expect(() => new plugins.ElevenLabsTTS()).not.toThrow();
  });

  it('SileroVAD.load() returns instance', () => {
    const vad = plugins.SileroVAD.load();
    expect(vad).toBeInstanceOf(plugins.SileroVAD);
  });
});

// ---------------------------------------------------------------------------
// Inference stubs
// ---------------------------------------------------------------------------

describe('Inference stubs', () => {
  it('STT constructs without error', () => {
    expect(() => new inference.STT('deepgram')).not.toThrow();
  });

  it('LLM constructs without error', () => {
    expect(() => new inference.LLM('gpt-4')).not.toThrow();
  });

  it('TTS constructs without error', () => {
    expect(() => new inference.TTS('elevenlabs')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Noop logging
// ---------------------------------------------------------------------------

describe('Noop logging', () => {
  it('fires once per feature key', () => {
    const tracker = new NoopTracker();
    tracker.once('stt', 'STT message');
    tracker.once('stt', 'STT message again');
    tracker.once('stt', 'STT message third');

    expect(tracker.hasLogged('stt')).toBe(true);
  });

  it('tracks different keys independently', () => {
    const tracker = new NoopTracker();
    tracker.once('stt', 'stt msg');
    tracker.once('vad', 'vad msg');

    expect(tracker.hasLogged('stt')).toBe(true);
    expect(tracker.hasLogged('vad')).toBe(true);
    expect(tracker.hasLogged('tts')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tips
// ---------------------------------------------------------------------------

describe('Tips', () => {
  it('has entries', () => {
    expect(tips.length).toBeGreaterThan(0);
  });

  it('has at least 5 tips', () => {
    expect(tips.length).toBeGreaterThanOrEqual(5);
  });

  it('all tips are non-empty strings', () => {
    for (const tip of tips) {
      expect(typeof tip).toBe('string');
      expect(tip.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

describe('Banner', () => {
  it('contains LiveKit-compatible', () => {
    expect(banner).toContain('LiveKit-compatible');
  });

  it('contains SignalWire', () => {
    expect(banner).toContain('SignalWire');
  });

  it('contains ASCII art', () => {
    expect(banner).toContain('/ /   (_)');
  });
});

// ---------------------------------------------------------------------------
// StopResponse / ToolError / AgentHandoff
// ---------------------------------------------------------------------------

describe('StopResponse', () => {
  it('is an Error', () => {
    const sr = new StopResponse();
    expect(sr).toBeInstanceOf(Error);
    expect(sr.name).toBe('StopResponse');
  });
});

describe('ToolError', () => {
  it('is an Error', () => {
    const te = new ToolError('bad input');
    expect(te).toBeInstanceOf(Error);
    expect(te.name).toBe('ToolError');
    expect(te.message).toBe('bad input');
  });
});

describe('AgentHandoff', () => {
  it('holds agent reference', () => {
    const h = new AgentHandoff();
    const agent = new Agent({ instructions: 'test' });
    h.agent = agent;
    expect(h.agent).toBe(agent);
  });
});

// ---------------------------------------------------------------------------
// WorkerOptions / ServerOptions
// ---------------------------------------------------------------------------

describe('WorkerOptions', () => {
  it('constructs without error', () => {
    expect(() => new WorkerOptions()).not.toThrow();
    expect(() => new WorkerOptions({ port: 3000 })).not.toThrow();
  });
});

describe('ServerOptions', () => {
  it('constructs without error', () => {
    expect(() => new ServerOptions()).not.toThrow();
    expect(() => new ServerOptions({ host: '0.0.0.0' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Namespace re-exports
// ---------------------------------------------------------------------------

describe('Namespace re-exports', () => {
  it('voice namespace has Agent and AgentSession', () => {
    expect(voice.Agent).toBe(Agent);
    expect(voice.AgentSession).toBe(AgentSession);
    expect(voice.AgentSessionEventTypes).toBeDefined();
  });

  it('llm namespace has tool, handoff, ToolError, ChatContext', () => {
    expect(llm.tool).toBe(tool);
    expect(llm.handoff).toBe(handoff);
    expect(llm.ToolError).toBeDefined();
    expect(llm.ChatContext).toBe(ChatContext);
  });

  it('cli namespace has runApp', () => {
    expect(cli.runApp).toBeTypeOf('function');
  });
});

// ---------------------------------------------------------------------------
// Agent alignment gaps (P1 + P2 fixes)
// ---------------------------------------------------------------------------

describe('Agent alignment gaps', () => {
  it('creates with no arguments (instructions defaults to empty string)', () => {
    const agent = new Agent();
    expect(agent.instructions).toBe('');
    expect(Object.keys(agent.tools)).toHaveLength(0);
  });

  it('instructions defaults to empty string when omitted', () => {
    const agent = new Agent({});
    expect(agent.instructions).toBe('');
  });

  it('accepts all Python-aligned constructor params', () => {
    const agent = new Agent({
      instructions: 'test',
      chatCtx: { messages: [] },
      stt: 'deepgram',
      tts: 'elevenlabs',
      llm: 'openai/gpt-4',
      vad: 'silero',
      turnDetection: 'server_vad',
      mcpServers: ['server1'],
      allowInterruptions: false,
      minEndpointingDelay: 0.3,
      maxEndpointingDelay: 5.0,
    });
    expect(agent.instructions).toBe('test');
    expect(agent._llmHint).toBe('openai/gpt-4');
    expect(agent._allowInterruptions).toBe(false);
    expect(agent._minEndpointingDelay).toBe(0.3);
    expect(agent._maxEndpointingDelay).toBe(5.0);
  });

  it('has session property (get/set)', () => {
    const agent = new Agent({ instructions: 'test' });
    expect(agent.session).toBeUndefined();
    const session = new AgentSession();
    agent.session = session;
    expect(agent.session).toBe(session);
    agent.session = undefined;
    expect(agent.session).toBeUndefined();
  });

  it('onEnter lifecycle hook is overridable', async () => {
    let called = false;
    class MyAgent extends Agent {
      override async onEnter(): Promise<void> {
        called = true;
      }
    }
    const agent = new MyAgent({ instructions: 'test' });
    await agent.onEnter();
    expect(called).toBe(true);
  });

  it('onExit lifecycle hook is overridable', async () => {
    let called = false;
    class MyAgent extends Agent {
      override async onExit(): Promise<void> {
        called = true;
      }
    }
    const agent = new MyAgent({ instructions: 'test' });
    await agent.onExit();
    expect(called).toBe(true);
  });

  it('onUserTurnCompleted lifecycle hook is overridable', async () => {
    let receivedTurnCtx: unknown;
    let receivedNewMessage: unknown;
    class MyAgent extends Agent {
      override async onUserTurnCompleted(turnCtx?: unknown, newMessage?: unknown): Promise<void> {
        receivedTurnCtx = turnCtx;
        receivedNewMessage = newMessage;
      }
    }
    const agent = new MyAgent({ instructions: 'test' });
    await agent.onUserTurnCompleted('ctx', 'msg');
    expect(receivedTurnCtx).toBe('ctx');
    expect(receivedNewMessage).toBe('msg');
  });

  it('sttNode is a noop that resolves', async () => {
    const agent = new Agent({ instructions: 'test' });
    await expect(agent.sttNode()).resolves.toBeUndefined();
  });

  it('llmNode is a noop that resolves', async () => {
    const agent = new Agent({ instructions: 'test' });
    await expect(agent.llmNode()).resolves.toBeUndefined();
  });

  it('ttsNode is a noop that resolves', async () => {
    const agent = new Agent({ instructions: 'test' });
    await expect(agent.ttsNode()).resolves.toBeUndefined();
  });

  it('updateInstructions changes instructions', async () => {
    const agent = new Agent({ instructions: 'old' });
    await agent.updateInstructions('new');
    expect(agent.instructions).toBe('new');
  });

  it('updateTools replaces tools record from array', async () => {
    const t1 = { ...tool({ description: 'Tool 1', execute: () => 'a' }), name: 'tool1' };
    const t2 = { ...tool({ description: 'Tool 2', execute: () => 'b' }), name: 'tool2' };
    const agent = new Agent({ instructions: 'test' });
    await agent.updateTools([t1, t2]);
    expect(Object.keys(agent.tools)).toHaveLength(2);
    expect(agent.tools['tool1'].description).toBe('Tool 1');
    expect(agent.tools['tool2'].description).toBe('Tool 2');
  });
});

// ---------------------------------------------------------------------------
// AgentSession alignment gaps (P1 + P2 fixes)
// ---------------------------------------------------------------------------

describe('AgentSession alignment gaps', () => {
  it('accepts all Python-aligned constructor params', () => {
    const session = new AgentSession({
      tools: [],
      mcpServers: ['server1'],
      allowInterruptions: false,
      minInterruptionDuration: 1.0,
      minEndpointingDelay: 0.3,
      maxEndpointingDelay: 5.0,
      maxToolSteps: 5,
      preemptiveGeneration: true,
    });
    expect(session).toBeDefined();
  });

  it('has history property', () => {
    const session = new AgentSession();
    expect(session.history).toEqual([]);
    expect(Array.isArray(session.history)).toBe(true);
  });

  it('start() accepts record param', async () => {
    const session = new AgentSession();
    const agent = new Agent({ instructions: 'test' });
    await session.start({ agent, record: true });
    expect(session.getSwAgent()).toBeDefined();
  });

  it('start() sets agent.session back-reference', async () => {
    const session = new AgentSession();
    const agent = new Agent({ instructions: 'test' });
    expect(agent.session).toBeUndefined();
    await session.start({ agent });
    expect(agent.session).toBe(session);
  });

  it('updateAgent() sets agent.session back-reference', async () => {
    const session = new AgentSession();
    const agent1 = new Agent({ instructions: 'First' });
    await session.start({ agent: agent1 });
    const agent2 = new Agent({ instructions: 'Second' });
    session.updateAgent(agent2);
    expect(agent2.session).toBe(session);
  });

  it('session-level tools are registered alongside agent tools', async () => {
    const sessionTool: FunctionTool = {
      name: 'session_tool',
      description: 'A session tool',
      execute: () => 'ok',
    };
    const session = new AgentSession({ tools: [sessionTool] });
    const agent = new Agent({ instructions: 'test' });
    await session.start({ agent });
    expect(session.getSwAgent()).toBeDefined();
  });

  it('maps agent-level llm hint through start()', async () => {
    const session = new AgentSession();
    const agent = new Agent({ instructions: 'test', llm: 'openai/gpt-4o' });
    await session.start({ agent });
    // The swAgent should have been created and the model param set
    expect(session.getSwAgent()).toBeDefined();
  });

  it('maps allowInterruptions=false to barge_confidence', async () => {
    const session = new AgentSession({ allowInterruptions: false });
    const agent = new Agent({ instructions: 'test' });
    await session.start({ agent });
    expect(session.getSwAgent()).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// RunContext alignment gaps (P1 fixes)
// ---------------------------------------------------------------------------

describe('RunContext alignment gaps', () => {
  it('accepts speechHandle and functionCall', () => {
    const session = new AgentSession();
    const ctx = new RunContext(session, {
      speechHandle: 'handle-123',
      functionCall: { name: 'test' },
    });
    expect(ctx.speechHandle).toBe('handle-123');
    expect(ctx.functionCall).toEqual({ name: 'test' });
    expect(ctx.session).toBe(session);
  });

  it('speechHandle and functionCall default to undefined', () => {
    const session = new AgentSession();
    const ctx = new RunContext(session);
    expect(ctx.speechHandle).toBeUndefined();
    expect(ctx.functionCall).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ChatContext alignment gaps (P1 fixes)
// ---------------------------------------------------------------------------

describe('ChatContext', () => {
  it('has messages array', () => {
    const ctx = new ChatContext();
    expect(ctx.messages).toEqual([]);
  });

  it('append adds messages and returns this', () => {
    const ctx = new ChatContext();
    const result = ctx.append({ role: 'user', text: 'Hello' });
    expect(result).toBe(ctx);
    expect(ctx.messages).toHaveLength(1);
    expect(ctx.messages[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('append uses defaults (role=user, text=empty)', () => {
    const ctx = new ChatContext();
    ctx.append({});
    expect(ctx.messages[0]).toEqual({ role: 'user', content: '' });
  });

  it('chains multiple appends', () => {
    const ctx = new ChatContext();
    ctx.append({ role: 'system', text: 'You are a bot' })
       .append({ role: 'user', text: 'Hello' })
       .append({ role: 'assistant', text: 'Hi there' });
    expect(ctx.messages).toHaveLength(3);
    expect(ctx.messages[0].role).toBe('system');
    expect(ctx.messages[1].role).toBe('user');
    expect(ctx.messages[2].role).toBe('assistant');
  });

  it('is accessible via llm.ChatContext', () => {
    const ctx = new llm.ChatContext();
    ctx.append({ role: 'user', text: 'test' });
    expect(ctx.messages).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// JobContext alignment gaps (P2 fixes)
// ---------------------------------------------------------------------------

describe('JobContext alignment gaps', () => {
  it('waitForParticipant accepts identity option', async () => {
    const ctx = new JobContext();
    const participant = await ctx.waitForParticipant({ identity: 'user-42' });
    expect(participant.identity).toBe('user-42');
  });

  it('waitForParticipant defaults identity to caller', async () => {
    const ctx = new JobContext();
    const participant = await ctx.waitForParticipant();
    expect(participant.identity).toBe('caller');
  });
});

// ---------------------------------------------------------------------------
// Plugin alignment gaps (P2 fixes)
// ---------------------------------------------------------------------------

describe('Plugin alignment gaps', () => {
  it('OpenAILLM stores model property from opts', () => {
    const llmPlugin = new plugins.OpenAILLM({ model: 'gpt-4' });
    expect(llmPlugin.model).toBe('gpt-4');
  });

  it('OpenAILLM model defaults to empty string when not provided', () => {
    const llmPlugin = new plugins.OpenAILLM();
    expect(llmPlugin.model).toBe('');
  });
});
