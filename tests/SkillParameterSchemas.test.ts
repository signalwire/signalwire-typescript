import { describe, it, expect } from 'vitest';
import { DateTimeSkill } from '../src/skills/builtin/datetime.js';
import { MathSkill } from '../src/skills/builtin/math.js';
import { JokeSkill } from '../src/skills/builtin/joke.js';
import { WeatherApiSkill } from '../src/skills/builtin/weather_api.js';
import { PlayBackgroundFileSkill } from '../src/skills/builtin/play_background_file.js';
import { SwmlTransferSkill } from '../src/skills/builtin/swml_transfer.js';
import { ApiNinjasTriviaSkill } from '../src/skills/builtin/api_ninjas_trivia.js';
import { InfoGathererSkill } from '../src/skills/builtin/info_gatherer.js';
import { CustomSkillsSkill } from '../src/skills/builtin/custom_skills.js';
import { WebSearchSkill } from '../src/skills/builtin/web_search.js';
import { WikipediaSearchSkill } from '../src/skills/builtin/wikipedia_search.js';
import { GoogleMapsSkill } from '../src/skills/builtin/google_maps.js';
import { DataSphereSkill } from '../src/skills/builtin/datasphere.js';
import { DataSphereServerlessSkill } from '../src/skills/builtin/datasphere_serverless.js';
import { NativeVectorSearchSkill } from '../src/skills/builtin/native_vector_search.js';
import { SpiderSkill } from '../src/skills/builtin/spider.js';
import { ClaudeSkillsSkill } from '../src/skills/builtin/claude_skills.js';
import { AskClaudeSkill } from '../src/skills/builtin/ask_claude.js';
import { McpGatewaySkill } from '../src/skills/builtin/mcp_gateway.js';

const ALL_SKILLS = [
  { name: 'DateTimeSkill', cls: DateTimeSkill },
  { name: 'MathSkill', cls: MathSkill },
  { name: 'JokeSkill', cls: JokeSkill },
  { name: 'WeatherApiSkill', cls: WeatherApiSkill },
  { name: 'PlayBackgroundFileSkill', cls: PlayBackgroundFileSkill },
  { name: 'SwmlTransferSkill', cls: SwmlTransferSkill },
  { name: 'ApiNinjasTriviaSkill', cls: ApiNinjasTriviaSkill },
  { name: 'InfoGathererSkill', cls: InfoGathererSkill },
  { name: 'CustomSkillsSkill', cls: CustomSkillsSkill },
  { name: 'WebSearchSkill', cls: WebSearchSkill },
  { name: 'WikipediaSearchSkill', cls: WikipediaSearchSkill },
  { name: 'GoogleMapsSkill', cls: GoogleMapsSkill },
  { name: 'DataSphereSkill', cls: DataSphereSkill },
  { name: 'DataSphereServerlessSkill', cls: DataSphereServerlessSkill },
  { name: 'NativeVectorSearchSkill', cls: NativeVectorSearchSkill },
  { name: 'SpiderSkill', cls: SpiderSkill },
  { name: 'ClaudeSkillsSkill', cls: ClaudeSkillsSkill },
  { name: 'AskClaudeSkill', cls: AskClaudeSkill },
  { name: 'McpGatewaySkill', cls: McpGatewaySkill },
] as const;

describe('Skill Parameter Schemas', () => {
  for (const { name, cls } of ALL_SKILLS) {
    describe(name, () => {
      it('getParameterSchema returns non-empty schema', () => {
        const schema = cls.getParameterSchema();
        expect(Object.keys(schema).length).toBeGreaterThan(0);
      });

      it('includes base fields (swaig_fields, skip_prompt)', () => {
        const schema = cls.getParameterSchema();
        expect(schema).toHaveProperty('swaig_fields');
        expect(schema).toHaveProperty('skip_prompt');
      });

      it('all entries have type and description', () => {
        const schema = cls.getParameterSchema();
        // Allowed JSON-Schema-style types every parameter entry must use.
        // A bare nullness check would pass for `{type: 0, description: false}`;
        // the enum membership + non-empty string check catches that.
        const validTypes = new Set([
          'string', 'integer', 'number', 'boolean', 'array', 'object',
        ]);
        for (const [paramName, entry] of Object.entries(schema)) {
          expect(
            validTypes.has(entry.type),
            `${name}.${paramName} has invalid type '${String(entry.type)}'`,
          ).toBe(true);
          expect(
            typeof entry.description === 'string' && entry.description.length > 0,
            `${name}.${paramName} missing or empty description`,
          ).toBe(true);
        }
      });
    });
  }

  describe('multi-instance skills include tool_name', () => {
    it('DataSphereSkill has tool_name param', () => {
      const schema = DataSphereSkill.getParameterSchema();
      expect(schema).toHaveProperty('tool_name');
      expect(schema.tool_name.type).toBe('string');
    });

    it('DataSphereServerlessSkill has tool_name param', () => {
      const schema = DataSphereServerlessSkill.getParameterSchema();
      expect(schema).toHaveProperty('tool_name');
    });

    // NativeVectorSearchSkill intentionally omits tool_name from
    // getParameterSchema — Python reference schema does not include it
    // either. The internal default 'search_knowledge' still applies via
    // getConfig fallback.
  });

  describe('specific schema details', () => {
    it('WeatherApiSkill has api_key with hidden and env_var', () => {
      const schema = WeatherApiSkill.getParameterSchema();
      expect(schema.api_key).toBeDefined();
      expect(schema.api_key.hidden).toBe(true);
      expect(schema.api_key.env_var).toBe('WEATHER_API_KEY');
      expect(schema.api_key.required).toBe(true);
    });

    it('WebSearchSkill has num_results with min/max', () => {
      const schema = WebSearchSkill.getParameterSchema();
      expect(schema.num_results).toBeDefined();
      expect(schema.num_results.min).toBe(1);
      expect(schema.num_results.max).toBe(10);
      expect(schema.num_results.default).toBe(3);
    });

    it('AskClaudeSkill has model with default', () => {
      const schema = AskClaudeSkill.getParameterSchema();
      expect(schema.model).toBeDefined();
      expect(schema.model.default).toBe('claude-sonnet-4-5-20250929');
    });

    it('ClaudeSkillsSkill has skills_path required', () => {
      const schema = ClaudeSkillsSkill.getParameterSchema();
      expect(schema.skills_path).toBeDefined();
      expect(schema.skills_path.required).toBe(true);
    });

    it('DataSphereSkill has distance with min/max', () => {
      const schema = DataSphereSkill.getParameterSchema();
      expect(schema.distance).toBeDefined();
      expect(schema.distance.min).toBe(0);
      expect(schema.distance.max).toBe(10);
    });

    it('SwmlTransferSkill has patterns array', () => {
      const schema = SwmlTransferSkill.getParameterSchema();
      expect(schema.patterns).toBeDefined();
      expect(schema.patterns.type).toBe('array');
    });

    it('GoogleMapsSkill has default_mode with enum', () => {
      const schema = GoogleMapsSkill.getParameterSchema();
      expect(schema.default_mode).toBeDefined();
      expect(schema.default_mode.enum).toEqual(['driving', 'walking', 'bicycling', 'transit']);
    });
  });
});
