/**
 * REST Example: IVR input collection, AI operations, and advanced call control.
 *
 * NOTE: These commands require an active call. The CALL_ID used here is
 * illustrative -- in production you would obtain it from a dial response or
 * inbound call event.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-calling-ivr-and-ai.ts
 */

import { RestClient, RestError } from '../../src/index.js';

const client = new RestClient();
const CALL_ID = 'demo-call-id';

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const result = await fn();
    console.log(`  ${label}: OK`);
    return result;
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  ${label}: failed (${err.statusCode})`);
    } else throw err;
    return null;
  }
}

async function main() {
  // 1. Collect DTMF input
  console.log('Collecting DTMF input...');
  await safe('Collect', () =>
    client.calling.collect(CALL_ID, {
      control_id: 'collect-1',
      initial_timeout: 10,
      digits: { max: 4, terminators: '#' },
    }),
  );
  await safe('Start input timers', () =>
    client.calling.collectStartInputTimers(CALL_ID, 'collect-1'),
  );
  await safe('Stop collect', () => client.calling.collectStop(CALL_ID, 'collect-1'));

  // 2. Answering machine detection
  console.log('\nDetecting answering machine...');
  await safe('Detect', () =>
    client.calling.detect(CALL_ID, { type: 'machine' }, { control_id: 'detect-1' }),
  );
  await safe('Stop detect', () => client.calling.detectStop(CALL_ID, 'detect-1'));

  // 3. AI operations
  console.log('\nAI agent operations...');
  await safe('AI message', () =>
    client.calling.aiMessage(CALL_ID, {
      role: 'system',
      message_text: 'The customer wants to check their balance.',
    }),
  );
  await safe('AI hold', () => client.calling.aiHold(CALL_ID));
  await safe('AI unhold', () => client.calling.aiUnhold(CALL_ID));
  await safe('AI stop', () => client.calling.aiStop(CALL_ID, 'ai-1'));

  // 4. Live transcription and translation
  console.log('\nLive transcription and translation...');
  await safe('Live transcribe', () =>
    client.calling.liveTranscribe(CALL_ID, {
      start: { lang: 'en-US', direction: ['remote-caller'] },
    }),
  );
  await safe('Live translate', () =>
    client.calling.liveTranslate(CALL_ID, {
      start: { from_lang: 'en-US', to_lang: 'es-ES', direction: ['remote-caller'] },
    }),
  );

  // 5. Tap (media fork)
  console.log('\nTap (media fork)...');
  await safe('Tap start', () =>
    client.calling.tap(
      CALL_ID,
      { type: 'audio', params: { direction: 'both' } },
      { type: 'rtp', params: { addr: '192.168.1.100', port: 9000 } },
    ),
  );
  await safe('Tap stop', () => client.calling.tapStop(CALL_ID, 'tap-1'));

  // 6. Stream (WebSocket)
  console.log('\nStream (WebSocket)...');
  await safe('Stream start', () =>
    client.calling.stream(CALL_ID, 'wss://example.com/audio-stream'),
  );
  await safe('Stream stop', () => client.calling.streamStop(CALL_ID, 'stream-1'));

  // 7. User event
  console.log('\nSending user event...');
  await safe('User event', () =>
    client.calling.userEvent(CALL_ID, {
      event: { agent_note: { note: 'VIP caller' } },
    }),
  );

  // 8. SIP refer
  console.log('\nSIP refer...');
  await safe('SIP refer', () =>
    client.calling.refer(CALL_ID, {
      device: { type: 'sip', params: { to: 'sip:support@example.com' } },
    }),
  );

  // 9. Fax stop commands
  console.log('\nFax stop commands...');
  await safe('Send fax stop', () => client.calling.sendFaxStop(CALL_ID, 'fax-1'));
  await safe('Receive fax stop', () => client.calling.receiveFaxStop(CALL_ID, 'fax-1'));

  // 10. Transfer and disconnect
  console.log('\nTransfer and disconnect...');
  await safe('Transfer', () => client.calling.transfer(CALL_ID, '+15559999999'));
  await safe('Update call', () =>
    client.calling.update(CALL_ID, {
      status_url: 'https://example.com/status',
      url: 'https://example.com/swml/next-step',
    }),
  );
  await safe('Disconnect', () => client.calling.disconnect(CALL_ID));
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
