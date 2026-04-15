/**
 * DataSphere Skill - Searches SignalWire DataSphere for knowledge base content.
 *
 * Tier 3 built-in skill matching the Python SDK. All credentials (`space_name`,
 * `project_id`, `token`) and `document_id` are supplied via skill params. Env
 * var fallbacks (`SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN`, `SIGNALWIRE_SPACE`)
 * are honored when the corresponding param is not set.
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

const log = getLogger('DataSphereSkill');

const DEFAULT_NO_RESULTS_MESSAGE =
  "I couldn't find any relevant information for '{query}' in the knowledge base. " +
  'Try rephrasing your question or asking about a different topic.';

/** A single chunk returned by the DataSphere search API. */
interface DataSphereChunk {
  /** Matched text chunk content. */
  text?: string;
  /** Alternative content field name. */
  content?: string;
  /** Alternative chunk field name. */
  chunk?: string;
  /** Distance score (lower is more similar). */
  score?: number;
  /** ID of the source document. */
  document_id?: string;
  /** Document metadata. */
  metadata?: Record<string, unknown>;
  /** Index of the chunk within the document. */
  chunk_index?: number;
}

/** Response shape from the SignalWire DataSphere search API. */
interface DataSphereResponse {
  /** Array of matching chunks. The API returns `chunks`, not `results`. */
  chunks?: DataSphereChunk[];
  /** Error message if the request failed. */
  error?: string;
  /** Additional error information. */
  message?: string;
}

/**
 * Searches SignalWire DataSphere for knowledge base content using semantic search.
 *
 * Tier 3 built-in skill. Credentials can be supplied via params or fall back to
 * `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN`, and `SIGNALWIRE_SPACE` environment
 * variables. Supports `count`, `distance`, `tags`, `language`, `pos_to_expand`,
 * `max_synonyms`, and `no_results_message` config options.
 */
export class DataSphereSkill extends SkillBase {
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tool_name: {
        type: 'string',
        description: 'Custom tool name for this DataSphere instance.',
      },
      space_name: {
        type: 'string',
        description:
          "SignalWire space name (e.g., 'mycompany' from mycompany.signalwire.com)",
        required: true,
        env_var: 'SIGNALWIRE_SPACE',
      },
      project_id: {
        type: 'string',
        description: 'SignalWire project ID',
        required: true,
        env_var: 'SIGNALWIRE_PROJECT_ID',
      },
      token: {
        type: 'string',
        description: 'SignalWire API token',
        required: true,
        hidden: true,
        env_var: 'SIGNALWIRE_TOKEN',
      },
      document_id: {
        type: 'string',
        description: 'DataSphere document ID to search within',
        required: true,
      },
      count: {
        type: 'integer',
        description: 'Number of search results to return',
        default: 1,
        min: 1,
        max: 10,
      },
      distance: {
        type: 'number',
        description:
          'Maximum distance threshold for results (lower is more relevant)',
        default: 3.0,
        min: 0,
        max: 10,
      },
      tags: {
        type: 'array',
        description: 'Tags to filter search results',
        items: { type: 'string' },
      },
      language: {
        type: 'string',
        description: "Language code for query expansion (e.g., 'en', 'es')",
      },
      pos_to_expand: {
        type: 'array',
        description: 'Parts of speech to expand with synonyms',
        items: { type: 'string', enum: ['NOUN', 'VERB', 'ADJ', 'ADV'] },
      },
      max_synonyms: {
        type: 'integer',
        description: 'Maximum number of synonyms to use for query expansion',
        min: 1,
        max: 10,
      },
      no_results_message: {
        type: 'string',
        description: 'Message to return when no results are found',
        default: DEFAULT_NO_RESULTS_MESSAGE,
      },
    };
  }

  /**
   * @param config - Optional configuration; supports `space_name`, `project_id`,
   *   `token`, `document_id`, `tool_name`, `count`, `distance`, `tags`,
   *   `language`, `pos_to_expand`, `max_synonyms`, `no_results_message`.
   */
  constructor(config?: SkillConfig) {
    super('datasphere', config);
  }

  /**
   * Instance key for the SkillManager. Defaults to `datasphere_search_knowledge`,
   * matching the Python SDK default. When `tool_name` is set, uses
   * `datasphere_<tool_name>`.
   */
  override getInstanceKey(): string {
    const toolName = this.getConfig<string>('tool_name', 'search_knowledge');
    return `${this.skillName}_${toolName}`;
  }

  /** @returns Manifest for this skill. No required env vars — all credentials come from params with env fallback. */
  getManifest(): SkillManifest {
    return {
      name: 'datasphere',
      description: 'Search knowledge using SignalWire DataSphere RAG stack',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['search', 'datasphere', 'signalwire', 'knowledge', 'rag', 'external'],
      requiredEnvVars: [],
      configSchema: {
        space_name: {
          type: 'string',
          description: 'SignalWire space name.',
        },
        project_id: {
          type: 'string',
          description: 'SignalWire project ID.',
        },
        token: {
          type: 'string',
          description: 'SignalWire API token.',
        },
        document_id: {
          type: 'string',
          description: 'DataSphere document ID to search within.',
        },
        count: {
          type: 'integer',
          description: 'Number of results to return. Defaults to 1. Range 1-10.',
          default: 1,
        },
        distance: {
          type: 'number',
          description:
            'Maximum distance threshold (lower is more relevant). Defaults to 3.0. Range 0-10.',
          default: 3.0,
        },
        tags: {
          type: 'array',
          description: 'Tags to filter search results.',
        },
        language: {
          type: 'string',
          description: 'Language code for query expansion.',
        },
        pos_to_expand: {
          type: 'array',
          description: 'Parts of speech to expand with synonyms.',
        },
        max_synonyms: {
          type: 'integer',
          description: 'Maximum number of synonyms (1-10).',
        },
        no_results_message: {
          type: 'string',
          description:
            'Message returned when no results are found. Supports {query} interpolation.',
        },
      },
    };
  }

  /**
   * Global data injected into the agent's SWML context. Matches Python's
   * `get_global_data()` so downstream consumers can detect DataSphere
   * availability, the configured `document_id`, and the knowledge provider.
   */
  override getGlobalData(): Record<string, unknown> {
    return {
      datasphere_enabled: true,
      document_id: this.getConfig<string | undefined>('document_id', undefined),
      knowledge_provider: 'SignalWire DataSphere',
    };
  }

  /** Resolve the tool name (defaults to `search_knowledge`, matching Python SDK). */
  private getToolName(): string {
    return this.getConfig<string>('tool_name', 'search_knowledge');
  }

  /** @returns A single tool (named via `tool_name`) that performs semantic search. */
  getTools(): SkillToolDefinition[] {
    const count = this.getConfig<number>('count', 1);
    const distance = this.getConfig<number>('distance', 3.0);
    const configDocumentId = this.getConfig<string | undefined>('document_id', undefined);
    const tags = this.getConfig<string[] | undefined>('tags', undefined);
    const language = this.getConfig<string | undefined>('language', undefined);
    const posToExpand = this.getConfig<string[] | undefined>('pos_to_expand', undefined);
    const maxSynonyms = this.getConfig<number | undefined>('max_synonyms', undefined);
    const noResultsMessage = this.getConfig<string>(
      'no_results_message',
      DEFAULT_NO_RESULTS_MESSAGE,
    );
    const toolName = this.getToolName();

    return [
      {
        name: toolName,
        description:
          'Search the knowledge base for information on any topic and return relevant results.',
        parameters: {
          query: {
            type: 'string',
            description:
              "The search query — what information you're looking for in the knowledge base.",
          },
          document_id: {
            type: 'string',
            description:
              'Optional: limit this search to a specific document by its ID (overrides the skill-level default).',
          },
        },
        required: ['query'],
        handler: async (args: Record<string, unknown>) => {
          const rawQuery = args['query'];
          const perCallDocumentId = args['document_id'];

          if (
            !rawQuery ||
            typeof rawQuery !== 'string' ||
            rawQuery.trim().length === 0
          ) {
            return new FunctionResult(
              'Please provide a search query. What would you like me to search for in the knowledge base?',
            );
          }

          const query = rawQuery.trim();

          const projectId =
            this.getConfig<string | undefined>('project_id', undefined) ??
            process.env['SIGNALWIRE_PROJECT_ID'];
          const token =
            this.getConfig<string | undefined>('token', undefined) ??
            process.env['SIGNALWIRE_TOKEN'];
          const space =
            this.getConfig<string | undefined>('space_name', undefined) ??
            process.env['SIGNALWIRE_SPACE'];

          if (!projectId || !token || !space) {
            return new FunctionResult(
              'DataSphere is not configured. The SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN, and SIGNALWIRE_SPACE environment variables (or equivalent config params) are required.',
            );
          }

          // Resolve document_id: per-call override > config default.
          let documentId: string | undefined;
          if (
            typeof perCallDocumentId === 'string' &&
            perCallDocumentId.trim().length > 0
          ) {
            documentId = perCallDocumentId.trim();
          } else {
            documentId = configDocumentId;
          }

          log.info('datasphere_search', { query, document_id: documentId });

          try {
            const spaceHost = space.includes('.') ? space : `${space}.signalwire.com`;
            const url = `https://${spaceHost}/api/datasphere/documents/search`;

            const requestBody: Record<string, unknown> = {
              query_string: query,
              count,
              distance,
            };

            if (documentId) {
              requestBody['document_id'] = documentId;
            }
            if (tags !== undefined) {
              requestBody['tags'] = tags;
            }
            if (language !== undefined) {
              requestBody['language'] = language;
            }
            if (posToExpand !== undefined) {
              requestBody['pos_to_expand'] = posToExpand;
            }
            if (maxSynonyms !== undefined) {
              requestBody['max_synonyms'] = maxSynonyms;
            }

            const authHeader = Buffer.from(`${projectId}:${token}`).toString('base64');

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);
            let response: Response;
            try {
              response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: `Basic ${authHeader}`,
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
              });
            } catch (err) {
              clearTimeout(timeout);
              if (err instanceof Error && err.name === 'AbortError') {
                log.error('datasphere_timeout');
                return new FunctionResult(
                  'Sorry, the knowledge search timed out. Please try again.',
                );
              }
              throw err;
            }
            clearTimeout(timeout);

            if (!response.ok) {
              log.error('datasphere_api_error', { status: response.status });
              return new FunctionResult(
                'Sorry, there was an error accessing the knowledge base. Please try again later.',
              );
            }

            const data = (await response.json()) as DataSphereResponse;

            if (!data || typeof data !== 'object') {
              log.warn('datasphere_invalid_response');
              return new FunctionResult(
                DataSphereSkill._formatNoResultsMessage(noResultsMessage, query),
              );
            }

            // DataSphere API returns 'chunks', not 'results'.
            const chunks = data.chunks ?? [];

            if (chunks.length === 0) {
              return new FunctionResult(
                DataSphereSkill._formatNoResultsMessage(noResultsMessage, query),
              );
            }

            return new FunctionResult(
              DataSphereSkill._formatSearchResults(query, chunks),
            );
          } catch (err) {
            log.error('datasphere_search_failed', {
              error: err instanceof Error ? err.message : String(err),
            });
            return new FunctionResult(
              'Sorry, I encountered an error while searching the knowledge base. Please try again later.',
            );
          }
        },
      },
    ];
  }

  /** Format search result chunks into a user-facing string. */
  private static _formatSearchResults(
    query: string,
    chunks: DataSphereChunk[],
  ): string {
    const header =
      chunks.length === 1
        ? `I found 1 result for '${query}':\n\n`
        : `I found ${chunks.length} results for '${query}':\n\n`;

    const blocks: string[] = [];
    const separator = '='.repeat(50);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let content = `=== RESULT ${i + 1} ===\n`;

      if (typeof chunk.text === 'string') {
        content += chunk.text;
      } else if (typeof chunk.content === 'string') {
        content += chunk.content;
      } else if (typeof chunk.chunk === 'string') {
        content += chunk.chunk;
      } else {
        content += JSON.stringify(chunk, null, 2);
      }

      content += `\n${separator}\n\n`;
      blocks.push(content);
    }

    return header + blocks.join('\n');
  }

  /** Apply the `{query}` template to the no-results message. */
  private static _formatNoResultsMessage(template: string, query: string): string {
    return template.includes('{query}')
      ? template.replace(/\{query\}/g, query)
      : template;
  }

  /** @returns Prompt section describing DataSphere knowledge base search capabilities. */
  protected override _getPromptSections(): SkillPromptSection[] {
    const toolName = this.getToolName();
    return [
      {
        title: 'Knowledge Search Capability',
        body: `You can search a knowledge base for information using the ${toolName} tool.`,
        bullets: [
          `Use the ${toolName} tool when users ask for information that might be in the knowledge base`,
          'Search for relevant information using clear, specific queries',
          'Summarize search results in a clear, helpful way',
          'If no results are found, suggest the user try rephrasing their question',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating DataSphereSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new DataSphereSkill instance.
 */
export function createSkill(config?: SkillConfig): DataSphereSkill {
  return new DataSphereSkill(config);
}
