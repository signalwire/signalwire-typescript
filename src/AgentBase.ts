/**
 * AgentBase - Core agent class with Hono HTTP server and 5-phase SWML rendering.
 *
 * Composes PromptManager, SessionManager, SwmlBuilder, and a tool registry
 * into a single HTTP-servable agent.
 */

import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { cors } from 'hono/cors';
import { randomBytes } from 'node:crypto';
import { PromptManager } from './PromptManager.js';
import { SessionManager } from './SessionManager.js';
import { SwmlBuilder } from './SwmlBuilder.js';
import { SWMLService } from './SWMLService.js';
import { ConfigLoader } from './ConfigLoader.js';
import { SwaigFunction, type SwaigHandler, type SwaigFunctionOptions } from './SwaigFunction.js';
import { inferSchema, createTypedHandlerWrapper } from './TypeInference.js';
import { FunctionResult } from './FunctionResult.js';
import { ContextBuilder } from './ContextBuilder.js';
import { getLogger, suppressAllLogs } from './Logger.js';
import { safeAssign, filterSensitiveHeaders, redactUrl, isValidHostname } from './SecurityUtils.js';
import { SkillManager } from './skills/SkillManager.js';
import type { SkillBase, SkillConfig } from './skills/SkillBase.js';
import { SkillRegistry } from './skills/SkillRegistry.js';
import { ServerlessAdapter, type ServerlessEvent, type ServerlessResponse } from './ServerlessAdapter.js';
import type {
  AgentOptions,
  LanguageConfig,
  PronunciationRule,
  FunctionInclude,
  DynamicConfigCallback,
} from './types.js';

/**
 * Callback invoked at a registered routing endpoint to determine how to handle an
 * incoming request. Return a route string to redirect to that agent route, or
 * null / undefined to let normal SWML processing continue.
 *
 * Mirrors Python `web_mixin.register_routing_callback` callback signature (body-only
 * variant — Hono request object is not forwarded; use the parsed body instead).
 */
export type RoutingCallback = (
  body: Record<string, unknown>,
) => string | null | undefined | Promise<string | null | undefined>;

/**
 * Core agent class that composes an HTTP server, prompt management, session handling,
 * SWAIG tool registry, and 5-phase SWML rendering into a single deployable unit.
 *
 * A single `AgentBase` is one HTTP-servable voice agent:
 *
 * - `GET /` returns the SWML call-flow document
 * - `POST /swaig` dispatches SWAIG function calls to registered tool handlers
 * - `POST /post_prompt` receives the end-of-call summary and invokes {@link onSummary}
 *
 * Most user agents either (a) subclass `AgentBase` and override `defineTools()` / `onSummary()`
 * or (b) use one of the {@link ./prefabs/index.js | prefab agents} (e.g. `ReceptionistAgent`).
 *
 * @example Subclass with a custom tool
 * ```ts
 * import { AgentBase, FunctionResult } from '@signalwire/sdk';
 *
 * class WeatherAgent extends AgentBase {
 *   static override PROMPT_SECTIONS = [
 *     { title: 'Role', body: 'You are a weather assistant.' },
 *   ];
 *
 *   protected override defineTools(): void {
 *     this.defineTool({
 *       name: 'get_forecast',
 *       description: 'Return the forecast for a city.',
 *       parameters: {
 *         type: 'object',
 *         properties: { city: { type: 'string' } },
 *         required: ['city'],
 *       },
 *       handler: async ({ city }) => {
 *         const forecast = await fetchForecast(city as string);
 *         return new FunctionResult(forecast);
 *       },
 *     });
 *   }
 * }
 *
 * const agent = new WeatherAgent({ name: 'weather', route: '/' });
 * await agent.serve({ port: 3000 });
 * ```
 *
 * @example Imperative usage (no subclass)
 * ```ts
 * const agent = new AgentBase({ name: 'hello', route: '/' });
 * agent.setPromptText('You are a friendly greeter.');
 * agent.defineTool({
 *   name: 'say_hi',
 *   description: 'Respond with a greeting.',
 *   parameters: { type: 'object', properties: {} },
 *   handler: () => new FunctionResult('Hello from SignalWire!'),
 * });
 * await agent.serve();
 * ```
 *
 * @see {@link FunctionResult} — builder for tool handler responses
 * @see {@link ContextBuilder} — multi-step conversation state machines
 * @see {@link DataMap} — server-side tools without webhooks
 * @see {@link AgentServer} — host multiple agents on one HTTP server
 */
export class AgentBase extends SWMLService {
  // name, route, host, port, swmlBuilder, _app, authCredentials, toolRegistry
  // are inherited from SWMLService. Agent-specific state below only.

  /** Unique identifier for this agent instance. */
  agentId: string;

  // Internal managers
  private _promptManager: PromptManager;
  private sessionManager: SessionManager;
  // Auth — mirrors of inherited authCredentials kept for legacy callers that
  // read basicAuthCreds directly. The Hono basicAuth middleware uses the
  // inherited credentials (set in super()).
  private basicAuthCreds: [string, string];
  private basicAuthSource: 'provided' | 'environment' | 'auto-generated' = 'auto-generated';

  // Call settings
  private autoAnswer: boolean;
  private _recordCall: boolean;
  private recordFormat: string;
  private recordStereo: boolean;
  private defaultWebhookUrl: string | null;
  private _nativeFunctions: string[];

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

  // MCP
  private _mcpServers: Record<string, unknown>[] = [];
  private _mcpServerEnabled = false;

  // SIP Routing
  private _sipRoutingEnabled = false;
  private _sipRoute = '/sip';
  private _sipAutoMap = false;
  private _sipUsernames: Map<string, string> | null = null;

  // Debug
  private debugEventsEnabled = false;
  private debugEventsLevel = 1;

  // Proxy detection — _proxyUrlBase and _proxyUrlBaseFromEnv inherited from
  // SWMLService.
  private _proxyDebug = process.env['SWML_PROXY_DEBUG'] === 'true';
  private _trustProxyHeaders = process.env['SWML_TRUST_PROXY_HEADERS'] === 'true';
  private _enforceHttps = process.env['SWML_ENFORCE_HTTPS'] === 'true';

  /** Structured logger instance for this agent. Override the inherited
   * SWMLService logger with an AgentBase-tagged one. */
  override log = getLogger('AgentBase');

  // Skills
  private _skillManager = new SkillManager();

  // New constructor params (P1 gaps)
  private _enablePostPromptOverride = false;
  private _checkForInputOverride = false;
  private _schemaValidation = true;
  private _configFile: string | null = null;
  private _schemaPath: string | null = null;

  // _routingCallbacks and _app are inherited from SWMLService.
  // AgentBase rebuilds _app in getApp() with its own middleware stack and
  // route handlers, overwriting the parent-init Hono instance. The flag
  // below tracks whether AgentBase's own setup has run; the parent-init
  // Hono is replaced on first AgentBase getApp() call.
  private _appBuiltByAgent = false;

  /**
   * Create a new AgentBase instance.
   * @param opts - Agent configuration options including name, route, auth, and call settings.
   */
  constructor(opts: AgentOptions) {
    // Resolve construction-time config (config file + opts) before super(),
    // because TypeScript's strict superclass-call rules require all `this`-
    // touching code to come after super(). Forward the resolved values into
    // SWMLService via super() so name/route/host/port/auth are set on the
    // single source of truth in the parent.
    let serviceConfig: Record<string, unknown> = {};
    if (opts.configFile) {
      try {
        const loader = new ConfigLoader(opts.configFile);
        serviceConfig = (loader.get<Record<string, unknown>>('service') ?? {});
      } catch {
        // Config file not found or invalid — continue with constructor args
      }
    }
    const resolvedName = (serviceConfig['name'] as string | undefined) ?? opts.name;
    const routeArg = opts.route ?? '/';
    const resolvedRoute = (routeArg !== '/'
      ? routeArg
      : ((serviceConfig['route'] as string | undefined) ?? routeArg)).replace(/\/+$/, '') || '/';
    const hostArg = opts.host ?? '0.0.0.0';
    const resolvedHost = hostArg !== '0.0.0.0' ? hostArg : ((serviceConfig['host'] as string | undefined) ?? hostArg);
    const configPort = serviceConfig['port'] as number | undefined;
    const parsedPort = opts.port ?? configPort ?? parseInt(process.env['PORT'] ?? '3000', 10);
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      throw new Error(`Invalid port: ${opts.port ?? process.env['PORT']}. Must be between 1 and 65535.`);
    }

    super({
      name: resolvedName,
      route: resolvedRoute,
      host: resolvedHost,
      port: parsedPort,
      ...(opts.basicAuth ? { basicAuth: opts.basicAuth } : {}),
      ...(opts.configFile ? { configFile: opts.configFile } : {}),
      ...(opts.schemaPath ? { schemaPath: opts.schemaPath } : {}),
      schemaValidation: opts.schemaValidation ?? true,
    });

    if (opts.configFile) {
      this._configFile = opts.configFile;
    }
    this.agentId = opts.agentId ?? randomBytes(8).toString('hex');
    this.autoAnswer = opts.autoAnswer ?? true;
    this._recordCall = opts.recordCall ?? false;
    this.recordFormat = opts.recordFormat ?? 'mp4';
    this.recordStereo = opts.recordStereo ?? true;
    this.defaultWebhookUrl = opts.defaultWebhookUrl ?? null;
    this._nativeFunctions = opts.nativeFunctions ?? [];

    // Store new constructor params
    this._enablePostPromptOverride = opts.enablePostPromptOverride ?? false;
    this._checkForInputOverride = opts.checkForInputOverride ?? false;
    this._schemaValidation = opts.schemaValidation ?? true;
    this._schemaPath = opts.schemaPath ?? null;

    if (opts.suppressLogs) {
      suppressAllLogs(true);
    }

    this._promptManager = new PromptManager(opts.usePom ?? true);
    this.sessionManager = new SessionManager(opts.tokenExpirySecs ?? 3600);
    // swmlBuilder is inherited from SWMLService (initialized via super()).

    // Setup auth — populate the legacy basicAuthCreds/basicAuthSource
    // mirrors so AgentBase callers that read them still work.
    // SWMLService's authCredentials (set in super()) is the source of truth
    // for HTTP-level enforcement.
    if (opts.basicAuth) {
      this.basicAuthCreds = opts.basicAuth;
      this.basicAuthSource = 'provided';
    } else {
      const envUser = process.env['SWML_BASIC_AUTH_USER'];
      const envPass = process.env['SWML_BASIC_AUTH_PASSWORD'];
      if (envUser && envPass) {
        this.basicAuthCreds = [envUser, envPass];
        this.basicAuthSource = 'environment';
      } else {
        // No SWML_BASIC_AUTH_PASSWORD was found in the environment and
        // the caller did not pass basicAuth. Fall back to a random
        // password that exists only in this process; warn loudly so
        // external callers (tests, RPC clients, MCP) know why they are
        // getting HTTP 401.
        const username = envUser || this.name;
        this.basicAuthCreds = [username, randomBytes(16).toString('hex')];
        this.basicAuthSource = 'auto-generated';
        this.log.warn(
          `basic_auth_password_autogenerated: username="${username}". ` +
            `No SWML_BASIC_AUTH_PASSWORD found in environment and no basicAuth ` +
            `passed to the agent constructor. The SDK generated a random ` +
            `password that exists only in this process; external callers will ` +
            `get HTTP 401 unless they read the value from this process's env. ` +
            `To fix, set SWML_BASIC_AUTH_USER and SWML_BASIC_AUTH_PASSWORD in ` +
            `your .env, or pass { basicAuth: [user, pass] } to the agent ` +
            `constructor.`,
        );
      }
    }

    // Apply static PROMPT_SECTIONS from the class if defined
    const ctor = this.constructor as typeof AgentBase;
    if (ctor.PROMPT_SECTIONS) {
      for (const section of ctor.PROMPT_SECTIONS) {
        this.promptAddSection(section.title, section);
      }
    }
  }

  /**
   * Static prompt sections: subclasses can define these declaratively.
   * Each entry is applied via promptAddSection() in the constructor.
   */
  static PROMPT_SECTIONS?: { title: string; body?: string; bullets?: string[]; numbered?: boolean }[];

  /**
   * Lifecycle method to register tools. Subclasses should call this at the
   * end of their own constructor (after all fields are initialized).
   * Not called automatically — call `this.defineTools()` explicitly.
   */
  protected defineTools(): void {
    // Default no-op — subclasses override
  }

  /**
   * Public access to the list of registered tools.
   *
   * In Python, `define_tools()` is public and returns `List[SWAIGFunction]`.
   * In TypeScript, `defineTools()` is a protected setup hook (void). This
   * method provides the equivalent public "get all tools" capability.
   * @returns Array of all registered SwaigFunction instances.
   */
  getTools(): SwaigFunction[] {
    const tools: SwaigFunction[] = [];
    for (const [, fn] of this.toolRegistry) {
      if (fn instanceof SwaigFunction) tools.push(fn);
    }
    return tools;
  }

  // ── Public getters for Python-public properties ────────────────────

  /**
   * Public accessor for the PromptManager (POM).
   *
   * Python exposes `self.pom` as a public attribute. This getter
   * provides equivalent access for direct POM manipulation.
   */
  get promptManager(): PromptManager {
    return this._promptManager;
  }

  /**
   * Public accessor for the native functions list.
   *
   * Python exposes `self.native_functions` as a public read/write attribute.
   * @returns A copy of the native functions list.
   */
  get nativeFunctions(): string[] {
    return this._nativeFunctions;
  }

  /** Set the native functions list. */
  set nativeFunctions(fns: string[]) {
    this._nativeFunctions = fns;
  }

  /**
   * Public read-only accessor for the SkillManager.
   *
   * Python exposes `self.skill_manager` as a public attribute. This getter
   * provides equivalent read access.
   */
  get skillManager(): SkillManager {
    return this._skillManager;
  }

  // ── Prompt methods ──────────────────────────────────────────────────

  /**
   * Set the main system prompt text for the AI.
   * @param text - The prompt text to use.
   * @returns This agent instance for chaining.
   */
  setPromptText(text: string): this {
    this._promptManager.setPromptText(text);
    return this;
  }

  /**
   * Set the post-prompt text evaluated after the call ends.
   * @param text - The post-prompt text to use.
   * @returns This agent instance for chaining.
   */
  setPostPrompt(text: string): this {
    this._promptManager.setPostPrompt(text);
    return this;
  }

  /**
   * Add a new section to the prompt with optional body, bullets, and subsections.
   * @param title - Section heading.
   * @param opts - Optional section content including body text, bullet points, and subsections.
   * @returns This agent instance for chaining.
   */
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
    this._promptManager.addSection(title, opts);
    return this;
  }

  /**
   * Append content to an existing prompt section.
   * @param title - Title of the section to append to.
   * @param opts - Content to add: body text, a single bullet, or multiple bullets.
   * @returns This agent instance for chaining.
   */
  promptAddToSection(
    title: string,
    opts?: { body?: string; bullet?: string; bullets?: string[] },
  ): this {
    this._promptManager.addToSection(title, opts);
    return this;
  }

  /**
   * Add a subsection under an existing prompt section.
   * @param parentTitle - Title of the parent section.
   * @param title - Title of the new subsection.
   * @param opts - Optional body text and bullet points for the subsection.
   * @returns This agent instance for chaining.
   */
  promptAddSubsection(parentTitle: string, title: string, opts?: { body?: string; bullets?: string[] }): this {
    this._promptManager.addSubsection(parentTitle, title, opts);
    return this;
  }

  /**
   * Check whether a prompt section with the given title exists.
   * @param title - Section title to look for.
   * @returns True if the section exists.
   */
  promptHasSection(title: string): boolean {
    return this._promptManager.hasSection(title);
  }

  /**
   * Get the fully rendered main prompt text.
   * @returns The assembled prompt string.
   */
  getPrompt(): string {
    return this._promptManager.getPrompt();
  }

  /**
   * Get the raw POM (Prompt Object Model) structure as an array of section data objects,
   * when the agent is in POM mode and has at least one section.
   *
   * Matches Python `get_prompt()` which returns `Union[str, List[Dict]]` — a raw list when
   * in POM mode (via `pom.to_list()` / `pom.render_dict()`), or a string otherwise.
   * The TS `getPrompt()` always returns a string (rendered Markdown), so this companion
   * method exposes the raw POM structure for callers that need it for serialisation or
   * inspection (e.g. skills that inspect prompt sections).
   *
   * @returns An array of POM section data objects, or null if not in POM mode or POM is empty.
   */
  getPromptPom(): Record<string, unknown>[] | null {
    const pom = this._promptManager.getPomBuilder();
    if (!pom) return null;
    const sections = pom.toDict();
    if (!sections.length) return null;
    return sections as Record<string, unknown>[];
  }

  /**
   * Get the post-prompt text, if one has been set.
   * @returns The post-prompt string, or null if not configured.
   */
  getPostPrompt(): string | null {
    return this._promptManager.getPostPrompt();
  }

  /**
   * Set the prompt as a POM (Prompt Object Model) dictionary.
   *
   * Replaces the current POM sections with the provided structured data.
   * Each entry should have `title`, and optionally `body`, `bullets`,
   * `numbered`, `numberedBullets`, and `subsections`.
   *
   * @param pom - Array of POM section dictionaries.
   * @returns This agent instance for chaining.
   * @throws Error if POM mode is not enabled (`usePom: false`).
   */
  setPromptPom(pom: Record<string, unknown>[]): this {
    const pomBuilder = this._promptManager.getPomBuilder();
    if (!pomBuilder) {
      throw new Error('usePom must be true to use setPromptPom');
    }
    // Clear existing sections and rebuild from the provided POM array
    pomBuilder.reset();
    for (const section of pom) {
      const title = (section['title'] as string) ?? '';
      pomBuilder.addSection(title, {
        body: section['body'] as string | undefined,
        bullets: section['bullets'] as string[] | undefined,
        numbered: section['numbered'] as boolean | undefined,
        numberedBullets: section['numberedBullets'] as boolean | undefined,
        subsections: section['subsections'] as { title: string; body?: string; bullets?: string[] }[] | undefined,
      });
    }
    return this;
  }

  // ── Contexts ────────────────────────────────────────────────────────

  /**
   * Define or replace the contexts configuration for the AI verb.
   * @param contexts - An existing ContextBuilder instance or a plain object; a new ContextBuilder is created if omitted.
   * @returns The active ContextBuilder for further configuration.
   */
  defineContexts(contexts?: ContextBuilder | Record<string, unknown>): ContextBuilder {
    if (contexts instanceof ContextBuilder) {
      this.contextsBuilder = contexts;
    } else {
      this.contextsBuilder = new ContextBuilder();
    }
    // Attach agent reference so ContextBuilder.validate() can check
    // user tool names against reserved native tool names.
    this.contextsBuilder.attachAgent(this);
    return this.contextsBuilder;
  }

  /**
   * Remove all contexts, returning the agent to a no-contexts state.
   *
   * This is a convenience wrapper around `defineContexts().reset()`.
   * Use it in a dynamic config callback when you need to rebuild
   * contexts from scratch for a specific request.
   *
   * @returns This agent instance for chaining.
   */
  resetContexts(): this {
    if (this.contextsBuilder) {
      this.contextsBuilder.reset();
    }
    return this;
  }

  // ── AI config methods ───────────────────────────────────────────────

  /**
   * Add a single speech-recognition hint.
   * @param hint - Word or phrase to boost in speech recognition.
   * @returns This agent instance for chaining.
   */
  addHint(hint: string): this {
    this.hints.push(hint);
    return this;
  }

  /**
   * Add multiple speech-recognition hints at once.
   * @param hints - Array of words or phrases to boost.
   * @returns This agent instance for chaining.
   */
  addHints(hints: string[]): this {
    this.hints.push(...hints);
    return this;
  }

  /**
   * Add a pattern-based speech-recognition hint with find-and-replace behavior.
   * @param opts - Pattern hint configuration with a descriptive hint label,
   *   regex pattern, replacement string, and optional case-insensitive flag.
   * @returns This agent instance for chaining.
   */
  addPatternHint(opts: { hint: string; pattern: string; replace: string; ignoreCase?: boolean }): this {
    const entry: Record<string, unknown> = {
      hint: opts.hint,
      pattern: opts.pattern,
      replace: opts.replace,
    };
    if (opts.ignoreCase) entry['ignore_case'] = true;
    this.hints.push(entry as unknown as string);
    return this;
  }

  /**
   * Add a supported language to the AI configuration.
   * @param config - Language configuration including name, code, voice, and optional fillers.
   * @returns This agent instance for chaining.
   */
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

  /**
   * Replace all configured languages with a new list.
   * @param languages - Array of language configurations.
   * @returns This agent instance for chaining.
   */
  setLanguages(languages: LanguageConfig[]): this {
    this.languages = [];
    for (const l of languages) this.addLanguage(l);
    return this;
  }

  /**
   * Add a pronunciation override rule for the TTS engine.
   * @param rule - Pronunciation rule specifying the text to replace and its substitute.
   * @returns This agent instance for chaining.
   */
  addPronunciation(rule: PronunciationRule): this {
    const r: Record<string, unknown> = { replace: rule.replace, with: rule.with };
    if (rule.ignoreCase) r['ignore_case'] = rule.ignoreCase;
    this.pronounce.push(r as unknown as PronunciationRule);
    return this;
  }

  /**
   * Replace all pronunciation rules with a new list.
   * @param rules - Array of pronunciation rule objects.
   * @returns This agent instance for chaining.
   */
  setPronunciations(rules: PronunciationRule[]): this {
    this.pronounce = [];
    for (const rule of rules) {
      this.addPronunciation(rule);
    }
    return this;
  }

  /**
   * Set a single AI parameter (e.g. "temperature", "top_p").
   * @param key - Parameter name.
   * @param value - Parameter value.
   * @returns This agent instance for chaining.
   */
  setParam(key: string, value: unknown): this {
    this.params[key] = value;
    return this;
  }

  /**
   * Merge multiple AI parameters into the existing params object.
   * @param params - Key-value pairs to merge.
   * @returns This agent instance for chaining.
   */
  setParams(params: Record<string, unknown>): this {
    safeAssign(this.params, params);
    return this;
  }

  /**
   * Merge data into the global_data object passed into the AI configuration.
   *
   * Matches Python `set_global_data` which calls `.update()` on the internal dict —
   * existing keys are preserved; incoming keys overwrite on collision. Skills and
   * other callers can each contribute keys without clobbering one another.
   *
   * If you need to replace the entire object, assign a new agent instance or use
   * `Object.assign(agent.globalData, {})` to clear first.
   *
   * @param data - Key-value pairs to merge into global data.
   * @returns This agent instance for chaining.
   */
  setGlobalData(data: Record<string, unknown>): this {
    safeAssign(this.globalData, data);
    return this;
  }

  /**
   * Merge additional entries into the existing global_data object.
   * @param data - Key-value pairs to merge into global data.
   * @returns This agent instance for chaining.
   */
  updateGlobalData(data: Record<string, unknown>): this {
    safeAssign(this.globalData, data);
    return this;
  }

  /**
   * Set the list of native SWAIG function names (built-in platform functions).
   * @param funcs - Array of native function names.
   * @returns This agent instance for chaining.
   */
  setNativeFunctions(funcs: string[]): this {
    this._nativeFunctions = funcs;
    return this;
  }

  /**
   * The complete set of internal SWAIG function names that accept fillers,
   * matching the SWAIGInternalFiller schema definition. Any name outside
   * this set is silently ignored by the runtime — addInternalFiller /
   * setInternalFillers warn if you pass an unknown name.
   */
  static readonly SUPPORTED_INTERNAL_FILLER_NAMES: ReadonlySet<string> = new Set([
    'hangup',                  // AI is hanging up the call
    'check_time',              // AI is checking the time
    'wait_for_user',           // AI is waiting for user input
    'wait_seconds',            // deliberate pause / wait period
    'adjust_response_latency', // AI is adjusting response timing
    'next_step',               // transitioning between steps in prompt.contexts
    'change_context',          // switching between contexts in prompt.contexts
    'get_visual_input',        // processing visual input (enable_vision)
    'get_ideal_strategy',      // thinking (enable_thinking)
  ]);

  /**
   * Set internal fillers for native SWAIG functions.
   *
   * Internal fillers are short phrases the AI agent speaks (via TTS) while
   * an internal/native function is running, so the caller doesn't hear
   * dead air during transitions or background work.
   *
   * Supported function names (matches the SWAIGInternalFiller schema):
   *
   *   hangup                  — when the agent is hanging up
   *   check_time              — when checking the time
   *   wait_for_user           — when waiting for user input
   *   wait_seconds            — during deliberate pauses
   *   adjust_response_latency — when adjusting response timing
   *   next_step               — transitioning between steps in prompt.contexts
   *   change_context          — switching between contexts in prompt.contexts
   *   get_visual_input        — processing visual input (enable_vision=true)
   *   get_ideal_strategy      — thinking (enable_thinking=true)
   *
   * Notably NOT supported: change_step, gather_submit, or arbitrary
   * user-defined SWAIG function names. The runtime only honors fillers
   * for the names listed above; everything else is silently ignored at
   * the SWML level. This method warns at registration time if you pass
   * an unknown name so you catch the typo early.
   *
   * @param internalFillers - Map of function name to language-keyed filler phrases.
   * @returns This agent instance for chaining.
   *
   * @example
   * agent.setInternalFillers({
   *   next_step: {
   *     'en-US': ['Moving to the next step...', 'Great, let us continue...'],
   *     'es':    ['Pasando al siguiente paso...']
   *   },
   *   check_time: {
   *     'en-US': ['Let me check the time...']
   *   }
   * });
   */
  setInternalFillers(internalFillers: Record<string, Record<string, string[]>>): this {
    if (!internalFillers || typeof internalFillers !== 'object') return this;
    const supported = AgentBase.SUPPORTED_INTERNAL_FILLER_NAMES;
    const unknown = Object.keys(internalFillers)
      .filter((name) => !supported.has(name))
      .sort();
    if (unknown.length) {
      this.log.warn(
        `unknown_internal_filler_names: [${unknown.join(', ')}]. ` +
          `setInternalFillers received names that the SWML schema does not ` +
          `recognize. Those entries will be ignored by the runtime. Supported ` +
          `names: [${[...supported].sort().join(', ')}].`,
      );
    }
    for (const [name, langMap] of Object.entries(internalFillers)) {
      this.internalFillers[name] = { ...(this.internalFillers[name] ?? {}), ...langMap };
    }
    return this;
  }

  /**
   * Add internal filler phrases for a single internal function and language.
   *
   * See {@link setInternalFillers} for the complete list of supported
   * functionName values and an explanation of what fillers do.
   *
   * @param functionName - One of the supported internal function names
   *   (see SUPPORTED_INTERNAL_FILLER_NAMES). Names outside the supported
   *   set log a warning and are ignored by the runtime.
   * @param languageCode - BCP-47 language code for the fillers (e.g. 'en-US').
   * @param fillers - Array of filler phrases.
   * @returns This agent instance for chaining.
   */
  addInternalFiller(functionName: string, languageCode: string, fillers: string[]): this {
    if (!AgentBase.SUPPORTED_INTERNAL_FILLER_NAMES.has(functionName)) {
      this.log.warn(
        `unknown_internal_filler_name: "${functionName}". addInternalFiller ` +
          `received a function name the SWML schema does not recognize. The ` +
          `entry will be stored but the runtime will not play these fillers. ` +
          `Supported names: [${[...AgentBase.SUPPORTED_INTERNAL_FILLER_NAMES].sort().join(', ')}].`,
      );
    }
    if (!this.internalFillers[functionName]) {
      this.internalFillers[functionName] = {};
    }
    this.internalFillers[functionName][languageCode] = fillers;
    return this;
  }

  /**
   * Add a remote SWAIG function include reference.
   * @param url - URL of the remote SWAIG endpoint.
   * @param functions - Function names available at that endpoint.
   * @param metaData - Optional metadata to attach to the include.
   * @returns This agent instance for chaining.
   */
  addFunctionInclude(url: string, functions: string[], metaData?: Record<string, unknown>): this {
    const inc: FunctionInclude = { url, functions };
    if (metaData) inc.meta_data = metaData;
    this.functionIncludes.push(inc);
    return this;
  }

  /**
   * Replace the entire list of function includes.
   * Each include must have a `url` and `functions` array.
   * @param includes - Array of function include objects.
   * @returns This agent instance for chaining.
   */
  setFunctionIncludes(includes: FunctionInclude[]): this {
    this.functionIncludes = includes.filter(
      (inc) => inc.url && Array.isArray(inc.functions),
    );
    return this;
  }

  /**
   * Merge LLM-specific parameters into the main prompt configuration (e.g. model, temperature).
   * @param params - Key-value LLM parameters to merge.
   * @returns This agent instance for chaining.
   */
  setPromptLlmParams(params: Record<string, unknown>): this {
    safeAssign(this.promptLlmParams, params);
    return this;
  }

  /**
   * Merge LLM-specific parameters into the post-prompt configuration.
   * @param params - Key-value LLM parameters to merge.
   * @returns This agent instance for chaining.
   */
  setPostPromptLlmParams(params: Record<string, unknown>): this {
    safeAssign(this.postPromptLlmParams, params);
    return this;
  }

  /**
   * Enable debug event webhooks for this agent.
   * @param level - Debug verbosity level (defaults to 1).
   * @returns This agent instance for chaining.
   */
  enableDebugEvents(level = 1): this {
    this.debugEventsEnabled = true;
    this.debugEventsLevel = level;
    return this;
  }

  // ── SIP routing ────────────────────────────────────────────────────

  /**
   * Enable SIP routing for this agent.
   * @param autoMap - When true, automatically map SIP usernames to the agent route (defaults to true).
   * @param path - HTTP path for the SIP routing endpoint (defaults to '/sip').
   * @returns This agent instance for chaining.
   */
  enableSipRouting(autoMap = true, path = '/sip'): this {
    this._sipRoutingEnabled = true;
    this._sipRoute = path;
    if (autoMap) {
      this._sipAutoMap = true;
      this.autoMapSipUsernames();
    }
    return this;
  }

  /**
   * Register a SIP username to route to this agent.
   * @param username - The SIP username to register.
   * @returns This agent instance for chaining.
   */
  registerSipUsername(username: string): this {
    if (!this._sipUsernames) this._sipUsernames = new Map();
    this._sipUsernames.set(username.toLowerCase(), this.route);
    return this;
  }

  /**
   * Automatically register common SIP usernames based on this agent's
   * name and route. Derives cleaned variants (alphanumeric + underscore)
   * and registers each via `registerSipUsername()`.
   *
   * Port of Python's `auto_map_sip_usernames()`:
   * - Registers a cleaned version of the agent name
   * - Registers a cleaned version of the route (if different from name)
   * - For names longer than 3 characters, also registers a vowel-stripped variant
   *
   * @returns This agent instance for chaining.
   */
  autoMapSipUsernames(): this {
    // Register username based on agent name
    const cleanName = this.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanName) {
      this.registerSipUsername(cleanName);
    }

    // Register username based on route (without slashes)
    const cleanRoute = this.route.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanRoute && cleanRoute !== cleanName) {
      this.registerSipUsername(cleanRoute);
    }

    // Register common variations if they make sense
    if (cleanName.length > 3) {
      // Register without vowels
      const noVowels = cleanName.replace(/[aeiou]/g, '');
      if (noVowels !== cleanName && noVowels.length > 2) {
        this.registerSipUsername(noVowels);
      }
    }

    return this;
  }

  /**
   * Register a callback at a specific HTTP path that decides how to route an
   * incoming request.
   *
   * When called, the endpoint at `path` will invoke `callback` with the parsed
   * request body. If `callback` returns a non-empty route string the server
   * responds with `{ action: "redirect", route }` so the platform can forward the
   * request to the right agent. If `callback` returns `null` / `undefined` the
   * agent's own SWML is returned instead (normal processing).
   *
   * Mirrors Python `swml_service.register_routing_callback` /
   * `web_mixin.register_routing_callback`.
   *
   * @param callback - Function receiving the parsed request body and returning a
   *   route string to redirect, or null/undefined for normal processing.
   * @param path - HTTP path where this callback endpoint is registered
   *   (default: '/sip').
   * @returns This agent instance for chaining.
   */
  registerRoutingCallback(
    callback: RoutingCallback,
    path = '/sip',
  ): this {
    // Normalize path: ensure leading slash, strip trailing slash
    let normalized = path.replace(/\/+$/, '') || '/';
    if (!normalized.startsWith('/')) normalized = `/${normalized}`;
    this._routingCallbacks.set(normalized, callback);
    // Invalidate cached app so getApp() re-registers routes with the new callback.
    // _app is non-nullable on the parent (SWMLService); rebuild fresh.
    this._app = new Hono();
    this._appBuiltByAgent = false;
    return this;
  }

  /**
   * Extract the SIP username from a request body's call.to field.
   * @param requestBody - The parsed request body containing call information.
   * @returns The extracted SIP username, or null if not found.
   */
  static extractSipUsername(requestBody: Record<string, unknown>): string | null {
    const call = requestBody?.['call'] as Record<string, unknown> | undefined;
    const callTo = call?.['to'] as string | undefined;
    if (callTo) {
      let uri = callTo;
      if (uri.startsWith('sip:') || uri.startsWith('sips:')) {
        uri = uri.replace(/^sips?:/, '');
      }
      const atIdx = uri.indexOf('@');
      if (atIdx > 0) return uri.substring(0, atIdx);
      return uri;
    }
    return null;
  }

  // ── MCP Integration ─────────────────────────────────────────────────

  /**
   * Add an external MCP server for tool discovery and invocation.
   * Tools are discovered via MCP protocol at session start and added to the AI's tool list.
   * @param url - MCP server HTTP endpoint URL
   * @param opts - Optional configuration: headers, resources, resourceVars
   * @returns This agent instance for chaining
   */
  addMcpServer(url: string, opts?: { headers?: Record<string, string>; resources?: boolean; resourceVars?: Record<string, string> }): this {
    const server: Record<string, unknown> = { url };
    if (opts?.headers && Object.keys(opts.headers).length) server['headers'] = opts.headers;
    if (opts?.resources) server['resources'] = true;
    if (opts?.resourceVars && Object.keys(opts.resourceVars).length) server['resource_vars'] = opts.resourceVars;
    this._mcpServers.push(server);
    return this;
  }

  /**
   * Expose this agent's tools as an MCP server endpoint at /mcp.
   * Adds a JSON-RPC 2.0 endpoint that MCP clients (Claude Desktop, other agents) can connect to.
   * @returns This agent instance for chaining
   */
  enableMcpServer(): this {
    this._mcpServerEnabled = true;
    return this;
  }

  /** Check if MCP server endpoint is enabled. */
  isMcpServerEnabled(): boolean {
    return this._mcpServerEnabled;
  }

  /** Get configured MCP servers (read-only copy). */
  getMcpServers(): Record<string, unknown>[] {
    return [...this._mcpServers];
  }

  /** Build MCP tool list from registered tools. */
  private buildMcpToolList(): Record<string, unknown>[] {
    const tools: Record<string, unknown>[] = [];
    for (const [name, fn] of this.toolRegistry) {
      if (fn instanceof SwaigFunction) {
        const tool: Record<string, unknown> = {
          name,
          description: fn.description || name,
        };
        if (fn.parameters && Object.keys(fn.parameters).length) {
          if ('type' in fn.parameters && 'properties' in fn.parameters) {
            tool['inputSchema'] = fn.parameters;
          } else {
            tool['inputSchema'] = {
              type: 'object',
              properties: fn.parameters,
              ...(fn.required.length ? { required: fn.required } : {}),
            };
          }
        } else {
          tool['inputSchema'] = { type: 'object', properties: {} };
        }
        tools.push(tool);
      }
    }
    return tools;
  }

  /** Handle an MCP JSON-RPC 2.0 request. Returns the response object. */
  async handleMcpRequest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const jsonrpc = (body['jsonrpc'] as string) || '';
    const method = (body['method'] as string) || '';
    const reqId = body['id'] ?? null;
    const params = (body['params'] as Record<string, unknown>) || {};

    if (jsonrpc !== '2.0') {
      return { jsonrpc: '2.0', id: reqId, error: { code: -32600, message: 'Invalid JSON-RPC version' } };
    }

    // Initialize handshake
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0', id: reqId,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: this.name, version: '1.0.0' },
        },
      };
    }

    // Initialized notification
    if (method === 'notifications/initialized') {
      return { jsonrpc: '2.0', id: reqId, result: {} };
    }

    // List tools
    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id: reqId, result: { tools: this.buildMcpToolList() } };
    }

    // Call tool
    if (method === 'tools/call') {
      const toolName = (params['name'] as string) || '';
      const args = (params['arguments'] as Record<string, unknown>) || {};

      const fn = this.toolRegistry.get(toolName);
      if (!fn || !(fn instanceof SwaigFunction)) {
        return { jsonrpc: '2.0', id: reqId, error: { code: -32602, message: `Unknown tool: ${toolName}` } };
      }

      try {
        const rawData = { function: toolName, argument: { parsed: [args] } };
        const resultDict = await fn.execute(args, rawData);
        const responseText = (resultDict['response'] as string) ?? '';
        return {
          jsonrpc: '2.0', id: reqId,
          result: { content: [{ type: 'text', text: responseText }], isError: false },
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          jsonrpc: '2.0', id: reqId,
          result: { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true },
        };
      }
    }

    // Ping
    if (method === 'ping') {
      return { jsonrpc: '2.0', id: reqId, result: {} };
    }

    return { jsonrpc: '2.0', id: reqId, error: { code: -32601, message: `Method not found: ${method}` } };
  }

  // ── Tools ───────────────────────────────────────────────────────────

  /**
   * Register a SWAIG tool (function) that the AI can invoke during a call.
   *
   * ## How this becomes a tool the model sees
   *
   * A SWAIG function is **exactly the same concept** as a "tool" in
   * native OpenAI / Anthropic tool calling. On every LLM turn, the SDK
   * renders each registered SWAIG function into the OpenAI tool schema:
   *
   * ```json
   * {
   *   "type": "function",
   *   "function": {
   *     "name":        "your_name_here",
   *     "description": "your description text",
   *     "parameters":  { /* your JSON schema *\/ }
   *   }
   * }
   * ```
   *
   * That schema goes to the model in the same API call that produces
   * the next assistant message. The model reads:
   *
   *   - the **function `description`** to decide WHEN to call this tool
   *   - each **parameter `description`** (inside the JSON schema) to
   *     decide HOW to fill in each argument
   *
   * This means **descriptions are prompt engineering**, not developer
   * comments. A vague description is the #1 cause of "the model has the
   * right tool but doesn't call it" failures.
   *
   * ### Bad vs good descriptions
   *
   * ```text
   * BAD : description: 'Lookup function'
   * GOOD: description: 'Look up a customer's account details by account
   *       number. Use this BEFORE quoting any account-specific info
   *       (balance, plan, status). Do not use for general product
   *       questions.'
   *
   * BAD : parameters: { id: { type: 'string', description: 'the id' } }
   * GOOD: parameters: { account_number: { type: 'string', description:
   *       'The customer's 8-digit account number, no dashes or spaces.
   *       Ask the user if they don't provide it.' } }
   * ```
   *
   * ### Tool count matters
   *
   * LLM tool selection accuracy degrades past ~7-8 simultaneously-active
   * tools per call. Use Step.setFunctions() to partition tools across
   * steps so only the relevant subset is active at any moment.
   *
   * @param opts - Tool definition including name, description, parameter
   *   schema, and handler callback. `description` and per-parameter
   *   `description` strings are LLM-facing prompt engineering.
   * @returns This agent instance for chaining.
   */
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
    /** External webhook URL; makes this an externally-hosted tool. */
    webhookUrl?: string;
    /** Additional fields to pass through to the SWAIG function definition (Python `**swaig_fields` equivalent). */
    extraFields?: Record<string, unknown>;
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
      webhookUrl: opts.webhookUrl,
      extraFields: opts.extraFields,
    });
    this.toolRegistry.set(opts.name, fn);
    return this;
  }

  /**
   * Register a SWAIG tool with a typed handler that receives named parameters
   * instead of the standard `(args, rawData)` convention.
   *
   * The SDK wraps the handler to unpack the args dict into positional params.
   * If no `parameters` schema is provided, one is inferred from the handler's
   * source code (parameter names and default values).
   *
   * @param opts - Tool definition with a typed handler function.
   * @returns This agent instance for chaining.
   */
  defineTypedTool(opts: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    handler: Function;
    secure?: boolean;
    fillers?: Record<string, string[]>;
    waitFile?: string;
    waitFileLoops?: number;
    required?: string[];
  }): this {
    let params = opts.parameters;
    let required = opts.required ?? [];
    let paramNames: string[];
    let hasRawData = false;

    const inferred = inferSchema(opts.handler);
    if (inferred) {
      paramNames = inferred.paramNames;
      hasRawData = inferred.hasRawData;
      if (!params) {
        params = inferred.parameters;
        required = inferred.required;
      }
    } else {
      // Could not infer — treat as old-style handler
      paramNames = [];
    }

    const wrapper = paramNames.length > 0
      ? createTypedHandlerWrapper(opts.handler, paramNames, hasRawData)
      : opts.handler as SwaigHandler;

    const fn = new SwaigFunction({
      name: opts.name,
      description: opts.description,
      parameters: params,
      handler: wrapper,
      secure: opts.secure,
      fillers: opts.fillers,
      waitFile: opts.waitFile,
      waitFileLoops: opts.waitFileLoops,
      required,
      isTypedHandler: true,
    });
    this.toolRegistry.set(opts.name, fn);
    return this;
  }

  // getRegisteredTools / getTool / registerSwaigFunction are inherited from
  // SWMLService (the toolRegistry was lifted there so non-AgentBase services
  // — sidecars, standalone SWAIG hosts — can use the same surface).

  /**
   * Validate a tool-call token for the given function.
   *
   * Mirrors Python reference `core/mixins/state_mixin.py validate_tool_token`:
   * 1. Unknown function → `false`.
   * 2. Registered but non-secure → `true` without consulting SessionManager
   *    (non-secure tools never require a token).
   * 3. Raw-dict descriptors (e.g. DataMap) are treated as secure, matching
   *    Python's `isinstance(func, dict) → is_secure = True` branch.
   * 4. Missing token on a secure tool → `false`.
   * 5. Otherwise delegate to `SessionManager.validateToolToken`.
   *
   * Divergences from the Python reference:
   * - No debug-logging branch: `AgentBase` does not expose an agent-level
   *   debug-mode flag, so the per-call debug telemetry Python emits is
   *   omitted. `SessionManager` still logs its own validation outcomes.
   * - No token-derived call-id fallback: `SessionManager.debugToken`
   *   truncates the embedded call-id for log safety, so an extracted value
   *   cannot be round-tripped back through `validateToolToken`. The caller
   *   is expected to supply a non-empty `callId`; an empty one is forwarded
   *   unchanged and the underlying validator will reject it.
   */
  validateToolToken(functionName: string, token: string, callId: string): boolean {
    const fn = this.toolRegistry.get(functionName);
    if (!fn) return false;
    const isSecure = fn instanceof SwaigFunction ? fn.secure : true;
    if (!isSecure) return true;
    if (!token) return false;
    try {
      return this.sessionManager.validateToolToken(functionName, token, callId);
    } catch {
      return false;
    }
  }

  /**
   * Mint a per-call SWAIG-function token via the agent's SessionManager.
   *
   * Mirrors Python reference `core/mixins/state_mixin.py _create_tool_token`:
   * delegates to `SessionManager.createToolToken` and returns an empty
   * string on any failure (Python catches all exceptions and returns "").
   */
  createToolToken(toolName: string, callId: string): string {
    try {
      return this.sessionManager.createToolToken(toolName, callId);
    } catch {
      return '';
    }
  }

  // ── Call flow ───────────────────────────────────────────────────────

  /**
   * Add a SWML verb to execute before the answer phase (phase 1).
   * @param verbName - Name of the SWML verb (e.g. "play", "record").
   * @param config - Verb configuration object.
   * @returns This agent instance for chaining.
   */
  addPreAnswerVerb(verbName: string, config: Record<string, unknown> | number): this {
    this.preAnswerVerbs.push([verbName, config as Record<string, unknown>]);
    return this;
  }

  /**
   * Configure the answer verb (phase 2) with optional settings.
   * @param config - Optional answer verb configuration.
   * @returns This agent instance for chaining.
   */
  addAnswerVerb(config?: Record<string, unknown>): this {
    this.answerConfig = config ?? {};
    return this;
  }

  /**
   * Add a SWML verb to execute after the answer phase but before the AI verb (phase 3).
   * @param verbName - Name of the SWML verb.
   * @param config - Verb configuration object.
   * @returns This agent instance for chaining.
   */
  addPostAnswerVerb(verbName: string, config: Record<string, unknown> | number): this {
    this.postAnswerVerbs.push([verbName, config as Record<string, unknown>]);
    return this;
  }

  /**
   * Add a SWML verb to execute after the AI verb (phase 5).
   * @param verbName - Name of the SWML verb.
   * @param config - Verb configuration object.
   * @returns This agent instance for chaining.
   */
  addPostAiVerb(verbName: string, config: Record<string, unknown>): this {
    this.postAiVerbs.push([verbName, config]);
    return this;
  }

  /**
   * Remove all pre-answer verbs.
   * @returns This agent instance for chaining.
   */
  clearPreAnswerVerbs(): this {
    this.preAnswerVerbs = [];
    return this;
  }

  /**
   * Remove all post-answer verbs.
   * @returns This agent instance for chaining.
   */
  clearPostAnswerVerbs(): this {
    this.postAnswerVerbs = [];
    return this;
  }

  /**
   * Remove all post-AI verbs.
   * @returns This agent instance for chaining.
   */
  clearPostAiVerbs(): this {
    this.postAiVerbs = [];
    return this;
  }

  /**
   * Get the agent's display name.
   * @returns The agent name string.
   */
  getName(): string {
    return this.name;
  }

  // ── Skills ─────────────────────────────────────────────────────────

  /**
   * Add a skill to this agent, registering its tools, prompt sections, hints, and global data.
   * @param skill - The skill instance to add.
   * @returns This agent instance for chaining.
   */
  async addSkill(skill: SkillBase): Promise<this> {
    skill.setAgent(this);
    await this._skillManager.addSkill(skill);

    // Register skill tools, then apply any swaigFields as extraFields on the SWAIG function
    for (const toolDef of skill.getTools()) {
      this.defineTool(toolDef);
      const fn = this.toolRegistry.get(toolDef.name);
      if (fn instanceof SwaigFunction) {
        // Apply skill-level swaigFields as the base, then let tool-level filler
        // flags override — matches Python skill_base.py:70-73 (swaig_fields base,
        // explicit kwargs win) and SkillBase.defineTool() ({...swaigDefaults, ...toolDef}).
        if (Object.keys(skill.swaigFields).length > 0) {
          safeAssign(fn.extraFields, skill.swaigFields);
        }
        if (toolDef.wait_for_fillers !== undefined) {
          fn.extraFields['wait_for_fillers'] = toolDef.wait_for_fillers;
        }
        if (toolDef.skip_fillers !== undefined) {
          fn.extraFields['skip_fillers'] = toolDef.skip_fillers;
        }
        // Propagate is_hangup_hook so the SignalWire platform auto-fires this
        // tool on call hangup (Python equivalent: is_hangup_hook=True in define_tool).
        if (toolDef.isHangupHook) {
          fn.extraFields['is_hangup_hook'] = true;
        }
      }
    }

    // Register DataMap-style tools — skills that build their own SWAIG JSON
    // (e.g. DataSphereServerless) return them via getDataMapTools().
    // Python equivalent: self.agent.register_swaig_function(swaig_function)
    // inside register_tools() (skills/datasphere_serverless/skill.py:210).
    for (const dmFn of skill.getDataMapTools()) {
      this.registerSwaigFunction(dmFn);
    }

    // Inject prompt sections
    for (const section of skill.getPromptSections()) {
      this.promptAddSection(section.title, section);
    }

    // Inject hints
    const hints = skill.getHints();
    if (hints.length) this.addHints(hints);

    // Merge global data
    const globalData = skill.getGlobalData();
    if (Object.keys(globalData).length) this.updateGlobalData(globalData);

    return this;
  }

  /**
   * Add a skill by its registered name, looking it up in the global SkillRegistry.
   *
   * Matches Python's `add_skill(skill_name, params)` which loads skills by string
   * name via the SkillManager registry. Throws a `ValueError`-equivalent if the
   * skill name is not found in the registry.
   *
   * @param skillName - The name the skill was registered under in the SkillRegistry.
   * @param params - Optional configuration parameters forwarded to the skill factory.
   * @returns This agent instance for chaining.
   * @throws Error if no skill with the given name is registered.
   */
  async addSkillByName(skillName: string, params?: SkillConfig): Promise<this> {
    const skill = SkillRegistry.getInstance().create(skillName, params);
    if (!skill) {
      throw new Error(`Failed to load skill '${skillName}': skill not found in registry`);
    }
    return this.addSkill(skill);
  }

  /**
   * Remove a previously added skill by its instance ID.
   * @param instanceId - The unique instance ID of the skill to remove.
   * @returns True if the skill was found and removed.
   */
  async removeSkill(instanceId: string): Promise<boolean> {
    return this._skillManager.removeSkill(instanceId);
  }

  /**
   * List all registered skills with their names, instance IDs, and initialization status.
   * @returns Array of skill descriptors.
   */
  listSkills(): { name: string; instanceId: string; initialized: boolean }[] {
    return this._skillManager.listSkills();
  }

  /**
   * Check whether a skill with the given name is registered.
   * @param skillName - The skill name to check.
   * @returns True if a skill with that name exists.
   */
  hasSkill(skillName: string): boolean {
    return this._skillManager.hasSkill(skillName);
  }

  /**
   * Remove a skill by its name (Python parity).
   *
   * Python's `remove_skill(skill_name)` removes by skill name.
   * The existing `removeSkill(instanceId)` removes by instance ID.
   * This method provides name-based removal for cross-SDK parity.
   *
   * @param skillName - The skill name to remove.
   * @returns True if a skill with that name was found and removed.
   */
  async removeSkillByName(skillName: string): Promise<boolean> {
    const entries = this._skillManager.listSkills();
    for (const entry of entries) {
      if (entry.name === skillName) {
        return this._skillManager.removeSkill(entry.instanceId);
      }
    }
    return false;
  }

  // ── Dynamic config ──────────────────────────────────────────────────

  /**
   * Set a callback invoked on each SWML request to dynamically modify an ephemeral agent copy.
   *
   * The callback receives a clone of this agent — mutations apply only to the current
   * request, so you can vary prompt, tools, languages, params, or global data per call
   * without affecting the long-lived agent instance.
   *
   * @param cb - Callback receiving `(queryParams, bodyParams, headers, agent)` where
   *   `agent` is the ephemeral `AgentBase` copy to mutate. May be async.
   * @returns This agent instance for chaining.
   *
   * @example
   * ```ts
   * agent.setDynamicConfigCallback((query, body, headers, agent) => {
   *   const lang = query.lang ?? 'en';
   *   if (lang === 'es') {
   *     (agent as AgentBase).setPromptText('Eres un asistente útil.');
   *   }
   * });
   * ```
   */
  setDynamicConfigCallback(cb: DynamicConfigCallback): this {
    this.dynamicConfigCallback = cb;
    return this;
  }

  /**
   * Add extra query parameters appended to all SWAIG webhook URLs.
   * @param params - Key-value pairs to append as query parameters.
   * @returns This agent instance for chaining.
   */
  addSwaigQueryParams(params: Record<string, string>): this {
    safeAssign(this.swaigQueryParams, params);
    return this;
  }

  /**
   * Clear all SWAIG query parameters.
   * @returns This agent instance for chaining.
   */
  clearSwaigQueryParams(): this {
    this.swaigQueryParams = {};
    return this;
  }

  // ── Proxy detection ────────────────────────────────────────────────

  /**
   * Manually set the proxy base URL used for webhook URL generation.
   * @param url - The external-facing base URL (trailing slashes are stripped).
   * @returns This agent instance for chaining.
   */
  manualSetProxyUrl(url: string): this {
    this._proxyUrlBase = url.replace(/\/+$/, '');
    this._proxyUrlBaseFromEnv = false;
    return this;
  }

  /**
   * Register a callback function that determines routing based on POST data.
   *
   * When a routing callback is registered, an endpoint at the specified path
   * is created in `getApp()`. The callback receives the request body and returns
   * Enable debug routes for testing and development.
   *
   * This is a backward-compatibility stub matching the Python SDK.
   * In the TypeScript SDK, debug routes (health, ready, debug_events)
   * are automatically registered in `getApp()`.
   *
   * @returns This agent instance for chaining.
   */
  enableDebugRoutes(): this {
    // No-op: debug routes are auto-registered in getApp()
    return this;
  }

  private detectProxyFromRequest(c: any): void {
    // Never override env var setting
    if (this._proxyUrlBaseFromEnv) return;
    // Only trust proxy headers when explicitly enabled
    if (!this._trustProxyHeaders) return;

    const get = (name: string): string | undefined =>
      c.req.header(name) ?? undefined;

    // 1. X-Forwarded-Host + X-Forwarded-Proto
    const xfHost = get('x-forwarded-host');
    if (xfHost) {
      const proto = get('x-forwarded-proto') ?? 'https';
      const url = `${proto}://${xfHost}`;
      if (this._proxyDebug) this.log.debug(`Proxy detected from X-Forwarded-Host: ${url}`);
      this._proxyUrlBase = url;
      return;
    }

    // 2. Forwarded header (RFC 7239): Forwarded: host=example.com;proto=https
    const forwarded = get('forwarded');
    if (forwarded) {
      const hostMatch = forwarded.match(/host=([^;,\s]+)/i);
      const protoMatch = forwarded.match(/proto=([^;,\s]+)/i);
      if (hostMatch && isValidHostname(hostMatch[1])) {
        const proto = protoMatch ? protoMatch[1] : 'https';
        const url = `${proto}://${hostMatch[1]}`;
        if (this._proxyDebug) this.log.debug(`Proxy detected from Forwarded header: ${url}`);
        this._proxyUrlBase = url;
        return;
      } else if (hostMatch) {
        this.log.warn(`Invalid hostname in Forwarded header: ${hostMatch[1]}`);
      }
    }

    // 3. X-Original-Host
    const xOrigHost = get('x-original-host');
    if (xOrigHost) {
      const proto = get('x-forwarded-proto') ?? 'https';
      const url = `${proto}://${xOrigHost}`;
      if (this._proxyDebug) this.log.debug(`Proxy detected from X-Original-Host: ${url}`);
      this._proxyUrlBase = url;
      return;
    }

    // 4. X-Forwarded-For (warn only - no host info)
    const xff = get('x-forwarded-for');
    if (xff && this._proxyDebug) {
      this.log.debug(`X-Forwarded-For detected (${xff}) but cannot determine host - set SWML_PROXY_URL_BASE manually`);
    }
  }

  // ── URL ─────────────────────────────────────────────────────────────

  /**
   * Override the default SWAIG webhook URL with a custom one.
   * @param url - The custom webhook URL.
   * @returns This agent instance for chaining.
   */
  setWebHookUrl(url: string): this {
    this.webHookUrlOverride = url;
    return this;
  }

  /**
   * Override the default post-prompt webhook URL with a custom one.
   * @param url - The custom post-prompt URL.
   * @returns This agent instance for chaining.
   */
  setPostPromptUrl(url: string): this {
    this.postPromptUrlOverride = url;
    return this;
  }

  /**
   * Get the full external URL of this agent, using the proxy base URL if available.
   * @param includeAuth - Whether to embed basic-auth credentials in the URL (defaults to false).
   * @returns The fully-qualified URL string.
   */
  getFullUrl(includeAuth = false): string {
    if (this._proxyUrlBase) {
      let base = this._proxyUrlBase.replace(/\/+$/, '');
      if (includeAuth) base = this.insertAuth(base);
      if (this.route && this.route !== '/') base += this.route;
      return base;
    }
    const protocol = this._enforceHttps ? 'https' : 'http';
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

  /**
   * Lifecycle hook called when a post-prompt summary is received. Override in subclasses.
   *
   * Invoked once at the end of a call when the AI has produced a structured summary
   * (configured via `setPostPrompt()` / `setPostPromptJson()`). Use this hook to persist
   * call data, notify other systems, or trigger follow-up workflows.
   *
   * @param _summary - Parsed summary object (JSON when the post-prompt requests
   *   structured output), or `null` if extraction/parsing failed.
   * @param _rawData - Full raw post-prompt payload received from the platform,
   *   including call metadata, conversation history, and the summary text.
   *
   * @example
   * ```ts
   * class MyAgent extends AgentBase {
   *   async onSummary(summary, rawData) {
   *     if (!summary) return;
   *     await db.calls.insert({
   *       callSid: rawData.call_id,
   *       summary,
   *       endedAt: new Date(),
   *     });
   *   }
   * }
   * ```
   */
  onSummary(_summary: Record<string, unknown> | null, _rawData: Record<string, unknown>): void | Promise<void> {
    // Default no-op
  }

  /**
   * Lifecycle hook called on every SWML request before rendering. Override in subclasses.
   *
   * May optionally return a modification dict that will be merged into the
   * rendered SWML document (matching Python's `Optional[dict]` return type).
   *
   * Matches Python `on_swml_request(request_data, callback_path, request)` — the third
   * parameter is the FastAPI `Request` in Python; here it is the raw Hono context object
   * so that subclasses can access query parameters (`context.req.query()`), raw request
   * headers (`context.req.raw.headers`), etc.
   *
   * @param _rawData - The parsed request body.
   * @param _callbackPath - Optional callback path from the request.
   * @param _context - The raw Hono context object (c), providing access to headers and query params.
   * @returns Optionally a dict of SWML modifications, or void.
   */
  onSwmlRequest(
    _rawData: Record<string, unknown>,
    _callbackPath?: string,
    _context?: any,
  ): Record<string, unknown> | void | Promise<Record<string, unknown> | void> {
    // Default no-op
  }

  /**
   * Lifecycle hook called when a debug event webhook is received. Override in subclasses.
   * @param _event - The debug event payload.
   */
  onDebugEvent(_event: Record<string, unknown>): void | Promise<void> {
    // Default no-op
  }

  /**
   * Override to add custom basic-auth validation logic beyond credential matching.
   * @param _username - The username from the request.
   * @param _password - The password from the request.
   * @returns True if the credentials are valid; false to reject the request.
   */
  validateBasicAuth(_username: string, _password: string): boolean | Promise<boolean> {
    return true;
  }

  /**
   * Hook called before each SWAIG function execution. Override in subclasses.
   *
   * **Behavioral note:** In the Python SDK, `on_function_call` IS the dispatcher
   * — it retrieves and executes the function, returning the result. In TypeScript,
   * `fn.execute()` is called separately after this hook. However, if this method
   * returns a non-void value, it is used as the result and the default execution
   * is skipped, enabling dispatch interception parity with Python.
   *
   * @param _name - Name of the function about to execute.
   * @param _args - Parsed arguments for the function.
   * @param _rawData - The full raw SWAIG request payload.
   * @returns Optionally a result dict to short-circuit default execution,
   *   or void/undefined to proceed normally.
   */
  onFunctionCall(
    _name: string,
    _args: Record<string, unknown>,
    _rawData: Record<string, unknown>,
  ): Record<string, unknown> | void | Promise<Record<string, unknown> | void> {
    // Default no-op
  }

  // ── 5-phase SWML rendering ─────────────────────────────────────────

  /**
   * Render the complete SWML document by assembling all 5 phases: pre-answer, answer,
   * post-answer, AI, and post-AI verbs.
   *
   * @param callId - Optional call ID to use for session tokens; auto-generated if omitted.
   * @param modifications - Optional dict returned from `onSwmlRequest` to merge into the AI
   *   verb config before rendering. Matches Python's `_render_swml(modifications)` semantics:
   *   `global_data` is deep-merged; all other keys override the AI config directly.
   * @returns The rendered SWML document as a JSON string.
   */
  renderSwml(callId?: string, modifications?: Record<string, unknown>): string {
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
    if (this._nativeFunctions.length) swaigObj['native_functions'] = this._nativeFunctions;
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
        safeAssign(entry, fn.extraFields);
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

    // MCP servers
    if (this._mcpServers.length) {
      swaigObj['mcp_servers'] = [...this._mcpServers];
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

    // Debug events
    if (this.debugEventsEnabled) {
      aiConfig['debug_webhook_url'] = this.buildWebhookUrl('debug_events');
      aiConfig['debug_webhook_level'] = this.debugEventsLevel;
    }

    // Apply modifications from onSwmlRequest (Python parity: merge into AI verb config).
    // global_data is deep-merged; all other keys override AI config fields directly.
    if (modifications && typeof modifications === 'object') {
      if (modifications['global_data'] && typeof modifications['global_data'] === 'object') {
        aiConfig['global_data'] = {
          ...(aiConfig['global_data'] as Record<string, unknown> ?? {}),
          ...(modifications['global_data'] as Record<string, unknown>),
        };
      }
      for (const [key, value] of Object.entries(modifications)) {
        if (key !== 'global_data') {
          aiConfig[key] = value;
        }
      }
    }

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
    copy._promptManager = new PromptManager(true);
    // Carry over the current prompt
    const p = this.getPrompt();
    if (p) copy._promptManager.setPromptText(p);
    const pp = this.getPostPrompt();
    if (pp) copy._promptManager.setPostPrompt(pp);
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

    // Replay skills into the ephemeral copy so dynamic config callbacks can modify them
    copy._skillManager = new SkillManager();
    for (const entry of this._skillManager.getLoadedSkillEntries()) {
      try {
        const skill = new (entry.SkillClass as any)(entry.config);
        skill.setAgent(copy);
        // Synchronous re-add: mark initialized, register tools/prompts/hints/data
        skill.markInitialized();
        copy._skillManager.addSkill(skill).catch((err: unknown) => {
          // Swallow re-add errors in the cloning path — the primary agent already
          // validated env vars / packages / schema / setup when this skill was first
          // added, and the clone inherits that validation. Python's equivalent at
          // skill_manager.py:161-170 specifically swallows "already exists"
          // ValueErrors during cloning; TS has no such error class (toolRegistry
          // uses Map.set which silently overwrites), so the blanket swallow is
          // the closest parity. Log at debug so the error isn't entirely lost.
          this.log.debug('Skipping re-add error during agent clone', {
            skill: entry.skillName,
            error: err instanceof Error ? err.message : String(err),
          });
        });

        for (const toolDef of skill.getTools()) {
          copy.defineTool(toolDef);
          const fn = copy.toolRegistry.get(toolDef.name);
          if (fn instanceof SwaigFunction) {
            if (Object.keys(skill.swaigFields).length > 0) {
              safeAssign(fn.extraFields, skill.swaigFields);
            }
            if (toolDef.wait_for_fillers !== undefined) {
              fn.extraFields['wait_for_fillers'] = toolDef.wait_for_fillers;
            }
            if (toolDef.skip_fillers !== undefined) {
              fn.extraFields['skip_fillers'] = toolDef.skip_fillers;
            }
            if (toolDef.isHangupHook) {
              fn.extraFields['is_hangup_hook'] = true;
            }
          }
        }
        for (const dmFn of skill.getDataMapTools()) {
          copy.registerSwaigFunction(dmFn);
        }
        for (const section of skill.getPromptSections()) {
          copy.promptAddSection(section.title, section);
        }
        const hints = skill.getHints();
        if (hints.length) copy.addHints(hints);
        const globalData = skill.getGlobalData();
        if (Object.keys(globalData).length) copy.updateGlobalData(globalData);
      } catch (e) {
        this.log.warn(`Failed to replay skill '${entry.skillName}' in ephemeral copy: ${e}`);
      }
    }

    return copy;
  }

  // ── Hono HTTP app ───────────────────────────────────────────────────

  /**
   * Get or lazily create the Hono HTTP application with all routes, middleware, auth, and CORS.
   * @returns The configured Hono application instance.
   */
  getApp(): Hono {
    // Service's constructor eagerly initialised _app; AgentBase rebuilds it
    // here with its own middleware stack and route handlers on first call.
    if (this._appBuiltByAgent) return this._app;

    const app = new Hono();

    // Security headers
    const requestTimeout = parseInt(process.env['SWML_REQUEST_TIMEOUT'] ?? '30000', 10);
    const maxRequestSize = parseInt(process.env['SWML_MAX_REQUEST_SIZE'] ?? '1048576', 10);
    app.use('*', async (c, next) => {
      await next();
      c.res.headers.set('X-Content-Type-Options', 'nosniff');
      c.res.headers.set('X-Frame-Options', 'DENY');
      c.res.headers.set('X-XSS-Protection', '1; mode=block');
      c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      c.res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    });

    // Request size limit
    app.use('*', async (c, next) => {
      const contentLength = c.req.header('content-length');
      const size = parseInt(contentLength ?? '', 10);
      if (contentLength && (isNaN(size) || size > maxRequestSize)) {
        return c.json({ error: 'Request too large' }, 413);
      }
      await next();
    });

    // Allowed hosts (configurable via env)
    const allowedHosts = process.env['SWML_ALLOWED_HOSTS'];
    if (allowedHosts) {
      const hostSet = new Set(allowedHosts.split(',').map(h => h.trim().toLowerCase()));
      app.use('*', async (c, next) => {
        const host = (c.req.header('host') ?? '').split(':')[0].toLowerCase();
        if (!hostSet.has(host)) {
          return c.json({ error: 'Forbidden: host not allowed' }, 403);
        }
        await next();
      });
    }

    // Rate limiting (configurable via env, requests per minute per IP)
    const rateLimitStr = process.env['SWML_RATE_LIMIT'];
    if (rateLimitStr) {
      const maxPerMinute = parseInt(rateLimitStr, 10);
      if (maxPerMinute > 0) {
        const hits = new Map<string, { count: number; resetAt: number }>();
        app.use('*', async (c, next) => {
          const ip = this._trustProxyHeaders
            ? (c.req.header('x-forwarded-for')?.split(',')[0].trim()
              ?? c.req.header('x-real-ip')
              ?? 'unknown')
            : 'unknown';
          const now = Date.now();
          let entry = hits.get(ip);
          if (!entry || now >= entry.resetAt) {
            entry = { count: 0, resetAt: now + 60_000 };
            hits.set(ip, entry);
          }
          // Cleanup if map grows too large
          if (hits.size > 10000) {
            for (const [k, v] of hits) {
              if (now >= v.resetAt) hits.delete(k);
            }
          }
          entry.count++;
          if (entry.count > maxPerMinute) {
            return c.json({ error: 'Rate limit exceeded' }, 429);
          }
          await next();
        });
      }
    }

    // CORS (configurable via env)
    const corsOrigins = process.env['SWML_CORS_ORIGINS'];
    const corsOrigin = corsOrigins ? corsOrigins.split(',').map(o => o.trim()) : '*';
    const corsCredentials = corsOrigin !== '*';
    app.use('*', cors({ origin: corsOrigin, credentials: corsCredentials }));

    // CSRF protection (optional, gated by env)
    if (process.env['SWML_CSRF_PROTECTION'] === 'true') {
      const allowedOrigins = corsOrigins
        ? new Set(corsOrigins.split(',').map(o => o.trim().toLowerCase()))
        : null;
      app.use('*', async (c, next) => {
        if (c.req.method === 'POST') {
          const origin = c.req.header('origin');
          if (origin && allowedOrigins && !allowedOrigins.has(origin.toLowerCase())) {
            return c.json({ error: 'Origin not allowed' }, 403);
          }
        }
        await next();
      });
    }

    // Auth middleware
    const [user, pass] = this.basicAuthCreds;
    const authMw = basicAuth({ username: user, password: pass });

    const basePath = this.route === '/' ? '' : this.route;

    // Root - returns SWML
    const handleSwml = async (c: any) => {
      let reqLog = this.log.bind({ endpoint: this.route });
      reqLog.debug('endpoint_called');

      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* GET or no body */ }

      reqLog.debug('request_body_received', { body_size: JSON.stringify(body).length });

      this.detectProxyFromRequest(c);
      const callbackPath = (body['callback_path'] as string) ?? undefined;
      let swmlMods: Record<string, unknown> | void = undefined;
      try {
        swmlMods = await this.onSwmlRequest(body, callbackPath, c);
        if (swmlMods) reqLog.debug('on_swml_request_modifications_applied');
      } catch (err) {
        reqLog.error('error_in_on_swml_request', { error: err instanceof Error ? err.message : String(err) });
      }

      const callId = (body['call_id'] as string) || undefined;
      if (callId) reqLog = reqLog.bind({ call_id: callId });

      let agentToUse: AgentBase = this;
      if (this.dynamicConfigCallback) {
        agentToUse = this.createEphemeralCopy();
        const queryParams: Record<string, string> = {};
        const url = new URL(c.req.url);
        url.searchParams.forEach((v: string, k: string) => { queryParams[k] = v; });
        const rawHeaders: Record<string, string> = {};
        c.req.raw.headers.forEach((v: string, k: string) => { rawHeaders[k] = v; });
        const headers = filterSensitiveHeaders(rawHeaders);
        await this.dynamicConfigCallback(queryParams, body, headers, agentToUse);
        reqLog.debug('dynamic_config_complete');
      }

      const swml = agentToUse.renderSwml(callId, swmlMods || undefined);
      reqLog.debug('swml_rendered', { swml_size: swml.length });
      reqLog.info('request_successful');
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
      let reqLog = this.log.bind({ endpoint: `${basePath}/swaig` });
      reqLog.debug('endpoint_called');

      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* empty */ }

      const fnName = body['function'] as string;
      if (!fnName) return c.json({ error: 'Missing function name' }, 400);
      if (fnName.length > 128) return c.json({ error: 'Invalid function name' }, 400);
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fnName)) {
        reqLog.warn('invalid_function_name_format', { function: fnName });
        return c.json({ error: 'Invalid function name' }, 400);
      }

      reqLog = reqLog.bind({ function: fnName });
      reqLog.debug('function_call_received');

      const callIdStr = (body['call_id'] as string) ?? '';
      if (callIdStr) reqLog = reqLog.bind({ call_id: callIdStr });

      const fn = this.toolRegistry.get(fnName);
      if (!fn || !(fn instanceof SwaigFunction)) {
        reqLog.warn('function_not_found', { requested: fnName });
        return c.json({ error: `Unknown function: ${fnName}` }, 404);
      }

      // Token validation for secure functions
      if (fn.secure) {
        const url = new URL(c.req.url);
        const token = url.searchParams.get('__token') ?? url.searchParams.get('token');
        if (!token) {
          reqLog.warn('missing_token');
          const result = new FunctionResult(
            'The security token for this function is missing or expired. This action cannot be completed.'
          );
          return c.json(result.toDict());
        }
        if (!this.sessionManager.validateToken(callIdStr, fnName, token)) {
          reqLog.warn('token_invalid');
          const result = new FunctionResult(
            'The security token for this function is invalid or expired. This action cannot be completed.'
          );
          return c.json(result.toDict());
        }
        reqLog.debug('token_valid');
      }

      const rawArgs = body['argument'];
      const args: Record<string, unknown> =
        (rawArgs !== null && typeof rawArgs === 'object' && !Array.isArray(rawArgs))
          ? rawArgs as Record<string, unknown>
          : {};
      reqLog.debug('executing_function', { args: JSON.stringify(args) });
      const hookResult = await this.onFunctionCall(fnName, args, body);

      // If onFunctionCall returned a result, use it (dispatch interception)
      if (hookResult !== undefined && hookResult !== null) {
        reqLog.info('function_intercepted_by_hook');
        return c.json(hookResult);
      }

      try {
        const result = await fn.execute(args, body);
        reqLog.info('function_executed_successfully');
        reqLog.debug('function_result', { result_size: JSON.stringify(result).length });
        return c.json(result);
      } catch (err) {
        reqLog.error('function_execution_error', { error: err instanceof Error ? err.message : String(err) });
        return c.json({ error: 'Function execution failed' }, 500);
      }
    };

    app.get(`${basePath}/swaig`, authMw, handleSwaig);
    app.post(`${basePath}/swaig`, authMw, handleSwaig);

    // Post-prompt handler
    const handlePostPrompt = async (c: any) => {
      let reqLog = this.log.bind({ endpoint: `${basePath}/post_prompt` });
      reqLog.debug('endpoint_called');

      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* empty */ }

      const callId = (body['call_id'] as string) || undefined;
      if (callId) reqLog = reqLog.bind({ call_id: callId });

      reqLog.info('post_prompt_received');

      const summary = this.findSummary(body);
      await this.onSummary(summary, body);
      return c.json({ ok: true });
    };

    app.get(`${basePath}/post_prompt`, authMw, handlePostPrompt);
    app.post(`${basePath}/post_prompt`, authMw, handlePostPrompt);

    // Debug events handler
    const handleDebugEvents = async (c: any) => {
      const reqLog = this.log.bind({ endpoint: `${basePath}/debug_events` });
      reqLog.debug('endpoint_called');

      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* empty */ }

      reqLog.debug('debug_event_received', body);
      await this.onDebugEvent(body);
      return c.json({ ok: true });
    };

    app.post(`${basePath}/debug_events`, authMw, handleDebugEvents);

    // MCP server endpoint (JSON-RPC 2.0)
    if (this._mcpServerEnabled) {
      app.post(`${basePath}/mcp`, async (c: any) => {
        let body: Record<string, unknown> = {};
        try { body = await c.req.json(); } catch {
          return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        }
        const result = await this.handleMcpRequest(body);
        return c.json(result);
      });
    }

    // Post-prompt override endpoint (enabled via constructor option)
    if (this._enablePostPromptOverride) {
      const handlePostPromptOverride = async (c: any) => {
        const reqLog = this.log.bind({ endpoint: `${basePath}/post_prompt_override` });
        reqLog.debug('endpoint_called');

        let body: Record<string, unknown> = {};
        try { body = await c.req.json(); } catch { /* empty */ }

        const newPostPrompt = body['post_prompt'] as string | undefined;
        if (newPostPrompt !== undefined) {
          this.setPostPrompt(newPostPrompt);
          reqLog.info('post_prompt_overridden');
        }
        return c.json({ ok: true });
      };

      app.post(`${basePath}/post_prompt_override`, authMw, handlePostPromptOverride);
    }

    // Check-for-input endpoint (enabled via constructor option)
    if (this._checkForInputOverride) {
      const handleCheckForInput = async (c: any) => {
        const reqLog = this.log.bind({ endpoint: `${basePath}/check_for_input` });
        reqLog.debug('endpoint_called');

        let body: Record<string, unknown> = {};
        try { body = await c.req.json(); } catch { /* empty */ }

        reqLog.info('check_for_input_received');
        return c.json({ ok: true, received: body });
      };

      app.get(`${basePath}/check_for_input`, authMw, handleCheckForInput);
      app.post(`${basePath}/check_for_input`, authMw, handleCheckForInput);
    }


    // Routing callbacks (registered via registerRoutingCallback)
    for (const [callbackPath, callback] of this._routingCallbacks) {
      const fullPath = basePath ? `${basePath}${callbackPath}` : callbackPath;
      const handleRouting = async (c: any) => {
        const reqLog = this.log.bind({ endpoint: fullPath });
        reqLog.debug('routing_callback_called');

        let body: Record<string, unknown> = {};
        try { body = await c.req.json(); } catch { /* GET or no body */ }

        try {
          const route = await callback(body);
          if (route) {
            reqLog.info('routing_callback_redirect', { route });
            return c.json({ action: 'redirect', route });
          }
          // No redirect — return SWML for this agent
          this.detectProxyFromRequest(c);
          const swml = this.renderSwml();
          return c.json(JSON.parse(swml));
        } catch (err) {
          reqLog.error('routing_callback_error', { error: err instanceof Error ? err.message : String(err) });
          return c.json({ error: 'Routing callback failed' }, 500);
        }
      };

      app.get(fullPath, authMw, handleRouting);
      app.post(fullPath, authMw, handleRouting);
    }

    // Health / Ready
    app.get(`${basePath}/health`, (c: any) => c.json({ status: 'ok' }));
    app.get(`${basePath}/ready`, (c: any) => c.json({ status: 'ready' }));

    this._app = app;
    this._appBuiltByAgent = true;
    return app;
  }

  /**
   * Return this agent's Hono app for mounting as a sub-router in an AgentServer.
   * @returns The Hono application instance.
   */
  asRouter(): Hono {
    return this.getApp();
  }

  /**
   * Start the HTTP server and begin listening for requests.
   *
   * Uses `@hono/node-server` under the hood. When run in CLI mode
   * (`SWAIG_CLI_MODE=true`, set automatically by `npx swaig-test`), this is a
   * no-op so agent config can be inspected without starting a server.
   *
   * @param opts - Optional host/port overrides. Defaults to the values provided
   *   in the constructor options or the `PORT` environment variable.
   * @returns A promise that resolves once the server has begun listening.
   *
   * @example
   * ```ts
   * const agent = new AgentBase({ name: 'demo', port: 3000 });
   * await agent.serve();
   * // Or override at runtime:
   * await agent.serve({ port: 8080, host: '127.0.0.1' });
   * ```
   */
  async serve(opts?: { host?: string; port?: number }): Promise<void> {
    // When loaded by the CLI tool, skip server startup — only the agent config is needed.
    if (process.env['SWAIG_CLI_MODE'] === 'true') return;

    const host = opts?.host ?? this.host;
    const port = opts?.port ?? this.port;

    const { serve: honoServe } = await import('@hono/node-server');
    const app = this.getApp();
    const listenUrl = `http://${host}:${port}${this.route}`;
    this.log.info(`Agent '${this.name}' running at ${listenUrl}`);
    this.log.info(`Auth: ${this.basicAuthCreds[0]}:**** (source: ${this.basicAuthSource})`);
    if (this._proxyUrlBase) {
      this.log.info(`Proxy URL: ${redactUrl(this._proxyUrlBase)}`);
    }
    honoServe({ fetch: app.fetch, port, hostname: host });
  }

  /**
   * Alias for {@link serve}. Starts the HTTP server.
   * @param opts - Optional host and port overrides.
   * @returns A promise that resolves once the server is running.
   */
  async run(opts?: { host?: string; port?: number }): Promise<void> {
    return this.serve(opts);
  }

  /**
   * Handle a single serverless invocation (AWS Lambda, Google Cloud Functions, Azure Functions, or CGI).
   *
   * Matches Python `run(event, context)` when executed in a serverless environment. Python's
   * `run()` auto-detects the platform via `get_execution_mode()` and dispatches accordingly;
   * in TypeScript the serverless path is an **explicit** method so that `run()` keeps its
   * HTTP-server semantics and callers opt in to serverless dispatch deliberately.
   *
   * Platform detection follows the same environment-variable heuristics as Python's
   * `ServerlessMixin`: `AWS_LAMBDA_FUNCTION_NAME` → Lambda, `K_SERVICE` → GCF,
   * `FUNCTIONS_WORKER_RUNTIME` → Azure, `GATEWAY_INTERFACE` → CGI.
   *
   * Usage in a Lambda handler file:
   * ```ts
   * export const handler = (event: any, context: any) => agent.runServerless(event, context);
   * ```
   *
   * @param event - The serverless event payload (Lambda event, GCF request body, etc.).
   * @param context - The serverless context object (Lambda context, Azure context, etc.).
   * @param platform - Optional platform override; defaults to 'auto' (environment detection).
   * @returns The normalized serverless response object.
   */
  async runServerless(
    event: ServerlessEvent,
    context?: unknown,
    platform?: 'lambda' | 'gcf' | 'azure' | 'cgi' | 'auto',
  ): Promise<ServerlessResponse> {
    void context; // context is available for subclasses; not used in base routing
    const adapter = new ServerlessAdapter(platform ?? 'auto');
    const app = this.getApp();
    // Wrap Hono's fetch (which returns `Response | Promise<Response>`) into a plain
    // `Promise<Response>` so it satisfies ServerlessAdapter.handleRequest's type constraint.
    const fetchFn = (req: Request): Promise<Response> => Promise.resolve(app.fetch(req));
    return adapter.handleRequest({ fetch: fetchFn }, event);
  }

  // ── Graceful shutdown ─────────────────────────────────────────────

  private static _shutdownRegistered = false;

  /**
   * Register process signal handlers for clean Kubernetes/Docker shutdown.
   * Handles SIGTERM and SIGINT, waits for a timeout, then exits.
   * @param opts - Optional timeout in milliseconds (default 5000).
   */
  static setupGracefulShutdown(opts?: { timeout?: number }): void {
    if (AgentBase._shutdownRegistered) return;
    AgentBase._shutdownRegistered = true;

    const timeout = opts?.timeout ?? 5000;
    const log = getLogger('GracefulShutdown');

    const handler = (signal: string) => {
      log.info(`Received ${signal}, shutting down in ${timeout}ms...`);
      setTimeout(() => {
        log.info('Shutdown complete.');
        process.exit(0);
      }, timeout);
    };

    process.on('SIGTERM', () => handler('SIGTERM'));
    process.on('SIGINT', () => handler('SIGINT'));
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

  /**
   * Get the basic-auth credentials used by this agent.
   * @param includeSource - When true, a third element indicating the credential source is appended.
   * @returns A tuple of [username, password] or [username, password, source].
   */
  getBasicAuthCredentials(includeSource?: false): [string, string];
  getBasicAuthCredentials(includeSource: true): [string, string, 'provided' | 'environment' | 'auto-generated'];
  getBasicAuthCredentials(includeSource?: boolean): [string, string] | [string, string, 'provided' | 'environment' | 'auto-generated'] {
    if (includeSource) return [...this.basicAuthCreds, this.basicAuthSource];
    return this.basicAuthCreds;
  }
}
