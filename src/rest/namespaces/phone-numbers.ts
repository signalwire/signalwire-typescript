/**
 * Phone Numbers namespace — list, search, purchase, get, update, release, bind.
 */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';
import { PhoneCallHandler } from '../callHandler.js';
import type {
  AvailablePhoneNumbersResponse,
  PhoneNumber,
  PhoneNumberListResponse,
  PurchasePhoneNumberRequest,
  UpdatePhoneNumberRequest,
} from './relay-rest.types.generated.js';

/**
 * Optional companion fields for {@link PhoneNumbersResource.setSwmlWebhook} —
 * any other typed `UpdatePhoneNumberRequest` field (e.g. `name`) merged into the
 * PUT body.
 */
export type SetSwmlWebhookExtra = Partial<UpdatePhoneNumberRequest>;

/** Parameters for {@link PhoneNumbersResource.setCxmlWebhook}. */
export interface SetCxmlWebhookParams extends Partial<UpdatePhoneNumberRequest> {
  /** Primary cXML document URL. Serialized as `call_request_url`. */
  url: string;
  /** Fallback URL if the primary request fails. Serialized as `call_fallback_url`. */
  fallbackUrl?: string;
  /** Status callback URL for call status updates. Serialized as `call_status_callback_url`. */
  statusCallbackUrl?: string;
}

/** Parameters for {@link PhoneNumbersResource.setCallFlow}. */
export interface SetCallFlowParams extends Partial<UpdatePhoneNumberRequest> {
  /** Call Flow resource ID. Serialized as `call_flow_id`. */
  flowId: string;
  /**
   * Optional pinned version — `"working_copy"` or `"current_deployed"`
   * (server default when omitted). Serialized as `call_flow_version`.
   */
  version?: 'working_copy' | 'current_deployed';
}

/** Parameters for {@link PhoneNumbersResource.setRelayTopic}. */
export interface SetRelayTopicParams extends Partial<UpdatePhoneNumberRequest> {
  /** RELAY topic name. Serialized as `call_relay_topic`. */
  topic: string;
  /**
   * Optional status callback URL for RELAY topic delivery updates.
   * Serialized as `call_relay_topic_status_callback_url`.
   */
  statusCallbackUrl?: string;
}

/**
 * Phone number management.
 *
 * Supports the standard CRUD surface plus typed helpers for binding an
 * inbound call to a handler (SWML webhook, cXML webhook, AI agent, call
 * flow, RELAY application/topic). The binding model is: set `call_handler`
 * + the handler-specific companion field on the phone number; the server
 * auto-materializes the matching Fabric resource. See
 * {@link PhoneCallHandler} for the enum of valid `call_handler` values.
 *
 * `create` and `update` bodies, the list/item shapes, and the `search` result
 * are typed from the canonical `relay-rest` OpenAPI spec (Purchase/Update
 * request bodies, `PhoneNumber`, `PhoneNumberListResponse`,
 * `AvailablePhoneNumbersResponse`). Both bodies stay optional (default `{}`) to
 * preserve Python's call-without-args (`**kwargs`) ergonomics; `Partial<>`
 * relaxes the spec's required fields at call time, as the platform validates
 * them server-side.
 */
export class PhoneNumbersResource extends CrudResource<
  PhoneNumberListResponse,
  PhoneNumber,
  Partial<PurchasePhoneNumberRequest>,
  Partial<UpdatePhoneNumberRequest>
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/phone_numbers');
  }

  /**
   * Purchase / create a phone number resource in this project.
   * Body is optional to match Python's `**kwargs` call convention.
   *
   * @param body - Phone-number creation payload (platform-shaped JSON).
   *   Defaults to `{}` when omitted.
   * @returns The newly-created phone-number resource.
   * @throws {RestError} On any non-2xx HTTP response.
   *
   * @example
   * ```ts
   * const num = await client.phoneNumbers.create({ number: '+15551234567' });
   * ```
   */
  override async create(body: Partial<PurchasePhoneNumberRequest> = {}): Promise<PhoneNumber> {
    return this._http.post<PhoneNumber>(this._basePath, body);
  }

  /**
   * Update a phone number resource by ID. Body is optional to match Python `**kwargs`.
   *
   * Setting `call_handler` + the matching companion field (see
   * {@link PhoneCallHandler}) on the phone number auto-materializes the
   * matching Fabric resource on the server; prefer the `set*` helpers
   * below for the common cases.
   *
   * @param resourceId - Unique phone-number resource ID.
   * @param body - Partial update payload. Defaults to `{}`.
   * @returns The updated phone-number resource.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  override async update(
    resourceId: string,
    body: Partial<UpdatePhoneNumberRequest> = {},
  ): Promise<PhoneNumber> {
    return this._http.put<PhoneNumber>(this._path(resourceId), body);
  }

  /**
   * Search available phone numbers for purchase.
   *
   * @param params - Search filters (e.g. `areaCode`, `contains`, `region`,
   *   `number_type`, pagination).
   * @returns A paginated list of matching available numbers.
   * @throws {RestError} On any non-2xx HTTP response.
   *
   * @example
   * ```ts
   * const results = await client.phoneNumbers.search({ areaCode: '512', contains: '5555' });
   * ```
   */
  async search(params?: QueryParams): Promise<AvailablePhoneNumbersResponse> {
    return this._http.get<AvailablePhoneNumbersResponse>(this._path('search'), params);
  }

  /**
   * Body shape for the binding helpers — the spec's `UpdatePhoneNumberRequest`
   * with `call_handler` made required. Every companion field
   * (`call_relay_script_url`, `call_ai_agent_id`, `call_flow_id`, …) is typed by
   * the spec, so the helpers carry no loose `Record`/`any`.
   */

  private async _bind(
    resourceId: string,
    body: Partial<UpdatePhoneNumberRequest> & {
      call_handler: NonNullable<UpdatePhoneNumberRequest['call_handler']>;
    },
  ): Promise<PhoneNumber> {
    return this._http.put<PhoneNumber>(this._path(resourceId), body);
  }

  // -- Typed binding helpers ----------------------------------------------
  //
  // Each helper is a one-line wrapper over `_bind` with the right
  // `call_handler` value and companion field already set. Pass through
  // extra fields for cases the helper doesn't name explicitly (e.g.
  // `call_fallback_url` on cXML webhooks).

  /**
   * Route inbound calls to an SWML webhook URL.
   *
   * Your backend returns an SWML document per call. The server
   * auto-creates a `swml_webhook` Fabric resource keyed off this URL —
   * you do **not** need to call `fabric.swmlWebhooks.create` or
   * `fabric.resources.assignPhoneRoute`.
   *
   * @param resourceId - Unique phone-number resource ID.
   * @param url - Your backend's SWML endpoint.
   * @param extra - Additional wire-level fields (e.g. `name`) merged into
   *   the PUT body.
   * @returns The updated phone-number resource.
   *
   * @example
   * ```ts
   * await client.phoneNumbers.setSwmlWebhook('pn-1', 'https://example.com/swml');
   * ```
   */
  async setSwmlWebhook(
    resourceId: string,
    url: string,
    extra: SetSwmlWebhookExtra = {},
  ): Promise<PhoneNumber> {
    return this._bind(resourceId, {
      call_handler: PhoneCallHandler.RELAY_SCRIPT,
      call_relay_script_url: url,
      ...extra,
    });
  }

  /**
   * Route inbound calls to a cXML (Twilio-compat / LAML) webhook.
   *
   * Despite the wire value `laml_webhooks` being plural, this creates a
   * single `cxml_webhook` Fabric resource.  `fallbackUrl` is used when the
   * primary URL fails; `statusCallbackUrl` receives call status updates.
   *
   * @param resourceId - Unique phone-number resource ID.
   * @param params - URL and optional fallback/status URLs plus any extra
   *   wire-level fields.
   * @returns The updated phone-number resource.
   *
   * @example
   * ```ts
   * await client.phoneNumbers.setCxmlWebhook('pn-1', {
   *   url: 'https://example.com/voice.xml',
   *   fallbackUrl: 'https://example.com/fallback.xml',
   * });
   * ```
   */
  async setCxmlWebhook(resourceId: string, params: SetCxmlWebhookParams): Promise<PhoneNumber> {
    const { url, fallbackUrl, statusCallbackUrl, ...extra } = params;
    const body: Partial<UpdatePhoneNumberRequest> & {
      call_handler: NonNullable<UpdatePhoneNumberRequest['call_handler']>;
    } = {
      call_handler: PhoneCallHandler.LAML_WEBHOOKS,
      call_request_url: url,
      ...extra,
    };
    if (fallbackUrl !== undefined) {
      body['call_fallback_url'] = fallbackUrl;
    }
    if (statusCallbackUrl !== undefined) {
      body['call_status_callback_url'] = statusCallbackUrl;
    }
    return this._bind(resourceId, body);
  }

  /**
   * Route inbound calls to an existing cXML application by ID.
   *
   * @param resourceId - Unique phone-number resource ID.
   * @param applicationId - cXML application ID.
   * @param extra - Additional wire-level fields merged into the body.
   * @returns The updated phone-number resource.
   */
  async setCxmlApplication(
    resourceId: string,
    applicationId: string,
    extra: Partial<UpdatePhoneNumberRequest> = {},
  ): Promise<PhoneNumber> {
    return this._bind(resourceId, {
      call_handler: PhoneCallHandler.LAML_APPLICATION,
      call_laml_application_id: applicationId,
      ...extra,
    });
  }

  /**
   * Route inbound calls to an AI Agent Fabric resource by ID.
   *
   * @param resourceId - Unique phone-number resource ID.
   * @param agentId - AI agent Fabric resource ID.
   * @param extra - Additional wire-level fields merged into the body.
   * @returns The updated phone-number resource.
   */
  async setAiAgent(
    resourceId: string,
    agentId: string,
    extra: Partial<UpdatePhoneNumberRequest> = {},
  ): Promise<PhoneNumber> {
    return this._bind(resourceId, {
      call_handler: PhoneCallHandler.AI_AGENT,
      call_ai_agent_id: agentId,
      ...extra,
    });
  }

  /**
   * Route inbound calls to a Call Flow by ID.
   *
   * `version` accepts `"working_copy"` or `"current_deployed"` (server
   * default when omitted).
   *
   * @param resourceId - Unique phone-number resource ID.
   * @param params - Flow ID and optional pinned version plus any extra
   *   wire-level fields.
   * @returns The updated phone-number resource.
   */
  async setCallFlow(resourceId: string, params: SetCallFlowParams): Promise<PhoneNumber> {
    const { flowId, version, ...extra } = params;
    const body: Partial<UpdatePhoneNumberRequest> & {
      call_handler: NonNullable<UpdatePhoneNumberRequest['call_handler']>;
    } = {
      call_handler: PhoneCallHandler.CALL_FLOW,
      call_flow_id: flowId,
      ...extra,
    };
    if (version !== undefined) {
      body['call_flow_version'] = version;
    }
    return this._bind(resourceId, body);
  }

  /**
   * Route inbound calls to a named RELAY application.
   *
   * @param resourceId - Unique phone-number resource ID.
   * @param name - RELAY application name.
   * @param extra - Additional wire-level fields merged into the body.
   * @returns The updated phone-number resource.
   */
  async setRelayApplication(
    resourceId: string,
    name: string,
    extra: Partial<UpdatePhoneNumberRequest> = {},
  ): Promise<PhoneNumber> {
    return this._bind(resourceId, {
      call_handler: PhoneCallHandler.RELAY_APPLICATION,
      call_relay_application: name,
      ...extra,
    });
  }

  /**
   * Route inbound calls to a RELAY topic (client subscription).
   *
   * @param resourceId - Unique phone-number resource ID.
   * @param params - Topic name and optional status-callback URL plus any
   *   extra wire-level fields.
   * @returns The updated phone-number resource.
   */
  async setRelayTopic(resourceId: string, params: SetRelayTopicParams): Promise<PhoneNumber> {
    const { topic, statusCallbackUrl, ...extra } = params;
    const body: Partial<UpdatePhoneNumberRequest> & {
      call_handler: NonNullable<UpdatePhoneNumberRequest['call_handler']>;
    } = {
      call_handler: PhoneCallHandler.RELAY_TOPIC,
      call_relay_topic: topic,
      ...extra,
    };
    if (statusCallbackUrl !== undefined) {
      body['call_relay_topic_status_callback_url'] = statusCallbackUrl;
    }
    return this._bind(resourceId, body);
  }
}
