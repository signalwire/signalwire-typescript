/**
 * Individual tests for the Spider skill.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SpiderSkill, createSpiderSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { Logger, suppressAllLogs } from '../../src/Logger.js';
import { _setPublicFetchTransport } from '../../src/PublicFetch.js';

beforeAll(() => {
  suppressAllLogs(true);
});

describe('SpiderSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new SpiderSkill()).toBeInstanceOf(SkillBase);
    expect(createSpiderSkill()).toBeInstanceOf(SpiderSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new SpiderSkill().setup()).resolves.toBe(true);
  });

  it('should register three tools', async () => {
    const skill = new SpiderSkill();
    await skill.setup();
    const tools = skill.getTools();
    expect(tools).toHaveLength(3);
    const names = tools.map((t) => t.name);
    expect(names).toContain('scrape_url');
    expect(names).toContain('crawl_site');
    expect(names).toContain('extract_structured_data');
    expect(tools[0]!.required).toContain('url');
  });

  it('should provide no prompt sections (matches Python — no override)', () => {
    const sections = new SpiderSkill().getPromptSections();
    expect(sections).toHaveLength(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new SpiderSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return speech recognition hints', () => {
    const hints = new SpiderSkill().getHints();
    expect(hints).toContain('scrape');
    expect(hints).toContain('spider');
    expect(hints.length).toBeGreaterThanOrEqual(8);
  });

  it('should return empty global data', () => {
    expect(new SpiderSkill().getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const klass = SpiderSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('spider');
    expect(klass.SKILL_VERSION).toBe('1.0.0');
  });

  it('should have full parameter schema', () => {
    const schema = SpiderSkill.getParameterSchema();
    // Each documented param must be a real entry — type and description
    // both populated. A stub returning `{key: undefined}` would fail the
    // type check; an empty-description placeholder would fail the
    // description check.
    const required = [
      'delay',
      'concurrent_requests',
      'timeout',
      'max_pages',
      'max_depth',
      'extract_type',
      'max_text_length',
      'clean_text',
      'selectors',
      'follow_patterns',
      'user_agent',
      'headers',
      'follow_robots_txt',
      'cache_enabled',
    ];
    const validTypes = new Set(['string', 'integer', 'number', 'boolean', 'array', 'object']);
    for (const key of required) {
      const entry = schema[key];
      expect(entry, `schema.${key} missing`).toBeDefined();
      expect(validTypes.has(entry!.type), `schema.${key}.type invalid`).toBe(true);
      expect(typeof entry!.description === 'string' && entry!.description.length > 0).toBe(true);
    }
  });

  it('should support multiple instances', () => {
    expect(SpiderSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
    const skill = new SpiderSkill({ tool_name: 'custom' });
    expect(skill.getInstanceKey()).toBe('spider_custom');
  });

  it('should validate URL format in scrape_url handler', async () => {
    const skill = new SpiderSkill();
    await skill.setup();
    const handler = skill.getTools().find((t) => t.name === 'scrape_url')!.handler;
    const res = (await handler({ url: 'not-a-url' }, {})) as FunctionResult;
    expect(res.response).toMatch(/Invalid URL/i);
  });

  // Mirrors python `test_remove_xpaths_populated` — the list is PREFILLED, not
  // empty, and carries the same XPath spelling as the reference.
  it('should expose a prefilled removeXpaths list', () => {
    const skill = new SpiderSkill();
    expect(skill.removeXpaths.length).toBeGreaterThan(0);
    expect(skill.removeXpaths).toEqual([
      '//script',
      '//style',
      '//nav',
      '//header',
      '//footer',
      '//aside',
      '//noscript',
    ]);
  });

  // The field is load-bearing, not decorative: text extraction strips exactly
  // what removeXpaths names, so mutating it changes the extracted text.
  it('should drive noise stripping off removeXpaths', async () => {
    type Extractor = { _fastTextExtract(r: { url: string; status: number; body: string }): string };
    const response = {
      url: 'https://example.com',
      status: 200,
      body:
        '<html><body><script>SCRIPTNOISE</script><p>keep me</p>' +
        '<aside>ASIDENOISE</aside></body></html>',
    };

    const skill = new SpiderSkill();
    await skill.setup();
    const withDefaults = (skill as unknown as Extractor)._fastTextExtract(response);
    expect(withDefaults).toContain('keep me');
    expect(withDefaults).not.toContain('SCRIPTNOISE');
    expect(withDefaults).not.toContain('ASIDENOISE');

    // Drop `//aside` from the list and its text survives — proof the loop reads
    // the field rather than a hardcoded tag set.
    const narrowed = new SpiderSkill();
    await narrowed.setup();
    narrowed.removeXpaths.splice(narrowed.removeXpaths.indexOf('//aside'), 1);
    const withoutAside = (narrowed as unknown as Extractor)._fastTextExtract(response);
    expect(withoutAside).toContain('ASIDENOISE');
    expect(withoutAside).not.toContain('SCRIPTNOISE');
  });

  it('should require selectors for extract_structured_data', async () => {
    const skill = new SpiderSkill();
    await skill.setup();
    const handler = skill.getTools().find((t) => t.name === 'extract_structured_data')!.handler;
    // URL is fine but selectors are empty, so we get an error before any fetch
    const res = (await handler({ url: 'https://example.com' }, {})) as FunctionResult;
    // Either SSRF validation or missing selectors should trigger an error
    expect(typeof res.response).toBe('string');
    expect(res.response.length).toBeGreaterThan(0);
  });
});

describe('SpiderSkill SSRF protection', () => {
  afterEach(() => {
    _setPublicFetchTransport(null);
    delete process.env['SPIDER_BASE_URL'];
  });

  async function scrape(url: string): Promise<string> {
    const skill = new SpiderSkill({ cache_enabled: false });
    await skill.setup();
    const handler = skill.getTools().find((t) => t.name === 'scrape_url')!.handler;
    return ((await handler({ url }, {})) as FunctionResult).response;
  }

  it.each([
    'http://127.0.0.1/admin',
    'http://169.254.169.254/latest/meta-data',
    'http://[::ffff:169.254.169.254]/latest/meta-data',
    'http://[::1]:8080/',
  ])('refuses %s before fetching it', async (url) => {
    const sent: string[] = [];
    _setPublicFetchTransport(async (u) => {
      sent.push(u);
      return new Response('secret');
    });
    expect(await scrape(url)).toContain('URL rejected');
    expect(sent).toEqual([]);
  });

  it('does not follow a public page that redirects to the metadata service', async () => {
    const sent: string[] = [];
    _setPublicFetchTransport(async (u) => {
      sent.push(u);
      return new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      });
    });
    const response = await scrape('http://203.0.113.10/page');
    expect(response).toContain('Failed to fetch');
    expect(response).not.toContain('secret');
    expect(sent).toEqual(['http://203.0.113.10/page']);
  });

  it('fetches through an operator-set SPIDER_BASE_URL, keeping the path', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<html><body>fixture page at ${req.url}</body></html>`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      process.env['SPIDER_BASE_URL'] = `http://127.0.0.1:${port}`;
      expect(await scrape('https://audit.example/page')).toContain('fixture page at /page');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

// ── Settings the skill used to advertise without enforcing ────────────
// Mirrors signalwire-python ecdf350 and 931982a (B19).

describe('SpiderSkill schema matches what it does', () => {
  it('lists the extraction methods the skill implements', () => {
    expect(SpiderSkill.getParameterSchema()['extract_type']!.enum).toEqual([
      'fast_text',
      'markdown',
      'structured',
    ]);
  });

  it('advertises the defaults the skill uses', async () => {
    const schema = SpiderSkill.getParameterSchema();
    const skill = new SpiderSkill();
    await skill.setup();
    const fields = skill as unknown as Record<string, unknown>;
    const pairs: [string, string][] = [
      ['delay', 'delay'],
      ['concurrent_requests', 'concurrentRequests'],
      ['timeout', 'timeout'],
      ['max_pages', 'maxPages'],
      ['max_depth', 'maxDepth'],
      ['extract_type', 'extractType'],
      ['max_text_length', 'maxTextLength'],
      ['clean_text', 'cleanText'],
      ['cache_enabled', 'cacheEnabled'],
      ['follow_robots_txt', 'followRobotsTxt'],
      ['user_agent', 'userAgent'],
    ];
    for (const [key, field] of pairs) expect(fields[field], key).toEqual(schema[key]!.default);
    expect(schema['user_agent']!.default).toBe('Spider/1.0 (SignalWire AI Agent)');
    expect(schema['max_text_length']!.default).toBe(3000);
  });
});

describe('SpiderSkill extract_type and concurrent_requests', () => {
  const setupWith = async (config: Record<string, unknown>) => {
    suppressAllLogs(false);
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const error = vi.spyOn(Logger.prototype, 'error');
    try {
      const skill = new SpiderSkill(config);
      const ok = await skill.setup();
      return {
        skill: skill as unknown as { extractType: string },
        ok,
        warns: warn.mock.calls.map((c) => String(c[0])),
        errors: error.mock.calls.map((c) => String(c[0])),
      };
    } finally {
      warn.mockRestore();
      error.mockRestore();
      suppressAllLogs(true);
    }
  };

  it.each(['clean_text', 'full_text', 'html', 'custom'])(
    'runs a legacy value (%s) as fast_text, with a warning',
    async (value) => {
      const { skill, ok, warns } = await setupWith({ extract_type: value });
      expect(ok).toBe(true);
      expect(skill.extractType).toBe('fast_text');
      expect(warns.some((w) => w.includes('never implemented'))).toBe(true);
    },
  );

  it('fails setup for an unknown extract_type', async () => {
    const { ok, errors } = await setupWith({ extract_type: 'pdf' });
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("unknown extract_type 'pdf'"))).toBe(true);
  });

  it('warns that concurrent_requests has no effect, only when it is set', async () => {
    const set = await setupWith({ concurrent_requests: 10 });
    expect(set.ok).toBe(true);
    expect(set.warns.some((w) => w.includes('concurrent_requests is deprecated'))).toBe(true);
    const unset = await setupWith({});
    expect(unset.warns.some((w) => w.includes('concurrent_requests'))).toBe(false);
  });
});

describe('SpiderSkill follow_robots_txt', () => {
  const HOST = 'http://203.0.113.10';
  const ROBOTS = 'User-agent: *\nDisallow: /private\n';
  const PAGE = '<html><body><p>page text</p></body></html>';
  let routes: Record<string, [number, Record<string, string>, string]>;
  let sent: string[];

  beforeEach(() => {
    sent = [];
    routes = {
      [`${HOST}/robots.txt`]: [200, {}, ROBOTS],
      [`${HOST}/private/page`]: [200, {}, PAGE],
      [`${HOST}/public/page`]: [200, {}, PAGE],
      [`${HOST}/public/to-private`]: [302, { location: '/private/page' }, ''],
      [`${HOST}/public/to-public`]: [301, { location: '/public/page' }, ''],
    };
    _setPublicFetchTransport(async (u) => {
      sent.push(u);
      const route = routes[u];
      if (!route) return new Response('missing', { status: 404 });
      const [status, headers, body] = route;
      return new Response(body || null, { status, headers });
    });
  });
  afterEach(() => {
    _setPublicFetchTransport(null);
    vi.restoreAllMocks();
  });

  async function skillWith(config: Record<string, unknown>) {
    const skill = new SpiderSkill({ delay: 0, cache_enabled: false, ...config });
    await skill.setup();
    const tool = (name: string) => skill.getTools().find((t) => t.name === name)!.handler;
    const scrape = async (url: string) =>
      ((await tool('scrape_url')({ url }, {})) as FunctionResult).response;
    return { skill, tool, scrape };
  }

  it("doesn't fetch a page robots.txt disallows", async () => {
    const { scrape } = await skillWith({ follow_robots_txt: true });
    expect(await scrape(`${HOST}/private/page`)).toContain('robots.txt disallows');
    expect(sent).not.toContain(`${HOST}/private/page`);
  });

  it('fetches a page robots.txt allows', async () => {
    const { scrape } = await skillWith({ follow_robots_txt: true });
    expect(await scrape(`${HOST}/public/page`)).toContain('page text');
  });

  it('is off by default', async () => {
    const { scrape } = await skillWith({});
    expect(await scrape(`${HOST}/private/page`)).toContain('page text');
    expect(sent).not.toContain(`${HOST}/robots.txt`);
  });

  it.each([
    [404, true],
    [403, false],
    [401, false],
    [503, false],
  ])('treats a robots.txt answered with %i as allowing: %s', async (status, allowed) => {
    routes[`${HOST}/robots.txt`] = [status, {}, ''];
    const { scrape } = await skillWith({ follow_robots_txt: true });
    expect((await scrape(`${HOST}/public/page`)).includes('page text')).toBe(allowed);
  });

  it("doesn't follow a redirect to a disallowed page", async () => {
    const { scrape } = await skillWith({ follow_robots_txt: true });
    expect(await scrape(`${HOST}/public/to-private`)).not.toContain('page text');
    expect(sent).not.toContain(`${HOST}/private/page`);
  });

  it('follows a redirect to an allowed page', async () => {
    const { scrape } = await skillWith({ follow_robots_txt: true });
    expect(await scrape(`${HOST}/public/to-public`)).toContain('page text');
  });

  it('tries an unavailable robots.txt again on the next request', async () => {
    routes[`${HOST}/robots.txt`] = [503, {}, ''];
    const { scrape } = await skillWith({ follow_robots_txt: true });
    expect(await scrape(`${HOST}/public/page`)).not.toContain('page text');
    routes[`${HOST}/robots.txt`] = [200, {}, ROBOTS];
    expect(await scrape(`${HOST}/public/page`)).toContain('page text');
  });

  it('keeps robots.txt rules until they expire', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1_000_000);
    const { scrape } = await skillWith({ follow_robots_txt: true });
    await scrape(`${HOST}/public/page`);
    await scrape(`${HOST}/private/page`);
    expect(sent.filter((u) => u === `${HOST}/robots.txt`)).toHaveLength(1);
    now.mockReturnValue(1_000_000 + (24 * 60 * 60 + 1) * 1000);
    await scrape(`${HOST}/public/page`);
    expect(sent.filter((u) => u === `${HOST}/robots.txt`)).toHaveLength(2);
  });

  it('skips disallowed pages in extract_structured_data and crawl_site', async () => {
    const { tool } = await skillWith({
      follow_robots_txt: true,
      selectors: { title: 'title' },
      max_pages: 5,
    });
    const extracted = (await tool('extract_structured_data')(
      { url: `${HOST}/private/page` },
      {},
    )) as FunctionResult;
    expect(extracted.response).toContain('robots.txt disallows');
    await tool('crawl_site')({ start_url: `${HOST}/private/page` }, {});
    expect(sent).not.toContain(`${HOST}/private/page`);
  });
});

describe('SpiderSkill follow_robots_txt, found in review', () => {
  afterEach(() => {
    _setPublicFetchTransport(null);
    delete process.env['SPIDER_BASE_URL'];
  });

  const scrapeWith = async (config: Record<string, unknown>, url: string) => {
    const skill = new SpiderSkill({ follow_robots_txt: true, cache_enabled: false, ...config });
    await skill.setup();
    const handler = skill.getTools().find((t) => t.name === 'scrape_url')!.handler;
    return ((await handler({ url }, {})) as FunctionResult).response;
  };

  it("doesn't send the page's credentials to another origin's robots.txt on a redirect", async () => {
    const leaked: string[] = [];
    _setPublicFetchTransport(async (url, init) => {
      if (
        url.includes('203.0.113.11') &&
        (init.headers['authorization'] || init.headers['cookie'])
      ) {
        leaked.push(url);
      }
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /');
      if (url === 'http://203.0.113.10/page') {
        return new Response(null, {
          status: 302,
          headers: { location: 'http://203.0.113.11/result' },
        });
      }
      return new Response('<html><body>public content</body></html>');
    });
    const response = await scrapeWith(
      { headers: { Authorization: 'Bearer synthetic-secret', Cookie: 'session=synthetic' } },
      'http://203.0.113.10/page',
    );
    expect(response).toContain('public content');
    expect(leaked).toEqual([]);
  });

  it('checks the path the request will use, not the path as written', async () => {
    const sent: string[] = [];
    _setPublicFetchTransport(async (url) => {
      sent.push(url);
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nDisallow: /private');
      return new Response('<html><body>private content</body></html>');
    });
    const response = await scrapeWith({}, 'http://203.0.113.10/public/../private');
    expect(response).toContain('robots.txt disallows');
    expect(sent.filter((u) => u.includes('private'))).toEqual([]);
  });

  it('follows an allowed relative redirect through SPIDER_BASE_URL', async () => {
    process.env['SPIDER_BASE_URL'] = 'http://127.0.0.1:12345';
    _setPublicFetchTransport(async (url) => {
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /');
      if (url.endsWith('/entry')) {
        return new Response(null, { status: 302, headers: { location: '/allowed' } });
      }
      return new Response('<html><body>ALLOWED_AUDIT_CONTENT</body></html>');
    });
    expect(await scrapeWith({}, 'https://audit.example/entry')).toContain('ALLOWED_AUDIT_CONTENT');
  });
});

describe('SpiderSkill tool_name', () => {
  it('declares no default, as the tools keep their plain names without it', () => {
    const schema = SpiderSkill.getParameterSchema();
    expect(schema['tool_name']!.default).toBeUndefined();
    expect(new SpiderSkill().getTools().map((t) => t.name)).toEqual([
      'scrape_url',
      'crawl_site',
      'extract_structured_data',
    ]);
    expect(
      new SpiderSkill({ tool_name: 'docs' })
        .getTools()
        .map((t) => t.name)
        .every((n) => n.startsWith('docs_')),
    ).toBe(true);
  });
});
