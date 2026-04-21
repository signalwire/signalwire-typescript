/**
 * Built-in skills registry for SignalWire AI Agents.
 *
 * Import this module to register all built-in skills with the global SkillRegistry.
 */

export { DateTimeSkill, createSkill as createDateTimeSkill } from './datetime.js';
export { MathSkill, createSkill as createMathSkill } from './math.js';
export { JokeSkill, createSkill as createJokeSkill } from './joke.js';
export { WeatherApiSkill, createSkill as createWeatherApiSkill } from './weather_api.js';
export { PlayBackgroundFileSkill, createSkill as createPlayBackgroundFileSkill } from './play_background_file.js';
export { SwmlTransferSkill, createSkill as createSwmlTransferSkill } from './swml_transfer.js';
export { ApiNinjasTriviaSkill, createSkill as createApiNinjasTriviaSkill } from './api_ninjas_trivia.js';
export { InfoGathererSkill, createSkill as createInfoGathererSkill } from './info_gatherer.js';
export { CustomSkillsSkill, createSkill as createCustomSkillsSkill } from './custom_skills.js';
export { WebSearchSkill, createSkill as createWebSearchSkill } from './web_search.js';
export { WikipediaSearchSkill, createSkill as createWikipediaSearchSkill } from './wikipedia_search.js';
export { GoogleMapsSkill, createSkill as createGoogleMapsSkill } from './google_maps.js';
export { DataSphereSkill, createSkill as createDataSphereSkill } from './datasphere.js';
export { DataSphereServerlessSkill, createSkill as createDataSphereServerlessSkill } from './datasphere_serverless.js';
export { NativeVectorSearchSkill, createSkill as createNativeVectorSearchSkill } from './native_vector_search.js';
export { SpiderSkill, createSkill as createSpiderSkill } from './spider.js';
export { ClaudeSkillsSkill, createSkill as createClaudeSkillsSkill } from './claude_skills.js';
export { AskClaudeSkill, createSkill as createAskClaudeSkill } from './ask_claude.js';
export { McpGatewaySkill, createSkill as createMcpGatewaySkill } from './mcp_gateway.js';

import { SkillRegistry } from '../SkillRegistry.js';
import type { SkillBase } from '../SkillBase.js';
import { DateTimeSkill } from './datetime.js';
import { MathSkill } from './math.js';
import { JokeSkill } from './joke.js';
import { WeatherApiSkill } from './weather_api.js';
import { PlayBackgroundFileSkill } from './play_background_file.js';
import { SwmlTransferSkill } from './swml_transfer.js';
import { ApiNinjasTriviaSkill } from './api_ninjas_trivia.js';
import { InfoGathererSkill } from './info_gatherer.js';
import { CustomSkillsSkill } from './custom_skills.js';
import { WebSearchSkill } from './web_search.js';
import { WikipediaSearchSkill } from './wikipedia_search.js';
import { GoogleMapsSkill } from './google_maps.js';
import { DataSphereSkill } from './datasphere.js';
import { DataSphereServerlessSkill } from './datasphere_serverless.js';
import { NativeVectorSearchSkill } from './native_vector_search.js';
import { SpiderSkill } from './spider.js';
import { ClaudeSkillsSkill } from './claude_skills.js';
import { AskClaudeSkill } from './ask_claude.js';
import { McpGatewaySkill } from './mcp_gateway.js';

/**
 * Register all 19 built-in skills with the global SkillRegistry singleton.
 * Matches Python's auto-discovery pattern (`skills/registry.py`) which finds
 * SkillBase subclasses in the skills directory and registers them by class
 * reference. Skips registration for any skill name already present.
 */
export function registerBuiltinSkills(): void {
  const registry = SkillRegistry.getInstance();

  const skillClasses: Array<typeof SkillBase> = [
    DateTimeSkill,
    MathSkill,
    JokeSkill,
    WeatherApiSkill,
    PlayBackgroundFileSkill,
    SwmlTransferSkill,
    ApiNinjasTriviaSkill,
    InfoGathererSkill,
    CustomSkillsSkill,
    WebSearchSkill,
    WikipediaSearchSkill,
    GoogleMapsSkill,
    DataSphereSkill,
    DataSphereServerlessSkill,
    NativeVectorSearchSkill,
    SpiderSkill,
    ClaudeSkillsSkill,
    AskClaudeSkill,
    McpGatewaySkill,
  ];

  for (const SkillClass of skillClasses) {
    if (!registry.has(SkillClass.SKILL_NAME)) {
      registry.register(SkillClass);
    }
  }

  // Lock all built-in skills to prevent override
  registry.lock();
}
