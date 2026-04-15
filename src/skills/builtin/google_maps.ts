/**
 * Google Maps Skill - Provides directions and place search via Google Maps APIs.
 *
 * Tier 3 built-in skill: requires GOOGLE_MAPS_API_KEY environment variable.
 * Uses Google Directions API for route information and Google Places API
 * for place search and discovery.
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

const log = getLogger('GoogleMapsSkill');

/** A single leg of a route from the Google Directions API. */
interface DirectionsLeg {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  start_address: string;
  end_address: string;
  steps: Array<{
    html_instructions: string;
    distance: { text: string };
    duration: { text: string };
    travel_mode: string;
  }>;
}

/** A single route option from the Google Directions API response. */
interface DirectionsRoute {
  summary: string;
  legs: DirectionsLeg[];
  warnings: string[];
  copyrights: string;
}

/** Response shape from the Google Directions API. */
interface DirectionsResponse {
  status: string;
  routes: DirectionsRoute[];
  error_message?: string;
}

/** A place candidate result from the Google Places Find Place API. */
interface PlaceCandidate {
  name: string;
  formatted_address: string;
  geometry?: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { open_now: boolean };
  business_status?: string;
  types?: string[];
}

/** Response shape from the Google Places Find Place API. */
interface PlacesResponse {
  candidates: PlaceCandidate[];
  status: string;
  error_message?: string;
}

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
 */
export class GoogleMapsSkill extends SkillBase {
  /**
   * @param config - Optional configuration; supports `default_mode` for travel mode.
   */
  constructor(config?: SkillConfig) {
    super('google_maps', config);
  }

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
      geocode_tool_name: {
        type: 'string',
        description: 'Name for the geocode-address-to-coordinates tool',
        default: 'geocode_address',
      },
      route_by_coords_tool_name: {
        type: 'string',
        description: 'Name for the coordinate-based route computation tool',
        default: 'compute_route_by_coords',
      },
      default_mode: {
        type: 'string',
        description: 'Default travel mode.',
        default: 'driving',
        enum: ['driving', 'walking', 'bicycling', 'transit'],
      },
    };
  }

  /**
   * Validate that the Google Maps API key is available in the environment.
   * Returns `false` (non-fatal warning) if the API key is missing.
   * @returns `true` if setup succeeded, `false` if the API key is absent.
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

  /** @returns Manifest declaring GOOGLE_MAPS_API_KEY as required and config schema for default_mode. */
  getManifest(): SkillManifest {
    return {
      name: 'google_maps',
      description:
        'Provides driving/walking/transit directions and place search via Google Maps APIs.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['maps', 'directions', 'places', 'google', 'navigation', 'external'],
      requiredEnvVars: ['GOOGLE_MAPS_API_KEY'],
      configSchema: {
        default_mode: {
          type: 'string',
          description:
            'Default travel mode: "driving", "walking", "bicycling", or "transit". Defaults to "driving".',
          default: 'driving',
        },
      },
    };
  }

  /** @returns Two tools: `get_directions` for route info and `find_place` for place discovery. */
  getTools(): SkillToolDefinition[] {
    const defaultMode = this.getConfig<string>('default_mode', 'driving');
    const routeToolName = this.getConfig<string>(
      'route_tool_name',
      'compute_route',
    );
    const lookupToolName = this.getConfig<string>(
      'lookup_tool_name',
      'lookup_address',
    );
    const geocodeToolName = this.getConfig<string>(
      'geocode_tool_name',
      'geocode_address',
    );
    const routeByCoordsToolName = this.getConfig<string>(
      'route_by_coords_tool_name',
      'compute_route_by_coords',
    );

    return [
      {
        name: routeToolName,
        description:
          'Get directions between two locations. Returns distance, duration, and step-by-step directions summary.',
        parameters: {
          origin: {
            type: 'string',
            description:
              'Starting location (address, city name, or place name).',
          },
          destination: {
            type: 'string',
            description:
              'Destination location (address, city name, or place name).',
          },
          mode: {
            type: 'string',
            description:
              `Travel mode: "driving", "walking", "bicycling", or "transit". Defaults to "${defaultMode}".`,
          },
        },
        required: ['origin', 'destination'],
        handler: async (args: Record<string, unknown>) => {
          const origin = args.origin as string | undefined;
          const destination = args.destination as string | undefined;
          const mode = (args.mode as string | undefined) ?? defaultMode;

          if (!origin || typeof origin !== 'string' || origin.trim().length === 0) {
            return new FunctionResult('Please provide a starting location (origin).');
          }

          if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
            return new FunctionResult('Please provide a destination.');
          }

          if (origin.length > MAX_SKILL_INPUT_LENGTH || destination.length > MAX_SKILL_INPUT_LENGTH) {
            return new FunctionResult('Input is too long.');
          }

          const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
          if (!apiKey) {
            return new FunctionResult(
              'Service is not configured. Please contact your administrator.',
            );
          }

          const validModes = ['driving', 'walking', 'bicycling', 'transit'];
          const travelMode = validModes.includes(mode) ? mode : defaultMode;

          try {
            const url =
              `https://maps.googleapis.com/maps/api/directions/json` +
              `?origin=${encodeURIComponent(origin.trim())}` +
              `&destination=${encodeURIComponent(destination.trim())}` +
              `&mode=${travelMode}` +
              `&key=${apiKey}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);
            let response: Response;
            try {
              response = await fetch(url, { signal: controller.signal });
            } finally {
              clearTimeout(timeout);
            }
            const data = (await response.json()) as DirectionsResponse;

            if (data.status !== 'OK') {
              log.error('directions_api_error', { status: data.status });
              return new FunctionResult(
                `Could not get directions from "${origin}" to "${destination}". Please check the locations and try again.`,
              );
            }

            if (data.routes.length === 0) {
              return new FunctionResult(
                `No routes found from "${origin}" to "${destination}".`,
              );
            }

            const route = data.routes[0];
            const leg = route.legs[0];

            const parts: string[] = [
              `Directions from ${leg.start_address} to ${leg.end_address}:`,
              `Mode: ${travelMode}`,
              `Distance: ${leg.distance.text}`,
              `Estimated duration: ${leg.duration.text}`,
            ];

            if (route.summary) {
              parts.push(`Route: via ${route.summary}`);
            }

            parts.push('');
            parts.push('Steps:');

            const maxSteps = Math.min(leg.steps.length, 10);
            for (let i = 0; i < maxSteps; i++) {
              const step = leg.steps[i];
              const instruction = step.html_instructions
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .trim();
              parts.push(`${i + 1}. ${instruction} (${step.distance.text}, ${step.duration.text})`);
            }

            if (leg.steps.length > maxSteps) {
              parts.push(`... and ${leg.steps.length - maxSteps} more steps.`);
            }

            if (route.warnings.length > 0) {
              parts.push('');
              parts.push(`Note: ${route.warnings.join(' ')}`);
            }

            return new FunctionResult(parts.join('\n'));
          } catch (err) {
            log.error('get_directions_failed', { error: err instanceof Error ? err.message : String(err) });
            return new FunctionResult(
              'The request could not be completed. Please try again.',
            );
          }
        },
      },
      {
        name: lookupToolName,
        description:
          'Search for a place by name or description. Returns the place name, address, rating, and whether it is currently open.',
        parameters: {
          query: {
            type: 'string',
            description:
              'The place to search for (e.g., "pizza near Times Square", "Eiffel Tower", "pharmacy in Chicago").',
          },
        },
        required: ['query'],
        handler: async (args: Record<string, unknown>) => {
          const query = args.query as string | undefined;

          if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return new FunctionResult('Please provide a place to search for.');
          }

          if (query.length > MAX_SKILL_INPUT_LENGTH) {
            return new FunctionResult('Search query is too long.');
          }

          const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
          if (!apiKey) {
            return new FunctionResult(
              'Service is not configured. Please contact your administrator.',
            );
          }

          try {
            const fields = 'name,formatted_address,geometry,rating,user_ratings_total,opening_hours,business_status,types';
            const url =
              `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
              `?input=${encodeURIComponent(query.trim())}` +
              `&inputtype=textquery` +
              `&fields=${fields}` +
              `&key=${apiKey}`;

            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), 30_000);
            let response: Response;
            try {
              response = await fetch(url, { signal: controller2.signal });
            } finally {
              clearTimeout(timeout2);
            }
            const data = (await response.json()) as PlacesResponse;

            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
              log.error('places_api_error', { status: data.status });
              return new FunctionResult(
                'The place search service encountered an error. Please try again later.',
              );
            }

            if (!data.candidates || data.candidates.length === 0) {
              return new FunctionResult(
                `No places found for "${query}". Try a different search term.`,
              );
            }

            const place = data.candidates[0];
            const parts: string[] = [
              `Place found: ${place.name}`,
              `Address: ${place.formatted_address}`,
            ];

            if (place.rating !== undefined) {
              const ratingInfo = place.user_ratings_total
                ? `${place.rating}/5 (${place.user_ratings_total} reviews)`
                : `${place.rating}/5`;
              parts.push(`Rating: ${ratingInfo}`);
            }

            if (place.opening_hours?.open_now !== undefined) {
              parts.push(`Currently open: ${place.opening_hours.open_now ? 'Yes' : 'No'}`);
            }

            if (place.business_status && place.business_status !== 'OPERATIONAL') {
              parts.push(`Status: ${place.business_status.toLowerCase().replace(/_/g, ' ')}`);
            }

            if (place.types && place.types.length > 0) {
              const readableTypes = place.types
                .filter((t) => !t.startsWith('point_of_interest') && !t.startsWith('establishment'))
                .slice(0, 5)
                .map((t) => t.replace(/_/g, ' '));
              if (readableTypes.length > 0) {
                parts.push(`Type: ${readableTypes.join(', ')}`);
              }
            }

            if (place.geometry?.location) {
              const { lat, lng } = place.geometry.location;
              parts.push(`Coordinates: ${lat}, ${lng}`);
            }

            return new FunctionResult(parts.join('\n'));
          } catch (err) {
            log.error('find_place_failed', { error: err instanceof Error ? err.message : String(err) });
            return new FunctionResult(
              'The request could not be completed. Please try again.',
            );
          }
        },
      },
      {
        name: geocodeToolName,
        description:
          'Geocode an address or business name to geographic coordinates (latitude and longitude). ' +
          'Optionally bias results toward a known location to find the nearest matching place. ' +
          'Returns the formatted address, latitude, and longitude.',
        parameters: {
          address: {
            type: 'string',
            description: 'The address or business name to geocode.',
          },
          bias_lat: {
            type: 'number',
            description: 'Latitude to bias results toward (optional).',
          },
          bias_lng: {
            type: 'number',
            description: 'Longitude to bias results toward (optional).',
          },
        },
        required: ['address'],
        handler: async (args: Record<string, unknown>) => {
          const address = args.address as string | undefined;

          if (!address || typeof address !== 'string' || address.trim().length === 0) {
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

          const biasLat = typeof args.bias_lat === 'number' ? args.bias_lat : undefined;
          const biasLng = typeof args.bias_lng === 'number' ? args.bias_lng : undefined;

          try {
            let urlStr =
              `https://maps.googleapis.com/maps/api/geocode/json` +
              `?address=${encodeURIComponent(address.trim())}` +
              `&key=${apiKey}`;

            if (biasLat !== undefined && biasLng !== undefined) {
              // Bias toward a 50 km radius around the given coordinates
              const delta = 0.45; // ~50 km in degrees
              urlStr +=
                `&bounds=${biasLat - delta},${biasLng - delta}|${biasLat + delta},${biasLng + delta}`;
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

            const result = data.results[0];
            const { lat, lng } = result.geometry.location;
            const parts: string[] = [
              `Address: ${result.formatted_address}`,
              `Coordinates: ${lat}, ${lng}`,
            ];

            return new FunctionResult(parts.join('\n'));
          } catch (err) {
            log.error('geocode_address_failed', { error: err instanceof Error ? err.message : String(err) });
            return new FunctionResult(
              'The request could not be completed. Please try again.',
            );
          }
        },
      },
      {
        name: routeByCoordsToolName,
        description:
          'Compute a driving route between two geographic coordinates using the Google Routes API. ' +
          'Returns distance in meters and estimated travel time in seconds.',
        parameters: {
          origin_latitude: {
            type: 'number',
            description: 'Origin latitude.',
          },
          origin_longitude: {
            type: 'number',
            description: 'Origin longitude.',
          },
          destination_latitude: {
            type: 'number',
            description: 'Destination latitude.',
          },
          destination_longitude: {
            type: 'number',
            description: 'Destination longitude.',
          },
        },
        required: ['origin_latitude', 'origin_longitude', 'destination_latitude', 'destination_longitude'],
        handler: async (args: Record<string, unknown>) => {
          const originLat = typeof args.origin_latitude === 'number' ? args.origin_latitude : undefined;
          const originLng = typeof args.origin_longitude === 'number' ? args.origin_longitude : undefined;
          const destLat = typeof args.destination_latitude === 'number' ? args.destination_latitude : undefined;
          const destLng = typeof args.destination_longitude === 'number' ? args.destination_longitude : undefined;

          if (originLat === undefined || originLng === undefined || destLat === undefined || destLng === undefined) {
            return new FunctionResult(
              'All four coordinates are required: origin_latitude, origin_longitude, destination_latitude, destination_longitude.',
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

            const route = data.routes[0];
            const distanceMeters = route.distanceMeters ?? 0;
            const durationSeconds = route.duration ? parseInt(route.duration.replace(/s$/, ''), 10) : 0;
            const distanceMiles = distanceMeters / 1609.344;
            const durationMin = durationSeconds / 60.0;

            return new FunctionResult(
              `Distance: ${distanceMiles.toFixed(1)} miles\n` +
              `Estimated travel time: ${Math.floor(durationMin)} minutes`,
            );
          } catch (err) {
            log.error('compute_route_by_coords_failed', { error: err instanceof Error ? err.message : String(err) });
            return new FunctionResult(
              'The request could not be completed. Please try again.',
            );
          }
        },
      },
    ];
  }

  /** @returns Prompt section describing directions and place search capabilities. */
  protected override _getPromptSections(): SkillPromptSection[] {
    const defaultMode = this.getConfig<string>('default_mode', 'driving');

    return [
      {
        title: 'Google Maps & Directions',
        body: 'You can look up directions between locations and search for places.',
        bullets: [
          'Use the get_directions tool to provide driving, walking, bicycling, or transit directions between two locations.',
          `The default travel mode is ${defaultMode}. The user can request a different mode.`,
          'Directions include total distance, estimated duration, and step-by-step navigation.',
          'Use the find_place tool to search for businesses, landmarks, or any point of interest.',
          'Place results include address, rating, and whether the place is currently open.',
          'Use the geocode_address tool to convert an address or business name into latitude and longitude coordinates.',
          'Use the compute_route_by_coords tool to get driving distance and travel time between two sets of coordinates.',
          'Summarize directions naturally rather than reading each step verbatim unless the user asks for details.',
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
