// AUTO-GENERATED from porting-sdk/rest-apis/relay-rest/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** Request body for adding a phone number to a number group. */
export interface AddNumberGroupMembershipRequest {
  /** The phone number ID to add to the group. */
  phone_number_id: uuid;
}

/** Address model representing a physical address for regulatory compliance. */
export interface Address {
  /** The unique identifier of the Address on SignalWire. */
  id: uuid;
  /** A friendly name given to the address to help distinguish and search for different addresses within your project. */
  label: string;
  /** The ISO 3166 Alpha 2 country code. */
  country: string;
  /** First name of the occupant associated with this address. */
  first_name: string;
  /** Last name of the occupant associated with this address. */
  last_name: string;
  /** The number portion of the street address. */
  street_number: string;
  /** The name portion of the street address. */
  street_name: string;
  /** If the address is divided into multiple sub-addresses, this identifies how the address is divided. */
  address_type: AddressType | null;
  /** If the address is divided into multiple sub-addresses, this identifies the particular sub-address. */
  address_number: string | null;
  /** The city portion of the street address. */
  city: string;
  /** The state/province/region of the street address. In the USA and Canada, use the two-letter abbreviated form. */
  state: string;
  /** The postal code of the street address. */
  postal_code: string;
  /** The postal code of the street address. Alias for postal_code for backwards compatibility. */
  zip_code: string;
}

/** Response containing a list of addresses. */
export interface AddressListResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of addresses. */
  data: Address[];
}

/** Response containing a single address. */
export interface AddressResponse {
  /** The unique identifier of the Address on SignalWire. */
  id: uuid;
  /** A friendly name given to the address to help distinguish and search for different addresses within your project. */
  label: string;
  /** The ISO 3166 Alpha 2 country code. */
  country: string;
  /** First name of the occupant associated with this address. */
  first_name: string;
  /** Last name of the occupant associated with this address. */
  last_name: string;
  /** The number portion of the street address. */
  street_number: string;
  /** The name portion of the street address. */
  street_name: string;
  /** If the address is divided into multiple sub-addresses, this identifies how the address is divided. */
  address_type: AddressType | null;
  /** If the address is divided into multiple sub-addresses, this identifies the particular sub-address. */
  address_number: string | null;
  /** The city portion of the street address. */
  city: string;
  /** The state/province/region of the street address. In the USA and Canada, use the two-letter abbreviated form. */
  state: string;
  /** The postal code of the street address. */
  postal_code: string;
  /** The postal code of the street address. Alias for postal_code for backwards compatibility. */
  zip_code: string;
}

/** Address type for sub-addresses. */
export type AddressType =
  | 'Apartment'
  | 'Basement'
  | 'Building'
  | 'Department'
  | 'Floor'
  | 'Office'
  | 'Penthouse'
  | 'Suite'
  | 'Trailer'
  | 'Unit';

/** Assigned number model for campaign registration. */
export interface AssignedNumber {
  /** The unique identifier of the assignment. */
  id: uuid;
  /** The current state of the assignment. */
  state?: string;
  /** The campaign ID associated with the number. */
  campaign_id?: uuid;
  /** The phone number details. */
  phone_number?: AssignedPhoneNumber;
  /** Timestamp when the assignment was created. */
  created_at?: string;
  /** Timestamp when the assignment was last updated. */
  updated_at?: string;
}

/** Response containing a list of assigned numbers. */
export interface AssignedNumberListResponse {
  /** Pagination links. */
  links?: PaginationLinks;
  /** List of assigned numbers. */
  data?: AssignedNumber[];
}

/** Phone number details in an assignment. */
export interface AssignedPhoneNumber {
  /** The unique identifier of the phone number. */
  id?: uuid;
  /** The name of the phone number. */
  name?: string;
  /** The phone number in E.164 format. */
  number?: string;
  /** Optional: Specify a URL to receive webhook notifications. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
}

/** Available phone number for purchase. */
export interface AvailablePhoneNumber {
  /** The phone number in E.164 format. */
  number: string;
  /** The region of the phone number. */
  region?: string;
  /** The city of the phone number. */
  city?: string;
  /** The rate center of the phone number. */
  rate_center?: string;
  /** The LATA of the phone number. */
  lata?: string;
  /** The capabilities of the phone number. */
  capabilities?: PhoneNumberCapabilities;
}

/** Response containing available phone numbers for purchase. */
export interface AvailablePhoneNumbersResponse {
  /** Pagination links. */
  links?: PaginationLinks;
  /** List of available phone numbers. */
  data?: AvailablePhoneNumber[];
}

/** Brand model for 10DLC registration. */
export interface Brand {
  /** The unique identifier of the brand. */
  id: uuid;
  /** The current state of the brand. */
  state?: string;
  /** Brand/Marketing/DBA name of the business if applicable. */
  name?: string;
  /** The legal name of the business. */
  company_name?: string;
  /** A company contact email for this brand. */
  contact_email?: string;
  /** A contact phone number for this brand. */
  contact_phone?: string;
  /** Country of registration. */
  ein_issuing_country?: string;
  /** What type of legal entity is the organization? (PRIVATE_PROFIT, PUBLIC_PROFIT, NON_PROFIT) */
  legal_entity_type?: string;
  /** Company EIN Number/Tax ID. */
  ein?: string;
  /** Full company address. */
  company_address?: string;
  /** An optional Vertical for the brand (REAL_ESTATE, HEALTHCARE, ENERGY, ENTERTAINMENT, RETAIL, AGRICULTURE, INSURANCE, EDUCATION, HOSPITALITY, FINANCIAL, GAMBLING, CONSTRUCTION, NGO, MANUFACTURING, GOVERNMENT, TECHNOLOGY, COMMUNICATION). */
  company_vertical?: string;
  /** Link to the company website. */
  company_website?: string;
  /** If you are your own Campaign Service Provider, this is the approved Brand ID (Mandatory for CSPs, otherwise please omit). */
  csp_brand_reference?: string;
  /** This value must be true for all self-registered brands. */
  csp_self_registered?: boolean;
  /** Optional: Specify a URL to receive webhook notifications when your brand's state changes. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
  /** Timestamp when the brand was created. */
  created_at?: string;
  /** Timestamp when the brand was last updated. */
  updated_at?: string;
}

/** Response containing a list of brands. */
export interface BrandListResponse {
  /** Pagination links. */
  links?: PaginationLinks;
  /** List of brands. */
  data?: Brand[];
}

/** Response containing a single brand. */
export interface BrandResponse {
  /** The unique identifier of the brand. */
  id: uuid;
  /** The current state of the brand. */
  state?: string;
  /** Brand/Marketing/DBA name of the business if applicable. */
  name?: string;
  /** The legal name of the business. */
  company_name?: string;
  /** A company contact email for this brand. */
  contact_email?: string;
  /** A contact phone number for this brand. */
  contact_phone?: string;
  /** Country of registration. */
  ein_issuing_country?: string;
  /** What type of legal entity is the organization? (PRIVATE_PROFIT, PUBLIC_PROFIT, NON_PROFIT) */
  legal_entity_type?: string;
  /** Company EIN Number/Tax ID. */
  ein?: string;
  /** Full company address. */
  company_address?: string;
  /** An optional Vertical for the brand (REAL_ESTATE, HEALTHCARE, ENERGY, ENTERTAINMENT, RETAIL, AGRICULTURE, INSURANCE, EDUCATION, HOSPITALITY, FINANCIAL, GAMBLING, CONSTRUCTION, NGO, MANUFACTURING, GOVERNMENT, TECHNOLOGY, COMMUNICATION). */
  company_vertical?: string;
  /** Link to the company website. */
  company_website?: string;
  /** If you are your own Campaign Service Provider, this is the approved Brand ID (Mandatory for CSPs, otherwise please omit). */
  csp_brand_reference?: string;
  /** This value must be true for all self-registered brands. */
  csp_self_registered?: boolean;
  /** Optional: Specify a URL to receive webhook notifications when your brand's state changes. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
  /** Timestamp when the brand was created. */
  created_at?: string;
  /** Timestamp when the brand was last updated. */
  updated_at?: string;
}

/** Call receive mode. */
export type CallReceiveMode = 'voice' | 'fax';

/** Campaign model for 10DLC registration. */
export interface Campaign {
  /** The unique identifier of the campaign. */
  id: uuid;
  /** A name for the campaign. */
  name?: string;
  /** The current state of the campaign. */
  state?: string;
  /** An SMS Use Case category for the campaign (2FA, ACCOUNT_NOTIFICATION, AGENTS_FRANCHISES, CARRIER_EXEMPT, CHARITY, CUSTOMER_CARE, DELIVERY_NOTIFICATION, EMERGENCY, FRAUD_ALERT, HIGHER_EDUCATION, K12_EDUCATION, LOW_VOLUME_MIXED, MARKETING, MIXED, POLITICAL, POLITICAL_SECTION_527, POLLING_VOTING, PROXY, PUBLIC_SERVICE_ANNOUNCEMENT, SECURITY_ALERT, SOCIAL, SWEEPSTAKE, TRIAL, UCAAS_HIGH_VOLUME, UCAAS_LOW_VOLUME). */
  sms_use_case?: string;
  /** A sub use case category for MIXED or LOW_VOLUME_MIXED campaigns (CUSTOMER_CARE, HIGHER_EDUCATION, POLLING_VOTING, PUBLIC_SERVICE_ANNOUNCEMENT, MARKETING, SECURITY_ALERT, 2FA, ACCOUNT_NOTIFICATION, DELIVERY_NOTIFICATION, FRAUD_ALERT). */
  sub_use_cases?: string[];
  /** Campaign Verify token. Required if sms use case is POLITICAL_SECTION_527. */
  campaign_verify_token?: string;
  /** A description for the campaign. Please use at least 40 characters. */
  description?: string;
  /** Sample message template/content. At least two samples are required and up to five can be provided. Please use at least 20 characters. */
  sample1?: string;
  /** Sample 2. */
  sample2?: string;
  /** Sample 3. */
  sample3?: string;
  /** Sample 4. */
  sample4?: string;
  /** Sample 5. */
  sample5?: string;
  /** If your messaging content will be modified in any way beyond what you shared in your templates, please describe the nature of how the content will change. */
  dynamic_templates?: string;
  /** Please describe the call to action/message flow your intended recipients will experience. */
  message_flow?: string;
  /** Please share the message subscribers receive when they opt in. */
  opt_in_message?: string;
  /** Please share the message subscribers receive when they opt out. */
  opt_out_message?: string;
  /** Please share the message subscribers receive when they request help. */
  help_message?: string;
  /** Opt in keywords that subscribers can use. */
  opt_in_keywords?: string;
  /** Opt out keywords that subscribers can use. */
  opt_out_keywords?: string;
  /** Help keywords that subscribers can use. */
  help_keywords?: string;
  /** Will 50 or more numbers be used with this single campaign? If so, please enter true. */
  number_pooling_required?: boolean;
  /** If you will be using number pooling, please provide an explanation as to why it is needed. */
  number_pooling_per_campaign?: string;
  /** Will this campaign include content related to direct lending or other loan agreements? */
  direct_lending?: boolean;
  /** Will you be using an embedded link of any kind? Note that public URL shorteners (bitly, tinyurl) will not be accepted. */
  embedded_link?: boolean;
  /** Are you using an embedded phone number (except the required HELP information contact phone number)? */
  embedded_phone?: boolean;
  /** Will this campaign include any age gated content as defined by carrier and CTA guidelines? */
  age_gated_content?: boolean;
  /** Is there any intent of this campaign to generate leads? */
  lead_generation?: boolean;
  /** If you are your own Campaign Service Provider, what is the approved Campaign ID? (Mandatory for CSPs, otherwise please omit) */
  csp_campaign_reference?: string;
  /** Optional: Specify a URL to receive webhook notifications when your campaign's state changes. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
  /** Timestamp when the campaign was created. */
  created_at?: string;
  /** Timestamp when the campaign was last updated. */
  updated_at?: string;
}

/** Response containing a list of campaigns. */
export interface CampaignListResponse {
  /** Pagination links. */
  links?: PaginationLinks;
  /** List of campaigns. */
  data?: Campaign[];
}

/** Response containing a single campaign. */
export interface CampaignResponse {
  /** The unique identifier of the campaign. */
  id: uuid;
  /** A name for the campaign. */
  name?: string;
  /** The current state of the campaign. */
  state?: string;
  /** An SMS Use Case category for the campaign (2FA, ACCOUNT_NOTIFICATION, AGENTS_FRANCHISES, CARRIER_EXEMPT, CHARITY, CUSTOMER_CARE, DELIVERY_NOTIFICATION, EMERGENCY, FRAUD_ALERT, HIGHER_EDUCATION, K12_EDUCATION, LOW_VOLUME_MIXED, MARKETING, MIXED, POLITICAL, POLITICAL_SECTION_527, POLLING_VOTING, PROXY, PUBLIC_SERVICE_ANNOUNCEMENT, SECURITY_ALERT, SOCIAL, SWEEPSTAKE, TRIAL, UCAAS_HIGH_VOLUME, UCAAS_LOW_VOLUME). */
  sms_use_case?: string;
  /** A sub use case category for MIXED or LOW_VOLUME_MIXED campaigns (CUSTOMER_CARE, HIGHER_EDUCATION, POLLING_VOTING, PUBLIC_SERVICE_ANNOUNCEMENT, MARKETING, SECURITY_ALERT, 2FA, ACCOUNT_NOTIFICATION, DELIVERY_NOTIFICATION, FRAUD_ALERT). */
  sub_use_cases?: string[];
  /** Campaign Verify token. Required if sms use case is POLITICAL_SECTION_527. */
  campaign_verify_token?: string;
  /** A description for the campaign. Please use at least 40 characters. */
  description?: string;
  /** Sample message template/content. At least two samples are required and up to five can be provided. Please use at least 20 characters. */
  sample1?: string;
  /** Sample 2. */
  sample2?: string;
  /** Sample 3. */
  sample3?: string;
  /** Sample 4. */
  sample4?: string;
  /** Sample 5. */
  sample5?: string;
  /** If your messaging content will be modified in any way beyond what you shared in your templates, please describe the nature of how the content will change. */
  dynamic_templates?: string;
  /** Please describe the call to action/message flow your intended recipients will experience. */
  message_flow?: string;
  /** Please share the message subscribers receive when they opt in. */
  opt_in_message?: string;
  /** Please share the message subscribers receive when they opt out. */
  opt_out_message?: string;
  /** Please share the message subscribers receive when they request help. */
  help_message?: string;
  /** Opt in keywords that subscribers can use. */
  opt_in_keywords?: string;
  /** Opt out keywords that subscribers can use. */
  opt_out_keywords?: string;
  /** Help keywords that subscribers can use. */
  help_keywords?: string;
  /** Will 50 or more numbers be used with this single campaign? If so, please enter true. */
  number_pooling_required?: boolean;
  /** If you will be using number pooling, please provide an explanation as to why it is needed. */
  number_pooling_per_campaign?: string;
  /** Will this campaign include content related to direct lending or other loan agreements? */
  direct_lending?: boolean;
  /** Will you be using an embedded link of any kind? Note that public URL shorteners (bitly, tinyurl) will not be accepted. */
  embedded_link?: boolean;
  /** Are you using an embedded phone number (except the required HELP information contact phone number)? */
  embedded_phone?: boolean;
  /** Will this campaign include any age gated content as defined by carrier and CTA guidelines? */
  age_gated_content?: boolean;
  /** Is there any intent of this campaign to generate leads? */
  lead_generation?: boolean;
  /** If you are your own Campaign Service Provider, what is the approved Campaign ID? (Mandatory for CSPs, otherwise please omit) */
  csp_campaign_reference?: string;
  /** Optional: Specify a URL to receive webhook notifications when your campaign's state changes. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
  /** Timestamp when the campaign was created. */
  created_at?: string;
  /** Timestamp when the campaign was last updated. */
  updated_at?: string;
}

/** Carrier lookup information. */
export interface CarrierLookupInfo {
  /** The LRN associated with the number. */
  lrn?: string;
  /** The Service Profile Identifier associated with the number. */
  spid?: string;
  /** The Operating Company Number associated with the number. */
  ocn?: string;
  /** The Local Access and Transport Area number associated with the number. */
  lata?: string;
  /** The City associated with the number. */
  city?: string;
  /** The State/Province/Region associated with the number. */
  state?: string;
  /** The Jurisdiction associated with the number. */
  jurisdiction?: string;
  /** The LEC or Carrier of the number. */
  lec?: string;
  /** The type of line the number is. Generally either wireless or landline. */
  linetype?: string;
}

/** Caller ID (CNAM) information. */
export interface CnamInfo {
  /** The caller ID associated with the number. */
  caller_id?: string;
}

/** Company vertical/industry classification. */
export type CompanyVertical =
  | 'AGRICULTURE'
  | 'COMMUNICATION'
  | 'CONSTRUCTION'
  | 'EDUCATION'
  | 'ENERGY'
  | 'ENTERTAINMENT'
  | 'FINANCIAL'
  | 'GAMBLING'
  | 'GOVERNMENT'
  | 'HEALTHCARE'
  | 'HOSPITALITY'
  | 'HUMAN_RESOURCES'
  | 'INSURANCE'
  | 'LEGAL'
  | 'MANUFACTURING'
  | 'NGO'
  | 'POLITICAL'
  | 'POSTAL'
  | 'PROFESSIONAL'
  | 'REAL_ESTATE'
  | 'RETAIL'
  | 'TECHNOLOGY'
  | 'TRANSPORTATION';

/** Request body for creating an address. */
export interface CreateAddressRequest {
  /** A friendly name given to the address to help distinguish and search for different addresses within your project. */
  label: string;
  /** The ISO 3166 Alpha 2 country code. */
  country: string;
  /** First name of the occupant associated with this address. */
  first_name: string;
  /** Last name of the occupant associated with this address. */
  last_name: string;
  /** The number portion of the street address. */
  street_number: string;
  /** The name portion of the street address. */
  street_name: string;
  /** If the address is divided into multiple sub-addresses, this identifies how the address is divided. Possible values are: Apartment, Basement, Building, Department, Floor, Office, Penthouse, Suite, Trailer, Unit. */
  address_type?: AddressType;
  /** If the address is divided into multiple sub-addresses, this identifies the particular sub-address. */
  address_number?: string;
  /** The city portion of the street address. */
  city: string;
  /** The state/province/region of the street address. In the USA and Canada, use the two-letter abbreviated form. */
  state: string;
  /** The postal code of the street address. */
  postal_code: string;
}

/** Request body for importing a self-registered CSP brand. Use this when you have already registered your brand directly with TCR. */
export interface CreateCspBrandRequest {
  /** Set to true to indicate this is a self-registered CSP brand. */
  csp_self_registered: true;
  /** Brand/Marketing/DBA name of the business. */
  name: string;
  /** The approved Brand ID from TCR. Required for CSP/self-registered brands. */
  csp_brand_reference: string;
  /** Specify a URL to receive webhook notifications when your brand's state changes. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
}

/** Request body for creating a domain application. */
export interface CreateDomainApplicationRequest {
  /** A string representing the friendly name for this domain application. */
  name: string;
  /** A string representing the identifier portion of the domain application. */
  identifier: string;
  /** The user portion of the domain application. */
  user?: string;
  /** Whether the domain application will enforce IP authentication for incoming requests. */
  ip_auth_enabled?: boolean;
  /** A list containing whitelisted IP addresses and IP blocks used if ip_auth_enabled is true. */
  ip_auth?: string[];
  /** Whether connections to this domain application require encryption or if encryption is optional. */
  encryption?: 'optional' | 'required' | 'forbidden';
  /** A list of codecs this domain application will support. */
  codecs?: string[];
  /** A list of encryption ciphers this domain application will support. */
  ciphers?: string[];
  /** Specify how the domain application will handle calls. */
  call_handler?: DomainAppCallHandlerRequest;
  /** A string representing the Relay topic to forward incoming calls to. Required when call_handler is relay_topic. */
  call_relay_topic?: string;
  /** A string representing a URL to send status change messages to. */
  call_relay_topic_status_callback_url?: string;
  /** A string representing the Relay Application to forward incoming calls to. Required when call_handler is relay_application. */
  call_relay_application?: string;
  /** A string representing the LaML URL to access when a call is received. Required when call_handler is laml_webhooks. */
  call_request_url?: string;
  /** A string representing the HTTP method to use with call_request_url. */
  call_request_method?: 'GET' | 'POST';
  /** A string representing the LaML URL to access when the call to call_request_url fails. */
  call_fallback_url?: string;
  /** A string representing the HTTP method to use with call_fallback_url. */
  call_fallback_method?: 'GET' | 'POST';
  /** A string representing a URL to send status change messages to. */
  call_status_callback_url?: string;
  /** A string representing the HTTP method to use with call_status_callback_url. */
  call_status_callback_method?: 'GET' | 'POST';
  /** A string representing the ID of the LaML application to forward incoming calls to. Required when call_handler is laml_application. */
  call_laml_application_id?: string;
  /** A string representing the ID of the Video Room to forward incoming calls to. Required when call_handler is video_room. */
  call_video_room_id?: uuid;
  /** A string representing the URL of the Relay script to execute when a call is received. Required when call_handler is relay_script. */
  call_relay_script_url?: string;
  /** A string representing the ID of the Dialogflow Agent to forward incoming calls to. Required when call_handler is dialogflow. */
  call_dialogflow_agent_id?: uuid;
  /** A string representing the ID of the AI Agent to forward incoming calls to. Required when call_handler is ai_agent. */
  call_ai_agent_id?: uuid;
  /** A string representing the ID of the Call Flow to forward incoming calls to. Required when call_handler is call_flow. */
  call_flow_id?: uuid;
  /** A string representing the version of your Call Flow you'd like to use. */
  call_flow_version?: 'working_copy' | 'current_deployed';
  /** This handler type is deprecated. Please use call_relay_application or call_relay_topic instead. */
  call_relay_context?: string;
  /** This property is deprecated. Please use call_relay_topic_status_callback_url instead. */
  call_relay_context_status_callback_url?: string;
}

/** Request body for registering a new managed brand for 10DLC registration. */
export interface CreateManagedBrandRequest {
  /** Brand/Marketing/DBA name of the business. */
  name: string;
  /** The legal name of the business. */
  company_name: string;
  /** A company contact email for this brand. */
  contact_email: string;
  /** A contact phone number for this brand. */
  contact_phone: string;
  /** Country of registration. */
  ein_issuing_country: string;
  /** What type of legal entity is the organization? */
  legal_entity_type: LegalEntityType;
  /** Company EIN Number/Tax ID. */
  ein: string;
  /** Full company address. */
  company_address: string;
  /** An optional Vertical for the brand. */
  company_vertical?: CompanyVertical;
  /** Link to the company website. */
  company_website: string;
  /** Specify a URL to receive webhook notifications when your brand's state changes. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
}

/** Request body for creating a managed campaign. Used when the brand is a managed (non-CSP) brand. */
export interface CreateManagedCampaignRequest {
  /** A name for the campaign. */
  name: string;
  /** The ID of the brand to associate with this campaign. */
  brand_id: uuid;
  /** An SMS Use Case category for the campaign. */
  sms_use_case: string;
  /** A sub use case category. Required for MIXED (2-5 sub use cases) or LOW_VOLUME_MIXED (1-5 sub use cases) campaigns. Must not be provided for other use cases. */
  sub_use_cases?: string[];
  /** Campaign Verify token. Required if sms_use_case is POLITICAL_SECTION_527. */
  campaign_verify_token?: string;
  /** A description for the campaign. */
  description: string;
  /** Sample message template/content. */
  sample1: string;
  /** Second sample message template/content. */
  sample2: string;
  /** Third sample message template/content. */
  sample3?: string;
  /** Fourth sample message template/content. */
  sample4?: string;
  /** Fifth sample message template/content. */
  sample5?: string;
  /** If your messaging content will be modified in any way beyond what you shared in your templates, please describe the nature of how the content will change. */
  dynamic_messages?: string;
  /** Please describe the call to action/message flow your intended recipients will experience. */
  message_flow: string;
  /** Please share the message subscribers receive when they opt in. */
  opt_in_message?: string;
  /** Please share the message subscribers receive when they opt out. */
  opt_out_message: string;
  /** Please share the message subscribers receive when they request help. */
  help_message: string;
  /** Opt in keywords that subscribers can use. Must be comma-separated values with no spaces between keywords. */
  opt_in_keywords?: string;
  /** Opt out keywords that subscribers can use. Must be comma-separated values with no spaces between keywords. */
  opt_out_keywords?: string;
  /** Help keywords that subscribers can use. Must be comma-separated values with no spaces between keywords. */
  help_keywords?: string;
  /** Will 50 or more numbers be used with this single campaign? */
  number_pooling_required: boolean;
  /** If you will be using number pooling, please provide an explanation as to why it is needed. Required if number_pooling_required is true. */
  number_pooling_per_campaign?: string;
  /** Will this campaign include content related to direct lending or other loan agreements? */
  direct_lending: boolean;
  /** Will you be using an embedded link of any kind? Note that public URL shorteners (bitly, tinyurl) will not be accepted. */
  embedded_link: boolean;
  /** Are you using an embedded phone number (except the required HELP information contact phone number)? */
  embedded_phone: boolean;
  /** Will this campaign include any age gated content as defined by carrier and CTA guidelines? */
  age_gated_content: boolean;
  /** Is there any intent of this campaign to generate leads? */
  lead_generation: boolean;
  /** I agree to the terms and conditions which do not allow me to use this campaign for affiliate marketing. */
  terms_and_conditions: boolean;
  /** Specify a URL to receive webhook notifications when your campaign's state changes. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
}

/** Request body for creating a number group. */
export interface CreateNumberGroupRequest {
  /** The name given to the number group. Helps to distinguish different groups within your project. */
  name: string;
  /** Whether the number group uses the same 'From' number for outbound requests to a number, or chooses a random one. */
  sticky_sender?: boolean;
}

/** Request body for creating an order. */
export interface CreateOrderRequest {
  /** A list of phone numbers in E164 format. */
  phone_numbers?: string[];
  /** Optional: Specify a URL to receive webhook notifications when your number assignment order and the number assignments that belong to it change state. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
}

/** Request body for creating a partner/CSP campaign. Used when the brand is a CSP (self-registered) brand. */
export interface CreatePartnerCampaignRequest {
  /** A name for the campaign. */
  name: string;
  /** The ID of the brand to associate with this campaign. Must be a CSP/partner brand. */
  brand_id: uuid;
  /** The approved Campaign ID from TCR. Required for CSP/self-registered campaigns. */
  csp_campaign_reference: string;
  /** Specify a URL to receive webhook notifications when your campaign's state changes. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
}

/** Request body for creating a queue. */
export interface CreateQueueRequest {
  /** The name of the queue. */
  name?: string;
  /** The maximum number of callers allowed in the queue. */
  max_size?: number;
}

/** Request body for creating a SIP endpoint. */
export interface CreateSipEndpointRequest {
  /** String representing the username portion of the endpoint. Must be unique across your project and must not contain white space characters or @. */
  username: string;
  /** A password to authenticate registrations to this endpoint. */
  password: string;
  /** Friendly Caller ID used as the CNAM when dialing a phone number or the From when dialing another SIP Endpoint. */
  caller_id?: string;
  /** When dialing a PSTN phone number, you must send it From a number you have purchased or verified. send_as indicates which number this endpoint has set as its origination. random indicates it will randomly choose a purchased or verified number from within the project. */
  send_as?: string;
  /** A list of encryption ciphers this endpoint will support. */
  ciphers?: string[];
  /** A list of codecs this endpoint will support. */
  codecs?: string[];
  /** Specifies the encryption requirements for connections to this endpoint. */
  encryption?: 'default' | 'required' | 'optional';
  /** What type of handler you want to run on inbound calls. */
  call_handler?:
    | 'relay_context'
    | 'relay_topic'
    | 'relay_application'
    | 'relay_connector'
    | 'relay_script'
    | 'laml_webhooks'
    | 'laml_application'
    | 'dialogflow'
    | 'video_room'
    | 'call_flow'
    | 'ai_agent';
  /** The LaML URL to access when a call is received. Required when call_handler is laml_webhooks. */
  call_request_url?: string;
  /** The HTTP method to use with call_request_url. */
  call_request_method?: 'GET' | 'POST';
  /** The LaML URL to access when the call to call_request_url fails. Required when call_handler is laml_webhooks. */
  call_fallback_url?: string;
  /** The HTTP method to use with call_fallback_url. */
  call_fallback_method?: 'GET' | 'POST';
  /** A URL to send status change messages to. Required when call_handler is laml_webhooks. */
  call_status_callback_url?: string;
  /** The HTTP method to use with call_status_callback_url. */
  call_status_callback_method?: 'GET' | 'POST';
  /** The ID of the LaML application to forward incoming calls to. Required when call_handler is laml_application. */
  call_laml_application_id?: string;
  /** The ID of the Dialogflow agent to forward incoming calls to. Required when call_handler is dialogflow. */
  call_dialogflow_agent_id?: string;
  /** The Relay topic to forward incoming calls to. Required when call_handler is relay_topic. */
  call_relay_topic?: string;
  /** A URL to send status change messages to. Required when call_handler is relay_topic. */
  call_relay_topic_status_callback_url?: string;
  /** The Relay context to forward incoming calls to. Required when call_handler is relay_context. */
  call_relay_context?: string;
  /** A URL to send status change messages to. Required when call_handler is relay_context. */
  call_relay_context_status_callback_url?: string;
  /** The Relay application to forward incoming calls to. Required when call_handler is relay_application. */
  call_relay_application?: string;
  /** The ID of the Video Room to forward incoming calls to. Required when call_handler is video_room. */
  call_video_room_id?: string;
  /** The ID of the Call Flow to forward incoming calls to. Required when call_handler is call_flow. */
  call_flow_id?: string;
  /** The version of the Call Flow to use. Valid values are 'working_copy' or 'current_deployed'. */
  call_flow_version?: string;
  /** The ID of the AI Agent to forward incoming calls to. Required when call_handler is ai_agent. */
  call_ai_agent_id?: string;
  /** A URL of a SWML script to respond to incoming calls. Required when call_handler is relay_script. */
  call_relay_script_url?: string;
}

/** Request body for creating a verified caller ID. */
export interface CreateVerifiedCallerIDRequest {
  /** String representing the phone number for the caller ID. This must be a valid, routeable phone number in [E.164 format](https://en.wikipedia.org/wiki/E.164) that is able to receive a voice phone call for verification. */
  number: string;
  /** The name portion of the caller ID. If not provided, the default will be the formatted number. */
  name?: string;
  /** The extension of the phone number for the caller ID. This is only used when placing the verification call. */
  extension?: string;
}

/** All possible call handler types for domain applications. Includes types that can only be assigned via the Fabric API or UI. */
export type DomainAppCallHandler =
  | 'relay_topic'
  | 'relay_application'
  | 'laml_webhooks'
  | 'laml_application'
  | 'video_room'
  | 'relay_script'
  | 'dialogflow'
  | 'ai_agent'
  | 'call_flow'
  | 'relay_context'
  | 'relay_connector'
  | 'fabric_subscriber'
  | 'sip_gateway'
  | 'call_queue';

/** Call handler types that can be assigned via the API. */
export type DomainAppCallHandlerRequest =
  | 'relay_topic'
  | 'relay_application'
  | 'laml_webhooks'
  | 'laml_application'
  | 'video_room'
  | 'relay_script'
  | 'dialogflow'
  | 'ai_agent'
  | 'call_flow'
  | 'relay_context';

/** Domain application model. */
export interface DomainApplication {
  /** The unique identifier of the domain application on SignalWire. */
  id: uuid;
  /** A string representation of the type of object this record is. */
  type: string;
  /** The unique domain for this application, combining your space subdomain and identifier. */
  domain: string;
  /** A string representing the friendly name for this domain application. */
  name: string | null;
  /** A string representing the identifier portion of the domain application. */
  identifier: string;
  /** A string representing the user portion of the domain application. */
  user: string;
  /** Whether the domain application will enforce IP authentication for incoming requests. */
  ip_auth_enabled: boolean;
  /** A list containing whitelisted IP addresses and IP blocks used if ip_auth_enabled is true. */
  ip_auth: string[];
  /** Specify how the domain application will handle calls. */
  call_handler: DomainAppCallHandler | null;
  /** The unique identifier of the calling handler resource. */
  calling_handler_resource_id: uuid | null;
  /** A string representing the Relay topic to forward incoming calls to. */
  call_relay_topic: string | null;
  /** A string representing a URL to send status change messages to. */
  call_relay_topic_status_callback_url: string | null;
  /** Deprecated. Use call_relay_application instead. */
  call_relay_context: string | null;
  /** Deprecated. Use call_relay_topic_status_callback_url instead. */
  call_relay_context_status_callback_url: string | null;
  /** A string representing the LaML URL to access when a call is received. */
  call_request_url: string | null;
  /** A string representing the HTTP method to use with call_request_url. */
  call_request_method: 'GET' | 'POST' | null;
  /** A string representing the LaML URL to access when the call to call_request_url fails. */
  call_fallback_url: string | null;
  /** A string representing the HTTP method to use with call_fallback_url. */
  call_fallback_method: 'GET' | 'POST' | null;
  /** A string representing a URL to send status change messages to. */
  call_status_callback_url: string | null;
  /** A string representing the HTTP method to use with call_status_callback_url. */
  call_status_callback_method: 'GET' | 'POST' | null;
  /** A string representing the ID of the LaML application to forward incoming calls to. */
  call_laml_application_id: string | null;
  /** A string representing the ID of the Video Room to forward incoming calls to. */
  call_video_room_id: uuid | null;
  /** A string representing the URL of the Relay script to execute when a call is received. */
  call_relay_script_url: string | null;
  /** A string representing whether connections to this domain application require encryption or if encryption is optional. Valid values are optional, required, and forbidden. */
  encryption: 'optional' | 'required' | 'forbidden';
  /** A list of codecs this domain application will support. Currently supported values are: OPUS, G722, PCMU, PCMA, G729, VP8, and H264. */
  codecs: string[];
  /** A list of encryption ciphers this domain application will support. Currently supported values are: AEAD_AES_256_GCM_8, AES_256_CM_HMAC_SHA1_80, AES_CM_128_HMAC_SHA1_80, AES_256_CM_HMAC_SHA1_32, and AES_CM_128_HMAC_SHA1_32. */
  ciphers: string[];
}

/** Response containing a list of domain applications. */
export interface DomainApplicationListResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of domain applications. */
  data: DomainApplication[];
}

/** Response containing a single domain application. */
export interface DomainApplicationResponse {
  /** The unique identifier of the domain application on SignalWire. */
  id: uuid;
  /** A string representation of the type of object this record is. */
  type: string;
  /** The unique domain for this application, combining your space subdomain and identifier. */
  domain: string;
  /** A string representing the friendly name for this domain application. */
  name: string | null;
  /** A string representing the identifier portion of the domain application. */
  identifier: string;
  /** A string representing the user portion of the domain application. */
  user: string;
  /** Whether the domain application will enforce IP authentication for incoming requests. */
  ip_auth_enabled: boolean;
  /** A list containing whitelisted IP addresses and IP blocks used if ip_auth_enabled is true. */
  ip_auth: string[];
  /** Specify how the domain application will handle calls. */
  call_handler: DomainAppCallHandler | null;
  /** The unique identifier of the calling handler resource. */
  calling_handler_resource_id: uuid | null;
  /** A string representing the Relay topic to forward incoming calls to. */
  call_relay_topic: string | null;
  /** A string representing a URL to send status change messages to. */
  call_relay_topic_status_callback_url: string | null;
  /** Deprecated. Use call_relay_application instead. */
  call_relay_context: string | null;
  /** Deprecated. Use call_relay_topic_status_callback_url instead. */
  call_relay_context_status_callback_url: string | null;
  /** A string representing the LaML URL to access when a call is received. */
  call_request_url: string | null;
  /** A string representing the HTTP method to use with call_request_url. */
  call_request_method: 'GET' | 'POST' | null;
  /** A string representing the LaML URL to access when the call to call_request_url fails. */
  call_fallback_url: string | null;
  /** A string representing the HTTP method to use with call_fallback_url. */
  call_fallback_method: 'GET' | 'POST' | null;
  /** A string representing a URL to send status change messages to. */
  call_status_callback_url: string | null;
  /** A string representing the HTTP method to use with call_status_callback_url. */
  call_status_callback_method: 'GET' | 'POST' | null;
  /** A string representing the ID of the LaML application to forward incoming calls to. */
  call_laml_application_id: string | null;
  /** A string representing the ID of the Video Room to forward incoming calls to. */
  call_video_room_id: uuid | null;
  /** A string representing the URL of the Relay script to execute when a call is received. */
  call_relay_script_url: string | null;
  /** A string representing whether connections to this domain application require encryption or if encryption is optional. Valid values are optional, required, and forbidden. */
  encryption: 'optional' | 'required' | 'forbidden';
  /** A list of codecs this domain application will support. Currently supported values are: OPUS, G722, PCMU, PCMA, G729, VP8, and H264. */
  codecs: string[];
  /** A list of encryption ciphers this domain application will support. Currently supported values are: AEAD_AES_256_GCM_8, AES_256_CM_HMAC_SHA1_80, AES_CM_128_HMAC_SHA1_80, AES_256_CM_HMAC_SHA1_32, and AES_CM_128_HMAC_SHA1_32. */
  ciphers: string[];
}

/** HTTP method type. */
export type HttpMethod = 'GET' | 'POST';

/** Request body for importing a phone number. */
export interface ImportPhoneNumberRequest {
  /** The phone number to import in E.164 format. Number must be between 5 and 30 characters with no special characters besides a leading +. */
  number: string;
  /** The type of phone number being imported. */
  number_type: 'longcode' | 'tollfree';
  /** The capabilities to enable for this phone number. Can include any combination of SMS, Voice, Fax, and MMS. If not provided, defaults to all capabilities. */
  capabilities?: ('sms' | 'voice' | 'fax' | 'mms')[];
}

/** Legal entity type for brand registration. */
export type LegalEntityType = 'PRIVATE_PROFIT' | 'PUBLIC_PROFIT' | 'NON_PROFIT' | 'GOVERNMENT';

/** Phone number representation within a membership. */
export interface MembershipPhoneNumber {
  /** The unique identifier of the phone number. */
  id?: uuid;
  /** The name given to the phone number. */
  name?: string;
  /** The phone number in E.164 format. */
  number?: string;
  /** The capabilities of the phone number. */
  capabilities?: string[];
}

/** MFA request model. */
export interface MfaRequest {
  /** The E164 number to use as the destination. */
  to: string;
  /** The E164 number from your account to use as the origin of the message. SignalWire will use a special verified number if not specified. */
  from?: string;
  /** Specify a custom message to send before the token. The message must fit within one segment; either 160 characters or 70 characters when using non-GSM symbols. */
  message?: string;
  /** The number of characters in the token, from 4 to 20. Defaults to 6. */
  token_length?: number;
  /** The number of seconds the token is considered valid for. Defaults to 3600, with a maximum of 604800. */
  valid_for?: number;
  /** The number of allowed verification attempts, including the first one, from 1 to 20. Defaults to 3. */
  max_attempts?: number;
  /** Set to true or false, whether to include letters or just numbers in the token. Defaults to false (numbers only). */
  allow_alphas?: boolean;
}

/** MFA response model. */
export interface MfaResponse {
  /** The MFA request ID. Save this for verification. */
  id: uuid;
  /** Whether the request was successfully queued. */
  success: boolean;
  /** The destination of the MFA request. */
  to: string;
  /** Can be sms for a text message or call for a phone call. */
  channel: string;
}

/** MFA verification request model. */
export interface MfaVerifyRequest {
  /** The token to verify. */
  token: string;
}

/** MFA verification response model. */
export interface MfaVerifyResponse {
  /** Whether the token was successfully verified by the API. When `max_attempts` are reached or the request is no longer valid, the endpoint will return a `404 Not Found`. */
  success: boolean;
}

/** Number group model. */
export interface NumberGroup {
  /** The unique identifier of the Number Group on SignalWire. This can be used to update or delete the group programmatically. */
  id: uuid;
  /** The name given to the number group. Helps to distinguish different groups within your project. */
  name: string;
  /** Whether the number group uses the same 'From' number for outbound requests to a number, or chooses a random one. */
  sticky_sender: boolean;
  /** The number of phone numbers within the group. */
  phone_number_count: number;
}

/** Response containing a list of number groups. */
export interface NumberGroupListResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of number groups. */
  data: NumberGroup[];
}

/** Number group membership model. */
export interface NumberGroupMembership {
  /** The unique identifier of the Number Group Membership on SignalWire. This can be used to delete the membership programmatically. */
  id: uuid;
  /** The unique identifier of the Number Group this membership is associated with. */
  number_group_id: uuid;
  /** A representation of the phone number this membership is associated with. */
  phone_number: MembershipPhoneNumber;
  /** The date and time when the membership was created. */
  created_at: string;
  /** The date and time when the membership was last updated. */
  updated_at: string;
}

/** Response containing a list of number group memberships. */
export interface NumberGroupMembershipListResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of number group memberships. */
  data: NumberGroupMembership[];
}

/** Response containing a single number group membership. */
export interface NumberGroupMembershipResponse {
  /** The unique identifier of the Number Group Membership on SignalWire. This can be used to delete the membership programmatically. */
  id: uuid;
  /** The unique identifier of the Number Group this membership is associated with. */
  number_group_id: uuid;
  /** A representation of the phone number this membership is associated with. */
  phone_number: MembershipPhoneNumber;
  /** The date and time when the membership was created. */
  created_at: string;
  /** The date and time when the membership was last updated. */
  updated_at: string;
}

/** Response containing a single number group. */
export interface NumberGroupResponse {
  /** The unique identifier of the Number Group on SignalWire. This can be used to update or delete the group programmatically. */
  id: uuid;
  /** The name given to the number group. Helps to distinguish different groups within your project. */
  name: string;
  /** Whether the number group uses the same 'From' number for outbound requests to a number, or chooses a random one. */
  sticky_sender: boolean;
  /** The number of phone numbers within the group. */
  phone_number_count: number;
}

/** Order model for campaign registry operations. */
export interface Order {
  /** The unique identifier of the order. */
  id: uuid;
  /** The current state of the order. */
  state?: string;
  /** Timestamp when the order was processed. */
  processed_at?: string;
  /** Timestamp when the order was created. */
  created_at?: string;
  /** Timestamp when the order was last updated. */
  updated_at?: string;
  /** Optional: Specify a URL to receive webhook notifications when your number assignment order and the number assignments that belong to it change state. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
}

/** Response containing a list of orders. */
export interface OrderListResponse {
  /** Pagination links. */
  links?: PaginationLinks;
  /** List of orders. */
  data?: Order[];
}

/** Response containing a single order. */
export interface OrderResponse {
  /** The unique identifier of the order. */
  id: uuid;
  /** The current state of the order. */
  state?: string;
  /** Timestamp when the order was processed. */
  processed_at?: string;
  /** Timestamp when the order was created. */
  created_at?: string;
  /** Timestamp when the order was last updated. */
  updated_at?: string;
  /** Optional: Specify a URL to receive webhook notifications when your number assignment order and the number assignments that belong to it change state. See the [10DLC status callback](/docs/apis/relay-rest/campaign-registry/webhooks/ten-dlc-status-callback) docs for the webhook payload. */
  status_callback_url?: string;
}

/** Pagination links for list responses. */
export interface PaginationLinks {
  /** Link to the current page. */
  self: string;
  /** Link to the first page. */
  first: string;
  /** Link to the next page. Only present when there are more results. */
  next?: string;
  /** Link to the previous page. Only present when not on the first page. */
  prev?: string;
}

/** Phone number model. */
export interface PhoneNumber {
  /** The unique identifier of the phone number. */
  id: uuid;
  /** The phone number in E.164 format. */
  number: string;
  /** The name given to the phone number. Helps to distinguish different phone numbers within your project. */
  name: string | null;
  /** A list of communication methods this phone number supports. */
  capabilities: PhoneNumberCapability[];
  /** The type of number this is defined as. */
  number_type: PhoneNumberType;
  /** The E911 address ID associated with this phone number. */
  e911_address_id: uuid | null;
  /** The date the number was added to your project. */
  created_at: string;
  /** The date the number was last updated. */
  updated_at: string;
  /** The next date the number will be billed for. */
  next_billed_at: string | null;
  /** What type of handler you want to run on inbound calls. */
  call_handler: PhoneNumberCallHandler | null;
  /** The unique identifier of the calling handler resource. */
  calling_handler_resource_id: uuid | null;
  /** How do you want to receive the incoming call. */
  call_receive_mode: CallReceiveMode;
  /** The URL to make a request to when using the laml_webhooks call handler. */
  call_request_url: string | null;
  /** The HTTP method to use when making a request to the call_request_url. */
  call_request_method: HttpMethod | null;
  /** The fallback URL to make a request to when using the laml_webhooks call handler and the call_request_url fails. */
  call_fallback_url: string | null;
  /** The HTTP method to use when making a request to the call_fallback_url. */
  call_fallback_method: HttpMethod | null;
  /** The URL to make status callbacks to when using the laml_webhooks call handler. */
  call_status_callback_url: string | null;
  /** The HTTP method to use when making a request to the call_status_callback_url. */
  call_status_callback_method: HttpMethod | null;
  /** The ID of the LaML Application to use when using the laml_application call handler. */
  call_laml_application_id: string | null;
  /** The ID of the Dialogflow Agent to start when using the dialogflow call handler. */
  call_dialogflow_agent_id: string | null;
  /** A string representing the Relay topic to forward incoming calls to. This is only used (and required) when call_handler is set to relay_topic. */
  call_relay_topic: string | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to relay_topic. */
  call_relay_topic_status_callback_url: string | null;
  /** The URL to make a request to when using the relay_script call handler. The URL must respond with a valid SWML script. */
  call_relay_script_url: string | null;
  /** The name of the Relay Context to send this call to when using the relay_context call handler. */
  call_relay_context: string | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to relay_context. */
  call_relay_context_status_callback_url: string | null;
  /** The name of the Relay Application to send this call to when using the relay_application call handler. */
  call_relay_application: string | null;
  /** The ID of the Relay Connector to send this call to when using the relay_connector call handler. */
  call_relay_connector_id: string | null;
  /** The ID of the Relay SIP Endpoint to send this call to when using the relay_sip_endpoint call handler. */
  call_sip_endpoint_id: uuid | null;
  /** The name of the Verto Relay Endpoint to send this call to when using the relay_verto_endpoint call handler. */
  call_verto_resource: string | null;
  /** The ID of the Video Room to send this call to when using the video_room call handler. */
  call_video_room_id: uuid | null;
  /** What type of handler you want to run on inbound messages. */
  message_handler: PhoneNumberMessageHandler | null;
  /** The unique identifier of the messaging handler resource. */
  messaging_handler_resource_id: uuid | null;
  /** The URL to make a request to when using the laml_webhooks message handler. */
  message_request_url: string | null;
  /** The HTTP method to use when making a request to the message_request_url. */
  message_request_method: HttpMethod | null;
  /** The fallback URL to make a request to when using the laml_webhooks message handler and the message_request_url fails. */
  message_fallback_url: string | null;
  /** The HTTP method to use when making a request to the message_fallback_url. */
  message_fallback_method: HttpMethod | null;
  /** The ID of the LaML Application to use when using the laml_application message handler. */
  message_laml_application_id: string | null;
  /** The name of the Relay Topic to send this message to when using the relay_topic message handler. */
  message_relay_topic: string | null;
  /** The name of the Relay Context to send this message to when using the relay_context message handler. */
  message_relay_context: string | null;
  /** The ISO 3166-1 alpha-2 country code of the phone number. */
  country_code: string | null;
}

/** Call handler type for phone numbers. */
export type PhoneNumberCallHandler =
  | 'relay_context'
  | 'relay_topic'
  | 'relay_script'
  | 'relay_application'
  | 'relay_connector'
  | 'relay_sip_endpoint'
  | 'relay_verto_endpoint'
  | 'laml_webhooks'
  | 'laml_application'
  | 'dialogflow'
  | 'video_room'
  | 'call_flow'
  | 'ai_agent'
  | 'fabric_subscriber'
  | 'sip_gateway'
  | 'call_queue';

/** Call handler type for phone number update requests. */
export type PhoneNumberCallHandlerRequest =
  | 'relay_context'
  | 'relay_topic'
  | 'relay_script'
  | 'relay_application'
  | 'relay_connector'
  | 'relay_sip_endpoint'
  | 'relay_verto_endpoint'
  | 'laml_webhooks'
  | 'laml_application'
  | 'dialogflow'
  | 'video_room'
  | 'ai_agent'
  | 'call_flow';

/** Phone number capabilities. */
export interface PhoneNumberCapabilities {
  /** Whether the phone number can receive voice calls. */
  voice?: boolean;
  /** Whether the phone number can send/receive SMS. */
  sms?: boolean;
  /** Whether the phone number can send/receive MMS. */
  mms?: boolean;
  /** Whether the phone number can send/receive fax. */
  fax?: boolean;
}

/** Phone number capability. */
export type PhoneNumberCapability = 'voice' | 'sms' | 'mms' | 'fax';

/** Response containing a list of phone numbers. */
export interface PhoneNumberListResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of phone numbers. */
  data: PhoneNumber[];
}

/** Response containing phone number lookup result. */
export interface PhoneNumberLookupResponse {
  /** The Country code associated with the number. */
  country_code_number?: number;
  /** Number in the countries national format. */
  national_number?: string;
  /** Whether the number supplied is a possible number. */
  possible_number?: boolean;
  /** Whether the number supplied is a valid number. */
  valid_number?: boolean;
  /** The E164 number formatted in national format. */
  national_number_formatted?: string;
  /** The E164 number formatted in international format. */
  international_number_formatted?: string;
  /** The number in E164 format. */
  e164?: string;
  /** The location of the number based on its area code and NPA. */
  location?: string;
  /** The ISO3166 alpha 2 country code associated with the number. */
  country_code?: string;
  /** The time zones associated with the number. */
  timezones?: string[];
  /** The type of number based on its area code and NPA. */
  number_type?: string;
  /** Carrier information. Adding include=carrier to your request will do a live lookup to determine the current carrier information about this number. */
  carrier?: CarrierLookupInfo;
  /** Caller ID information. Adding include=cnam to your request will do a live lookup to determine the current caller ID information about this number. */
  cnam?: CnamInfo;
}

/** Message handler type for phone numbers. */
export type PhoneNumberMessageHandler =
  | 'relay_context'
  | 'relay_topic'
  | 'relay_application'
  | 'laml_webhooks'
  | 'laml_application';

/** Response containing a single phone number. */
export interface PhoneNumberResponse {
  /** The unique identifier of the phone number. */
  id: uuid;
  /** The phone number in E.164 format. */
  number: string;
  /** The name given to the phone number. Helps to distinguish different phone numbers within your project. */
  name: string | null;
  /** A list of communication methods this phone number supports. */
  capabilities: PhoneNumberCapability[];
  /** The type of number this is defined as. */
  number_type: PhoneNumberType;
  /** The E911 address ID associated with this phone number. */
  e911_address_id: uuid | null;
  /** The date the number was added to your project. */
  created_at: string;
  /** The date the number was last updated. */
  updated_at: string;
  /** The next date the number will be billed for. */
  next_billed_at: string | null;
  /** What type of handler you want to run on inbound calls. */
  call_handler: PhoneNumberCallHandler | null;
  /** The unique identifier of the calling handler resource. */
  calling_handler_resource_id: uuid | null;
  /** How do you want to receive the incoming call. */
  call_receive_mode: CallReceiveMode;
  /** The URL to make a request to when using the laml_webhooks call handler. */
  call_request_url: string | null;
  /** The HTTP method to use when making a request to the call_request_url. */
  call_request_method: HttpMethod | null;
  /** The fallback URL to make a request to when using the laml_webhooks call handler and the call_request_url fails. */
  call_fallback_url: string | null;
  /** The HTTP method to use when making a request to the call_fallback_url. */
  call_fallback_method: HttpMethod | null;
  /** The URL to make status callbacks to when using the laml_webhooks call handler. */
  call_status_callback_url: string | null;
  /** The HTTP method to use when making a request to the call_status_callback_url. */
  call_status_callback_method: HttpMethod | null;
  /** The ID of the LaML Application to use when using the laml_application call handler. */
  call_laml_application_id: string | null;
  /** The ID of the Dialogflow Agent to start when using the dialogflow call handler. */
  call_dialogflow_agent_id: string | null;
  /** A string representing the Relay topic to forward incoming calls to. This is only used (and required) when call_handler is set to relay_topic. */
  call_relay_topic: string | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to relay_topic. */
  call_relay_topic_status_callback_url: string | null;
  /** The URL to make a request to when using the relay_script call handler. The URL must respond with a valid SWML script. */
  call_relay_script_url: string | null;
  /** The name of the Relay Context to send this call to when using the relay_context call handler. */
  call_relay_context: string | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to relay_context. */
  call_relay_context_status_callback_url: string | null;
  /** The name of the Relay Application to send this call to when using the relay_application call handler. */
  call_relay_application: string | null;
  /** The ID of the Relay Connector to send this call to when using the relay_connector call handler. */
  call_relay_connector_id: string | null;
  /** The ID of the Relay SIP Endpoint to send this call to when using the relay_sip_endpoint call handler. */
  call_sip_endpoint_id: uuid | null;
  /** The name of the Verto Relay Endpoint to send this call to when using the relay_verto_endpoint call handler. */
  call_verto_resource: string | null;
  /** The ID of the Video Room to send this call to when using the video_room call handler. */
  call_video_room_id: uuid | null;
  /** What type of handler you want to run on inbound messages. */
  message_handler: PhoneNumberMessageHandler | null;
  /** The unique identifier of the messaging handler resource. */
  messaging_handler_resource_id: uuid | null;
  /** The URL to make a request to when using the laml_webhooks message handler. */
  message_request_url: string | null;
  /** The HTTP method to use when making a request to the message_request_url. */
  message_request_method: HttpMethod | null;
  /** The fallback URL to make a request to when using the laml_webhooks message handler and the message_request_url fails. */
  message_fallback_url: string | null;
  /** The HTTP method to use when making a request to the message_fallback_url. */
  message_fallback_method: HttpMethod | null;
  /** The ID of the LaML Application to use when using the laml_application message handler. */
  message_laml_application_id: string | null;
  /** The name of the Relay Topic to send this message to when using the relay_topic message handler. */
  message_relay_topic: string | null;
  /** The name of the Relay Context to send this message to when using the relay_context message handler. */
  message_relay_context: string | null;
  /** The ISO 3166-1 alpha-2 country code of the phone number. */
  country_code: string | null;
}

/** Phone number type. */
export type PhoneNumberType = 'toll-free' | 'longcode';

/** Recording from a PSTN call leg. */
export interface PstnRecording {
  /** Unique ID of the recording. */
  id: uuid;
  /** Unique ID of the project. */
  project_id: uuid;
  /** Date and time when the recording was created. */
  created_at: string;
  /** Date and time when the recording was last updated. */
  updated_at: string;
  /** Duration of the recording in seconds. */
  duration_in_seconds: number;
  /** Error code if the recording failed. */
  error_code?: string;
  /** Price of the recording. */
  price: number;
  /** Currency unit for the price. */
  price_unit: string;
  /** Status of the recording. */
  status: string;
  /** URL of the recording file. */
  url: string;
  /** Indicates whether the recording is stereo. */
  stereo: boolean;
  /** Size of the recording file in bytes. */
  byte_size?: number;
  /** Audio track of the recording. */
  track: string;
  /** ID of the PSTN leg associated with the recording. */
  relay_pstn_leg_id: uuid;
}

/** Request body for purchasing a phone number. */
export interface PurchasePhoneNumberRequest {
  /** The phone number in E164 format. */
  number: string;
}

/** Queue model. */
export interface Queue {
  /** The unique identifier of the queue. */
  id: uuid;
  /** The project ID associated with this queue. */
  project_id: uuid;
  /** The friendly name of the queue. */
  friendly_name: string;
  /** The maximum number of callers allowed in the queue. */
  max_size?: number;
  /** The current number of callers in the queue. */
  current_size?: number;
  /** The average wait time in seconds. */
  average_wait_time?: number;
  /** The URL of this queue. */
  uri?: string;
  /** Timestamp when the queue was created. */
  date_created?: string;
  /** Timestamp when the queue was last updated. */
  date_updated?: string;
}

/** Response containing a list of queues. */
export interface QueueListResponse {
  /** Pagination links. */
  links?: PaginationLinks;
  /** List of queues. */
  data?: Queue[];
}

/** Queue member model. */
export interface QueueMember {
  /** The call ID of the queue member. */
  call_id: uuid;
  /** The ID of the project associated with this queue member. */
  project_id: string;
  /** The ID of the queue associated with this queue member. */
  queue_id: string;
  /** Queue member position in the queue. */
  position: number;
  /** The URL of this queue member. */
  uri: string;
  /** Wait time in seconds since the member was enqueued. If not yet enqueued, it will be null. */
  wait_time?: number;
  /** When the queue member was last enqueued. */
  date_enqueued?: string;
}

/** Response containing a list of queue members. */
export interface QueueMemberListResponse {
  /** Pagination links. */
  links?: PaginationLinks;
  /** List of queue members. */
  data?: QueueMember[];
}

/** Response containing a single queue member. */
export interface QueueMemberResponse {
  /** The call ID of the queue member. */
  call_id: uuid;
  /** The ID of the project associated with this queue member. */
  project_id: string;
  /** The ID of the queue associated with this queue member. */
  queue_id: string;
  /** Queue member position in the queue. */
  position: number;
  /** The URL of this queue member. */
  uri: string;
  /** Wait time in seconds since the member was enqueued. If not yet enqueued, it will be null. */
  wait_time?: number;
  /** When the queue member was last enqueued. */
  date_enqueued?: string;
}

/** Response containing a single queue. */
export interface QueueResponse {
  /** The unique identifier of the queue. */
  id: uuid;
  /** The project ID associated with this queue. */
  project_id: uuid;
  /** The friendly name of the queue. */
  friendly_name: string;
  /** The maximum number of callers allowed in the queue. */
  max_size?: number;
  /** The current number of callers in the queue. */
  current_size?: number;
  /** The average wait time in seconds. */
  average_wait_time?: number;
  /** The URL of this queue. */
  uri?: string;
  /** Timestamp when the queue was created. */
  date_created?: string;
  /** Timestamp when the queue was last updated. */
  date_updated?: string;
}

/** Recording model. A recording is associated with exactly one call leg type (PSTN, SIP, or WebRTC). */
export type Recording = PstnRecording | SipRecording | WebRtcRecording;

/** Response containing a list of recordings. */
export interface RecordingListResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of recordings. */
  data: Recording[];
}

/** Short code model. */
export interface ShortCode {
  /** The unique identifier of the short code. */
  id: uuid;
  /** The name given to the short code. */
  name: string | null;
  /** The short code number. */
  number: string;
  /** The messaging capabilities of the short code. */
  capabilities: ShortCodeCapability[];
  /** The type of number (always 'shortcode'). */
  number_type: 'shortcode';
  /** The type of short code. */
  code_type: ShortCodeType;
  /** The ISO 3166-1 alpha-2 country code. */
  country_code: string;
  /** The date and time when the short code was created. */
  created_at: string;
  /** The date and time when the short code was last updated. */
  updated_at: string;
  /** The date and time when the short code will next be billed. */
  next_billed_at: string | null;
  /** The lease duration of the short code (e.g., '12 months'). */
  lease_duration: string | null;
  /** The message handler type for incoming messages. */
  message_handler: ShortCodeMessageHandler | null;
  /** The URL to send message requests to when using laml_webhooks handler. */
  message_request_url: string | null;
  /** The HTTP method to use for message requests. */
  message_request_method: HttpMethod | null;
  /** The fallback URL for message requests. */
  message_fallback_url: string | null;
  /** The HTTP method to use for fallback requests. */
  message_fallback_method: HttpMethod | null;
  /** The ID of the LāML application to handle messages when using laml_application handler. */
  message_laml_application_id: uuid | null;
  /** The Relay context to use when using relay_context handler. */
  message_relay_context: string | null;
}

/** Short code capabilities. */
export type ShortCodeCapability = 'sms' | 'mms';

/** Response containing a list of short codes. */
export interface ShortCodeListResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of short codes. */
  data: ShortCode[];
}

/** Message handler type for short codes. */
export type ShortCodeMessageHandler = 'relay_context' | 'laml_webhooks' | 'laml_application';

/** Response containing a single short code. */
export interface ShortCodeResponse {
  /** The unique identifier of the short code. */
  id: uuid;
  /** The name given to the short code. */
  name: string | null;
  /** The short code number. */
  number: string;
  /** The messaging capabilities of the short code. */
  capabilities: ShortCodeCapability[];
  /** The type of number (always 'shortcode'). */
  number_type: 'shortcode';
  /** The type of short code. */
  code_type: ShortCodeType;
  /** The ISO 3166-1 alpha-2 country code. */
  country_code: string;
  /** The date and time when the short code was created. */
  created_at: string;
  /** The date and time when the short code was last updated. */
  updated_at: string;
  /** The date and time when the short code will next be billed. */
  next_billed_at: string | null;
  /** The lease duration of the short code (e.g., '12 months'). */
  lease_duration: string | null;
  /** The message handler type for incoming messages. */
  message_handler: ShortCodeMessageHandler | null;
  /** The URL to send message requests to when using laml_webhooks handler. */
  message_request_url: string | null;
  /** The HTTP method to use for message requests. */
  message_request_method: HttpMethod | null;
  /** The fallback URL for message requests. */
  message_fallback_url: string | null;
  /** The HTTP method to use for fallback requests. */
  message_fallback_method: HttpMethod | null;
  /** The ID of the LāML application to handle messages when using laml_application handler. */
  message_laml_application_id: uuid | null;
  /** The Relay context to use when using relay_context handler. */
  message_relay_context: string | null;
}

/** Short code type. */
export type ShortCodeType = 'vanity' | 'random';

/** SIP endpoint model. */
export interface SipEndpoint {
  /** A string representation of the type of object this record is. */
  type: string;
  /** The unique identifier of the SIP endpoint. */
  id: uuid;
  /** The username for the SIP endpoint. */
  username: string;
  /** Friendly Caller ID used as the CNAM when dialing a phone number or the From when dialing another SIP Endpoint. */
  caller_id: string | null;
  /** When dialing a PSTN phone number, you must send it From a number you have purchased or verified. send_as indicates which number this endpoint has set as its origination. random indicates it will randomly choose a purchased or verified number from within the project. */
  send_as: string;
  /** A list of encryption ciphers this endpoint will support. */
  ciphers: string[];
  /** A list of codecs this endpoint will support. */
  codecs: string[];
  /** Whether connections to this endpoint require encryption or if encryption is optional. */
  encryption: 'default' | 'required' | 'optional';
  /** What type of handler you want to run on inbound calls. */
  call_handler: SipEndpointCallHandler | null;
  /** The unique identifier of the calling handler resource. */
  calling_handler_resource_id: uuid | null;
  /** A string representing the LaML URL to access when a call is received. This is only used (and required) when call_handler is set to laml_webhooks. */
  call_request_url: string | null;
  /** A string representing the HTTP method to use with call_request_url. Valid values are GET and POST. */
  call_request_method: 'GET' | 'POST' | null;
  /** A string representing the LaML URL to access when the call to call_request_url fails. This is only used (and required) when call_handler is set to laml_webhooks. */
  call_fallback_url: string | null;
  /** A string representing the HTTP method to use with call_fallback_url. Valid values are GET and POST. */
  call_fallback_method: 'GET' | 'POST' | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to laml_webhooks. */
  call_status_callback_url: string | null;
  /** A string representing the HTTP method to use with call_status_callback_url. Valid values are GET and POST. */
  call_status_callback_method: 'GET' | 'POST' | null;
  /** A string representing the ID of the LaML application to forward incoming calls to. This is only used (and required) when call_handler is set to laml_application. */
  call_laml_application_id: string | null;
  /** A string representing the ID of the Dialogflow agent to forward incoming calls to. This is only used (and required) when call_handler is set to dialogflow. */
  call_dialogflow_agent_id: string | null;
  /** A string representing the Relay topic to forward incoming calls to. This is only used (and required) when call_handler is set to relay_topic. */
  call_relay_topic: string | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to relay_topic. */
  call_relay_topic_status_callback_url: string | null;
  /** A string representing the Relay context to forward incoming calls to. This is only used (and required) when call_handler is set to relay_context. */
  call_relay_context: string | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to relay_context. */
  call_relay_context_status_callback_url: string | null;
  /** A string representing the Relay application to forward incoming calls to. This is only used (and required) when call_handler is set to relay_application. */
  call_relay_application: string | null;
  /** A string representing the ID of the Video Room to forward incoming calls to. This is only used (and required) when call_handler is set to video_room. */
  call_video_room_id: uuid | null;
  /** A string representing a URL of a SWML script to respond to incoming calls. This is only used (and required) when call_handler is set to relay_script. */
  call_relay_script_url: string | null;
}

/** Call handler type for SIP endpoints. */
export type SipEndpointCallHandler =
  | 'relay_context'
  | 'relay_topic'
  | 'relay_application'
  | 'relay_connector'
  | 'relay_script'
  | 'laml_webhooks'
  | 'laml_application'
  | 'dialogflow'
  | 'video_room'
  | 'call_flow'
  | 'ai_agent';

/** Response containing a list of SIP endpoints. */
export interface SipEndpointListResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of SIP endpoints. */
  data: SipEndpoint[];
}

/** Response containing a single SIP endpoint. */
export interface SipEndpointResponse {
  /** A string representation of the type of object this record is. */
  type: string;
  /** The unique identifier of the SIP endpoint. */
  id: uuid;
  /** The username for the SIP endpoint. */
  username: string;
  /** Friendly Caller ID used as the CNAM when dialing a phone number or the From when dialing another SIP Endpoint. */
  caller_id: string | null;
  /** When dialing a PSTN phone number, you must send it From a number you have purchased or verified. send_as indicates which number this endpoint has set as its origination. random indicates it will randomly choose a purchased or verified number from within the project. */
  send_as: string;
  /** A list of encryption ciphers this endpoint will support. */
  ciphers: string[];
  /** A list of codecs this endpoint will support. */
  codecs: string[];
  /** Whether connections to this endpoint require encryption or if encryption is optional. */
  encryption: 'default' | 'required' | 'optional';
  /** What type of handler you want to run on inbound calls. */
  call_handler: SipEndpointCallHandler | null;
  /** The unique identifier of the calling handler resource. */
  calling_handler_resource_id: uuid | null;
  /** A string representing the LaML URL to access when a call is received. This is only used (and required) when call_handler is set to laml_webhooks. */
  call_request_url: string | null;
  /** A string representing the HTTP method to use with call_request_url. Valid values are GET and POST. */
  call_request_method: 'GET' | 'POST' | null;
  /** A string representing the LaML URL to access when the call to call_request_url fails. This is only used (and required) when call_handler is set to laml_webhooks. */
  call_fallback_url: string | null;
  /** A string representing the HTTP method to use with call_fallback_url. Valid values are GET and POST. */
  call_fallback_method: 'GET' | 'POST' | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to laml_webhooks. */
  call_status_callback_url: string | null;
  /** A string representing the HTTP method to use with call_status_callback_url. Valid values are GET and POST. */
  call_status_callback_method: 'GET' | 'POST' | null;
  /** A string representing the ID of the LaML application to forward incoming calls to. This is only used (and required) when call_handler is set to laml_application. */
  call_laml_application_id: string | null;
  /** A string representing the ID of the Dialogflow agent to forward incoming calls to. This is only used (and required) when call_handler is set to dialogflow. */
  call_dialogflow_agent_id: string | null;
  /** A string representing the Relay topic to forward incoming calls to. This is only used (and required) when call_handler is set to relay_topic. */
  call_relay_topic: string | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to relay_topic. */
  call_relay_topic_status_callback_url: string | null;
  /** A string representing the Relay context to forward incoming calls to. This is only used (and required) when call_handler is set to relay_context. */
  call_relay_context: string | null;
  /** A string representing a URL to send status change messages to. This is only used (and required) when call_handler is set to relay_context. */
  call_relay_context_status_callback_url: string | null;
  /** A string representing the Relay application to forward incoming calls to. This is only used (and required) when call_handler is set to relay_application. */
  call_relay_application: string | null;
  /** A string representing the ID of the Video Room to forward incoming calls to. This is only used (and required) when call_handler is set to video_room. */
  call_video_room_id: uuid | null;
  /** A string representing a URL of a SWML script to respond to incoming calls. This is only used (and required) when call_handler is set to relay_script. */
  call_relay_script_url: string | null;
}

/** Response containing the SIP profile. */
export interface SipProfileResponse {
  /** A string representation of the fully qualified domain name for this profile. */
  domain?: string;
  /** String representing the domain_identifier portion of the profile. Must be unique across your project. */
  domain_identifier?: string;
  /** A list of codecs this profile will support. Currently supported values are: OPUS, G722, PCMU, PCMA, VP8, H264. */
  default_codecs?: string[];
  /** A list of encryption ciphers this profile will support. Currently supported values are: AEAD_AES_256_GCM_8, AES_256_CM_HMAC_SHA1_80, AES_CM_128_HMAC_SHA1_80, AES_256_CM_HMAC_SHA1_32, AES_CM_128_HMAC_SHA1_32. */
  default_ciphers?: string[];
  /** A string representing whether connections to an endpoint that uses this profile require encryption or if encryption is optional. Encryption will always be used if possible. Possible values are required or optional. */
  default_encryption?: 'required' | 'optional';
  /** The e164 formatted number you wish to set as the originating number when dialing PSTN phone numbers from a SIP Endpoint that uses this profile. Specify null or an empty string to randomly choose a purchased or verified number from within the project. */
  default_send_as?: string;
}

/** Recording from a SIP call leg. */
export interface SipRecording {
  /** Unique ID of the recording. */
  id: uuid;
  /** Unique ID of the project. */
  project_id: uuid;
  /** Date and time when the recording was created. */
  created_at: string;
  /** Date and time when the recording was last updated. */
  updated_at: string;
  /** Duration of the recording in seconds. */
  duration_in_seconds: number;
  /** Error code if the recording failed. */
  error_code?: string;
  /** Price of the recording. */
  price: number;
  /** Currency unit for the price. */
  price_unit: string;
  /** Status of the recording. */
  status: string;
  /** URL of the recording file. */
  url: string;
  /** Indicates whether the recording is stereo. */
  stereo: boolean;
  /** Size of the recording file in bytes. */
  byte_size?: number;
  /** Audio track of the recording. */
  track: string;
  /** ID of the SIP leg associated with the recording. */
  relay_sip_leg_id: uuid;
}

/** Details about a specific validation error. */
export interface Types_StatusCodes_SpaceApiErrorItem {
  /** A description of what caused the error. */
  detail: string;
  /** The HTTP status code. */
  status: string;
  /** A short summary of the error type. */
  title: string;
  /** The error code. */
  code: string;
}

/** The request is invalid. */
export interface Types_StatusCodes_StatusCode400 {
  error: 'Bad Request';
}

/** Access is unauthorized. */
export interface Types_StatusCodes_StatusCode401 {
  error: 'Unauthorized';
}

/** The server cannot find the requested resource. */
export interface Types_StatusCodes_StatusCode404 {
  error: 'Not Found';
}

/** An internal server error occurred. */
export interface Types_StatusCodes_StatusCode500 {
  error: 'Internal Server Error';
}

/** The request failed validation. See errors for details. */
export interface Types_StatusCodes_ValidationError {
  /** List of validation errors. */
  errors: Types_StatusCodes_SpaceApiErrorItem[];
}

/** Request body for updating a campaign. */
export interface UpdateCampaignRequest {
  /** A name for the campaign. */
  name?: string;
}

/** Request body for updating a domain application. */
export interface UpdateDomainApplicationRequest {
  /** A string representing the friendly name for this domain application. */
  name?: string;
  /** A string representing the identifier portion of the domain application. */
  identifier?: string;
  /** A string representing the user portion of the domain application. */
  user?: string;
  /** Whether the domain application will enforce IP authentication for incoming requests. */
  ip_auth_enabled?: boolean;
  /** A list containing whitelisted IP addresses and IP blocks used if ip_auth_enabled is true. */
  ip_auth?: string[];
  /** Whether connections to this domain application require encryption or if encryption is optional. */
  encryption?: 'optional' | 'required' | 'forbidden';
  /** A list of codecs this domain application will support. */
  codecs?: string[];
  /** A list of encryption ciphers this domain application will support. */
  ciphers?: string[];
  /** Specify how the domain application will handle calls. */
  call_handler?: DomainAppCallHandlerRequest;
  /** A string representing the Relay topic to forward incoming calls to. */
  call_relay_topic?: string;
  /** A string representing a URL to send status change messages to. */
  call_relay_topic_status_callback_url?: string;
  /** A string representing the Relay Application to forward incoming calls to. */
  call_relay_application?: string;
  /** A string representing the LaML URL to access when a call is received. */
  call_request_url?: string;
  /** A string representing the HTTP method to use with call_request_url. */
  call_request_method?: 'GET' | 'POST';
  /** A string representing the LaML URL to access when the call to call_request_url fails. */
  call_fallback_url?: string;
  /** A string representing the HTTP method to use with call_fallback_url. */
  call_fallback_method?: 'GET' | 'POST';
  /** A string representing a URL to send status change messages to. */
  call_status_callback_url?: string;
  /** A string representing the HTTP method to use with call_status_callback_url. */
  call_status_callback_method?: 'GET' | 'POST';
  /** A string representing the ID of the LaML application to forward incoming calls to. */
  call_laml_application_id?: string;
  /** A string representing the ID of the Video Room to forward incoming calls to. */
  call_video_room_id?: uuid;
  /** A string representing the URL of the Relay script to execute when a call is received. */
  call_relay_script_url?: string;
  /** A string representing the ID of the Dialogflow Agent to forward incoming calls to. */
  call_dialogflow_agent_id?: uuid;
  /** A string representing the ID of the AI Agent to forward incoming calls to. */
  call_ai_agent_id?: uuid;
  /** A string representing the ID of the Call Flow to forward incoming calls to. */
  call_flow_id?: uuid;
  /** A string representing the version of your Call Flow you'd like to use. */
  call_flow_version?: 'working_copy' | 'current_deployed';
  /** This handler type is deprecated. Please use call_relay_application or call_relay_topic instead. */
  call_relay_context?: string;
  /** This property is deprecated. Please use call_relay_topic_status_callback_url instead. */
  call_relay_context_status_callback_url?: string;
}

/** Request body for updating a number group. */
export interface UpdateNumberGroupRequest {
  /** The name given to the number group. Helps to distinguish different groups within your project. */
  name: string;
  /** Whether the number group uses the same 'From' number for outbound requests to a number, or chooses a random one. */
  sticky_sender?: boolean;
}

/** Request body for updating a phone number. */
export interface UpdatePhoneNumberRequest {
  /** The friendly name for the phone number. */
  name?: string;
  /** The call handler for the phone number. */
  call_handler?: PhoneNumberCallHandlerRequest;
  /** The call receive mode for the phone number. */
  call_receive_mode?: string;
  /** The call request URL for the phone number. */
  call_request_url?: string;
  /** The call request method for the phone number. */
  call_request_method?: 'GET' | 'POST';
  /** The call fallback URL for the phone number. */
  call_fallback_url?: string;
  /** The call fallback method for the phone number. */
  call_fallback_method?: 'GET' | 'POST';
  /** The call status callback URL for the phone number. */
  call_status_callback_url?: string;
  /** The call status callback method for the phone number. */
  call_status_callback_method?: 'GET' | 'POST';
  /** The ID of the LaML Application to use when using the laml_application call handler. */
  call_laml_application_id?: string;
  /** The ID of the Dialogflow Agent to start when using the dialogflow call handler. */
  call_dialogflow_agent_id?: string;
  /** A string representing the Relay topic to forward incoming calls to. */
  call_relay_topic?: string;
  /** A string representing a URL to send status change messages to when call_handler is set to relay_topic. */
  call_relay_topic_status_callback_url?: string;
  /** The URL to make a request to when using the relay_script call handler. */
  call_relay_script_url?: string;
  /** This handler type is deprecated. Please use call_relay_application or call_relay_topic instead. */
  call_relay_context?: string;
  /** This property is deprecated. Please use call_relay_topic_status_callback_url instead. */
  call_relay_context_status_callback_url?: string;
  /** A string representing the Relay Application to forward incoming calls to. */
  call_relay_application?: string;
  /** The ID of the Relay Connector to use when using the relay_connector call handler. */
  call_relay_connector_id?: string;
  /** The ID of the SIP Endpoint to use when using the relay_sip_endpoint call handler. */
  call_sip_endpoint_id?: string;
  /** The Verto resource to use when using the relay_verto_endpoint call handler. */
  call_verto_resource?: string;
  /** The ID of the Video Room to forward incoming calls to when using the video_room call handler. */
  call_video_room_id?: uuid;
  /** The ID of the AI Agent to forward incoming calls to when using the ai_agent call handler. */
  call_ai_agent_id?: uuid;
  /** The ID of the Call Flow to forward incoming calls to when using the call_flow call handler. */
  call_flow_id?: uuid;
  /** The Call Flow version to use when using the call_flow call handler. */
  call_flow_version?: 'working_copy' | 'current_deployed';
  /** The message handler for the phone number. */
  message_handler?: PhoneNumberMessageHandler;
  /** The message request URL for the phone number. */
  message_request_url?: string;
  /** The message request method for the phone number. */
  message_request_method?: 'GET' | 'POST';
  /** The message fallback URL for the phone number. */
  message_fallback_url?: string;
  /** The message fallback method for the phone number. */
  message_fallback_method?: 'GET' | 'POST';
  /** The ID of the LaML Application to use for messages. */
  message_laml_application_id?: string;
  /** A string representing the Relay topic to forward incoming messages to. */
  message_relay_topic?: string;
  /** This handler type is deprecated. Please use message_relay_application or message_relay_topic instead. */
  message_relay_context?: string;
  /** A string representing the Relay Application to forward incoming messages to. */
  message_relay_application?: string;
}

/** Request body for updating a queue. */
export interface UpdateQueueRequest {
  /** The name of the queue. */
  name?: string;
  /** The maximum number of callers allowed in the queue. */
  max_size?: number;
}

/** Request body for updating a short code. */
export interface UpdateShortCodeRequest {
  /** The name given to the short code. */
  name: string;
  /** The message handler type for incoming messages. */
  message_handler: ShortCodeMessageHandler;
  /** The URL to send message requests to when using laml_webhooks handler. */
  message_request_url?: string;
  /** The HTTP method to use for message requests. Defaults to POST. */
  message_request_method?: HttpMethod;
  /** The fallback URL for message requests. */
  message_fallback_url?: string;
  /** The HTTP method to use for fallback requests. Defaults to POST. */
  message_fallback_method?: HttpMethod;
  /** The ID of the LāML application to handle messages when using laml_application handler. */
  message_laml_application_id?: uuid;
  /** The Relay context to use when using relay_context handler. */
  message_relay_context?: string;
}

/** Request body for updating a SIP endpoint. */
export interface UpdateSipEndpointRequest {
  /** String representing the username portion of the endpoint. Must be unique across your project and must not contain white space characters or @. */
  username?: string;
  /** A password to authenticate registrations to this endpoint. */
  password?: string;
  /** Friendly Caller ID used as the CNAM when dialing a phone number or the From when dialing another SIP Endpoint. */
  caller_id?: string;
  /** When dialing a PSTN phone number, you must send it From a number you have purchased or verified. send_as indicates which number this endpoint has set as its origination. random indicates it will randomly choose a purchased or verified number from within the project. */
  send_as?: string;
  /** A list of encryption ciphers this endpoint will support. */
  ciphers?: string[];
  /** A list of codecs this endpoint will support. */
  codecs?: string[];
  /** Specifies the encryption requirements for connections to this endpoint. */
  encryption?: 'default' | 'required' | 'optional';
  /** What type of handler you want to run on inbound calls. */
  call_handler?:
    | 'relay_context'
    | 'relay_topic'
    | 'relay_application'
    | 'relay_connector'
    | 'relay_script'
    | 'laml_webhooks'
    | 'laml_application'
    | 'dialogflow'
    | 'video_room'
    | 'call_flow'
    | 'ai_agent';
  /** The LaML URL to access when a call is received. Required when call_handler is laml_webhooks. */
  call_request_url?: string;
  /** The HTTP method to use with call_request_url. */
  call_request_method?: 'GET' | 'POST';
  /** The LaML URL to access when the call to call_request_url fails. Required when call_handler is laml_webhooks. */
  call_fallback_url?: string;
  /** The HTTP method to use with call_fallback_url. */
  call_fallback_method?: 'GET' | 'POST';
  /** A URL to send status change messages to. Required when call_handler is laml_webhooks. */
  call_status_callback_url?: string;
  /** The HTTP method to use with call_status_callback_url. */
  call_status_callback_method?: 'GET' | 'POST';
  /** The ID of the LaML application to forward incoming calls to. Required when call_handler is laml_application. */
  call_laml_application_id?: string;
  /** The ID of the Dialogflow agent to forward incoming calls to. Required when call_handler is dialogflow. */
  call_dialogflow_agent_id?: string;
  /** The Relay topic to forward incoming calls to. Required when call_handler is relay_topic. */
  call_relay_topic?: string;
  /** A URL to send status change messages to. Required when call_handler is relay_topic. */
  call_relay_topic_status_callback_url?: string;
  /** The Relay context to forward incoming calls to. Required when call_handler is relay_context. */
  call_relay_context?: string;
  /** A URL to send status change messages to. Required when call_handler is relay_context. */
  call_relay_context_status_callback_url?: string;
  /** The Relay application to forward incoming calls to. Required when call_handler is relay_application. */
  call_relay_application?: string;
  /** The ID of the Video Room to forward incoming calls to. Required when call_handler is video_room. */
  call_video_room_id?: string;
  /** The ID of the Call Flow to forward incoming calls to. Required when call_handler is call_flow. */
  call_flow_id?: string;
  /** The version of the Call Flow to use. Valid values are 'working_copy' or 'current_deployed'. */
  call_flow_version?: string;
  /** The ID of the AI Agent to forward incoming calls to. Required when call_handler is ai_agent. */
  call_ai_agent_id?: string;
  /** A URL of a SWML script to respond to incoming calls. Required when call_handler is relay_script. */
  call_relay_script_url?: string;
}

/** Request body for updating the SIP profile. */
export interface UpdateSipProfileRequest {
  /** String representing the domain_identifier portion of the profile. Must be unique across your project. */
  domain_identifier?: string;
  /** A list of codecs this profile will support. Currently supported values are: OPUS, G722, PCMU, PCMA, VP8, H264. */
  default_codecs?: string[];
  /** A list of encryption ciphers this profile will support. Currently supported values are: AEAD_AES_256_GCM_8, AES_256_CM_HMAC_SHA1_80, AES_CM_128_HMAC_SHA1_80, AES_256_CM_HMAC_SHA1_32, AES_CM_128_HMAC_SHA1_32. */
  default_ciphers?: string[];
  /** A string representing whether connections to an endpoint that uses this profile require encryption or if encryption is optional. Encryption will always be used if possible. Possible values are required or optional. */
  default_encryption?: 'required' | 'optional';
  /** The e164 formatted number you wish to set as the originating number when dialing PSTN phone numbers from a SIP Endpoint that uses this profile. Specify null or an empty string to randomly choose a purchased or verified number from within the project. */
  default_send_as?: string;
}

/** Request body for updating a verified caller ID. */
export interface UpdateVerifiedCallerIDRequest {
  /** The name portion of the caller ID. */
  name: string;
}

/** Verified caller ID model. */
export interface VerifiedCallerID {
  /** The type of the returned object, this should be verified_caller_id. */
  type?: string;
  /** The unique identifier of the Verified Caller ID on SignalWire. */
  id: uuid;
  /** String representing the phone number for the caller ID. This must be a valid, routeable phone number in E.164 format. */
  number: string;
  /** String representing the name portion of the caller ID. If not provided, the default will be the formatted number that has been provided. */
  name?: string;
  /** String representing the extension of the phone number for the caller ID. This is only used when placing the verification call. */
  extension?: string;
  /** A boolean representing whether the number has been verified or not. */
  verified: boolean;
  /** Nullable DateTime field representing the date and time that the number was verified. If the number has not been verified, it will be null. */
  verified_at?: string;
  /** The verification status for the caller ID. */
  status?: 'Verified' | 'Awaiting Verification';
}

/** Response containing a list of verified caller IDs. */
export interface VerifiedCallerIDListResponse {
  /** Pagination links. */
  links?: PaginationLinks;
  /** List of verified caller IDs. */
  data?: VerifiedCallerID[];
}

/** Response containing a single verified caller ID. */
export interface VerifiedCallerIDResponse {
  /** The type of the returned object, this should be verified_caller_id. */
  type?: string;
  /** The unique identifier of the Verified Caller ID on SignalWire. */
  id: uuid;
  /** String representing the phone number for the caller ID. This must be a valid, routeable phone number in E.164 format. */
  number: string;
  /** String representing the name portion of the caller ID. If not provided, the default will be the formatted number that has been provided. */
  name?: string;
  /** String representing the extension of the phone number for the caller ID. This is only used when placing the verification call. */
  extension?: string;
  /** A boolean representing whether the number has been verified or not. */
  verified: boolean;
  /** Nullable DateTime field representing the date and time that the number was verified. If the number has not been verified, it will be null. */
  verified_at?: string;
  /** The verification status for the caller ID. */
  status?: 'Verified' | 'Awaiting Verification';
}

/** Request body for verifying a caller ID. */
export interface VerifyCallerIDRequest {
  /** The verification code received via call or SMS. */
  verification_code: string;
}

/** Recording from a WebRTC call leg. */
export interface WebRtcRecording {
  /** Unique ID of the recording. */
  id: uuid;
  /** Unique ID of the project. */
  project_id: uuid;
  /** Date and time when the recording was created. */
  created_at: string;
  /** Date and time when the recording was last updated. */
  updated_at: string;
  /** Duration of the recording in seconds. */
  duration_in_seconds: number;
  /** Error code if the recording failed. */
  error_code?: string;
  /** Price of the recording. */
  price: number;
  /** Currency unit for the price. */
  price_unit: string;
  /** Status of the recording. */
  status: string;
  /** URL of the recording file. */
  url: string;
  /** Indicates whether the recording is stereo. */
  stereo: boolean;
  /** Size of the recording file in bytes. */
  byte_size?: number;
  /** Audio track of the recording. */
  track: string;
  /** ID of the WebRTC leg associated with the recording. */
  relay_webrtc_leg_id: uuid;
}

/** Universal Unique Identifier. */
export type uuid = string;

export type ListAddressesResponse = AddressListResponse;

export type CreateAddressResponse = AddressResponse;

export type GetAddressResponse = AddressResponse;

export type ListDomainApplicationsResponse = DomainApplicationListResponse;

export type CreateDomainApplicationResponse = DomainApplicationResponse;

export type RetrieveDomainApplicationResponse = DomainApplicationResponse;

export type UpdateDomainApplicationResponse = DomainApplicationResponse;

export type ListSipEndpointsResponse = SipEndpointListResponse;

export type CreateSipEndpointResponse = SipEndpointResponse;

export type RetrieveSipEndpointResponse = SipEndpointResponse;

export type UpdateSipEndpointResponse = SipEndpointResponse;

export type CreateImportedPhoneNumberRequest = ImportPhoneNumberRequest;

export type CreateImportedPhoneNumberResponse = PhoneNumberResponse;

export type LookupPhoneNumberResponse = PhoneNumberLookupResponse;

export type RequestMfaCallRequest = MfaRequest;

export type RequestMfaCallResponse = MfaResponse;

export type RequestMfaSmsRequest = MfaRequest;

export type RequestMfaSmsResponse = MfaResponse;

export type VerifyMfaTokenRequest = MfaVerifyRequest;

export type VerifyMfaTokenResponse = MfaVerifyResponse;

export type RetrieveNumberGroupMembershipResponse = NumberGroupMembershipResponse;

export type ListNumberGroupsResponse = NumberGroupListResponse;

export type CreateNumberGroupResponse = NumberGroupResponse;

export type ListNumberGroupMembershipsResponse = NumberGroupMembershipListResponse;

export type CreateNumberGroupMembershipRequest = AddNumberGroupMembershipRequest;

export type CreateNumberGroupMembershipResponse = NumberGroupMembershipResponse;

export type RetrieveNumberGroupResponse = NumberGroupResponse;

export type UpdateNumberGroupResponse = NumberGroupResponse;

export type ListPhoneNumbersResponse = PhoneNumberListResponse;

export type PurchasePhoneNumberResponse = PhoneNumberResponse;

export type SearchAvailablePhoneNumbersResponse = AvailablePhoneNumbersResponse;

export type RetrievePhoneNumberResponse = PhoneNumberResponse;

export type UpdatePhoneNumberResponse = PhoneNumberResponse;

export type ListQueuesResponse = QueueListResponse;

export type CreateQueueResponse = QueueResponse;

export type GetQueueResponse = QueueResponse;

export type UpdateQueueResponse = QueueResponse;

export type ListQueueMembersResponse = QueueMemberListResponse;

export type RetrieveNextQueueMemberResponse = QueueMemberResponse;

export type RetrieveQueueMemberResponse = QueueMemberResponse;

export type ListRecordingsResponse = RecordingListResponse;

export type GetRecordingResponse = PstnRecording | SipRecording | WebRtcRecording;

export type ListBrandsResponse = BrandListResponse;

export type CreateBrandRequest = CreateManagedBrandRequest | CreateCspBrandRequest;

export type CreateBrandResponse = BrandResponse;

export type RetrieveBrandResponse = BrandResponse;

export type ListCampaignsResponse = CampaignListResponse;

export type CreateCampaignRequest = CreateManagedCampaignRequest | CreatePartnerCampaignRequest;

export type CreateCampaignResponse = CampaignResponse;

export type RetrieveCampaignResponse = CampaignResponse;

export type UpdateCampaignResponse = CampaignResponse;

export type ListNumberAssignmentsResponse = AssignedNumberListResponse;

export type ListOrdersResponse = OrderListResponse;

export type CreateOrderResponse = OrderResponse;

export type RetrieveOrderResponse = OrderResponse;

export type ListShortCodesResponse = ShortCodeListResponse;

export type RetrieveShortCodeResponse = ShortCodeResponse;

export type UpdateShortCodeResponse = ShortCodeResponse;

export type RetrieveSipProfileResponse = SipProfileResponse;

export type UpdateSipProfileResponse = SipProfileResponse;

export type ListVerifiedCallerIdsResponse = VerifiedCallerIDListResponse;

export type CreateVerifiedCallerIdRequest = CreateVerifiedCallerIDRequest;

export type CreateVerifiedCallerIdResponse = VerifiedCallerIDResponse;

export type RetrieveVerifiedCallerIdResponse = VerifiedCallerIDResponse;

export type UpdateVerifiedCallerIdRequest = UpdateVerifiedCallerIDRequest;

export type UpdateVerifiedCallerIdResponse = VerifiedCallerIDResponse;

export type RedialVerificationCallResponse = VerifiedCallerIDResponse;

export type ValidateVerificationCodeRequest = VerifyCallerIDRequest;

export type ValidateVerificationCodeResponse = VerifiedCallerIDResponse;
