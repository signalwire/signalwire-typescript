/**
 * DateTime Skill - Provides current date/time with optional timezone support.
 *
 * Tier 1 built-in skill: no external dependencies required.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';

/**
 * Provides the current date and time with optional timezone support.
 *
 * Tier 1 built-in skill with no external dependencies. Supports all IANA
 * timezone identifiers via the Intl.DateTimeFormat API.
 *
 * Registers two SWAIG tools: `get_current_time` and `get_current_date`.
 *
 * @example
 * ```ts
 * agent.addSkill('datetime');
 * ```
 */
export class DateTimeSkill extends SkillBase {
  // Python ground truth: skills/datetime/skill.py
  // REQUIRED_PACKAGES = ["pytz"] in Python; TS uses Intl + Date built-ins so [].
  static override SKILL_NAME = 'datetime';
  static override SKILL_DESCRIPTION = 'Get current date, time, and timezone information';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_PACKAGES: readonly string[] = [];
  static override REQUIRED_ENV_VARS: readonly string[] = [];

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return { ...super.getParameterSchema() };
  }

  /**
   * @returns Two tools: `get_current_time` and `get_current_date`, each
   *   accepting an optional IANA timezone and defaulting to UTC.
   */
  getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'get_current_time',
        description:
          "Get the current time, optionally in a specific timezone",
        parameters: {
          timezone: {
            type: 'string',
            description:
              "Timezone name (e.g., 'America/New_York', 'Europe/London'). Defaults to UTC.",
          },
        },
        handler: (args: Record<string, unknown>) => {
          const timezone = (args.timezone as string | undefined) ?? 'UTC';
          const now = new Date();
          try {
            const timeFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: timezone,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
              timeZoneName: 'short',
            });
            return new FunctionResult(
              `The current time is ${timeFormatter.format(now)}`,
            );
          } catch {
            return new FunctionResult(
              `Invalid timezone "${timezone}". Please use a valid IANA timezone identifier.`,
            );
          }
        },
      },
      {
        name: 'get_current_date',
        description: 'Get the current date',
        parameters: {
          timezone: {
            type: 'string',
            description: 'Timezone name for the date. Defaults to UTC.',
          },
        },
        handler: (args: Record<string, unknown>) => {
          const timezone = (args.timezone as string | undefined) ?? 'UTC';
          const now = new Date();
          try {
            const dateFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: timezone,
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            return new FunctionResult(
              `Today's date is ${dateFormatter.format(now)}`,
            );
          } catch {
            return new FunctionResult(
              `Invalid timezone "${timezone}". Please use a valid IANA timezone identifier.`,
            );
          }
        },
      },
    ];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Date and Time Information',
        body: 'You can provide current date and time information.',
        bullets: [
          'Use get_current_time to tell users what time it is.',
          "Use get_current_date to tell users today's date.",
          'Both tools support different timezones via IANA identifiers (e.g., America/New_York, Europe/London, Asia/Tokyo).',
          'If no timezone is specified, UTC is used by default.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating DateTimeSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new DateTimeSkill instance.
 */
export function createSkill(config?: SkillConfig): DateTimeSkill {
  return new DateTimeSkill(config);
}
