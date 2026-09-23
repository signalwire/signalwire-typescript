/**
 * Play Background File Skill - Controls background audio playback during calls.
 *
 * Tier 2 built-in skill: no external dependencies required.
 * Provides tools to play and stop background audio files (e.g., hold music,
 * ambient sounds) during a call using SWML playback actions.
 */

import { SkillBase, defineSkillTool } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { getLogger } from '../../Logger.js';

const log = getLogger('PlayBackgroundFileSkill');

/** A pre-configured file entry as supplied via the `files` config parameter. */
interface PreConfiguredFile {
  /** Unique identifier for the file (alphanumeric, underscores, hyphens). */
  key: string;
  /** Human-readable description of the file. */
  description: string;
  /** URL of the audio/video file to play. */
  url: string;
  /** Whether to wait for the file to finish playing. */
  wait?: boolean;
}

/**
 * Controls background audio playback during calls via SWML actions.
 *
 * Tier 2 built-in skill with no external dependencies. Requires a non-empty
 * `files` array; emits a single configurable tool whose `action` enum maps to
 * `start_<key>` / `stop` values that trigger the corresponding pre-configured
 * file playback.
 *
 * @example
 * ```ts
 * import { AgentBase } from '@signalwire/sdk';
 * const agent = new AgentBase({ name: 'demo', route: '/' });
 * agent.addSkillByName('play_background_file', {
 *   files: [
 *     { key: 'hold', url: 'https://cdn.example.com/hold-music.mp3', description: 'Hold music' },
 *   ],
 * });
 * ```
 */
export class PlayBackgroundFileSkill extends SkillBase {
  // Python ground truth: skills/play_background_file/skill.py
  static override SKILL_NAME = 'play_background_file';
  static override SKILL_DESCRIPTION = 'Control background file playback';
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tool_name: {
        type: 'string',
        description: 'Custom name for the generated SWAIG function (enables multiple instances).',
        default: 'play_background_file',
      },
      files: {
        type: 'array',
        description: 'Array of pre-configured file entries to make available for playback.',
        required: true,
        items: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Unique identifier for the file',
            },
            description: {
              type: 'string',
              description: 'Human-readable description of the file',
            },
            url: {
              type: 'string',
              description: 'URL of the audio/video file to play',
            },
            wait: {
              type: 'boolean',
              description: 'Whether to wait for the file to finish playing',
              default: false,
            },
          },
          required: ['key', 'description', 'url'],
        },
      },
    };
  }

  /**
   * Produce a compound instance key so multiple copies of the skill with
   * distinct `tool_name` values can coexist in a single agent.
   */
  override getInstanceKey(): string {
    const toolName = this.getConfig<string>('tool_name', 'play_background_file');
    return `${this.skillName}_${toolName}`;
  }

  /**
   * Validate configuration. The skill cannot operate without pre-configured
   * files, so it returns `false` when none are configured: the SkillManager
   * treats a falsy `setup()` as fatal and refuses to register the skill
   * (SkillManager `loadSkill` contract).
   */
  override async setup(): Promise<boolean> {
    if (this._getFiles().length === 0) {
      log.error('play_background_file: files parameter must be a non-empty list');
      return false;
    }
    return true;
  }

  private _getFiles(): PreConfiguredFile[] {
    const raw = this.getConfig<unknown>('files', undefined);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (f): f is PreConfiguredFile =>
        typeof f === 'object' &&
        f !== null &&
        typeof (f as PreConfiguredFile).key === 'string' &&
        typeof (f as PreConfiguredFile).description === 'string' &&
        typeof (f as PreConfiguredFile).url === 'string',
    );
  }

  /**
   * @returns A single enum-based tool whose `action` selects a pre-configured
   *   file (`start_<key>`) or stops playback (`stop`). This skill only ever
   *   emits this one tool. `setup()` has already guaranteed `files` is
   *   non-empty, so the skill is never registered with an empty list.
   */
  getTools(): SkillToolDefinition[] {
    return this._getPreConfiguredTools(this._getFiles());
  }

  private _getPreConfiguredTools(files: PreConfiguredFile[]): SkillToolDefinition[] {
    const toolName = this.getConfig<string>('tool_name', 'play_background_file');

    const enumValues: string[] = [];
    const descriptions: string[] = [];
    for (const file of files) {
      const actionKey = `start_${file.key}`;
      enumValues.push(actionKey);
      descriptions.push(`${actionKey}: ${file.description}`);
    }
    enumValues.push('stop');
    descriptions.push('stop: Stop any currently playing background file');

    const description = `Action to perform. Options: ${descriptions.join('; ')}`;
    const byAction = new Map<string, PreConfiguredFile>(files.map((f) => [`start_${f.key}`, f]));

    return [
      defineSkillTool({
        name: toolName,
        description: `Control background file playback for ${toolName.replace(/_/g, ' ')}`,
        parameters: {
          action: {
            type: 'string',
            description,
            // enum is computed at runtime (start_<key> + 'stop'), so it widens
            // to `string` rather than a literal union — args.action is `string`.
            enum: enumValues,
          },
        },
        required: ['action'],
        wait_for_fillers: true,
        skip_fillers: true,
        handler: (args) => {
          // args.action is `string` (required); the model can still emit empty.
          const action = args.action;
          if (!action) {
            return new FunctionResult('Please specify an action to perform.');
          }

          if (action === 'stop') {
            const result = new FunctionResult(
              'Tell the user you have stopped the background file playback.',
            );
            result.stopBackgroundFile();
            return result;
          }

          const file = byAction.get(action);
          if (!file) {
            return new FunctionResult(
              `Unknown action "${action}". Valid actions: ${enumValues.join(', ')}.`,
            );
          }

          const result = new FunctionResult(
            `Tell the user you are now going to play ${file.description} for them.`,
          );
          result.playBackgroundFile(file.url, file.wait ?? false);
          return result;
        },
      }),
    ];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    const files = this._getFiles();
    const toolName = this.getConfig<string>('tool_name', 'play_background_file');

    const bullets: string[] = [
      `Use the ${toolName} tool to control pre-configured background file playback.`,
      `Set action to one of: ${files.map((f) => `start_${f.key}`).join(', ')}, or "stop" to stop playback.`,
    ];
    for (const file of files) {
      bullets.push(`start_${file.key}: ${file.description}`);
    }
    return [
      {
        title: 'Background Audio Playback',
        body: 'You can control pre-configured background audio playback during the call.',
        bullets,
      },
    ];
  }
}

/**
 * Factory function for creating PlayBackgroundFileSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new PlayBackgroundFileSkill instance.
 */
export function createSkill(config?: SkillConfig): PlayBackgroundFileSkill {
  return new PlayBackgroundFileSkill(config);
}
