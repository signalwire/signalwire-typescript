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

  it('should register a get_datetime tool', () => {
    const skill = new DateTimeSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_datetime');
    expect(tools[0].description).toBeTruthy();
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should provide prompt sections', () => {
    const skill = new DateTimeSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Date and Time');
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
    const skill = new DateTimeSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('datetime');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.description).toBeTruthy();
  });

  it('should execute handler with a valid timezone', () => {
    const skill = new DateTimeSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ timezone: 'America/New_York' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('America/New_York');
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
