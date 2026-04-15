/**
 * SkillBase - Abstract base class for agent skills.
 *
 * Skills are modular capabilities that can be added to an agent.
 * They define tools, prompt sections, hints, and global data.
 */

import { randomBytes } from 'node:crypto';
import type { SwaigHandler } from '../SwaigFunction.js';
import type { FunctionResult } from '../FunctionResult.js';
import type { AgentBase } from '../AgentBase.js';
import { getLogger } from '../Logger.js';

/** Configuration key-value pairs passed to a skill at construction time. */
export interface SkillConfig {
  [key: string]: unknown;
}

/** Definition of a SWAIG tool provided by a skill. */
export interface SkillToolDefinition {
  /** Unique tool name used in SWAIG function registration. */
  name: string;
  /** Human-readable description of what the tool does, shown to the AI. */
  description: string;
  /** Parameter schema for the tool, keyed by parameter name. */
  parameters?: Record<string, unknown>;
  /** Handler function invoked when the tool is called. */
  handler: SwaigHandler;
  /** Whether the tool requires secure (authenticated) invocation. */
  secure?: boolean;
  /** Filler phrases spoken while the tool executes, keyed by language. */
  fillers?: Record<string, string[]>;
  /** List of parameter names that are required. */
  required?: string[];
  /**
   * When true, the SignalWire platform automatically invokes this tool when
   * the call ends (hangup), regardless of whether the AI explicitly calls it.
   * Equivalent to Python's `is_hangup_hook=True` in `define_tool()`.
   * The flag is serialised as `"is_hangup_hook": true` in the SWAIG JSON.
   */
  isHangupHook?: boolean;
}

/** A section of prompt content injected into the agent's system prompt by a skill. */
export interface SkillPromptSection {
  /** Section heading displayed in the prompt. */
  title: string;
  /** Optional body text for the section. */
  body?: string;
  /** Optional bullet points appended after the body. */
  bullets?: string[];
  /** If true, render bullets as a numbered list instead of unordered. */
  numbered?: boolean;
}

/** Schema entry describing a single skill configuration parameter. */
export interface ParameterSchemaEntry {
  /** JSON Schema type of the parameter value. */
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  /** Human-readable description of the parameter. */
  description: string;
  /** Default value used when the parameter is not provided. */
  default?: unknown;
  /** Whether the parameter must be supplied. */
  required?: boolean;
  /** Whether the parameter should be hidden from user-facing output (e.g., API keys). */
  hidden?: boolean;
  /** Environment variable that can supply this parameter's value. */
  env_var?: string;
  /** Allowed values for the parameter. */
  enum?: unknown[];
  /** Minimum value (for numeric types). */
  min?: number;
  /** Maximum value (for numeric types). */
  max?: number;
  /** Item schema for array-type parameters. */
  items?: Record<string, unknown>;
}

/** Metadata describing a skill's identity, requirements, and configuration schema. */
export interface SkillManifest {
  /** Unique skill name used for registration and lookup. */
  name: string;
  /** Human-readable description of the skill's purpose. */
  description: string;
  /** Semantic version string (e.g., "1.0.0"). */
  version: string;
  /** Author or organization that created the skill. */
  author?: string;
  /** Tags for categorization and discovery. */
  tags?: string[];
  /** Environment variables that must be set for the skill to function. */
  requiredEnvVars?: string[];
  /** NPM packages or external dependencies required by the skill. */
  requiredPackages?: string[];
  /** JSON-schema-like description of the skill's configuration options. */
  configSchema?: Record<string, unknown>;
}

/**
 * Abstract base class for agent skills.
 *
 * Skills are modular capabilities that can be added to an agent.
 * They define tools, prompt sections, hints, and global data.
 */
export abstract class SkillBase {
  /** Whether this skill type supports multiple simultaneous instances (e.g., with different tool_name). */
  static SUPPORTS_MULTIPLE_INSTANCES = false;

  /**
   * Get the parameter schema for this skill class, describing all accepted configuration options.
   * Subclasses should override and call `super.getParameterSchema()` to include base parameters.
   * @returns Record mapping parameter names to their schema entries.
   */
  static getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      swaig_fields: {
        type: 'object',
        description: 'Additional SWAIG fields to merge into each tool definition provided by this skill.',
      },
      skip_prompt: {
        type: 'boolean',
        description: 'When true, suppress all prompt sections from this skill.',
        default: false,
      },
    };
  }

  /** The registered name of this skill type. */
  readonly skillName: string;
  /** Unique identifier for this skill instance (includes timestamp and random bytes). */
  readonly instanceId: string;
  /** Configuration options provided at construction time. */
  protected config: SkillConfig;
  /** Additional SWAIG fields extracted from config, merged into tool definitions. */
  readonly swaigFields: Record<string, unknown>;
  /**
   * Reference to the agent that owns this skill.
   * Set via `setAgent()` when the skill is added to an agent.
   * Python equivalent: `self.agent` (set in `__init__`).
   *
   * In the Python SDK `agent` is always non-null because it is injected in the
   * constructor.  In the TypeScript SDK the SkillManager always calls
   * `setAgent()` before `setup()`, so subclasses can rely on `getAgent()` being
   * safe to call inside `setup()` and any method invoked after it.
   */
  protected agent?: AgentBase;
  private _initialized = false;

  /**
   * Return the agent that owns this skill, asserting it is non-null.
   * Equivalent to accessing `self.agent` in Python, where the agent reference
   * is always set before `setup()` is called.
   *
   * The SkillManager lifecycle guarantees that `setAgent()` is called before
   * `setup()`, so this method is safe to use inside `setup()` and in any
   * tool handler invoked during an active agent session.
   *
   * @returns The owning `AgentBase` instance.
   * @throws {Error} If called before `setAgent()` (i.e., before the skill is
   *   attached to an agent by the SkillManager).
   */
  protected getAgent(): AgentBase {
    if (!this.agent) {
      throw new Error(
        `SkillBase.getAgent() called before setAgent() on skill "${this.skillName}". ` +
          'Ensure getAgent() is only called from setup() or tool handlers, ' +
          'where the SkillManager has already attached the agent.',
      );
    }
    return this.agent;
  }

  /**
   * Create a new skill instance.
   * @param skillName - The registered name for this skill type.
   * @param config - Optional configuration key-value pairs.
   */
  constructor(skillName: string, config?: SkillConfig) {
    this.skillName = skillName;
    this.config = { ...(config ?? {}) };
    this.instanceId = `${skillName}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;

    // Extract swaig_fields from config (matches Python's self.swaig_fields = self.params.pop('swaig_fields', {}))
    this.swaigFields = (this.config['swaig_fields'] as Record<string, unknown>) ?? {};
    delete this.config['swaig_fields'];
  }

  /**
   * Get the skill manifest containing metadata, requirements, and config schema.
   * @returns The skill's manifest object.
   */
  abstract getManifest(): SkillManifest;

  /**
   * Setup the skill. Called when the skill is added to an agent.
   * Override to perform initialization (API connections, config validation, etc.)
   * @returns `true` if setup succeeded, `false` otherwise.
   *          Python equivalent: abstract `setup() -> bool`.
   */
  async setup(): Promise<boolean> {
    return true;
  }

  /**
   * Return the SWAIG tool definitions this skill provides.
   * @returns Array of tool definitions to register with the agent.
   */
  abstract getTools(): SkillToolDefinition[];

  /**
   * Get prompt sections to inject into the agent's system prompt.
   * Respects the `skip_prompt` config option — returns `[]` if set to `true`.
   * Subclasses should override `_getPromptSections()` instead of this method.
   * @returns Array of prompt sections with titles, bodies, and bullets.
   */
  getPromptSections(): SkillPromptSection[] {
    if (this.config['skip_prompt'] === true) {
      return [];
    }
    return this._getPromptSections();
  }

  /**
   * Internal method returning this skill's prompt sections.
   * Override this in subclasses instead of `getPromptSections()`.
   * @returns Array of prompt sections with titles, bodies, and bullets.
   */
  protected _getPromptSections(): SkillPromptSection[] {
    return [];
  }

  /**
   * Get speech recognition hints relevant to this skill.
   * @returns Array of hint strings to improve speech recognition accuracy.
   */
  getHints(): string[] {
    return [];
  }

  /**
   * Get global data to merge into the agent's global data store.
   * @returns Key-value pairs to be merged into the agent's global data.
   */
  getGlobalData(): Record<string, unknown> {
    return {};
  }

  /**
   * Get the instance key used for deduplication in the SkillManager.
   * Default returns the skill name. Multi-instance skills should override
   * to include a distinguishing suffix (e.g., tool_name).
   * @returns A unique key identifying this skill instance.
   */
  getInstanceKey(): string {
    return this.skillName;
  }

  /**
   * Get the namespaced key for storing per-skill data in global_data.
   * @returns A string like "skill:datetime" or "skill:my_prefix".
   */
  getSkillNamespace(): string {
    const prefix = this.config['prefix'] as string | undefined;
    return `skill:${prefix ?? this.getInstanceKey()}`;
  }

  /**
   * Read this skill's data from a raw call data object's global_data.
   * @param rawData - The raw request data containing global_data.
   * @returns The skill's stored data, or an empty object if not found.
   */
  getSkillData(rawData: Record<string, unknown>): Record<string, unknown> {
    const globalData = rawData['global_data'] as Record<string, unknown> | undefined;
    if (!globalData) return {};
    return (globalData[this.getSkillNamespace()] as Record<string, unknown>) ?? {};
  }

  /**
   * Update this skill's namespaced data on a FunctionResult via updateGlobalData.
   * @param result - The FunctionResult to update.
   * @param data - The data to store under this skill's namespace.
   * @returns The FunctionResult for chaining.
   */
  updateSkillData(result: FunctionResult, data: Record<string, unknown>): FunctionResult {
    return result.updateGlobalData({ [this.getSkillNamespace()]: data });
  }

  /**
   * Cleanup resources. Called when the skill is removed from an agent.
   */
  async cleanup(): Promise<void> {
    // Default no-op
  }

  /**
   * Validate that all required environment variables declared in the manifest are set.
   *
   * Returns the list of missing variable names so callers can produce actionable
   * error messages.  This differs from the Python SDK's `validate_env_vars() -> bool`,
   * which only returns a boolean.  If you need boolean semantics (e.g. `if skill.hasAllEnvVars()`),
   * use {@link hasAllEnvVars} instead — it is the direct boolean equivalent.
   *
   * @returns Array of missing environment variable names (empty if all are present).
   */
  validateEnvVars(): string[] {
    const manifest = this.getManifest();
    const missing: string[] = [];
    if (manifest.requiredEnvVars) {
      for (const envVar of manifest.requiredEnvVars) {
        if (!process.env[envVar]) {
          missing.push(envVar);
        }
      }
    }
    return missing;
  }

  /**
   * Check if the skill has been initialized by the SkillManager.
   * @returns True if setup() has completed and the skill is marked initialized.
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Mark the skill as initialized (called by SkillManager).
   */
  markInitialized(): void {
    this._initialized = true;
  }

  /**
   * Get a configuration value by key, falling back to a default if not set.
   * @param key - The configuration key to look up.
   * @param defaultValue - Value to return if the key is not present.
   * @returns The configuration value cast to type T, or the default value.
   */
  getConfig<T = unknown>(key: string, defaultValue?: T): T {
    return (this.config[key] !== undefined ? this.config[key] : defaultValue) as T;
  }

  /**
   * Set the agent reference for this skill.
   * Called by the SkillManager/AgentBase when the skill is attached to an agent.
   * Python equivalent: `self.agent = agent` in `__init__`.
   * @param agent - The agent that owns this skill.
   */
  setAgent(agent: AgentBase): void {
    this.agent = agent;
  }

  /**
   * Check if all required environment variables are present.
   * Convenience wrapper around `validateEnvVars()` that returns a boolean,
   * matching the Python `validate_env_vars() -> bool` return type.
   * @returns `true` if all required env vars are set, `false` otherwise.
   */
  hasAllEnvVars(): boolean {
    return this.validateEnvVars().length === 0;
  }

  /**
   * Validate that all required packages declared in the manifest are available.
   * Attempts a dynamic `import()` for each package in `manifest.requiredPackages`.
   * Python equivalent: `validate_packages() -> bool` using `importlib.import_module`.
   * @returns Array of package names that could not be imported (empty if all present).
   */
  async validatePackages(): Promise<string[]> {
    const manifest = this.getManifest();
    const missing: string[] = [];
    if (manifest.requiredPackages) {
      const log = getLogger(`signalwire.skills.${this.skillName}`);
      for (const pkg of manifest.requiredPackages) {
        try {
          await import(pkg);
        } catch {
          missing.push(pkg);
        }
      }
      if (missing.length > 0) {
        log.error(`Missing required packages: ${missing.join(', ')}`);
      }
    }
    return missing;
  }

  /**
   * Check if all required packages declared in the manifest are available.
   * Convenience wrapper around `validatePackages()` that returns a boolean,
   * matching the Python `validate_packages() -> bool` return type.
   * @returns `true` if all required packages are importable, `false` otherwise.
   */
  async hasAllPackages(): Promise<boolean> {
    return (await this.validatePackages()).length === 0;
  }
}
