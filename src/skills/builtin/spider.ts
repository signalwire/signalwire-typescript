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

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { resolveAndValidateUrl, MAX_SKILL_INPUT_LENGTH } from '../../SecurityUtils.js';
import { getLogger } from '../../Logger.js';

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

/** Tags stripped from HTML before text extraction. */
const STRIP_TAG_REGEXES: RegExp[] = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<style\b[^>]*>[\s\S]*?<\/style>/gi,
  /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
  /<header\b[^>]*>[\s\S]*?<\/header>/gi,
  /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
  /<aside\b[^>]*>[\s\S]*?<\/aside>/gi,
  /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
];

/**
 * Fast web scraping skill optimized for speed and token efficiency.
 *
 * Multi-instance capable. Port of the Python `SpiderSkill` with three tools:
 * `scrape_url`, `crawl_site`, and `extract_structured_data`. Configuration
 * mirrors the Python schema (delay, concurrent_requests, timeout, max_pages,
 * max_depth, extract_type, max_text_length, clean_text, selectors,
 * follow_patterns, user_agent, headers, follow_robots_txt, cache_enabled).
 */
export class SpiderSkill extends SkillBase {
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      delay: {
        type: 'number',
        description: 'Delay between requests in seconds',
        default: 0.1,
        required: false,
        min: 0,
      },
      concurrent_requests: {
        type: 'integer',
        description: 'Number of concurrent requests allowed',
        default: 5,
        required: false,
        min: 1,
        max: 20,
      },
      timeout: {
        type: 'integer',
        description: 'Request timeout in seconds',
        default: 5,
        required: false,
        min: 1,
        max: 60,
      },
      max_pages: {
        type: 'integer',
        description: 'Maximum number of pages to scrape',
        default: 1,
        required: false,
        min: 1,
        max: 100,
      },
      max_depth: {
        type: 'integer',
        description: 'Maximum crawl depth (0 = single page only)',
        default: 0,
        required: false,
        min: 0,
        max: 5,
      },
      extract_type: {
        type: 'string',
        description: 'Content extraction method',
        default: 'fast_text',
        required: false,
        enum: ['fast_text', 'clean_text', 'full_text', 'html', 'custom'],
      },
      max_text_length: {
        type: 'integer',
        description: 'Maximum text length to return',
        default: 3000,
        required: false,
        min: 100,
        max: 100000,
      },
      clean_text: {
        type: 'boolean',
        description: 'Whether to clean extracted text',
        default: true,
        required: false,
      },
      selectors: {
        type: 'object',
        description: 'Custom CSS/XPath selectors for structured extraction',
        default: {},
        required: false,
      },
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
        default: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        required: false,
      },
      headers: {
        type: 'object',
        description: 'Additional HTTP headers',
        default: {},
        required: false,
      },
      follow_robots_txt: {
        type: 'boolean',
        description: 'Whether to respect robots.txt',
        default: true,
        required: false,
      },
      cache_enabled: {
        type: 'boolean',
        description: 'Whether to cache scraped pages',
        default: true,
        required: false,
      },
    };
  }

  // Runtime state, populated in setup()
  private delay = 0.1;
  private concurrentRequests = 5;
  private timeout = 5;
  private maxPages = 1;
  private maxDepth = 0;
  private extractType = 'fast_text';
  private maxTextLength = 3000;
  private cleanText = true;
  private cacheEnabled = true;
  private followRobotsTxt = true;
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private headers: Record<string, string> = {};
  private selectors: Record<string, string> = {};
  private compiledFollowPatterns: RegExp[] = [];
  private cache: Map<string, CachedResponse> | null = null;
  private readonly cacheMaxSize = 100;

  /**
   * @param config - Optional configuration; see `getParameterSchema()` for accepted keys.
   */
  constructor(config?: SkillConfig) {
    super('spider', config);
  }

  override getInstanceKey(): string {
    const toolName = this.getConfig<string>('tool_name', this.skillName);
    return `${this.skillName}_${toolName}`;
  }

  override async setup(): Promise<boolean> {
    // Performance
    this.delay = this.getConfig<number>('delay', 0.1);
    this.concurrentRequests = this.getConfig<number>('concurrent_requests', 5);
    this.timeout = this.getConfig<number>('timeout', 5);

    // Crawl limits
    this.maxPages = this.getConfig<number>('max_pages', 1);
    this.maxDepth = this.getConfig<number>('max_depth', 0);

    // Content processing
    this.extractType = this.getConfig<string>('extract_type', 'fast_text');
    // Python has an internal inconsistency (schema: 10000, __init__ fallback:
    // 3000). The effective runtime default is 3000 because Python reads via
    // `self.params.get('max_text_length', 3000)` and schema defaults are not
    // applied. Use 3000 for parity. Follow-up: reconcile Python schema vs init.
    this.maxTextLength = this.getConfig<number>('max_text_length', 3000);
    this.cleanText = this.getConfig<boolean>('clean_text', true);

    // Features
    this.cacheEnabled = this.getConfig<boolean>('cache_enabled', true);
    this.followRobotsTxt = this.getConfig<boolean>('follow_robots_txt', false);
    this.userAgent = this.getConfig<string>(
      'user_agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );

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
      log.error(
        'spider: concurrent_requests must be between 1 and 20',
        { concurrent_requests: this.concurrentRequests },
      );
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
  }

  /** @returns Manifest describing the Spider skill capabilities and config. */
  getManifest(): SkillManifest {
    return {
      name: 'spider',
      description: 'Fast web scraping and crawling capabilities',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['scraping', 'web', 'spider', 'content', 'extraction'],
      requiredEnvVars: [],
    };
  }

  /** @returns Three tools: `scrape_url`, `crawl_site`, and `extract_structured_data`. */
  getTools(): SkillToolDefinition[] {
    const toolPrefix = this.getConfig<string>('tool_name', '');
    const prefix = toolPrefix ? `${toolPrefix}_` : '';

    return [
      {
        name: `${prefix}scrape_url`,
        description: 'Extract text content from a single web page',
        parameters: {
          url: {
            type: 'string',
            description: 'The URL to scrape',
          },
        },
        required: ['url'],
        handler: async (args: Record<string, unknown>) => this._scrapeUrlHandler(args),
      },
      {
        name: `${prefix}crawl_site`,
        description: 'Crawl multiple pages starting from a URL',
        parameters: {
          start_url: {
            type: 'string',
            description: 'Starting URL for the crawl',
          },
        },
        required: ['start_url'],
        handler: async (args: Record<string, unknown>) => this._crawlSiteHandler(args),
      },
      {
        name: `${prefix}extract_structured_data`,
        description: 'Extract specific data from a web page using selectors',
        parameters: {
          url: {
            type: 'string',
            description: 'The URL to scrape',
          },
        },
        required: ['url'],
        handler: async (args: Record<string, unknown>) =>
          this._extractStructuredHandler(args),
      },
    ];
  }

  /** @returns Prompt section describing web scraping capabilities and content limits. */
  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Web Page Scraping',
        body: 'You can scrape and extract content from web pages.',
        bullets: [
          'Use the scrape_url tool to fetch content from any public web page.',
          'Use the crawl_site tool to crawl multiple pages starting from a URL.',
          'Use the extract_structured_data tool with configured selectors for structured data.',
          'Provide a full URL starting with http:// or https://.',
          `Text content is limited to ${this.maxTextLength} characters.`,
          'Summarize the scraped content for the user rather than reading it verbatim.',
        ],
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Fetch a URL with caching and timeout handling. Returns null on failure. */
  private async _fetchUrl(url: string): Promise<CachedResponse | null> {
    if (this.cacheEnabled && this.cache?.has(url)) {
      log.debug('spider: cache hit', { url });
      return this.cache.get(url)!;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout * 1000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        signal: controller.signal,
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
      log.error('spider: fetch error', {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Extract plain text from an HTML body using simple regex stripping. */
  private _fastTextExtract(html: string): string {
    let stripped = html;
    for (const re of STRIP_TAG_REGEXES) {
      stripped = stripped.replace(re, ' ');
    }
    // Remove all remaining tags
    stripped = stripped.replace(/<[^>]+>/g, ' ');
    // HTML entity decode (basic)
    stripped = stripped
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    let text = stripped;
    if (this.cleanText) {
      text = text.replace(WHITESPACE_REGEX, ' ').trim();
    }

    // Smart truncation
    if (text.length > this.maxTextLength) {
      const keepStart = Math.floor((this.maxTextLength * 2) / 3);
      const keepEnd = Math.floor(this.maxTextLength / 3);
      text =
        text.slice(0, keepStart) +
        '\n\n[...CONTENT TRUNCATED...]\n\n' +
        text.slice(-keepEnd);
    }

    return text;
  }

  /**
   * Extract a value for a CSS-like or XPath-like selector. Returns best-effort text
   * from elements matched by a very small subset of selectors (tag name, `.class`,
   * `#id`, or attribute-based `[attr="value"]`).
   */
  private _applySimpleSelector(html: string, selector: string): string[] {
    // Very small CSS selector engine — tag name or tag + class/id selector
    // Patterns like: "h1", "title", ".foo", "#id", "div.classname", "meta[name='description']"
    const trimmedSel = selector.trim();
    if (!trimmedSel) return [];

    // Support XPath-like selectors like "//title/text()" by extracting tag names
    if (trimmedSel.startsWith('/')) {
      const tagMatch = /\/\/([a-zA-Z][a-zA-Z0-9]*)/.exec(trimmedSel);
      if (tagMatch) {
        return this._extractTagText(html, tagMatch[1]);
      }
      return [];
    }

    // ID selector: #id
    const idMatch = /^#([a-zA-Z][\w-]*)$/.exec(trimmedSel);
    if (idMatch) {
      const id = idMatch[1];
      const re = new RegExp(
        `<([a-zA-Z][a-zA-Z0-9]*)[^>]*\\bid\\s*=\\s*["']${this._escapeRegex(id)}["'][^>]*>([\\s\\S]*?)</\\1>`,
        'gi',
      );
      return this._collectInnerText(html, re);
    }

    // Class selector: .class
    const classMatch = /^\.([a-zA-Z][\w-]*)$/.exec(trimmedSel);
    if (classMatch) {
      const cls = classMatch[1];
      const re = new RegExp(
        `<([a-zA-Z][a-zA-Z0-9]*)[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${this._escapeRegex(cls)}\\b[^"']*["'][^>]*>([\\s\\S]*?)</\\1>`,
        'gi',
      );
      return this._collectInnerText(html, re);
    }

    // Tag with attribute: tag[attr="value"]
    const tagAttrMatch =
      /^([a-zA-Z][a-zA-Z0-9]*)\[([a-zA-Z_][\w-]*)\s*=\s*["']([^"']*)["']\]$/.exec(
        trimmedSel,
      );
    if (tagAttrMatch) {
      const [, tag, attr, value] = tagAttrMatch;
      const re = new RegExp(
        `<${tag}[^>]*\\b${attr}\\s*=\\s*["']${this._escapeRegex(value)}["'][^>]*>([\\s\\S]*?)</${tag}>`,
        'gi',
      );
      return this._collectInnerText(html, re, 1);
    }

    // Simple tag: h1, p, title, ...
    const tagMatch = /^([a-zA-Z][a-zA-Z0-9]*)$/.exec(trimmedSel);
    if (tagMatch) {
      return this._extractTagText(html, tagMatch[1]);
    }

    return [];
  }

  private _extractTagText(html: string, tag: string): string[] {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    return this._collectInnerText(html, re, 1);
  }

  private _collectInnerText(
    html: string,
    re: RegExp,
    groupIndex = 2,
  ): string[] {
    const results: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const inner = match[groupIndex] ?? match[match.length - 1] ?? '';
      const text = inner
        .replace(/<[^>]+>/g, ' ')
        .replace(WHITESPACE_REGEX, ' ')
        .trim();
      if (text) results.push(text);
    }
    return results;
  }

  private _escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private _structuredExtract(
    cached: CachedResponse,
    selectors: Record<string, string>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {
      url: cached.url,
      status_code: cached.status,
      title: '',
      data: {},
    };

    const titleMatches = this._extractTagText(cached.body, 'title');
    if (titleMatches.length > 0) result['title'] = titleMatches[0];

    const data: Record<string, unknown> = {};
    for (const [field, selector] of Object.entries(selectors)) {
      try {
        const values = this._applySimpleSelector(cached.body, selector);
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
    const allowPrivate = process.env['SWML_ALLOW_PRIVATE_URLS'] === 'true';
    try {
      await resolveAndValidateUrl(url, allowPrivate);
    } catch {
      return new FunctionResult(
        'URL rejected: cannot access private or internal URLs',
      );
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
      // All other extract types fall through to fast-text-like extraction
      const content = this._fastTextExtract(cached.body);

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
  ): Promise<FunctionResult> {
    const startArg = args['start_url'];
    if (typeof startArg !== 'string' || startArg.trim().length === 0) {
      return new FunctionResult('Please provide a starting URL for the crawl');
    }
    const startUrl = startArg.trim();

    if (!/^https?:\/\//.test(startUrl)) {
      return new FunctionResult(`Invalid URL: ${startUrl}`);
    }

    const allowPrivate = process.env['SWML_ALLOW_PRIVATE_URLS'] === 'true';
    try {
      await resolveAndValidateUrl(startUrl, allowPrivate);
    } catch {
      return new FunctionResult(
        'URL rejected: cannot access private or internal URLs',
      );
    }

    const maxDepth = this.maxDepth;
    const maxPages = this.maxPages;

    if (maxDepth < 0) return new FunctionResult('Max depth cannot be negative');
    if (maxPages < 1) return new FunctionResult('Max pages must be at least 1');

    const visited = new Set<string>();
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

      if (visited.has(url) || depth > maxDepth) continue;

      const cached = await this._fetchUrl(url);
      if (!cached) continue;

      visited.add(url);

      const content = this._fastTextExtract(cached.body);
      if (content) {
        results.push({
          url,
          depth,
          contentLength: content.length,
          summary:
            content.length > 500 ? content.slice(0, 500) + '...' : content,
        });
      }

      // Extract links if not at max depth
      if (depth < maxDepth) {
        try {
          const hrefRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
          let match: RegExpExecArray | null;
          while ((match = hrefRe.exec(cached.body)) !== null) {
            let absoluteUrl: string;
            try {
              absoluteUrl = new URL(match[1], url).toString();
            } catch {
              continue;
            }

            if (this.compiledFollowPatterns.length > 0) {
              const allowed = this.compiledFollowPatterns.some((re) =>
                re.test(absoluteUrl),
              );
              if (!allowed) continue;
            }

            try {
              const absHost = new URL(absoluteUrl).host;
              if (absHost !== startHost) continue;
            } catch {
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

    const lines: string[] = [
      `Crawled ${results.length} pages from ${startHost}:`,
      '',
    ];
    results.forEach((r, i) => {
      lines.push(
        `${i + 1}. ${r.url} (depth: ${r.depth}, ${r.contentLength} chars)`,
      );
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
  ): Promise<FunctionResult> {
    const urlArg = args['url'];
    if (typeof urlArg !== 'string' || urlArg.trim().length === 0) {
      return new FunctionResult('Please provide a URL');
    }
    const url = urlArg.trim();

    if (!/^https?:\/\//.test(url)) {
      return new FunctionResult(`Invalid URL: ${url}`);
    }

    const allowPrivate = process.env['SWML_ALLOW_PRIVATE_URLS'] === 'true';
    try {
      await resolveAndValidateUrl(url, allowPrivate);
    } catch {
      return new FunctionResult(
        'URL rejected: cannot access private or internal URLs',
      );
    }

    if (!this.selectors || Object.keys(this.selectors).length === 0) {
      return new FunctionResult(
        'No selectors configured for structured data extraction',
      );
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
