/**
 * AIChatClient additions from signalwire-python 8b790ea, 8253718 and f28f46b:
 * rawPost for streaming proxies, an idle timeout that each chunk restarts
 * (not a limit on the whole turn), RAILS_DEV_MODE, a space hostname in
 * SIGNALWIRE_SPACE (issue #186), and a warning for conversation ids the
 * service will alter.
 */

import { AIChatClient, AIChatError } from '../../src/ai-chat/AIChatClient.js';
import { Logger } from '../../src/Logger.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const encoder = new TextEncoder();

/**
 * A fetch whose body arrives as `chunks`, `gapMs` apart. With `stallAfter`,
 * it goes silent after that many chunks. With `stallHeaders`, it never
 * answers. Both honour the abort signal, as a real fetch does.
 */
function streamingFetch(
  chunks: string[],
  gapMs: number,
  opts: { stallAfter?: number; stallHeaders?: boolean } = {},
) {
  const seen: { headers: Record<string, string>; body: unknown }[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit): Promise<Response> => {
    seen.push({
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    });
    if (opts.stallHeaders) {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      });
    }
    // Like a real fetch, an abort errors the body too.
    const signal = init?.signal;
    const aborted = new Promise<never>((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason));
    });
    aborted.catch(() => undefined);
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(stream) {
        const silent = opts.stallAfter !== undefined && i >= opts.stallAfter;
        await Promise.race([silent ? new Promise(() => undefined) : sleep(gapMs), aborted]);
        if (i < chunks.length) stream.enqueue(encoder.encode(chunks[i++]!));
        else stream.close();
      },
    });
    return new Response(body, { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  return { fetchImpl, seen };
}

function client(fetchImpl: typeof globalThis.fetch, readIdleTimeoutSeconds: number) {
  return new AIChatClient({
    project: 'p',
    token: 't',
    url: 'http://mock/api/ai/chat',
    fetchImpl,
    readIdleTimeoutSeconds,
  });
}

const REPLY = '{"jsonrpc":"2.0","id":"req-1","result":{"response":"done"}}';

describe('idle timeout', () => {
  it('lets a turn kept alive by keepalive whitespace run past the timeout', async () => {
    // Six chunks 40ms apart: 240ms in all, against a 100ms idle timeout.
    const { fetchImpl } = streamingFetch([' ', ' ', ' ', ' ', ' ', REPLY], 40);
    const reply = await client(fetchImpl, 0.1).chat('conv-1', 'hi');
    expect(reply.text).toBe('done');
  });

  it('abandons a body that goes silent, with an AIChatError', async () => {
    const { fetchImpl } = streamingFetch([' ', REPLY], 10, { stallAfter: 1 });
    const err = await client(fetchImpl, 0.1)
      .chat('conv-1', 'hi')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AIChatError);
    expect((err as AIChatError).code).toBeNull();
    expect((err as AIChatError).message).toMatch(/no data from the chat service for 0.1s/);
  });

  it('abandons a request that never gets response headers', async () => {
    const { fetchImpl } = streamingFetch([], 0, { stallHeaders: true });
    await expect(client(fetchImpl, 0.1).end('conv-1')).rejects.toThrow(/no data/);
  });
});

describe('rawPost', () => {
  it('returns the response with the body unread, streaming chunks in order', async () => {
    const { fetchImpl, seen } = streamingFetch([' ', ' ', REPLY], 5);
    const res = await client(fetchImpl, 1).rawPost('chat', { id: 'conv-1', message: 'hi' });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    for (let r = await reader.read(); !r.done; r = await reader.read()) {
      chunks.push(decoder.decode(r.value));
    }
    expect(chunks).toEqual([' ', ' ', REPLY]);
    expect(seen[0]!.body).toMatchObject({
      jsonrpc: '2.0',
      method: 'chat',
      params: { id: 'conv-1', message: 'hi' },
    });
    expect(seen[0]!.headers['User-Agent']).toMatch(/^signalwire-typescript\//);
  });

  it('applies the idle timeout to each read of the relayed body', async () => {
    const { fetchImpl } = streamingFetch([' ', REPLY], 5, { stallAfter: 1 });
    const res = await client(fetchImpl, 0.1).rawPost('chat', { id: 'conv-1' });
    await expect(res.text()).rejects.toThrow(/no data/);
  });
});

describe('service URL', () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const k of ['RAILS_DEV_MODE', 'SIGNALWIRE_SPACE']) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('uses a URL in RAILS_DEV_MODE', () => {
    process.env['RAILS_DEV_MODE'] = 'http://localhost:8080/';
    expect(new AIChatClient({ project: 'p', space: 'myspace' }).url).toBe('http://localhost:8080/');
  });

  it.each(['true', '1', 'on', 'FALSE'])('ignores a boolean RAILS_DEV_MODE (%s)', (value) => {
    process.env['RAILS_DEV_MODE'] = value;
    expect(new AIChatClient({ project: 'p', space: 'myspace' }).url).toBe(
      'https://myspace.signalwire.com/api/ai/chat',
    );
  });

  it('prefers the url option to RAILS_DEV_MODE', () => {
    process.env['RAILS_DEV_MODE'] = 'http://localhost:8080/';
    expect(new AIChatClient({ project: 'p', url: 'http://explicit/' }).url).toBe(
      'http://explicit/',
    );
  });

  it('accepts a space hostname, the form the REST client reads', () => {
    delete process.env['RAILS_DEV_MODE'];
    process.env['SIGNALWIRE_SPACE'] = 'example.signalwire.com';
    expect(new AIChatClient({ project: 'p' }).url).toBe(
      'https://example.signalwire.com/api/ai/chat',
    );
  });
});

describe('conversation id warning', () => {
  const ok = (async () =>
    new Response('{"result":{"status":"created"}}')) as unknown as typeof globalThis.fetch;

  it('warns when the service will strip characters from the id', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    try {
      await client(ok, 0).createConversation('root~2 x', { configUrl: 'http://c' });
      expect(warn).toHaveBeenCalledWith(
        'conversation_id_will_be_sanitized',
        expect.objectContaining({
          requested: 'root~2 x',
          stored_as: 'root2x',
          removed_characters: ' ~',
          message: expect.stringContaining("Use '.' to compose ids"),
        }),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('stays quiet for an id the service keeps as it is', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    try {
      await client(ok, 0).createConversation('root.2_a-b:c', { configUrl: 'http://c' });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
