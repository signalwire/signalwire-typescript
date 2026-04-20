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

  it('should return false from setup when credentials are missing', async () => {
    // Python parity (skills/datasphere/skill.py:120-128): setup() returns false
    // with an error log when any of space_name, project_id, token, document_id
    // is missing. Fails closed so the skill never exposes broken tools to the AI.
    await expect(new DataSphereSkill().setup()).resolves.toBe(false);
  });

  it('should complete setup when all credentials + document_id are provided', async () => {
    await expect(
      new DataSphereSkill({
        space_name: 'test',
        project_id: 'p',
        token: 't',
        document_id: 'd',
      }).setup(),
    ).resolves.toBe(true);
  });

  it('should register a search_knowledge tool', () => {
    const tools = new DataSphereSkill().getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_knowledge');
    expect(tools[0].required).toContain('query');
  });

  it('should provide prompt sections', () => {
    const sections = new DataSphereSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toContain('Knowledge Search');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new DataSphereSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints', () => {
    const skill = new DataSphereSkill();
    expect(skill.getHints()).toEqual([]);
  });

  it('should expose DataSphere metadata via global data', () => {
    const skill = new DataSphereSkill({ document_id: 'doc-1' });
    const globalData = skill.getGlobalData();
    expect(globalData['datasphere_enabled']).toBe(true);
    expect(globalData['document_id']).toBe('doc-1');
    expect(globalData['knowledge_provider']).toBe('SignalWire DataSphere');
  });

  it('should return correct manifest with no required env vars', () => {
    const manifest = new DataSphereSkill().getManifest();
    expect(manifest.name).toBe('datasphere');
    expect(manifest.requiredEnvVars).toEqual([]);
  });

  it('should return error when credentials are missing', async () => {
    delete process.env['SIGNALWIRE_PROJECT_ID'];
    delete process.env['SIGNALWIRE_TOKEN'];
    delete process.env['SIGNALWIRE_SPACE'];
    const handler = new DataSphereSkill().getTools()[0].handler;
    const result = await handler({ query: 'test' }, {}) as FunctionResult;
    expect(result.response).toContain('not configured');
  });

  it('should default instance key to datasphere_search_knowledge', () => {
    const skill = new DataSphereSkill();
    expect(skill.getInstanceKey()).toBe('datasphere_search_knowledge');
  });

  it('should use custom instance key with tool_name', () => {
    const skill = new DataSphereSkill({ tool_name: 'custom' });
    expect(skill.getInstanceKey()).toBe('datasphere_custom');
  });

  it('should have a parameter schema', () => {
    const schema = DataSphereSkill.getParameterSchema();
    expect(schema['count']).toBeDefined();
    expect(schema['distance']).toBeDefined();
    expect(schema['tags']).toBeDefined();
    expect(schema['language']).toBeDefined();
    expect(schema['pos_to_expand']).toBeDefined();
    expect(schema['max_synonyms']).toBeDefined();
    expect(schema['no_results_message']).toBeDefined();
    expect(schema['tool_name']).toBeDefined();
  });
});
