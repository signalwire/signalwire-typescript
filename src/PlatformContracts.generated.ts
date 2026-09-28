// AUTO-GENERATED from porting-sdk/rest-apis/swml-webhooks/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-swml-verbs.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** The JSON body the engine POSTs to a SWML webhook to fetch the next document. */
export interface SwmlRequestData {
  call?: SwmlRequestCall;
  vars: Record<string, unknown>;
  envs?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

/** The `call` object of a SWML webhook request: one of its per-device-type variants. */
export type SwmlRequestCall =
  SwmlRequestCallPhone | SwmlRequestCallSip | SwmlRequestCallWebrtc | SwmlRequestCallOther;

/** The `call.parent` object of a SWML webhook request. */
export interface SwmlRequestCallParent {
  device_type?: string;
  call_id: string;
  node_id: string;
}

/** The `call.peer` object of a SWML webhook request. */
export interface SwmlRequestCallPeer {
  call_id: string;
  node_id: string;
}

/** The `call` object of a SWML webhook request, `phone` device variant (engine: call -> device . type == RELAY_DEVICE_PHONE). */
export interface SwmlRequestCallPhone {
  project_id?: string;
  space_id?: string;
  call_id: string;
  node_id: string;
  segment_id?: string;
  tag?: string;
  call_state: 'answered' | 'created' | 'ended' | 'ending' | 'ringing';
  parent?: SwmlRequestCallParent;
  peer?: SwmlRequestCallPeer;
  direction: 'inbound' | 'outbound';
  end_reason?:
    | 'abandoned'
    | 'busy'
    | 'cancel'
    | 'decline'
    | 'error'
    | 'hangup'
    | 'maxDuration'
    | 'noAnswer'
    | 'notFound';
  end_source?: 'inbound' | 'none' | 'outbound';
  dial_winner?: 'true';
  address_id?: string;
  subscriber_id?: string;
  subscriber_name?: string;
  type: 'phone';
  from: string;
  to: string;
  from_number: string;
  to_number: string;
  headers?: SwmlRequestCallPhoneHeadersItem[];
}

/** The `call.phone.headers.items` object of a SWML webhook request. */
export interface SwmlRequestCallPhoneHeadersItem {
  name: 'Diversion';
  value: string;
}

/** The `call` object of a SWML webhook request, `sip` device variant (engine: call -> device . type == RELAY_DEVICE_SIP). */
export interface SwmlRequestCallSip {
  project_id?: string;
  space_id?: string;
  call_id: string;
  node_id: string;
  segment_id?: string;
  tag?: string;
  call_state: 'answered' | 'created' | 'ended' | 'ending' | 'ringing';
  parent?: SwmlRequestCallParent;
  peer?: SwmlRequestCallPeer;
  direction: 'inbound' | 'outbound';
  end_reason?:
    | 'abandoned'
    | 'busy'
    | 'cancel'
    | 'decline'
    | 'error'
    | 'hangup'
    | 'maxDuration'
    | 'noAnswer'
    | 'notFound';
  end_source?: 'inbound' | 'none' | 'outbound';
  dial_winner?: 'true';
  address_id?: string;
  subscriber_id?: string;
  subscriber_name?: string;
  type: 'sip';
  from: string;
  to: string;
  headers?: SwmlRequestCallSipHeadersItem[];
  sip_data?: SwmlRequestCallSipSipData;
}

/** The `call.sip.headers.items` object of a SWML webhook request. */
export interface SwmlRequestCallSipHeadersItem {
  name: string;
  value: string;
}

/** The `call.sip.sip_data` object of a SWML webhook request. */
export interface SwmlRequestCallSipSipData {
  sip_req_user?: string;
  sip_req_uri?: string;
  sip_req_host?: string;
  sip_from_user?: string;
  sip_from_uri?: string;
  sip_from_host?: string;
  sip_to_user?: string;
  sip_to_uri?: string;
  sip_to_host?: string;
  sip_contact_user?: string;
  sip_contact_port?: string;
  sip_contact_uri?: string;
  sip_contact_host?: string;
  sip_from_params?: Record<string, string>;
  sip_to_params?: Record<string, string>;
  sip_contact_params?: Record<string, string>;
  sip_req_params?: Record<string, string>;
  sip_p_asserted_identity?: string;
}

/** The `call` object of a SWML webhook request, `webrtc` device variant (engine: call -> device . type == RELAY_DEVICE_WEBRTC). */
export interface SwmlRequestCallWebrtc {
  project_id?: string;
  space_id?: string;
  call_id: string;
  node_id: string;
  segment_id?: string;
  tag?: string;
  call_state: 'answered' | 'created' | 'ended' | 'ending' | 'ringing';
  parent?: SwmlRequestCallParent;
  peer?: SwmlRequestCallPeer;
  direction: 'inbound' | 'outbound';
  end_reason?:
    | 'abandoned'
    | 'busy'
    | 'cancel'
    | 'decline'
    | 'error'
    | 'hangup'
    | 'maxDuration'
    | 'noAnswer'
    | 'notFound';
  end_source?: 'inbound' | 'none' | 'outbound';
  dial_winner?: 'true';
  address_id?: string;
  subscriber_id?: string;
  subscriber_name?: string;
  type: 'webrtc';
  from: string;
  to: string;
}

/** The `call` object of a SWML webhook request, `other` device variant (engine: call -> device . type is one of RELAY_DEVICE_NONE, RELAY_DEVICE_TYPE_MAX). */
export interface SwmlRequestCallOther {
  project_id?: string;
  space_id?: string;
  call_id: string;
  node_id: string;
  segment_id?: string;
  tag?: string;
  call_state: 'answered' | 'created' | 'ended' | 'ending' | 'ringing';
  parent?: SwmlRequestCallParent;
  peer?: SwmlRequestCallPeer;
  direction: 'inbound' | 'outbound';
  end_reason?:
    | 'abandoned'
    | 'busy'
    | 'cancel'
    | 'decline'
    | 'error'
    | 'hangup'
    | 'maxDuration'
    | 'noAnswer'
    | 'notFound';
  end_source?: 'inbound' | 'none' | 'outbound';
  dial_winner?: 'true';
  address_id?: string;
  subscriber_id?: string;
  subscriber_name?: string;
}
