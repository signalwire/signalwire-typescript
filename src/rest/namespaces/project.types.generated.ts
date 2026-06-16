// AUTO-GENERATED from porting-sdk/rest-apis/project/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** Request body for creating a new API Token. */
export interface CreateTokenRequest {
  /** The name representing the API token. */
  name: string;
  /** The permissions you would like to enable for this token. Valid permissions are calling, chat, datasphere, fax, management, messaging, numbers, pubsub, storage, tasking, and video */
  permissions: TokenPermission[];
  /** The unique identifier of the subproject you would like to create a token for. The subproject passed must be a child of the project used to authenticate the request. */
  subproject_id?: string;
}

/** Valid permission types for API tokens. */
export type TokenPermission =
  | 'calling'
  | 'chat'
  | 'datasphere'
  | 'fax'
  | 'management'
  | 'messaging'
  | 'numbers'
  | 'pubsub'
  | 'storage'
  | 'tasking'
  | 'video';

export interface TokenResponse {
  /** The ID of the created API Token. */
  id: string;
  /** The name of the created API Token. */
  name: string;
  /** The permissions enabled for this token. */
  permissions: TokenPermission[];
  /** The API token that can be used along with the project ID for basic authentication */
  token: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface TokenStatusCode422 {
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

/** Request body for updating an API Token. */
export interface UpdateTokenRequest {
  /** The name representing the API token. */
  name?: string;
  /** The permissions you would like to enable for this token. Valid permissions are calling, chat, datasphere, fax, management, messaging, numbers, pubsub, storage, tasking, and video */
  permissions?: TokenPermission[];
}

export type CreateTokenResponse = TokenResponse;

export type UpdateTokenResponse = TokenResponse;
