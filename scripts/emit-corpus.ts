/**
 * emit-corpus.ts — the TypeScript port's EMISSION-DUMP program for the cross-port
 * emission differ (porting-sdk/scripts/diff_port_emission.py).
 *
 * It builds the shared FunctionResult corpus
 * (porting-sdk/scripts/emission_corpus.py — the single source of truth) using
 * the TS SDK's native FunctionResult API, serialises each entry the same way the
 * SDK serialises on the wire (toDict()), and prints ONE JSON object mapping
 *
 *   corpus-id -> emission
 *
 * to stdout. The differ runs this program, parses that object, and byte-compares
 * each entry against Python's to_dict(). See the "per-port dump contract" in the
 * differ's --help and IDIOM_PASS_JOURNAL.md §4 Tier-0.
 *
 * CONTRACT (why this file looks the way it does):
 *   - Every corpus id in emission_corpus.corpus_ids() MUST appear here exactly
 *     once (the differ rejects an id-set mismatch as a setup error — a skewed set
 *     would mask real diffs). When the shared corpus grows, add the new id here.
 *   - The argument VALUES are the WIRE values (plain strings/numbers/bools/objects).
 *     Where the TS API types a closed set (record format/direction, tap
 *     direction/codec via literal unions) we pass the literal whose string value
 *     is the wire value, proving the typed path emits byte-identically.
 *   - Only stdout carries the JSON object; nothing else is printed there. (This
 *     program prints nothing to stderr on success.)
 *
 * Run from the signalwire-typescript repo root:
 *
 *   npx tsx scripts/emit-corpus.ts
 *
 * The TS API takes option OBJECTS where Python takes positional/keyword args; the
 * builders below translate each canonical corpus entry (Python wire shape) into
 * the equivalent native call.
 */

import { FunctionResult } from '../src/FunctionResult.js';

/** entry pairs a stable corpus id with the FunctionResult it produces. Building
 *  the result lazily (a thunk) keeps each line a single, readable native call. */
interface Entry {
  id: string;
  build: () => FunctionResult;
}

/** fr is a tiny constructor helper mirroring Go's `fr(response)`. */
const fr = (response: string): FunctionResult => new FunctionResult(response);

// The Python default ai_response for pay(); spelled out so the pay.full entry can
// pass the corpus's explicit ai_response (which equals this default).
const PAY_AI_RESPONSE =
  'The payment status is ${pay_result}, do not mention anything else about ' +
  'collecting payment if successful.';

// corpus is the TS-native mirror of porting-sdk/scripts/emission_corpus.py.
// The ids and the resulting emission must match the Python oracle exactly
// (modulo the whole-float artifact the differ normalises: Python 44.0 == TS 44).
const corpus: Entry[] = [
  // ---- envelope edge cases (toDict() shape) -------------------------------
  { id: 'envelope.empty', build: () => fr('') },
  { id: 'envelope.response_only', build: () => fr('Hello, world!') },
  { id: 'envelope.post_process_no_action', build: () => fr('hi').setPostProcess(true) },
  { id: 'envelope.action_only', build: () => fr('').hangup() },
  {
    id: 'envelope.post_process_with_action',
    build: () => fr('Transferring').setPostProcess(true).hangup(),
  },
  { id: 'envelope.response_and_action', build: () => fr('Goodbye').hangup() },

  // ---- connect (final true/false, from override) --------------------------
  { id: 'connect.final_true', build: () => fr('').connect('+15551234567', true) },
  { id: 'connect.final_false', build: () => fr('').connect('+15551234567', false) },
  {
    id: 'connect.from_addr',
    build: () => fr('').connect('support@example.com', false, '+15559876543'),
  },

  // ---- swml_transfer ------------------------------------------------------
  {
    id: 'swml_transfer.default',
    build: () => fr('').swmlTransfer('https://dest.example.com/swml', 'Goodbye!'),
  },
  {
    id: 'swml_transfer.final_false',
    build: () =>
      fr('').swmlTransfer(
        'https://dest.example.com/swml',
        'Welcome back. How else can I help?',
        false,
      ),
  },

  // ---- simple call-control actions ---------------------------------------
  { id: 'hangup', build: () => fr('').hangup() },
  { id: 'hold.default', build: () => fr('').hold() },
  { id: 'hold.value', build: () => fr('').hold(120) },
  { id: 'hold.clamp_high', build: () => fr('').hold(5000) },
  { id: 'hold.clamp_low', build: () => fr('').hold(-5) },
  { id: 'stop', build: () => fr('').stop() },
  { id: 'say', build: () => fr('').say('Please hold while I connect you.') },

  // ---- wait_for_user (each branch) ---------------------------------------
  { id: 'wait_for_user.default', build: () => fr('').waitForUser() },
  { id: 'wait_for_user.answer_first', build: () => fr('').waitForUser({ answerFirst: true }) },
  { id: 'wait_for_user.timeout', build: () => fr('').waitForUser({ timeout: 30 }) },
  { id: 'wait_for_user.enabled_true', build: () => fr('').waitForUser({ enabled: true }) },
  { id: 'wait_for_user.enabled_false', build: () => fr('').waitForUser({ enabled: false }) },

  // ---- global data / metadata (set/unset, str + list) --------------------
  { id: 'set_global_data', build: () => fr('').updateGlobalData({ plan: 'premium', chips: 1000 }) },
  { id: 'unset_global_data.list', build: () => fr('').removeGlobalData(['plan', 'chips']) },
  { id: 'unset_global_data.str', build: () => fr('').removeGlobalData('plan') },
  { id: 'set_metadata', build: () => fr('').setMetadata({ token: 'abc', count: 3 }) },
  { id: 'unset_metadata.list', build: () => fr('').removeMetadata(['token', 'count']) },
  { id: 'unset_metadata.str', build: () => fr('').removeMetadata('token') },

  // ---- swml_user_event ----------------------------------------------------
  {
    id: 'swml_user_event',
    build: () =>
      fr('').swmlUserEvent({ type: 'cards_dealt', player_hand: ['AS', 'KH'], player_score: 21 }),
  },

  // ---- step / context changes --------------------------------------------
  { id: 'change_step', build: () => fr('').swmlChangeStep('collect_payment') },
  { id: 'change_context', build: () => fr('').swmlChangeContext('billing') },

  // ---- switch_context (simple-string vs object branches) -----------------
  {
    id: 'switch_context.simple',
    build: () => fr('').switchContext({ systemPrompt: 'You are now a billing agent.' }),
  },
  {
    id: 'switch_context.object',
    build: () =>
      fr('').switchContext({
        systemPrompt: 'New system prompt',
        userPrompt: 'User said something',
        consolidate: true,
        fullReset: false,
      }),
  },
  {
    id: 'switch_context.full_reset',
    build: () =>
      fr('').switchContext({ systemPrompt: 'Reset prompt', consolidate: false, fullReset: true }),
  },

  // ---- background file play/stop -----------------------------------------
  { id: 'playback_bg.simple', build: () => fr('').playBackgroundFile('music.mp3') },
  { id: 'playback_bg.wait', build: () => fr('').playBackgroundFile('music.mp3', true) },
  { id: 'stop_playback_bg', build: () => fr('').stopBackgroundFile() },

  // ---- join_room / sip_refer ---------------------------------------------
  { id: 'join_room', build: () => fr('').joinRoom('team-standup') },
  { id: 'sip_refer', build: () => fr('').sipRefer('sip:agent@example.com') },

  // ---- send_sms -----------------------------------------------------------
  {
    id: 'send_sms.body',
    build: () =>
      fr('').sendSms({
        toNumber: '+15551112222',
        fromNumber: '+15553334444',
        body: 'Your appointment is confirmed.',
      }),
  },
  {
    id: 'send_sms.full',
    build: () =>
      fr('').sendSms({
        toNumber: '+15551112222',
        fromNumber: '+15553334444',
        body: 'See attached.',
        media: ['https://ex.com/a.jpg'],
        tags: ['receipt', 'vip'],
        region: 'us',
      }),
  },

  // ---- pay (full + helper-shaped prompts/parameters) ---------------------
  {
    id: 'pay.minimal',
    build: () => fr('').pay({ paymentConnectorUrl: 'https://pay.example.com/connector' }),
  },
  {
    id: 'pay.full',
    build: () =>
      fr('').pay({
        paymentConnectorUrl: 'https://pay.example.com/connector',
        inputMethod: 'dtmf',
        statusUrl: 'https://ex.com/status',
        paymentMethod: 'credit-card',
        timeout: 7,
        maxAttempts: 2,
        securityCode: false,
        postalCode: '90210',
        minPostalCodeLength: 5,
        tokenType: 'one-time',
        chargeAmount: '9.99',
        currency: 'usd',
        language: 'en-US',
        voice: 'woman',
        description: 'Order 42',
        validCardTypes: 'visa amex',
        // helper-shaped data (createPaymentParameter / createPaymentPrompt /
        // createPaymentAction output): plain objects the corpus inlines so the
        // static-helper emission is covered through pay().
        parameters: [{ name: 'order_id', value: '42' }],
        prompts: [
          {
            for: 'payment-card-number',
            actions: [{ type: 'Say', phrase: 'Enter your card number' }],
            card_type: 'visa amex',
          },
        ],
        aiResponse: PAY_AI_RESPONSE,
      }),
  },
  {
    id: 'pay.postal_bool',
    build: () =>
      fr('').pay({ paymentConnectorUrl: 'https://pay.example.com/connector', postalCode: true }),
  },

  // ---- record_call (incl. mp4 + each direction) --------------------------
  { id: 'record_call.defaults', build: () => fr('').recordCall() },
  {
    id: 'record_call.wav_speak',
    build: () => fr('').recordCall({ format: 'wav', direction: 'speak' }),
  },
  {
    id: 'record_call.mp3_listen',
    build: () => fr('').recordCall({ format: 'mp3', direction: 'listen' }),
  },
  {
    id: 'record_call.mp4_both',
    build: () => fr('').recordCall({ format: 'mp4', direction: 'both' }),
  },
  {
    id: 'record_call.full',
    build: () =>
      fr('').recordCall({
        controlId: 'rec1',
        stereo: true,
        format: 'mp3',
        direction: 'both',
        terminators: '#',
        beep: true,
        inputSensitivity: 30.0,
        initialTimeout: 5.0,
        endSilenceTimeout: 3.0,
        maxLength: 120.0,
        statusUrl: 'https://ex.com/rec',
      }),
  },
  { id: 'stop_record_call.bare', build: () => fr('').stopRecordCall() },
  { id: 'stop_record_call.id', build: () => fr('').stopRecordCall('rec1') },

  // ---- tap (each direction / codec) --------------------------------------
  { id: 'tap.defaults', build: () => fr('').tap({ uri: 'rtp://10.0.0.1:5004' }) },
  {
    id: 'tap.speak_pcma',
    build: () => fr('').tap({ uri: 'ws://ex.com/tap', direction: 'speak', codec: 'PCMA' }),
  },
  {
    id: 'tap.hear_pcmu',
    build: () => fr('').tap({ uri: 'wss://ex.com/tap', direction: 'hear', codec: 'PCMU' }),
  },
  {
    id: 'tap.both_full',
    build: () =>
      fr('').tap({
        uri: 'rtp://10.0.0.1:5004',
        controlId: 'tap1',
        direction: 'both',
        codec: 'PCMA',
        rtpPtime: 40,
        statusUrl: 'https://ex.com/tapstatus',
      }),
  },
  { id: 'stop_tap.bare', build: () => fr('').stopTap() },
  { id: 'stop_tap.id', build: () => fr('').stopTap('tap1') },

  // ---- join_conference (simple + full) -----------------------------------
  { id: 'join_conference.simple', build: () => fr('').joinConference('sales-floor') },
  {
    id: 'join_conference.full',
    build: () =>
      fr('').joinConference('sales-floor', {
        muted: true,
        beep: 'onEnter',
        startOnEnter: false,
        endOnExit: true,
        waitUrl: 'https://ex.com/hold',
        maxParticipants: 50,
        record: 'record-from-start',
        region: 'us-east',
        trim: 'do-not-trim',
        coach: 'call-123',
        statusCallbackEvent: 'start end join leave',
        statusCallback: 'https://ex.com/cb',
        statusCallbackMethod: 'GET',
        recordingStatusCallback: 'https://ex.com/rcb',
        recordingStatusCallbackMethod: 'GET',
        recordingStatusCallbackEvent: 'in-progress completed',
      }),
  },

  // ---- execute_rpc + the three rpc helpers -------------------------------
  { id: 'execute_rpc.minimal', build: () => fr('').executeRpc({ method: 'ai_unhold' }) },
  {
    id: 'execute_rpc.full',
    build: () =>
      fr('').executeRpc({
        method: 'ai_message',
        params: { role: 'system', message_text: 'Hello' },
        callId: 'call-abc',
        nodeId: 'node-1',
      }),
  },
  {
    id: 'rpc_dial',
    build: () => fr('').rpcDial('+15551234567', '+15559876543', 'https://ex.com/call-agent'),
  },
  { id: 'rpc_ai_message', build: () => fr('').rpcAiMessage('call-abc', 'Please take a message.') },
  { id: 'rpc_ai_unhold', build: () => fr('').rpcAiUnhold('call-abc') },

  // ---- simulate_user_input -----------------------------------------------
  { id: 'simulate_user_input', build: () => fr('').simulateUserInput("I'd like to pay my bill.") },

  // ---- dynamic hints ------------------------------------------------------
  {
    id: 'add_dynamic_hints',
    build: () =>
      fr('').addDynamicHints([
        'Cabby',
        { pattern: 'cab bee', replace: 'Cabby', ignore_case: true },
      ]),
  },
  { id: 'clear_dynamic_hints', build: () => fr('').clearDynamicHints() },

  // ---- toggle_functions / functions-on-timeout ---------------------------
  {
    id: 'toggle_functions',
    build: () =>
      fr('').toggleFunctions([
        { function: 'transfer', active: false },
        { function: 'lookup', active: true },
      ]),
  },
  { id: 'functions_on_speaker_timeout.true', build: () => fr('').enableFunctionsOnTimeout() },
  { id: 'functions_on_speaker_timeout.false', build: () => fr('').enableFunctionsOnTimeout(false) },

  // ---- extensive_data -----------------------------------------------------
  { id: 'extensive_data.true', build: () => fr('').enableExtensiveData() },
  { id: 'extensive_data.false', build: () => fr('').enableExtensiveData(false) },

  // ---- replace_in_history (str + bool branches) --------------------------
  { id: 'replace_in_history.bool', build: () => fr('').replaceInHistory() },
  { id: 'replace_in_history.str', build: () => fr('').replaceInHistory('Summarized the order.') },

  // ---- settings -----------------------------------------------------------
  {
    id: 'settings',
    build: () => fr('').updateSettings({ temperature: 0.7, 'max-tokens': 256, 'top-p': 0.9 }),
  },

  // ---- speech timeouts ----------------------------------------------------
  { id: 'end_of_speech_timeout', build: () => fr('').setEndOfSpeechTimeout(800) },
  { id: 'speech_event_timeout', build: () => fr('').setSpeechEventTimeout(1200) },

  // ---- execute_swml (dict + JSON-string + transfer) ----------------------
  {
    id: 'execute_swml.dict',
    build: () => fr('').executeSwml({ version: '1.0.0', sections: { main: [{ answer: {} }] } }),
  },
  {
    id: 'execute_swml.dict_transfer',
    build: () =>
      fr('').executeSwml({ version: '1.0.0', sections: { main: [{ answer: {} }] } }, true),
  },
  {
    id: 'execute_swml.json_string',
    build: () => fr('').executeSwml('{"version": "1.0.0", "sections": {"main": [{"hangup": {}}]}}'),
  },
];

function main(): void {
  const out: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const e of corpus) {
    if (seen.has(e.id)) {
      process.stderr.write(`emit-corpus: duplicate corpus id ${JSON.stringify(e.id)}\n`);
      process.exit(1);
    }
    seen.add(e.id);
    out[e.id] = e.build().toDict();
  }
  // One JSON object on stdout, nothing else. JSON.stringify keeps '+'/'&' literal
  // (no HTML escaping), matching Python's json.dumps output.
  process.stdout.write(JSON.stringify(out) + '\n');
}

main();
