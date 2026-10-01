// AUTO-GENERATED from porting-sdk/rest-apis/calling/openapi.enriched.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import { randomUUID } from 'node:crypto';
import type { HttpClient } from '../HttpClient.js';
import type { RequestOptionsInit } from '../RequestOptions.js';
import { BaseResource } from '../base/BaseResource.js';
import type {
  CallResponse,
  RelayCallCollectDigitsInner,
  RelayCallCollectSpeechInner,
  RelayCallDetectInner,
  RelayCallPlayInner,
  RelayCallRecordAudio,
  RelayCallRecordInner,
  RelayCallReferDevice,
  RelayCallTapDevice,
  RelayIsReset,
  RelayTap,
  SWMLObject,
  Section,
  uuid,
} from './calling.types.generated.js';

export class Calling extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/calling/calls');
  }

  async dial(
    from: string,
    to?: string,
    options?: {
      caller_id?: string;
      fallback_url?: string;
      status_url?: string;
      status_events?: ('answered' | 'queued' | 'initiated' | 'ringing' | 'ending' | 'ended')[];
      url_method?: string;
      codecs?: string[] | string;
      to_script?: string | Record<string, unknown>;
      timeout?: number;
      max_price_per_minute?: number;
      send_digits?: string;
      region?: string | string[];
      username?: string;
      password?: string;
      headers?: Record<string, unknown>[];
      custom_variables?: Record<string, string>;
      url?: string;
      swml?:
        | string
        | {
            sections: Section;
            version?: '1.0.0';
            [key: string]: Record<string, unknown> | Section | '1.0.0' | undefined;
          };
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      from,
      to,
      caller_id: options?.caller_id,
      fallback_url: options?.fallback_url,
      status_url: options?.status_url,
      status_events: options?.status_events,
      url_method: options?.url_method,
      codecs: options?.codecs,
      to_script: options?.to_script,
      timeout: options?.timeout,
      max_price_per_minute: options?.max_price_per_minute,
      send_digits: options?.send_digits,
      region: options?.region,
      username: options?.username,
      password: options?.password,
      headers: options?.headers,
      custom_variables: options?.custom_variables,
      url: options?.url,
      swml: options?.swml,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'dial', params },
      undefined,
      requestOptions,
    );
  }

  async update(
    id: uuid,
    options?: {
      fallback_url?: string;
      status?: 'canceled' | 'completed';
      status_url?: string;
      url?: string;
      swml?:
        | string
        | {
            sections: Section;
            version?: '1.0.0';
            [key: string]: Record<string, unknown> | Section | '1.0.0' | undefined;
          };
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      id,
      fallback_url: options?.fallback_url,
      status: options?.status,
      status_url: options?.status_url,
      url: options?.url,
      swml: options?.swml,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'update', params },
      undefined,
      requestOptions,
    );
  }

  async end(
    callId: string,
    options?: {
      reason?: 'hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error';
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      reason: options?.reason,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.end', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async aiHold(
    callId: string,
    options?: { prompt?: string; timeout?: string | number; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      prompt: options?.prompt,
      timeout: options?.timeout,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.ai_hold', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async aiUnhold(
    callId: string,
    options?: { prompt?: string; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      prompt: options?.prompt,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.ai_unhold', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async aiMessage(
    callId: string,
    options?: {
      global_data?: Record<string, unknown>;
      message_text?: string;
      reset?: RelayIsReset;
      role?: string;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      global_data: options?.global_data,
      message_text: options?.message_text,
      reset: options?.reset,
      role: options?.role,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.ai_message', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async liveTranscribe(
    callId: string,
    action:
      | 'start'
      | 'stop'
      | 'summarize'
      | {
          start?: {
            ai_summary?: boolean;
            ai_summary_prompt?: string;
            debug_level?: number;
            deepgram_key_override?: string;
            deepgram_url_override?: string;
            direction: ('local-caller' | 'remote-caller')[];
            hints?: string[];
            lang: string;
            live_events?: boolean;
            speech_engine?: 'deepgram' | 'google';
            speech_timeout?: number;
            vad_silence_ms?: number;
            vad_thresh?: number;
            verbose_utterances?: boolean;
            webhook?: string;
          };
          stop?: unknown;
          summarize?: {
            ai_model?: string;
            prompt?: string;
            summary_prompt?: string;
            webhook?: string;
          };
        },
    options?: { hints?: unknown[]; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      action,
      hints: options?.hints,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.live_transcribe', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async liveTranslate(
    callId: string,
    action:
      | 'start'
      | 'stop'
      | 'summarize'
      | 'inject'
      | {
          inject?: {
            direction: 'local-caller' | 'remote-caller';
            message: string;
          };
          start?: {
            ai_summary?: boolean;
            ai_summary_prompt?: string;
            debug_level?: number;
            deepgram_key_override?: string;
            deepgram_url_override?: string;
            direction: ('local-caller' | 'remote-caller')[];
            filter_from?: string;
            filter_to?: string;
            from_lang: string;
            from_voice?: string;
            from_voice_params?: Record<string, boolean | number | string>;
            live_events?: boolean;
            mode?: string;
            speech_engine?: 'deepgram' | 'google';
            speech_timeout?: number;
            to_lang: string;
            to_voice?: string;
            to_voice_params?: Record<string, boolean | number | string>;
            translation_model?: string;
            translation_model_params?: Record<string, unknown>;
            vad_silence_ms?: number;
            vad_thresh?: number;
            webhook?: string;
          };
          stop?: unknown;
          summarize?: {
            prompt?: string;
            summary_prompt?: string;
            webhook?: string;
          };
        },
    options?: { status_url?: string; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      action,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.live_translate', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async transfer(
    callId: string,
    dest: string | SWMLObject,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      dest,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.transfer', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async userEvent(
    callId: string,
    event: Record<string, unknown>,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      event,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.user_event', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async disconnect(
    callId: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = { ...options?.extras };
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.disconnect', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async play(
    callId: string,
    play: RelayCallPlayInner[],
    options?: {
      control_id?: string;
      direction?: 'listen' | 'speak' | 'both';
      gender?: 'male' | 'female';
      language?: string;
      loop?: number;
      status_url?: string;
      voice?: string;
      volume?: number;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      play,
      control_id: options?.control_id,
      direction: options?.direction,
      gender: options?.gender,
      language: options?.language,
      loop: options?.loop,
      status_url: options?.status_url,
      voice: options?.voice,
      volume: options?.volume,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    params.control_id ??= randomUUID();
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.play', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async playPause(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.play.pause', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async playResume(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.play.resume', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async playStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.play.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async playVolume(
    callId: string,
    control_id: string,
    volume: number,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
      volume,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.play.volume', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async record(
    callId: string,
    options?: {
      control_id?: string;
      record?: RelayCallRecordInner;
      status_url?: string;
      audio?: RelayCallRecordAudio;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id: options?.control_id,
      record: options?.record,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    if (options?.audio !== undefined)
      params.record = {
        ...(params.record as Record<string, unknown> | undefined),
        audio: options.audio,
      };
    params.control_id ??= randomUUID();
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.record', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async recordPause(
    callId: string,
    control_id: string,
    options?: { behavior?: 'skip' | 'silence'; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
      behavior: options?.behavior,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.record.pause', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async recordResume(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.record.resume', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async recordStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.record.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async collect(
    callId: string,
    options?: {
      continue?: boolean;
      continuous?: boolean;
      control_id?: string;
      digits?: RelayCallCollectDigitsInner;
      initial_timeout?: number;
      partial_results?: boolean;
      send_start_of_input?: boolean;
      speech?: RelayCallCollectSpeechInner;
      start_input_timers?: boolean;
      status_url?: string;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      continue: options?.continue,
      continuous: options?.continuous,
      control_id: options?.control_id,
      digits: options?.digits,
      initial_timeout: options?.initial_timeout,
      partial_results: options?.partial_results,
      send_start_of_input: options?.send_start_of_input,
      speech: options?.speech,
      start_input_timers: options?.start_input_timers,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    params.control_id ??= randomUUID();
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.collect', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async collectStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.collect.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async collectStartInputTimers(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.collect.start_input_timers', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async detect(
    callId: string,
    detect: RelayCallDetectInner,
    options?: {
      control_id?: string;
      status_url?: string;
      timeout?: number;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      detect,
      control_id: options?.control_id,
      status_url: options?.status_url,
      timeout: options?.timeout,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    params.control_id ??= randomUUID();
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.detect', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async detectStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.detect.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async tap(
    callId: string,
    tap: RelayTap,
    device: RelayCallTapDevice,
    options?: { control_id?: string; status_url?: string; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      device,
      tap,
      control_id: options?.control_id,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    params.control_id ??= randomUUID();
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.tap', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async tapStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.tap.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async stream(
    callId: string,
    url: string,
    options?: {
      authorization_bearer_token?: string;
      codec?: string;
      control_id?: string;
      custom_parameters?: Record<string, unknown>;
      name?: string;
      status_url?: string;
      status_url_method?: 'GET' | 'POST';
      track?: 'inbound_track' | 'outbound_track' | 'both_tracks';
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      url,
      authorization_bearer_token: options?.authorization_bearer_token,
      codec: options?.codec,
      control_id: options?.control_id,
      custom_parameters: options?.custom_parameters,
      name: options?.name,
      status_url: options?.status_url,
      status_url_method: options?.status_url_method,
      track: options?.track,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    params.control_id ??= randomUUID();
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.stream', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async streamStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.stream.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async denoise(
    callId: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = { ...options?.extras };
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.denoise', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async denoiseStop(
    callId: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = { ...options?.extras };
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.denoise.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async transcribe(
    callId: string,
    options?: { control_id?: string; status_url?: string; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id: options?.control_id,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    params.control_id ??= randomUUID();
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.transcribe', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async transcribeStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.transcribe.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async aiStop(
    callId: string,
    control_id?: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.ai.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async aiSidecar(
    callId: string,
    lang: string,
    options?: {
      SWAIG?: Record<string, unknown>;
      action?: Record<string, unknown>;
      customer_role?: 'remote-caller' | 'local-caller';
      direction?: ('remote-caller' | 'local-caller')[];
      global_data?: Record<string, unknown>;
      hints?: string[];
      model?: string;
      params?: Record<string, unknown>;
      permissions?: Record<string, unknown>;
      prompt?: Record<string, unknown> | string;
      url?: string;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      lang,
      SWAIG: options?.SWAIG,
      action: options?.action,
      customer_role: options?.customer_role,
      direction: options?.direction,
      global_data: options?.global_data,
      hints: options?.hints,
      model: options?.model,
      params: options?.params,
      permissions: options?.permissions,
      prompt: options?.prompt,
      url: options?.url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.ai_sidecar', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async aiSidecarAsk(
    callId: string,
    text: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      text,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.ai_sidecar.ask', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async aiSidecarPoke(
    callId: string,
    text: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      text,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.ai_sidecar.poke', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async aiSidecarStop(
    callId: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = { ...options?.extras };
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.ai_sidecar.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async aiSidecarStatus(
    callId: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = { ...options?.extras };
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.ai_sidecar.status', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async sendFaxStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.send_fax.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async receiveFaxStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.receive_fax.stop', params, id: callId },
      undefined,
      requestOptions,
    );
  }

  async refer(
    callId: string,
    device: RelayCallReferDevice,
    options?: { status_url?: string; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      device,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(
      this._basePath,
      { command: 'calling.refer', params, id: callId },
      undefined,
      requestOptions,
    );
  }
}
