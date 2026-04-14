/**
 * Individual tests for the InfoGatherer skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { InfoGathererSkill, createInfoGathererSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('InfoGathererSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new InfoGathererSkill()).toBeInstanceOf(SkillBase);
    expect(createInfoGathererSkill()).toBeInstanceOf(InfoGathererSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new InfoGathererSkill().setup()).resolves.toBe(true);
  });

  it('should register tools with configured fields', () => {
    const skill = new InfoGathererSkill({
      fields: [
        { name: 'name', description: 'Full name', required: true },
        { name: 'email', description: 'Email address' },
      ],
    });
    const tools = skill.getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should return empty tools when no fields are configured', () => {
    const skill = new InfoGathererSkill();
    const tools = skill.getTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(0);
  });

  it('should return empty prompt sections when no fields are configured', () => {
    const sections = new InfoGathererSkill().getPromptSections();
    expect(Array.isArray(sections)).toBe(true);
    expect(sections).toHaveLength(0);
  });

  it('should provide prompt sections when fields are configured', () => {
    const skill = new InfoGathererSkill({
      fields: [{ name: 'name', description: 'Full name', required: true }],
    });
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new InfoGathererSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new InfoGathererSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new InfoGathererSkill().getManifest();
    expect(manifest.name).toBe('info_gatherer');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = InfoGathererSkill.getParameterSchema();
    expect(schema).toBeDefined();
  });
});
