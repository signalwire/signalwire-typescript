/**
 * On a serverless platform the SWML's webhook URLs point at the URL the
 * platform serves the function on, as the reference's get_full_url builds it
 * from the platform's environment; with Azure and Google Cloud Functions, from
 * the URL the request arrived on. They used to be http://localhost:3000.
 */

import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { ServerlessAdapter } from '../src/ServerlessAdapter.js';

const PLATFORM_VARS = [
  'GATEWAY_INTERFACE',
  'HTTPS',
  'HTTP_HOST',
  'SERVER_NAME',
  'SCRIPT_NAME',
  'AWS_LAMBDA_FUNCTION_NAME',
  'AWS_LAMBDA_FUNCTION_URL',
  'AWS_REGION',
  'LAMBDA_TASK_ROOT',
  'FUNCTION_TARGET',
  'K_SERVICE',
  'GOOGLE_CLOUD_PROJECT',
  'GCP_PROJECT',
  'GOOGLE_CLOUD_REGION',
  'FUNCTION_REGION',
  'FUNCTION_URL',
  'AZURE_FUNCTIONS_ENVIRONMENT',
  'FUNCTIONS_WORKER_RUNTIME',
  'WEBSITE_SITE_NAME',
  'AZURE_FUNCTIONS_APP_NAME',
  'AZURE_FUNCTION_NAME',
  'AZURE_FUNCTION_URL',
  'SWML_PROXY_URL_BASE',
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of PLATFORM_VARS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of PLATFORM_VARS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const agentAt = (route: string) => new AgentBase({ name: 'a', route, basicAuth: ['u', 'p'] });

describe('getFullUrl on a serverless platform', () => {
  it.each([
    [
      'a Lambda function URL',
      {
        AWS_LAMBDA_FUNCTION_NAME: 'fn',
        AWS_LAMBDA_FUNCTION_URL: 'https://abc.lambda-url.us-east-1.on.aws/',
      },
      'https://abc.lambda-url.us-east-1.on.aws/agent',
    ],
    [
      'a Lambda function without a URL',
      { AWS_LAMBDA_FUNCTION_NAME: 'fn', AWS_REGION: 'eu-west-1' },
      'https://fn.lambda-url.eu-west-1.on.aws/agent',
    ],
    [
      'CGI',
      {
        GATEWAY_INTERFACE: 'CGI/1.1',
        HTTPS: 'on',
        HTTP_HOST: 'example.com',
        SCRIPT_NAME: '/cgi-bin/agent.cgi',
      },
      'https://example.com/cgi-bin/agent.cgi/agent',
    ],
    [
      'a Google Cloud Function',
      {
        K_SERVICE: 'agent-svc',
        FUNCTION_TARGET: 'handler',
        GOOGLE_CLOUD_PROJECT: 'proj',
        GOOGLE_CLOUD_REGION: 'europe-west1',
      },
      'https://europe-west1-proj.cloudfunctions.net/agent-svc/agent',
    ],
    [
      'a Google Cloud Function with FUNCTION_URL',
      { K_SERVICE: 'agent-svc', FUNCTION_URL: 'https://custom.example.com/fn' },
      'https://custom.example.com/fn/agent',
    ],
    [
      'an Azure Function',
      {
        FUNCTIONS_WORKER_RUNTIME: 'node',
        WEBSITE_SITE_NAME: 'my-app',
        AZURE_FUNCTION_NAME: 'voice',
      },
      'https://my-app.azurewebsites.net/api/voice/agent',
    ],
  ])('builds the URL for %s', (_label, env, url) => {
    Object.assign(process.env, env);
    expect(agentAt('/agent').getFullUrl()).toBe(url);
  });

  it('includes the credentials when asked', () => {
    process.env['AWS_LAMBDA_FUNCTION_NAME'] = 'fn';
    process.env['AWS_LAMBDA_FUNCTION_URL'] = 'https://abc.lambda-url.us-east-1.on.aws';
    expect(agentAt('/').getFullUrl(true)).toBe('https://u:p@abc.lambda-url.us-east-1.on.aws');
  });

  it('prefers SWML_PROXY_URL_BASE', () => {
    process.env['AWS_LAMBDA_FUNCTION_NAME'] = 'fn';
    process.env['SWML_PROXY_URL_BASE'] = 'https://proxy.example.com';
    expect(agentAt('/agent').getFullUrl()).toBe('https://proxy.example.com/agent');
  });

  it('keeps host and port in server mode', () => {
    expect(agentAt('/agent').getFullUrl()).toBe('http://localhost:3000/agent');
  });
});

describe('webhook URLs from the request a serverless adapter handles', () => {
  const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');

  function toolAgent(): AgentBase {
    const agent = agentAt('/');
    agent.setPromptText('hi');
    agent.defineTool({
      name: 'lookup',
      description: 'look up',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });
    return agent;
  }

  const webhookUrl = (body: string) => {
    const doc = JSON.parse(body) as { sections: { main: Record<string, unknown>[] } };
    const ai = doc.sections.main.find((v) => 'ai' in v)!['ai'] as {
      SWAIG: { functions: { web_hook_url: string }[] };
    };
    return ai.SWAIG.functions[0]!.web_hook_url;
  };

  it("points an Azure Function's SWML at /api/<function>", async () => {
    process.env['FUNCTIONS_WORKER_RUNTIME'] = 'node';
    const handler = ServerlessAdapter.createAzureHandler(toolAgent().getApp());
    const context: { res?: { status: number; body: string } } = {};
    await handler(context as never, {
      method: 'GET',
      url: 'https://my-app.azurewebsites.net/api/voice?call_id=c1',
      headers: { authorization: AUTH },
    });
    expect(context.res!.status).toBe(200);
    expect(webhookUrl(context.res!.body)).toMatch(
      /^https:\/\/u:p@my-app\.azurewebsites\.net\/api\/voice\/swaig\?/,
    );
  });

  it("points a Google Cloud Function's SWML at the host it was called on", async () => {
    process.env['K_SERVICE'] = 'voice';
    const handler = ServerlessAdapter.createGcfHandler(toolAgent().getApp());
    let body = '';
    await handler(
      {
        method: 'GET',
        path: '/',
        originalUrl: '/?call_id=c1',
        headers: { authorization: AUTH, host: 'region-proj.cloudfunctions.net' },
      },
      { status: () => undefined, set: () => undefined, send: (b: string) => void (body = b) },
    );
    expect(webhookUrl(body)).toMatch(
      /^https:\/\/u:p@region-proj\.cloudfunctions\.net\/voice\/swaig\?/,
    );
  });

  it('keeps a configured FUNCTION_URL, path and all, across requests (found in review)', async () => {
    process.env['K_SERVICE'] = 'voice';
    process.env['FUNCTION_TARGET'] = 'handler';
    process.env['FUNCTION_URL'] = 'https://region-proj.cloudfunctions.net/voice';
    const handler = ServerlessAdapter.createGcfHandler(toolAgent().getApp());
    let body = '';
    await handler(
      {
        method: 'GET',
        path: '/',
        originalUrl: '/?call_id=c1',
        headers: { authorization: AUTH, host: 'region-proj.cloudfunctions.net' },
      },
      { status: () => undefined, set: () => undefined, send: (b: string) => void (body = b) },
    );
    expect(webhookUrl(body)).toMatch(
      /^https:\/\/u:p@region-proj\.cloudfunctions\.net\/voice\/swaig\?/,
    );
  });
});

describe('server mode where serverless variables are set (found in review)', () => {
  it('keeps host and port on Cloud Run, which sets K_SERVICE but not FUNCTION_TARGET', () => {
    process.env['K_SERVICE'] = 'cloud-run-service';
    process.env['GOOGLE_CLOUD_PROJECT'] = 'proj';
    expect(agentAt('/agent').getFullUrl()).toBe('http://localhost:3000/agent');
  });
});
