/**
 * InfoBotKnowledge: what an agent can answer from a corpus, governed and
 * grounded, beside what `Operations` can change.
 */

import type { AgentBase } from '../../AgentBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { Field } from '../model.js';
import { _Wording as Wording } from '../wording.js';

/** One search result: at least a `content` string and a `score`. */
export type Result = Record<string, unknown>;

/** A result's label line above its passage, or null for none. */
export type ResultLabel = (result: Result) => string | null | undefined;

/** A result's ranking tier: higher ranks first among the results not demoted; null is 0. */
export type ResultTier = (result: Result) => number | null | undefined;

/** A search backend: `search(query)` returns the raw results; it may be async. */
export type SearchFunction = (query: string) => Result[] | Promise<Result[]>;

/** Every key `InfoBotKnowledge`'s words come from, with its default. */
export const KNOWLEDGE_WORDING: Readonly<Record<string, string>> = Object.freeze({
  'tool.search': '{description} Changes nothing.',
  'tool.search.query': "What to look up, in the caller's words.",
  'tool.search.query_type': 'The kind of lookup.',
  'search.no_query': 'Ask them what to look up - there was no query.',
  'search.unconfigured': "Search isn't configured.",
  'search.not_covered': 'The results do not cover it.',
  'step.section': 'Knowledge',
  'step.text': "Answer the caller's question from {tool}, not memory.",
  'tool.contact':
    "Record the caller's contact details for a human follow-up. Call this only after they " +
    'have agreed they would like someone to follow up.',
  'contact.ask': 'Ask them for {field}.',
  'contact.any_of': 'Ask them for {choices}.',
  'contact.thanks': "Thanks - I've passed that along and someone will follow up.",
  'list.and': ' and ',
  'list.or': ' or ',
  'list.comma': ', ',
});

/** The contact tool's fields unless `contactFields` replaces them. */
export const CONTACT_FIELDS: Readonly<Record<string, Field>> = Object.freeze({
  name: new Field('string', "The caller's name.", { required: false }),
  email: new Field('string', 'An email address to reach them.', {
    ask: 'Ask them for an email address to reach them at.',
  }),
  topic: new Field('string', 'What they want followed up, in brief.', { required: false }),
});

const GROUNDING =
  'Answer only from these results. If they do not cover it, say so plainly ' +
  '- do not fill the gap from general knowledge.';

/** When a grounding rule goes with the results: with results, with none, or always. */
export type RuleWhen = 'results' | 'empty' | 'always';

/** Options for {@link InfoBotKnowledge}. */
export interface InfoBotKnowledgeOptions {
  /** `search(query)` returns the raw results; it may be async. Or call `useSearchService`. */
  search?: SearchFunction | null;
  /** The search tool's name. Default `search_knowledge`. */
  tool?: string;
  /** What the search tool does, as the model reads it. */
  description?: string;
  /** The most results handed to the model. Default 5. */
  resultLimit?: number;
  /** The line that goes with the results, unless rules are added. */
  grounding?: string;
  /** `contact(fields)` takes the details the contact tool collects; without it there's no contact tool. May be async. */
  contact?: ((fields: Record<string, string>) => unknown) | null;
  /** The contact tool's name. Default `collect_contact`. */
  contactTool?: string;
  /**
   * The contact tool's fields, in place of {@link CONTACT_FIELDS} (name, email
   * and topic). A field's `ask` is what the model is told when it's missing.
   */
  contactFields?: Readonly<Record<string, Field>> | null;
  /**
   * Sets of fields, any one of which is enough, such as `[['email'], ['phone']]`.
   * Defaults to the required fields, all of them.
   */
  contactAnyOf?: readonly (readonly string[])[] | null;
  /** Words in place of the defaults, by key; the keys are those of {@link KNOWLEDGE_WORDING}. */
  wording?: Readonly<Record<string, string>> | null;
  /** The context of the step its tools go in. Default `"default"`. */
  context?: string;
  /** The step its tools go in, made if it isn't there, added to if it is. Default `"main"`. */
  step?: string;
}

/** Options for {@link InfoBotKnowledge.useSearchService}. */
export interface SearchServiceOptions {
  /** The service's basic-auth user. */
  user?: string;
  /** The service's basic-auth password. */
  password?: string;
  /** The index to search. Default `"default"`. */
  indexName?: string;
  /** How many results to ask for. Default 10. */
  count?: number;
  /** Seconds to wait for it. Default 10. */
  timeout?: number;
  /** The fetch to use, for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Knowledge search installed on an agent.
 *
 * `search(query)` returns the raw results (each with at least a `content`
 * string and a `score`); the layer governs them (drops some, ranks some last,
 * labels each) and hands the model one grounded block. The backend stays
 * yours (pgvector, HTTP, DataSphere), and the policy is optional hooks, so
 * nothing about a particular corpus is baked in here:
 *
 * - `setExclude(fn)`: `fn(result, query)` true drops the result.
 * - `setDemote(fn)`: `fn(result)` true ranks it after the rest.
 * - `setResultContext(fn)`: `fn(result)` gives a label line shown above the
 *   passage (authority, kind, title, source url), or null.
 *
 * With `contact` set, a second tool records a caller's details for a human
 * follow-up. Both tools re-enable back-to-back calls on their result, so a
 * refused gate elsewhere in a composed agent does not strand the model
 * one-tool-per-turn.
 *
 * It installs beside `Operations` on one agent, in either order: both add to
 * the same `main` step, which keeps every layer's text and tools.
 */
export class InfoBotKnowledge {
  private searchFn: SearchFunction | null;
  private readonly tool: string;
  private readonly description: string;
  private readonly resultLimit: number;
  private readonly grounding: string;
  private readonly contact: InfoBotKnowledgeOptions['contact'];
  private readonly contactTool: string;
  private readonly contactFields: Record<string, Field>;
  private readonly contactAnyOf: string[][];
  private readonly w: Wording;
  private readonly contextName: string;
  private readonly stepName: string;
  private exclude: ((result: Result, query: string) => boolean) | null = null;
  private demote: ((result: Result) => boolean) | null = null;
  private resultContext: ResultLabel | null = null;
  private readonly rules: [string, RuleWhen][] = [];
  private readonly resultRules: [(query: string, results: Result[]) => boolean, string][] = [];
  private readonly queryTypes: Record<string, string> = {};
  private queryTypeHelp = '';
  private authority: ResultTier | null = null;
  private queryTransform: ((query: string) => string) | null = null;
  private fallback: ((query: string) => string | null | undefined) | null = null;
  private expander: ((results: Result[]) => Result[]) | null = null;

  /**
   * @param opts - `search`, and `tool`, `description`, `resultLimit`,
   *   `grounding`, `contact`, `contactTool`, `contactFields`, `contactAnyOf`,
   *   `wording`, `context` and `step`.
   * @throws {Error} For `contactAnyOf` naming fields there aren't, or wording it can't use.
   */
  constructor(opts: InfoBotKnowledgeOptions = {}) {
    this.searchFn = opts.search ?? null;
    this.tool = opts.tool ?? 'search_knowledge';
    this.description =
      opts.description ?? 'Search the documentation and answer only from the results.';
    this.resultLimit = opts.resultLimit ?? 5;
    this.grounding = opts.grounding ?? GROUNDING;
    this.contact = opts.contact ?? null;
    this.contactTool = opts.contactTool ?? 'collect_contact';
    const given = opts.contactFields;
    // Empty is the defaults, as the reference's `contact_fields or CONTACT_FIELDS` is
    this.contactFields = {
      ...(given && Object.keys(given).length > 0 ? given : CONTACT_FIELDS),
    };
    this.contactAnyOf = (
      opts.contactAnyOf ?? [
        Object.entries(this.contactFields)
          .filter(([, f]) => f.required)
          .map(([k]) => k),
      ]
    ).map((s) => [...s]);
    const unknown = [...new Set(this.contactAnyOf.flat())]
      .filter((k) => !Object.hasOwn(this.contactFields, k))
      .sort();
    if (unknown.length > 0) {
      throw new Error(`contactAnyOf names fields there aren't: ${unknown.join(', ')}`);
    }
    this.w = new Wording(KNOWLEDGE_WORDING, opts.wording, 'InfoBotKnowledge', 'KNOWLEDGE_WORDING');
    this.contextName = opts.context ?? 'default';
    this.stepName = opts.step ?? 'main';
  }

  /** The tools it adds: the search tool, and the contact tool when there's `contact`. */
  get tools(): string[] {
    return [this.tool, ...(this.contact ? [this.contactTool] : [])];
  }

  // ── governance hooks ─────────────────────────────────────────────

  /**
   * Drop a result before the cut when `fn(result, query)` is true.
   * @param fn - The test.
   * @returns This layer.
   */
  setExclude(fn: (result: Result, query: string) => boolean): this {
    this.exclude = fn;
    return this;
  }

  /**
   * Rank a result after all non-demoted ones when `fn(result)` is true.
   * @param fn - The test.
   * @returns This layer.
   */
  setDemote(fn: (result: Result) => boolean): this {
    this.demote = fn;
    return this;
  }

  /**
   * A label line shown above a result's passage; null adds none.
   * @param fn - The label of a result.
   * @returns This layer.
   */
  setResultContext(fn: ResultLabel): this {
    this.resultContext = fn;
    return this;
  }

  /**
   * A ranking tier for a result; higher ranks first among non-demoted ones.
   * @param fn - The tier of a result.
   * @returns This layer.
   */
  setAuthority(fn: ResultTier): this {
    this.authority = fn;
    return this;
  }

  /**
   * Rewrite the SEARCH query (aliases, glossary, stopwords) before it runs;
   * the grounding still uses the caller's own words.
   * @param fn - The rewrite.
   * @returns This layer.
   */
  setQueryTransform(fn: (query: string) => string): this {
    this.queryTransform = fn;
    return this;
  }

  /**
   * Called with the query when nothing clears the cut; its text, if any, is
   * returned in place of the not-covered line (such as a web search).
   * @param fn - The fallback.
   * @returns This layer.
   */
  setFallback(fn: (query: string) => string | null | undefined): this {
    this.fallback = fn;
    return this;
  }

  /**
   * Transform the kept results before they're rendered, such as widening each
   * to its full section.
   * @param fn - The transform.
   * @returns This layer.
   */
  setExpander(fn: (results: Result[]) => Result[]): this {
    this.expander = fn;
    return this;
  }

  /**
   * A grounding line added to the block. With no rules added, the `grounding`
   * line is used as the default.
   * @param text - The line.
   * @param opts - `when`: `"results"` (only when there are results, the
   *   default), `"empty"` (only when there are none), or `"always"`.
   * @returns This layer.
   */
  addRule(text: string, opts: { when?: RuleWhen } = {}): this {
    this.rules.push([text, opts.when ?? 'results']);
    return this;
  }

  /**
   * A line added after the passages when `predicate(query, results)` is true.
   * @param predicate - The test.
   * @param text - The line.
   * @returns This layer.
   */
  addResultRule(predicate: (query: string, results: Result[]) => boolean, text: string): this {
    this.resultRules.push([predicate, text]);
    return this;
  }

  private rulesFor(state: 'results' | 'empty'): string[] {
    const lines = this.rules.filter(([, w]) => w === state || w === 'always').map(([t]) => t);
    return lines.length > 0 ? lines : [this.grounding];
  }

  /**
   * Register a query kind whose `qualifier` is appended to the search query
   * (not the grounding) when the model picks it. Exposes a `query_type`
   * argument on the search tool once any kind is registered.
   * @param kind - The kind.
   * @param qualifier - What's appended.
   * @returns This layer.
   */
  addQueryType(kind: string, qualifier: string): this {
    this.queryTypes[kind] = qualifier;
    return this;
  }

  /**
   * How the model should choose a `query_type` (the argument's description).
   * @param text - The help.
   * @returns This layer.
   */
  setQueryTypeHelp(text: string): this {
    this.queryTypeHelp = text;
    return this;
  }

  /**
   * Use a SignalWire search service at `url` as the backend instead of a
   * hand-written `search` function: an HTTP `POST <url>/search` of
   * `{ query, index_name, count }` (optional basic auth) returning `results`.
   * @param url - The service.
   * @param opts - `user`, `password`, `indexName`, `count`, `timeout` and `fetchImpl`.
   * @returns This layer.
   */
  useSearchService(url: string, opts: SearchServiceOptions = {}): this {
    let endpoint = url.replace(/\/+$/, '');
    if (!endpoint.endsWith('/search')) endpoint += '/search';
    const user = opts.user ?? '';
    const password = opts.password ?? '';
    const indexName = opts.indexName ?? 'default';
    const count = opts.count ?? 10;
    const timeout = opts.timeout ?? 10;
    const fetchImpl = opts.fetchImpl ?? fetch;
    this.searchFn = async (query: string): Promise<Result[]> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user || password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
      }
      const resp = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, index_name: indexName, count }),
        signal: AbortSignal.timeout(timeout * 1000),
      });
      if (!resp.ok) throw new Error(`search service answered ${resp.status} for ${endpoint}`);
      const data: unknown = await resp.json();
      const results =
        typeof data === 'object' && data !== null && !Array.isArray(data)
          ? (data as Record<string, unknown>)['results']
          : data;
      return Array.isArray(results) ? [...(results as Result[])] : [];
    };
    return this;
  }

  // ── install ──────────────────────────────────────────────────────

  /**
   * Add the tools, and the step that offers them.
   * @param agent - The agent.
   * @returns The agent.
   * @throws {Error} Without a search backend.
   */
  install<A extends AgentBase = AgentBase>(agent: A): A {
    if (this.searchFn === null) {
      throw new Error(
        'InfoBotKnowledge needs a search backend: pass search or call ' +
          'useSearchService(...) before install().',
      );
    }
    this.defineSearch(agent);
    if (this.contact) this.defineContact(agent);
    this.ensureMain(agent);
    return agent;
  }

  private defineSearch(agent: AgentBase): void {
    const w = this.w;
    const params: Record<string, unknown> = {
      query: { type: 'string', description: w.say('tool.search.query') },
    };
    if (Object.keys(this.queryTypes).length > 0) {
      params['query_type'] = {
        type: 'string',
        enum: Object.keys(this.queryTypes).sort(),
        description: this.queryTypeHelp || w.say('tool.search.query_type'),
      };
    }
    agent.defineTool({
      name: this.tool,
      description: w.say('tool.search', { description: this.description }),
      parameters: params,
      handler: (args) => this.handleSearch(args),
      required: ['query'],
    });
  }

  /** The caller's query, and the one searched: transformed, with its qualifier. */
  private queryOf(args: Record<string, unknown>): [string, string] {
    const query = String(args['query'] || '').trim();
    // The qualifier aids retrieval only; grounding stays the caller's own words.
    const base = this.queryTransform ? this.queryTransform(query) : query;
    const kind = String(args['query_type'] || '').trim();
    const qualifier = Object.hasOwn(this.queryTypes, kind) ? this.queryTypes[kind] : undefined;
    return [query, qualifier ? `${base} ${qualifier}` : base];
  }

  private async handleSearch(args: Record<string, unknown>): Promise<FunctionResult> {
    const [query, effective] = this.queryOf(args ?? {});
    if (!query) return new FunctionResult(this.w.say('search.no_query'));
    const search = this.searchFn;
    if (search === null) return new FunctionResult(this.w.say('search.unconfigured'));
    const found = await search(effective);
    const blob = this._format(query, [...(found ?? [])]);
    return new FunctionResult(blob).backToBackFunctions('forever');
  }

  private rankKey(r: Result): [number, number, number] {
    const demoted = this.demote && this.demote(r) ? 1 : 0;
    const authority = this.authority ? this.authority(r) || 0 : 0;
    return [demoted, -authority, -scoreOf(r)];
  }

  /** @internal The grounded block for a query's results. */
  _format(query: string, results: Result[]): string {
    let kept = results.filter((r) => !(this.exclude && this.exclude(r, query)));
    // Demoted last; then higher authority; then higher score.
    const keys = new Map(kept.map((r) => [r, this.rankKey(r)]));
    kept.sort((a, b) => compareKeys(keys.get(a)!, keys.get(b)!));
    kept = kept.slice(0, this.resultLimit);
    if (this.expander && kept.length > 0) kept = [...this.expander(kept)];
    if (kept.length === 0) {
      if (this.fallback) {
        // The fallback supplies its own answer from another source, so the
        // "answer only from these results" grounding does not apply.
        const text = this.fallback(query);
        if (text) return String(text);
      }
      return [...this.rulesFor('empty'), this.w.say('search.not_covered')].join('\n\n');
    }
    const blocks = this.rulesFor('results');
    for (const r of kept) {
      const label = this.resultContext ? this.resultContext(r) : null;
      const passage = String(r['content'] || r['text'] || '').trim();
      blocks.push(label ? `${label}\n${passage}` : passage);
    }
    for (const [predicate, text] of this.resultRules) {
      if (predicate(query, kept)) blocks.push(text);
    }
    return blocks.join('\n\n');
  }

  private defineContact(agent: AgentBase): void {
    const sets = this.contactAnyOf;
    const required = Object.keys(this.contactFields).filter(
      (k) => sets.length > 0 && sets.every((s) => s.includes(k)),
    );
    const params: Record<string, unknown> = {};
    for (const [k, f] of Object.entries(this.contactFields)) params[k] = f.schema();
    agent.defineTool({
      name: this.contactTool,
      description: this.w.say('tool.contact'),
      parameters: params,
      handler: (args) => this.handleContact(args),
      ...(required.length > 0 ? { required } : {}),
    });
  }

  private async handleContact(args: Record<string, unknown>): Promise<FunctionResult> {
    const fields: Record<string, string> = {};
    for (const k of Object.keys(this.contactFields)) {
      fields[k] = String((args ?? {})[k] || '').trim();
    }
    const sets = this.contactAnyOf;
    if (sets.length > 0 && !sets.some((s) => s.every((k) => fields[k]))) {
      return new FunctionResult(this.missingContact(fields));
    }
    if (this.contact) await this.contact(fields);
    return new FunctionResult(this.w.say('contact.thanks')).backToBackFunctions('forever');
  }

  /** What to ask for: the missing fields of the one set, or a choice of the sets. */
  private missingContact(fields: Record<string, string>): string {
    const w = this.w;
    const ask = (k: string): string =>
      this.contactFields[k]!.ask || w.say('contact.ask', { field: k.replaceAll('_', ' ') });
    if (this.contactAnyOf.length === 1) {
      return this.contactAnyOf[0]!.filter((k) => !fields[k])
        .map(ask)
        .join(' ');
    }
    const choices = this.contactAnyOf.map((s) => w.joined(s.map((k) => k.replaceAll('_', ' '))));
    return w.say('contact.any_of', { choices: w.joined(choices, 'list.or') });
  }

  private ensureMain(agent: AgentBase): void {
    const builder = agent.defineContexts();
    const ctx = builder.getContext(this.contextName) ?? builder.addContext(this.contextName);
    const tools = [this.tool];
    if (this.contact) tools.push(this.contactTool);
    const title = this.w.say('step.section');
    const text = this.w.say('step.text', { tool: this.tool });
    const step = ctx.getStep(this.stepName);
    if (step === undefined) {
      ctx.addStep(this.stepName).addSection(title, text).setFunctions(tools);
    } else {
      step._extend(text, tools, title);
    }
  }
}

function compareKeys(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]! ? -1 : 1;
  }
  return 0;
}

function scoreOf(result: Result): number {
  const value = result['score'];
  if (value === null || value === undefined || value === '' || value === false) return 0;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isNaN(n) ? 0 : n;
}
