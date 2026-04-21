import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../src/skills/SkillRegistry.js';
import { SkillBase, type SkillToolDefinition } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

class SimpleSkill extends SkillBase {
  static override SKILL_NAME = 'simple';
  static override SKILL_DESCRIPTION = 'Simple skill';

  getTools(): SkillToolDefinition[] {
    return [{
      name: 'simple_tool',
      description: 'Simple tool',
      handler: () => new FunctionResult('ok'),
    }];
  }
}

/** Named-subclass helper — statics are class-level, so distinct names need distinct classes. */
function makeNamedSkill(name: string, description = 'Test'): typeof SimpleSkill {
  return class extends SimpleSkill {
    static override SKILL_NAME = name;
    static override SKILL_DESCRIPTION = description;
  };
}

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    suppressAllLogs(true);
    SkillRegistry.resetInstance();
    registry = new SkillRegistry();
  });

  it('registers and creates skills', () => {
    registry.register(SimpleSkill);
    const skill = registry.create('simple');
    expect(skill).not.toBeNull();
    expect(skill!.skillName).toBe('simple');
  });

  it('returns null for unregistered skill', () => {
    expect(registry.create('missing')).toBeNull();
  });

  it('has() checks registration', () => {
    registry.register(SimpleSkill);
    expect(registry.has('simple')).toBe(true);
    expect(registry.has('missing')).toBe(false);
  });

  it('unregister removes skill', () => {
    registry.register(SimpleSkill);
    expect(registry.unregister('simple')).toBe(true);
    expect(registry.has('simple')).toBe(false);
  });

  it('listRegistered returns all names', () => {
    registry.register(makeNamedSkill('a'));
    registry.register(makeNamedSkill('b'));
    const names = registry.listRegistered();
    expect(names).toContain('a');
    expect(names).toContain('b');
  });

  it('getSkillClass returns the class reference (Python parity)', () => {
    registry.register(SimpleSkill);
    expect(registry.getSkillClass('simple')).toBe(SimpleSkill);
    expect(registry.getSkillClass('missing')).toBeUndefined();
  });

  it('listSkills returns Python-shaped metadata', () => {
    registry.register(SimpleSkill);
    const list = registry.listSkills();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('simple');
    expect(list[0].description).toBe('Simple skill');
    expect(list[0].version).toBe('1.0.0');
    expect(list[0].supportsMultipleInstances).toBe(false);
    expect(list[0].requiredEnvVars).toEqual([]);
    expect(list[0].requiredPackages).toEqual([]);
    expect(list[0].parameters).toHaveProperty('swaig_fields');
  });

  it('register throws when SKILL_NAME is missing', () => {
    class Nameless extends SkillBase {
      static override SKILL_NAME = '';
      static override SKILL_DESCRIPTION = 'nameless';
      getTools(): SkillToolDefinition[] { return []; }
    }
    expect(() => registry.register(Nameless)).toThrow('SKILL_NAME');
  });

  it('singleton instance', () => {
    const inst1 = SkillRegistry.getInstance();
    const inst2 = SkillRegistry.getInstance();
    expect(inst1).toBe(inst2);
  });

  it('resetInstance creates new singleton', () => {
    const inst1 = SkillRegistry.getInstance();
    SkillRegistry.resetInstance();
    const inst2 = SkillRegistry.getInstance();
    expect(inst1).not.toBe(inst2);
  });

  it('size tracks registrations', () => {
    expect(registry.size).toBe(0);
    registry.register(SimpleSkill);
    expect(registry.size).toBe(1);
  });

  it('clear removes all registrations', () => {
    registry.register(makeNamedSkill('a'));
    registry.register(makeNamedSkill('b'));
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('addSearchPath adds paths', () => {
    registry.addSearchPath('/custom/skills');
    expect(registry.getSearchPaths()).toContain('/custom/skills');
  });

  it('addSearchPath deduplicates', () => {
    registry.addSearchPath('/skills');
    registry.addSearchPath('/skills');
    expect(registry.getSearchPaths().filter(p => p === '/skills')).toHaveLength(1);
  });

  it('passes config to constructor', () => {
    registry.register(SimpleSkill);
    const skill = registry.create('simple', { key: 'val' });
    expect(skill!.getConfig('key')).toBe('val');
  });

  it('discoverFromDirectory handles non-existent dir', async () => {
    process.env['SWML_SKILL_DISCOVERY_ENABLED'] = 'true';
    const found = await registry.discoverFromDirectory('/nonexistent/path');
    expect(found).toHaveLength(0);
    delete process.env['SWML_SKILL_DISCOVERY_ENABLED'];
  });

  // ── Security remediation tests ─────────────────────────────────────

  it('locked skill cannot be overwritten', () => {
    const LockedA = makeNamedSkill('locked_skill');
    registry.register(LockedA);
    registry.lock(['locked_skill']);
    // Attempt to overwrite with a different subclass
    const LockedB = makeNamedSkill('locked_skill', 'Different');
    registry.register(LockedB);
    // Still has the original class reference
    expect(registry.getSkillClass('locked_skill')).toBe(LockedA);
  });

  it('lock() without args locks all current skills', () => {
    registry.register(makeNamedSkill('a'));
    registry.register(makeNamedSkill('b'));
    registry.lock();
    // Try overwriting
    registry.register(makeNamedSkill('a', 'other'));
    registry.register(makeNamedSkill('b', 'other'));
    // Both still exist
    expect(registry.has('a')).toBe(true);
    expect(registry.has('b')).toBe(true);
  });

  it('discovery disabled by default', async () => {
    delete process.env['SWML_SKILL_DISCOVERY_ENABLED'];
    const found = await registry.discoverFromDirectory('/some/path');
    expect(found).toHaveLength(0);
  });
});
