/**
 * DataSphere Serverless Skill - Searches SignalWire DataSphere using a DataMap.
 *
 * Tier 3 built-in skill. Matches the Python SDK's param-driven design: all
 * credentials (`space_name`, `project_id`, `token`) are supplied via skill
 * params. No environment variables are strictly required — the platform
 * resolves `${ENV.SIGNALWIRE_AUTH}` at execution time when the DataMap runs,
 * but standalone setup works from params alone.
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
import { DataMap } from '../../DataMap.js';
import { getLogger } from '../../Logger.js';

const log = getLogger('DataSphereServerlessSkill');

const DEFAULT_NO_RESULTS_MESSAGE =
  "I couldn't find any relevant information for '{query}' in the knowledge base. " +
  'Try rephrasing your question or asking about a different topic.';

/**
 * Searches SignalWire DataSphere using a server-side DataMap for serverless execution.
 *
 * Tier 3 built-in skill that generates a DataMap configuration SignalWire
 * executes directly, without a webhook endpoint. Supports `document_id`,
 * `count`, `distance`, `tags`, `language`, `pos_to_expand`, `max_synonyms`,
 * and `no_results_message` config options.
 */
export class DataSphereServerlessSkill extends SkillBase {
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tool_name: {
        type: 'string',
        description: 'Custom tool name for this DataSphere Serverless instance.',
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
   *   `token`, `document_id`, `count`, `distance`, `tags`, `language`,
   *   `pos_to_expand`, `max_synonyms`, `no_results_message`, and `tool_name`.
   */
  constructor(config?: SkillConfig) {
    super('datasphere_serverless', config);
  }

  /**
   * Instance key for the SkillManager. Defaults to
   * `datasphere_serverless_search_knowledge`, matching the Python SDK default.
   * When `tool_name` is set, uses `datasphere_serverless_<tool_name>`.
   */
  override getInstanceKey(): string {
    const toolName = this.getConfig<string>('tool_name', 'search_knowledge');
    return `${this.skillName}_${toolName}`;
  }

  /**
   * @returns Manifest metadata. Environment variables are NOT declared as
   *   required — credentials can be supplied entirely via params, matching
   *   Python's `REQUIRED_ENV_VARS = []`.
   */
  getManifest(): SkillManifest {
    return {
      name: 'datasphere_serverless',
      description:
        'Search knowledge using SignalWire DataSphere with serverless DataMap execution',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['search', 'datasphere', 'signalwire', 'knowledge', 'rag', 'serverless', 'datamap'],
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
   * Validate required configuration parameters before the skill becomes active.
   *
   * Mirrors Python's `setup()` which checks `space_name`, `project_id`, `token`,
   * and `document_id` and returns `False` (logging an error) if any are absent.
   * @returns `true` if all required params are present, `false` otherwise.
   */
  override async setup(): Promise<boolean> {
    const requiredParams = ['space_name', 'project_id', 'token', 'document_id'] as const;
    const missing = requiredParams.filter(
      (param) => !this.getConfig<string | undefined>(param, undefined),
    );
    if (missing.length > 0) {
      log.error('datasphere_serverless: missing required parameters', { missing });
      return false;
    }
    return true;
  }

  /**
   * Global data injected into the agent's SWML/SWAIG context. Matches
   * Python's `get_global_data()` shape so downstream consumers can
   * detect DataSphere availability.
   */
  override getGlobalData(): Record<string, unknown> {
    return {
      datasphere_serverless_enabled: true,
      document_id: this.getConfig<string | undefined>('document_id', undefined),
      knowledge_provider: 'SignalWire DataSphere (Serverless)',
    };
  }

  /**
   * Resolve the tool name used in DataMap registration. Defaults to
   * `search_knowledge` to match the Python SDK default.
   */
  private getToolName(): string {
    return this.getConfig<string>('tool_name', 'search_knowledge');
  }

  /**
   * Build the DataMap-based SWAIG function definition for server-side
   * DataSphere search. This generates a data_map configuration that
   * SignalWire executes directly, without needing a webhook callback.
   */
  private buildDataMapFunction(): Record<string, unknown> {
    const count = this.getConfig<number>('count', 1);
    const distance = this.getConfig<number>('distance', 3.0);
    const documentId = this.getConfig<string | undefined>('document_id', undefined);
    const tags = this.getConfig<string[] | undefined>('tags', undefined);
    const language = this.getConfig<string | undefined>('language', undefined);
    const posToExpand = this.getConfig<string[] | undefined>('pos_to_expand', undefined);
    const maxSynonyms = this.getConfig<number | undefined>('max_synonyms', undefined);
    const noResultsMessage = this.getConfig<string>(
      'no_results_message',
      DEFAULT_NO_RESULTS_MESSAGE,
    );

    const dm = new DataMap(this.getToolName());
    dm.enableEnvExpansion(true);

    dm.purpose(
      'Search the SignalWire DataSphere knowledge base for relevant information. ' +
        'Returns the most relevant text chunks from uploaded documents.',
    );

    dm.parameter(
      'query',
      'string',
      "The search query — what information you're looking for in the knowledge base.",
      { required: true },
    );

    // Build the request body, mirroring Python's webhook params
    const requestBody: Record<string, unknown> = {
      query_string: '${args.query}',
      count,
      distance,
    };

    if (documentId !== undefined) {
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

    // Configure the webhook to call the DataSphere API
    dm.webhook(
      'POST',
      'https://${ENV.SIGNALWIRE_SPACE}.signalwire.com/api/datasphere/documents/search',
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ${ENV.SIGNALWIRE_AUTH}',
        },
      },
    );

    dm.params(requestBody);

    // Match Python's foreach formatter so callers receive a consistent
    // multi-result concatenation rather than only the top three entries.
    dm.foreach({
      input_key: 'chunks',
      output_key: 'formatted_results',
      max: count,
      append: '=== RESULT ===\n${this.text}\n' + '='.repeat(50) + '\n\n',
    });

    dm.output(
      new FunctionResult(
        'I found results for "${args.query}":\n\n${formatted_results}',
      ),
    );

    dm.errorKeys(['error']);

    // Python replaces `{query}` with `${args.query}` at registration time so
    // the platform can substitute the original user query into the fallback.
    dm.fallbackOutput(
      new FunctionResult(noResultsMessage.replace('{query}', '${args.query}')),
    );

    return dm.toSwaigFunction();
  }

  /**
   * Return a stub tool definition since this skill uses DataMap-based execution.
   * The actual DataMap function is provided by getDataMapTools().
   * @returns A single stub tool (named via `tool_name`) that explains its DataMap nature.
   */
  getTools(): SkillToolDefinition[] {
    const toolName = this.getToolName();
    return [
      {
        name: toolName,
        description:
          'Search the SignalWire DataSphere knowledge base for relevant information. (Serverless DataMap mode)',
        parameters: {
          query: {
            type: 'string',
            description: 'The question or topic to search for in the knowledge base.',
          },
        },
        required: ['query'],
        handler: () => {
          return new FunctionResult(
            'This tool is configured for serverless DataMap execution. ' +
              'It should be registered as a data_map function, not invoked via webhook.',
          );
        },
      },
    ];
  }

  /**
   * Get DataMap-based tool definitions for server-side execution.
   * These are registered directly in the SWML output as data_map functions
   * rather than as webhook-backed SWAIG tools.
   * @returns Array containing the DataSphere search DataMap function definition.
   */
  getDataMapTools(): Record<string, unknown>[] {
    return [this.buildDataMapFunction()];
  }

  /** @returns Prompt section describing serverless DataSphere search capabilities. */
  protected override _getPromptSections(): SkillPromptSection[] {
    const toolName = this.getToolName();
    return [
      {
        title: 'Knowledge Search Capability (Serverless)',
        body: `You can search a knowledge base for information using the ${toolName} tool.`,
        bullets: [
          `Use the ${toolName} tool when users ask for information that might be in the knowledge base`,
          'Search for relevant information using clear, specific queries',
          'Summarize search results in a clear, helpful way',
          'If no results are found, suggest the user try rephrasing their question',
          'This tool executes on SignalWire servers for optimal performance',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating DataSphereServerlessSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new DataSphereServerlessSkill instance.
 */
export function createSkill(config?: SkillConfig): DataSphereServerlessSkill {
  return new DataSphereServerlessSkill(config);
}
