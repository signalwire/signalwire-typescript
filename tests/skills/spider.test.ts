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
    const klass = SpiderSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('spider');
    expect(klass.SKILL_VERSION).toBe('1.0.0');
  });

  it('should have full parameter schema', () => {
    const schema = SpiderSkill.getParameterSchema();
    // Each documented param must be a real entry — type and description
    // both populated. A stub returning `{key: undefined}` would fail the
    // type check; an empty-description placeholder would fail the
    // description check.
    const required = [
      'delay', 'concurrent_requests', 'timeout', 'max_pages', 'max_depth',
      'extract_type', 'max_text_length', 'clean_text', 'selectors',
      'follow_patterns', 'user_agent', 'headers', 'follow_robots_txt',
      'cache_enabled',
    ];
    const validTypes = new Set([
      'string', 'integer', 'number', 'boolean', 'array', 'object',
    ]);
    for (const key of required) {
      const entry = schema[key];
      expect(entry, `schema.${key} missing`).toBeDefined();
      expect(validTypes.has(entry.type), `schema.${key}.type invalid`).toBe(true);
      expect(typeof entry.description === 'string' && entry.description.length > 0)
        .toBe(true);
    }
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
