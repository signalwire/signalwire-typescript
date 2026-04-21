/**
 * SkillRegistry - Global singleton registry for discovering and loading skills.
 *
 * Matches Python's `skills/registry.py:SkillRegistry`: the registry stores
 * **class references** keyed by each class's static `SKILL_NAME`, and reads
 * metadata (description, version, required packages/env vars,
 * multi-instance support) by direct static-attribute access.
 *
 * Registration via `register(SkillClass)` validates that the class defines
 * `SKILL_NAME`, that `getParameterSchema()` is callable and returns a
 * non-empty object (Python `register_skill` at `registry.py:132-194`).
 *
 * Supports the `SIGNALWIRE_SKILL_PATHS` environment variable for custom
 * skill directories, matching Python's discovery search path.
 */

import { SkillBase, type SkillConfig, type ParameterSchemaEntry } from './SkillBase.js';
import { getLogger } from '../Logger.js';

const log = getLogger('SkillRegistry');

/**
 * Metadata exposed for a registered skill. Shape matches Python's
 * `SkillRegistry.list_skills()` / `get_all_skills_schema()` return values
 * (`skills/registry.py:205-227`, `229-296`).
 */
export interface SkillSchemaInfo {
  /** The skill's registered name (from `SkillBase.SKILL_NAME`). */
  name: string;
  /** Human-readable description (from `SkillBase.SKILL_DESCRIPTION`). */
  description: string;
  /** Semantic version string (from `SkillBase.SKILL_VERSION`). */
  version: string;
  /** Whether this skill supports multiple simultaneous instances. */
  supportsMultipleInstances: boolean;
  /** Environment variables required by the skill. */
  requiredEnvVars: string[];
  /** NPM packages required by the skill. */
  requiredPackages: string[];
  /** Full parameter schema with types, defaults, and constraints. */
  parameters: Record<string, ParameterSchemaEntry>;
  /** Optional source category for grouping (e.g., "builtin", "external"). */
  source?: string;
}

let _instance: SkillRegistry | null = null;

/**
 * Global singleton registry for registering and instantiating skills.
 *
 * Skills can be registered programmatically via `register(SkillClass)`.
 * Matches Python's `skill_registry` global (`skills/registry.py:481`).
 */
export class SkillRegistry {
  /**
   * Map from `SKILL_NAME` to class reference. Matches Python's
   * `self._skills: Dict[str, Type[SkillBase]]` (`registry.py:26`).
   */
  private registry: Map<string, typeof SkillBase> = new Map();
  private lockedNames: Set<string> = new Set();
  private searchPaths: string[];

  constructor() {
    const envPaths = process.env['SIGNALWIRE_SKILL_PATHS'];
    this.searchPaths = envPaths ? envPaths.split(':').filter(Boolean) : [];
  }

  /**
   * Get the global singleton instance, creating it on first access.
   * @returns The shared SkillRegistry instance.
   */
  static getInstance(): SkillRegistry {
    if (!_instance) {
      _instance = new SkillRegistry();
    }
    return _instance;
  }

  /**
   * Reset the global singleton (for testing).
   */
  static resetInstance(): void {
    _instance = null;
  }

  /**
   * Register a skill class. The skill name is read from the class's static
   * `SKILL_NAME`. Mirrors Python's `register_skill(skill_class)`
   * (`skills/registry.py:132-194`) — including the schema-non-empty check
   * and the protection against overwriting locked skills.
   *
   * @param SkillClass - A concrete subclass of `SkillBase` with a
   *   non-empty `SKILL_NAME`.
   */
  register(SkillClass: typeof SkillBase): void {
    const name = SkillClass.SKILL_NAME;
    if (!name) {
      throw new Error(
        `${SkillClass.name} must define static SKILL_NAME before registration ` +
          `(Python equivalent: registry.py:150 SKILL_NAME validation).`,
      );
    }
    if (this.lockedNames.has(name)) {
      log.warn(`Cannot overwrite locked skill: ${name}`);
      return;
    }
    // Schema non-emptiness check — Python registry.py:163-166.
    try {
      const schema = SkillClass.getParameterSchema();
      if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) {
        throw new Error(
          `${SkillClass.name}.getParameterSchema() must return a non-empty object`,
        );
      }
    } catch (err) {
      throw new Error(
        `${SkillClass.name}.getParameterSchema() failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (this.registry.has(name)) {
      log.warn(`Overwriting skill registration: ${name}`);
    }
    this.registry.set(name, SkillClass);
    log.debug(`Registered skill: ${name}`);
  }

  /**
   * Lock one or more skill names to prevent overwriting.
   * If called with no arguments, locks all currently registered skills.
   * @param names - Skill names to lock; if omitted, all current names are locked.
   */
  lock(names?: string[]): void {
    const toLock = names ?? Array.from(this.registry.keys());
    for (const name of toLock) {
      this.lockedNames.add(name);
    }
  }

  /**
   * Unregister a skill by name, removing it from the registry.
   * @param name - The skill name to unregister.
   * @returns True if the skill was found and removed.
   */
  unregister(name: string): boolean {
    return this.registry.delete(name);
  }

  /**
   * Create a new skill instance by looking up its class in the registry.
   * Matches Python's `skill_manager.load_skill(name)` class-lookup + instantiate
   * flow (`skill_manager.py:97`: `skill_instance = skill_class(self.agent, params)`).
   *
   * @param name - The registered skill name.
   * @param config - Optional configuration to pass to the skill constructor.
   * @returns A new skill instance, or null if the name is not registered.
   */
  create(name: string, config?: SkillConfig): SkillBase | null {
    const SkillClass = this.registry.get(name);
    if (!SkillClass) {
      log.warn(`Skill not found in registry: ${name}`);
      return null;
    }
    // typeof SkillBase is abstract at the type level; concrete subclasses
    // are what's actually stored. Cast through unknown to allow `new`.
    const Ctor = SkillClass as unknown as new (config?: SkillConfig) => SkillBase;
    return new Ctor(config);
  }

  /**
   * Get the registered skill class by name. Matches Python's
   * `get_skill_class(skill_name)` (`registry.py:196-203`).
   * @param name - The registered skill name.
   * @returns The skill class reference, or undefined if not registered.
   */
  getSkillClass(name: string): typeof SkillBase | undefined {
    return this.registry.get(name);
  }

  /**
   * Check if a skill name is registered.
   * @param name - The skill name to check.
   * @returns True if the skill is registered.
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * List all registered skill names.
   * @returns Array of registered skill name strings.
   */
  listRegistered(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * List all registered skills with their full metadata. Matches Python's
   * `list_skills()` shape (`registry.py:205-227`) plus TS-idiomatic
   * camelCase keys.
   * @returns Array of skill metadata objects.
   */
  listSkills(): SkillSchemaInfo[] {
    return Array.from(this.registry.values()).map((SkillClass) => ({
      name: SkillClass.SKILL_NAME,
      description: SkillClass.SKILL_DESCRIPTION,
      version: SkillClass.SKILL_VERSION,
      supportsMultipleInstances: SkillClass.SUPPORTS_MULTIPLE_INSTANCES,
      requiredEnvVars: [...SkillClass.REQUIRED_ENV_VARS],
      requiredPackages: [...SkillClass.REQUIRED_PACKAGES],
      parameters: SkillClass.getParameterSchema(),
    }));
  }

  /**
   * Add a directory path to search during skill discovery.
   * @param path - Absolute path to a directory containing skill files.
   */
  addSearchPath(path: string): void {
    if (!this.searchPaths.includes(path)) {
      this.searchPaths.push(path);
    }
  }

  /**
   * Get all configured search paths for skill discovery.
   * @returns Copy of the search paths array.
   */
  getSearchPaths(): string[] {
    return [...this.searchPaths];
  }

  /**
   * Discover and register skills from a directory by importing each file.
   * Looks for SkillBase subclass exports and registers them.
   * @param dirPath - Absolute path to the directory to scan.
   * @returns Array of newly discovered skill names.
   */
  async discoverFromDirectory(dirPath: string): Promise<string[]> {
    if (process.env['SWML_SKILL_DISCOVERY_ENABLED'] !== 'true') {
      log.warn('Skill directory discovery is disabled. Set SWML_SKILL_DISCOVERY_ENABLED=true to enable.');
      return [];
    }
    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { pathToFileURL } = await import('node:url');

    const discovered: string[] = [];
    let entries: string[];

    try {
      const dirEntries = await readdir(dirPath, { withFileTypes: true });
      entries = dirEntries
        .filter(e => (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) || e.isDirectory())
        .map(e => e.name);
    } catch {
      log.warn(`Cannot read skill directory: ${dirPath}`);
      return discovered;
    }

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      try {
        const fileUrl = pathToFileURL(
          entry.endsWith('.ts') || entry.endsWith('.js') ? fullPath : join(fullPath, 'skill.ts'),
        ).href;
        const mod: Record<string, unknown> = await import(fileUrl);

        // Find any SkillBase subclass exported from the module. Matches
        // Python `registry.py:104-113` which inspects loaded modules for
        // `issubclass(obj, SkillBase)`.
        for (const value of Object.values(mod)) {
          if (
            typeof value === 'function' &&
            (value as { prototype?: unknown }).prototype instanceof SkillBase &&
            (value as typeof SkillBase).SKILL_NAME
          ) {
            const SkillClass = value as typeof SkillBase;
            this.register(SkillClass);
            discovered.push(SkillClass.SKILL_NAME);
          }
        }
      } catch (err) {
        log.debug(`Could not load skill from ${fullPath}: ${err}`);
      }
    }

    return discovered;
  }

  /**
   * Discover and register skills from all configured search paths.
   * @returns Array of all newly discovered skill names.
   */
  async discoverAll(): Promise<string[]> {
    const all: string[] = [];
    for (const path of this.searchPaths) {
      const found = await this.discoverFromDirectory(path);
      all.push(...found);
    }
    return all;
  }

  /**
   * Get the combined schema info for a registered skill.
   * Matches Python `get_all_skills_schema` per-skill shape
   * (`registry.py:287-295`).
   * @param name - The registered skill name to query.
   * @returns The skill's schema info, or undefined if not found.
   */
  getSkillSchema(name: string): SkillSchemaInfo | undefined {
    const SkillClass = this.registry.get(name);
    if (!SkillClass) return undefined;
    return {
      name: SkillClass.SKILL_NAME,
      description: SkillClass.SKILL_DESCRIPTION,
      version: SkillClass.SKILL_VERSION,
      supportsMultipleInstances: SkillClass.SUPPORTS_MULTIPLE_INSTANCES,
      requiredEnvVars: [...SkillClass.REQUIRED_ENV_VARS],
      requiredPackages: [...SkillClass.REQUIRED_PACKAGES],
      parameters: SkillClass.getParameterSchema(),
    };
  }

  /**
   * Get combined schema info for all registered skills.
   * @returns Record mapping skill names to their schema info.
   */
  getAllSkillsSchema(): Record<string, SkillSchemaInfo> {
    const result: Record<string, SkillSchemaInfo> = {};
    for (const name of this.registry.keys()) {
      const schema = this.getSkillSchema(name);
      if (schema) result[name] = schema;
    }
    return result;
  }

  /**
   * Group registered skill names by source category. Matches Python's
   * `list_all_skill_sources` (`skills/registry.py:436-478`).
   *
   * Current TS implementation treats every registered skill as "registered"
   * (the only category that fits — filesystem-based discovery is optional
   * and entry-points don't apply to Node the way they do to Python).
   *
   * @returns Record mapping source categories to arrays of skill names.
   */
  listAllSkillSources(): Record<string, string[]> {
    return {
      registered: Array.from(this.registry.keys()),
    };
  }

  /**
   * Get the number of registered skills.
   * @returns The count of registered skills.
   */
  get size(): number {
    return this.registry.size;
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.registry.clear();
  }
}
