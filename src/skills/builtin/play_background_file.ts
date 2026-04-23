/**
 * Play Background File Skill - Controls background audio playback during calls.
 *
 * Tier 2 built-in skill: no external dependencies required.
 * Provides tools to play and stop background audio files (e.g., hold music,
 * ambient sounds) during a call using SWML playback actions.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';

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
 * Tier 2 built-in skill with no external dependencies. Provides tools to play
 * and stop background audio files (e.g., hold music, ambient sounds). Supports
 * two configuration modes:
 *
 *  - Pre-configured `files` array (matches the Python skill): emits a single
 *    configurable tool whose `action` enum maps to `start_<key>` / `stop`
 *    values that trigger the corresponding file playback.
 *  - Free-form `default_file_url` / `allowed_domains`: emits two tools,
 *    `play_background` (arbitrary URL) and `stop_background`.
 *
 * @example
 * ```ts
 * agent.addSkill('play_background_file', {
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
        description:
          'Custom name for the generated SWAIG function (enables multiple instances).',
        default: 'play_background_file',
      },
      files: {
        type: 'array',
        description:
          'Array of pre-configured file entries to make available for playback.',
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
      default_file_url: {
        type: 'string',
        description:
          'Default audio file URL to use when no URL is specified (free-form mode).',
      },
      allowed_domains: {
        type: 'array',
        description: 'List of allowed domains for audio file URLs (free-form mode).',
        items: { type: 'string' },
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
   * @returns Either a single enum-based tool (when pre-configured `files` are
   *   supplied — matches Python), or two free-form tools (`play_background`
   *   and `stop_background`) when only `default_file_url`/`allowed_domains`
   *   are configured.
   */
  getTools(): SkillToolDefinition[] {
    const files = this._getFiles();
    if (files.length > 0) {
      return this._getPreConfiguredTools(files);
    }
    return this._getFreeFormTools();
  }

  private _getPreConfiguredTools(
    files: PreConfiguredFile[],
  ): SkillToolDefinition[] {
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
    const byAction = new Map<string, PreConfiguredFile>(
      files.map((f) => [`start_${f.key}`, f]),
    );

    return [
      {
        name: toolName,
        description: `Control background file playback for ${toolName.replace(/_/g, ' ')}`,
        parameters: {
          action: {
            type: 'string',
            description,
            enum: enumValues,
          },
        },
        required: ['action'],
        wait_for_fillers: true,
        skip_fillers: true,
        handler: (args: Record<string, unknown>) => {
          const action = args['action'] as string | undefined;
          if (!action || typeof action !== 'string') {
            return new FunctionResult(
              'Please specify an action to perform.',
            );
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
      },
    ];
  }

  private _getFreeFormTools(): SkillToolDefinition[] {
    const defaultFileUrl = this.getConfig<string | undefined>(
      'default_file_url',
      undefined,
    );
    const allowedDomains = this.getConfig<string[] | undefined>(
      'allowed_domains',
      undefined,
    );

    return [
      {
        name: 'play_background',
        description:
          'Play an audio file in the background during the call. The audio will loop continuously unless stopped. Useful for hold music, ambient sounds, or background audio.',
        parameters: {
          file_url: {
            type: 'string',
            description:
              'The URL of the audio file to play (MP3, WAV, or other supported format). Must be a publicly accessible URL.',
          },
          wait: {
            type: 'boolean',
            description:
              'If true, wait for the audio file to finish playing before continuing. Defaults to false (play in background).',
          },
        },
        required: defaultFileUrl ? [] : ['file_url'],
        wait_for_fillers: true,
        skip_fillers: true,
        handler: (args: Record<string, unknown>) => {
          let fileUrl = (args.file_url as string | undefined) ?? defaultFileUrl;
          const wait = (args.wait as boolean | undefined) ?? false;

          if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.trim().length === 0) {
            return new FunctionResult(
              'Please provide a file URL for the audio to play in the background.',
            );
          }

          fileUrl = fileUrl.trim();

          // Validate URL format
          try {
            const parsed = new URL(fileUrl);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              return new FunctionResult(
                'Invalid file URL. Only HTTP and HTTPS URLs are supported.',
              );
            }

            // Check allowed domains if configured
            if (allowedDomains && allowedDomains.length > 0) {
              const hostname = parsed.hostname.toLowerCase();
              const isAllowed = allowedDomains.some(
                (domain) =>
                  hostname === domain.toLowerCase() ||
                  hostname.endsWith(`.${domain.toLowerCase()}`),
              );
              if (!isAllowed) {
                return new FunctionResult(
                  `Audio files from "${parsed.hostname}" are not allowed. Allowed domains: ${allowedDomains.join(', ')}.`,
                );
              }
            }
          } catch {
            return new FunctionResult(
              `Invalid file URL: "${fileUrl}". Please provide a valid HTTP or HTTPS URL.`,
            );
          }

          const result = new FunctionResult(
            `Now playing background audio: ${fileUrl}${wait ? ' (waiting for completion)' : ''}.`,
          );
          result.playBackgroundFile(fileUrl, wait);

          return result;
        },
      },
      {
        name: 'stop_background',
        description:
          'Stop any audio file currently playing in the background. Use this when the caller is ready to resume the conversation or when background audio is no longer needed.',
        parameters: {},
        wait_for_fillers: true,
        skip_fillers: true,
        handler: () => {
          const result = new FunctionResult(
            'Background audio playback has been stopped.',
          );
          result.stopBackgroundFile();

          return result;
        },
      },
    ];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    const files = this._getFiles();
    const toolName = this.getConfig<string>('tool_name', 'play_background_file');

    if (files.length > 0) {
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

    const defaultFileUrl = this.getConfig<string | undefined>(
      'default_file_url',
      undefined,
    );

    const bullets: string[] = [
      'Use the play_background tool to start playing audio in the background during a call.',
      'Use the stop_background tool to stop any currently playing background audio.',
      'Background audio is useful for hold music, ambient sounds, or playing announcements.',
      'The audio will continue playing until explicitly stopped with stop_background.',
    ];

    if (defaultFileUrl) {
      bullets.push(
        `A default audio file is configured. You can call play_background without specifying a file URL to use the default.`,
      );
    }

    return [
      {
        title: 'Background Audio Playback',
        body: 'You can control background audio playback during the call.',
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
