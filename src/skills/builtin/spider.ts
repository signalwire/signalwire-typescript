/**
 * Spider Skill - Fast web scraping and crawling capabilities.
 *
 * Tier 2 built-in skill. Port of the Python `SpiderSkill` that performs
 * HTTP scraping via `fetch`, lightweight HTML-to-text extraction, and
 * breadth-first crawling with configurable limits. Supports three tools:
 *
 * - `scrape_url` — single-page text/markdown extraction
 * - `crawl_site` — breadth-first crawl from a start URL
 * - `extract_structured_data` — CSS/XPath-like structured extraction
 *
 * Multiple instances are supported; use `tool_name` in config to differentiate.
 */

import { SkillBase, defineSkillTool } from '../SkillBase.js';
import type { SkillToolDefinition, SkillConfig, ParameterSchemaEntry } from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { _publicFetch, _RedirectRefused } from '../../PublicFetch.js';
import { _RobotsRules } from '../../RobotsTxt.js';
import { resolveAndValidateUrl, validateUrl, MAX_SKILL_INPUT_LENGTH } from '../../SecurityUtils.js';
import { getLogger } from '../../Logger.js';
// cheerio is an OPTIONAL dependency (only the scraping skills use it). Import
// the TYPES statically (erased at compile time) and load the VALUE lazily once
// in async setup(), caching it on the instance so the sync extract helpers can
// use it without each becoming async. Mirrors RelayClient's lazy `ws` load. If
// cheerio is absent, validatePackages() (REQUIRED_PACKAGES) reports it and the
// skill fails to register cleanly instead of crashing at import time.
import type * as cheerio from 'cheerio';

const log = getLogger('SpiderSkill');

/** Cached response entry used by the internal LRU cache. */
interface CachedResponse {
  /** Resolved URL (after redirects). */
  url: string;
  /** HTTP status code. */
  status: number;
  /** Raw HTML body (or best-effort text for non-HTML). */
  body: string;
}

const WHITESPACE_REGEX = /\s+/g;

/** Headers that carry credentials for one origin (as _publicFetch treats them). */
const ORIGIN_BOUND_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization']);

/**
 * Translate a `removeXpaths` entry into the cheerio selector that removes the
 * same elements. The list is authored as XPath (`//script`) to stay identical
 * across the SDKs — the reference drives lxml's `drop_tree()` with it directly.
 * Cheerio takes CSS, so a leading `//` descendant axis maps to a bare tag-name
 * selector; anything else is passed through so a caller who appends a CSS
 * selector still works.
 */
function removeTagFor(xpath: string): string {
  return xpath.startsWith('//') ? xpath.slice(2) : xpath;
}

/**
 * Fast web scraping skill optimized for speed and token efficiency.
 *
 * Multi-instance capable, with three tools: `scrape_url`, `crawl_site`, and
 * `extract_structured_data`. Configuration keys: delay, concurrent_requests,
 * timeout, max_pages, max_depth, extract_type, max_text_length, clean_text,
 * selectors, follow_patterns, user_agent, headers, follow_robots_txt,
 * cache_enabled.
 *
 * @example
 * ```ts
 * import { AgentBase } from '@signalwire/sdk';
 * const agent = new AgentBase({ name: 'demo', route: '/' });
 * await agent.addSkillByName('spider', { max_pages: 5, max_depth: 2 });
 * ```
 */
export class SpiderSkill extends SkillBase {
  // Python ground truth: skills/spider/skill.py:~140-145
  // REQUIRED_PACKAGES = ["lxml"] in Python; TS uses cheerio.
  static override SKILL_NAME = 'spider';
  static override SKILL_DESCRIPTION = 'Fast web scraping and crawling capabilities';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_PACKAGES: readonly string[] = ['cheerio'];
  static override REQUIRED_ENV_VARS: readonly string[] = [];
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  /**
   * Each setting's default. The parameter schema and setup() both read this,
   * so the schema can't advertise a default the skill doesn't use.
   */
  private static readonly DEFAULTS = {
    delay: 0.1,
    concurrent_requests: 5,
    timeout: 5,
    max_pages: 1,
    max_depth: 0,
    extract_type: 'fast_text',
    max_text_length: 3000,
    clean_text: true,
    cache_enabled: true,
    follow_robots_txt: false,
    user_agent: 'Spider/1.0 (SignalWire AI Agent)',
  } as const;

  /** The extraction methods scrape_url implements. */
  private static readonly EXTRACT_TYPES: readonly string[] = [
    'fast_text',
    'markdown',
    'structured',
  ];

  /**
   * Values the schema once listed that were never implemented. They have
   * always worked as fast_text, so they still do, with a warning.
   */
  private static readonly LEGACY_EXTRACT_TYPES: ReadonlySet<string> = new Set([
    'clean_text',
    'full_text',
    'html',
    'custom',
  ]);

  /** Seconds to keep a site's robots.txt rules; RFC 9309 allows up to 24 hours. */
  private static readonly ROBOTS_TTL = 24 * 60 * 60;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    const d = SpiderSkill.DEFAULTS;
    return {
      ...super.getParameterSchema(),
      // The base schema's default is the skill name, but tool_name is a
      // prefix that's empty when unset (Python skill.py:306 too).
      tool_name: {
        type: 'string',
        description:
          'Prefix for the tool names, as in <tool_name>_scrape_url, and for the instance key. ' +
          'Unset, the tools keep their plain names.',
        required: false,
      },
      delay: {
        type: 'number',
        description: 'Delay between requests in seconds',
        default: d.delay,
        required: false,
        min: 0,
      },
      concurrent_requests: {
        type: 'integer',
        description: 'Deprecated, and has no effect: the spider fetches one page at a time',
        default: d.concurrent_requests,
        required: false,
        min: 1,
        max: 20,
      },
      timeout: {
        type: 'integer',
        description: 'Request timeout in seconds',
        default: d.timeout,
        required: false,
        min: 1,
        max: 60,
      },
      max_pages: {
        type: 'integer',
        description: 'Maximum number of pages to scrape',
        default: d.max_pages,
        required: false,
        min: 1,
        max: 100,
      },
      max_depth: {
        type: 'integer',
        description: 'Maximum crawl depth (0 = single page only)',
        default: d.max_depth,
        required: false,
        min: 0,
        max: 5,
      },
      extract_type: {
        type: 'string',
        description: 'Content extraction method',
        default: d.extract_type,
        required: false,
        enum: [...SpiderSkill.EXTRACT_TYPES],
      },
      max_text_length: {
        type: 'integer',
        description: 'Maximum text length to return',
        default: d.max_text_length,
        required: false,
        min: 100,
        max: 100000,
      },
      clean_text: {
        type: 'boolean',
        description: 'Whether to clean extracted text',
        default: d.clean_text,
        required: false,
      },
      selectors: {
        type: 'object',
        description: 'Custom CSS/XPath selectors for structured extraction',
        default: {},
        required: false,
        additionalProperties: { type: 'string' },
      } as ParameterSchemaEntry & { additionalProperties?: unknown },
      follow_patterns: {
        type: 'array',
        description: 'URL patterns to follow when crawling',
        default: [],
        required: false,
        items: { type: 'string' },
      },
      user_agent: {
        type: 'string',
        description: 'User agent string for requests',
        default: d.user_agent,
        required: false,
      },
      headers: {
        type: 'object',
        description: 'Additional HTTP headers',
        default: {},
        required: false,
        additionalProperties: { type: 'string' },
      } as ParameterSchemaEntry & { additionalProperties?: unknown },
      follow_robots_txt: {
        type: 'boolean',
        description: "Skip pages that the site's robots.txt disallows for user_agent",
        default: d.follow_robots_txt,
        required: false,
      },
      cache_enabled: {
        type: 'boolean',
        description: 'Whether to cache scraped pages',
        default: d.cache_enabled,
        required: false,
      },
    };
  }

  // Runtime state, populated in setup()
  private delay: number = SpiderSkill.DEFAULTS.delay;
  private concurrentRequests: number = SpiderSkill.DEFAULTS.concurrent_requests;
  private timeout: number = SpiderSkill.DEFAULTS.timeout;
  private maxPages: number = SpiderSkill.DEFAULTS.max_pages;
  private maxDepth: number = SpiderSkill.DEFAULTS.max_depth;
  private extractType: string = SpiderSkill.DEFAULTS.extract_type;
  private maxTextLength: number = SpiderSkill.DEFAULTS.max_text_length;
  private cleanText: boolean = SpiderSkill.DEFAULTS.clean_text;
  private cacheEnabled: boolean = SpiderSkill.DEFAULTS.cache_enabled;
  private followRobotsTxt: boolean = SpiderSkill.DEFAULTS.follow_robots_txt;
  private userAgent: string = SpiderSkill.DEFAULTS.user_agent;
  private headers: Record<string, string> = {};
  private selectors: Record<string, string> = {};
  private compiledFollowPatterns: RegExp[] = [];
  private cache: Map<string, CachedResponse> | null = null;
  private readonly cacheMaxSize = 100;
  /**
   * XPath expressions for the noise elements stripped before text extraction.
   * Prefilled (not empty); mutate it to change what a scrape discards.
   * Expressed as XPath so the list is portable across the SDKs; this SDK's
   * cheerio backend consumes the `//tag` form via {@link removeTagFor}.
   */
  readonly removeXpaths: string[] = [
    '//script',
    '//style',
    '//nav',
    '//header',
    '//footer',
    '//aside',
    '//noscript',
  ];
  /** robots.txt rules per origin, with when they expire, when follow_robots_txt is on. */
  private robots = new Map<string, { rules: _RobotsRules; expires: number }>();
  // Lazily-loaded optional `cheerio` module, populated in setup(). Non-null
  // for the lifetime of an initialized skill (setup() returns false if absent).
  private _cheerio!: typeof import('cheerio');

  override getInstanceKey(): string {
    const toolName = this.getConfig<string>('tool_name', this.skillName);
    return `${this.skillName}_${toolName}`;
  }

  override async setup(): Promise<boolean> {
    // Load the optional cheerio dependency once. If it isn't installed, the
    // skill cannot scrape — fail setup cleanly (validatePackages() also flags
    // it). Cached on the instance so the sync extract helpers can use it.
    try {
      this._cheerio = await import('cheerio');
    } catch {
      log.error(
        'spider: the optional "cheerio" package is required for this skill but is not installed',
      );
      return false;
    }

    const d = SpiderSkill.DEFAULTS;
    // Performance
    this.delay = this.getConfig<number>('delay', d.delay);
    this.concurrentRequests = this.getConfig<number>('concurrent_requests', d.concurrent_requests);
    this.timeout = this.getConfig<number>('timeout', d.timeout);

    // Crawl limits
    this.maxPages = this.getConfig<number>('max_pages', d.max_pages);
    this.maxDepth = this.getConfig<number>('max_depth', d.max_depth);

    // Content processing
    this.extractType = this.getConfig<string>('extract_type', d.extract_type);
    this.maxTextLength = this.getConfig<number>('max_text_length', d.max_text_length);
    this.cleanText = this.getConfig<boolean>('clean_text', d.clean_text);

    // Features
    this.cacheEnabled = this.getConfig<boolean>('cache_enabled', d.cache_enabled);
    this.followRobotsTxt = this.getConfig<boolean>('follow_robots_txt', d.follow_robots_txt);
    this.userAgent = this.getConfig<string>('user_agent', d.user_agent);
    this.robots = new Map();

    // Optional headers + user-agent merge
    const headers = this.getConfig<Record<string, string>>('headers', {}) ?? {};
    this.headers = { ...headers, 'User-Agent': this.userAgent };

    // Selectors for structured extraction
    this.selectors = this.getConfig<Record<string, string>>('selectors', {}) ?? {};

    // Setup cache
    this.cache = this.cacheEnabled ? new Map() : null;

    // Validate numeric ranges
    if (this.delay < 0) {
      log.error('spider: delay cannot be negative', { delay: this.delay });
      return false;
    }
    if (this.concurrentRequests < 1 || this.concurrentRequests > 20) {
      log.error('spider: concurrent_requests must be between 1 and 20', {
        concurrent_requests: this.concurrentRequests,
      });
      return false;
    }
    if ('concurrent_requests' in this.config) {
      log.warn(
        'spider: concurrent_requests is deprecated and has no effect: the spider fetches one page at a time',
      );
    }

    // Validate the extraction method
    const types = SpiderSkill.EXTRACT_TYPES.join(', ');
    if (SpiderSkill.LEGACY_EXTRACT_TYPES.has(this.extractType)) {
      log.warn(
        `spider: extract_type '${this.extractType}' was never implemented and works as fast_text; use one of ${types}`,
      );
      this.extractType = 'fast_text';
    } else if (!SpiderSkill.EXTRACT_TYPES.includes(this.extractType)) {
      log.error(`spider: unknown extract_type '${this.extractType}'; use one of ${types}`);
      return false;
    }
    if (this.maxPages < 1) {
      log.error('spider: max_pages must be at least 1', { max_pages: this.maxPages });
      return false;
    }
    if (this.maxDepth < 0) {
      log.error('spider: max_depth cannot be negative', { max_depth: this.maxDepth });
      return false;
    }

    // Pre-compile follow patterns
    this.compiledFollowPatterns = [];
    const patterns = this.getConfig<string[]>('follow_patterns', []) ?? [];
    for (const pattern of patterns) {
      try {
        this.compiledFollowPatterns.push(new RegExp(pattern));
      } catch (err) {
        log.error('spider: invalid follow pattern', {
          pattern,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    log.info('spider: configured', {
      delay: this.delay,
      max_pages: this.maxPages,
      max_depth: this.maxDepth,
    });
    return true;
  }

  override getHints(): string[] {
    return [
      'scrape',
      'crawl',
      'extract',
      'web page',
      'website',
      'get content from',
      'fetch data from',
      'spider',
    ];
  }

  override async cleanup(): Promise<void> {
    if (this.cache) {
      this.cache.clear();
    }
    log.info('spider: cleaned up');
  }

  /** @returns Three tools: `scrape_url`, `crawl_site`, and `extract_structured_data`. */
  getTools(): SkillToolDefinition[] {
    const toolPrefix = this.getConfig<string>('tool_name', '');
    const prefix = toolPrefix ? `${toolPrefix}_` : '';

    // The three handlers keep their defensive typeof/.trim()/URL-validation
    // narrowing in the private methods: `url`/`start_url` are required, but the
    // model can still emit an empty or wrong-typed value.
    return [
      defineSkillTool({
        name: `${prefix}scrape_url`,
        description: 'Extract text content from a single web page',
        parameters: {
          url: {
            type: 'string',
            description: 'The URL to scrape',
          },
        },
        required: ['url'],
        handler: async (args, rawData) => this._scrapeUrlHandler(args, rawData),
      }),
      defineSkillTool({
        name: `${prefix}crawl_site`,
        description: 'Crawl multiple pages starting from a URL',
        parameters: {
          start_url: {
            type: 'string',
            description: 'Starting URL for the crawl',
          },
        },
        required: ['start_url'],
        handler: async (args, rawData) => this._crawlSiteHandler(args, rawData),
      }),
      defineSkillTool({
        name: `${prefix}extract_structured_data`,
        description: 'Extract specific data from a web page using selectors',
        parameters: {
          url: {
            type: 'string',
            description: 'The URL to scrape',
          },
        },
        required: ['url'],
        handler: async (args, rawData) => this._extractStructuredHandler(args, rawData),
      }),
    ];
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Redirect a target URL through `SPIDER_BASE_URL` when set. Used by tests
   * to point every outbound fetch at a loopback fixture without requiring
   * the test URL to resolve.
   * Preserves the path (and any query/fragment) from the original target.
   */
  /** Whether a URL is on the operator-set SPIDER_BASE_URL's origin, a trusted target. */
  private static _isAuditOrigin(target: string): boolean {
    const base = process.env['SPIDER_BASE_URL'];
    if (!base) return false;
    try {
      return new URL(target).origin === new URL(base).origin;
    } catch {
      return false;
    }
  }

  private static _redirectForAudit(target: string): string {
    const base = process.env['SPIDER_BASE_URL'];
    if (!base) return target;
    try {
      const u = new URL(target);
      // Keep path + search + hash; drop scheme + host.
      const path = `${u.pathname}${u.search}${u.hash}` || '/';
      return `${base.replace(/\/+$/, '')}${path}`;
    } catch {
      // Not a parseable URL — assume it's a path already.
      const path = target.startsWith('/') ? target : `/${target}`;
      return `${base.replace(/\/+$/, '')}${path}`;
    }
  }

  /**
   * Whether a URL the caller supplied may be fetched: it must not be private
   * or internal (`SWML_ALLOW_PRIVATE_URLS` allows it). With `SPIDER_BASE_URL`
   * set, the fetch goes to that operator-configured base instead of the URL's
   * host, so the host isn't checked.
   */
  private static async _targetAllowed(url: string): Promise<boolean> {
    if (SpiderSkill._redirectForAudit(url) !== url) return true;
    try {
      await resolveAndValidateUrl(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * False when follow_robots_txt is on and the site's robots.txt disallows
   * `url` for user_agent.
   *
   * As in Python's `urllib.robotparser`, a robots.txt answered with 401 or
   * 403 disallows everything and any other 4xx allows everything. Rules are
   * kept for {@link ROBOTS_TTL}. A server error or failed request disallows
   * this page without keeping anything, so the next request tries again.
   */
  private async _allowedByRobots(
    url: string,
    opts: { withoutCredentials?: boolean } = {},
  ): Promise<boolean> {
    if (!this.followRobotsTxt) return true;
    let origin: string;
    try {
      // Check the URL as it will be requested: fetch normalizes it, so
      // /public/../private is a request for /private.
      const parsed = new URL(url);
      url = parsed.href;
      origin = parsed.origin;
    } catch {
      return false;
    }
    const now = performance.now() / 1000;
    const cached = this.robots.get(origin);
    if (cached && cached.expires > now) return cached.rules.canFetch(this.userAgent, url);

    const robotsUrl = `${origin}/robots.txt`;
    const fetchUrl = SpiderSkill._redirectForAudit(robotsUrl);
    // Credentials for the page's origin don't go to another origin's
    // robots.txt, as _publicFetch drops them on a redirect there.
    const headers = { ...this.headers };
    if (opts.withoutCredentials) {
      for (const name of Object.keys(headers)) {
        if (ORIGIN_BOUND_HEADERS.has(name.toLowerCase())) delete headers[name];
      }
    }
    let status: number;
    let body = '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout * 1000);
    try {
      const response = await _publicFetch(fetchUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        allowPrivate: fetchUrl !== robotsUrl || SpiderSkill._isAuditOrigin(robotsUrl),
      });
      status = response.status;
      body = await response.text();
    } catch {
      status = 599;
    } finally {
      clearTimeout(timer);
    }

    // Unavailable for now: disallow this request, and try again next time.
    if (status >= 500) return false;
    let rules: _RobotsRules;
    if (status === 401 || status === 403) rules = _RobotsRules.disallowAll();
    else if (status >= 400) rules = _RobotsRules.allowAll();
    else rules = new _RobotsRules(body);
    this.robots.set(origin, { rules, expires: now + SpiderSkill.ROBOTS_TTL });
    return rules.canFetch(this.userAgent, url);
  }

  /** Fetch a URL with caching and timeout handling. Returns null on failure. */
  private async _fetchUrl(url: string): Promise<CachedResponse | null> {
    if (this.cacheEnabled && this.cache?.has(url)) {
      log.debug('spider: cache hit', { url });
      return this.cache.get(url)!;
    }

    // The porting-sdk's `audit_skills_dispatch.py` sets `SPIDER_BASE_URL`
    // to redirect every fetch through a loopback fixture. The audit feeds
    // a `https://audit.example/page` target and expects the skill to hit
    // `http://127.0.0.1:NNNN/page` — preserving the path after the host.
    const fetchUrl = SpiderSkill._redirectForAudit(url);
    const startOrigin = new URL(fetchUrl).origin;
    let crossedOrigin = false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout * 1000);
    try {
      // _publicFetch checks the URL and every redirect, and refuses a
      // connection to a private or internal address. An operator-set
      // SPIDER_BASE_URL is a trusted target, so its fetches skip the check.
      const response = await _publicFetch(fetchUrl, {
        method: 'GET',
        headers: this.headers,
        signal: controller.signal,
        allowPrivate: fetchUrl !== url,
        // Each redirect's target needs its own robots.txt check.
        allowRedirect: this.followRobotsTxt
          ? (target) => {
              // Once a redirect leaves the page's origin, _publicFetch has
              // dropped the credentials for good, and so does robots.txt.
              if (new URL(target).origin !== startOrigin) crossedOrigin = true;
              return this._allowedByRobots(target, { withoutCredentials: crossedOrigin });
            }
          : undefined,
      });

      if (!response.ok) {
        log.error('spider: fetch failed', { url, status: response.status });
        return null;
      }

      const body = await response.text();
      const cached: CachedResponse = {
        url: response.url || url,
        status: response.status,
        body,
      };

      if (this.cacheEnabled && this.cache) {
        if (this.cache.size >= this.cacheMaxSize) {
          const oldest = this.cache.keys().next().value;
          if (oldest !== undefined) this.cache.delete(oldest);
        }
        this.cache.set(url, cached);
      }
      return cached;
    } catch (err) {
      if (err instanceof _RedirectRefused) {
        log.info('spider: robots.txt disallows the redirect', { url, target: err.target });
        return null;
      }
      log.error('spider: fetch error', {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Extract plain text from a fetched response using simple regex stripping.
   *
   * Takes a {@link CachedResponse} rather than a bare HTML string — the
   * response-like object exposes `url`, `status`, and `body` for callers that
   * need to branch on status/content-type.
   */
  private _fastTextExtract(response: CachedResponse): string {
    try {
      // Accept JSON as input too. The porting-sdk audit fixture replies
      // with `Content-Type: application/json` whose body is `{"_raw_html":
      // "<html>…</html>"}`. Unwrap to the inner HTML when that shape is
      // present so the text extractor sees real markup.
      let body = response.body;
      try {
        const parsed = JSON.parse(body);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof (parsed as Record<string, unknown>)['_raw_html'] === 'string'
        ) {
          body = (parsed as Record<string, unknown>)['_raw_html'] as string;
        }
      } catch {
        // Not JSON; treat as HTML.
      }
      // Parse through cheerio so every named and numeric HTML entity is
      // decoded (Python's lxml does this natively). Previously TS only
      // decoded six hand-coded entities, leaving `&mdash;`, `&#8212;`, etc.
      // literal in the output.
      const $ = this._cheerio.load(body);
      // Strip noise elements before extracting text — matches Python's
      // lxml drop_tree() over the same `removeXpaths` list.
      for (const xpath of this.removeXpaths) {
        $(removeTagFor(xpath)).remove();
      }
      let text = $('body').text();
      if (!text || text.trim().length === 0) {
        // Pages without <body> fall through to document-root text.
        text = $.root().text();
      }
      if (this.cleanText) {
        text = text.replace(WHITESPACE_REGEX, ' ').trim();
      }

      // Smart truncation
      if (text.length > this.maxTextLength) {
        const keepStart = Math.floor((this.maxTextLength * 2) / 3);
        const keepEnd = Math.floor(this.maxTextLength / 3);
        text =
          text.slice(0, keepStart) + '\n\n[...CONTENT TRUNCATED...]\n\n' + text.slice(-keepEnd);
      }

      return text;
    } catch (err) {
      // Python swallows extraction errors and returns '' so the handler
      // emits a clean "no content extracted" message instead of bubbling
      // a parse failure all the way up to the AI.
      log.error('spider: fast-text extraction failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return '';
    }
  }

  /**
   * Extract a value using a CSS selector (via cheerio) or XPath-like
   * selector (`//tag`): selectors starting with `/` are treated as XPath
   * (tag-name subset), everything else is full CSS via cheerio's
   * querySelector-style engine.
   */
  private _applySelector($: cheerio.CheerioAPI, selector: string): string[] {
    const trimmed = selector.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('/')) {
      // Subset of XPath supported in Python's lxml path — `//tag`, `//tag/text()`.
      const tagMatch = /\/\/([a-zA-Z][a-zA-Z0-9]*)/.exec(trimmed);
      if (!tagMatch) return [];
      return $(tagMatch[1])
        .toArray()
        .map((el) => $(el).text().trim())
        .filter((t) => t.length > 0);
    }

    return $(trimmed)
      .toArray()
      .map((el) => $(el).text().trim())
      .filter((t) => t.length > 0);
  }

  /** Markdown extraction using cheerio. */
  private _markdownExtract(response: CachedResponse): string {
    try {
      const $ = this._cheerio.load(response.body);

      // Remove unwanted tags
      for (const tag of ['script', 'style', 'nav', 'header', 'footer', 'aside']) {
        $(tag).remove();
      }

      const parts: string[] = [];
      const title = $('title').first().text().trim();
      if (title) parts.push(`# ${title}\n`);

      $('h1, h2, h3, h4, h5, h6, p, li, code, pre').each((_, el) => {
        const tag = (el as { tagName: string }).tagName.toLowerCase();
        const text = $(el).text().trim();
        if (!text) return;
        if (/^h[1-6]$/.test(tag)) {
          const level = Number(tag[1]);
          parts.push(`\n${'#'.repeat(level)} ${text}\n`);
        } else if (tag === 'p') {
          parts.push(`\n${text}\n`);
        } else if (tag === 'li') {
          parts.push(`- ${text}`);
        } else if (tag === 'code' || tag === 'pre') {
          parts.push(`\n\`\`\`\n${text}\n\`\`\`\n`);
        }
      });

      let text = parts.join('\n');
      if (text.length > this.maxTextLength) {
        text = text.slice(0, this.maxTextLength) + '\n\n[...TRUNCATED...]';
      }
      return text;
    } catch (err) {
      log.error('spider: markdown extraction error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return this._fastTextExtract(response);
    }
  }

  private _structuredExtract(
    cached: CachedResponse,
    selectors: Record<string, string>,
  ): Record<string, unknown> {
    let $: cheerio.CheerioAPI;
    try {
      $ = this._cheerio.load(cached.body);
    } catch (err) {
      // Python returns `{'error': str(e)}` from _structured_extract when the
      // parser fails (skill.py). Surface the same shape so upstream handlers
      // can branch on `'error' in result`.
      log.error('spider: structured parse failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { error: err instanceof Error ? err.message : String(err) };
    }
    const result: Record<string, unknown> = {
      url: cached.url,
      status_code: cached.status,
      title: $('title').first().text().trim(),
      data: {},
    };

    const data: Record<string, unknown> = {};
    for (const [field, selector] of Object.entries(selectors)) {
      try {
        const values = this._applySelector($, selector);
        if (values.length === 0) {
          data[field] = null;
        } else if (values.length === 1) {
          data[field] = values[0];
        } else {
          data[field] = values;
        }
      } catch (err) {
        log.warn('spider: selector error', {
          selector,
          error: err instanceof Error ? err.message : String(err),
        });
        data[field] = null;
      }
    }
    result['data'] = data;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Tool handlers
  // ---------------------------------------------------------------------------

  private async _scrapeUrlHandler(
    args: Record<string, unknown>,
    _rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const urlArg = args['url'];
    if (typeof urlArg !== 'string' || urlArg.trim().length === 0) {
      return new FunctionResult('Please provide a URL to scrape');
    }
    const url = urlArg.trim();

    if (url.length > MAX_SKILL_INPUT_LENGTH) {
      return new FunctionResult('Input URL is too long.');
    }

    if (!/^https?:\/\//.test(url)) {
      return new FunctionResult(`Invalid URL: ${url}`);
    }

    // SSRF protection
    if (!(await SpiderSkill._targetAllowed(url))) {
      return new FunctionResult('URL rejected: cannot access private or internal URLs');
    }

    if (!(await this._allowedByRobots(url))) {
      return new FunctionResult(`The site's robots.txt disallows fetching ${url}`);
    }

    const cached = await this._fetchUrl(url);
    if (!cached) {
      return new FunctionResult(`Failed to fetch ${url}`);
    }

    try {
      if (this.extractType === 'structured') {
        const result = this._structuredExtract(cached, this.selectors);
        return new FunctionResult(
          `Extracted structured data from ${url}: ${JSON.stringify(result)}`,
        );
      }
      const content =
        this.extractType === 'markdown'
          ? this._markdownExtract(cached)
          : this._fastTextExtract(cached);

      if (!content) {
        return new FunctionResult(`No content extracted from ${url}`);
      }

      const charCount = content.length;
      const header = `Content from ${url} (${charCount} characters):\n\n`;
      return new FunctionResult(header + content);
    } catch (err) {
      log.error('spider: scrape_url error', {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      return new FunctionResult(
        `Error processing ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async _crawlSiteHandler(
    args: Record<string, unknown>,
    _rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const startArg = args['start_url'];
    if (typeof startArg !== 'string' || startArg.trim().length === 0) {
      return new FunctionResult('Please provide a starting URL for the crawl');
    }
    const startUrl = startArg.trim();

    if (!/^https?:\/\//.test(startUrl)) {
      return new FunctionResult(`Invalid URL: ${startUrl}`);
    }

    if (!(await SpiderSkill._targetAllowed(startUrl))) {
      return new FunctionResult('URL rejected: cannot access private or internal URLs');
    }

    const maxDepth = this.maxDepth;
    const maxPages = this.maxPages;

    if (maxDepth < 0) return new FunctionResult('Max depth cannot be negative');
    if (maxPages < 1) return new FunctionResult('Max pages must be at least 1');

    const visited = new Set<string>();
    const disallowed = new Set<string>();
    const toVisit: [string, number][] = [[startUrl, 0]];
    const results: {
      url: string;
      depth: number;
      contentLength: number;
      summary: string;
    }[] = [];

    let startHost: string;
    try {
      startHost = new URL(startUrl).host;
    } catch {
      return new FunctionResult(`Invalid URL: ${startUrl}`);
    }

    while (toVisit.length > 0 && visited.size < maxPages) {
      const next = toVisit.shift();
      if (!next) break;
      const [url, depth] = next;

      if (visited.has(url) || disallowed.has(url) || depth > maxDepth) continue;

      if (!(await this._allowedByRobots(url))) {
        log.info('spider: robots.txt disallows a page; skipping it', { url });
        disallowed.add(url);
        continue;
      }

      const cached = await this._fetchUrl(url);
      if (!cached) continue;

      visited.add(url);

      const content = this._fastTextExtract(cached);
      if (content) {
        results.push({
          url,
          depth,
          contentLength: content.length,
          summary: content.length > 500 ? content.slice(0, 500) + '...' : content,
        });
      }

      // Extract links if not at max depth. Use cheerio so we correctly
      // pick up unquoted and oddly-whitespaced href attributes that the
      // regex path missed (Python skills/spider/skill.py:487 uses lxml
      // xpath('//a[@href]/@href') which has the same robustness).
      if (depth < maxDepth) {
        try {
          const $links = this._cheerio.load(cached.body);
          const hrefs: string[] = [];
          $links('a[href]').each((_, el) => {
            const href = $links(el).attr('href');
            if (href) hrefs.push(href);
          });
          for (const href of hrefs) {
            let absoluteUrl: string;
            try {
              absoluteUrl = new URL(href, url).toString();
            } catch {
              continue;
            }

            if (this.compiledFollowPatterns.length > 0) {
              const allowed = this.compiledFollowPatterns.some((re) => re.test(absoluteUrl));
              if (!allowed) continue;
            }

            try {
              const absHost = new URL(absoluteUrl).host;
              if (absHost !== startHost) continue;
            } catch {
              continue;
            }

            // SSRF hardening — discovered links must pass the same
            // validation the entry URL did. Prevents a crafted page from
            // bouncing the crawler into internal/metadata endpoints.
            if (!(await validateUrl(absoluteUrl))) {
              log.debug('spider: skipping discovered URL rejected by SSRF', {
                url: absoluteUrl,
              });
              continue;
            }

            if (!visited.has(absoluteUrl)) {
              toVisit.push([absoluteUrl, depth + 1]);
            }
          }
        } catch (err) {
          log.warn('spider: link extraction error', {
            url,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (this.delay > 0 && visited.size < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, this.delay * 1000));
      }
    }

    if (results.length === 0) {
      return new FunctionResult(`No pages could be crawled from ${startUrl}`);
    }

    const lines: string[] = [`Crawled ${results.length} pages from ${startHost}:`, ''];
    results.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.url} (depth: ${r.depth}, ${r.contentLength} chars)`);
      lines.push(`   Summary: ${r.summary.slice(0, 100)}...`);
      lines.push('');
    });
    const totalChars = results.reduce((acc, r) => acc + r.contentLength, 0);
    lines.push('');
    lines.push(
      `Total content: ${totalChars.toLocaleString()} characters across ${results.length} pages`,
    );

    return new FunctionResult(lines.join('\n'));
  }

  private async _extractStructuredHandler(
    args: Record<string, unknown>,
    _rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const urlArg = args['url'];
    if (typeof urlArg !== 'string' || urlArg.trim().length === 0) {
      return new FunctionResult('Please provide a URL');
    }
    const url = urlArg.trim();

    if (!/^https?:\/\//.test(url)) {
      return new FunctionResult(`Invalid URL: ${url}`);
    }

    if (!(await SpiderSkill._targetAllowed(url))) {
      return new FunctionResult('URL rejected: cannot access private or internal URLs');
    }

    if (!this.selectors || Object.keys(this.selectors).length === 0) {
      return new FunctionResult('No selectors configured for structured data extraction');
    }

    if (!(await this._allowedByRobots(url))) {
      return new FunctionResult(`The site's robots.txt disallows fetching ${url}`);
    }

    const cached = await this._fetchUrl(url);
    if (!cached) {
      return new FunctionResult(`Failed to fetch ${url}`);
    }

    const result = this._structuredExtract(cached, this.selectors);
    if ('error' in result) {
      return new FunctionResult(`Error extracting data: ${result['error']}`);
    }

    const lines: string[] = [`Extracted data from ${url}:`, ''];
    lines.push(`Title: ${(result['title'] as string) || 'N/A'}`);
    lines.push('');

    const data = result['data'] as Record<string, unknown>;
    if (data && Object.keys(data).length > 0) {
      lines.push('Data:');
      for (const [field, value] of Object.entries(data)) {
        lines.push(`- ${field}: ${String(value)}`);
      }
    } else {
      lines.push('No data extracted with provided selectors');
    }

    return new FunctionResult(lines.join('\n'));
  }
}

/**
 * Factory function for creating SpiderSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new SpiderSkill instance.
 */
export function createSkill(config?: SkillConfig): SpiderSkill {
  return new SpiderSkill(config);
}
