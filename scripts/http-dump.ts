/**
 * http-dump.ts — the TypeScript port's HTTP dump program for the cross-port HTTP
 * differ (porting-sdk/scripts/diff_port_http.py).
 *
 * For each http_corpus case it feeds a synthetic request into the TS SDK's
 * framework-free dispatch core (SWMLService.handleRequest, extractSipUsername,
 * the webhook-middleware validate, and the serverless adapter via runServerless)
 * and prints ONE JSON object mapping
 *
 *   case-id -> reduced-artifact
 *
 * to stdout, reduced to the same shape the python oracle emits. The differ
 * canonicalizes both sides and byte-compares. Only stdout carries JSON.
 *
 * The corpus sentinels (__AUTH__/__AUTH_BAD__ Basic headers, __SIG__ webhook
 * signature, __REDIRECT_CB__ routing callback, __HELLO_HANDLER__ SWAIG handler,
 * __JSON__: lambda body prefix) are materialized here as the oracle materializes
 * them (diff_port_http). Logging is forced off (the Logger routes info/debug to
 * stdout) and the SDK is loaded via a deferred import after the env is set, so
 * only JSON reaches stdout.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   npx tsx scripts/http-dump.ts
 */

process.env['SIGNALWIRE_LOG_MODE'] = 'off';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHmac } from 'node:crypto';

const USER = 'user';
const PASSWORD = 'pass';
const SIGNING_KEY = 'PSK-fixed-signing-key';
const WH_URL = 'https://agent.example.com/webhook';
const WH_BODY = '{"event":"call.created","id":"abc"}';

const basicAuthHeader = (u: string, p: string): string =>
  'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');

const webhookSig = (url: string, body: string, key: string): string =>
  createHmac('sha1', key)
    .update(url + body)
    .digest('hex');

/** observeResponse reduces a (status, headers, body) triple to a comparable
 *  artifact — the TS mirror of diff_port_http._observe_response. */
function observeResponse(
  status: number,
  headers: Record<string, string>,
  bodyStr: string,
  kind: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { status, header_keys: Object.keys(headers).sort() };
  if ('Location' in headers) out['location'] = headers['Location'];
  if ('WWW-Authenticate' in headers) out['www_authenticate'] = headers['WWW-Authenticate'];
  if (kind === 'response_full') {
    if (bodyStr === '') {
      out['body'] = '';
    } else {
      try {
        out['body'] = JSON.parse(bodyStr);
      } catch {
        out['body'] = bodyStr;
      }
    }
  }
  return out;
}

async function main(): Promise<void> {
  const { AgentBase } = await import('../src/AgentBase.js');
  const { SWMLService } = await import('../src/SWMLService.js');
  const { FunctionResult } = await import('../src/FunctionResult.js');
  const { validate: webhookValidate } = await import('../src/WebhookMiddleware.js');

  const newSWMLService = () =>
    new SWMLService({ name: 'demo', route: '/swml', basicAuth: [USER, PASSWORD] });

  // redirectCB redirects one specific 'to', else passes through (null).
  const redirectCB = (body: any): string | null => {
    const to = body?.call?.to;
    return to === 'sip:redirect-me@space' ? '/other-route' : null;
  };

  const out: Record<string, unknown> = {};

  // ---- handle_request: 200 SWML happy path ----
  {
    const svc = newSWMLService();
    const [s, h, b] = await svc.handleRequest(
      'GET',
      'http://localhost:3000/swml',
      { Authorization: basicAuthHeader(USER, PASSWORD) },
      null,
    );
    out['http_handle_request_200_swml'] = observeResponse(s, h, b, 'response_full');
  }
  // ---- handle_request: 401 no auth ----
  {
    const svc = newSWMLService();
    const [s, h, b] = await svc.handleRequest('GET', 'http://localhost:3000/swml', {}, null);
    out['http_handle_request_401_no_auth'] = observeResponse(s, h, b, 'response_full');
  }
  // ---- handle_request: 401 bad password (status + headers only) ----
  {
    const svc = newSWMLService();
    const [s, h, b] = await svc.handleRequest(
      'GET',
      'http://localhost:3000/swml',
      { Authorization: basicAuthHeader(USER, 'wrong') },
      null,
    );
    out['http_handle_request_401_bad_password'] = observeResponse(
      s,
      h,
      b,
      'response_status_headers',
    );
  }
  // ---- handle_request: 307 redirect via routing callback ----
  {
    const svc = newSWMLService();
    svc.registerRoutingCallback(redirectCB, '/sip');
    const [s, h, b] = await svc.handleRequest(
      'POST',
      'http://localhost:3000/swml/sip',
      { Authorization: basicAuthHeader(USER, PASSWORD) },
      { call: { to: 'sip:redirect-me@space' } },
    );
    out['http_handle_request_307_redirect'] = observeResponse(s, h, b, 'response_full');
  }
  // ---- handle_request: callback returns null -> normal 200 SWML ----
  {
    const svc = newSWMLService();
    svc.registerRoutingCallback(redirectCB, '/sip');
    const [s, h, b] = await svc.handleRequest(
      'POST',
      'http://localhost:3000/swml/sip',
      { Authorization: basicAuthHeader(USER, PASSWORD) },
      { call: { to: 'sip:keep@space' } },
    );
    out['http_handle_request_callback_passthrough_200'] = observeResponse(s, h, b, 'response_full');
  }

  // ---- extract_sip_username: pure extractor (corpus target = SWMLService) ----
  const extract = (body: any): Record<string, unknown> => {
    const u = SWMLService.extractSipUsername(body);
    return { username: u ?? null };
  };
  out['http_extract_sip_username_sip'] = extract({
    call: { to: 'sip:alice@agents.signalwire.com' },
  });
  out['http_extract_sip_username_tel'] = extract({ call: { to: 'tel:+15551234567' } });
  out['http_extract_sip_username_plain'] = extract({ call: { to: 'support' } });
  out['http_extract_sip_username_missing'] = extract({ vars: {} });

  // ---- webhook validate ----
  const webhookDecision = (
    method: string,
    url: string,
    body: string,
    headers: Record<string, string>,
    key: string,
  ): Record<string, unknown> => {
    const rej = webhookValidate(method, url, headers, body, key);
    return rej === null ? { decision: 'pass' } : { decision: 'reject', status: rej[0] };
  };
  out['http_webhook_validate_ok'] = webhookDecision(
    'POST',
    WH_URL,
    WH_BODY,
    { 'x-signalwire-signature': webhookSig(WH_URL, WH_BODY, SIGNING_KEY) },
    SIGNING_KEY,
  );
  out['http_webhook_validate_bad_sig'] = webhookDecision(
    'POST',
    WH_URL,
    WH_BODY,
    { 'x-signalwire-signature': 'deadbeef'.repeat(5) },
    SIGNING_KEY,
  );
  out['http_webhook_validate_missing_sig'] = webhookDecision(
    'POST',
    WH_URL,
    WH_BODY,
    {},
    SIGNING_KEY,
  );
  out['http_webhook_validate_twilio_alias'] = webhookDecision(
    'POST',
    WH_URL,
    WH_BODY,
    { 'x-twilio-signature': webhookSig(WH_URL, WH_BODY, SIGNING_KEY) },
    SIGNING_KEY,
  );

  // ---- serverless (lambda) ----
  // reduceServerless mirrors the oracle's serverless_result observer: {status, body}.
  const reduceServerless = (resp: {
    statusCode: number;
    body: string;
  }): Record<string, unknown> => {
    let body: unknown = resp.body;
    if (resp.body !== '') {
      try {
        body = JSON.parse(resp.body);
      } catch {
        /* keep raw */
      }
    }
    return { status: resp.statusCode, body };
  };
  {
    // Agent at route "/" so the event's root-relative "/swaig" path routes
    // correctly (matches go's dump + Python's serverless dispatch).
    const a = new AgentBase({ name: 'demo', route: '/', basicAuth: [USER, PASSWORD] });
    a.defineTool({
      name: 'say_hello',
      description: 'greet',
      parameters: {},
      handler: () => new FunctionResult('hello there'),
    });
    const resp = await a.runServerless(
      {
        rawPath: '/swaig',
        httpMethod: 'POST',
        headers: {
          authorization: basicAuthHeader(USER, PASSWORD),
          'content-type': 'application/json',
        },
        body: '{"function":"say_hello","argument":{"parsed":[{}]},"call_id":"c1"}',
      } as any,
      undefined,
      'lambda',
    );
    out['http_serverless_lambda_swaig'] = reduceServerless(resp);
  }
  {
    const a = new AgentBase({ name: 'demo', route: '/', basicAuth: [USER, PASSWORD] });
    const resp = await a.runServerless(
      { rawPath: '/', httpMethod: 'GET', headers: {} } as any,
      undefined,
      'lambda',
    );
    out['http_serverless_lambda_noauth_401'] = reduceServerless(resp);
  }

  process.stdout.write(JSON.stringify(out) + '\n');
}

void main();
