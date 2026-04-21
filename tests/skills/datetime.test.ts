/**
 * Individual tests for the DateTime skill.
 *
 * Verifies: skill creation, setup, tool registration, hints, prompt sections, global data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DateTimeSkill, createDateTimeSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('DateTimeSkill', () => {
  it('should instantiate via constructor and factory', () => {
    const skill = new DateTimeSkill();
    expect(skill).toBeInstanceOf(SkillBase);
    const fromFactory = createDateTimeSkill();
    expect(fromFactory).toBeInstanceOf(DateTimeSkill);
  });

  it('should complete setup without errors', async () => {
    const skill = new DateTimeSkill();
    await expect(skill.setup()).resolves.toBe(true);
  });

  it('should register get_current_time and get_current_date tools', () => {
    const skill = new DateTimeSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('get_current_time');
    expect(names).toContain('get_current_date');
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.handler).toBeTypeOf('function');
    }
  });

  it('should provide prompt sections', () => {
    const skill = new DateTimeSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Date and Time Information');
    expect(sections[0].bullets).toBeDefined();
    expect(sections[0].bullets!.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    const skill = new DateTimeSkill({ skip_prompt: true });
    expect(skill.getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints', () => {
    const skill = new DateTimeSkill();
    expect(skill.getHints()).toEqual([]);
  });

  it('should return empty global data', () => {
    const skill = new DateTimeSkill();
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    expect(DateTimeSkill.SKILL_NAME).toBe('datetime');
    expect(DateTimeSkill.SKILL_VERSION).toBe('1.0.0');
    expect(DateTimeSkill.SKILL_DESCRIPTION).toBeTruthy();
  });

  it('should execute get_current_time handler with a valid timezone', () => {
    const skill = new DateTimeSkill();
    const timeTool = skill.getTools().find((t) => t.name === 'get_current_time')!;
    const result = timeTool.handler({ timezone: 'America/New_York' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('current time');
  });

  it('should execute get_current_date handler with a valid timezone', () => {
    const skill = new DateTimeSkill();
    const dateTool = skill.getTools().find((t) => t.name === 'get_current_date')!;
    const result = dateTool.handler({ timezone: 'America/New_York' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain("Today's date");
  });

  it('should execute handler with an invalid timezone', () => {
    const skill = new DateTimeSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ timezone: 'Invalid/Zone' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('Invalid');
  });

  it('should have a parameter schema', () => {
    const schema = DateTimeSkill.getParameterSchema();
    expect(schema).toBeDefined();
    expect(schema['swaig_fields']).toBeDefined();
    expect(schema['skip_prompt']).toBeDefined();
  });
});
