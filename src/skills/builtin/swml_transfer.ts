/**
 * SWML Transfer Skill - Transfer calls between agents using SWML with pattern matching.
 *
 * Port of the Python `SWMLTransferSkill`. Supports the Python `transfers`
 * config (regex-keyed dict of per-destination configs with url/address,
 * message, return_message, post_process, final, from_addr) as well as the
 * TypeScript-native `patterns` array of friendly-named destinations.
 *
 * Either configuration shape works; when both are provided `transfers`
 * takes precedence (matching the Python API).
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { getLogger } from '../../Logger.js';

const log = getLogger('SwmlTransferSkill');

/** A named transfer destination pattern (TS-style). */
interface TransferPattern {
  /** Friendly name for the destination. */
  name: string;
  /** SIP URI, phone number, or agent URL to transfer to. */
  destination: string;
  /** Optional description. */
  description?: string;
  /** Optional pre-transfer message override. */
  message?: string;
  /** Optional message shown when returning from the transfer. */
  returnMessage?: string;
  /** Whether to AI-process the message. */
  postProcess?: boolean;
  /** Whether the transfer is permanent (default) or temporary. */
  final?: boolean;
  /** Optional caller-ID override for connect actions. */
  fromAddr?: string;
}

/** Per-destination entry in the Python-style `transfers` map. */
interface TransferConfig {
  url?: string;
  address?: string;
  message?: string;
  return_message?: string;
  post_process?: boolean;
  final?: boolean;
  from_addr?: string;
}

/**
 * Transfer calls between agents based on pattern matching.
 *
 * Multi-instance capable (distinguished by `tool_name`).
 * Accepts either Python-style `transfers` config (regex → per-entry config)
 * or TypeScript-style `patterns` array of named destinations.
 *
 * @example
 * ```ts
 * agent.addSkill('swml_transfer', {
 *   patterns: [
 *     { name: 'sales', pattern: /sales|pricing|buy/i, to: '+15551112222' },
 *     { name: 'support', pattern: /help|support|broken/i, to: '+15553334444' },
 *   ],
 * });
 * ```
 */
export class SwmlTransferSkill extends SkillBase {
  // Python ground truth: skills/swml_transfer/skill.py:~60-67
  static override SKILL_NAME = 'swml_transfer';
  static override SKILL_DESCRIPTION = 'Transfer calls between agents based on pattern matching';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_PACKAGES: readonly string[] = [];
  static override REQUIRED_ENV_VARS: readonly string[] = [];
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      transfers: {
        type: 'object',
        description:
          'Transfer configurations mapping patterns (regex or name) to destination configs. Each value has either url or address, plus optional message/return_message/post_process/final/from_addr.',
        required: true,
      },
      patterns: {
        type: 'array',
        description:
          'Array of named transfer patterns: { name, destination, description?, message?, returnMessage?, postProcess?, final?, fromAddr? }.',
        required: false,
        items: { type: 'object' },
      },
      allow_arbitrary: {
        type: 'boolean',
        description:
          'Whether to allow transfers to arbitrary destinations not in patterns list.',
        required: false,
      },
      tool_name: {
        type: 'string',
        description: 'Name of the transfer tool exposed to the AI.',
        default: 'transfer_call',
        required: false,
      },
      description: {
        type: 'string',
        description: 'Description for the transfer tool',
        default: 'Transfer call based on pattern matching',
        required: false,
      },
      parameter_name: {
        type: 'string',
        description: 'Name of the parameter that accepts the transfer type',
        default: 'transfer_type',
        required: false,
      },
      parameter_description: {
        type: 'string',
        description: 'Description for the transfer type parameter',
        default: 'The type of transfer to perform',
        required: false,
      },
      default_message: {
        type: 'string',
        description: 'Message when no pattern matches',
        default: 'Please specify a valid transfer type.',
        required: false,
      },
      default_post_process: {
        type: 'boolean',
        description: 'Whether to process default message with AI',
        default: false,
        required: false,
      },
      required_fields: {
        type: 'object',
        description:
          'Additional required fields to collect before transfer (name -> description).',
        default: {},
        required: false,
      },
    };
  }

  // Runtime state
  private transfers: Record<string, TransferConfig> = {};
  private patterns: TransferPattern[] = [];
  private toolName = 'transfer_call';
  private toolDescription = 'Transfer call based on pattern matching';
  private parameterName = 'transfer_type';
  private parameterDescription = 'The type of transfer to perform';
  private defaultMessage = 'Please specify a valid transfer type.';
  private defaultPostProcess = false;
  private requiredFields: Record<string, string> = {};
  private allowArbitraryOverride: boolean | undefined;

  override getInstanceKey(): string {
    const toolName = this.getConfig<string>('tool_name', 'transfer_call');
    return `${this.skillName}_${toolName}`;
  }

  override async setup(): Promise<boolean> {
    this.toolName = this.getConfig<string>('tool_name', 'transfer_call');
    this.toolDescription = this.getConfig<string>(
      'description',
      'Transfer call based on pattern matching',
    );
    this.parameterName = this.getConfig<string>('parameter_name', 'transfer_type');
    this.parameterDescription = this.getConfig<string>(
      'parameter_description',
      'The type of transfer to perform',
    );
    this.defaultMessage = this.getConfig<string>(
      'default_message',
      'Please specify a valid transfer type.',
    );
    this.defaultPostProcess = this.getConfig<boolean>('default_post_process', false);
    this.requiredFields =
      this.getConfig<Record<string, string>>('required_fields', {}) ?? {};
    this.allowArbitraryOverride = this.getConfig<boolean | undefined>(
      'allow_arbitrary',
      undefined,
    );

    // Python-style `transfers` config
    const transfers =
      this.getConfig<Record<string, TransferConfig>>('transfers', {}) ?? {};
    this.transfers = {};
    for (const [pattern, rawConfig] of Object.entries(transfers)) {
      if (!rawConfig || typeof rawConfig !== 'object') {
        log.error('swml_transfer: transfer config is not an object', { pattern });
        continue;
      }
      const config = { ...rawConfig };
      if (!('url' in config) && !('address' in config)) {
        log.error(
          'swml_transfer: transfer config must include either url or address',
          { pattern },
        );
        continue;
      }
      if ('url' in config && 'address' in config) {
        log.error(
          'swml_transfer: transfer config cannot have both url and address',
          { pattern },
        );
        continue;
      }
      if (config.message === undefined) config.message = 'Transferring you now...';
      if (config.return_message === undefined)
        config.return_message = 'The transfer is complete. How else can I help you?';
      if (config.post_process === undefined) config.post_process = true;
      if (config.final === undefined) config.final = true;
      this.transfers[pattern] = config;
    }

    // TS-style patterns array
    this.patterns = this.getConfig<TransferPattern[]>('patterns', []) ?? [];

    // Python parity (skills/swml_transfer/skill.py:132-136): setup() returns
    // false when `transfers` is absent. TS additionally supports a `patterns`
    // config shape, so accept either — but not neither, otherwise the skill
    // registers a transfer tool that matches nothing and always falls back.
    if (
      Object.keys(this.transfers).length === 0 &&
      this.patterns.length === 0
    ) {
      log.error(
        'swml_transfer: at least one of "transfers" or "patterns" must be configured',
      );
      return false;
    }
    return true;
  }

  override getHints(): string[] {
    const hints: string[] = [];

    // Extract words from regex patterns (Python-style)
    for (const pattern of Object.keys(this.transfers)) {
      let clean = pattern;
      if (clean.startsWith('/')) clean = clean.slice(1);
      if (clean.endsWith('/')) clean = clean.slice(0, -1);
      else if (clean.endsWith('/i')) clean = clean.slice(0, -2);

      if (clean && !clean.startsWith('.')) {
        if (clean.includes('|')) {
          for (const part of clean.split('|')) {
            hints.push(part.trim().toLowerCase());
          }
        } else {
          hints.push(clean.toLowerCase());
        }
      }
    }

    // Extract friendly names from patterns
    for (const p of this.patterns) {
      if (p && p.name) hints.push(p.name.toLowerCase());
    }

    hints.push('transfer', 'connect', 'speak to', 'talk to');
    return hints;
  }

  /** @returns A `transfer_call` tool, plus `list_transfer_destinations` when patterns are configured. */
  getTools(): SkillToolDefinition[] {
    // Rehydrate config for cases where getTools is called without setup()
    const toolName = this.toolName !== 'transfer_call'
      ? this.toolName
      : this.getConfig<string>('tool_name', 'transfer_call');
    const toolDescription = this.getConfig<string>(
      'description',
      this.toolDescription,
    );
    const parameterName = this.getConfig<string>(
      'parameter_name',
      this.parameterName,
    );
    const parameterDescription = this.getConfig<string>(
      'parameter_description',
      this.parameterDescription,
    );
    const defaultMessage = this.getConfig<string>(
      'default_message',
      this.defaultMessage,
    );
    const defaultPostProcess = this.getConfig<boolean>(
      'default_post_process',
      this.defaultPostProcess,
    );
    const requiredFields =
      this.getConfig<Record<string, string>>('required_fields', this.requiredFields) ?? {};
    const transfers =
      Object.keys(this.transfers).length > 0
        ? this.transfers
        : this.getConfig<Record<string, TransferConfig>>('transfers', {}) ?? {};
    const patterns =
      this.patterns.length > 0
        ? this.patterns
        : this.getConfig<TransferPattern[]>('patterns', []) ?? [];
    const allowArbitrary = this.getConfig<boolean | undefined>(
      'allow_arbitrary',
      this.allowArbitraryOverride,
    );
    const canUseArbitrary =
      allowArbitrary !== undefined
        ? allowArbitrary
        : patterns.length === 0 && Object.keys(transfers).length === 0;

    // Build tool parameters — include required_fields + primary destination param.
    // Python's DataMap does NOT expose a `message` param to the AI
    // (skill.py:227-236). Match that: the pre-transfer message is driven
    // entirely by per-config defaults, not by AI override at call time.
    const parameters: Record<string, unknown> = {
      [parameterName]: {
        type: 'string',
        description: parameterDescription,
      },
    };
    const required = [parameterName];
    for (const [fieldName, fieldDescription] of Object.entries(requiredFields)) {
      parameters[fieldName] = {
        type: 'string',
        description: fieldDescription,
      };
      required.push(fieldName);
    }

    // Pattern map for TS-style destinations (friendly-name lookup)
    const patternMap = new Map<string, TransferPattern>();
    for (const p of patterns) {
      patternMap.set(p.name.toLowerCase(), p);
    }

    // Compile regex entries from Python-style transfers config.
    // Flag semantics match the platform regex engine (skill.py:245-258):
    //   - /pattern/i → case-insensitive
    //   - /pattern/  → case-sensitive (bare closing delimiter)
    //   - pattern    → case-sensitive (no delimiters)
    // Previously TS defaulted to 'i' regardless, silently changing routing
    // semantics for configs ported from Python.
    const compiledTransfers: Array<{ regex: RegExp; raw: string; config: TransferConfig }> = [];
    for (const [patternKey, config] of Object.entries(transfers)) {
      let body = patternKey;
      let flags = '';
      if (body.startsWith('/')) body = body.slice(1);
      if (body.endsWith('/i')) {
        flags = 'i';
        body = body.slice(0, -2);
      } else if (body.endsWith('/')) {
        // bare closing delimiter — Python matches case-sensitively
        body = body.slice(0, -1);
      }
      try {
        compiledTransfers.push({
          regex: new RegExp(body, flags),
          raw: patternKey,
          config,
        });
      } catch (err) {
        log.error('swml_transfer: invalid transfer pattern', {
          pattern: patternKey,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const description = this._buildTransferDescription(
      toolDescription,
      patterns,
      transfers,
      canUseArbitrary,
    );

    const tools: SkillToolDefinition[] = [
      {
        name: toolName,
        description,
        parameters,
        required,
        handler: (args: Record<string, unknown>, _rawData: Record<string, unknown>) => {
          const rawDest = args[parameterName];

          if (typeof rawDest !== 'string' || rawDest.trim().length === 0) {
            return new FunctionResult('Please specify a destination for the transfer.');
          }
          const destination = rawDest.trim();

          // Build call_data for required fields. Python's DataMap template
          // always emits every required_fields key (platform fills missing
          // with empty string). Match that: include the key even when the
          // AI didn't supply it, using the empty string as the fallback.
          const callData: Record<string, unknown> = {};
          for (const fieldName of Object.keys(requiredFields)) {
            callData[fieldName] = fieldName in args ? args[fieldName] : '';
          }

          // 1. Try Python-style transfers (regex match)
          for (const entry of compiledTransfers) {
            if (entry.regex.test(destination)) {
              return this._buildTransferResult(
                entry.config,
                undefined,
                callData,
              );
            }
          }

          // 2. Try TS-style named patterns
          const matchedPattern = patternMap.get(destination.toLowerCase());
          if (matchedPattern) {
            return this._buildPatternResult(
              matchedPattern,
              'Transferring you now...',
              callData,
            );
          }

          // 3. Arbitrary destinations
          if (canUseArbitrary) {
            const msg = 'Transferring you now...';
            const result = new FunctionResult(msg);
            result.swmlTransfer(destination, msg, true);
            if (Object.keys(callData).length > 0) {
              result.updateGlobalData({ call_data: callData });
            }
            return result;
          }

          // 4. No match — return fallback message
          const fallback = new FunctionResult(defaultMessage);
          fallback.postProcess = defaultPostProcess;
          if (Object.keys(callData).length > 0) {
            fallback.updateGlobalData({ call_data: callData });
          }
          return fallback;
        },
      },
    ];

    if (patterns.length > 0) {
      tools.push({
        name: 'list_transfer_destinations',
        description:
          'List all available named transfer destinations that calls can be routed to.',
        parameters: {},
        handler: () => {
          const lines = patterns.map((p) => {
            const desc = p.description ? ` - ${p.description}` : '';
            return `${p.name}${desc}`;
          });
          return new FunctionResult(
            `Available transfer destinations:\n${lines.join('\n')}`,
          );
        },
      });
    }

    return tools;
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    const toolName = this.getConfig<string>('tool_name', this.toolName);
    const parameterName = this.getConfig<string>(
      'parameter_name',
      this.parameterName,
    );
    const transfers =
      Object.keys(this.transfers).length > 0
        ? this.transfers
        : this.getConfig<Record<string, TransferConfig>>('transfers', {}) ?? {};
    const patterns =
      this.patterns.length > 0
        ? this.patterns
        : this.getConfig<TransferPattern[]>('patterns', []) ?? [];
    const requiredFields =
      this.getConfig<Record<string, string>>('required_fields', this.requiredFields) ?? {};
    const allowArbitrary = this.getConfig<boolean | undefined>(
      'allow_arbitrary',
      this.allowArbitraryOverride,
    );
    const canUseArbitrary =
      allowArbitrary !== undefined
        ? allowArbitrary
        : patterns.length === 0 && Object.keys(transfers).length === 0;

    const sections: SkillPromptSection[] = [];

    // Build "Transferring" section with destinations
    const transferBullets: string[] = [];

    for (const [patternKey, config] of Object.entries(transfers)) {
      let clean = patternKey;
      if (clean.startsWith('/')) clean = clean.slice(1);
      if (clean.endsWith('/')) clean = clean.slice(0, -1);
      else if (clean.endsWith('/i')) clean = clean.slice(0, -2);

      if (clean && !clean.startsWith('.')) {
        const destination = config.url ?? config.address ?? '';
        transferBullets.push(`"${clean}" - transfers to ${destination}`);
      }
    }

    for (const p of patterns) {
      const desc = p.description ? ` - ${p.description}` : ` - transfers to ${p.destination}`;
      transferBullets.push(`"${p.name}"${desc}`);
    }

    if (transferBullets.length > 0) {
      sections.push({
        title: 'Transferring',
        body: `You can transfer calls using the ${toolName} function with the following destinations:`,
        bullets: transferBullets,
      });

      const instructionBullets: string[] = [
        `Use the ${toolName} function when a transfer is needed`,
        `Pass the destination type to the '${parameterName}' parameter`,
      ];

      if (Object.keys(requiredFields).length > 0) {
        instructionBullets.push(
          'You must provide the following information before transferring:',
        );
        for (const [fieldName, description] of Object.entries(requiredFields)) {
          instructionBullets.push(`  - ${fieldName}: ${description}`);
        }
        instructionBullets.push(
          "All required information will be saved under 'call_data' for the next agent",
        );
      }

      if (canUseArbitrary) {
        instructionBullets.push(
          'You can also transfer to arbitrary phone numbers or SIP URIs.',
        );
      }

      instructionBullets.push(
        'The system will match patterns and handle the transfer automatically',
        "After transfer completes, you'll regain control of the conversation",
      );

      sections.push({
        title: 'Transfer Instructions',
        body: 'How to use the transfer capability:',
        bullets: instructionBullets,
      });
    }
    // Python skills/swml_transfer/skill.py:297-358 returns [] when there are
    // no transfers — no prompt injection for an unconfigured skill. Previously
    // TS emitted a generic "Call Transfer" section here that Python would
    // suppress, creating AI prompt drift for identical configs.

    return sections;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Build a FunctionResult for a Python-style TransferConfig. */
  private _buildTransferResult(
    config: TransferConfig,
    messageOverride: string | undefined,
    callData: Record<string, unknown>,
  ): FunctionResult {
    const message = messageOverride ?? config.message ?? 'Transferring you now...';
    const returnMessage =
      config.return_message ?? 'The transfer is complete. How else can I help you?';
    const postProcess = config.post_process ?? true;
    const final = config.final ?? true;

    const result = new FunctionResult(message, postProcess);
    if (Object.keys(callData).length > 0) {
      result.updateGlobalData({ call_data: callData });
    }

    if (config.url) {
      result.swmlTransfer(config.url, returnMessage, final);
    } else if (config.address) {
      result.connect(config.address, final, config.from_addr);
    }
    return result;
  }

  /** Build a FunctionResult for a TS-style named TransferPattern. */
  private _buildPatternResult(
    pattern: TransferPattern,
    message: string,
    callData: Record<string, unknown>,
  ): FunctionResult {
    const returnMessage =
      pattern.returnMessage ?? 'The transfer is complete. How else can I help you?';
    const postProcess = pattern.postProcess ?? true;
    const final = pattern.final ?? true;

    const result = new FunctionResult(message, postProcess);
    if (Object.keys(callData).length > 0) {
      result.updateGlobalData({ call_data: callData });
    }

    // If destination looks like a URL, use swmlTransfer; otherwise use connect
    if (/^https?:\/\//i.test(pattern.destination)) {
      result.swmlTransfer(pattern.destination, returnMessage, final);
    } else {
      result.connect(pattern.destination, final, pattern.fromAddr);
    }
    return result;
  }

  private _buildTransferDescription(
    baseDescription: string,
    patterns: TransferPattern[],
    transfers: Record<string, TransferConfig>,
    canUseArbitrary: boolean,
  ): string {
    const names = [
      ...Object.keys(transfers).map((k) => `"${k}"`),
      ...patterns.map((p) => `"${p.name}"`),
    ];
    if (names.length === 0) {
      return baseDescription;
    }
    const base = `${baseDescription}. Named destinations: ${names.join(', ')}.`;
    return canUseArbitrary
      ? `${base} You may also use arbitrary phone numbers or SIP URIs.`
      : base;
  }
}

/**
 * Factory function for creating SwmlTransferSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new SwmlTransferSkill instance.
 */
export function createSkill(config?: SkillConfig): SwmlTransferSkill {
  return new SwmlTransferSkill(config);
}
