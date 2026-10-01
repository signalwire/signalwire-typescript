/**
 * swaig-test passes --custom-data to a DataMap tool as the call data the
 * platform adds, such as global_data. It passed none, so a DataMap tool that
 * read ${global_data.x} always got an empty value. Mirrors signalwire-python
 * tests/unit/cli/test_swaig_datamap_call_data.py (eefcd4d).
 */

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../src/cli/swaig-test.ts', import.meta.url));
const SDK = new URL('../../src/index.ts', import.meta.url).href;

let dir: string;
let agentPath: string;
let housePath: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'swaig-calldata-'));
  agentPath = join(dir, 'tenant-agent.mts');
  writeFileSync(
    agentPath,
    `import { AgentBase, DataMap, FunctionResult } from '${SDK}';
const agent = new AgentBase({ name: 'tenant', route: '/agent' });
agent.registerSwaigFunction(
  new DataMap('which_tenant')
    .description('Say which tenant this is')
    .parameter('topic', 'string', 'Anything')
    .expression('\${args.topic}', '.*', new FunctionResult('Tenant \${global_data.tenant} (\${time_of_day})'))
    .toSwaigFunction(),
);
export default agent;
`,
  );
  housePath = join(dir, 'house-agent.mts');
  writeFileSync(
    housePath,
    `import { AgentBase, DataMap, FunctionResult } from '${SDK}';
const agent = new AgentBase({ name: 'house', route: '/agent' });
agent.setGlobalData({ tenant: 'house', region: 'us' });
agent.registerSwaigFunction(
  new DataMap('which_tenant')
    .description('Say which tenant this is')
    .parameter('topic', 'string', 'Anything')
    .expression(
      '\${args.topic}',
      '.*',
      new FunctionResult('Tenant \${global_data.tenant} in \${meta_data.region}'),
    )
    .toSwaigFunction(),
);
export default agent;
`,
  );
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', CLI, ...args],
      { timeout: 60_000, env: { ...process.env, SIGNALWIRE_LOG_MODE: 'off' } },
      (err, stdout, stderr) => {
        const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

describe('swaig-test --custom-data with a DataMap tool', () => {
  it('reaches the tool as call data, prompt_vars merged into the root', async () => {
    const { code, stdout } = await runCli([
      agentPath,
      '--custom-data',
      '{"global_data": {"tenant": "acme"}, "prompt_vars": {"time_of_day": "morning"}}',
      '--exec',
      'which_tenant',
      '--topic',
      'hours',
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain('Response: Tenant acme (morning)');
  }, 70_000);

  it('leaves the value empty without it, and says so on stderr', async () => {
    const { code, stdout, stderr } = await runCli([
      agentPath,
      '--exec',
      'which_tenant',
      '--topic',
      'hours',
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain('Response: Tenant  ()');
    expect(stderr).toContain('${global_data.tenant}');
  }, 70_000);

  // On a call, global_data starts as the agent's, and a function's meta_data
  // is merged over it. Mirrors signalwire-python 71dbba8.
  it("uses the agent's global data when --custom-data has no global_data", async () => {
    const own = await runCli([housePath, '--exec', 'which_tenant', '--topic', 'hours']);
    expect(own.code).toBe(0);
    expect(own.stdout).toContain('Response: Tenant house in us');

    const given = await runCli([
      housePath,
      '--custom-data',
      '{"global_data": {"tenant": "acme", "region": "eu"}}',
      '--exec',
      'which_tenant',
      '--topic',
      'hours',
    ]);
    expect(given.code).toBe(0);
    expect(given.stdout).toContain('Response: Tenant acme in eu');
  }, 140_000);
});
