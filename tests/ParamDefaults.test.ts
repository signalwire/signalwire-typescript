import { describe, it, expect, vi } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';
import { PromptManager } from '../src/PromptManager.js';
import { WebService } from '../src/WebService.js';
import { AIChatClient } from '../src/ai-chat/AIChatClient.js';

/**
 * PARAM DEFAULTS + REQUIRED-NESS — the drift checker compares `required` and
 * `default` on every parameter (porting-sdk 90164e9), not just `type`/`kind`.
 *
 * Each test here pins a property the DRIFT gate compares against the Python
 * reference. Crucially, every one exercises the parameter by OMITTING it — a test
 * that always passes the argument explicitly proves nothing about the default and
 * would stay green if the default were changed or removed.
 *
 *   * `WebService.start(host)`            default `"0.0.0.0"` (web/web_service.py:543)
 *   * `AgentBase.onSummary(rawData)`      optional  (core/agent_base.py:511)
 *   * `AgentBase.onFunctionCall(rawData)` optional  (core/mixins/tool_mixin.py:235)
 *   * `AIChatClient.summarize(options)`   optional, no `{}` initializer
 *                                         (ai_chat/client.py:326)
 *   * `PromptManager.defineContexts(contexts)` REQUIRED, and its value reads back
 *                                         (core/agent/prompt/manager.py:79, :309)
 */

/** Read the resolved host out of WebService's own startup log line. */
function hostFromStartLog(calls: unknown[][]): string | undefined {
  const line = calls.map((c) => String(c[0])).find((l) => l.includes('WebService starting on'));
  return line;
}

describe('WebService.start — host defaults to 0.0.0.0', () => {
  it('declares host as a DEFAULTED parameter, not a bare optional', () => {
    // `Function.length` counts only params BEFORE the first one with an
    // initializer. The reference declares `host: str = "0.0.0.0"` as the FIRST
    // param, so a faithful port has arity 0 here. Reverting to `host?: string`
    // (resolving the default inside the body instead) leaves the runtime
    // behaviour identical but the SIGNATURE wrong — and that is exactly the
    // divergence the DRIFT gate compares, so pin it directly.
    expect(WebService.prototype.start.length).toBe(0);
    // …and the initializer is the reference's value, on the PARAMETER itself
    // (everything before the body's opening brace), not resolved in the body.
    const src = String(WebService.prototype.start);
    const paramList = src.slice(0, src.indexOf('{'));
    expect(paramList).toContain('0.0.0.0');
  });

  it('binds 0.0.0.0 when host is omitted', async () => {
    // Port 0 = OS-assigned ephemeral, so the test is parallel-safe.
    const svc = new WebService({ port: 0 });
    const log = vi.spyOn((svc as unknown as { log: { info: (m: string) => void } }).log, 'info');
    try {
      await svc.start(undefined, 0);
      expect(hostFromStartLog(log.mock.calls)).toContain('://0.0.0.0:');
    } finally {
      svc.stop();
      log.mockRestore();
    }
  });

  it('an explicit host still overrides the default', async () => {
    const svc = new WebService({ port: 0 });
    const log = vi.spyOn((svc as unknown as { log: { info: (m: string) => void } }).log, 'info');
    try {
      await svc.start('127.0.0.1', 0);
      expect(hostFromStartLog(log.mock.calls)).toContain('://127.0.0.1:');
    } finally {
      svc.stop();
      log.mockRestore();
    }
  });
});

describe('AgentBase hooks — rawData is optional', () => {
  it('onSummary is callable with the summary alone', () => {
    const agent = new AgentBase({ name: 'defaults-onsummary' });
    // ONE argument. If `_rawData` were required this would not COMPILE — which is
    // exactly the contract the reference sets (`raw_data: PostPrompt | None = None`).
    expect(() => agent.onSummary(null)).not.toThrow();
  });

  it('a subclass override may itself omit rawData and still receive the summary', async () => {
    const seen: unknown[] = [];
    class Sub extends AgentBase {
      override onSummary(summary: unknown): void {
        seen.push(summary);
      }
    }
    const agent = new Sub({ name: 'defaults-onsummary-sub' });
    await agent.onSummary({ ok: true } as never);
    expect(seen).toEqual([{ ok: true }]);
  });

  it('onFunctionCall is callable with name and args alone', () => {
    const agent = new AgentBase({ name: 'defaults-onfncall' });
    // TWO arguments — `_rawData` omitted.
    expect(() => agent.onFunctionCall('some_fn', { a: 1 })).not.toThrow();
  });
});

/** Minimal JSON-RPC fetch stub that records the params the client put on the wire. */
function recordingFetch(result: Record<string, unknown>): {
  fetchImpl: typeof globalThis.fetch;
  params: Record<string, unknown>[];
} {
  const params: Record<string, unknown>[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit): Promise<Response> => {
    const payload = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
      params?: Record<string, unknown>;
    };
    params.push(payload.params ?? {});
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result }),
    } as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
  return { fetchImpl, params };
}

/** An AIChatClient wired to a stub transport (same shape as AIChatClient.test.ts). */
function newClient(fetchImpl: typeof globalThis.fetch): AIChatClient {
  return new AIChatClient({
    project: 'proj-1',
    token: 'tok-1',
    url: 'http://mock/api/ai/chat',
    fetchImpl,
    readIdleTimeoutSeconds: 0, // deterministic tests: no timer
  });
}

describe('AIChatClient.summarize — options has no invented {} default', () => {
  it('summarizes with the options argument omitted entirely', async () => {
    const { fetchImpl, params } = recordingFetch({ summary: 'ok' });
    const client = newClient(fetchImpl);
    expect(await client.summarize('conv-omitted')).toBe('ok');
    // The reference sends ONLY `id` when neither summary_prompt nor sampling is given.
    expect(Object.keys(params[0]!)).toEqual(['id']);
  });

  it('an explicitly passed summaryPrompt still reaches the wire', async () => {
    const { fetchImpl, params } = recordingFetch({ summary: 'ok' });
    const client = newClient(fetchImpl);
    expect(await client.summarize('conv-1', { summaryPrompt: 'be terse' })).toBe('ok');
    expect(params[0]!['summary_prompt']).toBe('be terse');
  });
});

describe('PromptManager.defineContexts — contexts is REQUIRED', () => {
  it('stores a plain object and reads it back', () => {
    const pm = new PromptManager();
    expect(pm.getContexts()).toBeNull();
    pm.defineContexts({ default: { steps: [] } });
    expect(pm.getContexts()).toEqual({ default: { steps: [] } });
  });

  it('unwraps a builder via toDict(), matching the reference branch', () => {
    const pm = new PromptManager();
    pm.defineContexts({ toDict: () => ({ default: { steps: ['a'] } }) });
    expect(pm.getContexts()).toEqual({ default: { steps: ['a'] } });
  });

  it('rejects a non-object, matching the reference ValueError', () => {
    const pm = new PromptManager();
    expect(() => pm.defineContexts('nope' as never)).toThrow(TypeError);
    expect(() => pm.defineContexts(null as never)).toThrow(TypeError);
    expect(pm.getContexts()).toBeNull();
  });

  it('AgentBase.defineContexts delegates a supplied value to the manager', () => {
    // The reference's PromptMixin.define_contexts forwards to
    // `self._prompt_manager.define_contexts(contexts)` when a value is passed
    // (core/mixins/prompt_mixin.py:149), so the manager's store is the read-back.
    const agent = new AgentBase({ name: 'defaults-delegate' });
    const pm = (agent as unknown as { _promptManager: PromptManager })._promptManager;
    expect(pm.getContexts()).toBeNull();
    agent.defineContexts({ default: { steps: [] } });
    expect(pm.getContexts()).toEqual({ default: { steps: [] } });
  });

  it('AgentBase.defineContexts with NO argument leaves the manager store alone', () => {
    // The reference takes the legacy branch and returns a builder without
    // touching the manager (prompt_mixin.py:151-157).
    const agent = new AgentBase({ name: 'defaults-delegate-none' });
    const pm = (agent as unknown as { _promptManager: PromptManager })._promptManager;
    agent.defineContexts();
    expect(pm.getContexts()).toBeNull();
  });

  it('omitting the argument is a compile error, not a silent no-op', () => {
    const pm = new PromptManager();
    // @ts-expect-error contexts is REQUIRED — the reference has no zero-arg form.
    // If a default were reintroduced this directive becomes UNUSED and tsc fails,
    // so the requirement is enforced at TYPE-CHECK time, not merely at runtime.
    expect(() => pm.defineContexts()).toThrow();
  });
});
