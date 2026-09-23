/**
 * Google Maps Skill - Address geocoding and coordinate-based routing.
 *
 * Tier 3 built-in skill: requires GOOGLE_MAPS_API_KEY environment variable.
 * Exposes a two-tool interface:
 *   - `lookup_address` — geocode an address/business name (with optional
 *     lat/lng bias) via the Google Geocoding API.
 *   - `compute_route` — driving distance + travel time between two
 *     coordinates via the Google Routes API v2.
 */

import { SkillBase, defineSkillTool } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { MAX_SKILL_INPUT_LENGTH } from '../../SecurityUtils.js';
import { getLogger } from '../../Logger.js';

const log = getLogger('GoogleMapsSkill');

/** A single geocoding result from the Google Geocoding API. */
interface GeocodingResult {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  types?: string[];
}

/** Response shape from the Google Geocoding API. */
interface GeocodingResponse {
  results: GeocodingResult[];
  status: string;
  error_message?: string;
}

/** Response shape from the Google Routes API v2. */
interface RoutesV2Route {
  distanceMeters?: number;
  duration?: string;
}

/** Response shape from the Google Routes API v2 computeRoutes endpoint. */
interface RoutesV2Response {
  routes?: RoutesV2Route[];
  error?: { message: string };
}

/**
 * Provides driving/walking/transit directions and place search via Google Maps APIs.
 *
 * Tier 3 built-in skill. Requires the `GOOGLE_MAPS_API_KEY` environment variable.
 * Supports a `default_mode` config option ("driving"|"walking"|"bicycling"|"transit").
 *
 * @example
 * ```ts
 * import { AgentBase } from '@signalwire/sdk';
 * const agent = new AgentBase({ name: 'demo', route: '/' });
 * agent.addSkillByName('google_maps', { default_mode: 'driving' });
 * ```
 */
export class GoogleMapsSkill extends SkillBase {
  // Python ground truth: skills/google_maps/skill.py
  // Python declares REQUIRED_PACKAGES = ["requests"], REQUIRED_ENV_VARS = [];
  // TS uses native fetch and has historically declared the env var as required.
  // Preserving TS behavior to avoid out-of-scope behavioral change.
  static override SKILL_NAME = 'google_maps';
  static override SKILL_DESCRIPTION =
    'Validate addresses and compute driving routes using Google Maps';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_PACKAGES: readonly string[] = [];
  static override REQUIRED_ENV_VARS: readonly string[] = ['GOOGLE_MAPS_API_KEY'];

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      api_key: {
        type: 'string',
        description: 'Google Maps API key.',
        hidden: true,
        env_var: 'GOOGLE_MAPS_API_KEY',
        required: true,
      },
      lookup_tool_name: {
        type: 'string',
        description: 'Name for the address lookup tool',
        default: 'lookup_address',
      },
      route_tool_name: {
        type: 'string',
        description: 'Name for the route computation tool',
        default: 'compute_route',
      },
    };
  }

  /**
   * Fail-fast when GOOGLE_MAPS_API_KEY is not set, mirroring Python's
   * `setup()` validation. The env var is the only credential source for
   * this skill, so loading it without the key would produce runtime
   * errors on every tool call.
   * @returns `true` if the API key is present, `false` otherwise.
   */
  override async setup(): Promise<boolean> {
    const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
    if (!apiKey) {
      return false;
    }
    return true;
  }

  /** @returns Speech recognition hints for maps/directions keywords. */
  override getHints(): string[] {
    return ['address', 'location', 'route', 'directions', 'miles', 'distance'];
  }

  /**
   * @returns Two tools: `lookup_address` (geocode an address/business name,
   *   optional lat/lng bias) and `compute_route` (driving distance + time
   *   between two coordinates). Neither declares a `required` array.
   */
  getTools(): SkillToolDefinition[] {
    const lookupToolName = this.getConfig<string>('lookup_tool_name', 'lookup_address');
    const routeToolName = this.getConfig<string>('route_tool_name', 'compute_route');

    return [
      defineSkillTool({
        name: lookupToolName,
        description:
          'Validate and geocode a street address or business name using Google Maps. ' +
          'Optionally bias results toward a known location (e.g. find the nearest Walmart).',
        parameters: {
          address: {
            type: 'string',
            description: 'The address or business name to look up',
          },
          bias_lat: {
            type: 'number',
            description: 'Latitude to bias results toward (optional)',
          },
          bias_lng: {
            type: 'number',
            description: 'Longitude to bias results toward (optional)',
          },
        },
        handler: async (args) => {
          // No `required` (matches Python) → address is possibly-absent.
          const address = args.address;

          if (!address || address.trim().length === 0) {
            return new FunctionResult('Please provide an address or business name to look up.');
          }

          if (address.length > MAX_SKILL_INPUT_LENGTH) {
            return new FunctionResult('Input is too long.');
          }

          const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
          if (!apiKey) {
            return new FunctionResult(
              'Service is not configured. Please contact your administrator.',
            );
          }

          const biasLat = args.bias_lat;
          const biasLng = args.bias_lng;

          try {
            let urlStr =
              `https://maps.googleapis.com/maps/api/geocode/json` +
              `?address=${encodeURIComponent(address.trim())}` +
              `&key=${apiKey}`;

            if (biasLat !== undefined && biasLng !== undefined) {
              // Bias toward a 50 km radius around the given coordinates
              const delta = 0.45; // ~50 km in degrees
              urlStr += `&bounds=${biasLat - delta},${biasLng - delta}|${biasLat + delta},${biasLng + delta}`;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);
            let response: Response;
            try {
              response = await fetch(urlStr, { signal: controller.signal });
            } finally {
              clearTimeout(timeout);
            }
            const data = (await response.json()) as GeocodingResponse;

            if (data.status !== 'OK' || !data.results || data.results.length === 0) {
              log.error('geocoding_api_error', { status: data.status });
              return new FunctionResult(
                `I couldn't find that address. Could you provide a more specific address?`,
              );
            }

            const result = data.results[0]!; // length === 0 returns above
            const { lat, lng } = result.geometry.location;
            const parts: string[] = [
              `Address: ${result.formatted_address}`,
              `Coordinates: ${lat}, ${lng}`,
            ];

            return new FunctionResult(parts.join('\n'));
          } catch (err) {
            log.error('lookup_address_failed', {
              error: err instanceof Error ? err.message : String(err),
            });
            return new FunctionResult('The request could not be completed. Please try again.');
          }
        },
      }),
      defineSkillTool({
        name: routeToolName,
        description:
          'Compute a driving route between two points using Google Maps Routes API. ' +
          'Returns distance and estimated travel time.',
        parameters: {
          origin_lat: {
            type: 'number',
            description: 'Origin latitude',
          },
          origin_lng: {
            type: 'number',
            description: 'Origin longitude',
          },
          dest_lat: {
            type: 'number',
            description: 'Destination latitude',
          },
          dest_lng: {
            type: 'number',
            description: 'Destination longitude',
          },
        },
        handler: async (args) => {
          // No `required` (matches Python). The model can omit/mistype, so
          // keep the runtime presence check before calling the API.
          const { origin_lat: originLat, origin_lng: originLng } = args;
          const { dest_lat: destLat, dest_lng: destLng } = args;

          if (
            originLat === undefined ||
            originLng === undefined ||
            destLat === undefined ||
            destLng === undefined
          ) {
            return new FunctionResult(
              'All four coordinates are required: origin_lat, origin_lng, dest_lat, dest_lng.',
            );
          }

          const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
          if (!apiKey) {
            return new FunctionResult(
              'Service is not configured. Please contact your administrator.',
            );
          }

          try {
            const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
            const body = {
              origin: {
                location: {
                  latLng: { latitude: originLat, longitude: originLng },
                },
              },
              destination: {
                location: {
                  latLng: { latitude: destLat, longitude: destLng },
                },
              },
              travelMode: 'DRIVE',
              routingPreference: 'TRAFFIC_AWARE',
            };

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);
            let response: Response;
            try {
              response = await fetch(url, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': apiKey,
                  'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
                },
                body: JSON.stringify(body),
              });
            } finally {
              clearTimeout(timeout);
            }
            const data = (await response.json()) as RoutesV2Response;

            if (!data.routes || data.routes.length === 0) {
              log.error('routes_api_error', { error: data.error?.message });
              return new FunctionResult(
                "I couldn't compute a route between those locations. Please verify the coordinates.",
              );
            }

            const route = data.routes[0]!; // length === 0 returns above
            const distanceMeters = route.distanceMeters ?? 0;
            const durationSeconds = route.duration
              ? parseInt(route.duration.replace(/s$/, ''), 10)
              : 0;
            const distanceMiles = distanceMeters / 1609.344;
            const durationMin = durationSeconds / 60.0;

            return new FunctionResult(
              `Distance: ${distanceMiles.toFixed(1)} miles\n` +
                `Estimated travel time: ${Math.floor(durationMin)} minutes`,
            );
          } catch (err) {
            log.error('compute_route_failed', {
              error: err instanceof Error ? err.message : String(err),
            });
            return new FunctionResult('The request could not be completed. Please try again.');
          }
        },
      }),
    ];
  }

  /** @returns Prompt section describing address lookup + route computation. */
  protected override _getPromptSections(): SkillPromptSection[] {
    const lookupToolName = this.getConfig<string>('lookup_tool_name', 'lookup_address');
    const routeToolName = this.getConfig<string>('route_tool_name', 'compute_route');

    return [
      {
        title: 'Google Maps',
        body: 'You can validate addresses and compute driving routes.',
        bullets: [
          `Use ${lookupToolName} to validate and geocode addresses or business names`,
          `Use ${routeToolName} to get driving distance and time between two points`,
          "Address lookup supports spoken numbers (e.g. 'seven one four' becomes '714')",
          'You can bias address results toward a known location to find the nearest match',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating GoogleMapsSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new GoogleMapsSkill instance.
 */
export function createSkill(config?: SkillConfig): GoogleMapsSkill {
  return new GoogleMapsSkill(config);
}
