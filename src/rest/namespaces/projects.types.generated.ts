// AUTO-GENERATED from porting-sdk/rest-apis/projects/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** A project or subproject within the caller's project tree. */
export interface Project {
  /** Project identifier. */
  id: string;
  /** Project name. */
  name: string;
  /** The root project's ID; `null` for a root project. */
  parent_project_id: string | null;
  /** `true` if this project is a subproject. */
  subproject: boolean;
  /** Effective region preference. Returned in all responses; not currently settable via this API. */
  region_preference: string;
  protect_recordings: boolean;
  protect_message_media: boolean;
  protect_fax_media: boolean;
  force_https_requests: boolean;
  created_at: string;
  updated_at: string;
}

/** A project as returned by create and signing-key rotate, including the signing key. */
export type ProjectWithSigningKey = Project & {
  /** The project's signing key. Only returned on create and rotate; not retrievable afterward. */
  signing_key: string;
};

/** Request body for creating a subproject. */
export interface ProjectCreate {
  /** Project name. **Required.** Max 250 characters. */
  name: string;
  protect_recordings?: boolean;
  protect_message_media?: boolean;
  protect_fax_media?: boolean;
  force_https_requests?: boolean;
}

/** Request body for updating a project's name and settings. */
export type ProjectUpdate = ProjectCreate;

/** A page of projects. */
export interface ProjectList {
  links: {
    self: string;
    first: string;
    /** Present only when more results exist. */
    next?: string;
    /** Present only when a previous page exists. */
    prev?: string;
  };
  data: Project[];
}

/** The request contains invalid parameters or violates a business rule. See errors for details. */
export interface ProjectStatusCode422 {
  /** List of validation or business-rule errors. */
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
  /** The request parameter that caused the error, or null for project-level errors. */
  attribute?: string | null;
  /** A link to documentation about this error. */
  url: string;
}

/** Access is unauthorized. */
export interface Types_StatusCodes_StatusCode401 {
  error: 'Unauthorized';
}

/** The API token lacks the required `Management` scope. */
export interface Types_StatusCodes_StatusCode403 {
  error: 'Forbidden';
}

/** The server cannot find the requested resource. */
export interface Types_StatusCodes_StatusCode404 {
  error: 'Not Found';
}
