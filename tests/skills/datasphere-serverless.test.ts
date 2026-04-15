/**
 * Individual tests for the DataSphereServerless skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DataSphereServerlessSkill, createDataSphereServerlessSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('DataSphereServerlessSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new DataSphereServerlessSkill()).toBeInstanceOf(SkillBase);
    expect(createDataSphereServerlessSkill()).toBeInstanceOf(DataSphereServerlessSkill);
  });

  it('should return false from setup when required params are missing', async () => {
    // Python setup() returns False when space_name/project_id/token/document_id are absent.
    await expect(new DataSphereServerlessSkill().setup()).resolves.toBe(false);
  });

  it('should return true from setup when all required params are present', async () => {
    const skill = new DataSphereServerlessSkill({
      space_name: 'mycompany',
      project_id: 'proj-123',
      token: 'tok-abc',
      document_id: 'doc-xyz',
    });
    await expect(skill.setup()).resolves.toBe(true);
  });

  it('should register tools', () => {
    const tools = new DataSphereServerlessSkill().getTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should provide prompt sections', () => {
    const sections = new DataSphereServerlessSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new DataSphereServerlessSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints', () => {
    const skill = new DataSphereServerlessSkill();
    expect(skill.getHints()).toEqual([]);
  });

  it('should expose DataSphere metadata via global data', () => {
    const skill = new DataSphereServerlessSkill({ document_id: 'doc-1' });
    const globalData = skill.getGlobalData();
    expect(globalData['datasphere_serverless_enabled']).toBe(true);
    expect(globalData['document_id']).toBe('doc-1');
    expect(globalData['knowledge_provider']).toBe('SignalWire DataSphere (Serverless)');
  });

  it('should return correct manifest', () => {
    const manifest = new DataSphereServerlessSkill().getManifest();
    expect(manifest.name).toBe('datasphere_serverless');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = DataSphereServerlessSkill.getParameterSchema();
    expect(schema).toBeDefined();
  });
});
