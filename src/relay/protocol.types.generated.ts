// AUTO-GENERATED from porting-sdk/relay-protocol/*.{params,result}.json — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One interface per RELAY method's params (<Method>Params) and ack result
// (<Method>Result), from the canonical switchblade wire schemas. Held to the
// same lint bar as hand-written source (no rule suppressions, no loose types).

/** Wire schema for the JSON payload of `calling.ai_hold` (params). Extracted from switchblade `PublicCallAiHoldParams.cs`. */
export interface CallingAiHoldParams {
  async?: boolean | null;
  call_id: string;
  node_id: string;
  prompt?: string;
  swml?: boolean | null;
  timeout?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.ai_message` (params). Extracted from switchblade `PublicCallAiMessageParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.ai_unhold` (params). Extracted from switchblade `PublicCallAiUnholdParams.cs`. */
export interface CallingAiUnholdParams {
  async?: boolean | null;
  call_id: string;
  node_id: string;
  prompt?: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.amazon_bedrock` (params). Extracted from switchblade `PublicCallAmazonBedrockParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.answer` (params). Extracted from switchblade `PublicCallAnswerParams.cs`. */
export interface CallingAnswerParams {
  call_id: string;
  max_duration?: number | null;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.begin` (params). Extracted from switchblade `PublicCallBeginParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.bind_digit` (params). Extracted from switchblade `PublicCallBindDigitParams.cs`. */
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

/** Placeholder schema for the FreeSWITCH-side `calling.call` method. Registered via `swclt_sess_register_protocol_method(..., "call", ...)` in mod_infrastructure/relay.c but not exposed as a switchblade Params/Result class. The mock accepts any payload for this method. */
export type CallingCallParams = Record<string, unknown>;

/** Wire schema for the JSON payload of `calling.clear_digit_bindings` (params). Extracted from switchblade `PublicCallClearDigitBindingsParams.cs`. */
export interface CallingClearDigitBindingsParams {
  call_id: string;
  node_id: string;
  realm?: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect` (params). Extracted from switchblade `PublicCallCollectParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.collect.start_input_timers` (params). Extracted from switchblade `PublicCallCollectStartInputTimersParams.cs`. */
export interface CallingCollectStartInputTimersParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect.stop` (params). Extracted from switchblade `PublicCallCollectStopParams.cs`. */
export interface CallingCollectStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.connect` (params). Extracted from switchblade `PublicCallConnectParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.denoise` (params). Extracted from switchblade `PublicCallDenoiseParams.cs`. */
export interface CallingDenoiseParams {
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.denoise.stop` (params). Extracted from switchblade `PublicCallDenoiseStopParams.cs`. */
export interface CallingDenoiseStopParams {
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.detect` (params). Extracted from switchblade `PublicCallDetectParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.detect.stop` (params). Extracted from switchblade `PublicCallDetectStopParams.cs`. */
export interface CallingDetectStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.dial` (params). Extracted from switchblade `PublicCallDialParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.disconnect` (params). Extracted from switchblade `PublicCallDisconnectParams.cs`. */
export interface CallingDisconnectParams {
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.echo` (params). Extracted from switchblade `PublicCallEchoParams.cs`. */
export interface CallingEchoParams {
  call_id: string;
  node_id: string;
  status_url?: string;
  swml?: boolean | null;
  timeout?: number | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.end` (params). Extracted from switchblade `PublicCallEndParams.cs`. */
export interface CallingEndParams {
  call_id: string;
  node_id: string;
  reason?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.join_conference` (params). Extracted from switchblade `PublicCallJoinConferenceParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.join_room` (params). Extracted from switchblade `PublicCallJoinRoomParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.leave_conference` (params). Extracted from switchblade `PublicCallLeaveConferenceParams.cs`. */
export interface CallingLeaveConferenceParams {
  async?: boolean | null;
  call_id: string;
  conference_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.leave_room` (params). Extracted from switchblade `PublicCallLeaveRoomParams.cs`. */
export interface CallingLeaveRoomParams {
  async?: boolean | null;
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.live_transcribe` (params). Extracted from switchblade `PublicCallLiveTranscribeParams.cs`. */
export interface CallingLiveTranscribeParams {
  action: Record<string, unknown>;
  async?: boolean | null;
  call_id: string;
  node_id: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.live_translate` (params). Extracted from switchblade `PublicCallLiveTranslateParams.cs`. */
export interface CallingLiveTranslateParams {
  action: Record<string, unknown>;
  async?: boolean | null;
  call_id: string;
  node_id: string;
  status_url?: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pass` (params). Extracted from switchblade `PublicCallPassParams.cs`. */
export interface CallingPassParams {
  call_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pay` (params). Extracted from switchblade `PublicCallPayParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.pay.stop` (params). Extracted from switchblade `PublicCallPayStopParams.cs`. */
export interface CallingPayStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play` (params). Extracted from switchblade `PublicCallPlayParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.play.pause` (params). Extracted from switchblade `PublicCallPlayPauseParams.cs`. */
export interface CallingPlayPauseParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.resume` (params). Extracted from switchblade `PublicCallPlayResumeParams.cs`. */
export interface CallingPlayResumeParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.stop` (params). Extracted from switchblade `PublicCallPlayStopParams.cs`. */
export interface CallingPlayStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.volume` (params). Extracted from switchblade `PublicCallPlayVolumeParams.cs`. */
export interface CallingPlayVolumeParams {
  call_id: string;
  control_id: string;
  node_id: string;
  volume: number;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect` (params). Extracted from switchblade `PublicCallPlayAndCollectParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.play_and_collect.stop` (params). Extracted from switchblade `PublicCallPlayAndCollectStopParams.cs`. */
export interface CallingPlayAndCollectStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect.volume` (params). Extracted from switchblade `PublicCallPlayAndCollectVolumeParams.cs`. */
export interface CallingPlayAndCollectVolumeParams {
  call_id: string;
  control_id: string;
  node_id: string;
  volume: number;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.queue.enter` (params). Extracted from switchblade `PublicCallQueueEnterParams.cs`. */
export interface CallingQueueEnterParams {
  call_id: string;
  control_id: string;
  node_id: string;
  queue_name: string;
  status_url?: string;
  wait_url?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.queue.leave` (params). Extracted from switchblade `PublicCallQueueLeaveParams.cs`. */
export interface CallingQueueLeaveParams {
  call_id: string;
  control_id: string;
  node_id: string;
  queue_id?: string;
  queue_name: string;
  status_url?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive` (params). Extracted from switchblade `PublicCallReceiveParams.cs`. */
export interface CallingReceiveParams {
  context?: string;
  contexts?: string[];
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive_fax` (params). Extracted from switchblade `PublicCallReceiveFaxParams.cs`. */
export interface CallingReceiveFaxParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive_fax.stop` (params). Extracted from switchblade `PublicCallReceiveFaxStopParams.cs`. */
export interface CallingReceiveFaxStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record` (params). Extracted from switchblade `PublicCallRecordParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.record.pause` (params). Extracted from switchblade `PublicCallRecordPauseParams.cs`. */
export interface CallingRecordPauseParams {
  behavior?: string;
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.resume` (params). Extracted from switchblade `PublicCallRecordResumeParams.cs`. */
export interface CallingRecordResumeParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.stop` (params). Extracted from switchblade `PublicCallRecordStopParams.cs`. */
export interface CallingRecordStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.refer` (params). Extracted from switchblade `PublicCallReferParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.send_digits` (params). Extracted from switchblade `PublicCallSendDigitsParams.cs`. */
export interface CallingSendDigitsParams {
  call_id: string;
  control_id: string;
  digits: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_fax` (params). Extracted from switchblade `PublicCallSendFaxParams.cs`. */
export interface CallingSendFaxParams {
  call_id: string;
  control_id: string;
  document: string;
  header_info?: string;
  identity?: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_fax.stop` (params). Extracted from switchblade `PublicCallSendFaxStopParams.cs`. */
export interface CallingSendFaxStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.stream` (params). Extracted from switchblade `PublicCallStreamParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.stream.stop` (params). Extracted from switchblade `PublicCallStreamStopParams.cs`. */
export interface CallingStreamStopParams {
  async?: boolean | null;
  call_id: string;
  control_id: string;
  node_id: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.tap` (params). Extracted from switchblade `PublicCallTapParams.cs`. */
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

/** Wire schema for the JSON payload of `calling.tap.stop` (params). Extracted from switchblade `PublicCallTapStopParams.cs`. */
export interface CallingTapStopParams {
  call_id: string;
  control_id: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.transfer` (params). Extracted from switchblade `PublicCallTransferParams.cs`. */
export interface CallingTransferParams {
  call_id: string;
  dest: string;
  node_id: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.user_event` (params). Extracted from switchblade `PublicCallUserEventParams.cs`. */
export interface CallingUserEventParams {
  async?: boolean | null;
  call_id: string;
  event: Record<string, unknown>;
  node_id: string;
  swml?: boolean | null;
  [key: string]: unknown;
}

/** Permissive schema for the messaging.send RPC params. Switchblade forwards the JObject as-is to the messaging gateway, so the schema is derived from the Python relay client (``signalwire/relay/client.py:send_message``). At least one of `body` or `media` is required. */
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

/** Wire schema for the Blade envelope `signalwire.connect` (params). Extracted from switchblade `Messages/ConnectParams.cs`. */
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

/** Wire schema for the Blade envelope `signalwire.disconnect` (params). Extracted from switchblade `Messages/DisconnectParams.cs`. */
export interface SignalwireDisconnectParams {
  restart?: boolean;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.execute` (params). Extracted from switchblade `Messages/ExecuteParams.cs`. */
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

/** Wire schema for the Blade envelope `signalwire.ping` (params). Extracted from switchblade `Messages/PingParams.cs`. */
export interface SignalwirePingParams {
  payload?: string;
  timestamp?: number | null;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.reauthenticate` (params). Extracted from switchblade `Messages/ReauthenticateParams.cs`. */
export interface SignalwireReauthenticateParams {
  authentication: Record<string, unknown>;
  dpop_token?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.ai_hold` (result). Extracted from switchblade `PublicCallAiHoldResult.cs`. */
export interface CallingAiHoldResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.ai_message` (result). Extracted from switchblade `PublicCallAiMessageResult.cs`. */
export interface CallingAiMessageResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.ai_unhold` (result). Extracted from switchblade `PublicCallAiUnholdResult.cs`. */
export interface CallingAiUnholdResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.amazon_bedrock` (result). Extracted from switchblade `PublicCallAmazonBedrockResult.cs`. */
export interface CallingAmazonBedrockResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.answer` (result). Extracted from switchblade `PublicCallAnswerResult.cs`. */
export interface CallingAnswerResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.begin` (result). Extracted from switchblade `PublicCallBeginResult.cs`. */
export interface CallingBeginResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  message_data?: Record<string, unknown>;
  node_id?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.bind_digit` (result). Extracted from switchblade `PublicCallBindDigitResult.cs`. */
export interface CallingBindDigitResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Placeholder schema for the FreeSWITCH-side `calling.call` method. Registered via `swclt_sess_register_protocol_method(..., "call", ...)` in mod_infrastructure/relay.c but not exposed as a switchblade Params/Result class. The mock accepts any payload for this method. */
export type CallingCallResult = Record<string, unknown>;

/** Wire schema for the JSON payload of `calling.clear_digit_bindings` (result). Extracted from switchblade `PublicCallClearDigitBindingsResult.cs`. */
export interface CallingClearDigitBindingsResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect` (result). Extracted from switchblade `PublicCallCollectResult.cs`. */
export interface CallingCollectResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect.start_input_timers` (result). Extracted from switchblade `PublicCallCollectStartInputTimersResult.cs`. */
export interface CallingCollectStartInputTimersResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.collect.stop` (result). Extracted from switchblade `PublicCallCollectStopResult.cs`. */
export interface CallingCollectStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.connect` (result). Extracted from switchblade `PublicCallConnectResult.cs`. */
export interface CallingConnectResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  message_data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.denoise` (result). Extracted from switchblade `PublicCallDenoiseResult.cs`. */
export interface CallingDenoiseResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.denoise.stop` (result). Extracted from switchblade `PublicCallDenoiseStopResult.cs`. */
export interface CallingDenoiseStopResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.detect` (result). Extracted from switchblade `PublicCallDetectResult.cs`. */
export interface CallingDetectResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.detect.stop` (result). Extracted from switchblade `PublicCallDetectStopResult.cs`. */
export interface CallingDetectStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.dial` (result). Extracted from switchblade `PublicCallDialResult.cs`. */
export interface CallingDialResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  message_data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.disconnect` (result). Extracted from switchblade `PublicCallDisconnectResult.cs`. */
export interface CallingDisconnectResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.echo` (result). Extracted from switchblade `PublicCallEchoResult.cs`. */
export interface CallingEchoResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.end` (result). Extracted from switchblade `PublicCallEndResult.cs`. */
export interface CallingEndResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.join_conference` (result). Extracted from switchblade `PublicCallJoinConferenceResult.cs`. */
export interface CallingJoinConferenceResult {
  call_id?: string;
  code: string;
  conference_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.join_room` (result). Extracted from switchblade `PublicCallJoinRoomResult.cs`. */
export interface CallingJoinRoomResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.leave_conference` (result). Extracted from switchblade `PublicCallLeaveConferenceResult.cs`. */
export interface CallingLeaveConferenceResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.leave_room` (result). Extracted from switchblade `PublicCallLeaveRoomResult.cs`. */
export interface CallingLeaveRoomResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.live_transcribe` (result). Extracted from switchblade `PublicCallLiveTranscribeResult.cs`. */
export interface CallingLiveTranscribeResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.live_translate` (result). Extracted from switchblade `PublicCallLiveTranslateResult.cs`. */
export interface CallingLiveTranslateResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pass` (result). Extracted from switchblade `PublicCallPassResult.cs`. */
export interface CallingPassResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pay` (result). Extracted from switchblade `PublicCallPayResult.cs`. */
export interface CallingPayResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.pay.stop` (result). Extracted from switchblade `PublicCallPayStopResult.cs`. */
export interface CallingPayStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.pause` (result). Extracted from switchblade `PublicCallPlayPauseResult.cs`. */
export interface CallingPlayPauseResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play` (result). Extracted from switchblade `PublicCallPlayResult.cs`. */
export interface CallingPlayResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.resume` (result). Extracted from switchblade `PublicCallPlayResumeResult.cs`. */
export interface CallingPlayResumeResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.stop` (result). Extracted from switchblade `PublicCallPlayStopResult.cs`. */
export interface CallingPlayStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play.volume` (result). Extracted from switchblade `PublicCallPlayVolumeResult.cs`. */
export interface CallingPlayVolumeResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect` (result). Extracted from switchblade `PublicCallPlayAndCollectResult.cs`. */
export interface CallingPlayAndCollectResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect.stop` (result). Extracted from switchblade `PublicCallPlayAndCollectStopResult.cs`. */
export interface CallingPlayAndCollectStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.play_and_collect.volume` (result). Extracted from switchblade `PublicCallPlayAndCollectVolumeResult.cs`. */
export interface CallingPlayAndCollectVolumeResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.queue.enter` (result). Extracted from switchblade `PublicCallQueueEnterResult.cs`. */
export interface CallingQueueEnterResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.queue.leave` (result). Extracted from switchblade `PublicCallQueueLeaveResult.cs`. */
export interface CallingQueueLeaveResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive` (result). Extracted from switchblade `PublicCallReceiveResult.cs`. */
export interface CallingReceiveResult {
  code: string;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive_fax` (result). Extracted from switchblade `PublicCallReceiveFaxResult.cs`. */
export interface CallingReceiveFaxResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.receive_fax.stop` (result). Extracted from switchblade `PublicCallReceiveFaxStopResult.cs`. */
export interface CallingReceiveFaxStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.pause` (result). Extracted from switchblade `PublicCallRecordPauseResult.cs`. */
export interface CallingRecordPauseResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record` (result). Extracted from switchblade `PublicCallRecordResult.cs`. */
export interface CallingRecordResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  url?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.resume` (result). Extracted from switchblade `PublicCallRecordResumeResult.cs`. */
export interface CallingRecordResumeResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.record.stop` (result). Extracted from switchblade `PublicCallRecordStopResult.cs`. */
export interface CallingRecordStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.refer` (result). Extracted from switchblade `PublicCallReferResult.cs`. */
export interface CallingReferResult {
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_digits` (result). Extracted from switchblade `PublicCallSendDigitsResult.cs`. */
export interface CallingSendDigitsResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_fax` (result). Extracted from switchblade `PublicCallSendFaxResult.cs`. */
export interface CallingSendFaxResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.send_fax.stop` (result). Extracted from switchblade `PublicCallSendFaxStopResult.cs`. */
export interface CallingSendFaxStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.stream` (result). Extracted from switchblade `PublicCallStreamResult.cs`. */
export interface CallingStreamResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.stream.stop` (result). Extracted from switchblade `PublicCallStreamStopResult.cs`. */
export interface CallingStreamStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.tap` (result). Extracted from switchblade `PublicCallTapResult.cs`. */
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

/** Wire schema for the JSON payload of `calling.tap.stop` (result). Extracted from switchblade `PublicCallTapStopResult.cs`. */
export interface CallingTapStopResult {
  call_id?: string;
  code: string;
  control_id?: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.transfer` (result). Extracted from switchblade `PublicCallTransferResult.cs`. */
export interface CallingTransferResult {
  call_id?: string;
  code: string;
  data?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

/** Wire schema for the JSON payload of `calling.user_event` (result). Extracted from switchblade `PublicCallUserEventResult.cs`. */
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

/** Wire schema for the Blade envelope `signalwire.connect` (result). Extracted from switchblade `Messages/ConnectResult.cs`. */
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

/** Wire schema for the Blade envelope `signalwire.disconnect` (result). Extracted from switchblade `Messages/DisconnectResult.cs`. */
export interface SignalwireDisconnectResult {
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.execute` (result). Extracted from switchblade `Messages/ExecuteResult.cs`. */
export interface SignalwireExecuteResult {
  requester_nodeid: string;
  responder_nodeid: string;
  result?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.ping` (result). Extracted from switchblade `Messages/PingResult.cs`. */
export interface SignalwirePingResult {
  payload?: string;
  timestamp?: number | null;
  [key: string]: unknown;
}

/** Wire schema for the Blade envelope `signalwire.reauthenticate` (result). Extracted from switchblade `Messages/ReauthenticateResult.cs`. */
export interface SignalwireReauthenticateResult {
  authentication?: string;
  authorization?: Record<string, unknown>;
  ice_servers?: Record<string, unknown>[];
  result?: Record<string, unknown>;
  [key: string]: unknown;
}
