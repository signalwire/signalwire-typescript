/**
 * Individual tests for the GoogleMaps skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GoogleMapsSkill, createGoogleMapsSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { SwaigFunctionResult } from '../../src/SwaigFunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('GoogleMapsSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new GoogleMapsSkill()).toBeInstanceOf(SkillBase);
    expect(createGoogleMapsSkill()).toBeInstanceOf(GoogleMapsSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new GoogleMapsSkill().setup()).resolves.toBeUndefined();
  });

  it('should register tools', () => {
    const tools = new GoogleMapsSkill().getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should provide prompt sections', () => {
    const sections = new GoogleMapsSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new GoogleMapsSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new GoogleMapsSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest with required env vars', () => {
    const manifest = new GoogleMapsSkill().getManifest();
    expect(manifest.name).toBe('google_maps');
    expect(manifest.requiredEnvVars).toContain('GOOGLE_MAPS_API_KEY');
  });

  it('should return error when origin is missing', async () => {
    delete process.env['GOOGLE_MAPS_API_KEY'];
    const handler = new GoogleMapsSkill().getTools()[0].handler;
    const result = await handler({}, {}) as SwaigFunctionResult;
    expect(result.response).toBeTruthy();
  });

  it('should have a parameter schema', () => {
    const schema = GoogleMapsSkill.getParameterSchema();
    expect(schema['api_key']).toBeDefined();
  });
});
