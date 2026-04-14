/**
 * Individual tests for the DataSphere skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DataSphereSkill, createDataSphereSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('DataSphereSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new DataSphereSkill()).toBeInstanceOf(SkillBase);
    expect(createDataSphereSkill()).toBeInstanceOf(DataSphereSkill);
  });

  it('should support multiple instances', () => {
    expect(DataSphereSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
  });

  it('should complete setup without errors', async () => {
    await expect(new DataSphereSkill().setup()).resolves.toBe(true);
  });

  it('should register a search_datasphere tool', () => {
    const tools = new DataSphereSkill().getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_datasphere');
    expect(tools[0].required).toContain('query');
  });

  it('should provide prompt sections', () => {
    const sections = new DataSphereSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toContain('DataSphere');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new DataSphereSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new DataSphereSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest with required env vars', () => {
    const manifest = new DataSphereSkill().getManifest();
    expect(manifest.name).toBe('datasphere');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_PROJECT_ID');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_TOKEN');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_SPACE');
  });

  it('should return error when credentials are missing', async () => {
    delete process.env['SIGNALWIRE_PROJECT_ID'];
    delete process.env['SIGNALWIRE_TOKEN'];
    delete process.env['SIGNALWIRE_SPACE'];
    const handler = new DataSphereSkill().getTools()[0].handler;
    const result = await handler({ query: 'test' }, {}) as FunctionResult;
    expect(result.response).toContain('not configured');
  });

  it('should use custom instance key with tool_name', () => {
    const skill = new DataSphereSkill({ tool_name: 'custom' });
    expect(skill.getInstanceKey()).toBe('datasphere_custom');
  });

  it('should have a parameter schema', () => {
    const schema = DataSphereSkill.getParameterSchema();
    expect(schema['max_results']).toBeDefined();
    expect(schema['distance_threshold']).toBeDefined();
    expect(schema['tool_name']).toBeDefined();
  });
});
