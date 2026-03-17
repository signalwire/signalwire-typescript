/**
 * Room and SIP Actions Example
 *
 * Demonstrates SwaigFunctionResult actions for room joining,
 * SIP REFER transfers, and conference management.
 * Run: npx tsx examples/room-and-sip.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'room-sip-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a meeting coordinator. You can help callers join rooms, ' +
  'transfer calls via SIP, and manage conferences.',
);

// Join a SignalWire room
agent.defineTool({
  name: 'join_meeting_room',
  description: 'Join a meeting room by name',
  parameters: {
    room_name: { type: 'string', description: 'Name of the meeting room' },
  },
  handler: (args) => {
    const result = new SwaigFunctionResult(
      `Connecting you to room "${args.room_name}" now.`,
    );
    result.joinRoom(args.room_name as string);
    return result;
  },
});

// Transfer via SIP REFER
agent.defineTool({
  name: 'sip_transfer',
  description: 'Transfer the call to a SIP URI',
  parameters: {
    sip_uri: { type: 'string', description: 'SIP URI to transfer to (e.g., sip:user@domain.com)' },
  },
  handler: (args) => {
    const result = new SwaigFunctionResult(
      `Transferring your call to ${args.sip_uri}.`,
    );
    result.sipRefer(args.sip_uri as string);
    return result;
  },
});

// Join a conference call
agent.defineTool({
  name: 'join_conference',
  description: 'Join a named conference call',
  parameters: {
    conference_name: { type: 'string', description: 'Conference name to join' },
    muted: { type: 'boolean', description: 'Whether to join muted (default: false)' },
  },
  handler: (args) => {
    const muted = args.muted === true;
    const result = new SwaigFunctionResult(
      `Joining conference "${args.conference_name}"${muted ? ' (muted)' : ''}.`,
    );
    result.joinConference(args.conference_name as string, { muted });
    return result;
  },
});

// Connect to a phone number
agent.defineTool({
  name: 'connect_call',
  description: 'Connect the call to a phone number',
  parameters: {
    phone_number: { type: 'string', description: 'Phone number to connect to' },
  },
  handler: (args) => {
    const result = new SwaigFunctionResult(
      `Connecting you to ${args.phone_number}. Please hold.`,
    );
    result.connect(args.phone_number as string);
    return result;
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.addHints(['SIP', 'conference', 'meeting room', 'transfer']);

agent.run();
