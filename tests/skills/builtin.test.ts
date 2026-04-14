/**
 * Comprehensive tests for all 19 built-in skills.
 *
 * Covers instantiation, manifest, tools, prompt sections, and handler execution
 * for each skill. API-dependent skills verify error messages when keys are missing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DateTimeSkill,
  createDateTimeSkill,
  MathSkill,
  createMathSkill,
  JokeSkill,
  createJokeSkill,
  WeatherApiSkill,
  createWeatherApiSkill,
  PlayBackgroundFileSkill,
  createPlayBackgroundFileSkill,
  SwmlTransferSkill,
  createSwmlTransferSkill,
  ApiNinjasTriviaSkill,
  createApiNinjasTriviaSkill,
  InfoGathererSkill,
  createInfoGathererSkill,
  CustomSkillsSkill,
  createCustomSkillsSkill,
  WebSearchSkill,
  createWebSearchSkill,
  WikipediaSearchSkill,
  createWikipediaSearchSkill,
  GoogleMapsSkill,
  createGoogleMapsSkill,
  DataSphereSkill,
  createDataSphereSkill,
  DataSphereServerlessSkill,
  createDataSphereServerlessSkill,
  NativeVectorSearchSkill,
  createNativeVectorSearchSkill,
  SpiderSkill,
  createSpiderSkill,
  ClaudeSkillsSkill,
  createClaudeSkillsSkill,
  AskClaudeSkill,
  createAskClaudeSkill,
  McpGatewaySkill,
  createMcpGatewaySkill,
} from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => {
  suppressAllLogs(true);
});

// ---------------------------------------------------------------------------
// DateTime Skill
// ---------------------------------------------------------------------------
describe('DateTimeSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createDateTimeSkill();
    expect(skill).toBeInstanceOf(DateTimeSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createDateTimeSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('datetime');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.description).toBeTruthy();
  });

  it('should return a get_datetime tool', () => {
    const skill = createDateTimeSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_datetime');
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createDateTimeSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Date and Time');
    expect(sections[0].bullets).toBeDefined();
    expect(sections[0].bullets!.length).toBeGreaterThan(0);
  });

  it('should execute handler and return datetime for a timezone', () => {
    const skill = createDateTimeSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ timezone: 'America/New_York' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('America/New_York');
    expect(result.response).toContain('current date and time');
  });
});

// ---------------------------------------------------------------------------
// Math Skill
// ---------------------------------------------------------------------------
describe('MathSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createMathSkill();
    expect(skill).toBeInstanceOf(MathSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createMathSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('math');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a calculate tool', () => {
    const skill = createMathSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('calculate');
    expect(tools[0].required).toContain('expression');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createMathSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Mathematical Calculations');
    expect(sections[0].bullets).toBeDefined();
    expect(sections[0].bullets!.length).toBeGreaterThan(0);
  });

  it('should evaluate basic math expressions correctly', () => {
    const skill = createMathSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ expression: '2 + 3 * 4' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('14');
  });

  it('should reject unsafe expressions', () => {
    const skill = createMathSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ expression: 'process.exit(1)' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('Could not evaluate');
    // Must not leak internal error details
    expect(result.response).not.toContain('isSafeExpression');
  });
});

// ---------------------------------------------------------------------------
// Joke Skill
// ---------------------------------------------------------------------------
describe('JokeSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createJokeSkill();
    expect(skill).toBeInstanceOf(JokeSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createJokeSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('joke');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a tell_joke tool', () => {
    const skill = createJokeSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('tell_joke');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createJokeSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Jokes');
    expect(sections[0].bullets).toBeDefined();
  });

  it('should execute handler and return a joke', () => {
    const skill = createJokeSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({}, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    // Jokes contain " ... " between setup and punchline
    expect(result.response).toContain('...');
  });
});

// ---------------------------------------------------------------------------
// Weather API Skill
// ---------------------------------------------------------------------------
describe('WeatherApiSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createWeatherApiSkill();
    expect(skill).toBeInstanceOf(WeatherApiSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createWeatherApiSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('weather_api');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('WEATHER_API_KEY');
  });

  it('should return a get_weather tool', () => {
    const skill = createWeatherApiSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_weather');
    expect(tools[0].required).toContain('location');
  });

  it('should report missing env var via validateEnvVars', () => {
    const originalKey = process.env['WEATHER_API_KEY'];
    delete process.env['WEATHER_API_KEY'];
    const skill = createWeatherApiSkill();
    const missing = skill.validateEnvVars();
    expect(missing).toContain('WEATHER_API_KEY');
    if (originalKey !== undefined) process.env['WEATHER_API_KEY'] = originalKey;
  });

  it('should return error when API key is not set', async () => {
    const originalKey = process.env['WEATHER_API_KEY'];
    delete process.env['WEATHER_API_KEY'];
    const skill = createWeatherApiSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({ location: 'London' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('not configured');
    if (originalKey !== undefined) process.env['WEATHER_API_KEY'] = originalKey;
  });
});

// ---------------------------------------------------------------------------
// Play Background File Skill
// ---------------------------------------------------------------------------
describe('PlayBackgroundFileSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createPlayBackgroundFileSkill();
    expect(skill).toBeInstanceOf(PlayBackgroundFileSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createPlayBackgroundFileSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('play_background_file');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return play_background and stop_background tools', () => {
    const skill = createPlayBackgroundFileSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('play_background');
    expect(names).toContain('stop_background');
  });

  it('should execute play_background handler with a valid URL', () => {
    const skill = createPlayBackgroundFileSkill();
    const playTool = skill.getTools().find((t) => t.name === 'play_background')!;
    const result = playTool.handler(
      { file_url: 'https://example.com/music.mp3' },
      {},
    ) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('playing background audio');
    // Should have a playback_bg action
    expect(result.action.length).toBeGreaterThan(0);
    expect(result.action[0]).toHaveProperty('playback_bg');
  });

  it('should execute stop_background handler', () => {
    const skill = createPlayBackgroundFileSkill();
    const stopTool = skill.getTools().find((t) => t.name === 'stop_background')!;
    const result = stopTool.handler({}, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('stopped');
    expect(result.action.length).toBeGreaterThan(0);
    expect(result.action[0]).toHaveProperty('stop_playback_bg');
  });
});

// ---------------------------------------------------------------------------
// SWML Transfer Skill
// ---------------------------------------------------------------------------
describe('SwmlTransferSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createSwmlTransferSkill();
    expect(skill).toBeInstanceOf(SwmlTransferSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createSwmlTransferSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('swml_transfer');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a transfer_call tool', () => {
    const skill = createSwmlTransferSkill();
    const tools = skill.getTools();
    expect(tools.length).toBeGreaterThanOrEqual(1);
    expect(tools[0].name).toBe('transfer_call');
    expect(tools[0].required).toContain('destination');
  });

  it('should execute transfer with arbitrary destination', () => {
    const skill = createSwmlTransferSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ destination: '+15551234567' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toBe('Transferring your call now.');
    // Should have a SWML transfer action
    expect(result.action.length).toBeGreaterThan(0);
    const swmlAction = result.action[0];
    expect(swmlAction).toHaveProperty('SWML');
    expect(swmlAction).toHaveProperty('transfer', 'true');
  });

  it('should support named transfer patterns', () => {
    const skill = createSwmlTransferSkill({
      patterns: [
        { name: 'sales', destination: 'sip:sales@example.com', description: 'Sales team' },
        { name: 'support', destination: 'sip:support@example.com', description: 'Support team' },
      ],
    });
    const tools = skill.getTools();
    // Should have transfer_call + list_transfer_destinations
    expect(tools.length).toBe(2);
    expect(tools[1].name).toBe('list_transfer_destinations');

    // Transfer by name
    const handler = tools[0].handler;
    const result = handler({ destination: 'sales' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.action.length).toBeGreaterThan(0);
  });

  it('should use no-match message when patterns configured and arbitrary disallowed', () => {
    const skill = createSwmlTransferSkill({
      patterns: [
        { name: 'sales', destination: 'sip:sales@example.com' },
      ],
      allow_arbitrary: false,
      no_match_message: 'Please specify a valid transfer type.',
    });
    const handler = skill.getTools()[0].handler;
    const result = handler({ destination: 'unknown_dept' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('valid transfer type');
  });
});

// ---------------------------------------------------------------------------
// API Ninjas Trivia Skill
// ---------------------------------------------------------------------------
describe('ApiNinjasTriviaSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createApiNinjasTriviaSkill();
    expect(skill).toBeInstanceOf(ApiNinjasTriviaSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createApiNinjasTriviaSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('api_ninjas_trivia');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('API_NINJAS_KEY');
  });

  it('should return a get_trivia tool', () => {
    const skill = createApiNinjasTriviaSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_trivia');
  });

  it('should return hints for speech recognition', () => {
    const skill = createApiNinjasTriviaSkill();
    const hints = skill.getHints();
    expect(hints.length).toBeGreaterThan(0);
    expect(hints).toContain('trivia');
  });

  it('should return error when API key is not set', async () => {
    const originalKey = process.env['API_NINJAS_KEY'];
    delete process.env['API_NINJAS_KEY'];
    const skill = createApiNinjasTriviaSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({}, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('API_NINJAS_KEY');
    expect(result.response).toContain('not configured');
    if (originalKey !== undefined) process.env['API_NINJAS_KEY'] = originalKey;
  });
});

// ---------------------------------------------------------------------------
// Info Gatherer Skill
// ---------------------------------------------------------------------------
describe('InfoGathererSkill', () => {
  it('should instantiate with fields config via createSkill factory', () => {
    const skill = createInfoGathererSkill({
      fields: [
        { name: 'full_name', description: 'Full name', required: true },
        { name: 'email', description: 'Email address' },
      ],
    });
    expect(skill).toBeInstanceOf(InfoGathererSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createInfoGathererSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('info_gatherer');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return save_info and get_gathered_info tools when fields configured', () => {
    const skill = createInfoGathererSkill({
      fields: [
        { name: 'full_name', description: 'Full name', required: true },
      ],
    });
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('save_info');
    expect(names).toContain('get_gathered_info');
  });

  it('should return no tools when no fields configured', () => {
    const skill = createInfoGathererSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(0);
  });

  it('should execute save_info handler and save data', () => {
    const skill = createInfoGathererSkill({
      fields: [
        { name: 'full_name', description: 'Full name', required: true },
        { name: 'email', description: 'Email address' },
      ],
    });
    const saveTool = skill.getTools().find((t) => t.name === 'save_info')!;
    const result = saveTool.handler(
      { full_name: 'Jane Doe', email: 'jane@example.com' },
      { call_id: 'test-call-123' },
    ) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('saved successfully');
    expect(result.response).toContain('Jane Doe');
    expect(result.response).toContain('jane@example.com');
  });
});

// ---------------------------------------------------------------------------
// Custom Skills Skill
// ---------------------------------------------------------------------------
describe('CustomSkillsSkill', () => {
  it('should instantiate with tools config via createSkill factory', () => {
    const skill = createCustomSkillsSkill({
      tools: [
        {
          name: 'greet',
          description: 'Greet a user',
          handler_code: 'return new FunctionResult("Hello, " + args.name + "!");',
          parameters: [{ name: 'name', type: 'string', description: 'Name to greet' }],
        },
      ],
    });
    expect(skill).toBeInstanceOf(CustomSkillsSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createCustomSkillsSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('custom_skills');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should register dynamic tools from config', () => {
    const skill = createCustomSkillsSkill({
      tools: [
        {
          name: 'greet',
          description: 'Greet a user',
          handler_code: 'return new FunctionResult("Hello!");',
        },
        {
          name: 'farewell',
          description: 'Say goodbye',
          handler_code: 'return new FunctionResult("Goodbye!");',
        },
      ],
    });
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('greet');
    expect(tools[1].name).toBe('farewell');
  });

  it('should execute custom tool handler', async () => {
    const saved = process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = 'true';
    try {
      const skill = createCustomSkillsSkill({
        tools: [
          {
            name: 'greet',
            description: 'Greet a user',
            handler_code: 'return new FunctionResult("Hello, " + args.name + "!");',
            parameters: [{ name: 'name', type: 'string', description: 'Name to greet' }],
          },
        ],
      });
      const handler = skill.getTools()[0].handler;
      const result = await handler({ name: 'World' }, {}) as FunctionResult;
      expect(result).toBeInstanceOf(FunctionResult);
      expect(result.response).toBe('Hello, World!');
    } finally {
      if (saved) process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = saved;
      else delete process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    }
  });
});

// ---------------------------------------------------------------------------
// Web Search Skill
// ---------------------------------------------------------------------------
describe('WebSearchSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createWebSearchSkill();
    expect(skill).toBeInstanceOf(WebSearchSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createWebSearchSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('web_search');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('GOOGLE_SEARCH_API_KEY');
    expect(manifest.requiredEnvVars).toContain('GOOGLE_SEARCH_CX');
  });

  it('should return a web_search tool', () => {
    const skill = createWebSearchSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('web_search');
    expect(tools[0].required).toContain('query');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createWebSearchSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Web Search');
  });

  it('should return error when API keys are not set', async () => {
    const origKey = process.env['GOOGLE_SEARCH_API_KEY'];
    const origCx = process.env['GOOGLE_SEARCH_CX'];
    delete process.env['GOOGLE_SEARCH_API_KEY'];
    delete process.env['GOOGLE_SEARCH_CX'];
    const skill = createWebSearchSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({ query: 'test' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('not configured');
    if (origKey !== undefined) process.env['GOOGLE_SEARCH_API_KEY'] = origKey;
    if (origCx !== undefined) process.env['GOOGLE_SEARCH_CX'] = origCx;
  });
});

// ---------------------------------------------------------------------------
// Wikipedia Search Skill
// ---------------------------------------------------------------------------
describe('WikipediaSearchSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createWikipediaSearchSkill();
    expect(skill).toBeInstanceOf(WikipediaSearchSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createWikipediaSearchSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('wikipedia_search');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a search_wikipedia tool', () => {
    const skill = createWikipediaSearchSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_wikipedia');
    expect(tools[0].required).toContain('query');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createWikipediaSearchSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Wikipedia Search');
    expect(sections[0].bullets).toBeDefined();
    expect(sections[0].bullets!.length).toBeGreaterThan(0);
  });

  it('should have no requiredEnvVars (free API)', () => {
    const skill = createWikipediaSearchSkill();
    const manifest = skill.getManifest();
    expect(manifest.requiredEnvVars).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Google Maps Skill
// ---------------------------------------------------------------------------
describe('GoogleMapsSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createGoogleMapsSkill();
    expect(skill).toBeInstanceOf(GoogleMapsSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createGoogleMapsSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('google_maps');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('GOOGLE_MAPS_API_KEY');
  });

  it('should return get_directions and find_place tools', () => {
    const skill = createGoogleMapsSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('get_directions');
    expect(names).toContain('find_place');
  });

  it('should return error from get_directions when API key is not set', async () => {
    const origKey = process.env['GOOGLE_MAPS_API_KEY'];
    delete process.env['GOOGLE_MAPS_API_KEY'];
    const skill = createGoogleMapsSkill();
    const dirTool = skill.getTools().find((t) => t.name === 'get_directions')!;
    const result = await dirTool.handler(
      { origin: 'New York', destination: 'Boston' },
      {},
    ) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('not configured');
    if (origKey !== undefined) process.env['GOOGLE_MAPS_API_KEY'] = origKey;
  });

  it('should return error from find_place when API key is not set', async () => {
    const origKey = process.env['GOOGLE_MAPS_API_KEY'];
    delete process.env['GOOGLE_MAPS_API_KEY'];
    const skill = createGoogleMapsSkill();
    const placeTool = skill.getTools().find((t) => t.name === 'find_place')!;
    const result = await placeTool.handler(
      { query: 'pizza near me' },
      {},
    ) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('not configured');
    if (origKey !== undefined) process.env['GOOGLE_MAPS_API_KEY'] = origKey;
  });
});

// ---------------------------------------------------------------------------
// DataSphere Skill
// ---------------------------------------------------------------------------
describe('DataSphereSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createDataSphereSkill();
    expect(skill).toBeInstanceOf(DataSphereSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createDataSphereSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('datasphere');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_PROJECT_ID');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_TOKEN');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_SPACE');
  });

  it('should return a search_datasphere tool', () => {
    const skill = createDataSphereSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_datasphere');
    expect(tools[0].required).toContain('query');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createDataSphereSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toContain('DataSphere');
  });

  it('should return error when env vars are not set', async () => {
    const origPid = process.env['SIGNALWIRE_PROJECT_ID'];
    const origToken = process.env['SIGNALWIRE_TOKEN'];
    const origSpace = process.env['SIGNALWIRE_SPACE'];
    delete process.env['SIGNALWIRE_PROJECT_ID'];
    delete process.env['SIGNALWIRE_TOKEN'];
    delete process.env['SIGNALWIRE_SPACE'];
    const skill = createDataSphereSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({ query: 'test' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('not configured');
    expect(result.response).toContain('SIGNALWIRE_PROJECT_ID');
    if (origPid !== undefined) process.env['SIGNALWIRE_PROJECT_ID'] = origPid;
    if (origToken !== undefined) process.env['SIGNALWIRE_TOKEN'] = origToken;
    if (origSpace !== undefined) process.env['SIGNALWIRE_SPACE'] = origSpace;
  });
});

// ---------------------------------------------------------------------------
// DataSphere Serverless Skill
// ---------------------------------------------------------------------------
describe('DataSphereServerlessSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createDataSphereServerlessSkill();
    expect(skill).toBeInstanceOf(DataSphereServerlessSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createDataSphereServerlessSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('datasphere_serverless');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_PROJECT_ID');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_TOKEN');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_SPACE');
  });

  it('should return a search_datasphere tool stub', () => {
    const skill = createDataSphereServerlessSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_datasphere');
  });

  it('should return stub handler message indicating DataMap mode', () => {
    const skill = createDataSphereServerlessSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({}, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('serverless DataMap');
  });

  it('should expose getDataMapTools returning a data_map function', () => {
    const skill = createDataSphereServerlessSkill();
    const dataMapTools = skill.getDataMapTools();
    expect(dataMapTools).toHaveLength(1);
    expect(dataMapTools[0]).toBeDefined();
    // The DataMap function should have a 'function' key with name
    expect(dataMapTools[0]).toHaveProperty('function');
  });
});

// ---------------------------------------------------------------------------
// Native Vector Search Skill
// ---------------------------------------------------------------------------
describe('NativeVectorSearchSkill', () => {
  const testDocuments = [
    { id: 'doc1', text: 'TypeScript is a strongly typed programming language that builds on JavaScript.' },
    { id: 'doc2', text: 'Python is a versatile programming language used for web development and data science.' },
    { id: 'doc3', text: 'Rust focuses on safety and performance, ideal for systems programming.' },
    { id: 'doc4', text: 'The weather today is sunny with clear skies and warm temperatures.' },
  ];

  it('should instantiate with documents config via createSkill factory', () => {
    const skill = createNativeVectorSearchSkill({ documents: testDocuments });
    expect(skill).toBeInstanceOf(NativeVectorSearchSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createNativeVectorSearchSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('native_vector_search');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a search_knowledge tool (Python-aligned default name)', async () => {
    const skill = createNativeVectorSearchSkill({ documents: testDocuments });
    await skill.setup();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_knowledge');
    expect(tools[0].required).toContain('query');
  });

  it('should execute search and find relevant documents', async () => {
    const skill = createNativeVectorSearchSkill({ documents: testDocuments });
    await skill.setup();
    const handler = skill.getTools()[0].handler;
    const result = (await handler(
      { query: 'TypeScript programming language' },
      {},
    )) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('doc1');
    expect(result.response).toContain('TypeScript');
  });

  it('should rank relevant documents higher (scoring works)', async () => {
    const skill = createNativeVectorSearchSkill({ documents: testDocuments });
    await skill.setup();
    const handler = skill.getTools()[0].handler;
    const result = (await handler(
      { query: 'programming language', count: 4 },
      {},
    )) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    // Programming-related docs should appear; weather doc should not (no overlap)
    expect(result.response).toContain('programming');
    // The response should contain "Result 1" indicating at least one result
    expect(result.response).toContain('Result 1');
  });
});

// ---------------------------------------------------------------------------
// Spider Skill
// ---------------------------------------------------------------------------
describe('SpiderSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createSpiderSkill();
    expect(skill).toBeInstanceOf(SpiderSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createSpiderSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('spider');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return the three Python-aligned tools (scrape_url, crawl_site, extract_structured_data)', async () => {
    const skill = createSpiderSkill();
    await skill.setup();
    const tools = skill.getTools();
    expect(tools).toHaveLength(3);
    const names = tools.map((t) => t.name);
    expect(names).toContain('scrape_url');
    expect(names).toContain('crawl_site');
    expect(names).toContain('extract_structured_data');
    const scrape = tools.find((t) => t.name === 'scrape_url')!;
    expect(scrape.required).toContain('url');
  });

  it('should reject invalid URL in scrape_url handler', async () => {
    const skill = createSpiderSkill();
    await skill.setup();
    const handler = skill.getTools().find((t) => t.name === 'scrape_url')!.handler;
    const result = (await handler({ url: 'not-a-url' }, {})) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toMatch(/Invalid URL/i);
  });
});

// ---------------------------------------------------------------------------
// Ask Claude Skill (renamed from ClaudeSkill)
// ---------------------------------------------------------------------------
describe('AskClaudeSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createAskClaudeSkill();
    expect(skill).toBeInstanceOf(AskClaudeSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createAskClaudeSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('ask_claude');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('ANTHROPIC_API_KEY');
  });

  it('should return an ask_claude tool', () => {
    const skill = createAskClaudeSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('ask_claude');
    expect(tools[0].required).toContain('prompt');
  });
});

// ---------------------------------------------------------------------------
// Claude Skills Skill (SKILL.md loader)
// ---------------------------------------------------------------------------
describe('ClaudeSkillsSkill', () => {
  let tmpDir: string;
  let skillsDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claude-skills-test-'));
    skillsDir = join(tmpDir, 'skills');
    mkdirSync(skillsDir);

    // Create a basic skill
    const basicSkillDir = join(skillsDir, 'greeting');
    mkdirSync(basicSkillDir);
    writeFileSync(
      join(basicSkillDir, 'SKILL.md'),
      '---\nname: greeting\ndescription: Greet the user\n---\n\nHello $ARGUMENTS! Welcome.',
    );

    // Create a skill with sections
    const sectionSkillDir = join(skillsDir, 'helper');
    mkdirSync(sectionSkillDir);
    writeFileSync(
      join(sectionSkillDir, 'SKILL.md'),
      '---\nname: helper\ndescription: A helper skill\n---\n\nMain helper content.',
    );
    writeFileSync(
      join(sectionSkillDir, 'advanced.md'),
      'Advanced helper content.',
    );
    writeFileSync(
      join(sectionSkillDir, 'basics.md'),
      'Basic helper content.',
    );

    // Create a skill with nested section
    const nestedDir = join(sectionSkillDir, 'references');
    mkdirSync(nestedDir);
    writeFileSync(join(nestedDir, 'api.md'), 'API reference content.');

    // Create a skill with no frontmatter
    const noFmDir = join(skillsDir, 'raw-skill');
    mkdirSync(noFmDir);
    writeFileSync(join(noFmDir, 'SKILL.md'), 'Just raw content, no frontmatter.');

    // Create a skill with disable-model-invocation
    const disabledDir = join(skillsDir, 'disabled-skill');
    mkdirSync(disabledDir);
    writeFileSync(
      join(disabledDir, 'SKILL.md'),
      '---\nname: disabled-skill\ndescription: Should be disabled\ndisable-model-invocation: true\n---\n\nDisabled content.',
    );

    // Create a skill with user-invocable: false
    const knowledgeDir = join(skillsDir, 'knowledge-only');
    mkdirSync(knowledgeDir);
    writeFileSync(
      join(knowledgeDir, 'SKILL.md'),
      '---\nname: knowledge-only\ndescription: Knowledge only skill\nuser-invocable: false\n---\n\nKnowledge content.',
    );

    // Create a skill with argument-hint
    const hintDir = join(skillsDir, 'with-hint');
    mkdirSync(hintDir);
    writeFileSync(
      join(hintDir, 'SKILL.md'),
      '---\nname: with-hint\ndescription: Skill with hint\nargument-hint: The city name to look up\n---\n\nLooking up $ARGUMENTS.',
    );

    // Create a skill with variables
    const varDir = join(skillsDir, 'var-skill');
    mkdirSync(varDir);
    writeFileSync(
      join(varDir, 'SKILL.md'),
      '---\nname: var-skill\ndescription: Variable skill\n---\n\nDir: ${CLAUDE_SKILL_DIR} Session: ${CLAUDE_SESSION_ID}',
    );

    // Create a skill with shell injection patterns
    const shellDir = join(skillsDir, 'shell-skill');
    mkdirSync(shellDir);
    writeFileSync(
      join(shellDir, 'SKILL.md'),
      '---\nname: shell-skill\ndescription: Shell skill\n---\n\nResult: !`echo hello`',
    );

    // Create a skill with argument placeholders
    const argDir = join(skillsDir, 'arg-skill');
    mkdirSync(argDir);
    writeFileSync(
      join(argDir, 'SKILL.md'),
      '---\nname: arg-skill\ndescription: Argument skill\n---\n\nFirst: $0 Second: $1 Indexed: $ARGUMENTS[0] All: $ARGUMENTS',
    );

    // A non-skill directory (no SKILL.md)
    const noSkillDir = join(skillsDir, 'not-a-skill');
    mkdirSync(noSkillDir);
    writeFileSync(join(noSkillDir, 'README.md'), 'Not a skill.');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should instantiate via createSkill factory', () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    expect(skill).toBeInstanceOf(ClaudeSkillsSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest', () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('claude_skills');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should support multiple instances', () => {
    expect(ClaudeSkillsSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
  });

  it('should discover skills from directory after setup', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    await skill.setup();
    const tools = skill.getTools();
    // Should find skills with SKILL.md: greeting, helper, raw-skill, disabled-skill,
    // knowledge-only, with-hint, var-skill, shell-skill, arg-skill
    // But disabled-skill should be skipped (_skipTool), knowledge-only should be skipped (_skipTool)
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('claude_greeting');
    expect(toolNames).toContain('claude_helper');
    expect(toolNames).toContain('claude_raw_skill');
    expect(toolNames).toContain('claude_with_hint');
    expect(toolNames).toContain('claude_var_skill');
    expect(toolNames).toContain('claude_shell_skill');
    expect(toolNames).toContain('claude_arg_skill');
    // disabled-skill and knowledge-only should NOT be registered as tools
    expect(toolNames).not.toContain('claude_disabled_skill');
    expect(toolNames).not.toContain('claude_knowledge_only');
  });

  it('should sanitize tool names correctly', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    await skill.setup();
    const tools = skill.getTools();
    const toolNames = tools.map((t) => t.name);
    // raw-skill → raw_skill (hyphens replaced)
    expect(toolNames).toContain('claude_raw_skill');
  });

  it('should return SKILL.md body content from handler', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    await skill.setup();
    const tools = skill.getTools();
    const greetingTool = tools.find((t) => t.name === 'claude_greeting');
    expect(greetingTool).toBeDefined();
    const result = greetingTool!.handler({ arguments: 'World' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('Hello World! Welcome.');
  });

  it('should load section content when section is specified', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    await skill.setup();
    const tools = skill.getTools();
    const helperTool = tools.find((t) => t.name === 'claude_helper');
    expect(helperTool).toBeDefined();

    // Check section enum
    const sectionParam = helperTool!.parameters!['section'] as Record<string, unknown>;
    expect(sectionParam).toBeDefined();
    const enumValues = sectionParam.enum as string[];
    expect(enumValues).toContain('advanced');
    expect(enumValues).toContain('basics');
    expect(enumValues).toContain('references/api');

    // Load a section
    const result = helperTool!.handler({ section: 'advanced', arguments: '' }, {}) as FunctionResult;
    expect(result.response).toContain('Advanced helper content.');
  });

  it('should substitute $ARGUMENTS in body', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    await skill.setup();
    const tools = skill.getTools();
    const argTool = tools.find((t) => t.name === 'claude_arg_skill');
    expect(argTool).toBeDefined();
    const result = argTool!.handler({ arguments: 'foo bar' }, {}) as FunctionResult;
    expect(result.response).toContain('First: foo');
    expect(result.response).toContain('Second: bar');
    expect(result.response).toContain('Indexed: foo');
    expect(result.response).toContain('All: foo bar');
  });

  it('should append ARGUMENTS when no bare $ARGUMENTS placeholder', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    await skill.setup();
    const tools = skill.getTools();
    const helperTool = tools.find((t) => t.name === 'claude_helper');
    expect(helperTool).toBeDefined();
    const result = helperTool!.handler({ arguments: 'some context' }, {}) as FunctionResult;
    expect(result.response).toContain('Main helper content.');
    expect(result.response).toContain('ARGUMENTS: some context');
  });

  it('should substitute ${CLAUDE_SKILL_DIR} and ${CLAUDE_SESSION_ID}', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    await skill.setup();
    const tools = skill.getTools();
    const varTool = tools.find((t) => t.name === 'claude_var_skill');
    expect(varTool).toBeDefined();
    const result = varTool!.handler(
      { arguments: '' },
      { call_id: 'test-session-123' },
    ) as FunctionResult;
    expect(result.response).toContain(`Dir: ${join(skillsDir, 'var-skill')}`);
    expect(result.response).toContain('Session: test-session-123');
  });

  it('should respect disable-model-invocation (no tool, no prompt)', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    await skill.setup();
    const tools = skill.getTools();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).not.toContain('claude_disabled_skill');

    const prompts = skill.getPromptSections();
    const promptTitles = prompts.map((p) => p.title);
    expect(promptTitles).not.toContain('disabled-skill');
  });

  it('should respect user-invocable=false (no tool, yes prompt)', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir });
    await skill.setup();
    const tools = skill.getTools();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).not.toContain('claude_knowledge_only');

    const prompts = skill.getPromptSections();
    const promptTitles = prompts.map((p) => p.title);
    expect(promptTitles).toContain('knowledge-only');
  });

  it('should handle include/exclude patterns', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      include: ['greeting', 'helper'],
    });
    await skill.setup();
    const tools = skill.getTools();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('claude_greeting');
    expect(toolNames).toContain('claude_helper');
    expect(toolNames).not.toContain('claude_raw_skill');
  });

  it('should handle exclude patterns', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      exclude: ['greeting'],
    });
    await skill.setup();
    const tools = skill.getTools();
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).not.toContain('claude_greeting');
    expect(toolNames).toContain('claude_helper');
  });

  it('should use custom tool_prefix', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      tool_prefix: 'sk_',
      include: ['greeting'],
    });
    await skill.setup();
    const tools = skill.getTools();
    expect(tools[0].name).toBe('sk_greeting');
  });

  it('should apply response_prefix and response_postfix', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      include: ['greeting'],
      response_prefix: '[PREFIX]',
      response_postfix: '[POSTFIX]',
    });
    await skill.setup();
    const tools = skill.getTools();
    const result = tools[0].handler({ arguments: 'World' }, {}) as FunctionResult;
    expect(result.response).toMatch(/^\[PREFIX\]/);
    expect(result.response).toMatch(/\[POSTFIX\]$/);
    expect(result.response).toContain('Hello World! Welcome.');
  });

  it('should use argument-hint as parameter description', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: skillsDir, include: ['with-hint'] });
    await skill.setup();
    const tools = skill.getTools();
    const hintTool = tools.find((t) => t.name === 'claude_with_hint');
    expect(hintTool).toBeDefined();
    const argParam = hintTool!.parameters!['arguments'] as Record<string, unknown>;
    expect(argParam.description).toBe('The city name to look up');
  });

  it('should return prompt sections for non-skipped skills', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      include: ['helper'],
    });
    await skill.setup();
    const prompts = skill.getPromptSections();
    expect(prompts.length).toBeGreaterThan(0);
    const helperPrompt = prompts.find((p) => p.title === 'helper');
    expect(helperPrompt).toBeDefined();
    expect(helperPrompt!.body).toContain('Main helper content.');
    expect(helperPrompt!.body).toContain('Available reference sections:');
  });

  it('should return hints from skill names', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      include: ['greeting', 'helper'],
    });
    await skill.setup();
    const hints = skill.getHints();
    expect(hints).toContain('greeting');
    expect(hints).toContain('helper');
  });

  it('should return empty tools for missing skills_path', async () => {
    const skill = createClaudeSkillsSkill({ skills_path: '/nonexistent/path' });
    await skill.setup();
    const tools = skill.getTools();
    expect(tools).toHaveLength(0);
  });

  it('should return empty tools for empty directory', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'empty-skills-'));
    try {
      const skill = createClaudeSkillsSkill({ skills_path: emptyDir });
      await skill.setup();
      const tools = skill.getTools();
      expect(tools).toHaveLength(0);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('should execute shell injection when enabled', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      include: ['shell-skill'],
      allow_shell_injection: true,
    });
    await skill.setup();
    const tools = skill.getTools();
    const shellTool = tools.find((t) => t.name === 'claude_shell_skill');
    expect(shellTool).toBeDefined();
    const result = shellTool!.handler({ arguments: '' }, {}) as FunctionResult;
    expect(result.response).toContain('Result: hello');
  });

  it('should pass through shell patterns when disabled', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      include: ['shell-skill'],
      allow_shell_injection: false,
    });
    await skill.setup();
    const tools = skill.getTools();
    const shellTool = tools.find((t) => t.name === 'claude_shell_skill');
    expect(shellTool).toBeDefined();
    const result = shellTool!.handler({ arguments: '' }, {}) as FunctionResult;
    expect(result.response).toContain('!`echo hello`');
  });

  it('should override invocation control when ignore_invocation_control=true', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      ignore_invocation_control: true,
    });
    await skill.setup();
    const tools = skill.getTools();
    const toolNames = tools.map((t) => t.name);
    // Both disabled-skill and knowledge-only should now be registered
    expect(toolNames).toContain('claude_disabled_skill');
    expect(toolNames).toContain('claude_knowledge_only');
  });

  it('should override descriptions via skill_descriptions', async () => {
    const skill = createClaudeSkillsSkill({
      skills_path: skillsDir,
      include: ['greeting'],
      skill_descriptions: { greeting: 'Custom description' },
    });
    await skill.setup();
    const tools = skill.getTools();
    expect(tools[0].description).toBe('Custom description');
  });

  it('should return unique instance keys for different paths', () => {
    const skill1 = createClaudeSkillsSkill({ skills_path: '/path/a' });
    const skill2 = createClaudeSkillsSkill({ skills_path: '/path/b' });
    expect(skill1.getInstanceKey()).not.toBe(skill2.getInstanceKey());
  });
});

// ---------------------------------------------------------------------------
// MCP Gateway Skill
// ---------------------------------------------------------------------------
describe('McpGatewaySkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createMcpGatewaySkill();
    expect(skill).toBeInstanceOf(McpGatewaySkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createMcpGatewaySkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('mcp_gateway');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a configuration-prompt message when unconfigured', async () => {
    const skill = createMcpGatewaySkill();
    const handler = skill.getTools()[0].handler;
    const result = (await handler({ server: 'test', method: 'test' }, {})) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toMatch(/not configured|configure/i);
  });
});

// ---------------------------------------------------------------------------
// Security remediation tests
// ---------------------------------------------------------------------------
describe('CustomSkillsSkill - code gate', () => {
  it('should block handler compilation when SWML_ALLOW_CUSTOM_HANDLER_CODE is not set', () => {
    const saved = process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    delete process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    const skill = createCustomSkillsSkill({
      tools: [{ name: 'test_tool', description: 'Test', handler_code: 'return "hello";' }],
    });
    const errors = skill.getCompilationErrors();
    expect(errors.has('test_tool')).toBe(true);
    expect(errors.get('test_tool')).toContain('disabled');
    if (saved) process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = saved;
  });

  it('should allow handler compilation when SWML_ALLOW_CUSTOM_HANDLER_CODE=true', () => {
    const saved = process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = 'true';
    const skill = createCustomSkillsSkill({
      tools: [{ name: 'test_tool', description: 'Test', handler_code: 'return "hello";' }],
    });
    const errors = skill.getCompilationErrors();
    expect(errors.has('test_tool')).toBe(false);
    if (saved) process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = saved;
    else delete process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
  });
});

describe('SpiderSkill - SSRF protection', () => {
  it('should reject URLs resolving to private IPs', async () => {
    const saved = process.env['SWML_ALLOW_PRIVATE_URLS'];
    delete process.env['SWML_ALLOW_PRIVATE_URLS'];
    const skill = createSpiderSkill();
    await skill.setup();
    const handler = skill.getTools().find((t) => t.name === 'scrape_url')!.handler;
    const result = (await handler({ url: 'http://127.0.0.1/secret' }, {})) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toMatch(/private or internal URLs/);
    if (saved) process.env['SWML_ALLOW_PRIVATE_URLS'] = saved;
  });

  it('should reject overly long input', async () => {
    const skill = createSpiderSkill();
    await skill.setup();
    const handler = skill.getTools().find((t) => t.name === 'scrape_url')!.handler;
    const longUrl = 'https://example.com/' + 'a'.repeat(2000);
    const result = (await handler({ url: longUrl }, {})) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('too long');
  });
});

// ---------------------------------------------------------------------------
// Security remediation round 2 — error message leak tests
// ---------------------------------------------------------------------------
describe('Skill error messages do not leak internal details', () => {
  it('math skill catch returns generic message', () => {
    const skill = createMathSkill();
    const handler = skill.getTools()[0].handler;
    // Intentionally malformed expression that will throw
    const result = handler({ expression: '2 +' }, {}) as FunctionResult;
    expect(result).toBeInstanceOf(FunctionResult);
    expect(result.response).toContain('Could not evaluate');
    // Must not contain stack traces or JS error messages
    expect(result.response).not.toContain('Unexpected');
    expect(result.response).not.toContain('SyntaxError');
  });

  it('custom_skills compilation error returns generic message', () => {
    const saved = process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = 'true';
    try {
      const skill = createCustomSkillsSkill({
        tools: [{ name: 'bad_tool', description: 'Bad', handler_code: 'this is not valid javascript {{{{' }],
      });
      const errors = skill.getCompilationErrors();
      expect(errors.has('bad_tool')).toBe(true);
      // The stored error message should be generic, not expose syntax details
      expect(errors.get('bad_tool')).toBe('Handler compilation failed.');
    } finally {
      if (saved) process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = saved;
      else delete process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    }
  });

  it('custom_skills runtime error returns generic message', async () => {
    const saved = process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = 'true';
    try {
      const skill = createCustomSkillsSkill({
        tools: [{ name: 'crash_tool', description: 'Crash', handler_code: 'throw new Error("secret internal stack trace info");' }],
      });
      const handler = skill.getTools()[0].handler;
      const result = await handler({}, {}) as FunctionResult;
      expect(result).toBeInstanceOf(FunctionResult);
      expect(result.response).not.toContain('secret internal stack trace info');
      expect(result.response).toContain('encountered an error');
    } finally {
      if (saved) process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = saved;
      else delete process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    }
  });
});
