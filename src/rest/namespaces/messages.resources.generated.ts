// AUTO-GENERATED from porting-sdk/rest-apis/messages/openapi.enriched.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { RequestOptionsInit } from '../RequestOptions.js';
import { BaseResource } from '../base/BaseResource.js';
import type { Message } from './messages.types.generated.js';

export class Messages extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/messaging/messages');
  }

  async create(
    to: string,
    from: string,
    options?: {
      body?:
        | string
        | {
            /** Media ID (image, audio, document, video, sticker). Exactly one of `id` or `link` is required. */
            id?: string;
            /** HTTP(S) media URL (image, audio, document, video, sticker). Exactly one of `id` or `link` is required. */
            link?: string;
            /** Media caption. Allowed for image, document and video; rejected for audio and sticker. */
            caption?: string;
            /** Document filename (document messages). */
            filename?: string;
            /** Latitude, -90 to 90 (location messages). */
            latitude?: number | string;
            /** Longitude, -180 to 180 (location messages). */
            longitude?: number | string;
            /** Location name (location messages, required). */
            name?: string;
            /** Location address (location messages, required). */
            address?: string;
            /** ID of the message being reacted to (reaction messages, required). */
            message_id?: string;
            /** Reaction emoji (reaction messages, required). */
            emoji?: string;
            /** Interactive message type (interactive messages, required). */
            type?: string;
            /** Interactive message action (interactive messages, required). */
            action?: Record<string, unknown>;
            /** Interactive message body (interactive messages). */
            body?: Record<string, unknown>;
            /** Interactive message header (interactive messages). */
            header?: Record<string, unknown>;
            /** Interactive message footer (interactive messages). */
            footer?: Record<string, unknown>;
          }
        | {
            name: {
              formatted_name: string;
            };
          }[];
      media?: string[];
      send_as_mms?: boolean;
      status_callback?: string;
      custom_variables?: Record<string, string>;
      message_type?:
        | 'whatsapp_media_text'
        | 'whatsapp_media_contacts'
        | 'whatsapp_media_audio'
        | 'whatsapp_media_document'
        | 'whatsapp_media_image'
        | 'whatsapp_media_sticker'
        | 'whatsapp_media_video'
        | 'whatsapp_media_reaction'
        | 'whatsapp_media_location'
        | 'whatsapp_interactive_cta'
        | 'whatsapp_interactive_flow'
        | 'whatsapp_interactive_list'
        | 'whatsapp_interactive_location_request_message'
        | 'whatsapp_interactive_reply_button';
      template_id?: string;
      header_template_parameters?: Record<string, unknown> | unknown[] | string;
      body_template_parameters?: Record<string, unknown> | unknown[];
      button_template_parameters?: string[];
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<Message> {
    const body_: Record<string, unknown> = {};
    const _fields = {
      to,
      from,
      body: options?.body,
      media: options?.media,
      send_as_mms: options?.send_as_mms,
      status_callback: options?.status_callback,
      custom_variables: options?.custom_variables,
      message_type: options?.message_type,
      template_id: options?.template_id,
      header_template_parameters: options?.header_template_parameters,
      body_template_parameters: options?.body_template_parameters,
      button_template_parameters: options?.button_template_parameters,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body_[k] = v;
    if (options?.extras) Object.assign(body_, options.extras);
    return this._http.post<Message>(this._basePath, body_, undefined, requestOptions);
  }

  async update(
    message_id: string,
    body?: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<Message> {
    const body_: Record<string, unknown> = {};
    const _fields = {
      body,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body_[k] = v;
    if (options?.extras) Object.assign(body_, options.extras);
    return this._http.patch<Message>(this._path(message_id), body_, requestOptions);
  }
}
