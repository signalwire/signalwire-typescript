// AUTO-GENERATED from porting-sdk/rest-apis/space/openapi.enriched.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** The space named by the request subdomain. */
export interface Space {
  /** The object type. Always `space`. */
  type: 'space';
  /** The unique identifier of the space. */
  id: string;
  /** The name of the space. */
  name: string;
  /** The subdomain of the space, which is the first label of its URL. */
  subdomain: string;
  /** Whether the space has completed verification. An unverified space cannot use this API. */
  verified: boolean;
  /** Whether the space is on a trial. */
  trial: boolean;
  /** The date and time when the space was created. */
  created_at: string;
  /** The date and time when the space was last updated. */
  updated_at: string;
}

/** Request body for renaming the space. */
export interface SpaceUpdate {
  /** The new name of the space. Must not be blank. */
  name?: string;
}

/** The countries the space has selected for international traffic, and the countries it may select. */
export interface GeographicPermission {
  /** The object type. Always `geographic_permission`. */
  type: 'geographic_permission';
  /** The selected ISO 3166-1 alpha-2 country codes. */
  countries: string[];
  /** The ISO 3166-1 alpha-2 country codes that may be selected. */
  supported_countries: string[];
}

/** Request body for replacing the selected countries. */
export interface GeographicPermissionUpdate {
  /** The ISO 3166-1 alpha-2 country codes to select. The array replaces the current */
  countries: string[];
}

/** The billing address and contacts for the space. A profile that has never been configured is returned with `null` fields rather than a `404`. */
export interface BillingProfile {
  /** The object type. Always `billing_profile`. */
  type: 'billing_profile';
  /** The first line of the billing address. */
  address_line1: string | null;
  /** The second line of the billing address. */
  address_line2: string | null;
  /** The city of the billing address. */
  address_city: string | null;
  /** The state, province, or region of the billing address. */
  address_state: string | null;
  /** The postal code of the billing address. */
  address_zip: string | null;
  /** The ISO 3166-1 alpha-2 country code of the billing address. */
  address_country: string | null;
  /** The company name that appears on statements. */
  company_name: string | null;
  /** The name of the billing contact. */
  contact_name: string | null;
  /** The email addresses billing correspondence is sent to. */
  contact_email: string[] | null;
  /** The phone number of the billing contact. */
  contact_phone: string | null;
  /** The tax identification number that appears on statements. */
  tax_id_number: string | null;
  /** Whether a monthly invoice is issued for the space. */
  monthly_invoices: boolean;
  /** Whether `tax_id_number` is required when updating the profile. `true` on Enterprise spaces. */
  tax_id_number_required: boolean;
  /** Whether `monthly_invoices` is locked on. `true` on postpay spaces, where monthly invoices cannot be turned off. */
  monthly_invoices_locked: boolean;
}

/** Request body for updating the billing profile. The update writes the whole profile, so send every field you want to keep. */
export interface BillingProfileUpdate {
  /** The first line of the billing address. */
  address_line1: string;
  /** The second line of the billing address. */
  address_line2?: string;
  /** The city of the billing address. */
  address_city: string;
  /** The state, province, or region of the billing address. */
  address_state: string;
  /** The postal code of the billing address. */
  address_zip: string;
  /** The ISO 3166-1 alpha-2 country code of the billing address. */
  address_country: AddressCountryCode;
  /** The company name to show on statements. */
  company_name: string;
  /** The name of the billing contact. */
  contact_name: string;
  /** The email addresses to send billing correspondence to. Must be an array (`contact_email_must_be_array`) with at least one address (`contact_email_missing`), each a valid email address (`contact_email_address_invalid`). */
  contact_email: string[];
  /** The phone number of the billing contact. */
  contact_phone: string;
  /** The tax identification number to show on statements. Required when the profile reports `tax_id_number_required: true`, which is the case on Enterprise spaces. */
  tax_id_number?: string;
  /** Whether to issue a monthly invoice. On a postpay space this is locked on, and `false` is rejected with `monthly_invoices_locked`. */
  monthly_invoices?: boolean;
}

/** ISO 3166-1 alpha-2 country code (uppercase). */
export type AddressCountryCode =
  | 'AD'
  | 'AE'
  | 'AF'
  | 'AG'
  | 'AI'
  | 'AL'
  | 'AM'
  | 'AO'
  | 'AQ'
  | 'AR'
  | 'AS'
  | 'AT'
  | 'AU'
  | 'AW'
  | 'AX'
  | 'AZ'
  | 'BA'
  | 'BB'
  | 'BD'
  | 'BE'
  | 'BF'
  | 'BG'
  | 'BH'
  | 'BI'
  | 'BJ'
  | 'BL'
  | 'BM'
  | 'BN'
  | 'BO'
  | 'BQ'
  | 'BR'
  | 'BS'
  | 'BT'
  | 'BV'
  | 'BW'
  | 'BY'
  | 'BZ'
  | 'CA'
  | 'CC'
  | 'CD'
  | 'CF'
  | 'CG'
  | 'CH'
  | 'CI'
  | 'CK'
  | 'CL'
  | 'CM'
  | 'CN'
  | 'CO'
  | 'CR'
  | 'CU'
  | 'CV'
  | 'CW'
  | 'CX'
  | 'CY'
  | 'CZ'
  | 'DE'
  | 'DJ'
  | 'DK'
  | 'DM'
  | 'DO'
  | 'DZ'
  | 'EC'
  | 'EE'
  | 'EG'
  | 'EH'
  | 'ER'
  | 'ES'
  | 'ET'
  | 'FI'
  | 'FJ'
  | 'FK'
  | 'FM'
  | 'FO'
  | 'FR'
  | 'GA'
  | 'GB'
  | 'GD'
  | 'GE'
  | 'GF'
  | 'GG'
  | 'GH'
  | 'GI'
  | 'GL'
  | 'GM'
  | 'GN'
  | 'GP'
  | 'GQ'
  | 'GR'
  | 'GS'
  | 'GT'
  | 'GU'
  | 'GW'
  | 'GY'
  | 'HK'
  | 'HM'
  | 'HN'
  | 'HR'
  | 'HT'
  | 'HU'
  | 'ID'
  | 'IE'
  | 'IL'
  | 'IM'
  | 'IN'
  | 'IO'
  | 'IQ'
  | 'IR'
  | 'IS'
  | 'IT'
  | 'JE'
  | 'JM'
  | 'JO'
  | 'JP'
  | 'KE'
  | 'KG'
  | 'KH'
  | 'KI'
  | 'KM'
  | 'KN'
  | 'KP'
  | 'KR'
  | 'KW'
  | 'KY'
  | 'KZ'
  | 'LA'
  | 'LB'
  | 'LC'
  | 'LI'
  | 'LK'
  | 'LR'
  | 'LS'
  | 'LT'
  | 'LU'
  | 'LV'
  | 'LY'
  | 'MA'
  | 'MC'
  | 'MD'
  | 'ME'
  | 'MF'
  | 'MG'
  | 'MH'
  | 'MK'
  | 'ML'
  | 'MM'
  | 'MN'
  | 'MO'
  | 'MP'
  | 'MQ'
  | 'MR'
  | 'MS'
  | 'MT'
  | 'MU'
  | 'MV'
  | 'MW'
  | 'MX'
  | 'MY'
  | 'MZ'
  | 'NA'
  | 'NC'
  | 'NE'
  | 'NF'
  | 'NG'
  | 'NI'
  | 'NL'
  | 'NO'
  | 'NP'
  | 'NR'
  | 'NU'
  | 'NZ'
  | 'OM'
  | 'PA'
  | 'PE'
  | 'PF'
  | 'PG'
  | 'PH'
  | 'PK'
  | 'PL'
  | 'PM'
  | 'PN'
  | 'PR'
  | 'PS'
  | 'PT'
  | 'PW'
  | 'PY'
  | 'QA'
  | 'RE'
  | 'RO'
  | 'RS'
  | 'RU'
  | 'RW'
  | 'SA'
  | 'SB'
  | 'SC'
  | 'SD'
  | 'SE'
  | 'SG'
  | 'SH'
  | 'SI'
  | 'SJ'
  | 'SK'
  | 'SL'
  | 'SM'
  | 'SN'
  | 'SO'
  | 'SR'
  | 'SS'
  | 'ST'
  | 'SV'
  | 'SX'
  | 'SY'
  | 'SZ'
  | 'TC'
  | 'TD'
  | 'TF'
  | 'TG'
  | 'TH'
  | 'TJ'
  | 'TK'
  | 'TL'
  | 'TM'
  | 'TN'
  | 'TO'
  | 'TR'
  | 'TT'
  | 'TV'
  | 'TW'
  | 'TZ'
  | 'UA'
  | 'UG'
  | 'UM'
  | 'US'
  | 'UY'
  | 'UZ'
  | 'VA'
  | 'VC'
  | 'VE'
  | 'VG'
  | 'VI'
  | 'VN'
  | 'VU'
  | 'WF'
  | 'WS'
  | 'YE'
  | 'YT'
  | 'ZA'
  | 'ZM'
  | 'ZW';

/** A month a statement is available for. */
export interface BillingStatementPeriod {
  /** The object type. Always `billing_statement_period`. */
  type: 'billing_statement_period';
  /** The calendar month the statement covers, as `YYYY-MM`. Statements are identified by month, not by an id. */
  month: string;
  /** The path of the statement for this month. */
  uri: string;
  /** The formats the statement is available in: `json`, `csv`, and `pdf` for a closed month; `json` and `csv` for the current month. */
  formats: ('json' | 'csv' | 'pdf')[];
}

/** The months a statement is available for, newest first. This list is not paged. */
export interface BillingStatementPeriodList {
  /** The available months, newest first. */
  data: BillingStatementPeriod[];
}

/** One month's statement: the totals, company-wide usage by kind, and usage per project. Statements are computed on request from the usage reporting pipeline. */
export interface BillingStatement {
  /** The object type. Always `billing_statement`. */
  type: 'billing_statement';
  /** The calendar month the statement covers, as `YYYY-MM`. */
  month: string;
  /** The totals for the month. */
  summary: BillingStatementSummary;
  /** Company-wide usage broken down by kind. */
  usage_by_kind: AmountByKind[];
  /** Usage per project, each with its own breakdown by kind. */
  projects: ProjectUsage[];
}

/** The totals for the month. */
export interface BillingStatementSummary {
  /** Usage charges in microdollars. */
  usage_in_microdollars: number;
  /** Usage charges in US dollars. */
  usage_in_dollars: number;
  /** Carrier fees in microdollars. */
  carrier_fees_in_microdollars: number;
  /** Carrier fees in US dollars. */
  carrier_fees_in_dollars: number;
  /** Taxes in microdollars. */
  taxes_in_microdollars: number;
  /** Taxes in US dollars. */
  taxes_in_dollars: number;
  /** The balance adjustments recorded in the month, one entry per adjustment kind. */
  adjustments: AmountByKind[];
}

/** An amount for one kind of usage or adjustment, in microdollars (millionths of a US dollar) and again in dollars. */
export interface AmountByKind {
  /** A stable code for the kind of usage or adjustment. */
  kind: string;
  /** A description of the kind. */
  description: string;
  /** The amount in microdollars. */
  amount_in_microdollars: number;
  /** The same amount in US dollars. */
  amount_in_dollars: number;
}

/** Usage attributed to one project, with its own breakdown by kind. */
export interface ProjectUsage {
  /** The unique identifier of the project. */
  id: string;
  /** The name of the project. Can be `null`. */
  name: string | null;
  /** The project's total in microdollars. */
  amount_in_microdollars: number;
  /** The same total in US dollars. */
  amount_in_dollars: number;
  /** The project's usage broken down by kind. */
  usage_by_kind: AmountByKind[];
}

/** Company-wide usage for a month, in total, by kind, and per project. Usage is computed on request from the usage reporting pipeline. */
export interface Usage {
  /** The object type. Always `usage`. */
  type: 'usage';
  /** The calendar month the usage covers, as `YYYY-MM`. */
  month: string;
  /** The total usage in microdollars. */
  total_in_microdollars: number;
  /** The total usage in US dollars. */
  total_in_dollars: number;
  /** Company-wide usage broken down by kind. */
  usage_by_kind: AmountByKind[];
  /** Usage per project, each with its own breakdown by kind. */
  projects: ProjectUsage[];
}

/** A change to the space balance: a top-up, an auto top-up, or a credit or debit applied by SignalWire. */
export interface BalanceAdjustment {
  /** The object type. Always `balance_adjustment`. */
  type: 'balance_adjustment';
  /** The unique identifier of the adjustment. */
  id: string;
  /** The kind of adjustment, for example `balance_top_up`, `auto_balance_top_up`, `balance_credit_by_signalwire`, `balance_debit_by_signalwire`, `coupon_code_credit`, or `sign_up_free_credit`. */
  kind: string;
  /** The signed amount in microdollars. Credits and debits carry the sign they were recorded with. */
  amount_in_microdollars: number;
  /** The same amount in US dollars. */
  amount: number;
  /** The date and time when the adjustment was recorded. */
  created_at: string;
  /** The last four digits of the card that was charged, or `null` when the adjustment was not charged to a card. */
  payment_method_last4: string | null;
}

/** A page of balance adjustments. */
export interface PaymentHistoryList {
  /** Pagination links for the list. The `created_after` and `created_before` filters are preserved in each link. */
  links: SpacePaginationLinks;
  /** The balance adjustments on this page. */
  data: BalanceAdjustment[];
}

/** A membership in the space. */
export interface Member {
  /** The object type. Always `member`. */
  type: 'member';
  /** The unique identifier of the membership, used in the path of the member endpoints. */
  id: string;
  /** The member's email address. */
  email: string;
  /** The member's name, or `null` when none was given. */
  name: string;
  /** The member's role in the space. */
  role: 'owner' | 'admin' | 'employee' | 'guest';
  /** The member's job title, or `null` when not set. */
  job_title: 'entrepreneur' | 'product_manager' | 'developer' | 'other' | null;
  /** Whether the member has accepted the invitation. `false` until the invitation is accepted. */
  activated: boolean;
  /** The date and time the member last signed in, or `null` if they never have. */
  last_logged_in: string | null;
  /** The date and time when the membership was created. */
  created_at: string;
  /** The date and time when the membership was last updated. */
  updated_at: string;
}

/** A page of members. */
export interface MemberList {
  /** Pagination links for the list of members. The `role` filter is preserved in each link. */
  links: SpacePaginationLinks;
  /** The members on this page. */
  data: Member[];
}

/** Request body for inviting a member. */
export interface MemberCreate {
  /** The email address to invite. Must be a valid address that does not already belong to a member of the space (`already_a_member`). */
  email: string;
  /** The role to assign: `admin` or `employee`. `owner` cannot be assigned (`invalid_role`). */
  role: 'admin' | 'employee';
  /** The member's name. */
  name?: string;
}

/** Request body for updating a member. */
export interface MemberUpdate {
  /** The member's name. */
  name?: string;
  /** The role to assign: `admin` or `employee`. The owner's role cannot be changed (`cannot_change_the_owners_role`). */
  role?: 'admin' | 'employee';
  /** The member's job title. */
  job_title?: 'entrepreneur' | 'product_manager' | 'developer' | 'other' | null;
}

/** A project as the space sees it. The full project object, including its settings, is returned by the [Projects API](/docs/apis/rest/projects/get-project). */
export interface SpaceProject {
  /** The object type. Always `project`. */
  type: 'project';
  /** The unique identifier of the project. */
  id: string;
  /** The name of the project. */
  name: string;
  /** The date and time when the project was created. */
  created_at: string;
  /** The date and time when the project was last updated. */
  updated_at: string;
}

/** A root project a member is enabled for, with the subprojects reached through that enablement. */
export interface MemberProject {
  /** The object type. Always `project`. */
  type: 'project';
  /** The unique identifier of the project. */
  id: string;
  /** The name of the project. */
  name: string;
  /** The date and time when the project was created. */
  created_at: string;
  /** The date and time when the project was last updated. */
  updated_at: string;
  /** The subprojects reached through this enablement. Present on the enablement endpoints only, not on the nested entries. */
  subprojects: SpaceProject[];
}

/** A page of the root projects a member is enabled for. */
export interface MemberProjectList {
  /** Pagination links for the list of projects. */
  links: SpacePaginationLinks;
  /** The root projects on this page, each with the subprojects reached through it. */
  data: MemberProject[];
}

/** The current balance of the space and its auto top-up state. Amounts are given in microdollars (millionths of a US dollar) and again in dollars. */
export interface Balance {
  /** The object type. Always `balance`. */
  type: 'balance';
  /** The current balance in microdollars. */
  balance_in_microdollars: number;
  /** The current balance in US dollars. The same value as `balance_in_microdollars`. */
  current_balance: number;
  /** The low balance threshold in microdollars. */
  low_balance_threshold_in_microdollars: number;
  /** The low balance threshold in US dollars. The same value as `low_balance_threshold_in_microdollars`. */
  low_balance_threshold: number;
  /** Whether auto top-up is enabled. */
  auto_topup_enabled: boolean;
}

/** Request body for charging a payment method and depositing the amount to the balance. */
export interface TopUpCreate {
  /** The amount to charge and deposit, in microdollars. At least 5,000,000 (5.00 USD) and a whole number of cents, so a multiple of 10,000. */
  amount_in_microdollars: number;
  /** The payment method to charge. Must name a payment method on this space (`payment_method_invalid`). List them with [List payment methods](/docs/apis/rest/space/billing/list-payment-methods). */
  payment_method_id: string;
}

/** How the space is notified when its balance falls below the threshold, and whether it tops itself up automatically. */
export interface LowBalanceSetting {
  /** The object type. Always `low_balance_setting`. */
  type: 'low_balance_setting';
  /** The balance, in microdollars, below which notifications and auto top-up trigger. Falls back to the platform default when never configured. */
  threshold_in_microdollars: number;
  /** The threshold in US dollars. The same value as `threshold_in_microdollars`. */
  threshold: number;
  /** Whether an email is sent when the balance falls below the threshold. */
  send_email: boolean;
  /** Whether a webhook is sent when the balance falls below the threshold. */
  send_webhook: boolean;
  /** The URL the low balance webhook is sent to, or `null` when none is set. */
  webhook_url: string | null;
  /** The HTTP method used for the low balance webhook, or `null` when none is set. */
  webhook_method: string | null;
  /** Whether auto top-up is enabled. */
  send_topup: boolean;
  /** The amount, in microdollars, deposited by each auto top-up. Can be `null`. */
  topup_amount_in_microdollars: number | null;
  /** The auto top-up amount in US dollars. The same value as `topup_amount_in_microdollars`. */
  topup_amount: number | null;
  /** The payment method charged by auto top-up, or `null` when none is set. */
  topup_payment_method_id: string | null;
}

/** Request body for updating low balance notifications and auto top-up. The update writes the whole setting, so omitted fields take their defaults. */
export interface LowBalanceSettingUpdate {
  /** The balance, in microdollars, below which notifications and auto top-up trigger. A whole number of cents, at least 5,000,000 (5.00 USD) and at most 1,000,000,000,000 (1,000,000 USD). Defaults to the platform default when omitted. */
  threshold_in_microdollars?: number;
  /** Whether to send an email when the balance falls below the threshold. */
  send_email?: boolean;
  /** Whether to send a webhook when the balance falls below the threshold. */
  send_webhook?: boolean;
  /** The URL to send the low balance webhook to. Required when `send_webhook` is `true` (`webhook_url_missing`). */
  webhook_url?: string;
  /** The HTTP method for the low balance webhook: `GET` or `POST`. */
  webhook_method?: 'GET' | 'POST';
  /** Whether to top the balance up automatically when it falls below the threshold. Some spaces are required to keep auto top-up on; disabling it there is rejected with `send_topup_cannot_be_disabled`. */
  send_topup?: boolean;
  /** The amount, in microdollars, to deposit on each auto top-up. Required when `send_topup` is `true` (`topup_amount_missing`). A whole number of cents and at least 10,000,000 (10.00 USD). */
  topup_amount_in_microdollars?: number;
  /** The payment method to charge on each auto top-up. Required when `send_topup` is `true` (`topup_payment_method_missing`) and must name a payment method on this space (`topup_payment_method_invalid`). */
  topup_payment_method_id?: string;
}

/** A card on file for the space. Cards are added in the Dashboard; the API lists and deletes them. */
export interface PaymentMethod {
  /** The object type. Always `payment_method`. */
  type: 'payment_method';
  /** The unique identifier of the payment method. Use it as `payment_method_id` when topping up or configuring auto top-up. */
  id: string;
  /** The card brand. */
  brand: string | null;
  /** The last four digits of the card number. */
  last4: string | null;
  /** The month the card expires, from 1 to 12. */
  expires_month: number | null;
  /** The four-digit year the card expires. */
  expires_year: number | null;
  /** The ISO 3166-1 alpha-2 country code of the card. */
  country: string | null;
  /** Whether this card is the one auto top-up charges. The active auto top-up source cannot be deleted. */
  auto_topup_source: boolean;
}

/** Cursor pagination links. Filters given on the request are preserved in every link. */
export interface SpacePaginationLinks {
  /** The link to the current page. */
  self: string;
  /** The link to the first page. */
  first: string;
  /** The link to the next page. Only present when more results exist. */
  next?: string;
  /** The link to the previous page. Only present when a previous page exists. */
  prev?: string;
}

/** The standard validation error body. */
export interface SpaceStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** Details about a specific error. */
export interface Types_StatusCodes_RestApiErrorItem {
  /** The category of error. */
  type: string;
  /** A specific error code. */
  code: string;
  /** A description of what caused the error. */
  message: string;
  /** The request parameter that caused the error, if applicable. */
  attribute: string | null;
  /** A link to documentation about this error. */
  url: string;
}

export interface SpaceUnverifiedError {
  /** States that a phone number must be validated for the space before it can use the API. */
  message: string;
}

/** A top-up with the same `Idempotency-Key` is still in progress. Wait for it to finish, then replay the request with the same key to read its result. */
export interface TopUpMessageError {
  /** Why the request was rejected. */
  message: string;
}

/** The card was declined. This is not the standard validation error body: it carries the payment processor's stable decline code. */
export interface TopUpDeclinedError {
  /** A description of the decline. */
  message: string | null;
  /** The payment processor's stable decline code. */
  decline_code: string;
}

/** An upstream billing service was unavailable and the deposit to the space balance could not be completed. */
export interface TopUpDepositFailedError {
  /** A description of the failure. */
  message: string;
  /** A stable code for the failure. */
  code: 'deposit_failed';
}

export type GetBillingStatementCsvResponse = string;

export type ListPaymentMethodsResponse = PaymentMethod[];
