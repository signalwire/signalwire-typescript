/**
 * AgentBase - Core agent class with Hono HTTP server and 5-phase SWML rendering.
 *
 * Composes PromptManager, SessionManager, SwmlBuilder, and a tool registry
 * into a single HTTP-servable agent.
 */

import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { randomBytes } from 'node:crypto';
import { PromptManager } from './PromptManager.js';
import { SessionManager } from './SessionManager.js';
import { SwmlBuilder } from './SwmlBuilder.js';
import { SwaigFunction, type SwaigHandler, type SwaigFunctionOptions } from './SwaigFunction.js';
import { SwaigFunctionResult } from './SwaigFunctionResult.js';
import { ContextBuilder } from './ContextBuilder.js';
import type {
  AgentOptions,
  LanguageConfig,
  PronunciationRule,
  FunctionInclude,
  DynamicConfigCallback,
} from './types.js';

export class AgentBase {
  name: string;
  route: string;
  host: string;
  port: number;

  // Internal managers
  private promptManager: PromptManager;
  private sessionManager: SessionManager;
  private swmlBuilder: SwmlBuilder;
  private toolRegistry: Map<string, SwaigFunction | Record<string, unknown>> = new Map();

  // Auth
  private basicAuthCreds: [string, string];

  // Call settings
  private autoAnswer: boolean;
  private _recordCall: boolean;
  private recordFormat: string;
  private recordStereo: boolean;
  private defaultWebhookUrl: string | null;
  private nativeFunctions: string[];

  // AI config
  private hints: string[] = [];
  private languages: LanguageConfig[] = [];
  private pronounce: PronunciationRule[] = [];
  private params: Record<string, unknown> = {};
  private globalData: Record<string, unknown> = {};
  private functionIncludes: FunctionInclude[] = [];
  private promptLlmParams: Record<string, unknown> = {};
  private postPromptLlmParams: Record<string, unknown> = {};
  private internalFillers: Record<string, Record<string, string[]>> = {};

  // Call flow verbs
  private preAnswerVerbs: [string, Record<string, unknown>][] = [];
  private answerConfig: Record<string, unknown> = {};
  private postAnswerVerbs: [string, Record<string, unknown>][] = [];
  private postAiVerbs: [string, Record<string, unknown>][] = [];

  // Dynamic config
  private dynamicConfigCallback: DynamicConfigCallback | null = null;
  private swaigQueryParams: Record<string, string> = {};

  // Webhook URL overrides
  private webHookUrlOverride: string | null = null;
  private postPromptUrlOverride: string | null = null;

  // Contexts
  private contextsBuilder: ContextBuilder | null = null;

  // Debug
  private debugEventsEnabled = false;
  private debugEventsLevel = 1;

  // Hono app
  private _app: Hono | null = null;

  constructor(opts: AgentOptions) {
    this.name = opts.name;
    this.route = (opts.route ?? '/').replace(/\/+$/, '') || '/';
    this.host = opts.host ?? '0.0.0.0';
    this.port = opts.port ?? parseInt(process.env['PORT'] ?? '3000', 10);
    this.autoAnswer = opts.autoAnswer ?? true;
    this._recordCall = opts.recordCall ?? false;
    this.recordFormat = opts.recordFormat ?? 'mp4';
    this.recordStereo = opts.recordStereo ?? true;
    this.defaultWebhookUrl = opts.defaultWebhookUrl ?? null;
    this.nativeFunctions = opts.nativeFunctions ?? [];

    this.promptManager = new PromptManager(opts.usePom ?? true);
    this.sessionManager = new SessionManager(opts.tokenExpirySecs ?? 3600);
    this.swmlBuilder = new SwmlBuilder();

    // Setup auth
    if (opts.basicAuth) {
      this.basicAuthCreds = opts.basicAuth;
    } else {
      const envUser = process.env['SWML_BASIC_AUTH_USER'];
      const envPass = process.env['SWML_BASIC_AUTH_PASSWORD'];
      if (envUser && envPass) {
        this.basicAuthCreds = [envUser, envPass];
      } else {
        this.basicAuthCreds = [this.name, randomBytes(8).toString('hex')];
      }
    }
  }

  // ── Prompt methods ──────────────────────────────────────────────────

  setPromptText(text: string): this {
    this.promptManager.setPromptText(text);
    return this;
  }

  setPostPrompt(text: string): this {
    this.promptManager.setPostPrompt(text);
    return this;
  }

  promptAddSection(
    title: string,
    opts?: {
      body?: string;
      bullets?: string[];
      numbered?: boolean;
      numberedBullets?: boolean;
      subsections?: { title: string; body?: string; bullets?: string[] }[];
    },
  ): this {
    this.promptManager.addSection(title, opts);
    return this;
  }

  promptAddToSection(
    title: string,
    opts?: { body?: string; bullet?: string; bullets?: string[] },
  ): this {
    this.promptManager.addToSection(title, opts);
    return this;
  }

  promptAddSubsection(parentTitle: string, title: string, opts?: { body?: string; bullets?: string[] }): this {
    this.promptManager.addSubsection(parentTitle, title, opts);
    return this;
  }

  promptHasSection(title: string): boolean {
    return this.promptManager.hasSection(title);
  }

  getPrompt(): string {
    return this.promptManager.getPrompt();
  }

  getPostPrompt(): string | null {
    return this.promptManager.getPostPrompt();
  }

  // ── Contexts ────────────────────────────────────────────────────────

  defineContexts(contexts?: ContextBuilder | Record<string, unknown>): ContextBuilder {
    if (contexts instanceof ContextBuilder) {
      this.contextsBuilder = contexts;
    } else {
      this.contextsBuilder = new ContextBuilder();
    }
    return this.contextsBuilder;
  }

  // ── AI config methods ───────────────────────────────────────────────

  addHint(hint: string): this {
    this.hints.push(hint);
    return this;
  }

  addHints(hints: string[]): this {
    this.hints.push(...hints);
    return this;
  }

  addPatternHint(opts: { pattern: string; replace: string; ignoreCase?: boolean }): this {
    this.hints.push(opts as unknown as string);
    return this;
  }

  addLanguage(config: LanguageConfig): this {
    const lang: Record<string, unknown> = {
      name: config.name,
      code: config.code,
    };
    if (config.voice) lang['voice'] = config.voice;
    if (config.engine) lang['engine'] = config.engine;
    if (config.fillers) lang['fillers'] = config.fillers;
    if (config.speechModel) lang['speech_model'] = config.speechModel;
    if (config.functionFillers) lang['function_fillers'] = config.functionFillers;
    this.languages.push(lang as unknown as LanguageConfig);
    return this;
  }

  setLanguages(languages: LanguageConfig[]): this {
    this.languages = [];
    for (const l of languages) this.addLanguage(l);
    return this;
  }

  addPronunciation(rule: PronunciationRule): this {
    const r: Record<string, unknown> = { replace: rule.replace, with: rule.with };
    if (rule.ignoreCase) r['ignore_case'] = rule.ignoreCase;
    this.pronounce.push(r as unknown as PronunciationRule);
    return this;
  }

  setParam(key: string, value: unknown): this {
    this.params[key] = value;
    return this;
  }

  setParams(params: Record<string, unknown>): this {
    Object.assign(this.params, params);
    return this;
  }

  setGlobalData(data: Record<string, unknown>): this {
    this.globalData = data;
    return this;
  }

  updateGlobalData(data: Record<string, unknown>): this {
    Object.assign(this.globalData, data);
    return this;
  }

  setNativeFunctions(funcs: string[]): this {
    this.nativeFunctions = funcs;
    return this;
  }

  addInternalFiller(functionName: string, languageCode: string, fillers: string[]): this {
    if (!this.internalFillers[functionName]) {
      this.internalFillers[functionName] = {};
    }
    this.internalFillers[functionName][languageCode] = fillers;
    return this;
  }

  addFunctionInclude(url: string, functions: string[], metaData?: Record<string, unknown>): this {
    const inc: FunctionInclude = { url, functions };
    if (metaData) inc.meta_data = metaData;
    this.functionIncludes.push(inc);
    return this;
  }

  setPromptLlmParams(params: Record<string, unknown>): this {
    Object.assign(this.promptLlmParams, params);
    return this;
  }

  setPostPromptLlmParams(params: Record<string, unknown>): this {
    Object.assign(this.postPromptLlmParams, params);
    return this;
  }

  enableDebugEvents(level = 1): this {
    this.debugEventsEnabled = true;
    this.debugEventsLevel = level;
    return this;
  }

  // ── Tools ───────────────────────────────────────────────────────────

  defineTool(opts: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    handler: SwaigHandler;
    secure?: boolean;
    fillers?: Record<string, string[]>;
    waitFile?: string;
    waitFileLoops?: number;
    required?: string[];
  }): this {
    const fn = new SwaigFunction({
      name: opts.name,
      description: opts.description,
      parameters: opts.parameters,
      handler: opts.handler,
      secure: opts.secure,
      fillers: opts.fillers,
      waitFile: opts.waitFile,
      waitFileLoops: opts.waitFileLoops,
      required: opts.required,
    });
    this.toolRegistry.set(opts.name, fn);
    return this;
  }

  registerSwaigFunction(fn: SwaigFunction | Record<string, unknown>): this {
    if (fn instanceof SwaigFunction) {
      this.toolRegistry.set(fn.name, fn);
    } else {
      const name = fn['function'] as string;
      this.toolRegistry.set(name, fn);
    }
    return this;
  }

  // ── Call flow ───────────────────────────────────────────────────────

  addPreAnswerVerb(verbName: string, config: Record<string, unknown>): this {
    this.preAnswerVerbs.push([verbName, config]);
    return this;
  }

  addAnswerVerb(config?: Record<string, unknown>): this {
    this.answerConfig = config ?? {};
    return this;
  }

  addPostAnswerVerb(verbName: string, config: Record<string, unknown>): this {
    this.postAnswerVerbs.push([verbName, config]);
    return this;
  }

  addPostAiVerb(verbName: string, config: Record<string, unknown>): this {
    this.postAiVerbs.push([verbName, config]);
    return this;
  }

  // ── Dynamic config ──────────────────────────────────────────────────

  setDynamicConfigCallback(cb: DynamicConfigCallback): this {
    this.dynamicConfigCallback = cb;
    return this;
  }

  addSwaigQueryParams(params: Record<string, string>): this {
    Object.assign(this.swaigQueryParams, params);
    return this;
  }

  // ── URL ─────────────────────────────────────────────────────────────

  setWebHookUrl(url: string): this {
    this.webHookUrlOverride = url;
    return this;
  }

  setPostPromptUrl(url: string): this {
    this.postPromptUrlOverride = url;
    return this;
  }

  getFullUrl(includeAuth = false): string {
    const proxyBase = process.env['SWML_PROXY_URL_BASE'];
    if (proxyBase) {
      let base = proxyBase.replace(/\/+$/, '');
      if (includeAuth) base = this.insertAuth(base);
      return base;
    }
    const protocol = 'http';
    const hostPart = this.host === '0.0.0.0' ? 'localhost' : this.host;
    let base = `${protocol}://${hostPart}:${this.port}`;
    if (includeAuth) base = this.insertAuth(base);
    if (this.route && this.route !== '/') base += this.route;
    return base;
  }

  private insertAuth(baseUrl: string): string {
    const [user, pass] = this.basicAuthCreds;
    if (!user || !pass) return baseUrl;
    return baseUrl.replace('://', `://${user}:${pass}@`);
  }

  private buildWebhookUrl(endpoint: string, extraParams?: Record<string, string>): string {
    let url = `${this.getFullUrl(true)}/${endpoint}`;
    const params = { ...extraParams };
    const entries = Object.entries(params).filter(([, v]) => v);
    if (entries.length) {
      url += '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    }
    return url;
  }

  // ── Lifecycle hooks (override in subclass) ──────────────────────────

  onSummary(_summary: Record<string, unknown> | null, _rawData: Record<string, unknown>): void | Promise<void> {
    // Default no-op
  }

  onSwmlRequest(_rawData: Record<string, unknown>): void | Promise<void> {
    // Default no-op
  }

  // ── 5-phase SWML rendering ─────────────────────────────────────────

  renderSwml(callId?: string): string {
    this.swmlBuilder.reset();

    const prompt = this.getPrompt();
    const postPrompt = this.getPostPrompt();
    if (!callId) callId = this.sessionManager.createSession();

    // Build webhook URLs
    const qp = { ...this.swaigQueryParams };
    let defaultWebhookUrl = this.buildWebhookUrl('swaig', qp);
    if (this.webHookUrlOverride) defaultWebhookUrl = this.webHookUrlOverride;

    // Build SWAIG object
    const swaigObj: Record<string, unknown> = {};
    if (this.nativeFunctions.length) swaigObj['native_functions'] = this.nativeFunctions;
    if (this.functionIncludes.length) swaigObj['includes'] = this.functionIncludes;
    if (Object.keys(this.internalFillers).length) swaigObj['internal_fillers'] = this.internalFillers;

    // Build functions array
    const functions: Record<string, unknown>[] = [];
    for (const [name, fn] of this.toolRegistry) {
      if (fn instanceof SwaigFunction) {
        let token: string | undefined;
        if (fn.secure && callId) {
          token = this.sessionManager.createToolToken(name, callId);
        }
        const entry: Record<string, unknown> = {
          function: name,
          description: fn.description,
          parameters: fn.parameters && Object.keys(fn.parameters).length
            ? ('type' in fn.parameters && 'properties' in fn.parameters
              ? fn.parameters
              : { type: 'object', properties: fn.parameters, ...(fn.required.length ? { required: fn.required } : {}) })
            : { type: 'object', properties: {} },
        };
        if (fn.fillers && Object.keys(fn.fillers).length) entry['fillers'] = fn.fillers;
        if (fn.waitFile) entry['wait_file'] = fn.waitFile;
        if (fn.waitFileLoops !== undefined) entry['wait_file_loops'] = fn.waitFileLoops;
        if (fn.webhookUrl) {
          entry['web_hook_url'] = fn.webhookUrl;
        } else if (token || Object.keys(this.swaigQueryParams).length) {
          const urlParams = { ...this.swaigQueryParams };
          if (token) urlParams['__token'] = token;
          entry['web_hook_url'] = this.buildWebhookUrl('swaig', urlParams);
        }
        Object.assign(entry, fn.extraFields);
        functions.push(entry);
      } else {
        // Raw dict (DataMap) - use as-is
        const entry = { ...fn, function: name };
        functions.push(entry);
      }
    }

    if (functions.length) {
      swaigObj['functions'] = functions;
      swaigObj['defaults'] = { web_hook_url: defaultWebhookUrl };
    }

    // Build post-prompt URL
    let postPromptUrl: string | undefined;
    if (postPrompt) {
      const ppParams = { ...this.swaigQueryParams };
      if (callId) {
        const ppToken = this.sessionManager.createToolToken('post_prompt', callId);
        if (ppToken) ppParams['__token'] = ppToken;
      }
      postPromptUrl = this.buildWebhookUrl('post_prompt', ppParams);
      if (this.postPromptUrlOverride) postPromptUrl = this.postPromptUrlOverride;
    }

    // ── PHASE 1: Pre-answer verbs ──
    for (const [verb, config] of this.preAnswerVerbs) {
      this.swmlBuilder.addVerb(verb, config);
    }

    // ── PHASE 2: Answer verb ──
    if (this.autoAnswer) {
      this.swmlBuilder.addVerb('answer', this.answerConfig);
    }

    // ── PHASE 3: Post-answer verbs ──
    if (this._recordCall) {
      this.swmlBuilder.addVerb('record_call', {
        format: this.recordFormat,
        stereo: this.recordStereo,
      });
    }
    for (const [verb, config] of this.postAnswerVerbs) {
      this.swmlBuilder.addVerb(verb, config);
    }

    // ── PHASE 4: AI verb ──
    const aiConfig: Record<string, unknown> = {};

    // Prompt
    if (this.contextsBuilder) {
      const contextsDict = this.contextsBuilder.toDict();
      const promptObj: Record<string, unknown> = { text: prompt || `You are ${this.name}, a helpful AI assistant.` };
      if (Object.keys(this.promptLlmParams).length) Object.assign(promptObj, this.promptLlmParams);
      aiConfig['prompt'] = promptObj;
      aiConfig['contexts'] = contextsDict;
    } else {
      const promptObj: Record<string, unknown> = { text: prompt };
      if (Object.keys(this.promptLlmParams).length) Object.assign(promptObj, this.promptLlmParams);
      aiConfig['prompt'] = promptObj;
    }

    // Post-prompt
    if (postPrompt) {
      const ppObj: Record<string, unknown> = { text: postPrompt };
      if (Object.keys(this.postPromptLlmParams).length) Object.assign(ppObj, this.postPromptLlmParams);
      aiConfig['post_prompt'] = ppObj;
      if (postPromptUrl) aiConfig['post_prompt_url'] = postPromptUrl;
    }

    // SWAIG
    if (Object.keys(swaigObj).length) aiConfig['SWAIG'] = swaigObj;

    // Additional config
    if (this.hints.length) aiConfig['hints'] = this.hints;
    if (this.languages.length) aiConfig['languages'] = this.languages;
    if (this.pronounce.length) aiConfig['pronounce'] = this.pronounce;
    if (Object.keys(this.params).length) aiConfig['params'] = this.params;
    if (Object.keys(this.globalData).length) aiConfig['global_data'] = this.globalData;

    this.swmlBuilder.addVerb('ai', aiConfig);

    // ── PHASE 5: Post-AI verbs ──
    for (const [verb, config] of this.postAiVerbs) {
      this.swmlBuilder.addVerb(verb, config);
    }

    return this.swmlBuilder.renderDocument();
  }

  // ── Ephemeral copy for dynamic config ───────────────────────────────

  private createEphemeralCopy(): AgentBase {
    const copy = Object.create(Object.getPrototypeOf(this)) as AgentBase;
    Object.assign(copy, this);
    // Deep-copy mutable state
    copy.promptManager = new PromptManager(true);
    // Carry over the current prompt
    const p = this.getPrompt();
    if (p) copy.promptManager.setPromptText(p);
    const pp = this.getPostPrompt();
    if (pp) copy.promptManager.setPostPrompt(pp);
    copy.toolRegistry = new Map(this.toolRegistry);
    copy.hints = [...this.hints];
    copy.languages = [...this.languages];
    copy.pronounce = [...this.pronounce];
    copy.params = { ...this.params };
    copy.globalData = { ...this.globalData };
    copy.preAnswerVerbs = [...this.preAnswerVerbs];
    copy.postAnswerVerbs = [...this.postAnswerVerbs];
    copy.postAiVerbs = [...this.postAiVerbs];
    copy.swmlBuilder = new SwmlBuilder();
    return copy;
  }

  // ── Hono HTTP app ───────────────────────────────────────────────────

  getApp(): Hono {
    if (this._app) return this._app;

    const app = new Hono();

    // Auth middleware
    const [user, pass] = this.basicAuthCreds;
    const authMw = basicAuth({ username: user, password: pass });

    const basePath = this.route === '/' ? '' : this.route;

    // Root - returns SWML
    const handleSwml = async (c: any) => {
      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* GET or no body */ }

      await this.onSwmlRequest(body);

      let agentToUse: AgentBase = this;
      if (this.dynamicConfigCallback) {
        agentToUse = this.createEphemeralCopy();
        const queryParams: Record<string, string> = {};
        const url = new URL(c.req.url);
        url.searchParams.forEach((v: string, k: string) => { queryParams[k] = v; });
        const headers: Record<string, string> = {};
        c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v; });
        await this.dynamicConfigCallback(queryParams, body, headers, agentToUse);
      }

      const callId = (body['call_id'] as string) || undefined;
      const swml = agentToUse.renderSwml(callId);
      return c.json(JSON.parse(swml));
    };

    app.get(`${basePath}`, authMw, handleSwml);
    app.post(`${basePath}`, authMw, handleSwml);
    if (basePath) {
      app.get(`${basePath}/`, authMw, handleSwml);
      app.post(`${basePath}/`, authMw, handleSwml);
    }

    // SWAIG function dispatcher
    const handleSwaig = async (c: any) => {
      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* empty */ }

      const fnName = body['function'] as string;
      if (!fnName) return c.json({ error: 'Missing function name' }, 400);

      const fn = this.toolRegistry.get(fnName);
      if (!fn || !(fn instanceof SwaigFunction)) {
        return c.json({ error: `Unknown function: ${fnName}` }, 404);
      }

      // Token validation for secure functions
      if (fn.secure) {
        const url = new URL(c.req.url);
        const token = url.searchParams.get('__token') ?? url.searchParams.get('token');
        const callId = (body['call_id'] as string) ?? '';
        if (!token || !this.sessionManager.validateToken(callId, fnName, token)) {
          return c.json({ error: 'Invalid or expired token' }, 403);
        }
      }

      const args = (body['argument'] as Record<string, unknown>) ?? {};
      const result = await fn.execute(args, body);
      return c.json(result);
    };

    app.get(`${basePath}/swaig`, authMw, handleSwaig);
    app.post(`${basePath}/swaig`, authMw, handleSwaig);

    // Post-prompt handler
    const handlePostPrompt = async (c: any) => {
      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* empty */ }

      const summary = this.findSummary(body);
      await this.onSummary(summary, body);
      return c.json({ ok: true });
    };

    app.get(`${basePath}/post_prompt`, authMw, handlePostPrompt);
    app.post(`${basePath}/post_prompt`, authMw, handlePostPrompt);

    // Health / Ready
    app.get(`${basePath}/health`, (c: any) => c.json({ status: 'ok' }));
    app.get(`${basePath}/ready`, (c: any) => c.json({ status: 'ready' }));

    this._app = app;
    return app;
  }

  asRouter(): Hono {
    return this.getApp();
  }

  async serve(): Promise<void> {
    const { serve: honoServe } = await import('@hono/node-server');
    const app = this.getApp();
    console.log(`[${this.name}] Agent running at http://${this.host}:${this.port}${this.route}`);
    console.log(`[${this.name}] Auth: ${this.basicAuthCreds[0]}:${this.basicAuthCreds[1]}`);
    honoServe({ fetch: app.fetch, port: this.port, hostname: this.host });
  }

  /** Alias for serve() */
  async run(): Promise<void> {
    return this.serve();
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private findSummary(body: Record<string, unknown>): Record<string, unknown> | null {
    if (!body) return null;
    if (body['summary']) return body['summary'] as Record<string, unknown>;
    const ppd = body['post_prompt_data'] as Record<string, unknown> | undefined;
    if (ppd) {
      if (Array.isArray(ppd['parsed']) && ppd['parsed'].length) return ppd['parsed'][0];
      if (ppd['raw']) {
        try {
          return JSON.parse(ppd['raw'] as string);
        } catch {
          return ppd['raw'] as Record<string, unknown>;
        }
      }
    }
    return null;
  }

  /** Get basic auth credentials */
  getBasicAuthCredentials(): [string, string] {
    return this.basicAuthCreds;
  }
}
