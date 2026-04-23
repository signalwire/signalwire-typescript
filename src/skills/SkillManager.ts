/**
 * SkillManager - Manages skill lifecycle for an agent.
 *
 * Handles loading, unloading, validation, and injection of
 * skill tools, hints, global data, and prompt sections.
 */

import { SkillBase, type SkillConfig } from './SkillBase.js';
import { SkillRegistry } from './SkillRegistry.js';
import { getLogger } from '../Logger.js';

const log = getLogger('SkillManager');

/** Stored metadata for a loaded skill, enabling ephemeral copy re-instantiation. */
interface SkillMetaEntry {
  /** The skill class constructor. */
  SkillClass: typeof SkillBase;
  /** The config originally passed to the skill. */
  config: SkillConfig;
  /** The skill name. */
  skillName: string;
}

/**
 * Manages the lifecycle of skills attached to an agent.
 *
 * Handles loading, unloading, validation, and aggregation of skill tools,
 * hints, global data, and prompt sections.
 *
 * @remarks
 * **Architectural note — push vs pull model:**
 * Python's `SkillManager.__init__(self, agent)` stores the agent reference and
 * uses a **push model**: when a skill is loaded via `load_skill()`, the manager
 * immediately calls `agent.add_hints()`, `agent.update_global_data()`, and
 * `agent.prompt_add_section()` to inject skill data into the agent.
 *
 * This TypeScript implementation uses a **pull model** instead: `SkillManager`
 * has no agent reference and no constructor. `AgentBase` owns the manager and
 * calls `getAllHints()`, `getMergedGlobalData()`, and `getAllPromptSections()`
 * at render time. Both approaches produce the same observable behavior at the
 * SWML / SWAIG level. The pull model avoids circular-reference issues between
 * `AgentBase` and `SkillManager` and is better suited to TypeScript's
 * import-graph constraints.
 */
export class SkillManager {
  private skills: Map<string, SkillBase> = new Map();
  private skillMeta: Map<string, SkillMetaEntry> = new Map();

  /**
   * Public read-only view of all loaded skill instances, keyed by instance key.
   * Python equivalent: `self.loaded_skills` (public `Dict[str, SkillBase]`).
   *
   * Use this to iterate or inspect loaded skills without mutating the internal map.
   */
  get loadedSkills(): ReadonlyMap<string, SkillBase> {
    return this.skills;
  }

  /**
   * Add a skill to the manager, validating env vars and calling setup().
   * Uses the skill's instance key for deduplication.
   *
   * {@link loadSkill} / {@link loadSkillByName} wrap this and catch to return
   * `[false, msg]`, matching Python `load_skill`'s return contract
   * (`skill_manager.py` lines 114-118).
   *
   * @param skill - The skill instance to add.
   * @returns Resolves once the skill is registered.
   * @throws {Error} When a single-instance skill is already loaded, its
   *   required environment variables are missing, its parameter schema is
   *   empty, its required packages cannot be imported, or `setup()` returns
   *   `false`.
   */
  async addSkill(skill: SkillBase): Promise<void> {
    const name = skill.skillName;
    const instanceKey = skill.getInstanceKey();
    const SkillClass = skill.constructor as typeof SkillBase;

    // Duplicate detection using instance key
    if (this.skills.has(instanceKey)) {
      if (!SkillClass.SUPPORTS_MULTIPLE_INSTANCES) {
        throw new Error(`Skill '${name}' is already loaded and does not support multiple instances`);
      }
      log.warn(`Skill '${name}' with key '${instanceKey}' already loaded, skipping duplicate`);
      return;
    }

    // Validate required env vars — throw on miss; loadSkill/loadSkillByName
    // catch and convert to `[false, msg]` to match Python load_skill's return
    // contract (skill_manager.py lines 114-118).
    const missingEnvVars = skill.validateEnvVars();
    if (missingEnvVars.length > 0) {
      throw new Error(`Cannot load skill '${name}': missing environment variables: ${missingEnvVars.join(', ')}`);
    }

    // Parameter schema contract — partial port of Python load_skill checks
    // (skill_manager.py:49-93). Python additionally requires the subclass to
    // override get_parameter_schema; we skip that identity check because TS
    // test fixtures and trivial skills routinely inherit the base schema
    // without harm, and the TS type system already enforces that
    // getParameterSchema is a callable classmethod returning the right shape.
    const schema = SkillClass.getParameterSchema();
    if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) {
      throw new Error(
        `Skill '${name}'.getParameterSchema() must return a non-empty object`,
      );
    }
    log.debug(`Skill '${name}' has ${Object.keys(schema).length} config params`);

    // Validate required packages — Python equivalent at skill_manager.py:121-131.
    // Throw on miss; wrappers catch and convert to [false, msg].
    const missingPackages = await skill.validatePackages();
    if (missingPackages.length > 0) {
      throw new Error(
        `Cannot load skill '${name}': missing required packages: ${missingPackages.join(', ')}`,
      );
    }

    // Setup — returns boolean indicating success. Matches Python load_skill
    // (skill_manager.py:134-137): setup() returning false is fatal, the skill
    // is NOT registered, and the caller gets [false, msg] via the wrappers.
    // Python fails closed so the AI never sees a tool whose skill knows it
    // isn't configured correctly.
    const setupOk = await skill.setup();
    if (!setupOk) {
      throw new Error(`Failed to setup skill '${name}'`);
    }
    skill.markInitialized();

    this.skills.set(instanceKey, skill);
    this.skillMeta.set(instanceKey, {
      SkillClass,
      config: { ...skill['config'] },
      skillName: name,
    });
    log.debug(`Added skill '${name}' (key: ${instanceKey})`);
  }

  /**
   * Remove a skill by its instance key or instance ID, calling cleanup() before removal.
   * @param keyOrId - The instance key or instance ID of the skill to remove.
   * @returns True if the skill was found and removed, false otherwise.
   *
   * @remarks Equivalent to Python's `unload_skill(skill_identifier)`. Callers porting
   *          from Python should change `skill_manager.unload_skill(id)` →
   *          `skillManager.removeSkill(id)`.
   */
  async removeSkill(keyOrId: string): Promise<boolean> {
    // Try by instance key first
    let skill = this.skills.get(keyOrId);
    let key = keyOrId;

    // Fallback: search by instanceId for backward compatibility
    if (!skill) {
      for (const [k, s] of this.skills) {
        if (s.instanceId === keyOrId) {
          skill = s;
          key = k;
          break;
        }
      }
    }

    if (!skill) return false;

    await skill.cleanup();
    this.skills.delete(key);
    this.skillMeta.delete(key);
    log.debug(`Removed skill '${skill.skillName}' (${key})`);
    return true;
  }

  /**
   * Remove all skill instances matching a given skill name.
   * @param skillName - The skill name to match against.
   * @returns The number of skill instances removed.
   */
  async removeSkillByName(skillName: string): Promise<number> {
    let count = 0;
    for (const [key, skill] of this.skills) {
      if (skill.skillName === skillName) {
        await skill.cleanup();
        this.skills.delete(key);
        this.skillMeta.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Check if any skill instance with the given name is currently loaded.
   * @param skillName - The skill name to check for.
   * @returns True if at least one instance with this name is loaded.
   */
  hasSkill(skillName: string): boolean {
    for (const skill of this.skills.values()) {
      if (skill.skillName === skillName) return true;
    }
    return false;
  }

  /**
   * Check if a skill with the given instance key is currently loaded.
   * This matches Python's `has_skill` semantics, which performs a direct
   * dictionary key lookup (`skill_identifier in self.loaded_skills`).
   *
   * Use `hasSkill(name)` to check by skill name (iterates values).
   * Use `hasSkillByKey(key)` to check by instance key (direct map lookup).
   *
   * @param instanceKey - The instance key to look up.
   * @returns True if a skill with this exact instance key is loaded.
   *
   * @remarks Equivalent to Python's `has_skill(skill_identifier)`. Callers porting
   *          from Python should change `skill_manager.has_skill(key)` →
   *          `skillManager.hasSkillByKey(key)`.
   */
  hasSkillByKey(instanceKey: string): boolean {
    return this.skills.has(instanceKey);
  }

  /**
   * Load a skill by providing the class constructor directly, bypassing the registry.
   * This is the TypeScript equivalent of Python's `load_skill(skill_name, skill_class, params)`
   * path where a caller-provided `skill_class` is used instead of a registry lookup.
   *
   * @param skillClass - The skill class constructor (a subclass of `SkillBase`).
   * @param config - Optional configuration to pass to the skill constructor.
   * @returns A tuple `[success, errorMessage]` matching Python's `load_skill` return
   *          contract. `errorMessage` is an empty string on success.
   *
   * @remarks Equivalent to Python's `load_skill(skill_name, skill_class=MySkillClass, params)`.
   *
   * @example
   * ```ts
   * const [ok, err] = await manager.loadSkill(MyCustomSkill, { api_key: 'secret' });
   * if (!ok) console.error(err);
   * ```
   */
  async loadSkill(skillClass: typeof SkillBase, config?: SkillConfig): Promise<[boolean, string]> {
    try {
      // Concrete skill subclasses override the constructor to take only (config?: SkillConfig).
      // Cast to reflect actual runtime signature — the base class requires `skillName` but
      // concrete subclasses hardcode it in super(...), so only config is needed at the call site.
      const SkillCtor = skillClass as unknown as new (config?: SkillConfig) => SkillBase;
      const skill = new SkillCtor(config);
      await this.addSkill(skill);
      return [true, ''];
    } catch (err) {
      const errorMsg = `Error loading skill: ${err instanceof Error ? err.message : String(err)}`;
      log.error(errorMsg);
      return [false, errorMsg];
    }
  }

  /**
   * Load a skill by name from the global SkillRegistry, construct it, and add it.
   * This is the TypeScript equivalent of Python's `load_skill(skill_name)` path
   * where `skill_class=None` triggers a registry lookup.
   *
   * @param skillName - The registered skill name to look up in the SkillRegistry.
   * @param config - Optional configuration to pass to the skill factory.
   * @returns A tuple `[success, errorMessage]` matching Python's `load_skill` return
   *          contract. `errorMessage` is an empty string on success.
   *
   * @remarks Equivalent to Python's `load_skill(skill_name)` (registry path, where
   *          `skill_class=None`). Callers porting from Python should change
   *          `skill_manager.load_skill(name)` → `skillManager.loadSkillByName(name)`.
   */
  async loadSkillByName(skillName: string, config?: SkillConfig): Promise<[boolean, string]> {
    const registry = SkillRegistry.getInstance();

    if (!registry.has(skillName)) {
      const errorMsg = `Skill '${skillName}' not found in registry`;
      log.error(errorMsg);
      return [false, errorMsg];
    }

    const skill = registry.create(skillName, config);
    if (!skill) {
      const errorMsg = `Failed to create skill '${skillName}' from registry`;
      log.error(errorMsg);
      return [false, errorMsg];
    }

    try {
      await this.addSkill(skill);
      return [true, ''];
    } catch (err) {
      const errorMsg = `Error loading skill '${skillName}': ${err instanceof Error ? err.message : String(err)}`;
      log.error(errorMsg);
      return [false, errorMsg];
    }
  }

  /**
   * List the instance keys of all currently loaded skills.
   * Python equivalent: `list_loaded_skills() -> List[str]` which returns
   * `list(self.loaded_skills.keys())`.
   *
   * Use `listSkills()` for richer objects (name, instanceId, initialized).
   * Use `listSkillKeys()` for a flat list of instance key strings.
   *
   * @returns Array of instance key strings.
   *
   * @remarks Equivalent to Python's `list_loaded_skills()`. Callers porting from
   *          Python should change `skill_manager.list_loaded_skills()` →
   *          `skillManager.listSkillKeys()`.
   */
  listSkillKeys(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Get a skill by its instance key or instance ID.
   * @param keyOrId - The instance key or instance ID to look up.
   * @returns The skill instance, or undefined if not found.
   */
  getSkill(keyOrId: string): SkillBase | undefined {
    const skill = this.skills.get(keyOrId);
    if (skill) return skill;
    // Fallback: search by instanceId
    for (const s of this.skills.values()) {
      if (s.instanceId === keyOrId) return s;
    }
    return undefined;
  }

  /**
   * List all loaded skill instances with their name, ID, and initialization state.
   * @returns Array of skill summary objects.
   */
  listSkills(): { name: string; instanceId: string; initialized: boolean }[] {
    return Array.from(this.skills.values()).map(s => ({
      name: s.skillName,
      instanceId: s.instanceId,
      initialized: s.isInitialized(),
    }));
  }

  /**
   * Aggregate tool definitions from all loaded skills.
   * @returns Combined array of all skill tool definitions.
   */
  getAllTools(): ReturnType<SkillBase['getTools']> {
    const tools: ReturnType<SkillBase['getTools']> = [];
    for (const skill of this.skills.values()) {
      tools.push(...skill.getTools());
    }
    return tools;
  }

  /**
   * Aggregate prompt sections from all loaded skills.
   * @returns Combined array of all skill prompt sections.
   */
  getAllPromptSections(): ReturnType<SkillBase['getPromptSections']> {
    const sections: ReturnType<SkillBase['getPromptSections']> = [];
    for (const skill of this.skills.values()) {
      sections.push(...skill.getPromptSections());
    }
    return sections;
  }

  /**
   * Aggregate speech recognition hints from all loaded skills.
   * @returns Combined array of all skill hint strings.
   */
  getAllHints(): string[] {
    const hints: string[] = [];
    for (const skill of this.skills.values()) {
      hints.push(...skill.getHints());
    }
    return hints;
  }

  /**
   * Merge global data from all loaded skills into a single object.
   * @returns Combined global data (later skills override earlier ones on key conflicts).
   */
  getMergedGlobalData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const skill of this.skills.values()) {
      Object.assign(data, skill.getGlobalData());
    }
    return data;
  }

  /**
   * Get the number of currently loaded skill instances.
   * @returns The count of loaded skills.
   */
  get size(): number {
    return this.skills.size;
  }

  /**
   * Get metadata for all loaded skills, enabling ephemeral copy re-instantiation.
   * @returns Array of entries containing skill name, class constructor, and config.
   */
  getLoadedSkillEntries(): Array<{ skillName: string; SkillClass: typeof SkillBase; config: SkillConfig }> {
    return Array.from(this.skillMeta.values()).map(entry => ({
      skillName: entry.skillName,
      SkillClass: entry.SkillClass,
      config: { ...entry.config },
    }));
  }

  /**
   * Remove all skills and clean up.
   */
  async clear(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.cleanup();
    }
    this.skills.clear();
    this.skillMeta.clear();
  }
}
