/**
 * DataSphere Serverless Skill - Searches SignalWire DataSphere using a DataMap.
 *
 * Tier 3 built-in skill. Matches the Python SDK's param-driven design: all
 * credentials (`space_name`, `project_id`, `token`) are supplied via skill
 * params. At `setup()` time the skill resolves these params, composes the
 * full DataSphere API URL and a base64 Basic-auth header, and bakes both as
 * literal values into the emitted DataMap SWAIG JSON (mirrors Python
 * `skills/datasphere_serverless/skill.py:152-157, 182-201`).
 */

import { SkillBase } from '../SkillBase.js';
import type {
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
 *
 * @example
 * ```ts
 * agent.addSkill('datasphere_serverless', {
 *   document_id: 'doc_abc123',
 *   count: 3,
 * });
 * ```
 */
export class DataSphereServerlessSkill extends SkillBase {
  // Python ground truth: skills/datasphere_serverless/skill.py:20-28
  static override SKILL_NAME = 'datasphere_serverless';
  static override SKILL_DESCRIPTION =
    'Search knowledge using SignalWire DataSphere with serverless DataMap execution';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_PACKAGES: readonly string[] = [];
  static override REQUIRED_ENV_VARS: readonly string[] = [];
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tool_name: {
        type: 'string',
        description: 'Custom tool name for this DataSphere Serverless instance.',
        default: 'search_knowledge',
      },
      space_name: {
        type: 'string',
        description:
          "SignalWire space name (e.g., 'mycompany' from mycompany.signalwire.com)",
        required: true,
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
   * Instance key for the SkillManager. Defaults to
   * `datasphere_serverless_search_knowledge`, matching the Python SDK default.
   * When `tool_name` is set, uses `datasphere_serverless_<tool_name>`.
   */
  override getInstanceKey(): string {
    const toolName = this.getConfig<string>('tool_name', 'search_knowledge');
    return `${this.skillName}_${toolName}`;
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
    const documentId = this.getConfig<string>('document_id', '');
    const tags = this.getConfig<string[] | undefined>('tags', undefined);
    const language = this.getConfig<string | undefined>('language', undefined);
    const posToExpand = this.getConfig<string[] | undefined>('pos_to_expand', undefined);
    const maxSynonyms = this.getConfig<number | undefined>('max_synonyms', undefined);
    const noResultsMessage = this.getConfig<string>(
      'no_results_message',
      DEFAULT_NO_RESULTS_MESSAGE,
    );

    // Match Python skills/datasphere_serverless/skill.py:152-157: bake the API URL
    // and Basic-auth header directly from skill params. setup() has already
    // validated that space_name/project_id/token/document_id are all present.
    const spaceName = this.getConfig<string>('space_name', '');
    const projectId = this.getConfig<string>('project_id', '');
    const token = this.getConfig<string>('token', '');
    const apiUrl = `https://${spaceName}.signalwire.com/api/datasphere/documents/search`;
    const authHeader = Buffer.from(`${projectId}:${token}`).toString('base64');

    const dm = new DataMap(this.getToolName());

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

    // Build the request body, mirroring Python's webhook params ordering.
    // document_id first (Python skill.py:165-170); conditional params last.
    const requestBody: Record<string, unknown> = {
      document_id: documentId,
      query_string: '${args.query}',
      count,
      distance,
    };
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

    dm.webhook('POST', apiUrl, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
    });

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

    // Python skill.py:207 applies swaig_fields via swaig_function.update(self.swaig_fields)
    // after building the DataMap. Match that merge — caller overrides win.
    const fn = dm.toSwaigFunction();
    return Object.keys(this.swaigFields).length > 0
      ? { ...fn, ...this.swaigFields }
      : fn;
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
