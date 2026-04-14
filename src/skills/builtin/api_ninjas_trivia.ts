/**
 * API Ninjas Trivia Skill - Fetches trivia questions from the API Ninjas service.
 *
 * Tier 2 built-in skill: requires API_NINJAS_KEY environment variable.
 * Uses the API Ninjas Trivia endpoint to retrieve random trivia questions
 * with optional category filtering.
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

const log = getLogger('ApiNinjasTriviaSkill');

/** Response shape from the API Ninjas trivia endpoint. */
interface TriviaResponse {
  /** Trivia category name. */
  category: string;
  /** The trivia question text. */
  question: string;
  /** The correct answer. */
  answer: string;
}

const VALID_CATEGORIES = [
  'artliterature',
  'language',
  'sciencenature',
  'general',
  'fooddrink',
  'peopleplaces',
  'geography',
  'historyholidays',
  'entertainment',
  'toysgames',
  'music',
  'mathematics',
  'religionmythology',
  'sportsleisure',
] as const;

/**
 * Fetches trivia questions from the API Ninjas service.
 *
 * Tier 2 built-in skill. Requires the `API_NINJAS_KEY` environment variable.
 * Supports optional `default_category` and `reveal_answer` config options.
 */
export class ApiNinjasTriviaSkill extends SkillBase {
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  /**
   * @param config - Optional configuration; supports `tool_name`, `api_key`,
   *   `categories`, `default_category`, and `reveal_answer`.
   */
  constructor(config?: SkillConfig) {
    super('api_ninjas_trivia', config);
  }

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tool_name: {
        type: 'string',
        description:
          'Custom name for the SWAIG trivia tool (enables multiple instances).',
        default: 'get_trivia',
      },
      api_key: {
        type: 'string',
        description: 'API Ninjas API key.',
        hidden: true,
        env_var: 'API_NINJAS_KEY',
        required: true,
      },
      categories: {
        type: 'array',
        description:
          'Subset of trivia categories to enable. Defaults to all categories.',
        required: false,
        default: [...VALID_CATEGORIES],
        items: {
          type: 'string',
          enum: [...VALID_CATEGORIES],
        },
      },
      default_category: {
        type: 'string',
        description: 'Default trivia category if none is specified.',
      },
      reveal_answer: {
        type: 'boolean',
        description: 'Whether to include the answer in the response.',
        default: false,
      },
    };
  }

  /**
   * Produce a compound instance key so multiple copies of the skill with
   * distinct `tool_name` values can coexist in a single agent.
   */
  override getInstanceKey(): string {
    const toolName = this.getConfig<string>('tool_name', 'get_trivia');
    return `${this.skillName}_${toolName}`;
  }

  /**
   * @returns Manifest for the API Ninjas Trivia skill. The API key may be
   *   supplied via the `api_key` config parameter OR via the
   *   `API_NINJAS_KEY` environment variable, so `requiredEnvVars` is empty
   *   to match Python's contract (which accepts the key through params only).
   */
  getManifest(): SkillManifest {
    return {
      name: 'api_ninjas_trivia',
      description:
        'Fetches trivia questions from the API Ninjas service. Supports multiple categories for varied trivia topics.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['trivia', 'api', 'entertainment', 'quiz', 'external'],
      requiredEnvVars: [],
      configSchema: {
        tool_name: {
          type: 'string',
          description:
            'Custom name for the SWAIG trivia tool (enables multiple instances).',
          default: 'get_trivia',
        },
        categories: {
          type: 'array',
          description:
            'Subset of trivia categories to enable. Defaults to all categories.',
        },
        default_category: {
          type: 'string',
          description:
            'Default trivia category if none is specified by the user.',
        },
        reveal_answer: {
          type: 'boolean',
          description:
            'Whether to include the answer in the response. Defaults to false so the AI can quiz the user.',
          default: false,
        },
      },
    };
  }

  /** @returns A single trivia tool (configurable name) that fetches a random trivia question with optional category. */
  getTools(): SkillToolDefinition[] {
    const toolName = this.getConfig<string>('tool_name', 'get_trivia');
    const defaultCategory = this.getConfig<string | undefined>(
      'default_category',
      undefined,
    );
    const revealAnswer = this.getConfig<boolean>('reveal_answer', false);
    const configuredCategories = this.getConfig<string[] | undefined>(
      'categories',
      undefined,
    );
    const enabledCategories =
      Array.isArray(configuredCategories) && configuredCategories.length > 0
        ? configuredCategories.filter((c): c is string =>
            (VALID_CATEGORIES as readonly string[]).includes(c),
          )
        : [...VALID_CATEGORIES];

    return [
      {
        name: toolName,
        description:
          'Get a random trivia question. Optionally specify a category to narrow the topic.',
        parameters: {
          category: {
            type: 'string',
            description:
              'Trivia category. Available categories: ' +
              enabledCategories.join(', ') +
              '. If not specified, a random category is used.',
            enum: enabledCategories,
          },
        },
        handler: async (args: Record<string, unknown>) => {
          const apiKey =
            this.getConfig<string | undefined>('api_key', undefined) ??
            process.env['API_NINJAS_KEY'];
          if (!apiKey) {
            return new FunctionResult(
              'Trivia service is not configured. The API_NINJAS_KEY environment variable is missing.',
            );
          }

          let category = (args.category as string | undefined) ?? defaultCategory;

          // Validate category if provided
          if (category && typeof category === 'string') {
            const normalized = category.toLowerCase().trim().replace(/[\s_-]/g, '');
            if (
              !enabledCategories.includes(normalized)
            ) {
              return new FunctionResult(
                `Unknown trivia category "${category}". Available categories: ${enabledCategories.join(', ')}.`,
              );
            }
            category = normalized;
          }

          try {
            const url = category
              ? `https://api.api-ninjas.com/v1/trivia?category=${encodeURIComponent(category)}`
              : 'https://api.api-ninjas.com/v1/trivia';

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);
            let response: Response;
            try {
              response = await fetch(url, {
                headers: {
                  'X-Api-Key': apiKey,
                },
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeout);
            }

            if (!response.ok) {
              log.error('trivia_api_error', { status: response.status });
              return new FunctionResult(
                'The trivia service encountered an error. Please try again later.',
              );
            }

            const data = (await response.json()) as TriviaResponse[];

            if (!Array.isArray(data) || data.length === 0) {
              return new FunctionResult(
                'No trivia questions were returned. Please try again or try a different category.',
              );
            }

            const trivia = data[0]!;

            if (revealAnswer) {
              return new FunctionResult(
                `Trivia (${trivia.category}): ${trivia.question} Answer: ${trivia.answer}`,
              );
            }

            // When not revealing the answer, provide it in a structured way
            // so the AI knows the answer but can quiz the user
            return new FunctionResult(
              `Here is a trivia question from the "${trivia.category}" category. ` +
                `Question: ${trivia.question} ` +
                `[The correct answer is: ${trivia.answer}. Do not reveal this unless the user attempts an answer or asks for it.]`,
            );
          } catch (err) {
            log.error('get_trivia_failed', { error: err instanceof Error ? err.message : String(err) });
            return new FunctionResult(
              'The request could not be completed. Please try again.',
            );
          }
        },
      },
    ];
  }

  /** @returns Prompt section describing trivia capabilities and quiz behavior. */
  protected override _getPromptSections(): SkillPromptSection[] {
    const revealAnswer = this.getConfig<boolean>('reveal_answer', false);

    const bullets: string[] = [
      'Use the get_trivia tool to fetch a random trivia question.',
      `Available categories: ${VALID_CATEGORIES.join(', ')}.`,
      'If no category is specified, a random category will be selected.',
    ];

    if (!revealAnswer) {
      bullets.push(
        'When you receive a trivia question, ask it to the user and let them try to answer before revealing the correct answer.',
        'If the user gets it wrong, give them a hint or tell them the correct answer.',
      );
    } else {
      bullets.push(
        'Trivia answers are included in the response. Share the question and answer with the user.',
      );
    }

    bullets.push(
      'Keep trivia fun and engaging. Encourage the user to try more questions.',
    );

    return [
      {
        title: 'Trivia Questions',
        body: 'You can fetch and ask trivia questions from a wide range of categories.',
        bullets,
      },
    ];
  }

  /** @returns Speech recognition hints for trivia-related keywords. */
  getHints(): string[] {
    return ['trivia', 'quiz', 'question', 'fun fact'];
  }
}

/**
 * Factory function for creating ApiNinjasTriviaSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new ApiNinjasTriviaSkill instance.
 */
export function createSkill(config?: SkillConfig): ApiNinjasTriviaSkill {
  return new ApiNinjasTriviaSkill(config);
}
