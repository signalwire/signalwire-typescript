/**
 * Individual tests for the Spider skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SpiderSkill, createSpiderSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('SpiderSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new SpiderSkill()).toBeInstanceOf(SkillBase);
    expect(createSpiderSkill()).toBeInstanceOf(SpiderSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new SpiderSkill().setup()).resolves.toBe(true);
  });

  it('should register a scrape_url tool', () => {
    const tools = new SpiderSkill().getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('scrape_url');
    expect(tools[0].required).toContain('url');
  });

  it('should provide prompt sections', () => {
    const sections = new SpiderSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new SpiderSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new SpiderSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest with required env vars', () => {
    const manifest = new SpiderSkill().getManifest();
    expect(manifest.name).toBe('spider');
    expect(manifest.requiredEnvVars).toContain('SPIDER_API_KEY');
  });

  it('should return error when API key is missing', async () => {
    delete process.env['SPIDER_API_KEY'];
    const handler = new SpiderSkill().getTools()[0].handler;
    const result = await handler({ url: 'https://example.com' }, {}) as FunctionResult;
    expect(result.response).toContain('not configured');
  });

  it('should have a parameter schema', () => {
    const schema = SpiderSkill.getParameterSchema();
    expect(schema['api_key']).toBeDefined();
  });
});
