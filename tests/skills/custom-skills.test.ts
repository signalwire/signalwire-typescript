/**
 * Individual tests for the CustomSkills skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CustomSkillsSkill, createCustomSkillsSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('CustomSkillsSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new CustomSkillsSkill()).toBeInstanceOf(SkillBase);
    expect(createCustomSkillsSkill()).toBeInstanceOf(CustomSkillsSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new CustomSkillsSkill().setup()).resolves.toBe(true);
  });

  it('should register tools', () => {
    const tools = new CustomSkillsSkill().getTools();
    // CustomSkills may have zero tools if no custom tools are configured
    expect(Array.isArray(tools)).toBe(true);
  });

  it('should provide prompt sections', () => {
    const sections = new CustomSkillsSkill().getPromptSections();
    expect(Array.isArray(sections)).toBe(true);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new CustomSkillsSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new CustomSkillsSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const klass = CustomSkillsSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('custom_skills');
    expect(klass.SKILL_VERSION).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = CustomSkillsSkill.getParameterSchema();
    expect(Object.keys(schema).length).toBeGreaterThan(0);
    expect(schema).toHaveProperty('swaig_fields');
    expect(schema).toHaveProperty('skip_prompt');
  });
});
