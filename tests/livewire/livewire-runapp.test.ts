/**
 * runApp() end to end: the session the entry function starts is served over
 * HTTP, and nothing is served under SWAIG_CLI_MODE.
 */
import { createServer, type Server } from 'node:net';
import { AgentBase } from '../../src/AgentBase.js';
import {
  Agent,
  AgentServer,
  AgentSession,
  defineAgent,
  runApp,
  tool,
  type JobContext,
} from '../../src/livewire/index.js';

// Keep a handle on every server @hono/node-server starts, so each test can
// close what it opened. (AgentBase.serve() doesn't keep one for stop().)
const servers = vi.hoisted(() => [] as Array<{ close: () => void }>);
vi.mock('@hono/node-server', async (importOriginal) => {
  const real = await importOriginal<typeof import('@hono/node-server')>();
  return {
    ...real,
    serve: (...args: Parameters<typeof real.serve>) => {
      const server = real.serve(...args);
      servers.push(server);
      return server;
    },
  };
});

/** A port nothing is listening on. */
async function freePort(): Promise<number> {
  const srv: Server = createServer();
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address() as { port: number };
  await new Promise<void>((r) => srv.close(() => r()));
  return port;
}

const AUTH = `Basic ${Buffer.from('lw_user:lw_pass').toString('base64')}`;

/** POST / until the server answers, or give up after `ms`. */
async function fetchSwmlWhenUp(port: number, ms = 3000): Promise<Response> {
  const deadline = Date.now() + ms;
  for (;;) {
    try {
      return await fetch(`http://127.0.0.1:${port}/`, {
        method: 'POST',
        headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch (err) {
      if (Date.now() > deadline) throw err;
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

/** Let runApp's entry promise chain settle. */
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('runApp()', () => {
  const saved = { ...process.env };
  let port: number;

  beforeEach(async () => {
    port = await freePort();
    process.env['PORT'] = String(port);
    process.env['SWML_BASIC_AUTH_USER'] = 'lw_user';
    process.env['SWML_BASIC_AUTH_PASSWORD'] = 'lw_pass';
    delete process.env['SWAIG_CLI_MODE'];
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    for (const s of servers.splice(0)) s.close();
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  const weather = tool({
    description: 'Get weather',
    execute: () => 'sunny',
  });

  it('serves the agent of the session the entry function starts', async () => {
    runApp(
      defineAgent({
        entry: async (ctx: JobContext) => {
          await ctx.connect();
          const session = new AgentSession({ llm: 'openai/gpt-4o' });
          await session.start({
            agent: new Agent({ instructions: 'You help with weather.', tools: { weather } }),
          });
        },
      }),
    );

    const res = await fetchSwmlWhenUp(port);
    expect(res.status).toBe(200);
    const body = JSON.stringify(await res.json());
    expect(body).toContain('You help with weather.');
    expect(body).toContain('"model":"gpt-4o"');
    expect(body).toContain('"function":"weather"');
    expect(servers).toHaveLength(1);
  });

  it('serves an AgentServer entry function too', async () => {
    const server = new AgentServer();
    server.rtcSession(async () => {
      await new AgentSession().start({ agent: new Agent({ instructions: 'From rtcSession.' }) });
    });
    runApp(server);

    const res = await fetchSwmlWhenUp(port);
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).toContain('From rtcSession.');
  });

  it('serves nothing when SWAIG_CLI_MODE is set as runApp is called', async () => {
    const serve = vi.spyOn(AgentBase.prototype, 'serve');
    process.env['SWAIG_CLI_MODE'] = 'true';
    runApp(async () => {
      await new AgentSession().start({ agent: new Agent({ instructions: 'x' }) });
    });
    // swaig-test restores the variable once the import returns, before the
    // entry function's session has been built.
    delete process.env['SWAIG_CLI_MODE'];
    await settle();
    expect(servers).toHaveLength(0);
    expect(serve).not.toHaveBeenCalled();
  });

  it('reports on stderr when the entry function starts no session', async () => {
    runApp(async () => {});
    await settle();
    expect(servers).toHaveLength(0);
    const out = vi
      .mocked(process.stderr.write)
      .mock.calls.map((c) => String(c[0]))
      .join('');
    expect(out).toContain('no agent was started');
  });

  it('a session started outside runApp is not served', async () => {
    await new AgentSession().start({ agent: new Agent({ instructions: 'x' }) });
    await settle();
    expect(servers).toHaveLength(0);
  });
});
