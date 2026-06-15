// AUTO-GENERATED from porting-sdk/rest-apis/chat/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** User-defined channel names. Each channel is an object with `read` and/or `write` properties. */
export type ChatChannel = Record<string, ChatPermissionWithRead | ChatPermissionWithWrite>;

export interface ChatPermissionWithRead {
  /** Gives the token read access to the channel. */
  read: boolean;
  /** Gives the token write access to the channel. */
  write?: boolean;
}

export interface ChatPermissionWithWrite {
  /** Gives the token read access to the channel. */
  read?: boolean;
  /** Gives the token write access to the channel. */
  write: boolean;
}

/** An arbitrary JSON object available to store stateful application information in. Must be valid JSON and have a maximum size of 2,000 characters. */
export type ChatState = Record<string, Record<string, unknown>>;

export interface ChatToken {
  /** The generated Chat Token. */
  token: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface ChatToken422Error {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface NewChatToken {
  /** The maximum time, in minutes, that the access token will be valid for. Between 1 and 43,200 (30 days). */
  ttl: number;
  /** User-defined channel names with read/write permissions. Max of 500 channels. Channel names cannot start with the reserved prefix `sw_` and can be up to 250 characters. */
  channels: ChatChannel;
  /** The unique identifier of the member. Up to 250 characters. If not specified, a random UUID will be generated. */
  member_id?: string;
  /** An arbitrary JSON object available to store stateful application information in. Must be valid JSON and have a maximum size of 2,000 characters. */
  state?: ChatState;
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
  attribute?: string | null;
  /** A link to documentation about this error. */
  url: string;
}

/** The request is invalid. */
export interface Types_StatusCodes_StatusCode400 {
  error: 'Bad Request';
}

/** Access is unauthorized. */
export interface Types_StatusCodes_StatusCode401 {
  error: 'Unauthorized';
}

export type CreateChatTokenRequest = NewChatToken;

export type CreateChatTokenResponse = ChatToken;
