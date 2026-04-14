/**
 * Concierge Prefab Example
 *
 * Virtual concierge for a venue. Answers questions about services,
 * amenities, and hours, and checks availability and directions.
 *
 * Run: npx tsx examples/prefab-concierge.ts
 */

import { ConciergeAgent } from '../src/index.js';

export const agent = new ConciergeAgent({
  name: 'hotel-concierge',
  venueName: 'Grand Plaza Hotel',
  services: [
    'room service',
    'spa bookings',
    'restaurant reservations',
    'airport shuttle',
  ],
  amenities: {
    pool: { hours: '7 AM - 10 PM', location: '2nd Floor (West Wing)' },
    gym: { hours: '24 hours', location: '3rd Floor' },
    spa: { hours: '9 AM - 8 PM', location: 'Ground Floor' },
    'business center': { hours: '24 hours', location: 'Lobby Level' },
  },
  hoursOfOperation: {
    weekday: '6 AM - 11 PM',
    weekend: '7 AM - midnight',
  },
  specialInstructions: [
    'Encourage guests to ask about our weekly wine tasting event.',
    'Mention our partnership with local attractions when asked for recommendations.',
  ],
  welcomeMessage: 'Welcome to the Grand Plaza Hotel concierge! How may I assist you today?',
  agentOptions: {
    route: '/',
    basicAuth: [
      process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
      process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
    ],
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
