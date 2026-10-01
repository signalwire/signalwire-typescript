// AUTO-GENERATED from porting-sdk/rest-apis/projects/openapi.enriched.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** A project or subproject within the caller's project tree. */
export interface Project {
  /** The unique identifier of the project. */
  id: string;
  /** The name of the project. */
  name: string;
  /** The unique identifier of the root project. `null` when this project is itself a root project. */
  parent_project_id: string | null;
  /** `true` when this project is a subproject. */
  subproject: boolean;
  /** When enabled, recordings created within the project require authentication to access. */
  protect_recordings: boolean;
  /** When enabled, message media created within the project requires authentication to access. */
  protect_message_media: boolean;
  /** When enabled, fax media created within the project requires authentication to access. */
  protect_fax_media: boolean;
  /** When enabled, requests made to the project's webhooks and callbacks must use HTTPS. */
  force_https_requests: boolean;
  /** The date and time when the project was created. */
  created_at: string;
  /** The date and time when the project was last updated. */
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
  /** When enabled, recordings created within the project require authentication to access. */
  protect_recordings?: boolean;
  /** When enabled, message media created within the project requires authentication to access. */
  protect_message_media?: boolean;
  /** When enabled, fax media created within the project requires authentication to access. */
  protect_fax_media?: boolean;
  /** When enabled, requests made to the project's webhooks and callbacks must use HTTPS. */
  force_https_requests?: boolean;
  /** The parent project for the new subproject. Used under Personal Access Token auth; ignored when authenticating with a project API token. */
  parent_project_id?: string;
}

/** Request body for updating a project's name and settings. */
export interface ProjectUpdate {
  /** Project name. Max 250 characters. Defaults to the current name when omitted. */
  name?: string;
  protect_recordings?: boolean;
  protect_message_media?: boolean;
  protect_fax_media?: boolean;
  force_https_requests?: boolean;
}

/** A page of projects. */
export interface ProjectList {
  /** Pagination links for the list of projects. */
  links: {
    /** The link to the current page. */
    self: string;
    /** The link to the first page. */
    first: string;
    /** The link to the next page. Only present when more results exist. */
    next?: string;
    /** The link to the previous page. Only present when a previous page exists. */
    prev?: string;
  };
  /** The projects on this page. */
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
