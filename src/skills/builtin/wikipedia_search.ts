/**
 * Wikipedia Search Skill - Searches Wikipedia for article summaries.
 *
 * Tier 3 built-in skill: no external API key required. Uses the Wikipedia
 * REST API to fetch article summaries and extracts for any given topic.
 * Matches the Python SDK's `num_results` / `no_results_message` parity.
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
 * customizes the fallback text (supports `{query}` interpolation).
 */
export class WikipediaSearchSkill extends SkillBase {
  /** Resolved `num_results` value (populated in `setup()`). */
  protected numResults: number = 1;
  /** Resolved `no_results_message` template (populated in `setup()`). */
  private _noResultsMessage: string = DEFAULT_NO_RESULTS_MESSAGE;

  /**
   * @param config - Optional configuration; supports `num_results` and
   *   `no_results_message`.
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
    this.numResults = Math.max(1, Math.min(5, Math.floor(configured)));

    const rawMessage = this.getConfig<string | undefined>(
      'no_results_message',
      undefined,
    );
    this._noResultsMessage =
      rawMessage && rawMessage.length > 0 ? rawMessage : DEFAULT_NO_RESULTS_MESSAGE;
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
        },
        required: ['query'],
        handler: async (args: Record<string, unknown>) => {
          const rawQuery = args['query'];

          if (
            !rawQuery ||
            typeof rawQuery !== 'string' ||
            rawQuery.trim().length === 0
          ) {
            return new FunctionResult(
              'Please provide a search query for Wikipedia.',
            );
          }

          const result = await this.searchWiki(rawQuery.trim());
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
   * how many articles to aggregate.
   *
   * @param query - Plain-text search term.
   * @returns Formatted text ready for display to the caller.
   */
  async searchWiki(query: string): Promise<string> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      return this._formatNoResults(trimmedQuery);
    }

    try {
      const baseUrl = 'https://en.wikipedia.org/w/api.php';
      const searchUrl =
        `${baseUrl}?action=query&list=search&format=json` +
        `&srsearch=${encodeURIComponent(trimmedQuery)}` +
        `&srlimit=${this.numResults}`;

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

      for (const result of searchResults.slice(0, this.numResults)) {
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

      if (articles.length === 1) {
        return articles[0];
      }
      const separator = '\n\n' + '='.repeat(50) + '\n\n';
      return articles.join(separator);
    } catch (err) {
      log.error('wikipedia_search_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return `Error searching Wikipedia: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
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
        body: `You can search Wikipedia for factual information using search_wiki. This will return up to ${this.numResults} Wikipedia article summaries.`,
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
