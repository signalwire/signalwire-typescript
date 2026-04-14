/**
 * Receptionist Prefab Example
 *
 * Front-desk agent that greets callers, collects their name + reason for
 * calling, and transfers them to the appropriate department by phone
 * number. Optionally supports visitor check-in.
 *
 * Run: npx tsx examples/prefab-receptionist.ts
 */

import { ReceptionistAgent } from '../src/index.js';

export const agent = new ReceptionistAgent({
  name: 'front-desk',
  companyName: 'Acme Technologies',
  departments: [
    { name: 'engineering', description: 'Software development team', number: '+15551001001' },
    { name: 'marketing', description: 'Marketing and communications', number: '+15551001002' },
    { name: 'hr', description: 'Hiring and benefits', number: '+15551001003' },
    { name: 'finance', description: 'Accounting and finance', number: '+15551001004' },
  ],
  greeting: 'Welcome to Acme Technologies! How can I help you today?',
  checkInEnabled: true,
  onVisitorCheckIn: (visitor) => {
    console.log('Visitor checked in:', visitor);
  },
  agentOptions: {
    route: '/',
    basicAuth: [
      process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
      process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
    ],
  },
});

agent.run();
