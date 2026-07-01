/**
 * Individual tests for the PlayBackgroundFile skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  PlayBackgroundFileSkill,
  createPlayBackgroundFileSkill,
} from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => {
  suppressAllLogs(true);
});

// The skill requires a non-empty `files` list (matches Python, which raises on
// empty). setup() fails without it, so the tool/prompt cases configure files.
const FILES = {
  files: [{ key: 'hold', url: 'https://example.com/hold.mp3', description: 'Hold music' }],
};

describe('PlayBackgroundFileSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new PlayBackgroundFileSkill()).toBeInstanceOf(SkillBase);
    expect(createPlayBackgroundFileSkill()).toBeInstanceOf(PlayBackgroundFileSkill);
  });

  it('setup() succeeds with files, fails without (matches Python validation)', async () => {
    await expect(new PlayBackgroundFileSkill(FILES).setup()).resolves.toBe(true);
    await expect(new PlayBackgroundFileSkill().setup()).resolves.toBe(false);
  });

  it('should register tools', () => {
    const tools = new PlayBackgroundFileSkill(FILES).getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]!.handler).toBeTypeOf('function');
  });

  it('should provide prompt sections', () => {
    const sections = new PlayBackgroundFileSkill(FILES).getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(
      new PlayBackgroundFileSkill({ ...FILES, skip_prompt: true }).getPromptSections(),
    ).toHaveLength(0);
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
    expect(Object.keys(schema).length).toBeGreaterThan(0);
    expect(schema).toHaveProperty('swaig_fields');
    expect(schema).toHaveProperty('skip_prompt');
  });
});
