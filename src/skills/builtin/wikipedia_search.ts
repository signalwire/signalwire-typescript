/**
 * Wikipedia Search Skill - Searches Wikipedia for article summaries.
 *
 * Tier 3 built-in skill: no external API key required. Uses the Wikipedia
 * REST API to fetch article summaries and extracts for any given topic.
 * Matches the Python SDK's `num_results` / `no_results_message` parity and
 * adds `language` + `max_content_length` for multi-language and output
 * trimming support.
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
import { getLogger } from '../../Logger.js';

const log = getLogger('WikipediaSearchSkill');

const DEFAULT_NO_RESULTS_MESSAGE =
  "I couldn't find any Wikipedia articles for '{query}'. " +
  'Try rephrasing your search or using different keywords.';

/** Response shape from the Wikipedia REST API page summary endpoint. */
interface WikipediaSummaryResponse {
  /** Page type (e.g., "standard", "disambiguation"). */
  type: string;
  /** Article title. */
  title: string;
  /** HTML-formatted display title. */
  displaytitle?: string;
  /** Plain-text article extract/summary. */
  extract: string;
  /** HTML-formatted extract. */
  extract_html?: string;
  /** Short description of the article. */
  description?: string;
  /** URLs to the full article. */
  content_urls?: {
    desktop?: { page: string };
    mobile?: { page: string };
  };
  /** Thumbnail image information. */
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
}

/** Response shape from the Wikipedia action=query search API. */
interface WikipediaActionSearchResponse {
  query?: {
    search?: Array<{
      title: string;
      pageid?: number;
      snippet?: string;
    }>;
  };
}

/** Response shape from the Wikipedia action=query extracts API. */
interface WikipediaActionExtractsResponse {
  query?: {
    pages?: Record<string, { title?: string; extract?: string }>;
  };
}

/**
 * Searches Wikipedia for article summaries and extracts.
 *
 * Tier 3 built-in skill with no external API key required. The configured
 * `num_results` drives how many articles are aggregated; `no_results_message`
 * customizes the fallback text (supports `{query}` interpolation); `language`
 * selects the Wikipedia edition (`en`, `fr`, `de`, …); `max_content_length`
 * trims the final output.
 */
export class WikipediaSearchSkill extends SkillBase {
  /** Resolved `num_results` value (populated in `setup()`). */
  private _numResults: number = 1;
  /** Resolved `no_results_message` template (populated in `setup()`). */
  private _noResultsMessage: string = DEFAULT_NO_RESULTS_MESSAGE;
  /** Resolved Wikipedia language edition code (populated in `setup()`). */
  private _language: string = 'en';
  /** Resolved output length cap in characters (populated in `setup()`). */
  private _maxContentLength: number = 5000;

  /**
   * @param config - Optional configuration; supports `num_results`,
   *   `no_results_message`, `language`, `max_content_length`.
   */
  constructor(config?: SkillConfig) {
    super('wikipedia_search', config);
  }

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      num_results: {
        type: 'integer',
        description: 'Maximum number of Wikipedia articles to return',
        default: 1,
        min: 1,
        max: 5,
      },
      no_results_message: {
        type: 'string',
        description: 'Custom message when no Wikipedia articles are found',
        default: DEFAULT_NO_RESULTS_MESSAGE,
      },
      language: {
        type: 'string',
        description:
          'Wikipedia language edition to search (e.g., "en", "fr", "de").',
        default: 'en',
      },
      max_content_length: {
        type: 'integer',
        description: 'Maximum length of returned content in characters.',
        default: 5000,
        min: 100,
      },
    };
  }

  /** @returns Manifest with skill metadata (no required env vars). */
  getManifest(): SkillManifest {
    return {
      name: 'wikipedia_search',
      description:
        'Search Wikipedia for information about a topic and get article summaries',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['search', 'wikipedia', 'encyclopedia', 'knowledge', 'external'],
    };
  }

  /**
   * Extract config values into instance state. Clamps `num_results` to the
   * 1-5 range (matching Python's `max(1, ...)` floor plus the schema cap).
   */
  override async setup(): Promise<boolean> {
    const configured = this.getConfig<number>('num_results', 1);
    this._numResults = Math.max(1, Math.min(5, Math.floor(configured)));

    const rawMessage = this.getConfig<string | undefined>(
      'no_results_message',
      undefined,
    );
    this._noResultsMessage =
      rawMessage && rawMessage.length > 0 ? rawMessage : DEFAULT_NO_RESULTS_MESSAGE;

    const lang = this.getConfig<string>('language', 'en');
    this._language = lang && lang.length > 0 ? lang : 'en';

    const rawLen = this.getConfig<number>('max_content_length', 5000);
    this._maxContentLength = Math.max(100, Math.floor(rawLen));
    return true;
  }

  /** @returns A `search_wiki` tool that fetches article summaries from Wikipedia. */
  getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'search_wiki',
        description:
          'Search Wikipedia for information about a topic and get article summaries',
        parameters: {
          query: {
            type: 'string',
            description:
              'The search term or topic to look up on Wikipedia.',
          },
          sentences: {
            type: 'number',
            description:
              'Optional: number of sentences to return per article (1-10). Applied to the direct page-summary result; full extracts are used otherwise.',
          },
        },
        required: ['query'],
        handler: async (args: Record<string, unknown>) => {
          const rawQuery = args['query'];
          const sentences = args['sentences'];

          if (
            !rawQuery ||
            typeof rawQuery !== 'string' ||
            rawQuery.trim().length === 0
          ) {
            return new FunctionResult(
              'Please provide a search query for Wikipedia.',
            );
          }

          const sentenceCount =
            typeof sentences === 'number'
              ? Math.max(1, Math.min(10, Math.floor(sentences)))
              : undefined;

          const result = await this.searchWiki(rawQuery.trim(), sentenceCount);
          return new FunctionResult(result);
        },
      },
    ];
  }

  /**
   * Search Wikipedia and return a formatted text summary.
   *
   * Mirrors the Python `search_wiki()` public entry point so the logic can be
   * tested and reused outside the SWAIG handler. Uses `num_results` to decide
   * how many articles to aggregate and honors `language` / `max_content_length`.
   *
   * @param query - Plain-text search term.
   * @param sentenceCount - Optional sentence cap used by the direct-summary
   *   path (1-10).
   * @returns Formatted text ready for display to the caller.
   */
  async searchWiki(query: string, sentenceCount?: number): Promise<string> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      return this._formatNoResults(trimmedQuery);
    }

    try {
      // Fast path: when only one article is requested, try the REST page
      // summary endpoint. It returns cleanly-structured data including a URL.
      if (this._numResults === 1) {
        const summary = await this._fetchDirectSummary(trimmedQuery, sentenceCount);
        if (summary !== null) {
          return this._clampContent(summary);
        }
      }

      // Fallback / multi-result path: use the action=query search API.
      const baseUrl = `https://${this._language}.wikipedia.org/w/api.php`;
      const searchUrl =
        `${baseUrl}?action=query&list=search&format=json` +
        `&srsearch=${encodeURIComponent(trimmedQuery)}` +
        `&srlimit=${this._numResults}`;

      const searchData = await this._fetchJson<WikipediaActionSearchResponse>(
        searchUrl,
      );
      if (!searchData) {
        return 'Wikipedia search could not be completed. Please try a different search term.';
      }

      const searchResults = searchData.query?.search ?? [];
      if (searchResults.length === 0) {
        return this._formatNoResults(trimmedQuery);
      }

      const articles: string[] = [];

      for (const result of searchResults.slice(0, this._numResults)) {
        const title = result.title;
        const extractUrl =
          `${baseUrl}?action=query&prop=extracts&exintro&explaintext&format=json` +
          `&titles=${encodeURIComponent(title)}`;

        const extractData = await this._fetchJson<WikipediaActionExtractsResponse>(
          extractUrl,
        );
        const pages = extractData?.query?.pages ?? {};
        const firstPage = Object.values(pages)[0];
        const extract = (firstPage?.extract ?? '').trim();

        if (extract.length > 0) {
          articles.push(`**${title}**\n\n${extract}`);
        } else {
          articles.push(`**${title}**\n\nNo summary available for this article.`);
        }
      }

      if (articles.length === 0) {
        return this._formatNoResults(trimmedQuery);
      }

      const separator = '\n\n' + '='.repeat(50) + '\n\n';
      return this._clampContent(articles.join(separator));
    } catch (err) {
      log.error('wikipedia_search_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return `Error searching Wikipedia: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  }

  /** Fetch and format a single direct page summary. Returns `null` to signal fallback. */
  private async _fetchDirectSummary(
    query: string,
    sentenceCount?: number,
  ): Promise<string | null> {
    const encodedQuery = encodeURIComponent(query.replace(/\s+/g, '_'));
    const summaryUrl = `https://${this._language}.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`;

    const data = await this._fetchJson<WikipediaSummaryResponse>(summaryUrl);
    if (!data || data.type === 'disambiguation' || !data.extract) {
      return null;
    }

    let extractText = data.extract;
    if (typeof sentenceCount === 'number') {
      const pieces = extractText.split(/(?<=[.!?])\s+/);
      extractText = pieces.slice(0, sentenceCount).join(' ').trim();
    }

    const pageUrl = data.content_urls?.desktop?.page ?? '';
    const parts: string[] = [`Wikipedia: ${data.title}`];
    if (data.description) {
      parts.push(`(${data.description})`);
    }
    parts.push('');
    parts.push(extractText);
    if (pageUrl) {
      parts.push('');
      parts.push(`Read more: ${pageUrl}`);
    }
    return parts.join('\n').trim();
  }

  /** Fetch JSON with a 30-second timeout. Returns `null` on any failure. */
  private async _fetchJson<T>(url: string): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SignalWireAgentsSDK/1.0',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Clamp content to `max_content_length`. */
  private _clampContent(content: string): string {
    if (content.length <= this._maxContentLength) {
      return content;
    }
    return content.slice(0, this._maxContentLength);
  }

  /** Render the configured no-results message, substituting `{query}`. */
  private _formatNoResults(query: string): string {
    return this._noResultsMessage.includes('{query}')
      ? this._noResultsMessage.replace(/\{query\}/g, query)
      : this._noResultsMessage;
  }

  /** @returns Prompt section describing Wikipedia search capabilities and usage guidance. */
  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Wikipedia Search',
        body: `You can search Wikipedia for factual information using search_wiki. This will return up to ${this._numResults} Wikipedia article summaries.`,
        bullets: [
          'Use search_wiki for factual, encyclopedic information',
          'Great for answering questions about people, places, concepts, and history',
          'Returns reliable, well-sourced information from Wikipedia articles',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating WikipediaSearchSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new WikipediaSearchSkill instance.
 */
export function createSkill(config?: SkillConfig): WikipediaSearchSkill {
  return new WikipediaSearchSkill(config);
}
