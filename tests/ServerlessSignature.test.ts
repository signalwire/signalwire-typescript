/**
 * Serverless webhook signatures are checked against the URL SignalWire
 * signed: the URL the platform was called on, with its stage or script prefix
 * and its query, and the raw body.
 *
 * Mirrors signalwire-python d59895f and eba9ff4 (serverless signature URL
 * reconstruction). Before, the adapter checked the routing URL it built
 * itself, so a signed request failed with 403 behind an API Gateway stage, a
 * CGI script path, an Azure function app, a GCF query string or a re-serialized
 * body, and API Gateway REST lost its Host header to a case-sensitive lookup.
 */

import { createHmac } from 'node:crypto';
import { AgentBase } from '../src/AgentBase.js';
import { ServerlessAdapter } from '../src/ServerlessAdapter.js';

const KEY = 'PSKtest1234567890abcdef';
const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');
// Whitespace a JSON re-serialization would drop, so only the raw body verifies.
const BODY = '{ "call_id": "c1" }';

const sign = (url: string, body = BODY) =>
  createHmac('sha1', KEY)
    .update(url + body, 'utf8')
    .digest('hex');

function makeAgent(opts: { trustProxy?: boolean } = {}): AgentBase {
  const agent = new AgentBase({
    name: 'serverless-sig',
    route: '/',
    basicAuth: ['u', 'p'],
    signingKey: KEY,
    ...(opts.trustProxy ? { webhookTrustProxy: true } : {}),
  });
  agent.setPromptText('serverless signature test');
  return agent;
}

afterEach(() => {
  delete process.env['SWML_PROXY_URL_BASE'];
});

describe('AWS API Gateway REST (v1) with a stage', () => {
  const domain = 'abc123.execute-api.us-east-1.amazonaws.com';
  const event = (signature: string) => ({
    httpMethod: 'POST',
    path: '/',
    headers: {
      Host: domain,
      Authorization: AUTH,
      'Content-Type': 'application/json',
      'X-SignalWire-Signature': signature,
    },
    queryStringParameters: { tenant: 'a b' },
    requestContext: { domainName: domain, path: '/prod/', stage: 'prod' },
    body: BODY,
  });

  it('accepts a signature over the staged URL with a "+" query', async () => {
    const res = await makeAgent().runServerless(
      event(sign(`https://${domain}/prod/?tenant=a+b`)),
      undefined,
      'lambda',
    );
    expect(res.statusCode).toBe(200);
  });

  it('accepts a signature over the staged URL with a "%20" query', async () => {
    const res = await makeAgent().runServerless(
      event(sign(`https://${domain}/prod/?tenant=a%20b`)),
      undefined,
      'lambda',
    );
    expect(res.statusCode).toBe(200);
  });

  it('refuses a signature over another path, and an unsigned request', async () => {
    const other = await makeAgent().runServerless(
      event(sign(`https://${domain}/prod/other?tenant=a+b`)),
      undefined,
      'lambda',
    );
    expect(other.statusCode).toBe(403);
    const unsigned = await makeAgent().runServerless(event(''), undefined, 'lambda');
    expect(unsigned.statusCode).toBe(403);
  });

  it('joins SWML_PROXY_URL_BASE with the path below the stage', async () => {
    process.env['SWML_PROXY_URL_BASE'] = 'https://proxy.example.com';
    const res = await makeAgent().runServerless(
      event(sign('https://proxy.example.com/?tenant=a+b')),
      undefined,
      'lambda',
    );
    expect(res.statusCode).toBe(200);
  });
});

describe('AWS HTTP API (v2) and function URLs', () => {
  it('accepts a signature over the raw query string', async () => {
    const domain = 'xyz.execute-api.us-east-1.amazonaws.com';
    const url = `https://${domain}/?tenant=a%20b`;
    const res = await makeAgent().runServerless(
      {
        rawPath: '/',
        rawQueryString: 'tenant=a%20b',
        headers: {
          host: domain,
          authorization: AUTH,
          'content-type': 'application/json',
          'x-signalwire-signature': sign(url),
        },
        requestContext: { domainName: domain, stage: '$default', http: { method: 'POST' } },
        body: BODY,
      },
      undefined,
      'lambda',
    );
    expect(res.statusCode).toBe(200);
  });
});

describe('Google Cloud Functions', () => {
  it('accepts a signature over the URL with its query and the raw body', async () => {
    const host = 'us-central1-proj.cloudfunctions.net';
    let status = 0;
    const handler = ServerlessAdapter.createGcfHandler(makeAgent().getApp());
    await handler(
      {
        method: 'POST',
        headers: {
          host,
          authorization: AUTH,
          'content-type': 'application/json',
          'x-signalwire-signature': sign(`https://${host}/?tenant=x`),
        },
        url: '/?tenant=x',
        path: '/',
        rawBody: Buffer.from(BODY),
        body: JSON.parse(BODY) as Record<string, unknown>,
      },
      {
        status: (code: number) => {
          status = code;
        },
        set: () => undefined,
        send: () => undefined,
      },
    );
    expect(status).toBe(200);
  });
});

describe('Google Cloud Functions on cloudfunctions.net (found in review)', () => {
  afterEach(() => {
    delete process.env['K_SERVICE'];
  });

  it("accepts a signature over the URL with the function's name, which the platform strips", async () => {
    // SignalWire calls the webhook URL the SWML gave it, which includes the
    // function's name; the request reaches the function without it.
    process.env['K_SERVICE'] = 'voice';
    const host = 'us-central1-proj.cloudfunctions.net';
    let status = 0;
    const handler = ServerlessAdapter.createGcfHandler(makeAgent().getApp());
    await handler(
      {
        method: 'POST',
        headers: {
          host,
          authorization: AUTH,
          'content-type': 'application/json',
          'x-signalwire-signature': sign(`https://${host}/voice/?tenant=x`),
        },
        url: '/?tenant=x',
        path: '/',
        rawBody: Buffer.from(BODY),
        body: JSON.parse(BODY) as Record<string, unknown>,
      },
      {
        status: (code: number) => void (status = code),
        set: () => undefined,
        send: () => undefined,
      },
    );
    expect(status).toBe(200);
  });

  it('refuses a signature over another URL on the same host (found in review)', async () => {
    // Signed for https://<host>/ (another function's root, or the stripped
    // path): not the URL SignalWire called this function on.
    process.env['K_SERVICE'] = 'voice';
    const host = 'us-central1-proj.cloudfunctions.net';
    for (const signedUrl of [`https://${host}/?tenant=x`, `https://${host}/other/?tenant=x`]) {
      let status = 0;
      const handler = ServerlessAdapter.createGcfHandler(makeAgent().getApp());
      await handler(
        {
          method: 'POST',
          headers: {
            host,
            authorization: AUTH,
            'content-type': 'application/json',
            'x-signalwire-signature': sign(signedUrl),
          },
          url: '/?tenant=x',
          path: '/',
          rawBody: Buffer.from(BODY),
          body: JSON.parse(BODY) as Record<string, unknown>,
        },
        {
          status: (code: number) => void (status = code),
          set: () => undefined,
          send: () => undefined,
        },
      );
      expect(status, signedUrl).toBe(403);
    }
  });
});

describe('Azure Functions', () => {
  it('routes below /api/<function> and checks the full URL it was called on', async () => {
    const url = 'https://app.azurewebsites.net/api/agent/?code=abc';
    const context: { res?: { status: number; headers: Record<string, string>; body: string } } = {};
    const handler = ServerlessAdapter.createAzureHandler(makeAgent().getApp());
    await handler(context, {
      method: 'POST',
      url,
      headers: {
        authorization: AUTH,
        'content-type': 'application/json',
        'x-signalwire-signature': sign(url),
      },
      rawBody: BODY,
    });
    expect(context.res?.status).toBe(200);
    expect(JSON.parse(context.res!.body).sections).toBeDefined();
  });
});

describe('CGI', () => {
  const cgiEnv = (signature: string, extra: Record<string, string> = {}) => ({
    REQUEST_METHOD: 'POST',
    SCRIPT_NAME: '/cgi-bin/agent.cgi',
    PATH_INFO: '/',
    QUERY_STRING: '',
    HTTP_HOST: 'example.com',
    HTTP_AUTHORIZATION: AUTH,
    HTTP_X_SIGNALWIRE_SIGNATURE: signature,
    CONTENT_TYPE: 'application/json',
    ...extra,
  });

  async function runCgi(agent: AgentBase, env: Record<string, string>) {
    let written = '';
    const adapter = new ServerlessAdapter('cgi');
    const response = await adapter._runCgi(agent.getApp(), env, BODY, (text) => {
      written += text;
    });
    return { response, written };
  }

  it('checks the URL including the script path, and writes a CGI response', async () => {
    const { response, written } = await runCgi(
      makeAgent(),
      cgiEnv(sign('http://example.com/cgi-bin/agent.cgi/')),
    );
    expect(response.statusCode).toBe(200);
    expect(written.startsWith('Status: 200 OK\r\n')).toBe(true);
    expect(written).toContain('"sections"');
  });

  it('keeps the script path behind a trusted forwarded host', async () => {
    const { response } = await runCgi(
      makeAgent({ trustProxy: true }),
      cgiEnv(sign('https://public.example.com/cgi-bin/agent.cgi/'), {
        HTTP_X_FORWARDED_HOST: 'public.example.com',
        HTTP_X_FORWARDED_PROTO: 'https',
      }),
    );
    expect(response.statusCode).toBe(200);
  });

  it('refuses a signature over the path without the script', async () => {
    const { response } = await runCgi(makeAgent(), cgiEnv(sign('http://example.com/')));
    expect(response.statusCode).toBe(403);
  });

  it('runServerless in CGI mode writes the response to stdout', async () => {
    const saved = { ...process.env };
    Object.assign(process.env, {
      REQUEST_METHOD: 'GET',
      PATH_INFO: '/',
      HTTP_AUTHORIZATION: AUTH,
      HTTP_HOST: 'example.com',
    });
    delete process.env['CONTENT_LENGTH'];
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
    try {
      const agent = new AgentBase({ name: 'cgi', route: '/', basicAuth: ['u', 'p'] });
      agent.setPromptText('cgi');
      const res = await agent.runServerless({}, undefined, 'cgi');
      expect(res.statusCode).toBe(200);
      expect(writes.join('')).toMatch(/^Status: 200 OK\r\n/);
    } finally {
      spy.mockRestore();
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  });
});
