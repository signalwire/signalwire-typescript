/**
 * Individual tests for the WikipediaSearch skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { WikipediaSearchSkill, createWikipediaSearchSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('WikipediaSearchSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new WikipediaSearchSkill()).toBeInstanceOf(SkillBase);
    expect(createWikipediaSearchSkill()).toBeInstanceOf(WikipediaSearchSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new WikipediaSearchSkill().setup()).resolves.toBeUndefined();
  });

  it('should register a search_wiki tool', () => {
    const tools = new WikipediaSearchSkill().getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_wiki');
    expect(tools[0].required).toContain('query');
  });

  it('should provide prompt sections', () => {
    const sections = new WikipediaSearchSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Wikipedia Search');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new WikipediaSearchSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new WikipediaSearchSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new WikipediaSearchSkill().getManifest();
    expect(manifest.name).toBe('wikipedia_search');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should reject empty query', async () => {
    const handler = new WikipediaSearchSkill().getTools()[0].handler;
    const result = await handler({ query: '' }, {}) as FunctionResult;
    expect(result.response).toContain('provide a search query');
  });

  it('should have a parameter schema', () => {
    const schema = WikipediaSearchSkill.getParameterSchema();
    expect(schema['num_results']).toBeDefined();
    expect(schema['no_results_message']).toBeDefined();
    expect(schema['language']).toBeDefined();
    expect(schema['max_content_length']).toBeDefined();
  });
});
