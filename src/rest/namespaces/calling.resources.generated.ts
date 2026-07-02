// AUTO-GENERATED from porting-sdk/rest-apis/calling/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';
import type {
  CallAIMessageResetParams,
  CallResponse,
  HangupReason,
  LiveTranscribeStartAction,
  LiveTranscribeStopAction,
  LiveTranscribeSummarizeAction,
  LiveTranslateInjectAction,
  LiveTranslateStartAction,
  LiveTranslateStopAction,
  LiveTranslateSummarizeAction,
  SWMLObject,
  uuid,
} from './calling.types.generated.js';

export class Calling extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/calling/calls');
  }

  async dial(
    from: string,
    to: string,
    options?: {
      caller_id?: string;
      fallback_url?: string;
      status_url?: string;
      status_events?: ('answered' | 'queued' | 'initiated' | 'ringing' | 'ending' | 'ended')[];
      url_method?: string;
      url?: string;
      codecs?: string[] | string;
      swml?: SWMLObject;
      extras?: Record<string, unknown>;
    },
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
      url: options?.url,
      codecs: options?.codecs,
      swml: options?.swml,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, { command: 'dial', params });
  }

  async update(
    id: uuid,
    options?: {
      fallback_url?: string;
      status?: 'canceled' | 'completed';
      status_url?: string;
      url?: string;
      swml?: SWMLObject;
      extras?: Record<string, unknown>;
    },
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
    return this._http.post<CallResponse>(this._basePath, { command: 'update', params });
  }

  async end(
    callId: string,
    options?: { reason?: HangupReason; extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      reason: options?.reason,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.end',
      params,
      id: callId,
    });
  }

  async aiHold(
    callId: string,
    options?: { timeout?: number; prompt?: string; extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      timeout: options?.timeout,
      prompt: options?.prompt,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.ai_hold',
      params,
      id: callId,
    });
  }

  async aiUnhold(
    callId: string,
    options?: { prompt?: string; extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      prompt: options?.prompt,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.ai_unhold',
      params,
      id: callId,
    });
  }

  async aiMessage(
    callId: string,
    options?: {
      role?: 'system' | 'user' | 'assistant';
      message_text?: string;
      reset?: CallAIMessageResetParams;
      global_data?: Record<string, Record<string, unknown>>;
      extras?: Record<string, unknown>;
    },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      role: options?.role,
      message_text: options?.message_text,
      reset: options?.reset,
      global_data: options?.global_data,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.ai_message',
      params,
      id: callId,
    });
  }

  async liveTranscribe(
    callId: string,
    action: LiveTranscribeStartAction | LiveTranscribeSummarizeAction | LiveTranscribeStopAction,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      action,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.live_transcribe',
      params,
      id: callId,
    });
  }

  async liveTranslate(
    callId: string,
    action:
      | LiveTranslateStartAction
      | LiveTranslateSummarizeAction
      | LiveTranslateInjectAction
      | LiveTranslateStopAction,
    options?: { status_url?: string; extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      action,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.live_translate',
      params,
      id: callId,
    });
  }

  async transfer(
    callId: string,
    dest: string | SWMLObject,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      dest,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.transfer',
      params,
      id: callId,
    });
  }

  async userEvent(
    callId: string,
    event: Record<string, Record<string, unknown>>,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      event,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.user_event',
      params,
      id: callId,
    });
  }

  async disconnect(
    callId: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = { ...options?.extras };
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.disconnect',
      params,
      id: callId,
    });
  }

  async play(
    callId: string,
    play: Record<string, unknown>[],
    options?: {
      control_id?: string;
      volume?: number;
      direction?: 'listen' | 'speak' | 'both';
      loop?: number;
      status_url?: string;
      extras?: Record<string, unknown>;
    },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      play,
      control_id: options?.control_id,
      volume: options?.volume,
      direction: options?.direction,
      loop: options?.loop,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.play',
      params,
      id: callId,
    });
  }

  async playPause(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.play.pause',
      params,
      id: callId,
    });
  }

  async playResume(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.play.resume',
      params,
      id: callId,
    });
  }

  async playStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.play.stop',
      params,
      id: callId,
    });
  }

  async playVolume(
    callId: string,
    control_id: string,
    volume: number,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
      volume,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.play.volume',
      params,
      id: callId,
    });
  }

  async record(
    callId: string,
    options?: {
      control_id?: string;
      audio?: Record<string, unknown>;
      status_url?: string;
      extras?: Record<string, unknown>;
    },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id: options?.control_id,
      audio: options?.audio,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.record',
      params,
      id: callId,
    });
  }

  async recordPause(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.record.pause',
      params,
      id: callId,
    });
  }

  async recordResume(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.record.resume',
      params,
      id: callId,
    });
  }

  async recordStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.record.stop',
      params,
      id: callId,
    });
  }

  async collect(
    callId: string,
    options?: {
      control_id?: string;
      initial_timeout?: number;
      digits?: Record<string, unknown>;
      speech?: Record<string, unknown>;
      continuous?: boolean;
      partial_results?: boolean;
      extras?: Record<string, unknown>;
    },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id: options?.control_id,
      initial_timeout: options?.initial_timeout,
      digits: options?.digits,
      speech: options?.speech,
      continuous: options?.continuous,
      partial_results: options?.partial_results,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.collect',
      params,
      id: callId,
    });
  }

  async collectStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.collect.stop',
      params,
      id: callId,
    });
  }

  async collectStartInputTimers(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.collect.start_input_timers',
      params,
      id: callId,
    });
  }

  async detect(
    callId: string,
    detect: Record<string, unknown>,
    options?: { control_id?: string; timeout?: number; extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      detect,
      control_id: options?.control_id,
      timeout: options?.timeout,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.detect',
      params,
      id: callId,
    });
  }

  async detectStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.detect.stop',
      params,
      id: callId,
    });
  }

  async tap(
    callId: string,
    tap: Record<string, unknown>,
    device: Record<string, unknown>,
    options?: { control_id?: string; extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      tap,
      device,
      control_id: options?.control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.tap',
      params,
      id: callId,
    });
  }

  async tapStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.tap.stop',
      params,
      id: callId,
    });
  }

  async stream(
    callId: string,
    url: string,
    options?: {
      control_id?: string;
      codec?: string;
      track?: 'inbound_track' | 'outbound_track' | 'both_tracks';
      authorization_bearer_token?: string;
      custom_parameters?: Record<string, unknown>;
      extras?: Record<string, unknown>;
    },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      url,
      control_id: options?.control_id,
      codec: options?.codec,
      track: options?.track,
      authorization_bearer_token: options?.authorization_bearer_token,
      custom_parameters: options?.custom_parameters,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.stream',
      params,
      id: callId,
    });
  }

  async streamStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.stream.stop',
      params,
      id: callId,
    });
  }

  async denoise(
    callId: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = { ...options?.extras };
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.denoise',
      params,
      id: callId,
    });
  }

  async denoiseStop(
    callId: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = { ...options?.extras };
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.denoise.stop',
      params,
      id: callId,
    });
  }

  async transcribe(
    callId: string,
    options?: { control_id?: string; status_url?: string; extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id: options?.control_id,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.transcribe',
      params,
      id: callId,
    });
  }

  async transcribeStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.transcribe.stop',
      params,
      id: callId,
    });
  }

  async aiStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.ai.stop',
      params,
      id: callId,
    });
  }

  async sendFaxStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.send_fax.stop',
      params,
      id: callId,
    });
  }

  async receiveFaxStop(
    callId: string,
    control_id: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      control_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.receive_fax.stop',
      params,
      id: callId,
    });
  }

  async refer(
    callId: string,
    device: Record<string, unknown>,
    options?: { status_url?: string; extras?: Record<string, unknown> },
  ): Promise<CallResponse> {
    const params: Record<string, unknown> = {};
    const _fields = {
      device,
      status_url: options?.status_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) params[k] = v;
    if (options?.extras) Object.assign(params, options.extras);
    return this._http.post<CallResponse>(this._basePath, {
      command: 'calling.refer',
      params,
      id: callId,
    });
  }
}
