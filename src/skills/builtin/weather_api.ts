/**
 * Weather API Skill - Fetches current weather data from OpenWeatherMap.
 *
 * Tier 2 built-in skill: requires WEATHER_API_KEY environment variable.
 * Uses the OpenWeatherMap API to retrieve current weather conditions
 * for a specified location.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { MAX_SKILL_INPUT_LENGTH } from '../../SecurityUtils.js';
import { getLogger } from '../../Logger.js';

const log = getLogger('WeatherApiSkill');

/** Response shape from the OpenWeatherMap current weather endpoint. */
interface WeatherApiResponse {
  name: string;
  sys: { country: string };
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
    temp_min: number;
    temp_max: number;
  };
  weather: Array<{ main: string; description: string }>;
  wind: { speed: number; deg: number };
  visibility?: number;
  clouds?: { all: number };
  cod: number;
  message?: string;
}

/**
 * Fetches current weather data from OpenWeatherMap for any location worldwide.
 *
 * Tier 2 built-in skill. Requires the `WEATHER_API_KEY` environment variable
 * containing a valid OpenWeatherMap API key (obtainable at openweathermap.org).
 * Supports metric, imperial, and standard temperature units via the `units`
 * config option. The `api_key` config value takes precedence over the
 * environment variable when both are set.
 *
 * **Provider note:** The Python reference SDK uses WeatherAPI.com
 * (`api.weatherapi.com/v1/current.json`). This TypeScript skill uses
 * OpenWeatherMap (`api.openweathermap.org/data/2.5/weather`). These providers
 * use different API key formats — a WeatherAPI.com key will NOT work here.
 * Obtain an OpenWeatherMap key at https://openweathermap.org/api.
 *
 * **Unit aliases:** For migration compatibility with the Python SDK the `units`
 * config also accepts `"fahrenheit"` (normalized to `"imperial"`) and
 * `"celsius"` (normalized to `"metric"`).
 */
export class WeatherApiSkill extends SkillBase {
  /**
   * @param config - Optional configuration; supports `units` ("metric"|"imperial"|"standard").
   */
  constructor(config?: SkillConfig) {
    super('weather_api', config);
  }

  /**
   * Validates that an API key is available either via inline config or the
   * `WEATHER_API_KEY` environment variable. Fails fast (returns `false`) when
   * neither source provides a key — matching Python SDK behaviour where
   * `_validate_config()` raises on construction when `api_key` is absent.
   * @returns `true` if a key is present, `false` otherwise.
   */
  override async setup(): Promise<boolean> {
    const key = this.getConfig<string>('api_key') ?? process.env['WEATHER_API_KEY'];
    if (!key) {
      log.error('WeatherApiSkill: api_key is required. Set the WEATHER_API_KEY environment variable or pass api_key in skill config.');
      return false;
    }
    return true;
  }

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      api_key: {
        type: 'string',
        description: 'OpenWeatherMap API key.',
        hidden: true,
        env_var: 'WEATHER_API_KEY',
        required: true,
      },
      tool_name: {
        type: 'string',
        description: 'Custom name for the generated weather tool.',
        default: 'get_weather',
      },
      units: {
        type: 'string',
        description:
          'Temperature units. Preferred values: "metric" (Celsius), "imperial" (Fahrenheit), "standard" (Kelvin). ' +
          'Python SDK aliases also accepted: "celsius" → "metric", "fahrenheit" → "imperial".',
        default: 'metric',
        enum: ['metric', 'imperial', 'standard', 'celsius', 'fahrenheit'],
      },
    };
  }

  /** @returns Manifest declaring WEATHER_API_KEY as required and config schema for units. */
  getManifest(): SkillManifest {
    return {
      name: 'weather_api',
      description:
        'Fetches current weather data from OpenWeatherMap for any location worldwide.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['weather', 'api', 'openweathermap', 'external'],
      requiredEnvVars: ['WEATHER_API_KEY'],
      configSchema: {
        units: {
          type: 'string',
          description:
            'Temperature units: "metric" (Celsius), "imperial" (Fahrenheit), or "standard" (Kelvin).',
          default: 'metric',
        },
      },
    };
  }

  /** @returns A single weather tool (configurable name) that fetches current weather for a location. */
  getTools(): SkillToolDefinition[] {
    // Normalize Python SDK unit aliases to OpenWeatherMap unit names.
    const rawUnits = this.getConfig<string>('units', 'metric');
    const units =
      rawUnits === 'fahrenheit' ? 'imperial' :
      rawUnits === 'celsius'    ? 'metric'   :
      rawUnits;
    const toolName = this.getConfig<string>('tool_name', 'get_weather');

    return [
      {
        name: toolName,
        description:
          'Get the current weather conditions for a specified location. Returns temperature, humidity, wind speed, and weather description.',
        parameters: {
          location: {
            type: 'string',
            description:
              'The city name, optionally with country code (e.g., "London", "Paris,FR", "New York,US").',
          },
        },
        required: ['location'],
        handler: async (args: Record<string, unknown>) => {
          const location = args.location as string | undefined;

          if (!location || typeof location !== 'string' || location.trim().length === 0) {
            return new FunctionResult(
              'Please provide a location to get the weather for.',
            );
          }

          if (location.length > MAX_SKILL_INPUT_LENGTH) {
            return new FunctionResult('Input is too long.');
          }

          const apiKey = this.getConfig<string>('api_key') ?? process.env['WEATHER_API_KEY'];
          if (!apiKey) {
            return new FunctionResult(
              'Service is not configured. Please contact your administrator.',
            );
          }

          try {
            const encodedLocation = encodeURIComponent(location.trim());
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodedLocation}&appid=${apiKey}&units=${units}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);
            let response: Response;
            try {
              response = await fetch(url, { signal: controller.signal });
            } finally {
              clearTimeout(timeout);
            }
            const data = (await response.json()) as WeatherApiResponse;

            if (!response.ok || data.cod !== 200) {
              log.error('weather_api_error', { status: response.status });
              return new FunctionResult(
                `Could not retrieve weather for "${location}". Please check the location name and try again.`,
              );
            }

            const unitLabel = units === 'imperial' ? 'F' : units === 'standard' ? 'K' : 'C';
            const speedUnit = units === 'imperial' ? 'mph' : 'm/s';

            const weatherDesc =
              data.weather.length > 0
                ? data.weather.map((w) => w.description).join(', ')
                : 'unknown';

            const parts: string[] = [
              `Weather for ${data.name}, ${data.sys.country}:`,
              `Conditions: ${weatherDesc}.`,
              `Temperature: ${data.main.temp}\u00B0${unitLabel} (feels like ${data.main.feels_like}\u00B0${unitLabel}).`,
              `High: ${data.main.temp_max}\u00B0${unitLabel}, Low: ${data.main.temp_min}\u00B0${unitLabel}.`,
              `Humidity: ${data.main.humidity}%.`,
              `Wind: ${data.wind.speed} ${speedUnit}.`,
              `Pressure: ${data.main.pressure} hPa.`,
            ];

            if (data.visibility !== undefined) {
              const visKm = (data.visibility / 1000).toFixed(1);
              parts.push(`Visibility: ${visKm} km.`);
            }

            if (data.clouds?.all !== undefined) {
              parts.push(`Cloud cover: ${data.clouds.all}%.`);
            }

            return new FunctionResult(parts.join(' '));
          } catch (err) {
            log.error('get_weather_failed', { error: err instanceof Error ? err.message : String(err) });
            return new FunctionResult(
              'The request could not be completed. Please try again.',
            );
          }
        },
      },
    ];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    const units = this.getConfig<string>('units', 'metric');
    const unitDesc =
      units === 'imperial'
        ? 'Fahrenheit'
        : units === 'standard'
          ? 'Kelvin'
          : 'Celsius';

    return [
      {
        title: 'Weather Information',
        body: 'You can look up current weather conditions for any location worldwide.',
        bullets: [
          'Use the get_weather tool when a user asks about current weather conditions.',
          'You can specify a city name, optionally with a country code (e.g., "London", "Paris,FR").',
          `Temperature is reported in ${unitDesc}.`,
          'The weather data includes temperature, humidity, wind speed, pressure, and general conditions.',
          'If the user asks about a forecast or future weather, let them know you can only provide current conditions.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating WeatherApiSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new WeatherApiSkill instance.
 */
export function createSkill(config?: SkillConfig): WeatherApiSkill {
  return new WeatherApiSkill(config);
}
