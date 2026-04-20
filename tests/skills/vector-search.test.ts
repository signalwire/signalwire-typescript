/**
 * Individual tests for the NativeVectorSearch skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NativeVectorSearchSkill, createNativeVectorSearchSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('NativeVectorSearchSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new NativeVectorSearchSkill()).toBeInstanceOf(SkillBase);
    expect(createNativeVectorSearchSkill()).toBeInstanceOf(NativeVectorSearchSkill);
  });

  it('should return true from setup in local mode even without documents (Python parity)', async () => {
    // Python skills/native_vector_search/skill.py always returns True from
    // setup() for local mode even when no index is loaded. The "no results"
    // fallback fires at query time. This lets operators fix config and hot-
    // reload without having the SkillManager reject the skill entirely.
    const skill = new NativeVectorSearchSkill();
    await expect(skill.setup()).resolves.toBe(true);
    // searchAvailable still reports the honest state so handler callers see false.
  });

  it('should register a search tool using configured tool_name', async () => {
    const skill = new NativeVectorSearchSkill({
      tool_name: 'my_search',
      documents: [{ id: 'd1', text: 'hello world' }],
    });
    await skill.setup();
    const tools = skill.getTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('my_search');
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should default to search_knowledge tool name', async () => {
    const skill = new NativeVectorSearchSkill();
    await skill.setup();
    expect(skill.getTools()[0].name).toBe('search_knowledge');
  });

  it('should provide prompt sections', () => {
    const sections = new NativeVectorSearchSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new NativeVectorSearchSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return search hints', () => {
    const hints = new NativeVectorSearchSkill().getHints();
    expect(hints).toContain('search');
    expect(hints).toContain('knowledge base');
  });

  it('should include custom hints from config', () => {
    const skill = new NativeVectorSearchSkill({ hints: ['foo', 'bar'] });
    const hints = skill.getHints();
    expect(hints).toContain('foo');
    expect(hints).toContain('bar');
  });

  it('should return empty global data before indexing', () => {
    expect(new NativeVectorSearchSkill().getGlobalData()).toEqual({});
  });

  it('should include search_stats after indexing', async () => {
    const skill = new NativeVectorSearchSkill({
      documents: [{ id: 'd1', text: 'test document' }],
    });
    await skill.setup();
    const data = skill.getGlobalData();
    expect(data['search_stats']).toBeDefined();
  });

  it('should return correct manifest', () => {
    const manifest = new NativeVectorSearchSkill().getManifest();
    expect(manifest.name).toBe('native_vector_search');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should have a parameter schema with all expected keys', () => {
    const schema = NativeVectorSearchSkill.getParameterSchema();
    expect(schema['count']).toBeDefined();
    expect(schema['similarity_threshold']).toBeDefined();
    expect(schema['tags']).toBeDefined();
    expect(schema['global_tags']).toBeDefined();
    expect(schema['no_results_message']).toBeDefined();
    expect(schema['response_prefix']).toBeDefined();
    expect(schema['response_postfix']).toBeDefined();
    expect(schema['max_content_length']).toBeDefined();
    expect(schema['description']).toBeDefined();
    expect(schema['hints']).toBeDefined();
    expect(schema['verbose']).toBeDefined();
    expect(schema['remote_url']).toBeDefined();
    expect(schema['backend']).toBeDefined();
  });

  it('should support multiple instances with distinct keys', () => {
    expect(NativeVectorSearchSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
    const a = new NativeVectorSearchSkill({ tool_name: 'a', index_file: 'ia' });
    const b = new NativeVectorSearchSkill({ tool_name: 'b', index_file: 'ib' });
    expect(a.getInstanceKey()).not.toBe(b.getInstanceKey());
  });

  it('should return empty query error when query is missing', async () => {
    const skill = new NativeVectorSearchSkill({
      documents: [{ id: 'd1', text: 'hello world' }],
    });
    await skill.setup();
    const handler = skill.getTools()[0].handler;
    const res = (await handler({}, {})) as FunctionResult;
    expect(res.response).toMatch(/provide a search query/i);
  });

  it('should return search results for matching query', async () => {
    const skill = new NativeVectorSearchSkill({
      documents: [
        { id: 'doc1', text: 'The quick brown fox jumps over the lazy dog' },
        { id: 'doc2', text: 'Nothing related here' },
      ],
    });
    await skill.setup();
    const handler = skill.getTools()[0].handler;
    const res = (await handler({ query: 'fox' }, {})) as FunctionResult;
    expect(res.response).toContain('Result 1');
    expect(res.response).toContain('doc1');
  });
});
