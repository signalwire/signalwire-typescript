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
import { getLogger, type Logger } from '../Logger.js';

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

/**
 * Abstract base class for agent skills.
 *
 * Skills are modular capabilities that can be added to an agent.
 * They define tools, prompt sections, hints, and global data.
 */
export abstract class SkillBase {
  /**
   * Unique skill name. Subclasses MUST override with a non-empty string.
   *
   * Python parity: `SKILL_NAME: str = None` at `core/skill_base.py:23`.
   * Python raises `ValueError` in `__init__` when this is left as `None`;
   * TS throws at construction when this is left as the empty default.
   */
  static SKILL_NAME: string = '';

  /**
   * Human-readable description of the skill. Subclasses MUST override.
   *
   * Python parity: `SKILL_DESCRIPTION: str = None` at `core/skill_base.py:24`.
   */
  static SKILL_DESCRIPTION: string = '';

  /**
   * Semantic version string. Subclasses may override; defaults to `"1.0.0"`.
   *
   * Python parity: `SKILL_VERSION: str = "1.0.0"` at `core/skill_base.py:25`.
   */
  static SKILL_VERSION: string = '1.0.0';

  /**
   * Packages required by the skill, checked at load time by `validatePackages()`.
   *
   * Python parity: `REQUIRED_PACKAGES: List[str] = []` at `core/skill_base.py:26`.
   * In TS these are npm package names importable via dynamic `import()`.
   */
  static REQUIRED_PACKAGES: readonly string[] = [];

  /**
   * Environment variables required for the skill to function, checked at load
   * time by `validateEnvVars()`.
   *
   * Python parity: `REQUIRED_ENV_VARS: List[str] = []` at `core/skill_base.py:27`.
   */
  static REQUIRED_ENV_VARS: readonly string[] = [];

  /**
   * Whether this skill type supports multiple simultaneous instances (e.g., with different tool_name).
   *
   * Python parity: `SUPPORTS_MULTIPLE_INSTANCES: bool = False` at `core/skill_base.py:30`.
   */
  static SUPPORTS_MULTIPLE_INSTANCES = false;

  /**
   * Get the parameter schema for this skill class, describing all accepted configuration options.
   * Subclasses should override and call `super.getParameterSchema()` to include base parameters.
   *
   * Mirrors Python's `SkillBase.get_parameter_schema()` (skill_base.py:197-266):
   * returns `swaig_fields` + `skip_prompt` for all skills, and additionally adds a
   * `tool_name` entry with `default: cls.SKILL_NAME` for classes with
   * `SUPPORTS_MULTIPLE_INSTANCES = true`.
   *
   * @returns Record mapping parameter names to their schema entries.
   */
  static getParameterSchema(): Record<string, ParameterSchemaEntry> {
    const schema: Record<string, ParameterSchemaEntry> = {
      swaig_fields: {
        type: 'object',
        description: 'Additional SWAIG fields to merge into each tool definition provided by this skill.',
        default: {},
        required: false,
      },
      skip_prompt: {
        type: 'boolean',
        description: 'When true, suppress all prompt sections from this skill.',
        default: false,
        required: false,
      },
    };
    if (this.SUPPORTS_MULTIPLE_INSTANCES) {
      schema['tool_name'] = {
        type: 'string',
        description: 'Custom name for this skill instance (for multiple instances).',
        // Python `core/skill_base.py:261`: `default: cls.SKILL_NAME`.
        default: this.SKILL_NAME || undefined,
        required: false,
      };
    }
    return schema;
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
  /**
   * Logger scoped to this skill. Python equivalent: `self.logger = get_logger(...)`
   * set in `SkillBase.__init__` so every subclass can call `self.logger.info(...)`.
   */
  protected readonly logger: Logger;
  private _initialized = false;

  /**
   * Tools registered imperatively via `defineTool()`.
   *
   * Python parity: Python's `SkillBase.register_tools()` is a `@abstractmethod` that
   * calls `self.agent.define_tool(...)` (or `self.define_tool(...)`) once per tool.
   * In TypeScript the tool pipeline is declarative (pull model): `SkillManager`
   * calls `getTools()` at SWML render time. Skills that want to build their tool
   * list imperatively (e.g. to branch on config at setup time) can push into this
   * collection via `defineTool()`; the default `getTools()` returns it.
   */
  protected _dynamicTools: SkillToolDefinition[] = [];

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
   *
   * Python parity: `core/skill_base.py:32-43`.
   * Python `__init__` raises `ValueError` if `SKILL_NAME` or `SKILL_DESCRIPTION`
   * is left as `None` on the subclass. TS throws the equivalent when the static
   * defaults haven't been overridden.
   *
   * @param config - Optional configuration key-value pairs (Python: `params`).
   */
  constructor(config?: SkillConfig) {
    const klass = this.constructor as typeof SkillBase;
    if (!klass.SKILL_NAME) {
      throw new Error(
        `${klass.name} must define static SKILL_NAME ` +
          `(Python equivalent: core/skill_base.py:23,33-34).`,
      );
    }
    if (!klass.SKILL_DESCRIPTION) {
      throw new Error(
        `${klass.name} must define static SKILL_DESCRIPTION ` +
          `(Python equivalent: core/skill_base.py:24,35-36).`,
      );
    }

    this.skillName = klass.SKILL_NAME;
    this.config = { ...(config ?? {}) };
    this.instanceId = `${klass.SKILL_NAME}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
    this.logger = getLogger(`signalwire.skills.${klass.SKILL_NAME}`);

    // Extract swaig_fields from config (matches Python's self.swaig_fields = self.params.pop('swaig_fields', {}))
    this.swaigFields = (this.config['swaig_fields'] as Record<string, unknown>) ?? {};
    delete this.config['swaig_fields'];
  }

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
   *
   * Default implementation returns tools registered imperatively via
   * `defineTool()`. Skills using the declarative pattern override this
   * method to return a static array built from their config.
   *
   * Python parity: replaces the `@abstractmethod register_tools()` contract
   * — Python skills call `self.define_tool(...)` inside `register_tools()`;
   * TypeScript skills either call `this.defineTool(...)` in `setup()` (and
   * let the default `getTools()` return them) or override `getTools()`
   * directly.
   *
   * @returns Array of tool definitions to register with the agent.
   */
  getTools(): SkillToolDefinition[] {
    return [...this._dynamicTools];
  }

  /**
   * Imperatively register a tool with this skill.
   *
   * Python parity: `core/skill_base.py:58` `def define_tool(self, **kwargs)`.
   * Merges `this.swaigFields` into the tool definition (explicit fields on
   * `toolDef` take precedence), then pushes the result into `_dynamicTools`
   * so the default `getTools()` returns it at SWML render time.
   *
   * Intended for skills whose tool shape depends on config evaluated at
   * `setup()` time. Skills with a static tool list should override
   * `getTools()` instead.
   *
   * @param toolDef - The tool definition to register. Must include at
   *   minimum `name`, `description`, `parameters`, and `handler`.
   */
  protected defineTool(toolDef: SkillToolDefinition): void {
    const swaigDefaults = this.swaigFields as Partial<SkillToolDefinition>;
    const merged: SkillToolDefinition = {
      ...swaigDefaults,
      ...toolDef,
    };
    this._dynamicTools.push(merged);
  }

  /**
   * Optional DataMap-style tool definitions. Skills that build their own
   * SWAIG function dicts (e.g. via `DataMap.toSwaigFunction()`) return them
   * here and `AgentBase.addSkill()` registers each via `registerSwaigFunction`.
   *
   * Python equivalent: the direct `self.agent.register_swaig_function(fn)`
   * call inside `register_tools()` (e.g. `skills/datasphere_serverless/skill.py:210`).
   * Default returns `[]` — skills using only the declarative `getTools()` path
   * do not need to override this.
   *
   * @returns Array of fully-built SWAIG function dicts.
   */
  getDataMapTools(): Record<string, unknown>[] {
    return [];
  }

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
   *
   * For single-instance skills (`SUPPORTS_MULTIPLE_INSTANCES = false`), returns
   * the skill name. For multi-instance skills, returns `${skillName}_${toolName}`
   * using the `tool_name` config (falls back to the skill name).
   *
   * Matches Python's `SkillBase.get_instance_key()` default (`skill_base.py:141-146`).
   * Multi-instance subclasses only need to override when their key derivation
   * depends on config beyond `tool_name`.
   *
   * @returns A unique key identifying this skill instance.
   */
  getInstanceKey(): string {
    const SkillClass = this.constructor as typeof SkillBase;
    if (!SkillClass.SUPPORTS_MULTIPLE_INSTANCES) {
      return this.skillName;
    }
    const toolName = (this.config['tool_name'] as string | undefined) ?? this.skillName;
    return `${this.skillName}_${toolName}`;
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
   * Validate that all required environment variables declared on the skill class
   * are set in the current process environment.
   *
   * Python parity: `core/skill_base.py:103-110` reads `self.REQUIRED_ENV_VARS`
   * directly. TS reads the same static from the class.
   *
   * Returns the list of missing variable names so callers can produce actionable
   * error messages. This differs from Python's `validate_env_vars() -> bool`
   * return shape; {@link hasAllEnvVars} is the boolean equivalent.
   *
   * @returns Array of missing environment variable names (empty if all are present).
   */
  validateEnvVars(): string[] {
    const klass = this.constructor as typeof SkillBase;
    const missing: string[] = [];
    for (const envVar of klass.REQUIRED_ENV_VARS) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }
    // Python parity: core/skill_base.py:107-109 logs an error line when any
    // required env vars are missing. Mirror that here so both SDKs produce
    // the same diagnostic signal during skill setup.
    if (missing.length > 0) {
      this.logger.error(`Missing required environment variables: ${missing.join(', ')}`);
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
   * Validate that all required packages declared on the skill class can be imported.
   *
   * Python parity: `core/skill_base.py:112-124` reads `self.REQUIRED_PACKAGES`
   * directly and tries `importlib.import_module(pkg)` for each; TS does the
   * equivalent with a dynamic `import()`.
   *
   * @returns Array of package names that could not be imported (empty if all present).
   */
  async validatePackages(): Promise<string[]> {
    const klass = this.constructor as typeof SkillBase;
    const missing: string[] = [];
    for (const pkg of klass.REQUIRED_PACKAGES) {
      try {
        await import(pkg);
      } catch {
        missing.push(pkg);
      }
    }
    if (missing.length > 0) {
      this.logger.error(`Missing required packages: ${missing.join(', ')}`);
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
