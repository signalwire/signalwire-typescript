import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../src/skills/SkillRegistry.js';
import { registerBuiltinSkills } from '../src/skills/builtin/index.js';

describe('SkillRegistry Schema', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    SkillRegistry.resetInstance();
    registry = SkillRegistry.getInstance();
    registerBuiltinSkills();
  });

  it('getSkillSchema returns full schema for a registered skill', () => {
    const schema = registry.getSkillSchema('datetime');
    expect(schema).toBeDefined();
    expect(schema!.name).toBe('datetime');
    expect(schema!.description).toBeTruthy();
    expect(schema!.version).toBeTruthy();
    expect(schema!.supportsMultipleInstances).toBe(false);
    expect(schema!.parameters).toHaveProperty('swaig_fields');
    expect(schema!.parameters).toHaveProperty('skip_prompt');
  });

  it('getSkillSchema returns undefined for unregistered skill', () => {
    const schema = registry.getSkillSchema('nonexistent');
    expect(schema).toBeUndefined();
  });

  it('getAllSkillsSchema returns schemas for all 19 built-in skills', () => {
    const allSchemas = registry.getAllSkillsSchema();
    const names = Object.keys(allSchemas);
    expect(names.length).toBe(19);
    expect(names).toContain('datetime');
    expect(names).toContain('math');
    expect(names).toContain('joke');
    expect(names).toContain('weather_api');
    expect(names).toContain('datasphere');
    expect(names).toContain('native_vector_search');
    expect(names).toContain('claude_skills');
    expect(names).toContain('ask_claude');
    expect(names).toContain('mcp_gateway');
  });

  it('every schema entry has type and description', () => {
    const allSchemas = registry.getAllSkillsSchema();
    // Allowed JSON-Schema-style types every parameter entry must use.
    // A bare nullness check would pass for `{type: 0, description: false}`;
    // the enum membership + non-empty string check catches that.
    const validTypes = new Set([
      'string', 'integer', 'number', 'boolean', 'array', 'object',
    ]);
    for (const [skillName, schema] of Object.entries(allSchemas)) {
      for (const [paramName, entry] of Object.entries(schema.parameters)) {
        expect(
          validTypes.has(entry.type),
          `${skillName}.${paramName} has invalid type '${String(entry.type)}'`,
        ).toBe(true);
        expect(
          typeof entry.description === 'string' && entry.description.length > 0,
          `${skillName}.${paramName} missing or empty description`,
        ).toBe(true);
      }
    }
  });

  it('multi-instance skills report supportsMultipleInstances = true', () => {
    const allSchemas = registry.getAllSkillsSchema();
    expect(allSchemas['datasphere'].supportsMultipleInstances).toBe(true);
    expect(allSchemas['datasphere_serverless'].supportsMultipleInstances).toBe(true);
    expect(allSchemas['native_vector_search'].supportsMultipleInstances).toBe(true);
  });

  it('single-instance skills report supportsMultipleInstances = false', () => {
    const allSchemas = registry.getAllSkillsSchema();
    expect(allSchemas['datetime'].supportsMultipleInstances).toBe(false);
    expect(allSchemas['math'].supportsMultipleInstances).toBe(false);
    expect(allSchemas['weather_api'].supportsMultipleInstances).toBe(false);
  });

  it('listAllSkillSources groups skills by source', () => {
    const sources = registry.listAllSkillSources();
    expect(sources).toBeDefined();
    // All 19 should appear in some category
    const total = Object.values(sources).flat().length;
    expect(total).toBe(19);
  });

  it('weather_api schema includes api_key with hidden + env_var', () => {
    const schema = registry.getSkillSchema('weather_api');
    expect(schema).toBeDefined();
    expect(schema!.parameters).toHaveProperty('api_key');
    expect(schema!.parameters['api_key'].hidden).toBe(true);
    expect(schema!.parameters['api_key'].env_var).toBe('WEATHER_API_KEY');
  });
});
