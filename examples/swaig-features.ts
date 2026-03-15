/**
 * SWAIG Features Showcase
 *
 * Demonstrates the full range of SwaigFunctionResult actions:
 * hangup, hold, say, context switching, dynamic hints, global data,
 * metadata, toggleFunctions, background audio, and more.
 * Run: npx tsx examples/swaig-features.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'features-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a demo assistant showing off all SWAIG function result actions. ' +
  'The user can ask you to perform various call control actions.',
);

// Hang up the call
agent.defineTool({
  name: 'end_call',
  description: 'End the call when the user wants to hang up',
  parameters: {},
  handler: () => {
    const result = new SwaigFunctionResult('Goodbye! Ending the call now.');
    result.hangup();
    return result;
  },
});

// Place on hold
agent.defineTool({
  name: 'hold_call',
  description: 'Place the caller on hold',
  parameters: {
    seconds: { type: 'number', description: 'Hold duration in seconds (max 900)' },
  },
  handler: (args) => {
    const secs = (args.seconds as number) ?? 60;
    const result = new SwaigFunctionResult(
      `Placing you on hold for ${secs} seconds.`,
    );
    result.hold(secs);
    return result;
  },
});

// Say something via TTS
agent.defineTool({
  name: 'announce',
  description: 'Make an announcement to the caller',
  parameters: {
    message: { type: 'string', description: 'The announcement message' },
  },
  handler: (args) => {
    const result = new SwaigFunctionResult('Making announcement.');
    result.say(args.message as string);
    return result;
  },
});

// Play background music
agent.defineTool({
  name: 'play_music',
  description: 'Play background music during the call',
  parameters: {
    url: { type: 'string', description: 'URL of the audio file' },
  },
  handler: (args) => {
    const result = new SwaigFunctionResult('Playing background music.');
    result.playBackgroundFile(args.url as string);
    return result;
  },
});

// Stop background music
agent.defineTool({
  name: 'stop_music',
  description: 'Stop any playing background music',
  parameters: {},
  handler: () => {
    const result = new SwaigFunctionResult('Stopping background music.');
    result.stopBackgroundFile();
    return result;
  },
});

// Update global data
agent.defineTool({
  name: 'save_preference',
  description: 'Save a user preference to the call session',
  parameters: {
    key: { type: 'string', description: 'Preference key' },
    value: { type: 'string', description: 'Preference value' },
  },
  handler: (args) => {
    const result = new SwaigFunctionResult(
      `Saved preference: ${args.key} = ${args.value}`,
    );
    result.updateGlobalData({ [args.key as string]: args.value });
    return result;
  },
});

// Set call metadata
agent.defineTool({
  name: 'tag_call',
  description: 'Add a tag to the current call for tracking',
  parameters: {
    tag: { type: 'string', description: 'Tag to add to the call' },
  },
  handler: (args) => {
    const result = new SwaigFunctionResult(`Call tagged as "${args.tag}".`);
    result.setMetadata({ tag: args.tag });
    return result;
  },
});

// Context switch
agent.defineTool({
  name: 'switch_mode',
  description: 'Switch the AI to a different mode or personality',
  parameters: {
    mode: { type: 'string', description: 'New mode: "formal" or "casual"' },
  },
  handler: (args) => {
    const prompt =
      args.mode === 'formal'
        ? 'You are now a formal, professional assistant. Use proper language.'
        : 'You are now a casual, friendly assistant. Be relaxed and conversational.';
    const result = new SwaigFunctionResult(`Switched to ${args.mode} mode.`);
    result.switchContext({ systemPrompt: prompt });
    return result;
  },
});

// Send SMS
agent.defineTool({
  name: 'send_sms',
  description: 'Send an SMS message to a phone number',
  parameters: {
    to: { type: 'string', description: 'Recipient phone number' },
    message: { type: 'string', description: 'SMS message text' },
  },
  handler: (args) => {
    const result = new SwaigFunctionResult(
      `SMS sent to ${args.to}: "${args.message}"`,
    );
    result.sendSms({
      toNumber: args.to as string,
      fromNumber: '+15551234567',
      body: args.message as string,
    });
    return result;
  },
});

// Toggle functions dynamically
agent.defineTool({
  name: 'lock_down',
  description: 'Disable all tools except end_call for security',
  parameters: {},
  handler: () => {
    const result = new SwaigFunctionResult(
      'Entering secure mode. Only the end call function is available.',
    );
    result.toggleFunctions([
      { function: 'hold_call', active: false },
      { function: 'announce', active: false },
      { function: 'play_music', active: false },
      { function: 'stop_music', active: false },
      { function: 'send_sms', active: false },
    ]);
    return result;
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
