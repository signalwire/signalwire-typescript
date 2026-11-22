// AUTO-GENERATED from porting-sdk/relay-protocol/*.{params,result}.json — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-relay-protocol.ts
//
// One interface per RELAY method's params (<Method>Params) and ack result
// (<Method>Result), from the canonical RELAY wire schemas. Held to the
// same lint bar as hand-written source (no rule suppressions, no loose types).

/** Wire schema for the JSON payload of `calling.ai_hold` (params). */
export interface CallingAiHoldParams {
  async?: boolean | null;
  call_id: string;
  node_id: string;
  prompt?: string;
  swml?: boolean | null;
  timeout?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.ai_message` (params). */
export interface CallingAiMessageParams {
  async?: boolean | null;
  call_id: string;
  global_data?: Record<string, unknown>;
  message_text?: string;
  node_id: string;
  reset?: Record<string, unknown>;
  role?: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.ai_unhold` (params). */
export interface CallingAiUnholdParams {
  async?: boolean | null;
  call_id: string;
  node_id: string;
  prompt?: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.amazon_bedrock` (params). */
export interface CallingAmazonBedrockParams {
  SWAIG?: Record<string, unknown>;
  async?: boolean | null;
  call_id: string;
  global_data?: Record<string, unknown>;
  node_id: string;
  params?: Record<string, unknown>;
  post_prompt?: Record<string, unknown>;
  post_prompt_url?: string;
  prompt?: Record<string, unknown>;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.answer` (params). */
export interface CallingAnswerParams {
  call_id: string;
  max_duration?: number | null;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.begin` (params). */
export interface CallingBeginParams {
  device: {
    params?: Record<string, unknown>;
    type: string;
  };
  max_duration?: number | null;
  node_id?: string;
  region?: string;
  tag?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.bind_digit` (params). */
export interface CallingBindDigitParams {
  bind_method: string;
  call_id: string;
  digits: string;
  max_triggers?: number | null;
  node_id: string;
  params?: Record<string, unknown>;
  realm?: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Placeholder schema for the server-side `calling.call` method, which has no typed params/result schema. The mock accepts any payload for this method. */
export type CallingCallParams = Record<string, unknown>;

/** Wire schema for the JSON payload of `calling.clear_digit_bindings` (params). */
export interface CallingClearDigitBindingsParams {
  call_id: string;
  node_id: string;
  realm?: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect` (params). */
export interface CallingCollectParams {
  call_id: string;
  continue?: boolean | null;
  continuous?: boolean | null;
  control_id: string;
  digits?: {
    digit_timeout?: number | null;
    max: number;
    min?: number | null;
    terminators?: string;
  };
  initial_timeout?: number | null;
  node_id: string;
  partial_results?: boolean | null;
  send_start_of_input?: boolean | null;
  speech?: {
    end_silence_timeout?: number | null;
    hints?: string[];
    language?: string;
    model?: string;
    speech_timeout?: number | null;
  };
  start_input_timers?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect.start_input_timers` (params). */
export interface CallingCollectStartInputTimersParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect.stop` (params). */
export interface CallingCollectStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.connect` (params). */
export interface CallingConnectParams {
  call_id: string;
  devices: {
    params?: Record<string, unknown>;
    type: string;
  }[][];
  max_duration?: number | null;
  max_price_per_minute?: number | null;
  node_id: string;
  ringback?: {
    params: Record<string, unknown>;
    type: string;
  }[];
  tag?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.denoise` (params). */
export interface CallingDenoiseParams {
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.denoise.stop` (params). */
export interface CallingDenoiseStopParams {
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.detect` (params). */
export interface CallingDetectParams {
  call_id: string;
  control_id: string;
  detect: {
    params: Record<string, unknown>;
    type: string;
  };
  node_id: string;
  timeout?: number | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.detect.stop` (params). */
export interface CallingDetectStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.dial` (params). */
export interface CallingDialParams {
  devices: {
    params?: Record<string, unknown>;
    type: string;
  }[][];
  max_price_per_minute?: number | null;
  node_id?: string;
  region?: string;
  tag?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.disconnect` (params). */
export interface CallingDisconnectParams {
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.echo` (params). */
export interface CallingEchoParams {
  call_id: string;
  node_id: string;
  status_url?: string;
  swml?: boolean | null;
  timeout?: number | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.end` (params). */
export interface CallingEndParams {
  call_id: string;
  node_id: string;
  reason?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.join_conference` (params). */
export interface CallingJoinConferenceParams {
  acl?: string;
  beep?: string;
  call_id: string;
  coach?: string;
  end_on_exit?: boolean | null;
  max_participants?: number | null;
  muted?: boolean | null;
  name: string;
  node_id: string;
  record?: string;
  recording_status_callback?: string;
  recording_status_callback_event?: string;
  recording_status_callback_event_type?: string;
  recording_status_callback_method?: string;
  region?: string;
  start_on_enter?: boolean | null;
  status_callback?: string;
  status_callback_event?: string;
  status_callback_event_type?: string;
  status_callback_method?: string;
  stream?: Record<string, unknown>;
  swml?: boolean | null;
  trim?: string;
  wait_url?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.join_room` (params). */
export interface CallingJoinRoomParams {
  call_id: string;
  hagrid_json_api_url?: string;
  hagrid_node_id?: string;
  name: string;
  node_id: string;
  status_url?: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.leave_conference` (params). */
export interface CallingLeaveConferenceParams {
  async?: boolean | null;
  call_id: string;
  conference_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.leave_room` (params). */
export interface CallingLeaveRoomParams {
  async?: boolean | null;
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.live_transcribe` (params). */
export interface CallingLiveTranscribeParams {
  action: Record<string, unknown>;
  async?: boolean | null;
  call_id: string;
  node_id: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.live_translate` (params). */
export interface CallingLiveTranslateParams {
  action: Record<string, unknown>;
  async?: boolean | null;
  call_id: string;
  node_id: string;
  status_url?: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pass` (params). */
export interface CallingPassParams {
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pay` (params). */
export interface CallingPayParams {
  bank_account_type?: Record<string, unknown>;
  call_id: string;
  charge_amount?: string;
  control_id: string;
  currency?: string;
  description?: string;
  input?: Record<string, unknown>;
  language?: string;
  max_attempts?: string;
  min_postal_code_length?: string;
  node_id: string;
  parameters?: {
    name: string;
    value: string;
  }[];
  payment_connector_url: string;
  payment_method?: Record<string, unknown>;
  postal_code?: string;
  prompts?: {
    actions?: {
      phrase: string;
      type: Record<string, unknown>;
    }[];
    attempt?: string;
    card_type?: string;
    error_type?: string;
    for: Record<string, unknown>;
    require_matching_inputs?: string;
  }[];
  security_code?: string;
  status_url?: string;
  timeout?: string;
  token_type?: Record<string, unknown>;
  valid_card_types?: string;
  voice?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pay.stop` (params). */
export interface CallingPayStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play` (params). */
export interface CallingPlayParams {
  call_id: string;
  control_id: string;
  node_id: string;
  play: {
    params: Record<string, unknown>;
    type: string;
  }[];
  volume?: number | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.pause` (params). */
export interface CallingPlayPauseParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.resume` (params). */
export interface CallingPlayResumeParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.stop` (params). */
export interface CallingPlayStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.volume` (params). */
export interface CallingPlayVolumeParams {
  call_id: string;
  control_id: string;
  node_id: string;
  volume: number;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect` (params). */
export interface CallingPlayAndCollectParams {
  call_id: string;
  collect: {
    digits?: {
      digit_timeout?: number | null;
      max: number;
      min?: number | null;
      terminators?: string;
    };
    initial_timeout?: number | null;
    speech?: {
      end_silence_timeout?: number | null;
      hints?: string[];
      language?: string;
      model?: string;
      speech_timeout?: number | null;
    };
  };
  control_id: string;
  node_id: string;
  play: {
    params: Record<string, unknown>;
    type: string;
  }[];
  volume?: number | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect.stop` (params). */
export interface CallingPlayAndCollectStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect.volume` (params). */
export interface CallingPlayAndCollectVolumeParams {
  call_id: string;
  control_id: string;
  node_id: string;
  volume: number;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.queue.enter` (params). */
export interface CallingQueueEnterParams {
  call_id: string;
  control_id: string;
  node_id: string;
  queue_name: string;
  status_url?: string;
  wait_url?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.queue.leave` (params). */
export interface CallingQueueLeaveParams {
  call_id: string;
  control_id: string;
  node_id: string;
  queue_id?: string;
  queue_name: string;
  status_url?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive` (params). */
export interface CallingReceiveParams {
  context?: string;
  contexts?: string[];
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive_fax` (params). */
export interface CallingReceiveFaxParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive_fax.stop` (params). */
export interface CallingReceiveFaxStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record` (params). */
export interface CallingRecordParams {
  call_id: string;
  control_id: string;
  node_id: string;
  record: {
    audio?: {
      direction?: string | null;
    };
  };
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.pause` (params). */
export interface CallingRecordPauseParams {
  behavior?: string;
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.resume` (params). */
export interface CallingRecordResumeParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.stop` (params). */
export interface CallingRecordStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.refer` (params). */
export interface CallingReferParams {
  call_id: string;
  device: {
    params: {
      headers?: Record<string, unknown>;
      to: string;
    };
    type: string;
  };
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_digits` (params). */
export interface CallingSendDigitsParams {
  call_id: string;
  control_id: string;
  digits: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_fax` (params). */
export interface CallingSendFaxParams {
  call_id: string;
  control_id: string;
  document: string;
  header_info?: string;
  identity?: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_fax.stop` (params). */
export interface CallingSendFaxStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.stream` (params). */
export interface CallingStreamParams {
  async?: boolean | null;
  authorization_bearer_token?: string;
  call_id: string;
  codec?: string;
  control_id: string;
  custom_parameters?: Record<string, unknown>;
  name?: string;
  node_id: string;
  status_url?: string;
  status_url_method?: string;
  swml?: boolean | null;
  track?: string;
  url: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.stream.stop` (params). */
export interface CallingStreamStopParams {
  async?: boolean | null;
  call_id: string;
  control_id: string;
  node_id: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.tap` (params). */
export interface CallingTapParams {
  call_id: string;
  control_id: string;
  device: {
    params?: Record<string, unknown>;
    type: string;
  };
  node_id: string;
  tap: {
    params: Record<string, unknown>;
    type: Record<string, unknown>;
  };
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.tap.stop` (params). */
export interface CallingTapStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.transfer` (params). */
export interface CallingTransferParams {
  call_id: string;
  dest: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.user_event` (params). */
export interface CallingUserEventParams {
  async?: boolean | null;
  call_id: string;
  event: Record<string, unknown>;
  node_id: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Permissive schema for the messaging.send RPC params. The server forwards the params as-is to the messaging gateway, so the schema is derived from the Python relay client (``signalwire/relay/client.py:send_message``). At least one of `body` or `media` is required. */
export interface MessagingSendParams {
  body?: string;
  context: string;
  from_number: string;
  media?: string[];
  region?: string;
  tags?: string[];
  to_number: string;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.connect` (params). */
export interface SignalwireConnectParams {
  agent?: string;
  authentication?: Record<string, unknown>;
  host?: string;
  identity?: string;
  params?: Record<string, unknown>;
  protocols?: {
    protocol: string;
    rank: number;
  }[];
  version: {
    major: number;
    minor: number;
    revision: number;
  };
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.disconnect` (params). */
export interface SignalwireDisconnectParams {
  restart?: boolean;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.execute` (params). */
export interface SignalwireExecuteParams {
  attempted?: string[];
  method: string;
  params?: Record<string, unknown>;
  protocol: string;
  requester_identity?: string;
  requester_nodeid?: string;
  responder_identity?: string;
  responder_nodeid?: string;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.ping` (params). */
export interface SignalwirePingParams {
  payload?: string;
  timestamp?: number | null;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.reauthenticate` (params). */
export interface SignalwireReauthenticateParams {
  authentication: Record<string, unknown>;
  dpop_token?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.ai_hold` (result). */
export interface CallingAiHoldResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.ai_message` (result). */
export interface CallingAiMessageResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.ai_unhold` (result). */
export interface CallingAiUnholdResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.amazon_bedrock` (result). */
export interface CallingAmazonBedrockResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.answer` (result). */
export interface CallingAnswerResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.begin` (result). */
export interface CallingBeginResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  message_data?: Record<string, unknown>;
  node_id?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.bind_digit` (result). */
export interface CallingBindDigitResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Placeholder schema for the server-side `calling.call` method, which has no typed params/result schema. The mock accepts any payload for this method. */
export type CallingCallResult = Record<string, unknown>;

/** Wire schema for the JSON payload of `calling.clear_digit_bindings` (result). */
export interface CallingClearDigitBindingsResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect` (result). */
export interface CallingCollectResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect.start_input_timers` (result). */
export interface CallingCollectStartInputTimersResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect.stop` (result). */
export interface CallingCollectStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.connect` (result). */
export interface CallingConnectResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  message_data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.denoise` (result). */
export interface CallingDenoiseResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.denoise.stop` (result). */
export interface CallingDenoiseStopResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.detect` (result). */
export interface CallingDetectResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.detect.stop` (result). */
export interface CallingDetectStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.dial` (result). */
export interface CallingDialResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  message_data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.disconnect` (result). */
export interface CallingDisconnectResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.echo` (result). */
export interface CallingEchoResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.end` (result). */
export interface CallingEndResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.join_conference` (result). */
export interface CallingJoinConferenceResult {
  call_id?: string;
  code: string;
  conference_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.join_room` (result). */
export interface CallingJoinRoomResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.leave_conference` (result). */
export interface CallingLeaveConferenceResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.leave_room` (result). */
export interface CallingLeaveRoomResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.live_transcribe` (result). */
export interface CallingLiveTranscribeResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.live_translate` (result). */
export interface CallingLiveTranslateResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pass` (result). */
export interface CallingPassResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pay` (result). */
export interface CallingPayResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pay.stop` (result). */
export interface CallingPayStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.pause` (result). */
export interface CallingPlayPauseResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play` (result). */
export interface CallingPlayResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.resume` (result). */
export interface CallingPlayResumeResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.stop` (result). */
export interface CallingPlayStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.volume` (result). */
export interface CallingPlayVolumeResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect` (result). */
export interface CallingPlayAndCollectResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect.stop` (result). */
export interface CallingPlayAndCollectStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect.volume` (result). */
export interface CallingPlayAndCollectVolumeResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.queue.enter` (result). */
export interface CallingQueueEnterResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.queue.leave` (result). */
export interface CallingQueueLeaveResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive` (result). */
export interface CallingReceiveResult {
  code: string;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive_fax` (result). */
export interface CallingReceiveFaxResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive_fax.stop` (result). */
export interface CallingReceiveFaxStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.pause` (result). */
export interface CallingRecordPauseResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record` (result). */
export interface CallingRecordResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  url?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.resume` (result). */
export interface CallingRecordResumeResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.stop` (result). */
export interface CallingRecordStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.refer` (result). */
export interface CallingReferResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_digits` (result). */
export interface CallingSendDigitsResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_fax` (result). */
export interface CallingSendFaxResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_fax.stop` (result). */
export interface CallingSendFaxStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.stream` (result). */
export interface CallingStreamResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.stream.stop` (result). */
export interface CallingStreamStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.tap` (result). */
export interface CallingTapResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  source_device?: {
    params?: Record<string, unknown>;
    type: string;
  };
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.tap.stop` (result). */
export interface CallingTapStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.transfer` (result). */
export interface CallingTransferResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.user_event` (result). */
export interface CallingUserEventResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Permissive schema for the messaging.send RPC response. The message_id from the response is used to route subsequent messaging.state events. */
export interface MessagingSendResult {
  code: string;
  message?: string;
  message_id: string;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.connect` (result). */
export interface SignalwireConnectResult {
  accesses?: {
    authentication: string;
    nodeid: string;
  }[];
  authorization?: Record<string, unknown>;
  authorizations?: {
    authentication: string;
    authorization: Record<string, unknown>;
  }[];
  host?: string;
  ice_servers?: Record<string, unknown>[];
  identity?: string;
  master_nodeid: string;
  nodeid: string;
  protocol?: string;
  protocols?: Record<string, unknown>[];
  protocols_uncertified?: string[];
  result?: Record<string, unknown>;
  session_restored: boolean;
  sessionid: string;
  subscriptions?: {
    command: string;
    failed_channels?: string[];
    protocol: string;
    subscribe_channels?: string[];
  }[];
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.disconnect` (result). */
export interface SignalwireDisconnectResult {
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.execute` (result). */
export interface SignalwireExecuteResult {
  requester_nodeid: string;
  responder_nodeid: string;
  result?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.ping` (result). */
export interface SignalwirePingResult {
  payload?: string;
  timestamp?: number | null;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.reauthenticate` (result). */
export interface SignalwireReauthenticateResult {
  authentication?: string;
  authorization?: Record<string, unknown>;
  ice_servers?: Record<string, unknown>[];
  result?: Record<string, unknown>;
  [key: string]: unknown;
}
