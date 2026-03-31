/**
 * Auto-Vivified SWML Service Example
 *
 * Demonstrates auto-vivification: calling verb methods directly on a SWMLService
 * instead of using addVerb(). Builds voicemail, IVR, and transfer services.
 * Run: npx tsx examples/auto-vivified.ts
 */

import { SWMLService } from '../src/index.js';

// --- Voicemail Service ---
const voicemail = new SWMLService({
  name: 'voicemail',
  route: '/voicemail',
});

voicemail.addAnswerVerb();

// Auto-vivified verb calls (direct method instead of addVerb)
voicemail.play({ url: 'say:Hello, you have reached the voicemail service. Please leave a message after the beep.' });
voicemail.sleep(1000);
voicemail.play({ url: 'https://example.com/beep.wav' });
voicemail.record({
  format: 'mp3',
  stereo: false,
  beep: false,
  max_length: 120,
  terminators: '#',
  status_url: 'https://example.com/voicemail-status',
});
voicemail.play({ url: 'say:Thank you for your message. Goodbye!' });
voicemail.addHangupVerb();

// --- IVR Menu Service ---
const ivr = new SWMLService({
  name: 'ivr',
  route: '/ivr',
});

ivr.addAnswerVerb();

ivr.addSection('main_menu');
ivr.addVerbToSection('main_menu', 'prompt', {
  play: 'say:Press 1 for sales, 2 for support, or 3 to leave a message.',
  max_digits: 1,
  terminators: '#',
  digit_timeout: 5.0,
});

ivr.addVerbToSection('main_menu', 'switch', {
  variable: 'prompt_digits',
  case: {
    '1': [{ transfer: { dest: 'sales' } }],
    '2': [{ transfer: { dest: 'support' } }],
    '3': [{ transfer: { dest: 'voicemail_section' } }],
  },
  default: [
    { play: { url: "say:Sorry, I didn't understand." } },
    { transfer: { dest: 'main_menu' } },
  ],
});

ivr.addSection('sales');
ivr.addVerbToSection('sales', 'play', { url: 'say:Connecting you to sales.' });
ivr.addVerbToSection('sales', 'connect', { to: '+15551234567' });

ivr.addVerb('transfer', { dest: 'main_menu' });

// --- Call Transfer Service ---
const transfer = new SWMLService({
  name: 'transfer',
  route: '/transfer',
});

transfer.addAnswerVerb();
transfer.addVerb('play', { url: 'say:Connecting you with the next available agent.' });
transfer.addVerb('connect', {
  from: '+15551234567',
  timeout: 30,
  answer_on_bridge: true,
  ringback: ['ring:us'],
  parallel: [
    { to: '+15552223333' },
    { to: '+15554445555' },
  ],
});
transfer.addVerb('play', { url: 'say:All agents are busy. Please leave a message.' });
transfer.addVerb('record', { format: 'mp3', beep: true, max_length: 120, terminators: '#' });
transfer.addHangupVerb();

// Run the voicemail service by default (switch via --service flag)
const service = process.argv[2] === 'ivr' ? ivr : process.argv[2] === 'transfer' ? transfer : voicemail;
console.log(`Starting ${service.name} service...`);
service.run();
