/**
 * Individual tests for the Math skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MathSkill, createMathSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('MathSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new MathSkill()).toBeInstanceOf(SkillBase);
    expect(createMathSkill()).toBeInstanceOf(MathSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new MathSkill().setup()).resolves.toBeUndefined();
  });

  it('should register a calculate tool', () => {
    const tools = new MathSkill().getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('calculate');
    expect(tools[0].required).toContain('expression');
  });

  it('should provide prompt sections', () => {
    const sections = new MathSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Mathematical Calculations');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new MathSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new MathSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new MathSkill().getManifest();
    expect(manifest.name).toBe('math');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should evaluate a simple expression', () => {
    const handler = new MathSkill().getTools()[0].handler;
    const result = handler({ expression: '2 + 3' }, {}) as FunctionResult;
    expect(result.response).toContain('5');
  });

  it('should reject invalid expressions', () => {
    const handler = new MathSkill().getTools()[0].handler;
    const result = handler({ expression: 'DROP TABLE' }, {}) as FunctionResult;
    expect(result.response).toContain('Could not evaluate');
  });

  it('should have a parameter schema', () => {
    const schema = MathSkill.getParameterSchema();
    expect(schema['swaig_fields']).toBeDefined();
  });
});
