/**
 * Individual tests for the WeatherApi skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { WeatherApiSkill, createWeatherApiSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('WeatherApiSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new WeatherApiSkill()).toBeInstanceOf(SkillBase);
    expect(createWeatherApiSkill()).toBeInstanceOf(WeatherApiSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new WeatherApiSkill().setup()).resolves.toBe(true);
  });

  it('should register a get_weather tool', () => {
    const tools = new WeatherApiSkill().getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_weather');
    expect(tools[0].required).toContain('location');
  });

  it('should provide prompt sections', () => {
    const sections = new WeatherApiSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Weather Information');
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new WeatherApiSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new WeatherApiSkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest with required env vars', () => {
    const manifest = new WeatherApiSkill().getManifest();
    expect(manifest.name).toBe('weather_api');
    expect(manifest.requiredEnvVars).toContain('WEATHER_API_KEY');
  });

  it('should return error when API key is missing', async () => {
    delete process.env['WEATHER_API_KEY'];
    const handler = new WeatherApiSkill().getTools()[0].handler;
    const result = await handler({ location: 'London' }, {}) as FunctionResult;
    expect(result.response).toContain('not configured');
  });

  it('should have a parameter schema with units', () => {
    const schema = WeatherApiSkill.getParameterSchema();
    expect(schema['units']).toBeDefined();
    expect(schema['api_key']).toBeDefined();
  });
});
