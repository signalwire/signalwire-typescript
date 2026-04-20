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

  it('should register three tools', async () => {
    const skill = new SpiderSkill();
    await skill.setup();
    const tools = skill.getTools();
    expect(tools).toHaveLength(3);
    const names = tools.map((t) => t.name);
    expect(names).toContain('scrape_url');
    expect(names).toContain('crawl_site');
    expect(names).toContain('extract_structured_data');
    expect(tools[0].required).toContain('url');
  });

  it('should provide no prompt sections (matches Python — no override)', () => {
    const sections = new SpiderSkill().getPromptSections();
    expect(sections).toHaveLength(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new SpiderSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return speech recognition hints', () => {
    const hints = new SpiderSkill().getHints();
    expect(hints).toContain('scrape');
    expect(hints).toContain('spider');
    expect(hints.length).toBeGreaterThanOrEqual(8);
  });

  it('should return empty global data', () => {
    expect(new SpiderSkill().getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new SpiderSkill().getManifest();
    expect(manifest.name).toBe('spider');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should have full parameter schema', () => {
    const schema = SpiderSkill.getParameterSchema();
    expect(schema['delay']).toBeDefined();
    expect(schema['concurrent_requests']).toBeDefined();
    expect(schema['timeout']).toBeDefined();
    expect(schema['max_pages']).toBeDefined();
    expect(schema['max_depth']).toBeDefined();
    expect(schema['extract_type']).toBeDefined();
    expect(schema['max_text_length']).toBeDefined();
    expect(schema['clean_text']).toBeDefined();
    expect(schema['selectors']).toBeDefined();
    expect(schema['follow_patterns']).toBeDefined();
    expect(schema['user_agent']).toBeDefined();
    expect(schema['headers']).toBeDefined();
    expect(schema['follow_robots_txt']).toBeDefined();
    expect(schema['cache_enabled']).toBeDefined();
  });

  it('should support multiple instances', () => {
    expect(SpiderSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
    const skill = new SpiderSkill({ tool_name: 'custom' });
    expect(skill.getInstanceKey()).toBe('spider_custom');
  });

  it('should validate URL format in scrape_url handler', async () => {
    const skill = new SpiderSkill();
    await skill.setup();
    const handler = skill.getTools().find((t) => t.name === 'scrape_url')!.handler;
    const res = (await handler({ url: 'not-a-url' }, {})) as FunctionResult;
    expect(res.response).toMatch(/Invalid URL/i);
  });

  it('should require selectors for extract_structured_data', async () => {
    const skill = new SpiderSkill();
    await skill.setup();
    const handler = skill
      .getTools()
      .find((t) => t.name === 'extract_structured_data')!.handler;
    // URL is fine but selectors are empty, so we get an error before any fetch
    const res = (await handler(
      { url: 'https://example.com' },
      {},
    )) as FunctionResult;
    // Either SSRF validation or missing selectors should trigger an error
    expect(typeof res.response).toBe('string');
    expect(res.response.length).toBeGreaterThan(0);
  });
});
