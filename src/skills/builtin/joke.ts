/**
 * Joke Skill - Tells random jokes from a built-in collection.
 *
 * Tier 1 built-in skill: no external dependencies required.
 * Contains a curated set of jokes across multiple categories.
 */

import { SkillBase, defineSkillTool } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';

/** Internal representation of a joke with setup and punchline. */
interface Joke {
  /** Joke category (e.g., "general", "programming", "dad"). */
  category: string;
  /** The joke setup line. */
  setup: string;
  /** The joke punchline. */
  punchline: string;
}

const JOKES: Joke[] = [
  // General
  {
    category: 'general',
    setup: 'Why did the scarecrow win an award?',
    punchline: 'Because he was outstanding in his field.',
  },
  {
    category: 'general',
    setup: 'What do you call a fake noodle?',
    punchline: 'An impasta.',
  },
  {
    category: 'general',
    setup: 'Why did the bicycle fall over?',
    punchline: 'Because it was two-tired.',
  },
  // Programming
  {
    category: 'programming',
    setup: 'Why do programmers prefer dark mode?',
    punchline: 'Because light attracts bugs.',
  },
  {
    category: 'programming',
    setup: "What is a programmer's favorite hangout place?",
    punchline: 'Foo Bar.',
  },
  {
    category: 'programming',
    setup: 'Why do Java developers wear glasses?',
    punchline: "Because they can't C#.",
  },
  {
    category: 'programming',
    setup: 'How many programmers does it take to change a light bulb?',
    punchline: "None. That's a hardware problem.",
  },
  // Dad jokes
  {
    category: 'dad',
    setup: "I'm reading a book about anti-gravity.",
    punchline: "It's impossible to put down.",
  },
  {
    category: 'dad',
    setup: 'What did the ocean say to the beach?',
    punchline: 'Nothing, it just waved.',
  },
  {
    category: 'dad',
    setup: "Why don't skeletons fight each other?",
    punchline: "They don't have the guts.",
  },
];

/**
 * The two joke `type` values the tool accepts — the wire interface matches the
 * Python reference (`joke/skill.py:71`: enum `['jokes', 'dadjokes']`). The TS
 * implementation is offline (no API), so `dadjokes` maps to the curated `dad`
 * category and `jokes` to everything else (general + programming).
 */
const JOKE_TYPES = ['jokes', 'dadjokes'] as const;

/**
 * Tells random jokes from a curated built-in collection.
 *
 * Tier 1 built-in skill with no external dependencies. The SWAIG tool
 * *interface* matches the Python reference (`get_joke` tool, required `type`
 * parameter with enum `jokes` / `dadjokes`); the implementation differs by
 * design — Python calls the API-Ninjas joke API, the TS port serves from a
 * built-in offline collection (so it needs no API key). `dadjokes` returns a
 * dad joke; `jokes` returns a general/programming joke.
 *
 * @example
 * ```ts
 * agent.addSkill('joke');
 * ```
 */
export class JokeSkill extends SkillBase {
  // Python ground truth: skills/joke/skill.py
  static override SKILL_NAME = 'joke';
  static override SKILL_DESCRIPTION = 'Tell jokes using the API Ninjas joke API';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_PACKAGES: readonly string[] = [];
  static override REQUIRED_ENV_VARS: readonly string[] = [];

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tool_name: {
        type: 'string',
        description: 'Custom name for the joke tool',
        default: 'get_joke',
      },
    };
  }

  /**
   * Signal to the agent prompt that the joke skill is active. Python
   * parity: `get_global_data` returns `{"joke_skill_enabled": true}`.
   */
  override getGlobalData(): Record<string, unknown> {
    return { joke_skill_enabled: true };
  }

  /**
   * @returns A single `get_joke` tool (configurable name). The interface
   *   matches Python (`joke/skill.py:68-77`): a required `type` parameter with
   *   enum `jokes` / `dadjokes`. Served from the offline collection.
   */
  getTools(): SkillToolDefinition[] {
    const toolName = this.getConfig<string>('tool_name', 'get_joke');

    return [
      defineSkillTool({
        name: toolName,
        description: 'Get a random joke.',
        parameters: {
          type: {
            type: 'string',
            description: 'Type of joke to get',
            enum: JOKE_TYPES,
          },
        },
        // Match Python's wire contract: `type` is required (skill.py:71).
        required: ['type'],
        handler: (args) => {
          // args.type is the `'jokes' | 'dadjokes'` union (required + enum).
          // dadjokes → the curated `dad` category; anything else → the rest.
          const pool =
            args.type === 'dadjokes'
              ? JOKES.filter((j) => j.category === 'dad')
              : JOKES.filter((j) => j.category !== 'dad');

          if (pool.length === 0) {
            return new FunctionResult('Sorry, I could not find a joke right now.');
          }

          const joke = pool[Math.floor(Math.random() * pool.length)]!;

          return new FunctionResult(`${joke.setup} ... ${joke.punchline}`);
        },
      }),
    ];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    const toolName = this.getConfig<string>('tool_name', 'get_joke');
    return [
      {
        title: 'Jokes',
        body: 'You have the ability to tell jokes to lighten the mood.',
        bullets: [
          `Use the ${toolName} tool when a user asks for a joke or when humor is appropriate.`,
          'Pass type "dadjokes" for a dad joke, or "jokes" for a regular joke.',
          'Deliver the joke naturally: say the setup, pause briefly, then deliver the punchline.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating JokeSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new JokeSkill instance.
 */
export function createSkill(config?: SkillConfig): JokeSkill {
  return new JokeSkill(config);
}
