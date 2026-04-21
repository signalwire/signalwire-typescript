/**
 * Individual tests for the PlayBackgroundFile skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PlayBackgroundFileSkill, createPlayBackgroundFileSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('PlayBackgroundFileSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new PlayBackgroundFileSkill()).toBeInstanceOf(SkillBase);
    expect(createPlayBackgroundFileSkill()).toBeInstanceOf(PlayBackgroundFileSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new PlayBackgroundFileSkill().setup()).resolves.toBe(true);
  });

  it('should register tools', () => {
    const tools = new PlayBackgroundFileSkill().getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should provide prompt sections', () => {
    const sections = new PlayBackgroundFileSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new PlayBackgroundFileSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new PlayBackgroundFileSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const klass = PlayBackgroundFileSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('play_background_file');
    expect(klass.SKILL_VERSION).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = PlayBackgroundFileSkill.getParameterSchema();
    expect(schema).toBeDefined();
  });
});
