/**
 * Individual tests for the NativeVectorSearch skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NativeVectorSearchSkill, createNativeVectorSearchSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('NativeVectorSearchSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new NativeVectorSearchSkill()).toBeInstanceOf(SkillBase);
    expect(createNativeVectorSearchSkill()).toBeInstanceOf(NativeVectorSearchSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new NativeVectorSearchSkill().setup()).resolves.toBe(true);
  });

  it('should register tools', () => {
    const tools = new NativeVectorSearchSkill().getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should provide prompt sections', () => {
    const sections = new NativeVectorSearchSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new NativeVectorSearchSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new NativeVectorSearchSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new NativeVectorSearchSkill().getManifest();
    expect(manifest.name).toBe('native_vector_search');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = NativeVectorSearchSkill.getParameterSchema();
    expect(schema).toBeDefined();
  });
});
