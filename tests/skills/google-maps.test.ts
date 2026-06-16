/**
 * Individual tests for the GoogleMaps skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GoogleMapsSkill, createGoogleMapsSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => {
  suppressAllLogs(true);
});

describe('GoogleMapsSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new GoogleMapsSkill()).toBeInstanceOf(SkillBase);
    expect(createGoogleMapsSkill()).toBeInstanceOf(GoogleMapsSkill);
  });

  it('should return false during setup when GOOGLE_MAPS_API_KEY is missing', async () => {
    delete process.env['GOOGLE_MAPS_API_KEY'];
    await expect(new GoogleMapsSkill().setup()).resolves.toBe(false);
  });

  it('should return true during setup when GOOGLE_MAPS_API_KEY is set', async () => {
    process.env['GOOGLE_MAPS_API_KEY'] = 'test-key';
    try {
      await expect(new GoogleMapsSkill().setup()).resolves.toBe(true);
    } finally {
      delete process.env['GOOGLE_MAPS_API_KEY'];
    }
  });

  it('should register exactly the two Python tools (lookup_address, compute_route)', () => {
    const tools = new GoogleMapsSkill().getTools();
    // Matches the Python reference exactly: only these two tools, no extras
    // (google_maps/skill.py registers lookup_address + compute_route).
    expect(tools.map((t) => t.name)).toEqual(['lookup_address', 'compute_route']);
    expect(tools[0].handler).toBeTypeOf('function');
    // compute_route takes 4 coordinate floats (not address strings).
    const routeParams = tools[1].parameters as Record<string, { type?: string }>;
    expect(Object.keys(routeParams)).toEqual(['origin_lat', 'origin_lng', 'dest_lat', 'dest_lng']);
    expect(routeParams['origin_lat'].type).toBe('number');
    // Python omits `required` on both tools → no required key on the wire.
    expect(tools[0].required).toBeUndefined();
    expect(tools[1].required).toBeUndefined();
  });

  it('should provide prompt sections', () => {
    const sections = new GoogleMapsSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new GoogleMapsSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return maps-related hints and empty global data', () => {
    const skill = new GoogleMapsSkill();
    expect(skill.getHints()).toEqual([
      'address',
      'location',
      'route',
      'directions',
      'miles',
      'distance',
    ]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest with required env vars', () => {
    const klass = GoogleMapsSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('google_maps');
    expect(klass.REQUIRED_ENV_VARS).toContain('GOOGLE_MAPS_API_KEY');
  });

  it('lookup_address errors when address is missing', async () => {
    delete process.env['GOOGLE_MAPS_API_KEY'];
    const lookup = new GoogleMapsSkill().getTools()[0].handler;
    const result = (await lookup({}, {})) as FunctionResult;
    expect(result.response.toLowerCase()).toContain('address');
  });

  it('compute_route errors when coordinates are missing', async () => {
    delete process.env['GOOGLE_MAPS_API_KEY'];
    const route = new GoogleMapsSkill().getTools()[1].handler;
    const result = (await route({}, {})) as FunctionResult;
    // Surfaces the four required coordinate names.
    expect(result.response.toLowerCase()).toContain('origin_lat');
  });

  it('should have a parameter schema', () => {
    const schema = GoogleMapsSkill.getParameterSchema();
    const apiKeyEntry = schema['api_key'];
    expect(apiKeyEntry).toBeDefined();
    // `api_key` must be a string param with the env_var hint set so the
    // skill can self-load credentials without explicit config.
    expect(apiKeyEntry.type).toBe('string');
    expect(apiKeyEntry.env_var).toBe('GOOGLE_MAPS_API_KEY');
  });
});
