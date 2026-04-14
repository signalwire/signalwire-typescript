/**
 * ConciergeAgent - Prefab agent that acts as a virtual concierge for a venue
 * or business, providing information about services, amenities, and hours,
 * and answering availability and directions questions.
 *
 * Ported from the Python SDK `signalwire.prefabs.concierge.ConciergeAgent`.
 */

import { AgentBase } from '../AgentBase.js';
import { FunctionResult } from '../FunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

export interface ConciergeConfig {
  /** Name of the venue or business (required). */
  venueName: string;
  /** List of services offered by the venue (required). */
  services: string[];
  /** Dictionary of amenities, each mapping to a dict of detail keys/values. */
  amenities: Record<string, Record<string, string>>;
  /** Optional hours of operation by category (e.g. `{ default: "9 AM - 5 PM" }`). */
  hoursOfOperation?: Record<string, string>;
  /** Optional special instructions appended to the agent's instruction bullets. */
  specialInstructions?: string[];
  /** Optional custom welcome message spoken as a non-bargeable static greeting. */
  welcomeMessage?: string;
  /** Agent display name (defaults to `"concierge"`). */
  name?: string;
  /** HTTP route for this agent (defaults to `"/concierge"`). */
  route?: string;
  /** Additional AgentBase options forwarded to `super()`. */
  agentOptions?: Partial<AgentOptions>;
}

// ── Agent ───────────────────────────────────────────────────────────────────

/**
 * Prefab agent that acts as a virtual concierge for a venue, providing information
 * about services, amenities, hours of operation, availability, and directions.
 */
export class ConciergeAgent extends AgentBase {
  /** Name of the venue or business. */
  public venueName: string;
  /** List of services offered by the venue. */
  public services: string[];
  /** Dictionary of amenities, each mapping to a dict of detail keys/values. */
  public amenities: Record<string, Record<string, string>>;
  /** Hours of operation by category. Defaults to `{ default: "9 AM - 5 PM" }`. */
  public hoursOfOperation: Record<string, string>;
  /** Special instructions appended to the agent's instruction bullets. */
  public specialInstructions: string[];

  /**
   * Create a ConciergeAgent for a venue with the given services, amenities, and hours.
   * @param config - Configuration including venue name, services, amenities, and optional hours/instructions/welcome.
   */
  constructor(config: ConciergeConfig) {
    const agentName = config.name ?? 'concierge';
    super({
      name: agentName,
      route: config.route ?? '/concierge',
      usePom: true,
      ...config.agentOptions,
    });

    // Store configuration
    this.venueName = config.venueName;
    this.services = config.services;
    this.amenities = config.amenities;
    this.hoursOfOperation = config.hoursOfOperation ?? { default: '9 AM - 5 PM' };
    this.specialInstructions = config.specialInstructions ?? [];

    // Build the agent prompt and settings
    this.setupConciergeAgent(config.welcomeMessage);

    // Register tools after all fields are initialized
    this.defineTools();
  }

  /** Configure the concierge agent's prompt, hints, params, and global data. */
  private setupConciergeAgent(welcomeMessage?: string): void {
    // Personality
    this.promptAddSection('Personality', {
      body: `You are a professional and helpful virtual concierge for ${this.venueName}.`,
    });

    // Goal
    this.promptAddSection('Goal', {
      body: 'Provide exceptional service by helping users with information, recommendations, and booking assistance.',
    });

    // Instructions (base + special)
    const instructions = [
      'Be warm and welcoming but professional at all times.',
      'Provide accurate information about amenities, services, and operating hours.',
      'Offer to help with reservations and bookings when appropriate.',
      'Answer questions concisely with specific, relevant details.',
      ...this.specialInstructions,
    ];
    this.promptAddSection('Instructions', { bullets: instructions });

    // Services
    const servicesList = this.services.join(', ');
    this.promptAddSection('Available Services', {
      body: `The following services are available: ${servicesList}`,
    });

    // Amenities (each as a subsection)
    const amenitiesSubsections = Object.entries(this.amenities).map(([name, details]) => ({
      title: this.titleCase(name),
      body: Object.entries(details)
        .map(([k, v]) => `${this.titleCase(k)}: ${v}`)
        .join('\n'),
    }));
    this.promptAddSection('Amenities', {
      body: 'Information about available amenities:',
      subsections: amenitiesSubsections,
    });

    // Hours of operation
    const hoursList = Object.entries(this.hoursOfOperation)
      .map(([k, v]) => `${this.titleCase(k)}: ${v}`)
      .join('\n');
    this.promptAddSection('Hours of Operation', { body: hoursList });

    // Post-prompt summary template
    this.setPostPrompt(`
        Return a JSON summary of this interaction:
        {
            "topic": "MAIN_TOPIC",
            "service_requested": "SPECIFIC_SERVICE_REQUESTED_OR_null",
            "questions_answered": ["QUESTION_1", "QUESTION_2"],
            "follow_up_needed": true/false
        }
        `);

    // Hints for speech recognition
    this.addHints([
      this.venueName,
      ...this.services,
      ...Object.keys(this.amenities),
    ]);

    // AI behavior params
    this.setParams({
      wait_for_user: false,
      end_of_speech_timeout: 1000,
      ai_volume: 5,
      local_tz: 'America/New_York',
    });

    // Global data
    this.setGlobalData({
      venue_name: this.venueName,
      services: this.services,
      amenities: this.amenities,
      hours: this.hoursOfOperation,
    });

    // Native functions
    this.setNativeFunctions(['check_time']);

    // Custom welcome message (non-bargeable static greeting)
    if (welcomeMessage) {
      this.setParams({
        static_greeting: welcomeMessage,
        static_greeting_no_barge: true,
      });
    }
  }

  private titleCase(value: string): string {
    // Mirrors Python's str.title(): title-cases each word separated by non-letters.
    return value.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  // ── Tool registration ─────────────────────────────────────────────────

  /** Register the `check_availability` and `get_directions` SWAIG tools. */
  protected override defineTools(): void {
    // Tool: check_availability
    this.defineTool({
      name: 'check_availability',
      description: 'Check availability for a service on a specific date and time',
      parameters: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'The service to check (e.g., spa, restaurant)',
          },
          date: {
            type: 'string',
            description: 'The date to check (YYYY-MM-DD format)',
          },
          time: {
            type: 'string',
            description: 'The time to check (HH:MM format, 24-hour)',
          },
        },
        required: ['service', 'date', 'time'],
      },
      handler: (args: Record<string, unknown>) => {
        const service = ((args['service'] as string) ?? '').toLowerCase();
        const date = (args['date'] as string) ?? '';
        const time = (args['time'] as string) ?? '';

        // Simple availability simulation — in a real app this would hit a booking system.
        const lowerServices = this.services.map((s) => s.toLowerCase());
        if (lowerServices.includes(service)) {
          return new FunctionResult(
            `Yes, ${service} is available on ${date} at ${time}. Would you like to make a reservation?`,
          );
        }
        return new FunctionResult(
          `I'm sorry, we don't offer ${service} at ${this.venueName}. ` +
            `Our available services are: ${this.services.join(', ')}.`,
        );
      },
    });

    // Tool: get_directions
    this.defineTool({
      name: 'get_directions',
      description: 'Get directions to a specific location or amenity',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The location or amenity to get directions to',
          },
        },
        required: ['location'],
      },
      handler: (args: Record<string, unknown>) => {
        const location = ((args['location'] as string) ?? '').toLowerCase();

        const amenity = this.amenities[location];
        if (amenity && typeof amenity['location'] === 'string') {
          const amenityLocation = amenity['location'];
          return new FunctionResult(
            `The ${location} is located at ${amenityLocation}. ` +
              `From the main entrance, follow the signs to ${amenityLocation}.`,
          );
        }
        return new FunctionResult(
          `I don't have specific directions to ${location}. ` +
            'You can ask our staff at the front desk for assistance.',
        );
      },
    });
  }

  // ── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Process the interaction summary returned at the end of a call.
   * Logs structured summaries as JSON. Subclasses may override to persist or process.
   */
  override onSummary(
    summary: Record<string, unknown> | null,
    _rawData: Record<string, unknown>,
  ): void | Promise<void> {
    if (summary) {
      try {
        // eslint-disable-next-line no-console
        console.log(`Concierge interaction summary: ${JSON.stringify(summary, null, 2)}`);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(`Error processing summary: ${String(err)}`);
      }
    }
  }
}

// ── Factory function ────────────────────────────────────────────────────────

/**
 * Factory function that creates and returns a new ConciergeAgent.
 * @param config - Configuration for the concierge agent.
 * @returns A configured ConciergeAgent instance.
 */
export function createConciergeAgent(config: ConciergeConfig): ConciergeAgent {
  return new ConciergeAgent(config);
}

export default ConciergeAgent;
