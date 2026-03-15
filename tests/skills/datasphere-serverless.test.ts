/**
 * Individual tests for the DataSphereServerless skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DataSphereServerlessSkill, createDataSphereServerlessSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('DataSphereServerlessSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new DataSphereServerlessSkill()).toBeInstanceOf(SkillBase);
    expect(createDataSphereServerlessSkill()).toBeInstanceOf(DataSphereServerlessSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new DataSphereServerlessSkill().setup()).resolves.toBeUndefined();
  });

  it('should register tools', () => {
    const tools = new DataSphereServerlessSkill().getTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should provide prompt sections', () => {
    const sections = new DataSphereServerlessSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new DataSphereServerlessSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new DataSphereServerlessSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new DataSphereServerlessSkill().getManifest();
    expect(manifest.name).toBe('datasphere_serverless');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = DataSphereServerlessSkill.getParameterSchema();
    expect(schema).toBeDefined();
  });
});
