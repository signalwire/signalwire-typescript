/**
 * Individual tests for the ApiNinjasTrivia skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ApiNinjasTriviaSkill, createApiNinjasTriviaSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { SwaigFunctionResult } from '../../src/SwaigFunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('ApiNinjasTriviaSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new ApiNinjasTriviaSkill()).toBeInstanceOf(SkillBase);
    expect(createApiNinjasTriviaSkill()).toBeInstanceOf(ApiNinjasTriviaSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new ApiNinjasTriviaSkill().setup()).resolves.toBeUndefined();
  });

  it('should register tools', () => {
    const tools = new ApiNinjasTriviaSkill().getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should provide prompt sections', () => {
    const sections = new ApiNinjasTriviaSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new ApiNinjasTriviaSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return hints and empty global data', () => {
    const skill = new ApiNinjasTriviaSkill();
    expect(skill.getHints().length).toBeGreaterThan(0);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new ApiNinjasTriviaSkill().getManifest();
    expect(manifest.name).toBe('api_ninjas_trivia');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = ApiNinjasTriviaSkill.getParameterSchema();
    expect(schema).toBeDefined();
  });
});
