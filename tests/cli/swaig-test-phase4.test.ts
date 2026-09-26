/**
 * swaig-test runs requests through the agent's own HTTP app, as SignalWire
 * would, with the reference's options: Python-style function arguments,
 * call data flags on every action, DataMap and external webhooks, a file's
 * unexported agent, --route selection, and serverless simulation. Mirrors
 * signalwire-python's swaig-test (d91d1fa, 64f309e, 9806a61, f621d77,
 * 6e63773) and the TS issue #188.
 */

import { execFile } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../src/cli/swaig-test.ts', import.meta.url));
const SDK = new URL('../../src/index.ts', import.meta.url).href;

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'swaig-p4-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
/** Write an agent file whose body can use everything the SDK exports. */
function agentFile(body: string): string {
  const path = join(dir, `agent${++n}.mts`);
  writeFileSync(
    path,
    `import * as sw from '${SDK}';\nconst { AgentBase, FunctionResult, DataMap, AgentServer } = sw;\n${body}\n`,
  );
  return path;
}

function runCli(
  args: string[],
  env: Record<string, string> = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', CLI, ...args],
      { timeout: 60_000, env: { ...process.env, SIGNALWIRE_LOG_MODE: 'off', ...env } },
      (err, stdout, stderr) => {
        const code = err ? ((err as { code?: number }).code ?? 1) : 0;
        resolve({ code: typeof code === 'number' ? code : 1, stdout, stderr });
      },
    );
  });
}

const TOOLS = `
const agent = new AgentBase({ name: 'probe', route: '/agent' });
agent.setPromptText('hi');
agent.defineTool({
  name: 'count_things',
  description: 'Count things',
  parameters: {
    count: { type: 'integer', description: 'How many' },
    fast: { type: 'boolean', description: 'Hurry' },
    tags: { type: 'array', description: 'Tags', items: { type: 'string' } },
  },
  handler: (args, raw) =>
    new FunctionResult(JSON.stringify({ args, state: raw.call?.state, callId: raw.call_id })),
});
`;

describe('--exec', () => {
  it("finds an agent the file doesn't export, and calls a secure tool with its token", async () => {
    const path = agentFile(`${TOOLS}\nagent.run();`);
    const { code, stdout } = await runCli([path, '--exec', 'count_things', '--count', '3']);
    expect(code).toBe(0);
    expect(stdout).toContain('RESULT:');
    expect(stdout).toContain('"count":3');
  }, 70_000);

  it('types the arguments by the function schema', async () => {
    const path = agentFile(`${TOOLS}\nexport default agent;`);
    const { stdout } = await runCli([
      path,
      '--raw',
      '--exec',
      'count_things',
      '--count',
      '7',
      '--fast',
      '--tags',
      'a, b',
    ]);
    const result = JSON.parse(stdout) as { response: string };
    expect(JSON.parse(result.response).args).toEqual({ count: 7, fast: true, tags: ['a', 'b'] });
  }, 70_000);

  it('refuses a value that is not the declared type', async () => {
    const path = agentFile(`${TOOLS}\nexport default agent;`);
    const { code, stdout } = await runCli([path, '--exec', 'count_things', '--count', 'many']);
    expect(code).toBe(1);
    expect(stdout).toContain('must be an integer');
  }, 70_000);

  it('passes --call-state and --call-id to the function (#188)', async () => {
    const path = agentFile(`${TOOLS}\nexport default agent;`);
    const { stdout } = await runCli([
      path,
      '--raw',
      '--call-state',
      'answered',
      '--call-id',
      'root.2',
      '--exec',
      'count_things',
    ]);
    const payload = JSON.parse((JSON.parse(stdout) as { response: string }).response);
    expect(payload.state).toBe('answered');
    expect(payload.callId).toBe('root.2');
  }, 70_000);

  it('warns about an --override key the request does not have (#188)', async () => {
    const path = agentFile(`${TOOLS}\nexport default agent;`);
    const { stderr } = await runCli([path, '--override', 'call.stat=x', '--exec', 'count_things']);
    expect(stderr).toContain("--override call.stat adds a key the simulated request doesn't have");
  }, 70_000);

  it('warns about an argument the function does not declare, naming a misplaced option', async () => {
    const path = agentFile(`${TOOLS}\nexport default agent;`);
    const { code, stderr } = await runCli([
      path,
      '--exec',
      'count_things',
      '--minimal',
      'x',
      '--color',
      'red',
    ]);
    expect(code).toBe(0);
    expect(stderr).toContain('put it before --exec');
    expect(stderr).toContain("--color isn't a parameter of this function");
  }, 70_000);

  it('runs a tool the per-call config registers, with the query parameters it reads', async () => {
    const path = agentFile(`
const agent = new AgentBase({ name: 'dyn', route: '/' });
agent.setPromptText('hi');
agent.setDynamicConfigCallback((query, _body, _headers, copy) => {
  // As on the platform, the function call gets the query its web_hook_url
  // carries, so the callback puts the tenant there.
  if (query.tenant) copy.addSwaigQueryParams({ tenant: query.tenant });
  copy.defineTool({
    name: 'tenant_tool',
    description: 'per tenant',
    parameters: {},
    handler: () => new FunctionResult('tenant=' + query.tenant),
  });
});
export default agent;`);
    const { code, stdout } = await runCli([
      path,
      '--query-params',
      '{"tenant":"acme"}',
      '--exec',
      'tenant_tool',
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain('Response: tenant=acme');
  }, 70_000);

  it('signs its requests when the agent checks signatures', async () => {
    const path = agentFile(`${TOOLS}\nexport default agent;`);
    const { code, stdout } = await runCli([path, '--exec', 'count_things'], {
      SIGNALWIRE_SIGNING_KEY: 'test-signing-key',
    });
    expect(code).toBe(0);
    expect(stdout).toContain('RESULT:');
  }, 70_000);

  it('runs a DataMap function in the simulator, falling back when the webhook is refused', async () => {
    const path = agentFile(`
const agent = new AgentBase({ name: 'dm', route: '/' });
agent.setPromptText('hi');
agent.registerSwaigFunction(
  new DataMap('lookup')
    .description('Look up a city')
    .parameter('city', 'string', 'The city', { required: true })
    .webhook('GET', 'http://127.0.0.1:9/w?q=\${lc:enc:args.city}')
    .output(new FunctionResult('Found \${name}'))
    .fallbackOutput(new FunctionResult('No lookup for \${args.city}'))
    .toSwaigFunction(),
);
export default agent;`);
    const { code, stdout } = await runCli([path, '--exec', 'lookup', '--city', 'Paris']);
    expect(code).toBe(0);
    expect(stdout).toContain('Response: No lookup for Paris');
  }, 70_000);

  it('posts an external webhook function to its URL', async () => {
    const seen: unknown[] = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen.push(JSON.parse(body));
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ response: 'external ok' }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    try {
      const path = agentFile(`
const agent = new AgentBase({ name: 'ext', route: '/' });
agent.setPromptText('hi');
agent.defineTool({
  name: 'remote',
  description: 'Remote tool',
  parameters: { q: { type: 'string', description: 'query' } },
  webhookUrl: 'http://127.0.0.1:${port}/hook',
  handler: () => new FunctionResult('never local'),
});
export default agent;`);
      const { code, stdout } = await runCli([path, '--exec', 'remote', '--q', 'hi']);
      expect(code).toBe(0);
      expect(stdout).toContain('Response: external ok');
      expect(seen[0]).toMatchObject({ function: 'remote', argument: { parsed: [{ q: 'hi' }] } });
    } finally {
      server.close();
    }
  }, 70_000);
});

describe('--list-tools and --list-agents', () => {
  it('lists DataMap functions with their parameters, and local ones as LOCAL webhook', async () => {
    const path = agentFile(`${TOOLS}
agent.registerSwaigFunction(
  new DataMap('lookup')
    .description('Look up a city')
    .parameter('city', 'string', 'The city', { required: true })
    .webhook('GET', 'https://api.example.com/cities')
    .output(new FunctionResult('ok'))
    .toSwaigFunction(),
);
export default agent;`);
    const { stdout } = await runCli([path, '--list-tools']);
    expect(stdout).toContain('count_things - Count things (LOCAL webhook)');
    expect(stdout).toContain('count (integer): How many');
    expect(stdout).toContain('lookup - Look up a city');
    expect(stdout).toContain('city (string) (required): The city');
  }, 70_000);

  it('lists and selects services by route in a multi-agent file', async () => {
    const path = agentFile(`
const sales = new AgentBase({ name: 'sales', route: '/sales' });
sales.setPromptText('s');
sales.defineTool({ name: 'quote', description: 'Quote', parameters: {}, handler: () => new FunctionResult('q') });
const support = new AgentBase({ name: 'support', route: '/support' });
support.setPromptText('t');
support.defineTool({ name: 'ticket', description: 'Ticket', parameters: {}, handler: () => new FunctionResult('t') });
const server = new AgentServer();
server.register(sales);
server.register(support);
server.run();`);
    const agents = await runCli([path, '--list-agents']);
    expect(agents.stdout).toContain('Route: /support');
    const picked = await runCli([path, '--route', '/support', '--list-tools']);
    expect(picked.stdout).toContain('ticket - Ticket');
    expect(picked.stdout).not.toContain('quote');
    const none = await runCli([path, '--list-tools']);
    expect(none.code).toBe(1);
    expect(none.stderr).toContain('Available routes: /sales, /support');
    const wrong = await runCli([path, '--route', '/nope', '--list-tools']);
    expect(wrong.stderr).toContain("No service found with route '/nope'");
  }, 120_000);

  it('refuses --route with --agent-class', async () => {
    const { code, stderr } = await runCli([
      'x.ts',
      '--route',
      '/a',
      '--agent-class',
      'A',
      '--list-tools',
    ]);
    expect(code).toBe(2);
    expect(stderr).toContain('Cannot specify both --route and --agent-class');
  }, 70_000);
});

describe('--dump-swml', () => {
  it('runs the per-call callback once', async () => {
    const path = agentFile(`
const agent = new AgentBase({ name: 'once', route: '/' });
agent.setPromptText('hi');
agent.setDynamicConfigCallback((_q, _b, _h, copy) => { copy.addHint('from-callback'); });
export default agent;`);
    const { stdout } = await runCli([path, '--dump-swml', '--raw']);
    const doc = JSON.parse(stdout) as {
      sections: { main: Record<string, { hints?: string[] }>[] };
    };
    const ai = doc.sections.main.find((v) => 'ai' in v)!['ai']!;
    expect(ai.hints!.filter((h) => h === 'from-callback')).toHaveLength(1);
  }, 70_000);

  it('uses a Lambda API Gateway URL under --simulate-serverless lambda', async () => {
    const path = agentFile(`${TOOLS}\nexport default agent;`);
    const { stdout } = await runCli([
      path,
      '--simulate-serverless',
      'lambda',
      '--aws-api-gateway-id',
      'abc123',
      '--aws-region',
      'eu-west-1',
      '--dump-swml',
      '--raw',
    ]);
    expect(stdout).toContain('abc123.execute-api.eu-west-1.amazonaws.com/prod/agent/swaig');
  }, 70_000);

  it('requires --cgi-host to simulate CGI', async () => {
    const { code, stderr } = await runCli(['x.ts', '--simulate-serverless', 'cgi', '--dump-swml']);
    expect(code).toBe(2);
    expect(stderr).toContain('--cgi-host is required');
  }, 70_000);
});

describe('help', () => {
  it('documents the actions and the platform and example pages', async () => {
    const help = (await runCli(['--help'])).stdout;
    for (const verb of ['--list-tools', '--dump-swml', '--exec', '--raw', '--verbose']) {
      expect(help).toContain(verb);
    }
    expect((await runCli(['--help-platforms'])).stdout).toContain('--aws-api-gateway-id');
    expect((await runCli(['--help-examples'])).stdout).toContain('--exec get_weather --city');
  }, 70_000);

  it('parses a Python-style --exec invocation under --parse-only', async () => {
    const { code, stdout } = await runCli([
      'agent.ts',
      '--exec',
      'get_weather',
      '--city',
      'San Francisco',
      '--parse-only',
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain('parse OK');
  }, 70_000);
});
