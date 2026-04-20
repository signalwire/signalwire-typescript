/**
 * Web Search Skill - Searches the web using the Google Custom Search API.
 *
 * Tier 3 built-in skill: requires `GOOGLE_SEARCH_API_KEY` and
 * `GOOGLE_SEARCH_ENGINE_ID` (legacy alias: `GOOGLE_SEARCH_CX`) environment
 * variables, or the equivalent config params. Uses the Google Custom Search
 * JSON API to perform web searches and return formatted results.
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
import { MAX_SKILL_INPUT_LENGTH, validateUrl } from '../../SecurityUtils.js';
import { getLogger } from '../../Logger.js';
import * as cheerio from 'cheerio';

const log = getLogger('WebSearchSkill');

const DEFAULT_NO_RESULTS_MESSAGE =
  "I couldn't find quality results for '{query}'. " +
  'The search returned only low-quality or inaccessible pages. ' +
  'Try rephrasing your search or asking about a different topic.';

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
 * Supports `tool_name`, `num_results`, `no_results_message`, `safe_search`,
 * and — for Python-parity — `delay`, `max_content_length`, `oversample_factor`,
 * and `min_quality_score` config options. The scraping-pipeline parameters are
 * accepted but only the API-snippet result path is implemented in TS.
 */
export class WebSearchSkill extends SkillBase {
  /** Python SDK parity: multiple instances can coexist with different tool names. */
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  /**
   * @param config - Optional configuration; supports `api_key`,
   *   `search_engine_id`, `tool_name`, `num_results`, `no_results_message`,
   *   `safe_search`, `delay`, `max_content_length`, `oversample_factor`,
   *   `min_quality_score`.
   */
  constructor(config?: SkillConfig) {
    super('web_search', config);
  }

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
      },
      num_results: {
        type: 'integer',
        description: 'Number of high-quality results to return',
        default: 3,
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
        description: 'Maximum total response size in characters (distributed across results)',
        default: 32768,
        required: false,
        min: 1000,
      },
      oversample_factor: {
        type: 'number',
        description:
          'How many extra results to fetch for quality filtering (multiplier on num_results)',
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
          'Message to show when no results are found. Use {query} as placeholder.',
        default: DEFAULT_NO_RESULTS_MESSAGE,
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
  getManifest(): SkillManifest {
    return {
      name: 'web_search',
      description:
        'Search the web for information using Google Custom Search API',
      version: '2.0.0',
      author: 'SignalWire',
      tags: ['search', 'web', 'google', 'api', 'external'],
      // Python declares REQUIRED_ENV_VARS = [] — credentials may arrive via
      // either config params OR env vars, so nothing is strictly required
      // at the env-var layer. hasAllEnvVars() treats an empty list as "all
      // present", letting the config-only path succeed. setup() still
      // validates that at least one source is populated.
      requiredEnvVars: [],
      requiredPackages: [],
      configSchema: {
        api_key: {
          type: 'string',
          description: 'Google Custom Search API key.',
        },
        search_engine_id: {
          type: 'string',
          description: 'Google Custom Search Engine ID.',
        },
        tool_name: {
          type: 'string',
          description: 'Custom tool name for this instance.',
        },
        num_results: {
          type: 'integer',
          description: 'Number of results to return (1-10). Defaults to 3.',
          default: 3,
        },
        delay: {
          type: 'number',
          description:
            'Delay between scraping pages (Python parity; ignored in TS).',
          default: 0.5,
        },
        max_content_length: {
          type: 'integer',
          description:
            'Maximum total response size (Python parity; ignored in TS).',
          default: 32768,
        },
        oversample_factor: {
          type: 'number',
          description:
            'Oversampling factor for quality filtering (Python parity; ignored in TS).',
          default: 2.5,
        },
        min_quality_score: {
          type: 'number',
          description:
            'Minimum quality score (Python parity; ignored in TS).',
          default: 0.3,
        },
        no_results_message: {
          type: 'string',
          description:
            'Message returned when no results are found. Supports {query} interpolation.',
        },
        safe_search: {
          type: 'string',
          description:
            'Safe search level: "off", "medium", or "high". Defaults to "medium".',
          default: 'medium',
        },
      },
    };
  }

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
    const toolName = this.getToolName();

    return [
      {
        name: toolName,
        description:
          'Search the web for high-quality information, automatically filtering low-quality results',
        parameters: {
          query: {
            type: 'string',
            description:
              "The search query - what you want to find information about",
          },
        },
        required: ['query'],
        handler: async (args: Record<string, unknown>, _rawData: Record<string, unknown>) => {
          const rawQuery = args['query'];

          if (
            !rawQuery ||
            typeof rawQuery !== 'string' ||
            rawQuery.trim().length === 0
          ) {
            return new FunctionResult(
              'Please provide a search query. What would you like me to search for?',
            );
          }

          const query = rawQuery.trim();

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
          // Python skill.py fetches oversample_factor * num_results, then
          // scores/filters and returns the top `num_results`. Mirror that.
          const fetchCount = Math.min(
            10,
            Math.max(count, Math.ceil(count * oversampleFactor)),
          );

          try {
            const encodedQuery = encodeURIComponent(query);
            const safeParam = safeSearch !== 'off' ? `&safe=${safeSearch}` : '';
            const url =
              `https://www.googleapis.com/customsearch/v1` +
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

            // Scrape each result page, score for quality, dedupe by domain,
            // return the top `count` above the min threshold. Lightweight
            // port of Python's GoogleSearchScraper.search_and_scrape_best
            // (skill.py:~440).
            const perResultBudget = Math.max(
              500,
              Math.floor(maxContentLength / count),
            );
            const seenDomains = new Set<string>();
            const scored: Array<{
              item: GoogleSearchItem;
              text: string;
              score: number;
            }> = [];

            for (const item of data.items) {
              let host = '';
              try {
                host = new URL(item.link).host;
              } catch {
                continue;
              }
              if (seenDomains.has(host)) continue;

              const text = await this._scrapeUrl(item.link, perResultBudget, 10_000);
              if (text === null) continue;

              const score = WebSearchSkill._qualityScore(text, query);
              if (score < minQualityScore) continue;

              seenDomains.add(host);
              scored.push({ item, text, score });

              if (scored.length >= count) break;

              // Python sleeps `delay` seconds between page fetches to avoid
              // hammering target servers (skill.py:~460).
              if (delaySeconds > 0) {
                await new Promise((r) => setTimeout(r, delaySeconds * 1000));
              }
            }

            if (scored.length === 0) {
              // Every scrape either failed or fell below the threshold — fall
              // back to API snippets so the agent still has something to say.
              const parts: string[] = [
                `Web search results for '${query}' (quality filter yielded no full-page matches):`,
                '',
              ];
              for (let i = 0; i < Math.min(data.items.length, count); i++) {
                const item = data.items[i];
                parts.push(`${i + 1}. ${item.title}`);
                parts.push(`   URL: ${item.link}`);
                if (item.snippet) {
                  parts.push(`   ${item.snippet.replace(/\n/g, ' ').trim()}`);
                }
                parts.push('');
              }
              return new FunctionResult(parts.join('\n').trim());
            }

            // Ranked-by-score output with full page content.
            scored.sort((a, b) => b.score - a.score);
            const parts: string[] = [`Quality web search results for '${query}':`, ''];
            for (let i = 0; i < scored.length; i++) {
              const { item, text, score } = scored[i];
              parts.push(
                `=== RESULT ${i + 1} (Quality: ${score.toFixed(2)}) ===`,
              );
              parts.push(`Title: ${item.title}`);
              parts.push(`URL: ${item.link}`);
              if (item.snippet) {
                parts.push(`Snippet: ${item.snippet.replace(/\n/g, ' ').trim()}`);
              }
              parts.push(`Content:\n${text}`);
              parts.push('');
            }
            return new FunctionResult(parts.join('\n').trim());
          } catch (err) {
            log.error('web_search_failed', {
              error: err instanceof Error ? err.message : String(err),
            });
            return new FunctionResult(
              'Sorry, I encountered an error while searching. Please try again later.',
            );
          }
        },
      },
    ];
  }

  /** Apply the `{query}` template to the no-results message. */
  private static _formatNoResultsMessage(template: string, query: string): string {
    return template.includes('{query}')
      ? template.replace(/\{query\}/g, query)
      : template;
  }

  /**
   * Fetch a URL and extract clean text content via cheerio. Lightweight port
   * of Python's GoogleSearchScraper.extract_html_content. Returns `null` on
   * any failure (network, non-200, parse error, or SSRF rejection).
   */
  private async _scrapeUrl(
    url: string,
    contentLimit: number,
    timeoutMs: number,
  ): Promise<string | null> {
    // SSRF guard — Python's scraper calls validate_url() before every
    // requests.get() (skill.py:79-80, 209-210).
    if (!(await validateUrl(url))) {
      log.debug('web_search: scrape URL rejected by SSRF guard', { url });
      return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
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
      const $ = cheerio.load(body);
      // Remove boilerplate/noise tags — same 7 Python's lxml drops.
      for (const tag of ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript']) {
        $(tag).remove();
      }
      // Prefer <main> / <article> containers when present (Python's
      // extract_html_content uses similar selectors for clean main content).
      const candidates = ['main', 'article', '[role="main"]', 'body'];
      let text = '';
      for (const sel of candidates) {
        const picked = $(sel).first();
        if (picked.length > 0) {
          text = picked.text();
          if (text.trim().length > 100) break;
        }
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (text.length > contentLimit) {
        text = text.slice(0, contentLimit) + '…';
      }
      return text || null;
    } catch (err) {
      log.debug('web_search: scrape failed', {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Quality score (0-1) combining content length, query relevance, and a
   * light boilerplate penalty. Scaled-down port of Python's
   * GoogleSearchScraper._calculate_content_quality (skill.py:~380). Enough
   * signal to sort and filter; not attempting the full 6-sub-score pipeline
   * with hard-coded domain reputation lists.
   */
  private static _qualityScore(text: string, query: string): number {
    if (!text) return 0;
    const length = text.length;
    // Length: saturates around 3000 chars (Python's typical good-page size).
    const lengthScore = Math.min(1, length / 3000);
    // Query relevance: fraction of query terms that appear in text.
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const lowerText = text.toLowerCase();
    const hits = queryTerms.filter((term) => lowerText.includes(term)).length;
    const relevance = queryTerms.length === 0 ? 0.5 : hits / queryTerms.length;
    // Boilerplate penalty: very short pages or pages saturated with "cookie"
    // / "subscribe" / "accept" text tend to be gates, not content.
    const boilerplate = /cookie|subscribe|accept all|sign in/i;
    const boilerHits = (text.match(boilerplate) ?? []).length;
    const penalty = Math.min(0.3, boilerHits * 0.05);
    return Math.max(0, Math.min(1, 0.4 * lengthScore + 0.6 * relevance - penalty));
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
