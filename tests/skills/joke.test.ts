/**
 * Individual tests for the Joke skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { JokeSkill, createJokeSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => {
  suppressAllLogs(true);
});

describe('JokeSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new JokeSkill()).toBeInstanceOf(SkillBase);
    expect(createJokeSkill()).toBeInstanceOf(JokeSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new JokeSkill().setup()).resolves.toBe(true);
  });

  it('should register a get_joke tool matching the Python interface', () => {
    const tools = new JokeSkill().getTools();
    expect(tools).toHaveLength(1);
    // Interface matches Python (joke/skill.py:68-77): name get_joke, required
    // `type` param, enum jokes|dadjokes. (Offline impl; Python uses API-Ninjas.)
    expect(tools[0].name).toBe('get_joke');
    expect(tools[0].required).toEqual(['type']);
    const typeParam = (tools[0].parameters as Record<string, { enum?: string[] }>)['type'];
    expect(typeParam.enum).toEqual(['jokes', 'dadjokes']);
  });

  it('should provide prompt sections', () => {
    const sections = new JokeSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Jokes');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new JokeSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and joke_skill_enabled global data', () => {
    const skill = new JokeSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({ joke_skill_enabled: true });
  });

  it('should use a configurable tool_name', () => {
    const skill = new JokeSkill({ tool_name: 'make_me_laugh' });
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('make_me_laugh');
  });

  it('should return correct manifest', () => {
    const klass = JokeSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('joke');
    expect(klass.SKILL_VERSION).toBe('1.0.0');
  });

  it('should return a regular joke for type "jokes"', () => {
    const handler = new JokeSkill().getTools()[0].handler;
    const result = handler({ type: 'jokes' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    // A real joke from the collection: setup ... punchline.
    expect(typeof result.response).toBe('string');
    expect(result.response).toContain('...');
    expect((result.response as string).length).toBeGreaterThan(5);
  });

  it('should return a dad joke for type "dadjokes"', () => {
    const handler = new JokeSkill().getTools()[0].handler;
    const result = handler({ type: 'dadjokes' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('...');
    expect((result.response as string).length).toBeGreaterThan(5);
  });

  it('should have a parameter schema', () => {
    const schema = JokeSkill.getParameterSchema();
    const swaigEntry = schema['swaig_fields'];
    expect(swaigEntry).toBeDefined();
    // `swaig_fields` is the SkillBase-inherited dict-shaped escape
    // hatch that lets agents pin SWAIG metadata. It must be declared
    // as type=object (not just present).
    expect(swaigEntry.type).toBe('object');
  });
});
