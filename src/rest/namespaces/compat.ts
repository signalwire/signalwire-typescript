/**
 * Compatibility API namespace — Twilio-compatible LAML API with AccountSid scoping.
 *
 * All updates use POST (Twilio-compatible, not REST-idiomatic PATCH/PUT).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { CrudResource } from '../base/CrudResource.js';

/** Compat account / subproject management (Twilio-compatible LAML). */
export class CompatAccounts extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/laml/2010-04-01/Accounts');
  }

  /**
   * List accounts visible to the authenticated project.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A LAML-shaped paginated account list.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Create a new sub-account under the authenticated parent account.
   *
   * @param body - Account payload (`FriendlyName`, etc.) — LAML form keys.
   * @returns The newly-created account record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  /**
   * Fetch an account by SID.
   *
   * @param sid - Account SID (e.g. `"AC..."`).
   * @returns The account record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  /**
   * Update an account's attributes. LAML uses `POST` (not PATCH/PUT).
   *
   * @param sid - Account SID.
   * @param body - Partial update payload. Defaults to `{}`.
   * @returns The updated account record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(sid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(sid), body);
  }
}

/** Compat call management with recording and stream sub-resources. */
export class CompatCalls extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Update an in-progress or past call. LAML uses `POST` (not PATCH/PUT).
   *
   * @param sid - Call SID (e.g. `"CA..."`).
   * @param body - LAML-form update payload (`Status`, `Url`, etc.). Defaults to `{}`.
   * @returns The updated call record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  override async update(sid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  /**
   * Start recording an active call.
   *
   * @param callSid - Call SID.
   * @param body - Recording parameters (channels, trim, status callback, etc.).
   *   Defaults to `{}`.
   * @returns The newly-started recording record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async startRecording(callSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(callSid, 'Recordings'), body);
  }

  /**
   * Update an active recording (e.g. `Status=paused` / `Status=stopped`).
   *
   * @param callSid - Call SID.
   * @param recordingSid - Recording SID returned by {@link startRecording}.
   * @param body - Update payload. Defaults to `{}`.
   * @returns The updated recording record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async updateRecording(callSid: string, recordingSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(callSid, 'Recordings', recordingSid), body);
  }

  /**
   * Start a media stream on an active call (WebSocket media forwarding).
   *
   * @param callSid - Call SID.
   * @param body - Stream parameters (URL, track, etc.). Defaults to `{}`.
   * @returns The newly-started stream record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async startStream(callSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(callSid, 'Streams'), body);
  }

  /**
   * Stop an active media stream on a call.
   *
   * @param callSid - Call SID.
   * @param streamSid - Stream SID returned by {@link startStream}.
   * @param body - Update payload. Defaults to `{}`.
   * @returns The stopped stream record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async stopStream(callSid: string, streamSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(callSid, 'Streams', streamSid), body);
  }
}

/** Compat message management with media sub-resources. */
export class CompatMessages extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Update a message. LAML uses `POST` (not PATCH/PUT).
   *
   * @param sid - Message SID (e.g. `"SM..."` / `"MM..."`).
   * @param body - LAML-form update payload. Defaults to `{}`.
   * @returns The updated message record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  override async update(sid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  /**
   * List media attachments for a message (MMS).
   *
   * @param messageSid - Message SID.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of media records.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listMedia(messageSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(messageSid, 'Media'), params);
  }

  /**
   * Fetch a specific media attachment on a message.
   *
   * @param messageSid - Message SID.
   * @param mediaSid - Media SID.
   * @returns The media record (metadata + URL).
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getMedia(messageSid: string, mediaSid: string): Promise<any> {
    return this._http.get(this._path(messageSid, 'Media', mediaSid));
  }

  /**
   * Delete a media attachment from a message.
   *
   * @param messageSid - Message SID.
   * @param mediaSid - Media SID.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async deleteMedia(messageSid: string, mediaSid: string): Promise<any> {
    return this._http.delete(this._path(messageSid, 'Media', mediaSid));
  }
}

/** Compat fax management with media sub-resources. */
export class CompatFaxes extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Update a fax. LAML uses `POST` (not PATCH/PUT).
   *
   * @param sid - Fax SID (e.g. `"FX..."`).
   * @param body - LAML-form update payload. Defaults to `{}`.
   * @returns The updated fax record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  override async update(sid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  /**
   * List media attachments for a fax.
   *
   * @param faxSid - Fax SID.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of media records.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listMedia(faxSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(faxSid, 'Media'), params);
  }

  /**
   * Fetch a specific media attachment on a fax.
   *
   * @param faxSid - Fax SID.
   * @param mediaSid - Media SID.
   * @returns The media record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getMedia(faxSid: string, mediaSid: string): Promise<any> {
    return this._http.get(this._path(faxSid, 'Media', mediaSid));
  }

  /**
   * Delete a media attachment from a fax.
   *
   * @param faxSid - Fax SID.
   * @param mediaSid - Media SID.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async deleteMedia(faxSid: string, mediaSid: string): Promise<any> {
    return this._http.delete(this._path(faxSid, 'Media', mediaSid));
  }
}

/** Compat conference management with participants, recordings, and streams. */
export class CompatConferences extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List conferences in the account.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of conferences.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a conference by SID.
   *
   * @param sid - Conference SID (e.g. `"CF..."`).
   * @returns The conference record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  /**
   * Update a conference (e.g. `Status=completed` to terminate).
   * LAML uses `POST` (not PATCH/PUT).
   *
   * @param sid - Conference SID.
   * @param body - LAML-form update payload. Defaults to `{}`.
   * @returns The updated conference record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(sid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  // Participants

  /**
   * List participants in a conference.
   *
   * @param conferenceSid - Conference SID.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of participants.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listParticipants(conferenceSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceSid, 'Participants'), params);
  }

  /**
   * Fetch a specific participant (by its call SID) in a conference.
   *
   * @param conferenceSid - Conference SID.
   * @param callSid - Participant's call SID.
   * @returns The participant record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getParticipant(conferenceSid: string, callSid: string): Promise<any> {
    return this._http.get(this._path(conferenceSid, 'Participants', callSid));
  }

  /**
   * Update a participant (mute, hold, announce, etc.). LAML uses `POST`.
   *
   * @param conferenceSid - Conference SID.
   * @param callSid - Participant's call SID.
   * @param body - LAML-form update payload (e.g. `{ Muted: 'true' }`).
   *   Defaults to `{}`.
   * @returns The updated participant record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async updateParticipant(conferenceSid: string, callSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(conferenceSid, 'Participants', callSid), body);
  }

  /**
   * Remove a participant from a conference (kick).
   *
   * @param conferenceSid - Conference SID.
   * @param callSid - Participant's call SID.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async removeParticipant(conferenceSid: string, callSid: string): Promise<any> {
    return this._http.delete(this._path(conferenceSid, 'Participants', callSid));
  }

  // Conference recordings

  /**
   * List recordings taken of a conference.
   *
   * @param conferenceSid - Conference SID.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of recordings.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listRecordings(conferenceSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceSid, 'Recordings'), params);
  }

  /**
   * Fetch a specific conference recording.
   *
   * @param conferenceSid - Conference SID.
   * @param recordingSid - Recording SID.
   * @returns The recording record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getRecording(conferenceSid: string, recordingSid: string): Promise<any> {
    return this._http.get(this._path(conferenceSid, 'Recordings', recordingSid));
  }

  /**
   * Update an active conference recording (pause, resume, stop). LAML uses `POST`.
   *
   * @param conferenceSid - Conference SID.
   * @param recordingSid - Recording SID.
   * @param body - LAML-form update payload. Defaults to `{}`.
   * @returns The updated recording record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async updateRecording(conferenceSid: string, recordingSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(conferenceSid, 'Recordings', recordingSid), body);
  }

  /**
   * Delete a conference recording.
   *
   * @param conferenceSid - Conference SID.
   * @param recordingSid - Recording SID.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async deleteRecording(conferenceSid: string, recordingSid: string): Promise<any> {
    return this._http.delete(this._path(conferenceSid, 'Recordings', recordingSid));
  }

  // Conference streams

  /**
   * Start a media stream on a conference.
   *
   * @param conferenceSid - Conference SID.
   * @param body - Stream parameters (URL, track, etc.). Defaults to `{}`.
   * @returns The newly-started stream record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async startStream(conferenceSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(conferenceSid, 'Streams'), body);
  }

  /**
   * Stop an active conference media stream.
   *
   * @param conferenceSid - Conference SID.
   * @param streamSid - Stream SID returned by {@link startStream}.
   * @param body - Update payload. Defaults to `{}`.
   * @returns The stopped stream record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async stopStream(conferenceSid: string, streamSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(conferenceSid, 'Streams', streamSid), body);
  }
}

/** Compat phone number management with searching, purchasing, and import. */
export class CompatPhoneNumbers extends BaseResource {
  private readonly _availableBase: string;

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
    this._availableBase = basePath.replace('/IncomingPhoneNumbers', '/AvailablePhoneNumbers');
  }

  /**
   * List owned incoming phone numbers in the account.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of owned numbers.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Purchase a phone number (LAML `POST /IncomingPhoneNumbers`).
   *
   * @param body - Purchase payload, typically including `PhoneNumber` or
   *   `AreaCode` plus webhook URLs.
   * @returns The newly-purchased phone-number record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async purchase(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  /**
   * Fetch an owned phone number by SID.
   *
   * @param sid - Phone number SID (e.g. `"PN..."`).
   * @returns The phone-number record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  /**
   * Update an owned phone number (webhook URLs, friendly name, etc.).
   * LAML uses `POST`.
   *
   * @param sid - Phone number SID.
   * @param body - LAML-form update payload. Defaults to `{}`.
   * @returns The updated phone-number record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(sid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  /**
   * Release an owned phone number (delete).
   *
   * @param sid - Phone number SID.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(sid: string): Promise<any> {
    return this._http.delete(this._path(sid));
  }

  /**
   * Import an externally-hosted phone number into the account
   * (LAML `/ImportedPhoneNumbers`).
   *
   * @param body - Import payload (number, carrier details, etc.).
   * @returns The newly-imported number record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async importNumber(body: any): Promise<any> {
    const path = this._basePath.replace('/IncomingPhoneNumbers', '/ImportedPhoneNumbers');
    return this._http.post(path, body);
  }

  /**
   * List countries in which numbers are available for purchase.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of country records with capabilities.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listAvailableCountries(params?: QueryParams): Promise<any> {
    return this._http.get(this._availableBase, params);
  }

  /**
   * Search for available local phone numbers in a country.
   *
   * @param country - ISO-3166 country code (e.g. `"US"`, `"CA"`).
   * @param params - Search filters (`AreaCode`, `Contains`, `NearNumber`, etc.).
   * @returns A paginated list of available local numbers.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async searchLocal(country: string, params?: QueryParams): Promise<any> {
    return this._http.get(`${this._availableBase}/${country}/Local`, params);
  }

  /**
   * Search for available toll-free phone numbers in a country.
   *
   * @param country - ISO-3166 country code.
   * @param params - Search filters (`Contains`, `NearNumber`, etc.).
   * @returns A paginated list of available toll-free numbers.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async searchTollFree(country: string, params?: QueryParams): Promise<any> {
    return this._http.get(`${this._availableBase}/${country}/TollFree`, params);
  }
}

/** Compat application management (LAML-style `Applications`). */
export class CompatApplications extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Update an application. LAML uses `POST` (not PATCH/PUT).
   *
   * @param sid - Application SID (e.g. `"AP..."`).
   * @param body - LAML-form update payload. Defaults to `{}`.
   * @returns The updated application record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  override async update(sid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(sid), body);
  }
}

/** Compat cXML / LaML Bin management. */
export class CompatLamlBins extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Update a LaML Bin's stored script. LAML uses `POST` (not PATCH/PUT).
   *
   * @param sid - LaML Bin SID (e.g. `"LA..."`).
   * @param body - Payload containing the new `VoiceMethod`, `Url`, etc.
   *   Defaults to `{}`.
   * @returns The updated LaML Bin record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  override async update(sid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(sid), body);
  }
}

/** Compat queue management with member operations. */
export class CompatQueues extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Update a queue. LAML uses `POST` (not PATCH/PUT).
   *
   * @param sid - Queue SID (e.g. `"QU..."`).
   * @param body - LAML-form update payload. Defaults to `{}`.
   * @returns The updated queue record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  override async update(sid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  /**
   * List members (calls) currently waiting in a queue.
   *
   * @param queueSid - Queue SID.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of queue members.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listMembers(queueSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(queueSid, 'Members'), params);
  }

  /**
   * Fetch a specific member (by call SID) currently waiting in a queue.
   *
   * @param queueSid - Queue SID.
   * @param callSid - Call SID of the queued member.
   * @returns The queue-member record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getMember(queueSid: string, callSid: string): Promise<any> {
    return this._http.get(this._path(queueSid, 'Members', callSid));
  }

  /**
   * Dequeue a member — LAML's `POST` on a queued call redirects it to the
   * given `Url` (typically to connect the caller to a queue consumer).
   *
   * @param queueSid - Queue SID.
   * @param callSid - Call SID of the queued member.
   * @param body - LAML-form payload (commonly `{ Url, Method }`).
   *   Defaults to `{}`.
   * @returns The updated queue-member record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async dequeueMember(queueSid: string, callSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(queueSid, 'Members', callSid), body);
  }
}

/** Compat recording management (list / get / delete). */
export class CompatRecordings extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List recordings in the account.
   *
   * @param params - Optional filter / pagination query parameters
   *   (date range, call SID, conference SID, etc.).
   * @returns A paginated list of recordings.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a recording by SID.
   *
   * @param sid - Recording SID (e.g. `"RE..."`).
   * @returns The recording record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  /**
   * Delete a recording.
   *
   * @param sid - Recording SID.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(sid: string): Promise<any> {
    return this._http.delete(this._path(sid));
  }
}

/** Compat transcription management (list / get / delete). */
export class CompatTranscriptions extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List transcriptions in the account.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of transcriptions.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a transcription by SID.
   *
   * @param sid - Transcription SID (e.g. `"TR..."`).
   * @returns The transcription record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  /**
   * Delete a transcription.
   *
   * @param sid - Transcription SID.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(sid: string): Promise<any> {
    return this._http.delete(this._path(sid));
  }
}

/** Compat API token management (non-LAML — uses `PATCH`). */
export class CompatTokens extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Create a new Compat API token.
   *
   * @param body - Token payload (friendly name, scopes, etc.).
   * @returns The newly-created token record, including the secret value.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  /**
   * Update a Compat API token.
   *
   * @param tokenId - Unique identifier of the token.
   * @param body - Partial update payload. Defaults to `{}`.
   * @returns The updated token record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(tokenId: string, body: any = {}): Promise<any> {
    return this._http.patch(this._path(tokenId), body);
  }

  /**
   * Revoke and delete a Compat API token.
   *
   * @param tokenId - Unique identifier of the token.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(tokenId: string): Promise<any> {
    return this._http.delete(this._path(tokenId));
  }
}

/**
 * Twilio-compatible LAML API namespace with AccountSid scoping.
 *
 * Access via `client.compat.*`. This is the legacy LAML (cXML) surface for code
 * migrated from Twilio — all updates use POST bodies instead of REST-idiomatic
 * PATCH/PUT. Prefer the native SignalWire namespaces (`client.calling`, `client.fabric`,
 * etc.) for greenfield projects.
 *
 * @example Send an SMS via the LAML Messages API
 * ```ts
 * await client.compat.messages.create({
 *   From: '+15551112222',
 *   To: '+15553334444',
 *   Body: 'Hello from SignalWire!',
 * });
 * ```
 */
export class CompatNamespace {
  /** Main and sub-account CRUD. */
  readonly accounts: CompatAccounts;
  /** Call CRUD plus recording / stream sub-resource management. */
  readonly calls: CompatCalls;
  /** Message CRUD plus media sub-resource management. */
  readonly messages: CompatMessages;
  /** Fax CRUD plus media sub-resource management. */
  readonly faxes: CompatFaxes;
  /** Conference read / update with participants, recordings, and streams. */
  readonly conferences: CompatConferences;
  /** Phone number CRUD plus search / purchase / import helpers. */
  readonly phoneNumbers: CompatPhoneNumbers;
  /** LAML Application CRUD. */
  readonly applications: CompatApplications;
  /** LaML Bin (hosted script) CRUD. */
  readonly lamlBins: CompatLamlBins;
  /** Queue CRUD plus member list / fetch / dequeue. */
  readonly queues: CompatQueues;
  /** Recording list / fetch / delete. */
  readonly recordings: CompatRecordings;
  /** Transcription list / fetch / delete. */
  readonly transcriptions: CompatTranscriptions;
  /** Compat API token create / update / delete. */
  readonly tokens: CompatTokens;

  constructor(http: HttpClient, accountSid: string) {
    const base = `/api/laml/2010-04-01/Accounts/${accountSid}`;

    this.accounts = new CompatAccounts(http);
    this.calls = new CompatCalls(http, `${base}/Calls`);
    this.messages = new CompatMessages(http, `${base}/Messages`);
    this.faxes = new CompatFaxes(http, `${base}/Faxes`);
    this.conferences = new CompatConferences(http, `${base}/Conferences`);
    this.phoneNumbers = new CompatPhoneNumbers(http, `${base}/IncomingPhoneNumbers`);
    this.applications = new CompatApplications(http, `${base}/Applications`);
    this.lamlBins = new CompatLamlBins(http, `${base}/LamlBins`);
    this.queues = new CompatQueues(http, `${base}/Queues`);
    this.recordings = new CompatRecordings(http, `${base}/Recordings`);
    this.transcriptions = new CompatTranscriptions(http, `${base}/Transcriptions`);
    this.tokens = new CompatTokens(http, `${base}/tokens`);
  }
}
