/**
 * Individual tests for the WebSearch skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { WebSearchSkill, createWebSearchSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('WebSearchSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new WebSearchSkill()).toBeInstanceOf(SkillBase);
    expect(createWebSearchSkill()).toBeInstanceOf(WebSearchSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new WebSearchSkill().setup()).resolves.toBe(true);
  });

  it('should register a web_search tool', () => {
    const tools = new WebSearchSkill().getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('web_search');
    expect(tools[0].required).toContain('query');
  });

  it('should provide prompt sections', () => {
    const sections = new WebSearchSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Web Search');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new WebSearchSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new WebSearchSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest with required env vars', () => {
    const manifest = new WebSearchSkill().getManifest();
    expect(manifest.name).toBe('web_search');
    expect(manifest.requiredEnvVars).toContain('GOOGLE_SEARCH_API_KEY');
    expect(manifest.requiredEnvVars).toContain('GOOGLE_SEARCH_CX');
  });

  it('should return error when API keys are missing', async () => {
    delete process.env['GOOGLE_SEARCH_API_KEY'];
    delete process.env['GOOGLE_SEARCH_CX'];
    const handler = new WebSearchSkill().getTools()[0].handler;
    const result = await handler({ query: 'test' }, {}) as FunctionResult;
    expect(result.response).toContain('not configured');
  });

  it('should reject empty query', async () => {
    const handler = new WebSearchSkill().getTools()[0].handler;
    const result = await handler({ query: '' }, {}) as FunctionResult;
    expect(result.response).toContain('provide a search query');
  });

  it('should have a parameter schema', () => {
    const schema = WebSearchSkill.getParameterSchema();
    expect(schema['max_results']).toBeDefined();
    expect(schema['safe_search']).toBeDefined();
  });
});
