// AUTO-GENERATED from porting-sdk/rest-apis/datasphere/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

export interface Chunk {
  /** A search result. */
  text: string;
  /** Unique ID of the Document. */
  document_id: docid;
}

export interface ChunkListResponse {
  /** A list of chunks. */
  data: ChunkResponse[];
  /** Pagination links. */
  links: ChunkPaginationResponse;
}

export interface ChunkPaginationResponse {
  /** Link of the current page. */
  self: string;
  /** Link to the first page. */
  first: string;
  /** Link to the next page. Only present when there are more results. */
  next?: string;
  /** Link to the previous page. Only present when not on the first page. */
  prev?: string;
}

export interface ChunkResponse {
  /** Unique ID of the chunk. */
  id: uuid;
  /** Unique ID of the chunk's datasphere document. */
  datasphere_document_id: uuid;
  /** Unique ID of the project. */
  project_id: uuid;
  /** Status of the chunk. */
  status: ChunkStatus;
  /** The tags of the document associated with the chunk. */
  tags: string[];
  /** Content of the chunk. */
  content: string;
  /** Chunk Creation Date. */
  created_at: string;
  /** Chunk Update Date. */
  updated_at: string;
}

/** The current Status of the Chunk. */
export type ChunkStatus = 'submitted' | 'in_progress' | 'completed' | 'failed';

/** Strategy to use when chunking the document. */
export type ChunkingStrategy = 'sentence' | 'paragraph' | 'page' | 'sliding';

/** The request contains invalid parameters. See errors for details. */
export interface CreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface Document {
  /** Unique ID of the Document. */
  id: docid;
  /** Name of the Document. */
  filename: string;
  /** Status of the Document. */
  status: DocumentStatus;
  /** Document tags. */
  tags: string[];
  /** Strategy used to chunk the document. */
  chunking_strategy: ChunkingStrategy;
  /** Max Sentences per Chunk. Only present when chunking strategy is 'sentence', null otherwise. */
  max_sentences_per_chunk: number | null;
  /** Split on Newlines. Only present when chunking strategy is 'sentence', null otherwise. */
  split_newlines: boolean | null;
  /** Overlap Size. Only present when chunking strategy is 'sliding', null otherwise. */
  overlap_size: number | null;
  /** Chunk Size. Only present when chunking strategy is 'sliding', null otherwise. */
  chunk_size: number | null;
  /** Number of Chunks in the Document. */
  number_of_chunks: number;
  /** URI path to the chunks for this document. */
  chunks_uri: string;
  /** Document Creation Date. */
  created_at: string;
  /** Document Update Date. */
  updated_at: string;
}

export type DocumentCreatePageRequest = DocumentCreateRequestBase;

export type DocumentCreateParagraphRequest = DocumentCreateRequestBase;

export type DocumentCreateRequest =
  | DocumentCreateSentenceRequest
  | DocumentCreateSlidingRequest
  | DocumentCreatePageRequest
  | DocumentCreateParagraphRequest;

export interface DocumentCreateRequestBase {
  /** URL of the document. */
  url: string;
  /** Document tags. */
  tags?: string[];
}

export type DocumentCreateSentenceRequest = DocumentCreateRequestBase;

export type DocumentCreateSlidingRequest = DocumentCreateRequestBase;

export interface DocumentListResponse {
  /** A list of documents. */
  data: Document[];
  /** Pagination links. */
  links: PaginationResponse;
}

export interface DocumentSearchRequest {
  /** Document tags. */
  tags?: string[];
  /** Unique ID of a Document. */
  document_id?: docid;
  /** Search term. */
  query_string: string;
  /** Specifies how closely related the query is to the document. Low distance means high relevance and similarity. High distance means low relevance and similarity. */
  distance?: number;
  /** Specifies number of returned Chunks. */
  count?: number;
  /** Language of the Document. */
  language?: string;
  /** Part of Speech considered for expansion or analysis. */
  pos_to_expand?: string[];
  /** Maximum number of synonyms to consider. */
  max_synonyms?: number;
}

/** The current Status of the Document. */
export type DocumentStatus = 'submitted' | 'in_progress' | 'completed' | 'failed';

export interface DocumentUpdateRequest {
  /** Document tags. */
  tags: string[];
}

/** The request contains invalid parameters. See errors for details. */
export interface ListStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface PaginationResponse {
  /** Link of the current page. */
  self: string;
  /** Link to the first page. */
  first: string;
  /** Link to the next page. Only present when there are more results. */
  next?: string;
  /** Link to the previous page. Only present when not on the first page. */
  prev?: string;
}

export interface SearchResponse {
  /** A list of search result chunks. */
  chunks: Chunk[];
}

/** The request contains invalid parameters. See errors for details. */
export interface SearchStatusCode422 {
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

/** The server cannot find the requested resource. */
export interface Types_StatusCodes_StatusCode404 {
  error: 'Not Found';
}

/** An internal server error occurred. */
export interface Types_StatusCodes_StatusCode500 {
  error: 'Internal Server Error';
}

/** The request contains invalid parameters. See errors for details. */
export interface UpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** Unique ID of a Document. */
export type docid = string;

/** Universal Unique Identifier. */
export type uuid = string;
