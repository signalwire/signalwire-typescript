/**
 * Web Search Skill - Searches the web using the Google Custom Search API.
 *
 * Tier 3 built-in skill: requires `GOOGLE_SEARCH_API_KEY` and
 * `GOOGLE_SEARCH_ENGINE_ID` (legacy alias: `GOOGLE_SEARCH_CX`) environment
 * variables, or the equivalent config params. Uses the Google Custom Search
 * JSON API to perform web searches and return formatted results.
 */

import { SkillBase, defineSkillTool } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { MAX_SKILL_INPUT_LENGTH, validateUrl } from '../../SecurityUtils.js';
import { getLogger } from '../../Logger.js';
// cheerio is an OPTIONAL dependency (only the web_search / spider scraping
// skills use it). Import the TYPES statically (erased at compile time, zero
// runtime cost) and load the VALUE lazily via `await import('cheerio')` at the
// point of use — mirroring how RelayClient lazy-loads `ws`. A consumer who
// never scrapes never loads cheerio; if it is absent, `validatePackages()`
// (REQUIRED_PACKAGES below) reports it cleanly instead of crashing.

const log = getLogger('WebSearchSkill');

const DEFAULT_NO_RESULTS_MESSAGE =
  "I couldn't find quality results for '{query}'. " +
  'The search returned only low-quality or inaccessible pages. ' +
  'Try rephrasing your search or asking about a different topic.';

/** Selector priority — Python skill.py:220-228. */
const CONTENT_CANDIDATES = [
  'article',
  'main',
  '[role="main"]',
  '.content',
  '#content',
  '.post',
  '.entry-content',
  '.article-body',
  '.story-body',
  '.markdown-body',
  '.wiki-body',
  '.documentation',
] as const;

/** Structural tags removed from the picked subtree — Python skill.py:239. */
const UNWANTED_TAGS = [
  'script',
  'style',
  'nav',
  'header',
  'footer',
  'aside',
  'noscript',
  'iframe',
] as const;

/** Class/id name patterns removed from the picked subtree — Python skill.py:245-257. */
const UNWANTED_PATTERNS = [
  'sidebar',
  'navigation',
  'menu',
  'advertisement',
  'ads',
  'banner',
  'popup',
  'modal',
  'cookie',
  'gdpr',
  'subscribe',
  'newsletter',
  'comments',
  'related',
  'share',
  'social',
] as const;

/**
 * Run the HTML → plain-text extraction pipeline that mirrors Python's
 * `GoogleSearchScraper.extract_html_content` (skill.py:204-282).
 *
 * Pipeline:
 * 1. Pre-process `<![CDATA[…]]>` sections to plain text (Python html.parser
 *    keeps CDATA content; cheerio/htmlparser2 drops it).
 * 2. Walk {@link CONTENT_CANDIDATES} in order, picking the first match.
 *    Fall back to `<body>` or the raw document.
 * 3. Clone the picked subtree so tag/pattern removal only affects it —
 *    analogous to Python's `content_soup = BeautifulSoup(str(main_content))`.
 *    The selector-first-then-filter order is load-bearing: if the real
 *    content is wrapped in a sidebar-pattern div, Python still finds it
 *    because the selector runs before removal.
 * 4. Remove {@link UNWANTED_TAGS} and every element matching any of
 *    {@link UNWANTED_PATTERNS} on either `class` or `id` (case-insensitive).
 * 5. Collapse whitespace and trim.
 *
 * Exported so the skill's test suite can verify byte-identical
 * behavior against Python BeautifulSoup fixtures; not re-exported
 * from the skills barrel, so this stays internal to the skill module.
 *
 * @internal
 */
export async function extractTextFromHtml(html: string): Promise<string> {
  const cheerio = await import('cheerio');
  const normalized = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, content: string) => content);
  const $ = cheerio.load(normalized);

  let pickedHtml = '';
  for (const sel of CONTENT_CANDIDATES) {
    const picked = $(sel).first();
    if (picked.length > 0) {
      pickedHtml = $.html(picked);
      break;
    }
  }
  if (!pickedHtml) {
    const bodyEl = $('body').first();
    pickedHtml = bodyEl.length > 0 ? $.html(bodyEl) : normalized;
  }

  const $sub = cheerio.load(pickedHtml);

  for (const tag of UNWANTED_TAGS) {
    $sub(tag).remove();
  }

  for (const pattern of UNWANTED_PATTERNS) {
    const regex = new RegExp(pattern, 'i');
    $sub('[class]').each((_, el) => {
      const cls = $sub(el).attr('class') ?? '';
      if (regex.test(cls)) $sub(el).remove();
    });
    $sub('[id]').each((_, el) => {
      const id = $sub(el).attr('id') ?? '';
      if (regex.test(id)) $sub(el).remove();
    });
  }

  return $sub.root().text().replace(/\s+/g, ' ').trim();
}

/** A single search result item from the Google Custom Search API. */
interface GoogleSearchItem {
  /** Title of the search result. */
  title: string;
  /** URL of the search result. */
  link: string;
  /** Brief text snippet from the page. */
  snippet: string;
  /** Display-friendly domain name. */
  displayLink?: string;
  /** Structured page metadata. */
  pagemap?: Record<string, unknown>;
}

/** Response shape from the Google Custom Search JSON API. */
interface GoogleSearchResponse {
  /** Array of search result items. */
  items?: GoogleSearchItem[];
  /** Metadata about the search execution. */
  searchInformation?: {
    totalResults: string;
    searchTime: number;
    formattedTotalResults: string;
    formattedSearchTime: string;
  };
  /** Error details if the request failed. */
  error?: {
    code: number;
    message: string;
    errors: Array<{ message: string; domain: string; reason: string }>;
  };
}

/**
 * Searches the web using the Google Custom Search JSON API.
 *
 * Tier 3 built-in skill. Credentials can be supplied via the `api_key` and
 * `search_engine_id` params or `GOOGLE_SEARCH_API_KEY` /
 * `GOOGLE_SEARCH_ENGINE_ID` (legacy: `GOOGLE_SEARCH_CX`) environment variables.
 *
 * The handler mirrors Python's `search_and_scrape_best` pipeline: fetches
 * `oversample_factor × num_results` candidates from Google, scrapes each
 * result page (SSRF-guarded, cheerio-based text extraction), scores for
 * quality (length + query relevance + boilerplate penalty), deduplicates by
 * domain, and returns the top `num_results` above `min_quality_score` with
 * full page content. If every scrape fails or falls below the threshold the
 * handler falls back to raw API snippets so the agent still has something
 * to say.
 *
 * Supported config: `tool_name`, `num_results`, `no_results_message`,
 * `safe_search`, `delay`, `max_content_length`, `oversample_factor`,
 * `min_quality_score`, `response_prefix`, `response_postfix`, and the
 * latency-control params `per_page_timeout`, `overall_deadline`,
 * `parallel_scrape`, `snippets_only` (Python skill.py commits 51101da +
 * 295745b). When the overall deadline fires or no scraped page meets the
 * quality threshold, the handler falls back to formatting the CSE snippets.
 *
 * @example
 * ```ts
 * import { AgentBase } from '@signalwire/sdk';
 * const agent = new AgentBase({ name: 'demo', route: '/' });
 * agent.addSkillByName('web_search', {
 *   api_key: process.env.GOOGLE_SEARCH_API_KEY,
 *   search_engine_id: process.env.GOOGLE_CSE_ID,
 *   num_results: 3,
 * });
 * ```
 */
export class WebSearchSkill extends SkillBase {
  // Python ground truth: skills/web_search/skill.py:559-567
  // REQUIRED_PACKAGES = ["bs4", "requests"] in Python; TS uses cheerio (optional
  // dependency) + the built-in fetch. cheerio is declared so validatePackages()
  // reports it cleanly if a consumer installed the SDK without the optional dep.
  static override REQUIRED_PACKAGES: readonly string[] = ['cheerio'];
  static override SKILL_NAME = 'web_search';
  static override SKILL_DESCRIPTION =
    'Search the web for information using Google Custom Search API';
  static override SKILL_VERSION = '2.0.0';
  static override REQUIRED_ENV_VARS: readonly string[] = [];
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      api_key: {
        type: 'string',
        description: 'Google Custom Search API key',
        required: true,
        hidden: true,
        env_var: 'GOOGLE_SEARCH_API_KEY',
      },
      search_engine_id: {
        type: 'string',
        description: 'Google Custom Search Engine ID',
        required: true,
        hidden: true,
        env_var: 'GOOGLE_SEARCH_ENGINE_ID',
      },
      tool_name: {
        type: 'string',
        description: 'Custom tool name for this Web Search instance.',
        required: false,
      },
      num_results: {
        type: 'integer',
        description: 'Number of high-quality results to return',
        default: 3,
        required: false,
        min: 1,
        max: 10,
      },
      delay: {
        type: 'number',
        description: 'Delay between scraping pages in seconds',
        default: 0.5,
        required: false,
        min: 0,
      },
      max_content_length: {
        type: 'integer',
        description: 'Maximum total response size in characters',
        default: 32768,
        required: false,
        min: 1000,
      },
      oversample_factor: {
        type: 'number',
        description:
          'How many extra results to fetch for quality filtering (e.g., 2.5 = fetch 2.5x requested)',
        default: 2.5,
        required: false,
        min: 1.0,
        max: 3.5,
      },
      min_quality_score: {
        type: 'number',
        description: 'Minimum quality score (0-1) for including a result',
        default: 0.3,
        required: false,
        min: 0,
        max: 1,
      },
      no_results_message: {
        type: 'string',
        description:
          'Message to show when no quality results are found. Use {query} as placeholder.',
        default: DEFAULT_NO_RESULTS_MESSAGE,
        required: false,
      },
      // Latency-control params — Python skill.py:855-895 (commit 295745b).
      // The SignalWire kernel times out webhook responses around 55s, so the
      // handler MUST finish under that. These bound per-page and whole-call
      // latency and offer a sub-second snippets-only mode.
      per_page_timeout: {
        type: 'number',
        description: 'Maximum seconds to wait on a single page scrape.',
        default: 2.0,
        required: false,
        min: 0.1,
      },
      overall_deadline: {
        type: 'number',
        description:
          'Wall-clock budget in seconds for the whole tool call. In-flight scrapes are abandoned past this so the response beats the kernel webhook timeout.',
        default: 10.0,
        required: false,
        min: 1.0,
      },
      parallel_scrape: {
        type: 'boolean',
        description:
          'Scrape all candidate pages concurrently (Promise.all raced against the deadline) instead of sequentially.',
        default: true,
        required: false,
      },
      snippets_only: {
        type: 'boolean',
        description:
          'Skip page scraping entirely and return Google CSE snippets only. Fastest mode (sub-second).',
        default: false,
        required: false,
      },
      response_prefix: {
        type: 'string',
        description:
          'Optional text prepended (separated by a blank line) to every non-empty search result. Use to give the calling agent a mechanical cue, e.g. "tell the user this came from a public web search".',
        default: '',
        required: false,
      },
      response_postfix: {
        type: 'string',
        description:
          'Optional text appended (separated by a blank line) to every non-empty search result.',
        default: '',
        required: false,
      },
      safe_search: {
        type: 'string',
        description: 'Safe search level.',
        default: 'medium',
        enum: ['off', 'medium', 'high'],
      },
    };
  }

  /**
   * @returns Manifest declaring Google Search credentials as required env vars.
   *   Reports `GOOGLE_SEARCH_ENGINE_ID` as the canonical name; `GOOGLE_SEARCH_CX`
   *   is still accepted as a legacy fallback at runtime.
   */
  /**
   * Validate required credentials before the skill becomes active.
   *
   * Mirrors Python's `setup()` (skill.py:559-600) which checks `api_key` and
   * `search_engine_id` and returns `False` (logging an error) if either is
   * absent. In the TS SDK credentials may also arrive via environment variables
   * (`GOOGLE_SEARCH_API_KEY` / `GOOGLE_SEARCH_ENGINE_ID` or the legacy alias
   * `GOOGLE_SEARCH_CX`), so both config params and env vars are checked.
   * @returns `true` if all required credentials are present, `false` otherwise.
   */
  override async setup(): Promise<boolean> {
    const apiKey =
      this.getConfig<string | undefined>('api_key', undefined) ??
      process.env['GOOGLE_SEARCH_API_KEY'];
    const searchEngineId =
      this.getConfig<string | undefined>('search_engine_id', undefined) ??
      process.env['GOOGLE_SEARCH_ENGINE_ID'] ??
      process.env['GOOGLE_SEARCH_CX'];

    const missing: string[] = [];
    if (!apiKey) missing.push('api_key / GOOGLE_SEARCH_API_KEY');
    if (!searchEngineId) missing.push('search_engine_id / GOOGLE_SEARCH_ENGINE_ID');

    if (missing.length > 0) {
      log.error('web_search: missing required parameters', { missing });
      return false;
    }
    return true;
  }

  /**
   * Instance key for the SkillManager. Includes the configured
   * `search_engine_id` (or `"default"`) and `tool_name` (or `"web_search"`)
   * to match Python's `"{SKILL_NAME}_{search_engine_id}_{tool_name}"` scheme.
   */
  override getInstanceKey(): string {
    const searchEngineId = this.getConfig<string>('search_engine_id', '') || 'default';
    const toolName = this.getConfig<string>('tool_name', this.skillName);
    return `${this.skillName}_${searchEngineId}_${toolName}`;
  }

  /** Global data injected into the agent's SWML context (mirrors Python). */
  override getGlobalData(): Record<string, unknown> {
    return {
      web_search_enabled: true,
      search_provider: 'Google Custom Search',
      quality_filtering: true,
    };
  }

  /** Resolve the tool name (defaults to `web_search`, matches Python default). */
  private getToolName(): string {
    return this.getConfig<string>('tool_name', 'web_search');
  }

  /**
   * @returns A single tool (named via `tool_name`) that performs a Google
   *   Custom Search and returns formatted results.
   */
  getTools(): SkillToolDefinition[] {
    const configNumResults = this.getConfig<number>('num_results', 3);
    const safeSearch = this.getConfig<string>('safe_search', 'medium');
    const oversampleFactor = this.getConfig<number>('oversample_factor', 2.5);
    const minQualityScore = this.getConfig<number>('min_quality_score', 0.3);
    const maxContentLength = this.getConfig<number>('max_content_length', 32768);
    const delaySeconds = this.getConfig<number>('delay', 0.5);
    const noResultsMessage = this.getConfig<string>(
      'no_results_message',
      DEFAULT_NO_RESULTS_MESSAGE,
    );
    // Optional prefix/postfix wrapped around every non-empty search result.
    // Mirrors the response_format_callback pattern from the Python
    // native_vector_search skill and Python web_search skill.py:587-595.
    // Applied only on successful results — error/no-results paths stay as-is.
    const responsePrefix = this.getConfig<string>('response_prefix', '');
    const responsePostfix = this.getConfig<string>('response_postfix', '');
    // Latency-control params — Python skill.py:670-674 (commit 51101da).
    //   perPageTimeout: max seconds to wait on a single page fetch.
    //   overallDeadline: wall-clock budget for the whole tool call; in-flight
    //     scrapes are abandoned (and their fetches aborted) past it.
    //   parallelScrape: dispatch all scrapes concurrently and race them
    //     against the deadline, vs. one-after-the-other.
    //   snippetsOnly: skip scraping; format CSE snippets directly (sub-second).
    const perPageTimeoutMs = Math.max(100, this.getConfig<number>('per_page_timeout', 2.0) * 1000);
    const overallDeadlineMs = Math.max(
      1000,
      this.getConfig<number>('overall_deadline', 10.0) * 1000,
    );
    const parallelScrape = this.getConfig<boolean>('parallel_scrape', true);
    const snippetsOnly = this.getConfig<boolean>('snippets_only', false);
    const toolName = this.getToolName();

    return [
      defineSkillTool({
        name: toolName,
        description:
          'Search the web for high-quality information, automatically filtering low-quality results',
        parameters: {
          query: {
            type: 'string',
            description: 'The search query - what you want to find information about',
          },
        },
        // Python passes no `required` (web_search/skill.py:707), so the wire
        // schema has no `required` key. args.query is `string | undefined`,
        // narrowed by the guard below.
        handler: async (args) => {
          if (!args.query || args.query.trim().length === 0) {
            return new FunctionResult(
              'Please provide a search query. What would you like me to search for?',
            );
          }

          const query = args.query.trim();

          if (query.length > MAX_SKILL_INPUT_LENGTH) {
            return new FunctionResult('Search query is too long.');
          }

          const apiKey =
            this.getConfig<string | undefined>('api_key', undefined) ??
            process.env['GOOGLE_SEARCH_API_KEY'];
          const searchEngineId =
            this.getConfig<string | undefined>('search_engine_id', undefined) ??
            process.env['GOOGLE_SEARCH_ENGINE_ID'] ??
            process.env['GOOGLE_SEARCH_CX'];

          if (!apiKey || !searchEngineId) {
            return new FunctionResult(
              'Service is not configured. Please contact your administrator.',
            );
          }

          const count = Math.max(1, Math.min(10, configNumResults));
          // Python skill.py:433 — `fetch_count = min(10, int(num_results * oversample_factor))`.
          // Python's `int()` truncates toward zero; for positive values that's
          // equivalent to Math.floor. Do NOT add a `max(count, …)` floor —
          // Python's fetch_count can be less than num_results (e.g. factor=0.5).
          const fetchCount = Math.min(10, Math.floor(count * oversampleFactor));

          try {
            const encodedQuery = encodeURIComponent(query);
            const safeParam = safeSearch !== 'off' ? `&safe=${safeSearch}` : '';
            // Base URL is normally googleapis.com; the porting-sdk's
            // `audit_skills_dispatch.py` overrides via `WEB_SEARCH_BASE_URL`
            // so the loopback fixture can stand in for Google CSE.
            const base = process.env['WEB_SEARCH_BASE_URL'] ?? 'https://www.googleapis.com';
            const url =
              `${base.replace(/\/+$/, '')}/customsearch/v1` +
              // Python uses timeout=15 on the API request (skill.py:220).
              `?key=${apiKey}&cx=${searchEngineId}&q=${encodedQuery}&num=${fetchCount}${safeParam}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15_000);
            let response: Response;
            try {
              response = await fetch(url, { signal: controller.signal });
            } finally {
              clearTimeout(timeout);
            }
            const data = (await response.json()) as GoogleSearchResponse;

            if (data.error) {
              log.error('web_search_api_error', { code: data.error.code });
              return new FunctionResult(
                'The web search service encountered an error. Please try again later.',
              );
            }

            if (!data.items || data.items.length === 0) {
              return new FunctionResult(
                WebSearchSkill._formatNoResultsMessage(noResultsMessage, query),
              );
            }

            // Snippets-only fast path — Python skill.py:454-456 (commit
            // 51101da). Skip page scraping entirely and format the CSE
            // snippets directly. Returns sub-second; good enough for most
            // voice answers and never risks the kernel webhook timeout.
            if (snippetsOnly) {
              return new FunctionResult(
                WebSearchSkill._formatSnippetResults(query, data.items, count),
              );
            }

            // Overall-deadline budget — Python skill.py:436 (commit 51101da).
            // Wall-clock instant past which any not-yet-finished scrape is
            // abandoned. A shared AbortController lets the deadline cancel
            // in-flight fetches (best-effort) so the response always beats the
            // kernel webhook timeout.
            const deadlineAt = Date.now() + overallDeadlineMs;
            const deadlineController = new AbortController();
            const deadlineTimer = setTimeout(() => deadlineController.abort(), overallDeadlineMs);

            // Scrape each result page, score for quality, dedupe by domain,
            // return the top `count` above the min threshold. Port of
            // Python's GoogleSearchScraper.search_and_scrape_best
            // (skill.py:416-526).
            //
            // Python scrapes each URL up to `self.max_content_length` chars
            // (skill.py:274-277 default), NOT the per-result budget. Metrics
            // are computed on the scraped text, then output-time truncation
            // applies the per-result budget. Mirror that.
            type Candidate = {
              item: GoogleSearchItem;
              text: string;
              score: number;
              host: string;
              text_length: number;
              sentence_count: number;
              query_relevance: number;
              query_words_found: string;
              domain: string;
            };
            const allCandidates: Candidate[] = [];

            // Fetch + score one candidate. Returns an enriched Candidate or
            // null (parse failure / SSRF rejection / below-threshold / past
            // the deadline). Mirrors Python's `_scrape_one` (skill.py:458-481).
            const scrapeOne = async (item: GoogleSearchItem): Promise<Candidate | null> => {
              if (Date.now() >= deadlineAt) return null;
              let host: string;
              try {
                // SSRF / URL sanity — Python has no explicit pre-check; the
                // scraper's inner `validate_url` handles it. We pre-parse to
                // derive `host` for the domain-diverse selection pass.
                host = new URL(item.link).host;
              } catch {
                return null;
              }
              const result = await this._scrapeUrl(
                item.link,
                maxContentLength,
                perPageTimeoutMs,
                query,
                deadlineController.signal,
              );
              if (result === null || result.score < minQualityScore) {
                return null;
              }
              return {
                item,
                text: result.text,
                score: result.score,
                host,
                text_length: result.text_length,
                sentence_count: result.sentence_count,
                query_relevance: result.query_relevance,
                query_words_found: result.query_words_found,
                domain: result.domain,
              };
            };

            try {
              if (parallelScrape) {
                // Dispatch every scrape at once and race the whole batch
                // against an overall-deadline timer. Python skill.py:484-503
                // uses a ThreadPoolExecutor + as_completed and harvests each
                // future as it finishes, breaking out when time runs out. To
                // match that (keep the fast scrapes even if a slow sibling
                // pushes the batch past the deadline) each scrapeOne pushes its
                // own result into allCandidates as it resolves, rather than
                // collecting atomically. Promise.race against a deadline
                // sentinel then returns as soon as either the whole batch
                // settles or the deadline fires.
                const allScrapes = Promise.allSettled(
                  data.items.map((it) =>
                    scrapeOne(it).then((cand) => {
                      if (cand !== null) allCandidates.push(cand);
                    }),
                  ),
                );
                const deadlineSentinel = Symbol('deadline');
                const deadlineRace = new Promise<typeof deadlineSentinel>((resolve) => {
                  const remaining = Math.max(0, deadlineAt - Date.now());
                  const t = setTimeout(() => resolve(deadlineSentinel), remaining);
                  // Don't keep the event loop alive solely for this timer.
                  if (typeof t.unref === 'function') t.unref();
                });
                // When the deadline wins, allCandidates already holds whatever
                // resolved in time; the stragglers are aborted in `finally`.
                await Promise.race([allScrapes, deadlineRace]);
              } else {
                // Sequential mode (legacy). Still honors the overall deadline:
                // bail before starting a scrape once we're out of time.
                // Python skill.py:505-513.
                for (let idx = 0; idx < data.items.length; idx++) {
                  if (Date.now() >= deadlineAt) break;
                  const cand = await scrapeOne(data.items[idx]!); // idx < length
                  if (cand !== null) allCandidates.push(cand);
                  // Python skill.py:512-513 sleeps `delay` seconds between
                  // iterations. Skip on the last iteration (nothing left).
                  if (delaySeconds > 0 && idx < data.items.length - 1) {
                    if (Date.now() >= deadlineAt) break;
                    await new Promise((r) => setTimeout(r, delaySeconds * 1000));
                  }
                }
              }
            } finally {
              clearTimeout(deadlineTimer);
              // Release any fetches still in flight (parallel mode harvested a
              // subset; abort the stragglers so sockets don't dangle).
              deadlineController.abort();
            }

            // Two-pass selection: sort by score desc, then (1) take the
            // highest-quality result per unique host, (2) fill remaining
            // slots from the leftovers. Mirrors Python skill.py:~495-540.
            allCandidates.sort((a, b) => b.score - a.score);
            const chosen: Candidate[] = [];
            const chosenHosts = new Set<string>();
            for (const cand of allCandidates) {
              if (chosen.length >= count) break;
              if (!chosenHosts.has(cand.host)) {
                chosen.push(cand);
                chosenHosts.add(cand.host);
              }
            }
            if (chosen.length < count) {
              for (const cand of allCandidates) {
                if (chosen.length >= count) break;
                if (!chosen.includes(cand)) chosen.push(cand);
              }
            }
            const scored = chosen;

            if (allCandidates.length === 0 || scored.length === 0) {
              // Time ran out (overall_deadline fired), every scrape failed
              // (network / SSRF rejection / per_page_timeout), or every page
              // was below the quality threshold. Python skill.py:515-519
              // (commit 51101da) falls back to formatting the CSE snippets it
              // already has rather than an empty "no results" message, so the
              // kernel never sees a webhook timeout and the model always gets
              // useful context back.
              if (data.items && data.items.length > 0) {
                return new FunctionResult(
                  WebSearchSkill._formatSnippetResults(query, data.items, count),
                );
              }
              return new FunctionResult(
                WebSearchSkill._formatNoResultsMessage(noResultsMessage, query),
              );
            }

            // Per-result content budget — Python skill.py:491-495 divides
            // by `len(best_results)` (the chosen count), not `num_results`,
            // so under-filled result sets get more room per source.
            const overheadPerResult = 400;
            const availableForContent = maxContentLength - scored.length * overheadPerResult;
            const perResultBudget = Math.max(2000, Math.floor(availableForContent / scored.length));

            // Ranked-by-score output with full page content.
            // Python skill.py:499-524 format — header lines + per-result
            // block with Title / URL / Source / Snippet / Content Stats /
            // Query Relevance / Content + 50-char separator.
            const separator = '='.repeat(50);
            const innerLines: string[] = [
              `Found ${allCandidates.length} results meeting quality threshold from ${data.items.length} searched.`,
              `Showing top ${scored.length} from diverse sources:\n`,
            ];
            for (let i = 0; i < scored.length; i++) {
              const cand = scored[i]!; // i < length
              let block = `=== RESULT ${i + 1} (Quality: ${cand.score.toFixed(2)}) ===\n`;
              block += `Title: ${cand.item.title}\n`;
              block += `URL: ${cand.item.link}\n`;
              block += `Source: ${cand.domain}\n`;
              // Python skill.py:507 always prints `Snippet:` (empty when the
              // Google result has no snippet). Mirror that for a stable layout.
              const rawSnippet = cand.item.snippet ?? '';
              block += `Snippet: ${rawSnippet.replace(/\n/g, ' ').trim()}\n`;
              block += `Content Stats: ${cand.text_length} chars, ${cand.sentence_count} sentences\n`;
              block += `Query Relevance: ${cand.query_relevance.toFixed(2)} (keywords: ${cand.query_words_found})\n`;
              block += `Content:\n`;
              let content = cand.text;
              if (content.length > perResultBudget) {
                content = content.slice(0, perResultBudget) + '...';
              }
              block += content;
              // Python skill.py:523 — `f"\n{'='*50}\n\n"` (two trailing newlines).
              block += `\n${separator}\n\n`;
              innerLines.push(block);
            }
            const innerOutput = innerLines.join('\n');
            // Python's outer `_web_search_handler` (skill.py:644) wraps the
            // inner formatter output with a `"Quality web search results for
            // '<query>':\n\n"` preamble.
            let responseText = `Quality web search results for '${query}':\n\n${innerOutput}`;
            // Python skill.py:653-656 wraps the success response with optional
            // prefix/postfix separated by a blank line. Only applied here
            // (success path); error / no-results / snippet-fallback paths
            // intentionally bypass the wrapping.
            if (responsePrefix) {
              responseText = `${responsePrefix}\n\n${responseText}`;
            }
            if (responsePostfix) {
              responseText = `${responseText}\n\n${responsePostfix}`;
            }
            return new FunctionResult(responseText);
          } catch (err) {
            log.error('web_search_failed', {
              error: err instanceof Error ? err.message : String(err),
            });
            return new FunctionResult(
              'Sorry, I encountered an error while searching. Please try again later.',
            );
          }
        },
      }),
    ];
  }

  /**
   * Format Google CSE snippets without fetching the underlying pages.
   *
   * Python equivalent: `GoogleSearchScraper._format_snippet_results`
   * (skill.py:416-437, commit 51101da). Used by the `snippets_only` fast path
   * and as the graceful fallback when page scraping is abandoned by the
   * `overall_deadline` or every page falls below the quality threshold. The
   * result is shorter than a fully-scraped response but always non-empty when
   * the CSE returned anything, so the kernel never sees a webhook timeout.
   *
   * @param query - The original search query (echoed in the header).
   * @param items - Raw CSE items (title / link / snippet).
   * @param numResults - How many snippets to surface (top N).
   * @returns A formatted, non-empty snippet block.
   */
  private static _formatSnippetResults(
    query: string,
    items: GoogleSearchItem[],
    numResults: number,
  ): string {
    if (!items || items.length === 0) {
      return `No search results found for query: ${query}`;
    }
    const top = items.slice(0, Math.max(numResults, 1));
    const lines: string[] = [`Snippet-only results for '${query}' (page content not scraped):`, ''];
    for (let i = 0; i < top.length; i++) {
      const it = top[i]!; // i < length
      lines.push(`=== RESULT ${i + 1} ===`);
      lines.push(`Title: ${it.title}`);
      lines.push(`URL: ${it.link}`);
      const snippet = (it.snippet ?? '').replace(/\n/g, ' ').trim();
      lines.push(`Snippet: ${snippet}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  /** Apply the `{query}` template to the no-results message. */
  private static _formatNoResultsMessage(template: string, query: string): string {
    return template.includes('{query}') ? template.replace(/\{query\}/g, query) : template;
  }

  /**
   * Check whether the URL points at Reddit. Python equivalent: `is_reddit_url`
   * (skill.py:66).
   */
  private static _isRedditUrl(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host.includes('reddit.com') || host.includes('redd.it');
    } catch {
      return false;
    }
  }

  /**
   * Fetch a Reddit URL via the `.json` endpoint and build a structured summary
   * of the post + top comments.
   *
   * Python equivalent: `extract_reddit_content` (skill.py:71-190). Matches the
   * post-title/author/score/comments assembly and the top-20 → valid → top-5
   * comment pipeline. Returns just the compiled text — Python's
   * `search_and_scrape_best` unconditionally overwrites Reddit's
   * engagement-score metrics with the 6-factor `_calculate_content_quality`
   * (skill.py:447-448), so we skip computing the dead engagement score here
   * and let the handler score the text via `_qualityMetrics`.
   *
   * Falls through to HTML extraction on JSON fetch failure or malformed
   * payload, matching Python's `except Exception: fall back` behavior.
   */
  private async _extractRedditContent(
    url: string,
    contentLimit: number,
    timeoutMs: number,
    externalSignal?: AbortSignal,
  ): Promise<{ text: string } | null> {
    try {
      if (!(await validateUrl(url))) {
        log.debug('web_search: reddit URL rejected by SSRF guard', { url });
        return null;
      }
      const jsonUrl = url.endsWith('.json') ? url : `${url.replace(/\/+$/, '')}.json`;
      const { signal, dispose } = WebSearchSkill._fetchSignal(timeoutMs, externalSignal);
      let response: Response;
      try {
        response = await fetch(jsonUrl, {
          signal,
          headers: { 'User-Agent': 'SignalWire-WebSearch/2.0' },
        });
      } finally {
        dispose();
      }
      if (!response.ok) {
        log.debug('web_search: reddit JSON non-200', {
          url: jsonUrl,
          status: response.status,
        });
        return null;
      }
      const data = (await response.json()) as unknown;
      if (!Array.isArray(data) || data.length < 1) {
        log.debug('web_search: reddit JSON structure invalid', { url });
        return null;
      }

      const listing0 = data[0] as {
        data?: { children?: Array<{ data?: Record<string, unknown> }> };
      };
      const postEntry = listing0?.data?.children?.[0]?.data;
      if (!postEntry) {
        log.debug('web_search: reddit post missing', { url });
        return null;
      }

      const title = (postEntry['title'] as string | undefined) ?? 'No title';
      const author = (postEntry['author'] as string | undefined) ?? 'unknown';
      const postScore = (postEntry['score'] as number | undefined) ?? 0;
      const numComments = (postEntry['num_comments'] as number | undefined) ?? 0;
      const subreddit = (postEntry['subreddit'] as string | undefined) ?? '';
      const selftext = ((postEntry['selftext'] as string | undefined) ?? '').trim();

      const parts: string[] = [];
      parts.push(`Reddit r/${subreddit} Discussion`);
      parts.push(`\nPost: ${title}`);
      parts.push(`Author: ${author} | Score: ${postScore} | Comments: ${numComments}`);
      if (selftext && selftext !== '[removed]' && selftext !== '[deleted]') {
        parts.push(`\nOriginal Post:\n${selftext.slice(0, 1000)}`);
      }

      const validComments: Array<{ body: string; author: string; score: number }> = [];
      if (data.length > 1) {
        const listing1 = data[1] as {
          data?: {
            children?: Array<{ kind?: string; data?: Record<string, unknown> }>;
          };
        };
        const comments = listing1?.data?.children ?? [];
        for (const c of comments.slice(0, 20)) {
          if (c.kind !== 't1' || !c.data) continue;
          const body = ((c.data['body'] as string | undefined) ?? '').trim();
          if (!body || body === '[removed]' || body === '[deleted]' || body.length <= 50) {
            continue;
          }
          validComments.push({
            body,
            author: (c.data['author'] as string | undefined) ?? 'unknown',
            score: (c.data['score'] as number | undefined) ?? 0,
          });
        }
        validComments.sort((a, b) => b.score - a.score);

        if (validComments.length > 0) {
          parts.push('\n--- Top Discussion ---');
          validComments.slice(0, 5).forEach((c, i) => {
            let commentText = c.body.slice(0, 500);
            if (c.body.length > 500) commentText += '...';
            parts.push(`\nComment ${i + 1} (Score: ${c.score}, Author: ${c.author}):`);
            parts.push(commentText);
          });
        }
      }

      let text = parts.join('\n');

      if (text.length > contentLimit) {
        text = text.slice(0, contentLimit);
      }

      return { text };
    } catch (err) {
      log.debug('web_search: reddit extraction failed', {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Fetch a URL and extract clean text content, then score it with the
   * 6-factor `_qualityMetrics`. Reddit URLs are routed to the JSON extractor
   * first; the compiled Reddit text is scored with the same 6-factor formula
   * to match Python's `search_and_scrape_best` overwrite behavior
   * (skill.py:447-448).
   *
   * Python equivalent: `extract_text_from_url` (skill.py:192-202). Returns `null`
   * on any failure (network, non-200, parse error, or SSRF rejection).
   *
   * @param timeoutMs - Per-page fetch timeout (Python `per_page_timeout`).
   * @param externalSignal - Optional shared abort signal driven by the
   *   handler's `overall_deadline`. When it fires, in-flight fetches are
   *   cancelled even if the per-page timeout has not elapsed. Combined with
   *   the per-page timeout via {@link AbortSignal.any}.
   */
  private async _scrapeUrl(
    url: string,
    contentLimit: number,
    timeoutMs: number,
    query: string,
    externalSignal?: AbortSignal,
  ): Promise<{
    text: string;
    score: number;
    text_length: number;
    sentence_count: number;
    query_relevance: number;
    query_words_found: string;
    domain: string;
  } | null> {
    if (WebSearchSkill._isRedditUrl(url)) {
      const reddit = await this._extractRedditContent(url, contentLimit, timeoutMs, externalSignal);
      if (reddit) {
        const metrics = WebSearchSkill._qualityMetrics(reddit.text, url, query);
        return { text: reddit.text, ...metrics };
      }
      // Python skill.py:189-190 falls through to HTML extraction if the
      // Reddit JSON path fails. Mirror that.
    }

    // SSRF guard — Python's scraper calls validate_url() before every
    // requests.get() (skill.py:79-80, 209-210).
    if (!(await validateUrl(url))) {
      log.debug('web_search: scrape URL rejected by SSRF guard', { url });
      return null;
    }
    // Per-page timeout OR the shared overall-deadline signal, whichever trips
    // first. The deadline can thus cancel a slow fetch that hasn't yet hit its
    // own per-page timeout.
    const { signal, dispose } = WebSearchSkill._fetchSignal(timeoutMs, externalSignal);
    try {
      const response = await fetch(url, {
        signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (!response.ok) {
        log.debug('web_search: scrape non-200', { url, status: response.status });
        return null;
      }
      const body = await response.text();
      let text = await extractTextFromHtml(body);
      if (text.length > contentLimit) {
        text = text.slice(0, contentLimit);
      }
      if (!text) return null;
      const metrics = WebSearchSkill._qualityMetrics(text, url, query);
      return { text, ...metrics };
    } catch (err) {
      log.debug('web_search: scrape failed', {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    } finally {
      dispose();
    }
  }

  /**
   * Build the {@link AbortSignal} for a single page fetch: a per-page timeout,
   * optionally combined with an externally-supplied deadline signal so either
   * one can cancel the request. Returns a `dispose` callback that clears the
   * internal timer (call it from a `finally`).
   *
   * @param timeoutMs - Per-page timeout in milliseconds.
   * @param externalSignal - Optional shared abort signal (overall deadline).
   */
  private static _fetchSignal(
    timeoutMs: number,
    externalSignal?: AbortSignal,
  ): { signal: AbortSignal; dispose: () => void } {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const dispose = () => clearTimeout(timer);
    if (!externalSignal) {
      return { signal: controller.signal, dispose };
    }
    // If the deadline already fired, short-circuit to an aborted signal.
    if (externalSignal.aborted) {
      controller.abort();
    }
    return {
      signal: AbortSignal.any([controller.signal, externalSignal]),
      dispose,
    };
  }

  /**
   * Six-factor content quality metrics (score + sub-metrics used in the
   * per-result output). Combines content length, word diversity,
   * boilerplate penalty, sentence structure, domain reputation, and query
   * relevance.
   *
   * Python equivalent: `_calculate_content_quality` (skill.py:284-414). Preserves
   * the weights (0.25/0.10/0.10/0.15/0.15/0.25), the 26-phrase boilerplate
   * list, the quality/low-quality domain lists, and the phrase-match bonus
   * on relevance. Also returns the same metric fields Python exposes
   * (`text_length`, `sentence_count`, `query_relevance`, `query_words_found`,
   * `domain`) so the handler can render the full Python output format.
   */
  private static _qualityMetrics(
    text: string,
    url: string,
    query: string,
  ): {
    score: number;
    text_length: number;
    sentence_count: number;
    query_relevance: number;
    query_words_found: string;
    domain: string;
  } {
    if (!text) {
      return {
        score: 0,
        text_length: 0,
        sentence_count: 0,
        query_relevance: 0,
        query_words_found: 'N/A',
        domain: '',
      };
    }

    // 1. Length score — tiered bands (Python skill.py:300-310).
    //
    // Python's `len(text)` counts codepoints; JS's `text.length` counts
    // UTF-16 code units, so any character outside the BMP (emoji, astral
    // plane letters) counts as 2 in JS and 1 in Python. For emoji-heavy
    // content that would inflate the TS length score relative to Python.
    // Count codepoints explicitly to match Python.
    const textLength = [...text].length;
    let lengthScore: number;
    if (textLength < 500) {
      lengthScore = 0;
    } else if (textLength < 2000) {
      lengthScore = ((textLength - 500) / 1500) * 0.5;
    } else if (textLength <= 10000) {
      lengthScore = 1.0;
    } else {
      lengthScore = Math.max(0.8, 1.0 - (textLength - 10000) / 20000);
    }

    // 2. Word diversity — unique / (total * 0.3). Python skill.py:313-321.
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const diversityScore =
      words.length === 0 ? 0 : Math.min(1, new Set(words).size / (words.length * 0.3));

    // 3. Boilerplate penalty — 26 phrases, -15% per phrase.
    // Python skill.py:324-335.
    const boilerplatePhrases = [
      'cookie',
      'privacy policy',
      'terms of service',
      'subscribe',
      'sign up',
      'log in',
      'advertisement',
      'sponsored',
      'copyright',
      'all rights reserved',
      'skip to',
      'navigation',
      'breadcrumb',
      'reddit inc',
      'google llc',
      'expand navigation',
      'members •',
      'archived post',
      'votes cannot be cast',
      'r/',
      'subreddit',
      'youtube',
      'facebook',
      'twitter',
      'instagram',
      'pinterest',
    ];
    const lowerText = text.toLowerCase();
    const boilerplateCount = boilerplatePhrases.reduce(
      (n, phrase) => (lowerText.includes(phrase) ? n + 1 : n),
      0,
    );
    const boilerplatePenalty = Math.max(0, 1 - boilerplateCount * 0.15);

    // 4. Sentence score — count sentences with >30 chars; target 10.
    // Python skill.py:339-342.
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 30);
    const sentenceScore = Math.min(1, sentences.length / 10);

    // 5. Domain score — quality domains +1.5×, low-quality 0.1×, else 1.0.
    // Python skill.py:344-365.
    let domain = '';
    try {
      domain = new URL(url).hostname.toLowerCase();
    } catch {
      domain = '';
    }
    const qualityDomains = [
      'wikipedia.org',
      'starwars.fandom.com',
      'imdb.com',
      'screenrant.com',
      'denofgeek.com',
      'ign.com',
      'hollywoodreporter.com',
      'variety.com',
      'ew.com',
      'stackexchange.com',
      'stackoverflow.com',
      'github.com',
      'medium.com',
      'dev.to',
      'arxiv.org',
      'nature.com',
      'sciencedirect.com',
      'ieee.org',
    ];
    const lowQualityDomains = [
      'reddit.com',
      'youtube.com',
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'pinterest.com',
      'tiktok.com',
      'x.com',
    ];
    let domainScore = 1.0;
    if (qualityDomains.some((d) => domain.includes(d))) {
      domainScore = 1.5;
    } else if (lowQualityDomains.some((d) => domain.includes(d))) {
      domainScore = 0.1;
    }

    // 6. Query relevance — word overlap + phrase bonus.
    // Python skill.py:370-395.
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
    ]);
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
    let relevanceScore: number;
    let wordsFound = 'N/A';
    if (queryWords.length === 0) {
      relevanceScore = 0.5;
    } else {
      const lowerContent = text.toLowerCase();
      let hits = 0;
      for (const w of queryWords) {
        if (lowerContent.includes(w)) hits++;
      }
      let phraseBonus = 0;
      for (let i = 0; i < queryWords.length - 1; i++) {
        const phrase = `${queryWords[i]} ${queryWords[i + 1]}`;
        if (lowerContent.includes(phrase)) phraseBonus += 0.2;
      }
      relevanceScore = Math.min(1, hits / queryWords.length + phraseBonus);
      // Python skill.py:392 — `"{words_found}/{len(query_words)}"` string.
      wordsFound = `${hits}/${queryWords.length}`;
    }

    // Weighted combination (Python skill.py:397-405).
    const score =
      lengthScore * 0.25 +
      diversityScore * 0.1 +
      boilerplatePenalty * 0.1 +
      sentenceScore * 0.15 +
      domainScore * 0.15 +
      relevanceScore * 0.25;

    return {
      score,
      text_length: textLength,
      sentence_count: sentences.length,
      query_relevance: relevanceScore,
      query_words_found: wordsFound,
      domain,
    };
  }

  /** @returns Prompt section describing web search capabilities and usage guidance. */
  protected override _getPromptSections(): SkillPromptSection[] {
    const toolName = this.getToolName();
    return [
      {
        title: 'Web Search Capability (Quality Enhanced)',
        body: `You can search the internet for high-quality information using the ${toolName} tool.`,
        bullets: [
          `Use the ${toolName} tool when users ask for information you need to look up`,
          'The search automatically filters out low-quality results like empty pages',
          'Results are ranked by content quality, relevance, and domain reputation',
          'Summarize the high-quality results in a clear, helpful way',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating WebSearchSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new WebSearchSkill instance.
 */
export function createSkill(config?: SkillConfig): WebSearchSkill {
  return new WebSearchSkill(config);
}
