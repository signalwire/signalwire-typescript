/**
 * Individual tests for the WebSearch skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { WebSearchSkill, createWebSearchSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

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
    expect(tools[0].name).toBe('web_search');
    expect(tools[0].required).toContain('query');
  });

  it('should provide prompt sections', () => {
    const sections = new WebSearchSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toContain('Web Search');
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
    const handler = new WebSearchSkill().getTools()[0].handler;
    const result = await handler({ query: 'test' }, {}) as FunctionResult;
    expect(result.response).toContain('not configured');
  });

  it('should reject empty query', async () => {
    const handler = new WebSearchSkill().getTools()[0].handler;
    const result = await handler({ query: '' }, {}) as FunctionResult;
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
      'num_results', 'tool_name', 'no_results_message', 'safe_search',
      'delay', 'max_content_length', 'oversample_factor', 'min_quality_score',
    ];
    const validTypes = new Set([
      'string', 'integer', 'number', 'boolean', 'array', 'object',
    ]);
    for (const key of required) {
      const entry = schema[key];
      expect(entry, `schema.${key} missing`).toBeDefined();
      expect(validTypes.has(entry.type), `schema.${key}.type invalid`).toBe(true);
      expect(typeof entry.description === 'string' && entry.description.length > 0)
        .toBe(true);
    }
    // safe_search is enum-typed.
    expect(schema['safe_search'].enum).toContain('off');
    expect(schema['safe_search'].enum).toContain('medium');
    expect(schema['safe_search'].enum).toContain('high');
  });

  it('should expose response_prefix / response_postfix in parameter schema', () => {
    const schema = WebSearchSkill.getParameterSchema();
    // Python skill.py:587-595 ports — both keys must be documented string params.
    expect(schema['response_prefix']).toBeDefined();
    expect(schema['response_prefix'].type).toBe('string');
    expect(schema['response_prefix'].default).toBe('');
    expect(schema['response_postfix']).toBeDefined();
    expect(schema['response_postfix'].type).toBe('string');
    expect(schema['response_postfix'].default).toBe('');
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
      const handler = skill.getTools()[0].handler;
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
    const handler = skill.getTools()[0].handler;
    const result = (await handler({ query: 'widgets' }, {})) as FunctionResult;
    expect(result.response.startsWith('PRE')).toBe(false);
    expect(result.response.endsWith('POST')).toBe(false);
    expect(result.response).toContain('not configured');
  });
});
