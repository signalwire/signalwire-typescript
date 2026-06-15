/**
 * Logs namespace — message, voice, fax, and conference logs (read-only).
 *
 * Each sub-resource is typed from its own canonical OpenAPI spec module:
 * message logs from `message`, voice logs from `voice`, fax logs from `fax`,
 * conference logs from `logs`.
 */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import type { ListMessageLogsResponse, GetMessageLogResponse } from './message.types.generated.js';
import type {
  ListVoiceLogsResponse,
  GetVoiceLogResponse,
  ListVoiceLogEventsResponse,
} from './voice.types.generated.js';
import type { ListFaxLogsResponse, GetFaxLogResponse } from './fax.types.generated.js';
import type { ListConferencesResponse } from './logs.types.generated.js';

/** Message log queries. */
export class MessageLogs extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List message log entries.
   *
   * @param params - Optional filter / pagination query parameters
   *   (e.g. date range, direction, status).
   * @returns A paginated list of message log entries.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<ListMessageLogsResponse> {
    return this._http.get<ListMessageLogsResponse>(this._basePath, params);
  }

  /**
   * Fetch a single message log entry by ID.
   *
   * @param logId - Unique identifier of the log entry.
   * @returns The log entry record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(logId: string): Promise<GetMessageLogResponse> {
    return this._http.get<GetMessageLogResponse>(this._path(logId));
  }
}

/** Voice log queries. */
export class VoiceLogs extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List voice (call) log entries.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of voice log entries.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<ListVoiceLogsResponse> {
    return this._http.get<ListVoiceLogsResponse>(this._basePath, params);
  }

  /**
   * Fetch a single voice log entry by ID.
   *
   * @param logId - Unique identifier of the log entry.
   * @returns The log entry record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(logId: string): Promise<GetVoiceLogResponse> {
    return this._http.get<GetVoiceLogResponse>(this._path(logId));
  }

  /**
   * List events captured during a voice log entry.
   *
   * @param logId - Unique identifier of the log entry.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of events for the log entry.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listEvents(logId: string, params?: QueryParams): Promise<ListVoiceLogEventsResponse> {
    return this._http.get<ListVoiceLogEventsResponse>(this._path(logId, 'events'), params);
  }
}

/** Fax log queries. */
export class FaxLogs extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List fax log entries.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of fax log entries.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<ListFaxLogsResponse> {
    return this._http.get<ListFaxLogsResponse>(this._basePath, params);
  }

  /**
   * Fetch a single fax log entry by ID.
   *
   * @param logId - Unique identifier of the log entry.
   * @returns The log entry record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(logId: string): Promise<GetFaxLogResponse> {
    return this._http.get<GetFaxLogResponse>(this._path(logId));
  }
}

/** Conference log queries. */
export class ConferenceLogs extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List conference log entries.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of conference log entries.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<ListConferencesResponse> {
    return this._http.get<ListConferencesResponse>(this._basePath, params);
  }
}

/**
 * Logs API namespace.
 *
 * Access via `client.logs.*`. Read-only access to message, voice, fax, and
 * conference logs for auditing and observability.
 */
export class LogsNamespace {
  /** SMS/MMS message log queries. */
  readonly messages: MessageLogs;
  /** Voice call log queries with event drill-down. */
  readonly voice: VoiceLogs;
  /** Fax log queries. */
  readonly fax: FaxLogs;
  /** Conference log queries. */
  readonly conferences: ConferenceLogs;

  constructor(http: HttpClient) {
    this.messages = new MessageLogs(http, '/api/messaging/logs');
    this.voice = new VoiceLogs(http, '/api/voice/logs');
    this.fax = new FaxLogs(http, '/api/fax/logs');
    this.conferences = new ConferenceLogs(http, '/api/logs/conferences');
  }
}
