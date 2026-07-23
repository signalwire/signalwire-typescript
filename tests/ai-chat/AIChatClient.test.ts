import {
  AIChatClient,
  AIChatError,
  AuthenticationError,
  ChatInProgressError,
  ConversationNotFoundError,
  RateLimitError,
  SummaryError,
} from '../../src/ai-chat/AIChatClient.js';

/**
 * A recorded wire request: the JSON-RPC method + params the client PUT on the
 * wire, plus the Authorization header (so tests can assert Basic auth + that
 * identity never leaked into params).
 */
interface RecordedRequest {
  method: string;
  params: Record<string, unknown>;
  authorization: string | null;
}

/** Identity keys that must never ride in the JSON-RPC params. */
const FORBIDDEN_IN_PARAMS = [
  'project_id',
  'project',
  'token',
  'api_token',
  'space_id',
  'space',
] as const;

/**
 * Build a fetch stub that behaves like mock_ai_chat: it records every request and
 * returns a JSON-RPC response chosen by `responder`. The responder returns either
 * a `result` object (success envelope) or an `error` object (JSON-RPC error).
 */
function stubFetch(
  responder: (method: string, params: Record<string, unknown>) => Record<string, unknown>,
): { fetchImpl: typeof globalThis.fetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit): Promise<Response> => {
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    const payload = JSON.parse(bodyText) as {
      method: string;
      params: Record<string, unknown>;
      id: unknown;
    };
    const headers = init?.headers as Record<string, string> | undefined;
    requests.push({
      method: payload.method,
      params: payload.params,
      authorization: headers?.['Authorization'] ?? null,
    });
    const envelope = responder(payload.method, payload.params);
    const body = { jsonrpc: '2.0', ...envelope, id: payload.id };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof globalThis.fetch;
  return { fetchImpl, requests };
}

/** The canned success results the mock emits per method (mirrors mock_ai_chat). */
const CANNED: Record<string, Record<string, unknown>> = {
  create_conversation: { status: 'created', id: 'conv-1', initial_message: 'hello' },
  chat: { response: 'hi there', user_event: { event_type: 'demo', n: 1 } },
  end_conversation: { status: 'ended', id: 'conv-1' },
  delete: { status: 'deleted', id: 'conv-1' },
  chat_log: { chat_log: [{ role: 'user', content: 'm' }], call_timeline: [{ t: 1 }] },
  summarize: { summary: 'a concise summary' },
};

/** A responder mirroring the mock: canned success, sentinel-driven errors. */
function mockResponder(method: string, params: Record<string, unknown>): Record<string, unknown> {
  const id = params['id'];
  if (typeof id === 'string' && id.startsWith('__err_')) {
    const code = Number(id.slice('__err_'.length));
    return { error: { code, message: 'forced error' } };
  }
  if (method === 'summarize' && id === '__summarize_error') {
    return { result: { error: 'Failed to generate summary' } };
  }
  return { result: CANNED[method] ?? {} };
}

function newClient(fetchImpl: typeof globalThis.fetch): AIChatClient {
  return new AIChatClient({
    project: 'proj-1',
    token: 'tok-1',
    url: 'http://mock/api/ai/chat',
    fetchImpl,
    readIdleTimeoutSeconds: 0, // deterministic tests: no timer
  });
}

describe('AIChatClient', () => {
  describe('construction', () => {
    it('requires a project (arg or env)', () => {
      const saved = process.env['SIGNALWIRE_PROJECT_ID'];
      delete process.env['SIGNALWIRE_PROJECT_ID'];
      try {
        expect(() => new AIChatClient({ url: 'http://x' })).toThrow(/project is required/);
      } finally {
        if (saved !== undefined) process.env['SIGNALWIRE_PROJECT_ID'] = saved;
      }
    });

    it('builds the space URL when no explicit url is given', () => {
      const c = new AIChatClient({ project: 'p', token: 't', space: 'myspace' });
      expect(c.url).toBe('https://myspace.signalwire.com/api/ai/chat');
    });

    it('uses an explicit url verbatim', () => {
      const c = new AIChatClient({ project: 'p', token: 't', url: 'http://local/api/ai/chat' });
      expect(c.url).toBe('http://local/api/ai/chat');
    });

    it('throws when neither url nor space resolves', () => {
      expect(() => new AIChatClient({ project: 'p', token: 't' })).toThrow(/No service URL/);
    });
  });

  describe('lifecycle', () => {
    it('close() is an idempotent no-op (no owned session to release)', async () => {
      const c = new AIChatClient({ project: 'p', token: 't', url: 'http://local/api/ai/chat' });
      await expect(c.close()).resolves.toBeUndefined();
      await expect(c.close()).resolves.toBeUndefined();
    });

    it('Symbol.asyncDispose delegates to close() (await using)', async () => {
      const c = new AIChatClient({ project: 'p', token: 't', url: 'http://local/api/ai/chat' });
      await expect(c[Symbol.asyncDispose]()).resolves.toBeUndefined();
    });
  });

  describe('wire behavior', () => {
    it('sends HTTP Basic auth with the project as username; identity never in params', async () => {
      const { fetchImpl, requests } = stubFetch(mockResponder);
      const client = newClient(fetchImpl);
      await client.createConversation('conv-1', {
        configUrl: 'http://cfg',
        timeout: 30,
        reinit: true,
      });

      const req = requests[0]!;
      expect(req.authorization).toMatch(/^Basic /);
      const decoded = Buffer.from(req.authorization!.slice('Basic '.length), 'base64').toString();
      expect(decoded).toBe('proj-1:tok-1');
      for (const key of FORBIDDEN_IN_PARAMS) {
        expect(req.params).not.toHaveProperty(key);
      }
    });

    it('createConversation maps timeout->conversation_timeout and decodes the result', async () => {
      const { fetchImpl, requests } = stubFetch(mockResponder);
      const info = await newClient(fetchImpl).createConversation('conv-1', {
        configUrl: 'http://cfg',
        timeout: 30,
        reinit: true,
      });
      expect(requests[0]!.method).toBe('create_conversation');
      expect(requests[0]!.params).toMatchObject({
        id: 'conv-1',
        config_url: 'http://cfg',
        conversation_timeout: 30,
        reinit: true,
      });
      expect(info).toEqual({ id: 'conv-1', status: 'created', initialMessage: 'hello' });
    });

    it('chat sends role=user by default and decodes response + userEvent', async () => {
      const { fetchImpl, requests } = stubFetch(mockResponder);
      const reply = await newClient(fetchImpl).chat('conv-1', 'hello', {
        timeout: 30,
        reinit: true,
      });
      expect(requests[0]!.method).toBe('chat');
      expect(requests[0]!.params).toMatchObject({
        id: 'conv-1',
        message: 'hello',
        role: 'user',
        conversation_timeout: 30,
        reinit: true,
      });
      expect(reply.text).toBe('hi there');
      expect(reply.conversationId).toBe('conv-1');
      expect(reply.userEvent).toEqual({ event_type: 'demo', n: 1 });
    });

    it('end returns true on {status: ended}', async () => {
      const { fetchImpl, requests } = stubFetch(mockResponder);
      expect(await newClient(fetchImpl).end('conv-1')).toBe(true);
      expect(requests[0]!.method).toBe('end_conversation');
    });

    it('delete returns true on {status: deleted}', async () => {
      const { fetchImpl, requests } = stubFetch(mockResponder);
      expect(await newClient(fetchImpl).delete('conv-1')).toBe(true);
      expect(requests[0]!.method).toBe('delete');
    });

    it('log decodes messages + callTimeline', async () => {
      const { fetchImpl } = stubFetch(mockResponder);
      const log = await newClient(fetchImpl).log('conv-1');
      expect(log.messages).toEqual([{ role: 'user', content: 'm' }]);
      expect(log.callTimeline).toEqual([{ t: 1 }]);
    });

    it('summarize returns the summary string on the {summary} branch', async () => {
      const { fetchImpl } = stubFetch(mockResponder);
      expect(await newClient(fetchImpl).summarize('conv-1')).toBe('a concise summary');
    });

    it('summarize passes sampling params on the wire', async () => {
      const { fetchImpl, requests } = stubFetch(mockResponder);
      await newClient(fetchImpl).summarize('conv-1', {
        summaryPrompt: 'be brief',
        temperature: 0.2,
        maxTokens: 64,
      });
      expect(requests[0]!.params).toMatchObject({
        id: 'conv-1',
        summary_prompt: 'be brief',
        temperature: 0.2,
        max_tokens: 64,
      });
    });
  });

  describe('summarize one_of {error} branch', () => {
    it('RAISES SummaryError (never returns an empty string)', async () => {
      const { fetchImpl } = stubFetch(mockResponder);
      const client = newClient(fetchImpl);
      await expect(client.summarize('__summarize_error')).rejects.toBeInstanceOf(SummaryError);
    });

    it('the raised SummaryError carries the server message and a null code', async () => {
      const { fetchImpl } = stubFetch(mockResponder);
      try {
        await newClient(fetchImpl).summarize('__summarize_error');
        throw new Error('expected SummaryError');
      } catch (e) {
        expect(e).toBeInstanceOf(SummaryError);
        expect((e as SummaryError).code).toBeNull();
        expect((e as SummaryError).serverMessage).toBe('Failed to generate summary');
      }
    });

    it('does NOT raise when both summary and error are present (summary wins)', async () => {
      const { fetchImpl } = stubFetch(() => ({ result: { summary: 's', error: 'ignored' } }));
      expect(await newClient(fetchImpl).summarize('conv-1')).toBe('s');
    });
  });

  describe('JSON-RPC error mapping', () => {
    const cases: Array<[number, new (...a: never[]) => AIChatError]> = [
      [-32001, ConversationNotFoundError],
      [-32005, RateLimitError],
      [-32006, RateLimitError],
      [-32007, ChatInProgressError],
      [-32009, AuthenticationError],
    ];

    for (const [code, ctor] of cases) {
      it(`maps code ${code} to ${ctor.name} carrying the code`, async () => {
        const { fetchImpl } = stubFetch(mockResponder);
        try {
          await newClient(fetchImpl).chat(`__err_${code}`, 'x');
          throw new Error('expected a raised error');
        } catch (e) {
          expect(e).toBeInstanceOf(ctor);
          expect(e).toBeInstanceOf(AIChatError);
          expect((e as AIChatError).code).toBe(code);
        }
      });
    }

    it('maps an unmapped code to the base AIChatError', async () => {
      const { fetchImpl } = stubFetch(mockResponder);
      try {
        await newClient(fetchImpl).chat('__err_-32602', 'x');
        throw new Error('expected a raised error');
      } catch (e) {
        expect(e).toBeInstanceOf(AIChatError);
        expect(e).not.toBeInstanceOf(ConversationNotFoundError);
        expect((e as AIChatError).code).toBe(-32602);
      }
    });

    it('raises AIChatError on a non-JSON body', async () => {
      const fetchImpl = (async () =>
        new Response('<html>not json', { status: 502 })) as unknown as typeof globalThis.fetch;
      await expect(newClient(fetchImpl).chat('conv-1', 'x')).rejects.toBeInstanceOf(AIChatError);
    });
  });
});
