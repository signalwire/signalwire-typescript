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
import { MAX_SKILL_INPUT_LENGTH } from '../../SecurityUtils.js';
import { getLogger } from '../../Logger.js';

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
        description:
          'Delay between scraping pages in seconds (parity with Python; ignored in TS which uses API snippets only)',
        default: 0.5,
        min: 0,
      },
      max_content_length: {
        type: 'integer',
        description:
          'Maximum total response size in characters (parity with Python; ignored in TS which uses API snippets only)',
        default: 32768,
        min: 1000,
      },
      oversample_factor: {
        type: 'number',
        description:
          'How many extra results to fetch for quality filtering (parity with Python; ignored in TS)',
        default: 2.5,
        min: 1.0,
        max: 3.5,
      },
      min_quality_score: {
        type: 'number',
        description:
          'Minimum quality score (0-1) for including a result (parity with Python; ignored in TS)',
        default: 0.3,
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
      requiredEnvVars: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID'],
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
              "The search query — what you want to find information about",
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

          try {
            const encodedQuery = encodeURIComponent(query);
            const safeParam = safeSearch !== 'off' ? `&safe=${safeSearch}` : '';
            const url =
              `https://www.googleapis.com/customsearch/v1` +
              `?key=${apiKey}&cx=${searchEngineId}&q=${encodedQuery}&num=${count}${safeParam}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);
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

            const totalResults =
              data.searchInformation?.formattedTotalResults ?? 'unknown';
            const searchTime =
              data.searchInformation?.formattedSearchTime ?? 'unknown';

            const parts: string[] = [
              `Quality web search results for '${query}' (${totalResults} results in ${searchTime} seconds):`,
              '',
            ];

            for (let i = 0; i < data.items.length; i++) {
              const item = data.items[i];
              parts.push(`${i + 1}. ${item.title}`);
              parts.push(`   URL: ${item.link}`);
              if (item.snippet) {
                parts.push(`   ${item.snippet.replace(/\n/g, ' ').trim()}`);
              }
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
