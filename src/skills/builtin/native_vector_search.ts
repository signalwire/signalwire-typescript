/**
 * Native Vector Search Skill - Document search over a local or remote index.
 *
 * Port of the Python `NativeVectorSearchSkill`. Supports three backends in
 * Python (SQLite `.swsearch`, PostgreSQL `pgvector`, and a remote HTTP
 * search server). This TypeScript implementation provides:
 *
 * - In-memory TF-IDF search over `documents` passed via config (fast path
 *   that needs no additional deps), and
 * - Remote HTTP search via a configured `remote_url` (compatible with the
 *   Python SDK's `sw-search` remote protocol).
 *
 * The SQLite/pgvector backends require native Python dependencies and are
 * not available here; their schema entries are preserved so configuration
 * written for the Python SDK remains valid.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import type { AgentBase } from '../../AgentBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { getLogger } from '../../Logger.js';

const log = getLogger('NativeVectorSearchSkill');

/**
 * Callback signature for customizing the formatted search response.
 *
 * The context object is the TypeScript idiom for Python's positional-args
 * convention: `(response, agent, query, results, args)`. All Python fields are
 * present plus TS-specific additions (`count`, `skill`):
 *
 * - `response`  — pre-formatted response string (same as Python arg 1)
 * - `agent`     — the AgentBase instance that owns this skill (same as Python arg 2)
 * - `query`     — the search query string (same as Python arg 3)
 * - `results`   — array of search results (same as Python arg 4)
 * - `args`      — raw tool call arguments (same as Python arg 5)
 * - `count`     — requested result count (TS addition)
 * - `skill`     — this skill instance (TS addition)
 */
export type ResponseFormatCallback = (ctx: {
  response: string;
  /** The AgentBase instance that owns this skill. Equivalent to Python's `agent` positional arg. */
  agent?: AgentBase;
  query: string;
  results: Array<{ content: string; score: number; metadata: Record<string, unknown>; tags?: string[] }>;
  args: Record<string, unknown>;
  count: number;
  skill: NativeVectorSearchSkill;
}) => string;

/** A document entry in the in-memory search index. */
interface DocumentEntry {
  /** Unique document identifier. */
  id: string;
  /** Full text content of the document. */
  text: string;
  /** Optional metadata associated with the document. */
  metadata?: Record<string, unknown>;
  /** Optional tags for filtering. */
  tags?: string[];
}

/** A single search result in normalized form. */
interface SearchResult {
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  tags?: string[];
}

/**
 * Tokenize text into lowercase words, removing punctuation and common stop words.
 */
function tokenize(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
    'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
    'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
    'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
    'it', 'its', 'they', 'them', 'their', 'about', 'up', 'out',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  const len = tokens.length || 1;
  for (const [term, count] of tf) {
    tf.set(term, count / len);
  }
  return tf;
}

function inverseDocumentFrequency(corpus: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const numDocs = corpus.length || 1;
  const docFreq = new Map<string, number>();
  for (const tokens of corpus) {
    const unique = new Set(tokens);
    for (const t of unique) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }
  for (const [term, freq] of docFreq) {
    idf.set(term, Math.log((numDocs + 1) / (freq + 1)) + 1);
  }
  return idf;
}

function scoreTfIdf(
  queryTokens: string[],
  docTf: Map<string, number>,
  idf: Map<string, number>,
): number {
  if (queryTokens.length === 0) return 0;
  let score = 0;
  const queryTf = termFrequency(queryTokens);
  for (const [term, qWeight] of queryTf) {
    const docWeight = docTf.get(term) ?? 0;
    const idfWeight = idf.get(term) ?? 1;
    score += qWeight * docWeight * idfWeight * idfWeight;
  }
  return score;
}

/**
 * Document search using TF-IDF in-memory scoring or a remote search server.
 *
 * Multi-instance capable (distinguished by `tool_name` + `index_file`).
 */
export class NativeVectorSearchSkill extends SkillBase {
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tool_name: {
        type: 'string',
        description: 'Custom tool name for this vector search instance.',
        default: 'search_knowledge',
        required: false,
      },
      index_file: {
        type: 'string',
        description:
          'Path to .swsearch index file (SQLite backend only). Use this for local file-based search',
        required: false,
      },
      build_index: {
        type: 'boolean',
        description: 'Whether to build index from source files',
        default: false,
        required: false,
      },
      source_dir: {
        type: 'string',
        description:
          'Directory containing documents to index (required if build_index=True)',
        required: false,
      },
      remote_url: {
        type: 'string',
        description:
          'URL of remote search server for network mode (e.g., http://localhost:8001)',
        required: false,
      },
      index_name: {
        type: 'string',
        description:
          'Name of index on remote server (network mode only, used with remote_url)',
        default: 'default',
        required: false,
      },
      count: {
        type: 'integer',
        description: 'Number of search results to return',
        default: 5,
        required: false,
        min: 1,
        max: 20,
      },
      similarity_threshold: {
        type: 'number',
        description:
          'Minimum similarity score for results (0.0 = no limit, 1.0 = exact match)',
        default: 0.0,
        required: false,
        min: 0.0,
        max: 1.0,
      },
      tags: {
        type: 'array',
        description: 'Tags to filter search results',
        default: [],
        required: false,
        items: { type: 'string' },
      },
      global_tags: {
        type: 'array',
        description: 'Tags to apply to all indexed documents',
        default: [],
        required: false,
        items: { type: 'string' },
      },
      file_types: {
        type: 'array',
        description: 'File extensions to include when building index',
        default: ['md', 'txt', 'pdf', 'docx', 'html'],
        required: false,
        items: { type: 'string' },
      },
      exclude_patterns: {
        type: 'array',
        description: 'Patterns to exclude when building index',
        default: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
        ],
        required: false,
        items: { type: 'string' },
      },
      no_results_message: {
        type: 'string',
        description: 'Message when no results are found',
        default: "No information found for '{query}'",
        required: false,
      },
      response_prefix: {
        type: 'string',
        description: 'Prefix to add to search results',
        default: '',
        required: false,
      },
      response_postfix: {
        type: 'string',
        description: 'Postfix to add to search results',
        default: '',
        required: false,
      },
      max_content_length: {
        type: 'integer',
        description:
          'Maximum total response size in characters (distributed across all results)',
        default: 32768,
        required: false,
        min: 1000,
      },
      response_format_callback: {
        type: 'object',
        description:
          'Optional callback function to format/transform the response.',
        required: false,
      },
      description: {
        type: 'string',
        description: 'Tool description',
        default: 'Search the knowledge base for information',
        required: false,
      },
      hints: {
        type: 'array',
        description: 'Speech recognition hints',
        default: [],
        required: false,
        items: { type: 'string' },
      },
      nlp_backend: {
        type: 'string',
        description: 'NLP backend for query processing (deprecated)',
        default: 'basic',
        required: false,
        enum: ['basic', 'spacy', 'nltk'],
      },
      query_nlp_backend: {
        type: 'string',
        description: 'NLP backend for query expansion',
        required: false,
        enum: ['basic', 'spacy', 'nltk'],
      },
      index_nlp_backend: {
        type: 'string',
        description: 'NLP backend for indexing',
        required: false,
        enum: ['basic', 'spacy', 'nltk'],
      },
      backend: {
        type: 'string',
        description:
          "Storage backend for local database mode: 'sqlite' or 'pgvector'. Ignored if remote_url is set",
        default: 'sqlite',
        required: false,
        enum: ['sqlite', 'pgvector'],
      },
      connection_string: {
        type: 'string',
        description: 'PostgreSQL connection string (pgvector backend only)',
        required: false,
      },
      collection_name: {
        type: 'string',
        description: 'Collection/table name in PostgreSQL (pgvector backend only)',
        required: false,
      },
      verbose: {
        type: 'boolean',
        description: 'Enable verbose logging',
        default: false,
        required: false,
      },
      keyword_weight: {
        type: 'number',
        description:
          'Manual keyword weight (0.0-1.0). Overrides automatic weight detection',
        required: false,
        min: 0.0,
        max: 1.0,
      },
      model_name: {
        type: 'string',
        description: 'Embedding model to use',
        default: 'mini',
        required: false,
      },
      overwrite: {
        type: 'boolean',
        description: 'Overwrite existing pgvector collection when building index',
        default: false,
        required: false,
      },
      documents: {
        type: 'array',
        description:
          'In-memory array of documents to index: [{ id, text, metadata?, tags? }] (TS-specific)',
        required: false,
        items: { type: 'object' },
      },
    };
  }

  // Runtime state
  private toolName = 'search_knowledge';
  private backend = 'sqlite';
  private indexFile: string | undefined;
  private remoteUrl: string | undefined;
  private indexName = 'default';
  private count = 5;
  private similarityThreshold = 0.0;
  private filterTags: string[] = [];
  private noResultsMessage = "No information found for '{query}'";
  private responsePrefix = '';
  private responsePostfix = '';
  private maxContentLength = 32768;
  private responseFormatCallback: ResponseFormatCallback | undefined;
  private description = 'Search the knowledge base for information';
  private verbose = false;
  /** Hybrid scoring weight: 0.0 = pure TF-IDF, 1.0 = pure keyword overlap. */
  private keywordWeight = 0.0;
  private searchAvailable = false;
  private useRemote = false;
  private remoteBaseUrl: string | undefined;
  private remoteAuth: { user: string; pass: string } | undefined;

  // In-memory index state
  private _documents: DocumentEntry[] = [];
  private _tokenizedDocs: string[][] = [];
  private _docTfs: Map<string, number>[] = [];
  private _idf: Map<string, number> = new Map();
  private _indexed = false;

  /**
   * @param config - Optional configuration (see `getParameterSchema()`).
   */
  constructor(config?: SkillConfig) {
    super('native_vector_search', config);
  }

  override getInstanceKey(): string {
    const toolName = this.getConfig<string>('tool_name', 'search_knowledge');
    const indexFile = this.getConfig<string>('index_file', 'default');
    return `${this.skillName}_${toolName}_${indexFile}`;
  }

  override async setup(): Promise<boolean> {
    // Config
    this.toolName = this.getConfig<string>('tool_name', 'search_knowledge');
    this.backend = this.getConfig<string>('backend', 'sqlite');
    this.indexFile = this.getConfig<string | undefined>('index_file', undefined);
    this.count = this.getConfig<number>('count', 5);
    this.similarityThreshold = this.getConfig<number>('similarity_threshold', 0.0);
    this.filterTags = this.getConfig<string[]>('tags', []) ?? [];
    this.noResultsMessage = this.getConfig<string>(
      'no_results_message',
      "No information found for '{query}'",
    );
    this.responsePrefix = this.getConfig<string>('response_prefix', '');
    this.responsePostfix = this.getConfig<string>('response_postfix', '');
    this.maxContentLength = this.getConfig<number>('max_content_length', 32768);
    this.responseFormatCallback = this.getConfig<ResponseFormatCallback | undefined>(
      'response_format_callback',
      undefined,
    );
    this.description = this.getConfig<string>(
      'description',
      'Search the knowledge base for information',
    );
    this.verbose = this.getConfig<boolean>('verbose', false);
    this.keywordWeight = Math.min(
      1.0,
      Math.max(0.0, this.getConfig<number>('keyword_weight', 0.0)),
    );

    // Remote search configuration
    this.remoteUrl = this.getConfig<string | undefined>('remote_url', undefined);
    this.indexName = this.getConfig<string>('index_name', 'default');

    // Parse auth from URL if present
    if (this.remoteUrl) {
      try {
        const parsed = new URL(this.remoteUrl);
        if (parsed.username && parsed.password) {
          this.remoteAuth = {
            user: decodeURIComponent(parsed.username),
            pass: decodeURIComponent(parsed.password),
          };
          parsed.username = '';
          parsed.password = '';
          this.remoteBaseUrl = parsed.toString().replace(/\/+$/, '');
        } else {
          this.remoteBaseUrl = this.remoteUrl.replace(/\/+$/, '');
        }
      } catch {
        this.remoteBaseUrl = this.remoteUrl;
      }
    }

    // Remote mode — validate and skip heavy local setup
    if (this.remoteUrl) {
      this.useRemote = true;
      try {
        const response = await this._fetchWithAuth(
          `${this.remoteBaseUrl}/health`,
          { method: 'GET' },
        );
        if (response.status === 200) {
          log.info('native_vector_search: remote server available', {
            url: this.remoteBaseUrl,
          });
          this.searchAvailable = true;
          return true;
        }
        if (response.status === 401) {
          log.error('native_vector_search: remote auth failed');
        } else {
          log.error('native_vector_search: remote server returned non-200', {
            status: response.status,
          });
        }
        this.searchAvailable = false;
      } catch (err) {
        log.error('native_vector_search: failed to connect to remote', {
          error: err instanceof Error ? err.message : String(err),
        });
        this.searchAvailable = false;
      }
      return this.searchAvailable;
    }

    // Local / in-memory mode
    this.useRemote = false;
    this._loadDocuments();
    this.searchAvailable = this._indexed;

    if (this.verbose) {
      log.info('native_vector_search: local index loaded', {
        docCount: this._documents.length,
        indexed: this._indexed,
      });
    }
    return this.searchAvailable;
  }

  override getHints(): string[] {
    const hints = ['search', 'find', 'look up', 'documentation', 'knowledge base'];
    const extra = this.getConfig<string[]>('hints', []) ?? [];
    return [...hints, ...extra];
  }

  override getGlobalData(): Record<string, unknown> {
    const globalData: Record<string, unknown> = {};
    if (this._indexed) {
      globalData['search_stats'] = {
        doc_count: this._documents.length,
        backend: this.useRemote ? 'remote' : this.backend,
      };
    }
    return globalData;
  }

  override async cleanup(): Promise<void> {
    this._documents = [];
    this._tokenizedDocs = [];
    this._docTfs = [];
    this._idf = new Map();
    this._indexed = false;
  }

  /** @returns Manifest for the native vector search skill. */
  getManifest(): SkillManifest {
    return {
      name: 'native_vector_search',
      description:
        'Search document indexes using vector similarity and keyword search (local or remote)',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['search', 'vector', 'tfidf', 'documents', 'local', 'knowledge'],
    };
  }

  /**
   * Load and TF-IDF-index documents from config.
   * Applies `global_tags` to every document's tag list.
   */
  private _loadDocuments(): void {
    const docs = this.getConfig<DocumentEntry[]>('documents', []) ?? [];
    const globalTags = this.getConfig<string[]>('global_tags', []) ?? [];

    if (!Array.isArray(docs) || docs.length === 0) {
      this._documents = [];
      this._indexed = false;
      return;
    }

    this._documents = docs
      .filter(
        (d) =>
          d &&
          typeof d.id === 'string' &&
          typeof d.text === 'string' &&
          d.text.trim().length > 0,
      )
      .map((d) => ({
        ...d,
        tags: Array.from(new Set([...(d.tags ?? []), ...globalTags])),
      }));

    this._tokenizedDocs = this._documents.map((doc) => tokenize(doc.text));
    this._docTfs = this._tokenizedDocs.map((tokens) => termFrequency(tokens));
    this._idf = inverseDocumentFrequency(this._tokenizedDocs);
    this._indexed = this._documents.length > 0;
  }

  /** @returns A single search tool using the configured `tool_name` (default `search_knowledge`). */
  getTools(): SkillToolDefinition[] {
    const toolName = this.getConfig<string>('tool_name', 'search_knowledge');
    const defaultCount = this.getConfig<number>('count', 5);
    const description = this.getConfig<string>(
      'description',
      'Search the knowledge base for information',
    );

    return [
      {
        name: toolName,
        description,
        parameters: {
          query: {
            type: 'string',
            description: 'Search query or question',
          },
          count: {
            type: 'integer',
            description: `Number of results to return (default: ${defaultCount})`,
            default: defaultCount,
          },
        },
        required: ['query'],
        handler: async (
          args: Record<string, unknown>,
          rawData: Record<string, unknown>,
        ) => this._searchHandler(args, rawData),
      },
    ];
  }

  /** @returns Prompt section describing the local document search capabilities. */
  protected override _getPromptSections(): SkillPromptSection[] {
    const toolName = this.getConfig<string>('tool_name', 'search_knowledge');
    const docCount = this._documents.length;
    const mode = this.useRemote ? 'remote search server' : 'local document indexes';

    return [
      {
        title: 'Knowledge Search',
        body: `You can search ${mode} using the ${toolName} tool${docCount > 0 ? ` over ${docCount} indexed document(s)` : ''}.`,
        bullets: [
          `Use the ${toolName} tool when users ask questions about topics that might be in the indexed documents`,
          'Search for relevant information using clear, specific queries',
          'Provide helpful summaries of the search results',
          'If no results are found, suggest the user try rephrasing their question or try another knowledge source',
        ],
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  private async _searchHandler(
    args: Record<string, unknown>,
    _rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    if (!this.searchAvailable && !this.useRemote) {
      // In-memory path — we should still be usable if docs were loaded synchronously
      // (constructor path); otherwise report unavailability.
      if (!this._indexed || this._documents.length === 0) {
        return new FunctionResult(
          'No documents are loaded for searching. Configure the skill with a "documents" array or a "remote_url".',
        );
      }
    }

    const query =
      typeof args['query'] === 'string' ? (args['query'] as string).trim() : '';
    if (!query) {
      return new FunctionResult('Please provide a search query.');
    }

    const count = Math.max(
      1,
      Math.min(20, (args['count'] as number | undefined) ?? this.count),
    );

    let results: SearchResult[] = [];
    try {
      if (this.useRemote) {
        results = await this._searchRemote(query, count);
      } else {
        results = this._searchLocal(query, count);
      }
    } catch (err) {
      log.error('native_vector_search: search error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return new FunctionResult(
        "I'm sorry, I encountered an issue while searching. Please try rephrasing your question.",
      );
    }

    if (results.length === 0) {
      let msg = this.noResultsMessage.replace('{query}', query);
      if (this.responsePrefix) msg = `${this.responsePrefix} ${msg}`;
      if (this.responsePostfix) msg = `${msg} ${this.responsePostfix}`;

      if (typeof this.responseFormatCallback === 'function') {
        try {
          const formatted = this.responseFormatCallback({
            response: msg,
            agent: this.agent,
            query,
            results: [],
            args,
            count,
            skill: this,
          });
          if (typeof formatted === 'string') msg = formatted;
        } catch (err) {
          log.error(
            'native_vector_search: response_format_callback error (no results)',
            { error: err instanceof Error ? err.message : String(err) },
          );
        }
      }
      return new FunctionResult(msg);
    }

    // Compose formatted response with per-result truncation
    const responseParts: string[] = [];
    if (this.responsePrefix) responseParts.push(this.responsePrefix);
    responseParts.push(`Found ${results.length} relevant results for '${query}':\n`);

    const estimatedOverheadPerResult = 300;
    const prefixPostfixOverhead =
      this.responsePrefix.length + this.responsePostfix.length + 100;
    const totalOverhead =
      results.length * estimatedOverheadPerResult + prefixPostfixOverhead;
    const available = this.maxContentLength - totalOverhead;
    const perResultLimit =
      results.length > 0
        ? Math.max(500, Math.floor(available / results.length))
        : 1000;

    results.forEach((r, i) => {
      const filename =
        (r.metadata['filename'] as string | undefined) ?? `result-${i + 1}`;
      const section = (r.metadata['section'] as string | undefined) ?? '';
      const score = r.score;
      let content = r.content;
      if (content.length > perResultLimit) {
        content = content.slice(0, perResultLimit) + '...';
      }
      const tags = r.tags ?? (r.metadata['tags'] as string[] | undefined) ?? [];

      let text = `**Result ${i + 1}** (from ${filename}`;
      if (section) text += `, section: ${section}`;
      if (tags.length > 0) text += `, tags: ${tags.join(', ')}`;
      text += `, relevance: ${score.toFixed(2)})\n${content}\n`;
      responseParts.push(text);
    });

    if (this.responsePostfix) responseParts.push(this.responsePostfix);

    let response = responseParts.join('\n');

    if (typeof this.responseFormatCallback === 'function') {
      try {
        const formatted = this.responseFormatCallback({
          response,
          agent: this.agent,
          query,
          results,
          args,
          count,
          skill: this,
        });
        if (typeof formatted === 'string') {
          response = formatted;
        } else {
          log.warn(
            'native_vector_search: response_format_callback returned non-string',
          );
        }
      } catch (err) {
        log.error('native_vector_search: response_format_callback error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new FunctionResult(response);
  }

  private _searchLocal(query: string, count: number): SearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const weight = this.keywordWeight;
    const scored = this._documents.map((doc, i) => {
      const tfidf = scoreTfIdf(queryTokens, this._docTfs[i], this._idf);
      let score: number;
      if (weight > 0) {
        // Keyword-overlap component: fraction of unique query terms present in doc.
        // Mirrors Python: `keyword_weight=self.keyword_weight` passed to
        // `search_engine.search()` for hybrid TF-IDF + keyword scoring.
        const docTokenSet = new Set(this._tokenizedDocs[i]);
        const uniqueQueryTokens = new Set(queryTokens);
        let matches = 0;
        for (const t of uniqueQueryTokens) {
          if (docTokenSet.has(t)) matches++;
        }
        const keywordOverlap = uniqueQueryTokens.size > 0 ? matches / uniqueQueryTokens.size : 0;
        score = tfidf * (1 - weight) + keywordOverlap * weight;
      } else {
        score = tfidf;
      }
      return { doc, score };
    });

    const filtered = scored
      .filter((s) => s.score > this.similarityThreshold)
      .filter((s) => {
        if (this.filterTags.length === 0) return true;
        const docTags = s.doc.tags ?? [];
        return this.filterTags.some((t) => docTags.includes(t));
      });

    filtered.sort((a, b) => b.score - a.score);

    return filtered.slice(0, count).map(({ doc, score }) => ({
      content: doc.text,
      score,
      metadata: {
        filename: doc.id,
        ...(doc.metadata ?? {}),
        tags: doc.tags ?? [],
      },
      tags: doc.tags ?? [],
    }));
  }

  /** Perform search against a remote search server. */
  private async _searchRemote(
    query: string,
    count: number,
  ): Promise<SearchResult[]> {
    if (!this.remoteBaseUrl) return [];

    try {
      const body = {
        query,
        index_name: this.indexName,
        count,
        similarity_threshold: this.similarityThreshold,
        tags: this.filterTags,
      };

      const response = await this._fetchWithAuth(
        `${this.remoteBaseUrl}/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (response.status !== 200) {
        log.error('native_vector_search: remote search failed', {
          status: response.status,
        });
        return [];
      }
      const data = (await response.json()) as {
        results?: Array<{
          content: string;
          score: number;
          metadata: Record<string, unknown>;
          tags?: string[];
        }>;
      };
      return (data.results ?? []).map((r) => ({
        content: r.content,
        score: r.score,
        metadata: r.metadata,
        tags: r.tags,
      }));
    } catch (err) {
      log.error('native_vector_search: remote search error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /** Fetch wrapper that injects Basic auth if configured. */
  private async _fetchWithAuth(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (this.remoteAuth) {
      const creds = Buffer.from(
        `${this.remoteAuth.user}:${this.remoteAuth.pass}`,
      ).toString('base64');
      headers['Authorization'] = `Basic ${creds}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      return await fetch(url, { ...init, headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Factory function for creating NativeVectorSearchSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new NativeVectorSearchSkill instance.
 */
export function createSkill(config?: SkillConfig): NativeVectorSearchSkill {
  return new NativeVectorSearchSkill(config);
}
