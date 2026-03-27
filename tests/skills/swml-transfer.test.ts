/**
 * Individual tests for the SwmlTransfer skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SwmlTransferSkill, createSwmlTransferSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('SwmlTransferSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new SwmlTransferSkill()).toBeInstanceOf(SkillBase);
    expect(createSwmlTransferSkill()).toBeInstanceOf(SwmlTransferSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new SwmlTransferSkill().setup()).resolves.toBeUndefined();
  });

  it('should register tools', () => {
    const tools = new SwmlTransferSkill().getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should provide prompt sections', () => {
    const sections = new SwmlTransferSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new SwmlTransferSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new SwmlTransferSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new SwmlTransferSkill().getManifest();
    expect(manifest.name).toBe('swml_transfer');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = SwmlTransferSkill.getParameterSchema();
    expect(schema).toBeDefined();
  });
});
