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

  it('should return false from setup() when credentials are missing', async () => {
    delete process.env['GOOGLE_SEARCH_API_KEY'];
    delete process.env['GOOGLE_SEARCH_ENGINE_ID'];
    delete process.env['GOOGLE_SEARCH_CX'];
    await expect(new WebSearchSkill().setup()).resolves.toBe(false);
  });

  it('should return true from setup() when credentials are provided via config', async () => {
    const skill = new WebSearchSkill({ api_key: 'test-key', search_engine_id: 'test-cx' });
    await expect(skill.setup()).resolves.toBe(true);
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
    expect(sections[0].title).toContain('Web Search');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new WebSearchSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints', () => {
    const skill = new WebSearchSkill();
    expect(skill.getHints()).toEqual([]);
  });

  it('should expose web search metadata via global data', () => {
    const globalData = new WebSearchSkill().getGlobalData();
    expect(globalData['web_search_enabled']).toBe(true);
    expect(globalData['search_provider']).toBe('Google Custom Search');
  });

  it('should return correct manifest with required env vars', () => {
    const klass = WebSearchSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('web_search');
    expect(klass.SKILL_VERSION).toBe('2.0.0');
    // Python REQUIRED_ENV_VARS = []: credentials come from either config
    // params or env vars, so the manifest's env-var requirement is empty.
    expect(klass.REQUIRED_ENV_VARS).toEqual([]);
  });

  it('should return error when API keys are missing', async () => {
    delete process.env['GOOGLE_SEARCH_API_KEY'];
    delete process.env['GOOGLE_SEARCH_ENGINE_ID'];
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

  it('should support multiple instances', () => {
    expect(WebSearchSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
  });

  it('should compute instance key from search_engine_id and tool_name', () => {
    const skill = new WebSearchSkill({ search_engine_id: 'cx-1', tool_name: 'custom' });
    expect(skill.getInstanceKey()).toBe('web_search_cx-1_custom');
  });

  it('should have a parameter schema', () => {
    const schema = WebSearchSkill.getParameterSchema();
    expect(schema['num_results']).toBeDefined();
    expect(schema['tool_name']).toBeDefined();
    expect(schema['no_results_message']).toBeDefined();
    expect(schema['safe_search']).toBeDefined();
    expect(schema['delay']).toBeDefined();
    expect(schema['max_content_length']).toBeDefined();
    expect(schema['oversample_factor']).toBeDefined();
    expect(schema['min_quality_score']).toBeDefined();
  });
});
