/**
 * Calling API namespace — REST-based call control via command dispatch.
 *
 * All commands are sent as POST /api/calling/calls with a command field.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/**
 * REST call control — all 37 commands dispatched via a single POST endpoint.
 *
 * Access via `client.calling.*`. Every method issues one command against a live
 * call by ID and returns the platform's JSON response.
 *
 * @example Play audio on an active call
 * ```ts
 * await client.calling.play(callId, {
 *   play: [{ type: 'audio', url: 'https://cdn.example.com/hold.mp3' }],
 * });
 * ```
 *
 * @example Start and stop recording
 * ```ts
 * const rec = await client.calling.record(callId, { record: { audio: {} } });
 * // ... later ...
 * await client.calling.recordStop(callId, { control_id: rec.control_id });
 * ```
 */
export class CallingNamespace extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/calling/calls');
  }

  private async _execute(command: string, callId?: string, params: any = {}): Promise<any> {
    const body: any = { command, params };
    if (callId !== undefined) {
      body.id = callId;
    }
    return this._http.post(this._basePath, body);
  }

  // Call lifecycle

  /** Place an outbound call. */
  async dial(params: any = {}): Promise<any> {
    return this._execute('dial', undefined, params);
  }

  /** Update properties on an in-progress call. */
  async update(params: any = {}): Promise<any> {
    return this._execute('update', undefined, params);
  }

  /** Gracefully end a call. */
  async end(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.end', callId, params);
  }

  /** Transfer a call to another destination. */
  async transfer(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.transfer', callId, params);
  }

  /** Drop one leg from a call without ending the other. */
  async disconnect(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.disconnect', callId, params);
  }

  // Play

  /** Start media playback on a call. */
  async play(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play', callId, params);
  }

  /** Pause active playback. */
  async playPause(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.pause', callId, params);
  }

  /** Resume paused playback. */
  async playResume(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.resume', callId, params);
  }

  /** Stop active playback. */
  async playStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.stop', callId, params);
  }

  /** Adjust the playback volume. */
  async playVolume(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.volume', callId, params);
  }

  // Record

  /** Start recording a call. */
  async record(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record', callId, params);
  }

  /** Pause an active recording. */
  async recordPause(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record.pause', callId, params);
  }

  /** Resume a paused recording. */
  async recordResume(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record.resume', callId, params);
  }

  /** Stop and finalise a recording. */
  async recordStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record.stop', callId, params);
  }

  // Collect

  /** Collect DTMF / speech input from the caller. */
  async collect(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.collect', callId, params);
  }

  /** Stop an in-progress collect operation. */
  async collectStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.collect.stop', callId, params);
  }

  /** Start input timers for a collect operation. */
  async collectStartInputTimers(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.collect.start_input_timers', callId, params);
  }

  // Detect

  /** Run answering-machine / fax / DTMF detection. */
  async detect(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.detect', callId, params);
  }

  /** Stop an active detect operation. */
  async detectStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.detect.stop', callId, params);
  }

  // Tap

  /** Start a media tap (mirror audio to an external URI). */
  async tap(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.tap', callId, params);
  }

  /** Stop an active media tap. */
  async tapStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.tap.stop', callId, params);
  }

  // Stream

  /** Start an outbound media stream. */
  async stream(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.stream', callId, params);
  }

  /** Stop an outbound media stream. */
  async streamStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.stream.stop', callId, params);
  }

  // Denoise

  /** Enable noise reduction on the call. */
  async denoise(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.denoise', callId, params);
  }

  /** Disable noise reduction. */
  async denoiseStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.denoise.stop', callId, params);
  }

  // Transcribe

  /** Start real-time transcription on the call. */
  async transcribe(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.transcribe', callId, params);
  }

  /** Stop real-time transcription. */
  async transcribeStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.transcribe.stop', callId, params);
  }

  // AI

  /** Send a message into an active AI agent session. */
  async aiMessage(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai_message', callId, params);
  }

  /** Put the AI session on hold (pause turn-taking). */
  async aiHold(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai_hold', callId, params);
  }

  /** Resume an AI session that was on hold. */
  async aiUnhold(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai_unhold', callId, params);
  }

  /** Terminate the active AI session on a call. */
  async aiStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai.stop', callId, params);
  }

  // Live transcribe / translate

  /** Start live transcription that emits events as speech is recognised. */
  async liveTranscribe(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.live_transcribe', callId, params);
  }

  /** Start live translation between two languages. */
  async liveTranslate(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.live_translate', callId, params);
  }

  // Fax

  /** Stop a send-fax operation mid-stream. */
  async sendFaxStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.send_fax.stop', callId, params);
  }

  /** Stop a receive-fax operation mid-stream. */
  async receiveFaxStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.receive_fax.stop', callId, params);
  }

  // SIP

  /** Send a SIP REFER to transfer a call outside the platform. */
  async refer(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.refer', callId, params);
  }

  // Custom events

  /** Emit a custom user event on the call for your webhooks. */
  async userEvent(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.user_event', callId, params);
  }
}
