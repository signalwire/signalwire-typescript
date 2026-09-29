/**
 * swaig-test's serverless simulation builds the function URL from the parts
 * the user gives, by flag, --env or --env-file. The preset's function URL
 * wins over the parts in the SDK, so it is left out when the user gives a
 * part without the URL. Mirrors signalwire-python
 * tests/unit/cli/test_swaig_serverless_urls.py (c38d439, 2d7fca8).
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
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'swaig-urls-'));
  agentPath = join(dir, 'url-agent.mts');
  writeFileSync(
    agentPath,
    `import { AgentBase, FunctionResult } from '${SDK}';
const agent = new AgentBase({ name: 'urls', route: '/agent' });
agent.setPromptText('hi');
agent.defineTool({ name: 'ping', description: 'Ping', parameters: {}, handler: () => new FunctionResult('pong') });
export default agent;
`,
  );
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** The SWML's function webhook URL, without its credentials or query, under a simulated platform. */
function webhookUrl(platform: string, extra: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [
        '--import',
        'tsx',
        CLI,
        agentPath,
        '--simulate-serverless',
        platform,
        ...extra,
        '--dump-swml',
        '--raw',
      ],
      { timeout: 60_000, env: { ...process.env, SIGNALWIRE_LOG_MODE: 'off' } },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`${err.message}\n${stderr}`));
          return;
        }
        const match = /"web_hook_url":\s*"([^"]+)"/.exec(stdout);
        if (!match) {
          reject(new Error(`no web_hook_url in ${stdout}`));
          return;
        }
        resolve(match[1]!.replace(/\/\/[^/@]*@/, '//').replace(/\?.*$/, ''));
      },
    );
  });
}

describe('a serverless URL part given by --env or --env-file', () => {
  it('builds the Lambda URL from --env AWS_REGION over the preset URL', async () => {
    expect(await webhookUrl('lambda', ['--env', 'AWS_REGION=eu-west-1'])).toBe(
      'https://test-agent-function.lambda-url.eu-west-1.on.aws/agent/swaig',
    );
  }, 70_000);

  it('builds the Lambda URL from AWS_LAMBDA_FUNCTION_NAME in --env-file', async () => {
    const envFile = join(dir, 'lambda.env');
    writeFileSync(envFile, 'AWS_LAMBDA_FUNCTION_NAME=prod-agent\n');
    expect(await webhookUrl('lambda', ['--env-file', envFile])).toBe(
      'https://prod-agent.lambda-url.us-east-1.on.aws/agent/swaig',
    );
  }, 70_000);

  it('builds the Cloud Functions URL from --env GOOGLE_CLOUD_PROJECT over the preset URL', async () => {
    expect(await webhookUrl('gcf', ['--env', 'GOOGLE_CLOUD_PROJECT=production'])).toBe(
      'https://us-central1-production.cloudfunctions.net/agent/swaig',
    );
  }, 70_000);

  it('keeps a function URL given with --env', async () => {
    expect(
      await webhookUrl('lambda', [
        '--env',
        'AWS_REGION=eu-west-1',
        '--env',
        'AWS_LAMBDA_FUNCTION_URL=https://xyz.lambda-url.eu-west-1.on.aws/',
      ]),
    ).toBe('https://xyz.lambda-url.eu-west-1.on.aws/agent/swaig');
  }, 70_000);
});
