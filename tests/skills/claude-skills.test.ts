/**
 * Individual tests for the ClaudeSkills skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ClaudeSkillsSkill, createClaudeSkillsSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('ClaudeSkillsSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new ClaudeSkillsSkill()).toBeInstanceOf(SkillBase);
    expect(createClaudeSkillsSkill()).toBeInstanceOf(ClaudeSkillsSkill);
  });

  it('should return false from setup when skills_path is not configured', async () => {
    await expect(new ClaudeSkillsSkill().setup()).resolves.toBe(false);
  });

  it('should return empty tools when no skills_path is configured', () => {
    const tools = new ClaudeSkillsSkill().getTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(0);
  });

  it('should return empty prompt sections when no skills_path is configured', () => {
    const sections = new ClaudeSkillsSkill().getPromptSections();
    expect(Array.isArray(sections)).toBe(true);
    expect(sections).toHaveLength(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new ClaudeSkillsSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new ClaudeSkillsSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new ClaudeSkillsSkill().getManifest();
    expect(manifest.name).toBe('claude_skills');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = ClaudeSkillsSkill.getParameterSchema();
    expect(schema).toBeDefined();
  });
});
