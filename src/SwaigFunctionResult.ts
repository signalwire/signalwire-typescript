/**
 * SwaigFunctionResult - Builder for SWAIG function responses.
 *
 * Carries response text and a list of structured actions (connect, hangup, SMS, etc.).
 * Every mutating method returns `this` for fluent chaining.
 */

export interface PaymentPrompt {
  for: string;
  actions: PaymentAction[];
  card_type?: string;
  error_type?: string;
}

export interface PaymentAction {
  type: string;
  phrase: string;
}

export interface PaymentParameter {
  name: string;
  value: string;
}

export class SwaigFunctionResult {
  response: string;
  action: Record<string, unknown>[];
  postProcess: boolean;

  constructor(response?: string, postProcess = false) {
    this.response = response ?? '';
    this.action = [];
    this.postProcess = postProcess;
  }

  // ── Core ────────────────────────────────────────────────────────────

  setResponse(response: string): this {
    this.response = response;
    return this;
  }

  setPostProcess(postProcess: boolean): this {
    this.postProcess = postProcess;
    return this;
  }

  addAction(name: string, data: unknown): this {
    this.action.push({ [name]: data });
    return this;
  }

  addActions(actions: Record<string, unknown>[]): this {
    this.action.push(...actions);
    return this;
  }

  // ── Call control ────────────────────────────────────────────────────

  connect(destination: string, final = true, fromAddr?: string): this {
    const connectParams: Record<string, string> = { to: destination };
    if (fromAddr !== undefined) {
      connectParams['from'] = fromAddr;
    }
    this.action.push({
      SWML: {
        sections: { main: [{ connect: connectParams }] },
        version: '1.0.0',
      },
      transfer: String(final),
    });
    return this;
  }

  swmlTransfer(dest: string, aiResponse: string, final = true): this {
    this.action.push({
      SWML: {
        version: '1.0.0',
        sections: {
          main: [
            { set: { ai_response: aiResponse } },
            { transfer: { dest } },
          ],
        },
      },
      transfer: String(final),
    });
    return this;
  }

  hangup(): this {
    return this.addAction('hangup', true);
  }

  hold(timeout = 300): this {
    return this.addAction('hold', Math.max(0, Math.min(timeout, 900)));
  }

  waitForUser(opts?: { enabled?: boolean; timeout?: number; answerFirst?: boolean }): this {
    let value: unknown = true;
    if (opts?.answerFirst) {
      value = 'answer_first';
    } else if (opts?.timeout !== undefined) {
      value = opts.timeout;
    } else if (opts?.enabled !== undefined) {
      value = opts.enabled;
    }
    return this.addAction('wait_for_user', value);
  }

  stop(): this {
    return this.addAction('stop', true);
  }

  // ── Audio ───────────────────────────────────────────────────────────

  say(text: string): this {
    return this.addAction('say', text);
  }

  playBackgroundFile(filename: string, wait = false): this {
    if (wait) {
      return this.addAction('playback_bg', { file: filename, wait: true });
    }
    return this.addAction('playback_bg', filename);
  }

  stopBackgroundFile(): this {
    return this.addAction('stop_playback_bg', true);
  }

  // ── Speech ──────────────────────────────────────────────────────────

  addDynamicHints(hints: (string | { pattern: string; replace: string; ignore_case?: boolean })[]): this {
    return this.addAction('add_dynamic_hints', hints);
  }

  clearDynamicHints(): this {
    this.action.push({ clear_dynamic_hints: {} });
    return this;
  }

  setEndOfSpeechTimeout(milliseconds: number): this {
    return this.addAction('end_of_speech_timeout', milliseconds);
  }

  setSpeechEventTimeout(milliseconds: number): this {
    return this.addAction('speech_event_timeout', milliseconds);
  }

  // ── Data ────────────────────────────────────────────────────────────

  updateGlobalData(data: Record<string, unknown>): this {
    return this.addAction('set_global_data', data);
  }

  removeGlobalData(keys: string | string[]): this {
    return this.addAction('unset_global_data', keys);
  }

  setMetadata(data: Record<string, unknown>): this {
    return this.addAction('set_meta_data', data);
  }

  removeMetadata(keys: string | string[]): this {
    return this.addAction('unset_meta_data', keys);
  }

  // ── SWML helpers ────────────────────────────────────────────────────

  executeSwml(swmlContent: string | Record<string, unknown>, transfer = false): this {
    let swmlData: Record<string, unknown>;
    if (typeof swmlContent === 'string') {
      try {
        swmlData = JSON.parse(swmlContent) as Record<string, unknown>;
      } catch {
        swmlData = { raw_swml: swmlContent };
      }
    } else {
      swmlData = { ...swmlContent };
    }
    if (transfer) {
      swmlData['transfer'] = 'true';
    }
    return this.addAction('SWML', swmlData);
  }

  swmlChangeStep(stepName: string): this {
    return this.addAction('change_step', stepName);
  }

  swmlChangeContext(contextName: string): this {
    return this.addAction('change_context', contextName);
  }

  swmlUserEvent(eventData: Record<string, unknown>): this {
    return this.addAction('SWML', {
      sections: { main: [{ user_event: { event: eventData } }] },
      version: '1.0.0',
    });
  }

  switchContext(opts?: {
    systemPrompt?: string;
    userPrompt?: string;
    consolidate?: boolean;
    fullReset?: boolean;
  }): this {
    const sp = opts?.systemPrompt;
    const up = opts?.userPrompt;
    const cons = opts?.consolidate;
    const fr = opts?.fullReset;

    if (sp && !up && !cons && !fr) {
      return this.addAction('context_switch', sp);
    }
    const data: Record<string, unknown> = {};
    if (sp) data['system_prompt'] = sp;
    if (up) data['user_prompt'] = up;
    if (cons) data['consolidate'] = true;
    if (fr) data['full_reset'] = true;
    return this.addAction('context_switch', data);
  }

  // ── Functions ───────────────────────────────────────────────────────

  toggleFunctions(toggles: { function: string; active: boolean }[]): this {
    return this.addAction('toggle_functions', toggles);
  }

  enableFunctionsOnTimeout(enabled = true): this {
    return this.addAction('functions_on_speaker_timeout', enabled);
  }

  updateSettings(settings: Record<string, unknown>): this {
    return this.addAction('settings', settings);
  }

  // ── User input / history ────────────────────────────────────────────

  simulateUserInput(text: string): this {
    return this.addAction('user_input', text);
  }

  enableExtensiveData(enabled = true): this {
    return this.addAction('extensive_data', enabled);
  }

  replaceInHistory(text: string | boolean = true): this {
    return this.addAction('replace_in_history', text);
  }

  // ── Comms ───────────────────────────────────────────────────────────

  sendSms(opts: {
    toNumber: string;
    fromNumber: string;
    body?: string;
    media?: string[];
    tags?: string[];
    region?: string;
  }): this {
    if (!opts.body && !opts.media) {
      throw new Error('Either body or media must be provided');
    }
    const smsParams: Record<string, unknown> = {
      to_number: opts.toNumber,
      from_number: opts.fromNumber,
    };
    if (opts.body) smsParams['body'] = opts.body;
    if (opts.media) smsParams['media'] = opts.media;
    if (opts.tags) smsParams['tags'] = opts.tags;
    if (opts.region) smsParams['region'] = opts.region;

    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ send_sms: smsParams }] },
    });
  }

  recordCall(opts?: {
    controlId?: string;
    stereo?: boolean;
    format?: 'wav' | 'mp3';
    direction?: 'speak' | 'listen' | 'both';
    terminators?: string;
    beep?: boolean;
    inputSensitivity?: number;
    initialTimeout?: number;
    endSilenceTimeout?: number;
    maxLength?: number;
    statusUrl?: string;
  }): this {
    const format = opts?.format ?? 'wav';
    const direction = opts?.direction ?? 'both';
    const params: Record<string, unknown> = {
      stereo: opts?.stereo ?? false,
      format,
      direction,
      beep: opts?.beep ?? false,
      input_sensitivity: opts?.inputSensitivity ?? 44.0,
    };
    if (opts?.controlId) params['control_id'] = opts.controlId;
    if (opts?.terminators) params['terminators'] = opts.terminators;
    if (opts?.initialTimeout !== undefined) params['initial_timeout'] = opts.initialTimeout;
    if (opts?.endSilenceTimeout !== undefined) params['end_silence_timeout'] = opts.endSilenceTimeout;
    if (opts?.maxLength !== undefined) params['max_length'] = opts.maxLength;
    if (opts?.statusUrl) params['status_url'] = opts.statusUrl;

    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ record_call: params }] },
    });
  }

  stopRecordCall(controlId?: string): this {
    const params: Record<string, unknown> = {};
    if (controlId) params['control_id'] = controlId;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ stop_record_call: params }] },
    });
  }

  tap(opts: {
    uri: string;
    controlId?: string;
    direction?: 'speak' | 'hear' | 'both';
    codec?: 'PCMU' | 'PCMA';
    rtpPtime?: number;
    statusUrl?: string;
  }): this {
    const params: Record<string, unknown> = { uri: opts.uri };
    if (opts.controlId) params['control_id'] = opts.controlId;
    if (opts.direction && opts.direction !== 'both') params['direction'] = opts.direction;
    if (opts.codec && opts.codec !== 'PCMU') params['codec'] = opts.codec;
    if (opts.rtpPtime && opts.rtpPtime !== 20) params['rtp_ptime'] = opts.rtpPtime;
    if (opts.statusUrl) params['status_url'] = opts.statusUrl;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ tap: params }] },
    });
  }

  stopTap(controlId?: string): this {
    const params: Record<string, unknown> = {};
    if (controlId) params['control_id'] = controlId;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ stop_tap: params }] },
    });
  }

  // ── Rooms / Conferences ─────────────────────────────────────────────

  joinRoom(name: string): this {
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ join_room: { name } }] },
    });
  }

  sipRefer(toUri: string): this {
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ sip_refer: { to_uri: toUri } }] },
    });
  }

  joinConference(name: string, opts?: {
    muted?: boolean;
    beep?: 'true' | 'false' | 'onEnter' | 'onExit';
    startOnEnter?: boolean;
    endOnExit?: boolean;
    waitUrl?: string;
    maxParticipants?: number;
    record?: 'do-not-record' | 'record-from-start';
    region?: string;
    trim?: 'trim-silence' | 'do-not-trim';
    coach?: string;
    statusCallbackEvent?: string;
    statusCallback?: string;
    statusCallbackMethod?: 'GET' | 'POST';
    recordingStatusCallback?: string;
    recordingStatusCallbackMethod?: 'GET' | 'POST';
    recordingStatusCallbackEvent?: string;
    result?: unknown;
  }): this {
    const hasNonDefaults = opts && (
      opts.muted || (opts.beep && opts.beep !== 'true') ||
      opts.startOnEnter === false || opts.endOnExit ||
      opts.waitUrl || (opts.maxParticipants && opts.maxParticipants !== 250) ||
      (opts.record && opts.record !== 'do-not-record') || opts.region ||
      (opts.trim && opts.trim !== 'trim-silence') || opts.coach ||
      opts.statusCallbackEvent || opts.statusCallback ||
      (opts.statusCallbackMethod && opts.statusCallbackMethod !== 'POST') ||
      opts.recordingStatusCallback ||
      (opts.recordingStatusCallbackMethod && opts.recordingStatusCallbackMethod !== 'POST') ||
      (opts.recordingStatusCallbackEvent && opts.recordingStatusCallbackEvent !== 'completed') ||
      opts.result !== undefined
    );

    let joinParams: unknown;
    if (!hasNonDefaults) {
      joinParams = name;
    } else {
      const p: Record<string, unknown> = { name };
      if (opts!.muted) p['muted'] = opts!.muted;
      if (opts!.beep && opts!.beep !== 'true') p['beep'] = opts!.beep;
      if (opts!.startOnEnter === false) p['start_on_enter'] = false;
      if (opts!.endOnExit) p['end_on_exit'] = opts!.endOnExit;
      if (opts!.waitUrl) p['wait_url'] = opts!.waitUrl;
      if (opts!.maxParticipants && opts!.maxParticipants !== 250) p['max_participants'] = opts!.maxParticipants;
      if (opts!.record && opts!.record !== 'do-not-record') p['record'] = opts!.record;
      if (opts!.region) p['region'] = opts!.region;
      if (opts!.trim && opts!.trim !== 'trim-silence') p['trim'] = opts!.trim;
      if (opts!.coach) p['coach'] = opts!.coach;
      if (opts!.statusCallbackEvent) p['status_callback_event'] = opts!.statusCallbackEvent;
      if (opts!.statusCallback) p['status_callback'] = opts!.statusCallback;
      if (opts!.statusCallbackMethod && opts!.statusCallbackMethod !== 'POST') p['status_callback_method'] = opts!.statusCallbackMethod;
      if (opts!.recordingStatusCallback) p['recording_status_callback'] = opts!.recordingStatusCallback;
      if (opts!.recordingStatusCallbackMethod && opts!.recordingStatusCallbackMethod !== 'POST') p['recording_status_callback_method'] = opts!.recordingStatusCallbackMethod;
      if (opts!.recordingStatusCallbackEvent && opts!.recordingStatusCallbackEvent !== 'completed') p['recording_status_callback_event'] = opts!.recordingStatusCallbackEvent;
      if (opts!.result !== undefined) p['result'] = opts!.result;
      joinParams = p;
    }

    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ join_conference: joinParams }] },
    });
  }

  // ── RPC ─────────────────────────────────────────────────────────────

  executeRpc(opts: {
    method: string;
    params?: Record<string, unknown>;
    callId?: string;
    nodeId?: string;
  }): this {
    const rpcParams: Record<string, unknown> = { method: opts.method };
    if (opts.callId) rpcParams['call_id'] = opts.callId;
    if (opts.nodeId) rpcParams['node_id'] = opts.nodeId;
    if (opts.params) rpcParams['params'] = opts.params;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ execute_rpc: rpcParams }] },
    });
  }

  rpcDial(toNumber: string, fromNumber: string, destSwml: string, deviceType = 'phone'): this {
    return this.executeRpc({
      method: 'dial',
      params: {
        devices: {
          type: deviceType,
          params: { to_number: toNumber, from_number: fromNumber },
        },
        dest_swml: destSwml,
      },
    });
  }

  rpcAiMessage(callId: string, messageText: string, role = 'system'): this {
    return this.executeRpc({
      method: 'ai_message',
      callId,
      params: { role, message_text: messageText },
    });
  }

  rpcAiUnhold(callId: string): this {
    return this.executeRpc({
      method: 'ai_unhold',
      callId,
      params: {},
    });
  }

  // ── Payment ─────────────────────────────────────────────────────────

  pay(opts: {
    paymentConnectorUrl: string;
    inputMethod?: string;
    statusUrl?: string;
    paymentMethod?: string;
    timeout?: number;
    maxAttempts?: number;
    securityCode?: boolean;
    postalCode?: boolean | string;
    minPostalCodeLength?: number;
    tokenType?: string;
    chargeAmount?: string;
    currency?: string;
    language?: string;
    voice?: string;
    description?: string;
    validCardTypes?: string;
    parameters?: PaymentParameter[];
    prompts?: PaymentPrompt[];
    aiResponse?: string;
  }): this {
    const payParams: Record<string, unknown> = {
      payment_connector_url: opts.paymentConnectorUrl,
      input: opts.inputMethod ?? 'dtmf',
      payment_method: opts.paymentMethod ?? 'credit-card',
      timeout: String(opts.timeout ?? 5),
      max_attempts: String(opts.maxAttempts ?? 1),
      security_code: String(opts.securityCode ?? true),
      min_postal_code_length: String(opts.minPostalCodeLength ?? 0),
      token_type: opts.tokenType ?? 'reusable',
      currency: opts.currency ?? 'usd',
      language: opts.language ?? 'en-US',
      voice: opts.voice ?? 'woman',
      valid_card_types: opts.validCardTypes ?? 'visa mastercard amex',
    };

    const postalCode = opts.postalCode ?? true;
    payParams['postal_code'] = typeof postalCode === 'boolean' ? String(postalCode) : postalCode;

    if (opts.statusUrl) payParams['status_url'] = opts.statusUrl;
    if (opts.chargeAmount) payParams['charge_amount'] = opts.chargeAmount;
    if (opts.description) payParams['description'] = opts.description;
    if (opts.parameters) payParams['parameters'] = opts.parameters;
    if (opts.prompts) payParams['prompts'] = opts.prompts;

    const aiResponse = opts.aiResponse ??
      'The payment status is ${pay_result}, do not mention anything else about collecting payment if successful.';

    return this.executeSwml({
      version: '1.0.0',
      sections: {
        main: [
          { set: { ai_response: aiResponse } },
          { pay: payParams },
        ],
      },
    });
  }

  // ── Static payment helpers ──────────────────────────────────────────

  static createPaymentPrompt(
    forSituation: string,
    actions: PaymentAction[],
    cardType?: string,
    errorType?: string,
  ): PaymentPrompt {
    const prompt: PaymentPrompt = { for: forSituation, actions };
    if (cardType) prompt.card_type = cardType;
    if (errorType) prompt.error_type = errorType;
    return prompt;
  }

  static createPaymentAction(actionType: string, phrase: string): PaymentAction {
    return { type: actionType, phrase };
  }

  static createPaymentParameter(name: string, value: string): PaymentParameter {
    return { name, value };
  }

  // ── Serialization ───────────────────────────────────────────────────

  toDict(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (this.response) {
      result['response'] = this.response;
    }
    if (this.action.length > 0) {
      result['action'] = this.action;
    }
    if (this.postProcess && this.action.length > 0) {
      result['post_process'] = true;
    }
    if (Object.keys(result).length === 0) {
      result['response'] = 'Action completed.';
    }
    return result;
  }
}
