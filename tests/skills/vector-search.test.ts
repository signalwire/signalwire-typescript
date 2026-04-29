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
    // search_stats must be a structured object recording the indexed
    // document count, not a stub flag. We assert the count reflects the
    // single document we indexed so a stub returning `{}` would fail.
    const stats = data['search_stats'] as Record<string, unknown> | undefined;
    expect(stats, 'search_stats missing').toBeDefined();
    expect(typeof stats).toBe('object');
    expect(stats!['doc_count']).toBe(1);
  });

  it('should return correct manifest', () => {
    const klass = NativeVectorSearchSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('native_vector_search');
    expect(klass.SKILL_VERSION).toBe('1.0.0');
  });

  it('should have a parameter schema with all expected keys', () => {
    const schema = NativeVectorSearchSkill.getParameterSchema();
    // Each documented param must be a real entry. Type and description
    // both populated. A stub returning `{key: undefined}` would fail.
    const required = [
      'count', 'similarity_threshold', 'tags', 'global_tags',
      'no_results_message', 'response_prefix', 'response_postfix',
      'max_content_length', 'description', 'hints', 'verbose',
      'remote_url', 'backend',
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
