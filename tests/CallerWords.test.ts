/**
 * The caller's own words in a tool handler, from signalwire-python 3.8.0. A
 * SWAIG request carries the conversation as call_log only with
 * swaig_post_conversation on (actions.c). The recognizer's finals with their
 * word confidences come as ai.speech_detect AI events, posted to the call's
 * event_webhook_url as { event_type, timestamp, params: { text, words, call_id } }
 * (webhook.c build_event_webhook_envelope, with "calling." dropped).
 */
import { createHmac } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { AgentBase } from '../src/AgentBase.js';
import { SpeechLog, callerTurns } from '../src/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;
const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');

const CALL_LOG = [
  { role: 'system', content: 'You take orders.', timestamp: 100 },
  { role: 'assistant', content: "What's your ZIP code?", timestamp: 200 },
  { role: 'user', content: '10001', timestamp: 300, confidence: 0.98 },
  { role: 'assistant', content: '', tool_calls: [{ id: 'x' }], timestamp: 350 },
  { role: 'user', content: '  ', timestamp: 360 },
  { role: 'user', content: 'and a large tea', timestamp: 400 },
];

function agent(): AgentBase {
  const a = new AgentBase({ name: 'words', route: '/', basicAuth: ['u', 'p'] });
  a.setPromptText('x');
  return a;
}
const ai = (a: AgentBase): Json =>
  (JSON.parse(a.renderSwml())['sections']['main'] as Json[]).find((v) => 'ai' in v)!['ai'];

const event = (text: string, words: Json[], callId = 'call-1', timestamp = 1700000000.5): Json => ({
  event_type: 'ai.speech_detect',
  timestamp,
  project_id: 'p',
  space_id: 's',
  params: { text, words, call_id: callId, node_id: 'n', segment_id: callId },
});

const post = (
  a: AgentBase,
  body: unknown,
  headers: Record<string, string> = { Authorization: AUTH },
) =>
  a.getApp().request('/ai_events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('callerTurns', () => {
  it("gives the caller's turns in order", () => {
    expect(callerTurns({ call_log: CALL_LOG })).toEqual(['10001', 'and a large tea']);
  });
  it('takes since and last', () => {
    expect(callerTurns({ call_log: CALL_LOG }, 350)).toEqual(['and a large tea']);
    expect(callerTurns(CALL_LOG, undefined, { last: 1 })).toEqual(['and a large tea']);
    expect(callerTurns(CALL_LOG, undefined, { last: 0 })).toEqual([]);
  });
  it('reads the raw log when there is no call log', () => {
    expect(callerTurns({ raw_call_log: CALL_LOG })).toEqual(['10001', 'and a large tea']);
  });
  it('gives nothing without a conversation', () => {
    expect(callerTurns({ call_id: 'x' })).toEqual([]);
    expect(callerTurns({ call_log: 'not a list' })).toEqual([]);
    expect(callerTurns(null)).toEqual([]);
  });
});

describe('AI events', () => {
  it("sets the event URL to the agent's own", () => {
    const url = String(ai(agent().recordSpeechFinals())['params']['event_webhook_url']);
    expect(url.split('?')[0]!.replace(/\/$/, '')).toMatch(/\/ai_events$/);
  });

  it('keeps a URL set by hand', () => {
    const a = agent();
    a.setParam('event_webhook_url', 'https://events.example.com/in');
    a.onAiEvent(() => undefined);
    expect(ai(a)['params']['event_webhook_url']).toBe('https://events.example.com/in');
  });

  it('sets no URL when nothing handles events', () => {
    expect('event_webhook_url' in (ai(agent())['params'] ?? {})).toBe(false);
  });

  it('gives posted events to the log and the handlers', async () => {
    const seen: Array<[string, unknown]> = [];
    const a = agent().recordSpeechFinals();
    a.onAiEvent((eventType, params) => void seen.push([eventType, params['text'] ?? '']));
    const words = [
      { word: 'S', confidence: 0.73 },
      { word: 'm', confidence: 0.95 },
    ];
    const ok = await post(a, event('S m', words));
    const other = await post(a, { event_type: 'ai.response', params: { call_id: 'call-1' } });
    const refused = await post(a, event('x', []), {});
    expect([ok.status, other.status, refused.status]).toEqual([200, 200, 401]);
    expect(seen).toEqual([
      ['ai.speech_detect', 'S m'],
      ['ai.response', ''],
    ]);
    expect(a.speechFinals('call-1')).toEqual([{ text: 'S m', words, timestamp: 1700000000.5 }]);
    expect(a.speechFinals('another-call')).toEqual([]);
  });

  it("doesn't fail the post when a handler fails", async () => {
    const a = agent();
    a.onAiEvent(() => {
      throw new Error('boom');
    });
    expect((await post(a, event('hi', []))).status).toBe(200);
  });

  it('answers a GET with 405 and wrong content with 415', async () => {
    const a = agent();
    a.onAiEvent(() => undefined);
    const get = await a.getApp().request('/ai_events', { headers: { Authorization: AUTH } });
    expect(get.status).toBe(405);
    const text = await a.getApp().request('/ai_events', {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'text/plain' },
      body: 'x',
    });
    expect(text.status).toBe(415);
  });
});

describe('an oversized AI event (found in review)', () => {
  function streamingBody(bytes: number): ReadableStream<Uint8Array> {
    let sent = 0;
    return new ReadableStream({
      pull(controller) {
        if (sent >= bytes) return controller.close();
        const chunk = new Uint8Array(Math.min(64 * 1024, bytes - sent)).fill(32);
        sent += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
  }

  it.each([false, true])(
    'is refused before it is read in full (signing key: %s)',
    async (signed) => {
      const previous = process.env['SWML_MAX_REQUEST_SIZE'];
      process.env['SWML_MAX_REQUEST_SIZE'] = '1024';
      try {
        const a = new AgentBase({
          name: 'big',
          route: '/',
          basicAuth: ['u', 'p'],
          ...(signed ? { signingKey: 'key' } : {}),
        });
        a.setPromptText('x');
        a.onAiEvent(() => undefined);
        const res = await a.getApp().request('/ai_events', {
          method: 'POST',
          headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
          body: streamingBody(4 * 1024 * 1024),
          // @ts-expect-error -- Node's fetch needs duplex for a stream body
          duplex: 'half',
        });
        expect(res.status).toBe(413);
      } finally {
        if (previous === undefined) delete process.env['SWML_MAX_REQUEST_SIZE'];
        else process.env['SWML_MAX_REQUEST_SIZE'] = previous;
      }
    },
  );
});

describe('SpeechLog', () => {
  it('keeps finals per call, bounded', () => {
    const log = new SpeechLog(2, 2);
    for (const call of ['a', 'b']) {
      for (let n = 0; n < 3; n++) log.add(event(`${call}${n}`, [], call, n));
    }
    expect(log.finals('a').map((f) => f.text)).toEqual(['a1', 'a2']);
    log.add(event('c0', [], 'c'));
    expect(log.finals('a')).toEqual([]);
    expect(log.finals('b', 2).map((f) => f.text)).toEqual(['b2']);
  });

  it('ignores malformed events', () => {
    const log = new SpeechLog();
    log.add({ event_type: 'ai.speech_detect' });
    log.add({ params: { text: 1, call_id: 'a' } });
    expect(log.finals('a')).toEqual([]);
  });

  it('gives copies', () => {
    const log = new SpeechLog();
    log.add(event('hi', [{ word: 'hi', confidence: 0.9 }], 'a'));
    log.finals('a')[0]!.words[0]!.word = 'changed';
    expect(log.finals('a')[0]!.words[0]!.word).toBe('hi');
  });
});

describe('AI events with a per-request copy', () => {
  it("renders the URL from the copy and gives events to the agent's handlers", async () => {
    const seen: string[] = [];
    const a = agent();
    a.onAiEvent((eventType) => void seen.push(eventType));
    a.setDynamicConfigCallback((_q, _b, _h, copy) => {
      copy.setParam('temperature', 0.2);
    });
    const res = await a.getApp().request('/', { method: 'POST', headers: { Authorization: AUTH } });
    const swml = (await res.json()) as Json;
    const block = (swml['sections']['main'] as Json[]).find((v) => 'ai' in v)!['ai'];
    expect(String(block['params']['event_webhook_url'])).toContain('/ai_events');
    expect((await post(a, event('hi', []))).status).toBe(200);
    expect(seen).toEqual(['ai.speech_detect']);
  });
});

describe('the AI event body after host middleware (found in review)', () => {
  const KEY = 'PSKtest1234567890abcdef';
  const sign = (url: string, body: string) =>
    createHmac('sha1', KEY)
      .update(url + body, 'utf8')
      .digest('hex');

  function mounted(read: (c: Context) => Promise<unknown>) {
    const seen: string[] = [];
    const a = new AgentBase({ name: 'm', route: '/', basicAuth: ['u', 'p'], signingKey: KEY });
    a.setPromptText('x');
    a.onAiEvent((_t, params) => void seen.push(String(params['text'])));
    const host = new Hono();
    host.use('*', async (c, next) => {
      await read(c);
      await next();
    });
    host.route('/agent', a.asRouter());
    return { host, seen };
  }

  it.each([
    ['text', (c: Context) => c.req.text()],
    ['arrayBuffer', (c: Context) => c.req.arrayBuffer()],
    ['json', (c: Context) => c.req.json()],
  ])('reads an event the host already read with %s()', async (_name, read) => {
    const { host, seen } = mounted(read);
    const body = JSON.stringify(event('hi', []));
    const res = await host.request('/agent/ai_events', {
      method: 'POST',
      headers: {
        Authorization: AUTH,
        'Content-Type': 'application/json',
        'X-SignalWire-Signature': sign('http://localhost/agent/ai_events', body),
      },
      body,
    });
    expect(res.status).toBe(200);
    expect(seen).toEqual(['hi']);
  });

  it('refuses an oversized event the host already read', async () => {
    const previous = process.env['SWML_MAX_REQUEST_SIZE'];
    process.env['SWML_MAX_REQUEST_SIZE'] = '100';
    try {
      const { host, seen } = mounted((c) => c.req.text());
      const body = JSON.stringify(event('x'.repeat(200), []));
      const res = await host.request('/agent/ai_events', {
        method: 'POST',
        headers: {
          Authorization: AUTH,
          'Content-Type': 'application/json',
          'X-SignalWire-Signature': sign('http://localhost/agent/ai_events', body),
        },
        body,
      });
      expect(res.status).toBe(413);
      expect(seen).toEqual([]);
    } finally {
      if (previous === undefined) delete process.env['SWML_MAX_REQUEST_SIZE'];
      else process.env['SWML_MAX_REQUEST_SIZE'] = previous;
    }
  });

  it('answers an oversized event when middleware cloned the request', async () => {
    const previous = process.env['SWML_MAX_REQUEST_SIZE'];
    process.env['SWML_MAX_REQUEST_SIZE'] = '100';
    try {
      const a = agent();
      a.onAiEvent(() => undefined);
      const host = new Hono();
      // Logging middleware that reads its copy after the route has answered
      host.use('*', async (c, next) => {
        const copy = c.req.raw.clone();
        await next();
        await copy.text();
      });
      host.route('/', a.asRouter());
      const res = await Promise.race([
        host.request('/ai_events', {
          method: 'POST',
          headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
          body: JSON.stringify(event('x'.repeat(200), [])),
        }),
        new Promise<'hung'>((resolve) => setTimeout(() => resolve('hung'), 2000)),
      ]);
      expect(res === 'hung' ? res : res.status).toBe(413);
    } finally {
      if (previous === undefined) delete process.env['SWML_MAX_REQUEST_SIZE'];
      else process.env['SWML_MAX_REQUEST_SIZE'] = previous;
    }
  });
});
