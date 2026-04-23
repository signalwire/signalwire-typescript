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
 * Every command method shares the same shape:
 *
 * - First argument (when present) is the target call's ID.
 * - Second argument is a platform-shaped `params` object — see the
 *   [Calling API reference](https://developer.signalwire.com/rest/signalwire-rest/endpoints/calling/)
 *   for the fields each command accepts.
 * - The method returns the JSON-decoded platform response.
 * - Throws {@link RestError} on any non-2xx HTTP response.
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

  /**
   * Place an outbound call.
   *
   * @param params - Platform-shaped dial parameters (from, to, timeout, etc.).
   *   Defaults to `{}`.
   * @returns The dial command response, typically containing a new `call_id`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async dial(params: any = {}): Promise<any> {
    return this._execute('dial', undefined, params);
  }

  /**
   * Update properties on an in-progress call.
   *
   * @param params - Platform-shaped update parameters. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(params: any = {}): Promise<any> {
    return this._execute('update', undefined, params);
  }

  /**
   * Gracefully end a call.
   *
   * @param callId - Target call's ID.
   * @param params - Platform-shaped end parameters. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async end(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.end', callId, params);
  }

  /**
   * Transfer a call to another destination.
   *
   * @param callId - Target call's ID.
   * @param params - Platform-shaped transfer parameters (`to`, `from`, etc.).
   *   Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async transfer(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.transfer', callId, params);
  }

  /**
   * Drop one leg from a call without ending the other.
   *
   * @param callId - Target call's ID.
   * @param params - Platform-shaped disconnect parameters. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async disconnect(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.disconnect', callId, params);
  }

  // Play

  /**
   * Start media playback on a call.
   *
   * @param callId - Target call's ID.
   * @param params - Playback parameters — see `Play` action schema. Defaults to `{}`.
   * @returns The play command response, containing a `control_id` used to
   *   pause / resume / stop the playback later.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async play(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play', callId, params);
  }

  /**
   * Pause active playback.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id` from the matching `play()` call.
   *   Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async playPause(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.pause', callId, params);
  }

  /**
   * Resume paused playback.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async playResume(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.resume', callId, params);
  }

  /**
   * Stop active playback.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async playStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.stop', callId, params);
  }

  /**
   * Adjust the playback volume.
   *
   * @param callId - Target call's ID.
   * @param params - `control_id` plus `volume` (integer dB). Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async playVolume(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.volume', callId, params);
  }

  // Record

  /**
   * Start recording a call.
   *
   * @param callId - Target call's ID.
   * @param params - Recording parameters (`record` config, callbacks, etc.).
   *   Defaults to `{}`.
   * @returns The record command response containing a `control_id`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async record(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record', callId, params);
  }

  /**
   * Pause an active recording.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async recordPause(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record.pause', callId, params);
  }

  /**
   * Resume a paused recording.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async recordResume(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record.resume', callId, params);
  }

  /**
   * Stop and finalise a recording.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The final recording metadata.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async recordStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record.stop', callId, params);
  }

  // Collect

  /**
   * Collect DTMF / speech input from the caller.
   *
   * @param callId - Target call's ID.
   * @param params - Collect configuration (`digits`, `speech`, timeouts, etc.).
   *   Defaults to `{}`.
   * @returns The collect command response containing a `control_id`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async collect(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.collect', callId, params);
  }

  /**
   * Stop an in-progress collect operation.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async collectStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.collect.stop', callId, params);
  }

  /**
   * Start input timers for a collect operation (useful when `initial_timeout`
   * should be reset after media finishes playing).
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async collectStartInputTimers(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.collect.start_input_timers', callId, params);
  }

  // Detect

  /**
   * Run answering-machine / fax / DTMF detection.
   *
   * @param callId - Target call's ID.
   * @param params - Detect configuration. Defaults to `{}`.
   * @returns The detect command response containing a `control_id`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async detect(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.detect', callId, params);
  }

  /**
   * Stop an active detect operation.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async detectStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.detect.stop', callId, params);
  }

  // Tap

  /**
   * Start a media tap (mirror audio to an external URI).
   *
   * @param callId - Target call's ID.
   * @param params - Tap configuration (`uri`, `direction`, `codec`, etc.).
   *   Defaults to `{}`.
   * @returns The tap command response containing a `control_id`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async tap(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.tap', callId, params);
  }

  /**
   * Stop an active media tap.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async tapStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.tap.stop', callId, params);
  }

  // Stream

  /**
   * Start an outbound media stream (typically to a WebSocket endpoint).
   *
   * @param callId - Target call's ID.
   * @param params - Stream configuration. Defaults to `{}`.
   * @returns The stream command response containing a `control_id`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async stream(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.stream', callId, params);
  }

  /**
   * Stop an outbound media stream.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async streamStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.stream.stop', callId, params);
  }

  // Denoise

  /**
   * Enable noise reduction on the call.
   *
   * @param callId - Target call's ID.
   * @param params - Denoise configuration. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async denoise(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.denoise', callId, params);
  }

  /**
   * Disable noise reduction.
   *
   * @param callId - Target call's ID.
   * @param params - Platform-shaped parameters. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async denoiseStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.denoise.stop', callId, params);
  }

  // Transcribe

  /**
   * Start real-time transcription on the call.
   *
   * @param callId - Target call's ID.
   * @param params - Transcription configuration. Defaults to `{}`.
   * @returns The transcribe command response containing a `control_id`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async transcribe(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.transcribe', callId, params);
  }

  /**
   * Stop real-time transcription.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The final transcription metadata.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async transcribeStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.transcribe.stop', callId, params);
  }

  // AI

  /**
   * Send a message into an active AI agent session.
   *
   * @param callId - Target call's ID.
   * @param params - AI message payload. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async aiMessage(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai_message', callId, params);
  }

  /**
   * Put the AI session on hold (pause turn-taking).
   *
   * @param callId - Target call's ID.
   * @param params - Platform-shaped parameters. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async aiHold(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai_hold', callId, params);
  }

  /**
   * Resume an AI session that was on hold.
   *
   * @param callId - Target call's ID.
   * @param params - Platform-shaped parameters. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async aiUnhold(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai_unhold', callId, params);
  }

  /**
   * Terminate the active AI session on a call.
   *
   * @param callId - Target call's ID.
   * @param params - Platform-shaped parameters. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async aiStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai.stop', callId, params);
  }

  // Live transcribe / translate

  /**
   * Start live transcription that emits events as speech is recognised.
   *
   * @param callId - Target call's ID.
   * @param params - Configuration (languages, model, partials, etc.).
   *   Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async liveTranscribe(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.live_transcribe', callId, params);
  }

  /**
   * Start live translation between two languages.
   *
   * @param callId - Target call's ID.
   * @param params - Configuration (`source_lang`, `target_lang`, etc.).
   *   Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async liveTranslate(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.live_translate', callId, params);
  }

  // Fax

  /**
   * Stop a send-fax operation mid-stream.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async sendFaxStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.send_fax.stop', callId, params);
  }

  /**
   * Stop a receive-fax operation mid-stream.
   *
   * @param callId - Target call's ID.
   * @param params - Must include `control_id`. Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async receiveFaxStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.receive_fax.stop', callId, params);
  }

  // SIP

  /**
   * Send a SIP REFER to transfer a call outside the platform.
   *
   * @param callId - Target call's ID.
   * @param params - REFER parameters (`refer_to`, etc.). Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async refer(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.refer', callId, params);
  }

  // Custom events

  /**
   * Emit a custom user event on the call for your webhooks.
   *
   * @param callId - Target call's ID.
   * @param params - Event payload — freeform data delivered to your webhook.
   *   Defaults to `{}`.
   * @returns The platform's response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async userEvent(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.user_event', callId, params);
  }
}
