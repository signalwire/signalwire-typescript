import { describe, it, expect, beforeEach } from 'vitest';
import {
  Agent,
  AgentSession,
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
      tools: { get_weather: { ...myTool, name: 'get_weather' } },
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
      tools: { get_weather: { ...weatherTool, name: 'get_weather' } },
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

  it('llm namespace has tool, handoff, ToolError', () => {
    expect(llm.tool).toBe(tool);
    expect(llm.handoff).toBe(handoff);
    expect(llm.ToolError).toBeDefined();
  });

  it('cli namespace has runApp', () => {
    expect(cli.runApp).toBeTypeOf('function');
  });
});
