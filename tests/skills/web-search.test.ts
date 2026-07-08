/**
 * Individual tests for the WebSearch skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { WebSearchSkill, createWebSearchSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => {
  suppressAllLogs(true);
});

describe('WebSearchSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new WebSearchSkill()).toBeInstanceOf(SkillBase);
    expect(createWebSearchSkill()).toBeInstanceOf(WebSearchSkill);
  });

  it('should return false from setup() when credentials are missing', async () => {
    delete process.env['GOOGLE_SEARCH_API_KEY'];
    delete process.env['GOOGLE_SEARCH_ENGINE_ID'];
    delete process.env['GOOGLE_SEARCH_CX'];
    await expect(new WebSearchSkill().setup()).resolves.toBe(false);
  });

  it('should return true from setup() when credentials are provided via config', async () => {
    const skill = new WebSearchSkill({ api_key: 'test-key', search_engine_id: 'test-cx' });
    await expect(skill.setup()).resolves.toBe(true);
  });

  it('should register a web_search tool', () => {
    const tools = new WebSearchSkill().getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe('web_search');
    // Python passes no `required` (web_search/skill.py:707); TS matches.
    expect(tools[0]!.required).toBeUndefined();
  });

  it('should provide prompt sections', () => {
    const sections = new WebSearchSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0]!.title).toContain('Web Search');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new WebSearchSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints', () => {
    const skill = new WebSearchSkill();
    expect(skill.getHints()).toEqual([]);
  });

  it('should expose web search metadata via global data', () => {
    const globalData = new WebSearchSkill().getGlobalData();
    expect(globalData['web_search_enabled']).toBe(true);
    expect(globalData['search_provider']).toBe('Google Custom Search');
  });

  it('should return correct manifest with required env vars', () => {
    const klass = WebSearchSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('web_search');
    expect(klass.SKILL_VERSION).toBe('2.0.0');
    // Python REQUIRED_ENV_VARS = []: credentials come from either config
    // params or env vars, so the manifest's env-var requirement is empty.
    expect(klass.REQUIRED_ENV_VARS).toEqual([]);
  });

  it('should return error when API keys are missing', async () => {
    delete process.env['GOOGLE_SEARCH_API_KEY'];
    delete process.env['GOOGLE_SEARCH_ENGINE_ID'];
    delete process.env['GOOGLE_SEARCH_CX'];
    const handler = new WebSearchSkill().getTools()[0]!.handler;
    const result = (await handler({ query: 'test' }, {})) as FunctionResult;
    expect(result.response).toContain('not configured');
  });

  it('should reject empty query', async () => {
    const handler = new WebSearchSkill().getTools()[0]!.handler;
    const result = (await handler({ query: '' }, {})) as FunctionResult;
    expect(result.response).toContain('provide a search query');
  });

  it('should support multiple instances', () => {
    expect(WebSearchSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
  });

  it('should compute instance key from search_engine_id and tool_name', () => {
    const skill = new WebSearchSkill({ search_engine_id: 'cx-1', tool_name: 'custom' });
    expect(skill.getInstanceKey()).toBe('web_search_cx-1_custom');
  });

  it('should have a parameter schema', () => {
    const schema = WebSearchSkill.getParameterSchema();
    // Each documented param must be a real entry — type + description
    // both populated. A stub returning `{key: undefined}` would fail.
    const required = [
      'num_results',
      'tool_name',
      'no_results_message',
      'safe_search',
      'delay',
      'max_content_length',
      'oversample_factor',
      'min_quality_score',
    ];
    const validTypes = new Set(['string', 'integer', 'number', 'boolean', 'array', 'object']);
    for (const key of required) {
      const entry = schema[key];
      expect(entry, `schema.${key} missing`).toBeDefined();
      expect(validTypes.has(entry!.type), `schema.${key}.type invalid`).toBe(true);
      expect(typeof entry!.description === 'string' && entry!.description.length > 0).toBe(true);
    }
    // safe_search is enum-typed.
    expect(schema['safe_search']!.enum).toContain('off');
    expect(schema['safe_search']!.enum).toContain('medium');
    expect(schema['safe_search']!.enum).toContain('high');
  });

  it('should expose response_prefix / response_postfix in parameter schema', () => {
    const schema = WebSearchSkill.getParameterSchema();
    // Python skill.py:587-595 ports — both keys must be documented string params.
    expect(schema['response_prefix']).toBeDefined();
    expect(schema['response_prefix']!.type).toBe('string');
    expect(schema['response_prefix']!.default).toBe('');
    expect(schema['response_postfix']).toBeDefined();
    expect(schema['response_postfix']!.type).toBe('string');
    expect(schema['response_postfix']!.default).toBe('');
  });
});

/**
 * Drive the WebSearchSkill handler's success path with a stubbed Google CSE
 * response and a stubbed scrape response, then assert how the new
 * response_prefix / response_postfix config wraps the result string.
 *
 * Mirrors the shape of Python's prefix/postfix tests in
 * `tests/unit/skills/test_native_vector_search_skill.py` (the canonical
 * pattern this commit mirrors per skill.py:587-595).
 */
describe('WebSearchSkill — response_prefix/response_postfix wrapping', () => {
  // Long, query-relevant HTML so _qualityMetrics scores above the default
  // 0.3 threshold and the success path actually executes.
  const QUALITY_HTML = `
    <html><body><article>
      <h1>Quality results about widgets and gizmos</h1>
      ${'<p>This is a substantive paragraph about widgets that discusses widgets in depth and explains how widgets work in various scenarios. Widgets are essential to gizmos and the relationship between widgets and gizmos is well-documented across many quality sources.</p>'.repeat(8)}
    </article></body></html>
  `;

  function installStubFetch(): () => void {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/customsearch/v1')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                title: 'Widget Guide',
                link: 'https://example.com/widgets',
                snippet: 'A guide to widgets.',
                displayLink: 'example.com',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      // Scrape target.
      return new Response(QUALITY_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as typeof fetch;
    return () => {
      globalThis.fetch = originalFetch;
    };
  }

  async function runHandler(extraConfig: Record<string, unknown>): Promise<string> {
    const restoreFetch = installStubFetch();
    try {
      const skill = new WebSearchSkill({
        api_key: 'test-key',
        search_engine_id: 'test-cx',
        // Low threshold so the stubbed page passes.
        min_quality_score: 0,
        // No delay between iterations in tests.
        delay: 0,
        ...extraConfig,
      });
      const handler = skill.getTools()[0]!.handler;
      const result = (await handler({ query: 'widgets gizmos' }, {})) as FunctionResult;
      return result.response;
    } finally {
      restoreFetch();
    }
  }

  it('omits wrapping when neither prefix nor postfix is set', async () => {
    const response = await runHandler({});
    expect(response.startsWith("Quality web search results for 'widgets gizmos':")).toBe(true);
    expect(response).not.toMatch(/^PREFIX\n\n/);
    expect(response).not.toMatch(/\n\nPOSTFIX$/);
  });

  it('prepends response_prefix on the success path', async () => {
    const response = await runHandler({ response_prefix: 'PREFIX-LINE' });
    expect(response.startsWith('PREFIX-LINE\n\n')).toBe(true);
    // Wrapped portion remains the canonical preamble.
    expect(response).toContain("Quality web search results for 'widgets gizmos':");
    expect(response.endsWith('POSTFIX')).toBe(false);
  });

  it('appends response_postfix on the success path', async () => {
    const response = await runHandler({ response_postfix: 'POSTFIX-LINE' });
    expect(response).toMatch(/\n\nPOSTFIX-LINE$/);
    expect(response.startsWith("Quality web search results for 'widgets gizmos':")).toBe(true);
  });

  it('applies both prefix and postfix when configured together', async () => {
    const response = await runHandler({
      response_prefix: 'PRE',
      response_postfix: 'POST',
    });
    expect(response.startsWith('PRE\n\n')).toBe(true);
    expect(response).toMatch(/\n\nPOST$/);
    expect(response).toContain("Quality web search results for 'widgets gizmos':");
  });

  it('does not wrap the error / "not configured" path', async () => {
    // No fetch stub — no API key/cx supplied so we hit the
    // "Service is not configured" branch which intentionally bypasses
    // prefix/postfix wrapping (mirrors Python: wrapping happens only on
    // the successful results branch).
    delete process.env['GOOGLE_SEARCH_API_KEY'];
    delete process.env['GOOGLE_SEARCH_ENGINE_ID'];
    delete process.env['GOOGLE_SEARCH_CX'];
    const skill = new WebSearchSkill({
      response_prefix: 'PRE',
      response_postfix: 'POST',
    });
    const handler = skill.getTools()[0]!.handler;
    const result = (await handler({ query: 'widgets' }, {})) as FunctionResult;
    expect(result.response.startsWith('PRE')).toBe(false);
    expect(result.response.endsWith('POST')).toBe(false);
    expect(result.response).toContain('not configured');
  });
});

/**
 * Schema advertisement for the latency-control params.
 *
 * Ports Python `tests/unit/skills/test_web_search_skill.py` (commit 295745b):
 * the four latency params plus response_prefix/postfix must all appear in the
 * advertised schema with the documented types and defaults. Guards the
 * recurring "added a setup() read but forgot the schema entry" drift class.
 */
describe('WebSearchSkill — latency-control schema', () => {
  it('advertises all six latency / response params with correct defaults', () => {
    const schema = WebSearchSkill.getParameterSchema();

    expect(schema['per_page_timeout']).toBeDefined();
    expect(schema['per_page_timeout']!.type).toBe('number');
    expect(schema['per_page_timeout']!.default).toBe(2.0);
    expect(schema['per_page_timeout']!.required).toBe(false);

    expect(schema['overall_deadline']).toBeDefined();
    expect(schema['overall_deadline']!.type).toBe('number');
    expect(schema['overall_deadline']!.default).toBe(10.0);
    expect(schema['overall_deadline']!.required).toBe(false);

    expect(schema['parallel_scrape']).toBeDefined();
    expect(schema['parallel_scrape']!.type).toBe('boolean');
    expect(schema['parallel_scrape']!.default).toBe(true);

    expect(schema['snippets_only']).toBeDefined();
    expect(schema['snippets_only']!.type).toBe('boolean');
    expect(schema['snippets_only']!.default).toBe(false);
  });

  it('advertises every setup-read param (drift guard, Python 295745b)', () => {
    const schema = WebSearchSkill.getParameterSchema();
    for (const key of [
      'response_prefix',
      'response_postfix',
      'per_page_timeout',
      'overall_deadline',
      'parallel_scrape',
      'snippets_only',
    ]) {
      expect(schema[key], `setup() reads '${key}' but schema omits it`).toBeDefined();
    }
  });
});

/**
 * Behavioral tests for the latency-control contract (Python 51101da):
 *   - snippets_only skips page scraping entirely.
 *   - overall_deadline truncates in-flight scrapes and falls back to a
 *     non-empty snippet response — even when a page fetch never resolves.
 *   - per_page_timeout aborts a single slow page fetch.
 *
 * All scrape latency is simulated with a fetch stub so the deadline path is
 * deterministic and fast. The stub honors AbortSignal (rejecting like real
 * fetch) so no scrape promise dangles after the handler returns.
 */
describe('WebSearchSkill — latency control (deadline / per_page_timeout / snippets_only)', () => {
  const CSE_ITEMS = [
    {
      title: 'Slow Site One',
      link: 'https://slow-one.example.com/page',
      snippet: 'First CSE snippet about widgets.',
      displayLink: 'slow-one.example.com',
    },
    {
      title: 'Slow Site Two',
      link: 'https://slow-two.example.com/page',
      snippet: 'Second CSE snippet about widgets.',
      displayLink: 'slow-two.example.com',
    },
  ];

  /**
   * Resolve after `ms`, but reject immediately if the signal aborts (mirrors
   * real fetch). When `ms` is non-finite the response never resolves on its
   * own — only an abort ends it. NOTE: `setTimeout(fn, Infinity)` is NOT a
   * never-firing timer — Node clamps out-of-range delays to 1ms — so the
   * never-resolve case must skip scheduling the resolve timer entirely.
   */
  function delayedResponse(
    factory: () => Response,
    ms: number,
    signal?: AbortSignal,
  ): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      const id = Number.isFinite(ms) ? setTimeout(() => resolve(factory()), ms) : undefined;
      const onAbort = () => {
        if (id !== undefined) clearTimeout(id);
        // Mirror real fetch: aborting rejects with an AbortError.
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      };
      if (signal) {
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener('abort', onAbort, { once: true });
        }
      }
    });
  }

  /**
   * Install a fetch stub. The CSE call resolves instantly; scrape calls are
   * delayed by `scrapeDelayMs` (default Infinity == never resolves until
   * aborted). `onScrape` is invoked for every non-CSE fetch so a test can
   * assert scraping was (or was not) attempted.
   */
  function installStubFetch(opts: {
    /** Uniform scrape delay (ms). Ignored if `scrapeDelayFor` is given. */
    scrapeDelayMs?: number;
    /** Per-URL scrape delay (ms). Return Infinity to never resolve. */
    scrapeDelayFor?: (url: string) => number;
    onScrape?: (url: string) => void;
  }): () => void {
    const original = globalThis.fetch;
    const uniformDelay = opts.scrapeDelayMs ?? Number.POSITIVE_INFINITY;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const signal = init?.signal ?? undefined;
      if (url.includes('/customsearch/v1')) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: CSE_ITEMS }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      opts.onScrape?.(url);
      // A scrape target. Serve quality HTML — but only after the configured
      // delay, so the deadline / per_page_timeout fires first when long.
      const html =
        '<html><body><article>' +
        '<p>Widgets and gizmos in depth. </p>'.repeat(40) +
        '</article></body></html>';
      const delay = opts.scrapeDelayFor ? opts.scrapeDelayFor(url) : uniformDelay;
      return delayedResponse(
        () =>
          new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          }),
        delay,
        signal ?? undefined,
      );
    }) as typeof fetch;
    return () => {
      globalThis.fetch = original;
    };
  }

  function makeSkill(extra: Record<string, unknown>): WebSearchSkill {
    return new WebSearchSkill({
      api_key: 'test-key',
      search_engine_id: 'test-cx',
      min_quality_score: 0,
      delay: 0,
      ...extra,
    });
  }

  it('snippets_only skips page scraping entirely (sub-second)', async () => {
    let scrapeCalls = 0;
    const restore = installStubFetch({
      // Even if a scrape were attempted, it would never resolve — proving the
      // fast path returned without touching it.
      scrapeDelayMs: Number.POSITIVE_INFINITY,
      onScrape: () => {
        scrapeCalls++;
      },
    });
    try {
      const skill = makeSkill({ snippets_only: true });
      const start = Date.now();
      const result = (await skill
        .getTools()[0]!
        .handler({ query: 'widgets gizmos' }, {})) as FunctionResult;
      const elapsed = Date.now() - start;

      expect(scrapeCalls).toBe(0); // no page fetch at all
      expect(result.response).toContain('Snippet-only results');
      expect(result.response).toContain('First CSE snippet about widgets.');
      expect(result.response.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(1000); // sub-second
    } finally {
      restore();
    }
  });

  it('overall_deadline truncates a never-resolving scrape and falls back to a non-empty snippet response', async () => {
    const restore = installStubFetch({
      // Scrape fetches never resolve on their own — only the deadline (or its
      // shared AbortController) can end them.
      scrapeDelayMs: Number.POSITIVE_INFINITY,
    });
    try {
      // 1.0s is the schema floor (Math.max(1000, …)); keep it small so the
      // test is fast but still meaningfully exercises the deadline.
      const skill = makeSkill({ overall_deadline: 1.0, parallel_scrape: true });
      const start = Date.now();
      const result = (await skill
        .getTools()[0]!
        .handler({ query: 'widgets gizmos' }, {})) as FunctionResult;
      const elapsed = Date.now() - start;

      // CONTRACT: returns within ~deadline + slack despite the hung fetch.
      expect(elapsed).toBeGreaterThanOrEqual(900);
      expect(elapsed).toBeLessThan(2500);
      // CONTRACT: non-empty snippet fallback (not the empty "no results" msg).
      expect(result.response).toContain('Snippet-only results');
      expect(result.response).toContain('First CSE snippet about widgets.');
      expect(result.response).not.toContain("couldn't find quality results");
      expect(result.response.length).toBeGreaterThan(0);
    } finally {
      restore();
    }
  }, 8000);

  it('overall_deadline is enforced in sequential mode too', async () => {
    const restore = installStubFetch({ scrapeDelayMs: Number.POSITIVE_INFINITY });
    try {
      const skill = makeSkill({ overall_deadline: 1.0, parallel_scrape: false });
      const start = Date.now();
      const result = (await skill
        .getTools()[0]!
        .handler({ query: 'widgets gizmos' }, {})) as FunctionResult;
      const elapsed = Date.now() - start;

      // Sequential: first page hangs until its per_page_timeout (default 2.0s)
      // OR the deadline; the 1.0s deadline must win and stop the loop, so we
      // never wait the full 2 pages × 2s.
      expect(elapsed).toBeLessThan(2500);
      expect(result.response).toContain('Snippet-only results');
      expect(result.response).toContain('First CSE snippet about widgets.');
    } finally {
      restore();
    }
  }, 8000);

  it('per_page_timeout aborts a single slow page fetch then falls back to snippets', async () => {
    // Each scrape resolves only after 5s, but per_page_timeout is 0.3s, so
    // every page is abandoned well before its body arrives. overall_deadline
    // is generous (10s default) — this isolates the per-page timeout.
    const restore = installStubFetch({ scrapeDelayMs: 5000 });
    try {
      const skill = makeSkill({
        per_page_timeout: 0.3,
        parallel_scrape: true,
      });
      const start = Date.now();
      const result = (await skill
        .getTools()[0]!
        .handler({ query: 'widgets gizmos' }, {})) as FunctionResult;
      const elapsed = Date.now() - start;

      // All page fetches aborted at ~0.3s; we never wait the 5s body delay.
      expect(elapsed).toBeLessThan(2000);
      expect(result.response).toContain('Snippet-only results');
      expect(result.response).toContain('First CSE snippet about widgets.');
    } finally {
      restore();
    }
  }, 8000);

  it('parallel success path still scrapes and returns full content (no premature deadline)', async () => {
    // Fast scrapes (50ms) under a generous deadline must produce the normal
    // fully-scraped response, proving the deadline machinery does not truncate
    // healthy runs.
    const restore = installStubFetch({ scrapeDelayMs: 50 });
    try {
      const skill = makeSkill({ overall_deadline: 10.0, parallel_scrape: true });
      const result = (await skill
        .getTools()[0]!
        .handler({ query: 'widgets gizmos' }, {})) as FunctionResult;

      expect(result.response.startsWith("Quality web search results for 'widgets gizmos':")).toBe(
        true,
      );
      expect(result.response).toContain('Content:');
      expect(result.response).not.toContain('Snippet-only results');
    } finally {
      restore();
    }
  }, 8000);

  it('parallel mode keeps a fast scrape even when a sibling hangs past the deadline', async () => {
    // best-effort harvest: site one returns in 100ms; site two never resolves.
    // With a 1.0s deadline the fast result is harvested before the deadline
    // truncates the hung one, so we get the fully-scraped response (NOT the
    // snippet fallback) carrying site one's content. Proves the parallel path
    // collects results incrementally rather than discarding the whole batch.
    const restore = installStubFetch({
      scrapeDelayFor: (url) => (url.includes('slow-one') ? 100 : Number.POSITIVE_INFINITY),
    });
    try {
      const skill = makeSkill({ overall_deadline: 1.0, parallel_scrape: true });
      const start = Date.now();
      const result = (await skill
        .getTools()[0]!
        .handler({ query: 'widgets gizmos' }, {})) as FunctionResult;
      const elapsed = Date.now() - start;

      // The fast page's content survived the deadline truncation.
      expect(result.response).toContain('Quality web search results');
      expect(result.response).toContain('Slow Site One');
      expect(result.response).toContain('Content:');
      expect(result.response).not.toContain('Snippet-only results');
      // Returned at ~deadline (the hung sibling forces the race to the timer).
      expect(elapsed).toBeGreaterThanOrEqual(900);
      expect(elapsed).toBeLessThan(2500);
    } finally {
      restore();
    }
  }, 8000);
});
