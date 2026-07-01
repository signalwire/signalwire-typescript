// AUTO-GENERATED from porting-sdk/rest-apis/pubsub/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

export interface NewPubSubToken {
  /** The maximum time, in minutes, for which the access token will be valid. Between 1 and 43,200 (30 days). */
  ttl: number;
  /** Each channel with `write` and `read` objects with boolean as values. Max of 500 channels inside main `channels`. */
  channels: PubSubChannels;
  /** The unique identifier of the member. Up to 250 characters. If not specified, a random UUID will be generated. */
  member_id?: string;
  /** An arbitrary JSON object available to store stateful application information in. Must be valid JSON and have a maximum size of 2,000 characters. */
  state?: PubSubState;
}

/** User-defined channel names. Each channel is an object with `read` and/or `write` properties. */
export type PubSubChannels = Record<string, PubSubPermissionWithRead | PubSubPermissionWithWrite>;

export interface PubSubPermissionWithRead {
  /** Gives the token read access to the channel. */
  read: boolean;
  /** Gives the token write access to the channel. */
  write?: boolean;
}

export interface PubSubPermissionWithWrite {
  /** Gives the token read access to the channel. */
  read?: boolean;
  /** Gives the token write access to the channel. */
  write: boolean;
}

/** An arbitrary JSON object available to store stateful application information in. Must be valid JSON and have a maximum size of 2,000 characters. */
export type PubSubState = Record<string, Record<string, unknown>>;

export interface PubSubToken {
  /** A PubSub Token to be used to authenticate clients to the PubSub Service. */
  token: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface PubSubToken422Error {
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

/** An internal server error occurred. */
export interface Types_StatusCodes_StatusCode500 {
  error: 'Internal Server Error';
}
