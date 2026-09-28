/**
 * DataMap - Fluent builder for SWAIG data_map configurations.
 *
 * Creates server-side tool definitions that execute on SignalWire
 * without requiring webhook endpoints.
 */

import { FunctionResult, type SwaigResultDict } from './FunctionResult.js';

const ENV_PATTERN = /\$\{ENV\.([^}]+)\}/g;

/** Default allowed env var prefixes for expansion. */
let globalAllowedEnvPrefixes: string[] = ['SIGNALWIRE_', 'SWML_', 'SW_'];

/**
 * Set the global allowed env var prefixes for `${ENV.*}` expansion.
 *
 * This is the default list for every DataMap that has no list of its own
 * (see {@link DataMap.setAllowedEnvPrefixes}), read when each DataMap's
 * `toSwaigFunction()` runs. Only variables whose names start with one of
 * these prefixes are expanded; any other `${ENV.NAME}` becomes an empty
 * string. The default is `['SIGNALWIRE_', 'SWML_', 'SW_']`.
 *
 * Expanded values are written into the SWML document, so the list limits
 * which variables a template can publish there. An empty array allows every
 * variable and removes that protection.
 *
 * @param prefixes - Array of prefix strings to allow.
 */
export function setAllowedEnvPrefixes(prefixes: string[]): void {
  globalAllowedEnvPrefixes = prefixes;
}

/**
 * Get the current global allowed env var prefixes.
 * @returns A copy of the current prefix list.
 */
export function getAllowedEnvPrefixes(): string[] {
  return [...globalAllowedEnvPrefixes];
}

function isEnvVarAllowed(varName: string, allowedPrefixes: string[]): boolean {
  if (allowedPrefixes.length === 0) return true;
  return allowedPrefixes.some((prefix) => varName.startsWith(prefix));
}

function expandEnvVars(value: string, allowedPrefixes: string[]): string {
  return value.replace(ENV_PATTERN, (_match, varName: string) => {
    if (!isEnvVarAllowed(varName, allowedPrefixes)) return '';
    return process.env[varName] ?? '';
  });
}

function expandEnvInObject(obj: unknown, allowedPrefixes: string[]): unknown {
  if (typeof obj === 'string') return expandEnvVars(obj, allowedPrefixes);
  if (Array.isArray(obj)) return obj.map((item) => expandEnvInObject(item, allowedPrefixes));
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = expandEnvInObject(v, allowedPrefixes);
    }
    return result;
  }
  return obj;
}

/**
 * Fluent builder for SWAIG data_map configurations.
 *
 * Builds a SWAIG function whose `data_map` the SignalWire platform runs, so
 * the tool needs no webhook endpoint in your application. The platform makes
 * the HTTP requests, matches the expressions and expands the templates; this
 * class only builds the definition. In an output template, a webhook's JSON
 * response is read from the root of the template data (`${temp}`), an array
 * response is under `array` (`${array[0].joke}`), and arguments are under
 * `args` (`${args.city}`).
 *
 * @example Simple webhook-driven tool (no handler needed)
 * ```ts
 * import { DataMap, FunctionResult } from '@signalwire/sdk';
 *
 * const weather = new DataMap('get_weather')
 *   .purpose('Look up the current weather for a city')
 *   .parameter('city', 'string', 'The city name', { required: true })
 *   .webhook('GET', 'https://api.example.com/weather?city=${enc:args.city}')
 *   .output(new FunctionResult('In ${args.city} it is ${temp}°F and ${condition}.'));
 *
 * // Register onto an agent:
 * agent.registerSwaigFunction(weather.toSwaigFunction());
 * ```
 *
 * @example Expression-based tool (no webhook, pattern matching only)
 * ```ts
 * new DataMap('classify_intent')
 *   .purpose('Route callers to the right department.')
 *   .parameter('utterance', 'string', 'What the caller said', { required: true })
 *   .expression('${lc:args.utterance}', 'billing|invoice|charge', new FunctionResult('billing'))
 *   .expression('${lc:args.utterance}', 'tech|broken|error', new FunctionResult('support'));
 * ```
 *
 * @see {@link FunctionResult}: the response shape used in `.output()` and `.expression()`
 * @see {@link createSimpleApiTool}: a helper for a tool with one webhook and one output
 * @see {@link AgentBase.defineTool}: for tools that run in your process
 */
export class DataMap {
  /** The name of the SWAIG function this data map defines. */
  functionName: string;
  private _purpose = '';
  private _parameters: Record<string, unknown> = {};
  private _expressions: Record<string, unknown>[] = [];
  private _webhooks: Record<string, unknown>[] = [];
  private _output: SwaigResultDict | null = null;
  private _errorKeys: string[] = [];
  private _expandEnv = false;
  private _allowedEnvPrefixes: string[] | null = null;

  /**
   * @param functionName - The unique name for this data map tool.
   */
  constructor(functionName: string) {
    this.functionName = functionName;
  }

  /**
   * Turn on `${ENV.NAME}` expansion for this DataMap (off until called).
   *
   * The SDK, not the platform, does this expansion: `toSwaigFunction()`
   * replaces each `${ENV.NAME}` in every string of the definition with
   * `process.env.NAME`, or with an empty string when the variable is unset or
   * its name has no allowed prefix (see {@link DataMap.setAllowedEnvPrefixes}).
   * The values are written into the SWML document.
   *
   * @param enabled - Whether to turn expansion on (defaults to true).
   * @returns This instance for chaining.
   */
  enableEnvExpansion(enabled = true): this {
    this._expandEnv = enabled;
    return this;
  }

  /**
   * Set the allowed env var prefixes for this DataMap instance.
   *
   * Replaces the global default list (`SIGNALWIRE_`, `SWML_`, `SW_` unless
   * changed with the exported `setAllowedEnvPrefixes()`) for this DataMap.
   * Only variables whose names start with one of these prefixes are
   * expanded. An empty array allows every variable.
   *
   * @param prefixes - Array of prefix strings to allow.
   * @returns This instance for chaining.
   */
  setAllowedEnvPrefixes(prefixes: string[]): this {
    this._allowedEnvPrefixes = prefixes;
    return this;
  }

  /**
   * Set the purpose (description) for this data-map tool. The model reads it.
   *
   * This string becomes the function's `description` in the SWML, which the
   * model reads to decide WHEN to call this tool. Write it as a prompt, not
   * as developer documentation. With a vague `purpose()`, the model can have
   * the right tool and not call it.
   *
   * ### Bad vs good
   *
   * ```text
   * BAD : .purpose('weather api')
   * GOOD: .purpose('Get the current weather conditions and forecast for
   *       a specific city. Use this whenever the user asks about weather,
   *       temperature, rain, or similar conditions in a named location.')
   * ```
   *
   * @param description - Prompt-engineering description of when to call this tool.
   * @returns This instance for chaining.
   */
  purpose(description: string): this {
    this._purpose = description;
    return this;
  }

  /**
   * Alias for {@link purpose}; sets the LLM-facing tool description.
   *
   * This string is read by the model to decide WHEN to call this tool.
   * See {@link purpose} for bad-vs-good examples.
   *
   * @param description - Prompt-engineering description of when to call this tool.
   * @returns This instance for chaining.
   */
  description(description: string): this {
    return this.purpose(description);
  }

  /**
   * Define a parameter for this data-map tool. The model reads its `description`.
   *
   * Each parameter's `description` becomes
   * `parameters.properties.<name>.description` in the SWML. The model reads
   * it to decide HOW to fill in the argument from what the caller said.
   * Write it as a prompt, not as developer documentation.
   *
   * ### Bad vs good
   *
   * ```text
   * BAD : .parameter('city', 'string', 'the city')
   * GOOD: .parameter('city', 'string',
   *         'The name of the city to get weather for, e.g. "San Francisco".
   *          Ask the user if they did not provide one. Include the state
   *          or country if the city name is ambiguous.')
   * ```
   *
   * @param name - The parameter name (JSON object key).
   * @param paramType - The JSON Schema type (e.g., "string", "number").
   * @param description - Prompt-engineering description telling the model
   *   how to extract this value from the user's utterance. Read by the LLM.
   * @param opts - Options object: `{ required: true }` lists the parameter in the
   *   schema's `required` array, and `enum` restricts its values.
   * @returns This instance for chaining.
   */
  parameter(
    name: string,
    paramType: string,
    description: string,
    opts?: { required?: boolean; enum?: string[] },
  ): this {
    const paramDef: Record<string, unknown> = { type: paramType, description };
    if (opts?.enum) paramDef['enum'] = opts.enum;
    this._parameters[name] = paramDef;

    if (opts?.required) {
      if (!this._parameters['_required']) {
        this._parameters['_required'] = [];
      }
      const req = this._parameters['_required'] as string[];
      if (!req.includes(name)) req.push(name);
    }
    return this;
  }

  /**
   * Add a pattern-matching expression that evaluates a test value against a regex.
   * @param testValue - The string or template variable to test, such as `'${args.input}'`.
   * @param pattern - A regex pattern (string or RegExp) to match against. For a
   *   RegExp only `.source` is kept, so flags such as `/i` are dropped; write
   *   `(?i)` into the pattern string instead.
   * @param output - The result to return when the pattern matches.
   * @param nomatchOutput - Optional result, written as `nomatch-output`. The SWML
   *   schema's expression object doesn't define that key; a final catch-all
   *   expression (pattern `.*`) is the documented way to answer a non-match.
   * @returns This instance for chaining.
   */
  expression(
    testValue: string,
    pattern: string | RegExp,
    output: FunctionResult,
    nomatchOutput?: FunctionResult,
  ): this {
    const patternStr = typeof pattern === 'string' ? pattern : pattern.source;
    const expr: Record<string, unknown> = {
      string: testValue,
      pattern: patternStr,
      output: output.toDict(),
    };
    if (nomatchOutput) {
      expr['nomatch-output'] = nomatchOutput.toDict();
    }
    this._expressions.push(expr);
    return this;
  }

  /**
   * Add a webhook that is called when this data map tool is invoked.
   * @param method - HTTP method (e.g., "GET", "POST").
   * @param url - The webhook URL to call.
   * @param opts - Optional `headers`, `formParam` (written as `form_param`, which the
   *   SWML schema doesn't define), `inputArgsAsParams` and `requireArgs`.
   * @returns This instance for chaining.
   */
  webhook(
    method: string,
    url: string,
    opts?: {
      headers?: Record<string, string>;
      formParam?: string;
      inputArgsAsParams?: boolean;
      requireArgs?: string[];
    },
  ): this {
    const def: Record<string, unknown> = { url, method: method.toUpperCase() };
    if (opts?.headers) def['headers'] = opts.headers;
    if (opts?.formParam) def['form_param'] = opts.formParam;
    if (opts?.inputArgsAsParams) def['input_args_as_params'] = true;
    if (opts?.requireArgs) def['require_args'] = opts.requireArgs;
    this._webhooks.push(def);
    return this;
  }

  /**
   * Set pattern-matching expressions on the most recently added webhook.
   * @param expressions - Array of expression objects to evaluate against the webhook response.
   * @returns This instance for chaining.
   */
  webhookExpressions(expressions: Record<string, unknown>[]): this {
    if (!this._webhooks.length)
      throw new Error('Must add webhook before setting webhook expressions');
    this._webhooks[this._webhooks.length - 1]!['expressions'] = expressions; // non-empty checked above
    return this;
  }

  /**
   * Set a `body` key on the most recently added webhook.
   *
   * The SWML schema's webhook object has no `body` field, and SignalWire's
   * reference documents `params` as the request body. Use {@link DataMap.params} to
   * set a request body.
   * @param data - The object to store under `body`.
   * @returns This instance for chaining.
   */
  body(data: Record<string, unknown>): this {
    if (!this._webhooks.length) throw new Error('Must add webhook before setting body');
    this._webhooks[this._webhooks.length - 1]!['body'] = data; // non-empty checked above
    return this;
  }

  /**
   * Set `params` on the most recently added webhook.
   *
   * The platform sends `params` as the request's JSON body when it is set or
   * the method is POST, expanding templates in its values first. Put
   * query-string values for a GET request in the URL instead.
   * @param data - The request body object.
   * @returns This instance for chaining.
   */
  params(data: Record<string, unknown>): this {
    if (!this._webhooks.length) throw new Error('Must add webhook before setting params');
    this._webhooks[this._webhooks.length - 1]!['params'] = data; // non-empty checked above
    return this;
  }

  /**
   * Configure iteration over an array in the webhook response.
   *
   * `input_key` names the response key that holds the array (a key name, not a
   * template). `append` is expanded once per element, reading the element as
   * `${this.field}`. The joined text is stored under `output_key`, which the
   * webhook's output reads as `${<output_key>}`.
   * @param config - Foreach configuration with input/output keys, append template, and optional max.
   * @returns This instance for chaining.
   */
  foreach(config: { input_key: string; output_key: string; append: string; max?: number }): this {
    if (!this._webhooks.length) throw new Error('Must add webhook before setting foreach');
    this._webhooks[this._webhooks.length - 1]!['foreach'] = config; // non-empty checked above
    return this;
  }

  /**
   * Set the output template for the most recently added webhook.
   * @param result - The FunctionResult to use as the output template.
   * @returns This instance for chaining.
   */
  output(result: FunctionResult): this {
    if (!this._webhooks.length) throw new Error('Must add webhook before setting output');
    this._webhooks[this._webhooks.length - 1]!['output'] = result.toDict(); // non-empty checked above
    return this;
  }

  /**
   * Set a fallback output used when no webhook or expression matches.
   * @param result - The FunctionResult to use as the fallback.
   * @returns This instance for chaining.
   */
  fallbackOutput(result: FunctionResult): this {
    this._output = result.toDict();
    return this;
  }

  /**
   * Set error keys on the most recently added webhook, or globally if no webhook exists.
   * @param keys - Response keys that indicate an error occurred.
   * @returns This instance for chaining.
   */
  errorKeys(keys: string[]): this {
    if (this._webhooks.length) {
      this._webhooks[this._webhooks.length - 1]!['error_keys'] = keys; // non-empty checked above
    } else {
      this._errorKeys = keys;
    }
    return this;
  }

  /**
   * Set `error_keys` on the `data_map` object itself, regardless of webhook context.
   *
   * The SWML schema defines `error_keys` only on a webhook, so prefer
   * {@link DataMap.errorKeys} on each webhook.
   * @param keys - Response keys that indicate an error occurred.
   * @returns This instance for chaining.
   */
  globalErrorKeys(keys: string[]): this {
    this._errorKeys = keys;
    return this;
  }

  /**
   * Register this DataMap tool with an AgentBase instance.
   * @param agent - An object with a registerSwaigFunction method (typically an AgentBase).
   * @returns This instance for chaining.
   */
  registerWithAgent(agent: { registerSwaigFunction(fn: Record<string, unknown>): unknown }): this {
    agent.registerSwaigFunction(this.toSwaigFunction());
    return this;
  }

  /**
   * Serialize this data map to a SWAIG function definition object.
   * @returns A plain object suitable for inclusion in the SWML SWAIG array.
   */
  toSwaigFunction(): Record<string, unknown> {
    // Build parameter schema
    let paramSchema: Record<string, unknown>;
    const paramKeys = Object.keys(this._parameters).filter((k) => k !== '_required');
    if (paramKeys.length) {
      const properties: Record<string, unknown> = {};
      for (const k of paramKeys) {
        properties[k] = this._parameters[k];
      }
      paramSchema = { type: 'object', properties };
      const required = this._parameters['_required'] as string[] | undefined;
      if (required?.length) paramSchema['required'] = required;
    } else {
      paramSchema = { type: 'object', properties: {} };
    }

    // Build data_map
    const dataMap: Record<string, unknown> = {};
    if (this._expressions.length) dataMap['expressions'] = this._expressions;
    if (this._webhooks.length) dataMap['webhooks'] = this._webhooks;
    if (this._output) dataMap['output'] = this._output;
    if (this._errorKeys.length) dataMap['error_keys'] = this._errorKeys;

    let result: Record<string, unknown> = {
      function: this.functionName,
      description: this._purpose || `Execute ${this.functionName}`,
      parameters: paramSchema,
      data_map: dataMap,
    };

    if (this._expandEnv) {
      const prefixes = this._allowedEnvPrefixes ?? globalAllowedEnvPrefixes;
      result = expandEnvInObject(result, prefixes) as Record<string, unknown>;
    }

    return result;
  }
}

// ── Helper functions ────────────────────────────────────────────────────

/**
 * Create a DataMap tool that calls a single API endpoint and formats the response.
 * @param opts - Configuration including name, URL, response template, and optional parameters.
 * @returns A configured DataMap instance ready for registration.
 */
export function createSimpleApiTool(opts: {
  name: string;
  url: string;
  responseTemplate: string;
  parameters?: Record<string, { type?: string; description?: string; required?: boolean }>;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  errorKeys?: string[];
}): DataMap {
  const dm = new DataMap(opts.name);
  if (opts.parameters) {
    for (const [name, def] of Object.entries(opts.parameters)) {
      dm.parameter(name, def.type ?? 'string', def.description ?? `${name} parameter`, {
        required: def.required,
      });
    }
  }
  dm.webhook(opts.method ?? 'GET', opts.url, { headers: opts.headers });
  if (opts.body) dm.body(opts.body);
  if (opts.errorKeys) dm.errorKeys(opts.errorKeys);
  dm.output(new FunctionResult(opts.responseTemplate));
  return dm;
}

/**
 * Create a DataMap tool that evaluates expressions against patterns without making HTTP calls.
 * @param opts - Configuration including name, pattern-result pairs, and optional parameters.
 * @returns A configured DataMap instance ready for registration.
 */
export function createExpressionTool(opts: {
  name: string;
  patterns: Record<string, [string, FunctionResult]>;
  parameters?: Record<string, { type?: string; description?: string; required?: boolean }>;
}): DataMap {
  const dm = new DataMap(opts.name);
  if (opts.parameters) {
    for (const [name, def] of Object.entries(opts.parameters)) {
      dm.parameter(name, def.type ?? 'string', def.description ?? `${name} parameter`, {
        required: def.required,
      });
    }
  }
  for (const [testValue, [pattern, result]] of Object.entries(opts.patterns)) {
    dm.expression(testValue, pattern, result);
  }
  return dm;
}
