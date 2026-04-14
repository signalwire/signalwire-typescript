/**
 * Individual tests for the Joke skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { JokeSkill, createJokeSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('JokeSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new JokeSkill()).toBeInstanceOf(SkillBase);
    expect(createJokeSkill()).toBeInstanceOf(JokeSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new JokeSkill().setup()).resolves.toBe(true);
  });

  it('should register a tell_joke tool', () => {
    const tools = new JokeSkill().getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('tell_joke');
  });

  it('should provide prompt sections', () => {
    const sections = new JokeSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Jokes');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new JokeSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new JokeSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new JokeSkill().getManifest();
    expect(manifest.name).toBe('joke');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a joke from any category', () => {
    const handler = new JokeSkill().getTools()[0].handler;
    const result = handler({}, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('...');
  });

  it('should return a joke from a specific category', () => {
    const handler = new JokeSkill().getTools()[0].handler;
    const result = handler({ category: 'programming' }, {}) as FunctionResult;
    expect(result.response).toBeTruthy();
  });

  it('should handle unknown category', () => {
    const handler = new JokeSkill().getTools()[0].handler;
    const result = handler({ category: 'nonexistent' }, {}) as FunctionResult;
    expect(result.response).toContain('Unknown');
  });

  it('should have a parameter schema', () => {
    const schema = JokeSkill.getParameterSchema();
    expect(schema['swaig_fields']).toBeDefined();
  });
});
