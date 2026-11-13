/**
 * SwaigFunction - Wraps a handler function with metadata for SWAIG registration.
 */

import Ajv from 'ajv';
import {
  FunctionResult,
  ToolRefusal,
  settleResult,
  toolErrorResult,
  type SwaigResultDict,
} from './FunctionResult.js';
import { getLogger } from './Logger.js';
import type { SwaigRequest } from './SwaigContracts.js';
import type { AgentBase } from './AgentBase.js';
import type { SWMLService } from './SWMLService.js';
import { runChain, type ToolMiddleware } from './ToolMiddleware.js';
import {
  applyGateFields,
  _checkGatedFunction,
  type FillerPhrases,
  type SemanticGate,
} from './SemanticGate.js';

const ajv = new Ajv({ allErrors: true });

/**
 * Compiled argument validators, keyed by the schema's JSON, so every call of
 * a tool (and of its per-request copies) reuses one. Bounded: the oldest
 * entry goes when it's full. Each schema is removed from Ajv's own cache
 * once compiled, so only this map holds it.
 */
const VALIDATOR_CACHE_LIMIT = 500;
const compiledValidators = new Map<string, ReturnType<typeof ajv.compile>>();
let compileCount = 0;

function validatorFor(schema: Record<string, unknown>): ReturnType<typeof ajv.compile> {
  const key = JSON.stringify(schema);
  const cached = compiledValidators.get(key);
  if (cached) return cached;
  const validate = ajv.compile(schema);
  ajv.removeSchema(schema);
  compileCount += 1;
  if (compiledValidators.size >= VALIDATOR_CACHE_LIMIT) {
    compiledValidators.delete(compiledValidators.keys().next().value!);
  }
  compiledValidators.set(key, validate);
  return validate;
}

/** @internal How many argument validators have been compiled (for tests). */
export function _compiledValidatorCount(): number {
  return compileCount;
}

const log = getLogger('SwaigFunction');

/**
 * Decide whether a `parameters` value is already a full JSON Schema object
 * (`{ type: 'object', properties: {...} }`) versus a bare map of property
 * definitions that must be wrapped.
 *
 * Robust discriminator: a value is a full schema ONLY when its `type` is the
 * string `'object'` AND its `properties` is itself an object. The old check
 * (`'type' in p && 'properties' in p`) misclassified a tool whose parameters
 * are literally NAMED `type` and `properties`: for such a bare map the value of
 * `type` is a property-definition object (not the string `'object'`), so this
 * check correctly treats it as a bare properties map.
 *
 * @param parameters - The raw `parameters` value to inspect.
 * @returns `true` if it is already a full JSON Schema object.
 */
export function isFullParameterSchema(parameters: Record<string, unknown>): boolean {
  const props = (parameters as { properties?: unknown }).properties;
  return (
    (parameters as { type?: unknown }).type === 'object' &&
    typeof props === 'object' &&
    props !== null
  );
}

/**
 * Normalize a tool's `parameters` into a full JSON Schema object suitable for
 * SWAIG / MCP output.
 *
 * - An empty/absent map becomes `{ type: 'object', properties: {} }`.
 * - An already-full schema (see {@link isFullParameterSchema}) is returned
 *   unchanged.
 * - A bare properties map is wrapped as
 *   `{ type: 'object', properties: <map>, required?: <required> }`.
 *
 * This is the single source of truth for the `parameters` shape sniff that used
 * to be reimplemented in SwaigFunction, AgentBase MCP tool listing, and the
 * AgentBase SWAIG function table.
 *
 * @param parameters - The raw `parameters` value (bare properties map or full schema).
 * @param required - Required-parameter names, applied only when wrapping a bare map.
 * @returns A full JSON Schema object.
 */
export function normalizeParameters(
  parameters: Record<string, unknown> | undefined,
  required: string[] = [],
): Record<string, unknown> {
  if (!parameters || Object.keys(parameters).length === 0) {
    return { type: 'object', properties: {} };
  }
  if (isFullParameterSchema(parameters)) {
    return parameters;
  }
  const result: Record<string, unknown> = {
    type: 'object',
    properties: parameters,
  };
  if (required.length) result['required'] = required;
  return result;
}

/**
 * The argument a vouched tool adds, which the model sets to say every other
 * argument came from the user.
 */
export const VOUCHED_PARAMETER = 'data_supplied_by_user';
/** The description of {@link VOUCHED_PARAMETER}, as the model reads it. */
export const VOUCHED_DESCRIPTION =
  'True only when every other argument is what the user said in this call, not a guess, an example or something assumed. False when any value did not come from the user.';
/** The `web_hook_url` that has the platform run its own implementation of a function, by name. */
export const NATIVE_WEBHOOK_URL = 'native';
/** The tool prompt the model gets when it calls a vouched tool without vouching for its arguments. */
export const VOUCHED_PROMPT = 'Get the answer from the user before using this tool.';

/** A property's schema that also takes null; one without a `type` is left as it is. */
function nullableSpec(spec: unknown): unknown {
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec) || !('type' in spec)) {
    return spec;
  }
  const s = spec as Record<string, unknown>;
  const types = Array.isArray(s['type']) ? (s['type'] as unknown[]) : [s['type']];
  const widened: Record<string, unknown> = {
    ...s,
    type: types.includes('null') ? types : [...types, 'null'],
  };
  if (Array.isArray(s['enum']) && !(s['enum'] as unknown[]).includes(null)) {
    widened['enum'] = [...(s['enum'] as unknown[]), null];
  }
  return widened;
}

/**
 * Handler function for a SWAIG tool invocation.
 * @param args - Parsed arguments extracted by the AI from user speech.
 * @param rawData - The full raw request payload from SignalWire.
 * @param agent - The agent running the call. With a dynamic config callback
 *   set, this is the request's configured copy, so the handler sees what the
 *   callback configured (the reference passes it as `self`). Undefined when a
 *   caller runs {@link SwaigFunction.execute} directly.
 * @returns A FunctionResult, a plain object with a response key, a string, or a Promise of any of these.
 */
export type SwaigHandler = (
  args: Record<string, unknown>,
  rawData: SwaigRequest,
  agent?: AgentBase,
) =>
  | FunctionResult
  | Record<string, unknown>
  | string
  | null
  | undefined
  | void
  | Promise<FunctionResult | Record<string, unknown> | string | null | undefined | void>;

/**
 * Context passed to an {@link SwaigErrorHandler} when a tool handler throws.
 */
export interface SwaigErrorContext {
  /** Name of the tool whose handler threw. */
  functionName: string;
  /** The parsed arguments the handler was invoked with. */
  args: Record<string, unknown>;
  /** The full raw request payload (if available). */
  rawData?: SwaigRequest;
}

/**
 * Hook invoked when a SWAIG tool handler throws. Lets authors observe the
 * failure (report to Sentry/Datadog, log with full context) and optionally
 * decide the user-facing response.
 *
 * - Return a {@link FunctionResult} to control exactly what the AI receives.
 * - Return `void`/`undefined` to fall back to the default error response.
 *
 * The error is always contained — a thrown handler never propagates to the
 * HTTP layer (that would break the live call). This hook makes the containment
 * *observable and configurable* instead of opaque.
 */
export type SwaigErrorHandler = (
  error: unknown,
  context: SwaigErrorContext,
) => FunctionResult | void | Promise<FunctionResult | void>;

/**
 * The message a tool handler that threw gave the model before 3.8.0.
 *
 * @deprecated A handler that throws, with no {@link SwaigErrorHandler}
 * response and no `errorMessage`, now gives the model
 * {@link toolErrorResult}: the outcome is unknown, so it mustn't say the
 * action worked or that it didn't. Kept for code that imports it.
 */
export const DEFAULT_SWAIG_ERROR_MESSAGE =
  "Sorry, I couldn't complete that action. Please try again or contact support if the issue persists.";

/** Configuration options for creating a SwaigFunction. */
export interface SwaigFunctionOptions {
  /** Unique name used to register and invoke this tool. */
  name: string;
  /** The handler function called when the tool is invoked. */
  handler: SwaigHandler;
  /** Human-readable description of what the tool does, shown to the AI. */
  description: string;
  /** JSON Schema properties describing the tool's parameters. */
  parameters?: Record<string, unknown>;
  /**
   * Whether this tool requires session token authentication.
   *
   * **Defaults to `true` — secure by default.** A tool registered without an
   * explicit `secure` requires SWAIG token validation, and its rendered SWML
   * webhook carries a per-tool `__token`. Pass `secure: false` only to
   * deliberately expose a tool on the unauthenticated shared webhook URL.
   *
   * **Python equivalent:** `define_tool(..., secure: bool = True)` — every
   * user-facing entry point in the reference (`ToolMixin.define_tool`,
   * `ToolRegistry.define_tool`, the `@AgentBase.tool()` decorator) defaults
   * `secure=True`.
   */
  secure?: boolean;
  /**
   * Phrases the AI says while the function runs, keyed by language code,
   * `"auto"` (translated into the call's language on first use) or
   * `"default"`. An entry may also be a list of phrases, a wait script, spoken
   * one at a time while the call waits; the type predates wait scripts, so one needs a cast (the platform
   * accepts it). {@link gateFillers} is typed for both.
   */
  fillers?: Record<string, string[]>;
  /** Audio file URL to play while waiting for the tool to complete. */
  waitFile?: string;
  /** Number of times to loop the wait file. */
  waitFileLoops?: number;
  /**
   * Semantic gates, 1 to 8 {@link SemanticGate} objects or gate objects:
   * yes/no preconditions a decision model checks right before the platform
   * dispatches the function. When one fails, the function doesn't run and the
   * model gets that gate's `on_fail` output. The fillers and wait file start
   * only once the gates pass. Checked by the platform's rules when the tool is
   * defined. A platform release without semantic gates runs the function
   * ungated.
   */
  gates?: ReadonlyArray<SemanticGate | Record<string, unknown>>;
  /**
   * Phrases the AI says while the gates are checked, shaped like
   * {@link fillers}. Only with {@link gates}.
   */
  gateFillers?: FillerPhrases;
  /** External webhook URL; makes this an externally-hosted tool. */
  webhookUrl?: string;
  /** List of required parameter names. */
  required?: string[];
  /**
   * Additional fields to merge directly into the SWAIG function definition.
   *
   * **Python equivalent:** `**extra_swaig_fields` kwargs on the constructor.
   * In Python these are passed as bare keyword arguments and merged directly
   * into the output dict via `function_def.update(self.extra_swaig_fields)`.
   * In TypeScript the same fields are collected under this single options key
   * and merged identically in `toSwaig()` — the wire format is identical.
   *
   * @example
   * ```typescript
   * // Python: SWAIGFunction(..., meta_data_token="abc", web_hook_auth_user="u")
   * new SwaigFunction({
   *   ...,
   *   extraFields: { meta_data_token: 'abc', web_hook_auth_user: 'u' },
   * });
   * ```
   */
  extraFields?: Record<string, unknown>;
  /** Whether this tool uses a typed handler with named parameters. */
  isTypedHandler?: boolean;
  /**
   * Per-tool error hook. Invoked when this tool's handler throws, before the
   * default error response is produced. See `SwaigErrorHandler`. A
   * {@link ToolRefusal} doesn't reach it.
   */
  onError?: SwaigErrorHandler;
  /**
   * Per-tool override for the user-facing message returned when the handler
   * throws and no {@link onError} hook supplies a response. Without it, the
   * model is told the function failed before it finished, so whether it took
   * effect is unknown, with a tool prompt not to tell the caller it worked or
   * that it didn't.
   */
  errorMessage?: string;
  /**
   * `true` for a tool whose arguments must come from the user, not from the
   * model's guesses. The tool gets a required boolean argument,
   * `data_supplied_by_user`, in which the model says they did. Unless it's
   * `true`, the handler doesn't run, and the model gets "<name> was not run."
   * with the tool prompt "Get the answer from the user before using this
   * tool." The handler never sees the argument.
   */
  vouched?: boolean;
  /**
   * `true` to let the model send null for an optional argument, as providers
   * with strict schemas require: each argument that isn't required takes null
   * as well as its type, and a null reaches the handler as an argument not
   * given. Left out, it follows the agent's
   * `setNullableOptionalParameters()`.
   */
  nullableOptional?: boolean;
  /**
   * `true` when the handler reads the conversation, as `callerTurns(rawData)`
   * does. It turns on the agent's `swaig_post_conversation` when the SWML is
   * rendered, so every tool request carries the call log, unless that param
   * was set to `false`.
   */
  needsConversation?: boolean;
  /**
   * Middleware that runs around this tool's calls only, inside the
   * service's ({@link SWMLService.addToolMiddleware}).
   */
  middleware?: readonly ToolMiddleware[];
}

/**
 * A SWAIG function — exactly the same concept as a "tool" in native
 * OpenAI / Anthropic tool calling.
 *
 * Each SwaigFunction is rendered, on every LLM turn, into the OpenAI
 * tool schema:
 *
 * ```json
 * {
 *   "type": "function",
 *   "function": {
 *     "name":        "<this.name>",
 *     "description": "<this.description>",
 *     "parameters":  { "type": "object", "properties": { ... } }
 *   }
 * }
 * ```
 *
 * The `name`, `description`, and every per-parameter `description` inside
 * `parameters` are **read by the model** and directly determine whether
 * the model picks this tool when a matching user request comes in.
 * They are prompt engineering, not developer comments.
 */
export class SwaigFunction {
  /** Unique name — read by the LLM; use snake_case verbs. */
  name: string;
  /** The handler function called when the tool is invoked. */
  handler: SwaigHandler;
  /**
   * LLM-facing description. Tells the model WHEN to call this tool.
   * A vague description is the #1 cause of "model has the tool but
   * doesn't call it" failures.
   */
  description: string;
  /**
   * JSON Schema properties describing the tool's parameters. Each
   * property's `description` field is ALSO LLM-facing — it tells the
   * model HOW to extract that argument from the user's utterance.
   */
  parameters: Record<string, unknown>;
  /** Whether this tool requires session token authentication. */
  secure: boolean;
  /** Phrases the AI says while the function runs (see {@link SwaigFunctionOptions.fillers}). */
  fillers?: Record<string, string[]>;
  /** Audio file URL to play while waiting for the tool to complete. */
  waitFile?: string;
  /** Number of times to loop the wait file. */
  waitFileLoops?: number;
  /** External webhook URL; set when the tool is externally hosted. */
  webhookUrl?: string;
  /** List of required parameter names. */
  required: string[];
  /** Additional fields included in the SWAIG definition output. */
  extraFields: Record<string, unknown>;
  /** Whether this tool uses a typed handler with named parameters. */
  isTypedHandler: boolean;
  /** Whether this tool is externally hosted (has a webhookUrl). */
  isExternal: boolean;
  /** Per-tool error hook; see `SwaigErrorHandler`. */
  onError?: SwaigErrorHandler;
  /** Per-tool user-facing error message override. */
  errorMessage?: string;
  /** Whether the model must vouch that the arguments came from the user. */
  vouched: boolean;
  /** Whether optional arguments take null, or undefined for the agent's setting. */
  nullableOptional?: boolean;
  /** Whether the handler reads the conversation (turns on `swaig_post_conversation`). */
  needsConversation: boolean;
  /** Middleware around this tool's calls, inside the service's. */
  middleware: readonly ToolMiddleware[];

  /**
   * Create a new SwaigFunction.
   *
   * @param opts - Configuration options for the SWAIG function.
   *   Use `opts.extraFields` to pass any additional SWAIG-only fields
   *   (e.g. `meta_data_token`, `web_hook_auth_user`, `web_hook_auth_password`).
   *   This mirrors the Python constructor's `**extra_swaig_fields` kwargs:
   *   both are merged directly into the serialized SWAIG definition, so the
   *   wire format is identical — only the call-site syntax differs. `gates`
   *   and `gate_fillers` there are checked like `opts.gates` and
   *   `opts.gateFillers`.
   * @throws {Error} For gates the platform would refuse, or gate fillers
   *   without gates.
   */
  constructor(opts: SwaigFunctionOptions) {
    this.name = opts.name;
    this.handler = opts.handler;
    this.description = opts.description;
    this.parameters = opts.parameters ?? {};
    // SECURE BY DEFAULT (A1): a tool registered without an explicit `secure`
    // requires token validation, and renderSwml mints its per-tool `__token`.
    // Matches the reference's user-facing `define_tool(..., secure=True)`
    // (tool_mixin.py:37 / tools/registry.py:42 / tools/decorator.py:95).
    this.secure = opts.secure ?? true;
    this.fillers = opts.fillers;
    this.waitFile = opts.waitFile;
    this.waitFileLoops = opts.waitFileLoops;
    this.webhookUrl = opts.webhookUrl;
    this.required = opts.required ?? [];
    // Gates given as options, or among the extra fields, are checked by the
    // platform's rules under the name the function is sent with.
    this.extraFields = { ...(opts.extraFields ?? {}) };
    if (opts.gates !== undefined) this.extraFields['gates'] = opts.gates;
    if (opts.gateFillers !== undefined) this.extraFields['gate_fillers'] = opts.gateFillers;
    if ('gates' in this.extraFields || 'gate_fillers' in this.extraFields) {
      const sentName = this.extraFields['function'];
      applyGateFields(this.extraFields, typeof sentName === 'string' ? sentName : this.name);
    }
    this.isTypedHandler = opts.isTypedHandler ?? false;
    this.isExternal = opts.webhookUrl !== undefined;
    this.onError = opts.onError;
    this.errorMessage = opts.errorMessage;
    this.vouched = opts.vouched ?? false;
    this.nullableOptional = opts.nullableOptional;
    this.needsConversation = opts.needsConversation ?? false;
    this.middleware = [...(opts.middleware ?? [])];
  }

  private ensureParameterStructure(nullableDefault?: boolean): Record<string, unknown> {
    return this._parameterSchema(nullableDefault);
  }

  /**
   * The parameter schema the model sees: the tool's own, with optional
   * arguments widened to take null when they do, and a vouched tool's
   * `data_supplied_by_user` added.
   * @param nullableDefault - The agent's default for whether optional
   *   arguments take null, used when this tool doesn't set its own.
   * @internal
   */
  _parameterSchema(nullableDefault?: boolean): Record<string, unknown> {
    let result = normalizeParameters(this.parameters, this.required);
    if (this._nullable(nullableDefault)) {
      const required = new Set((result['required'] as string[] | undefined) ?? []);
      const properties = (result['properties'] as Record<string, unknown> | undefined) ?? {};
      result = {
        ...result,
        properties: Object.fromEntries(
          Object.entries(properties).map(([key, spec]) => [
            key,
            required.has(key) ? spec : nullableSpec(spec),
          ]),
        ),
      };
    }
    if (this.vouched) {
      const required = ((result['required'] as string[] | undefined) ?? []).filter(
        (r) => r !== VOUCHED_PARAMETER,
      );
      result = {
        ...result,
        properties: {
          ...((result['properties'] as Record<string, unknown> | undefined) ?? {}),
          [VOUCHED_PARAMETER]: { type: 'boolean', description: VOUCHED_DESCRIPTION },
        },
        required: [...required, VOUCHED_PARAMETER],
      };
    }
    return result;
  }

  /** Whether optional arguments take null: this tool's own setting, else the agent's. */
  private _nullable(nullableDefault?: boolean): boolean {
    return this.nullableOptional ?? !!nullableDefault;
  }

  /** What the model gets for a vouched call it didn't vouch for, or null. */
  private _vouchedRefusal(args: Record<string, unknown>): FunctionResult | null {
    if (!this.vouched || args?.[VOUCHED_PARAMETER] === true) return null;
    return new FunctionResult(undefined, false, `${this.name} was not run.`, VOUCHED_PROMPT);
  }

  /**
   * The arguments the handler gets: a vouched tool's own is removed, and a
   * null for an optional argument that takes null is an argument not given.
   */
  private _handlerArgs(
    args: Record<string, unknown>,
    nullableDefault?: boolean,
  ): Record<string, unknown> {
    if (!args || Object.keys(args).length === 0) return args;
    const drop = new Set<string>();
    if (this.vouched && VOUCHED_PARAMETER in args) drop.add(VOUCHED_PARAMETER);
    if (this._nullable(nullableDefault)) {
      const required = new Set(
        (normalizeParameters(this.parameters, this.required)['required'] as string[] | undefined) ??
          [],
      );
      for (const [key, value] of Object.entries(args)) {
        if (value === null && !required.has(key)) drop.add(key);
      }
    }
    if (drop.size === 0) return args;
    return Object.fromEntries(Object.entries(args).filter(([key]) => !drop.has(key)));
  }

  /**
   * Validate arguments against the parameter JSON schema using full
   * JSON Schema Draft-7 validation (via ajv).
   *
   * Mirrors Python's `validate_args` which tries `jsonschema_rs` (Rust-based
   * Draft-7 validator) then falls back to `jsonschema` (pure Python Draft-7).
   * All JSON Schema constraint keywords are honoured: `required`, `type`,
   * `minLength`, `maxLength`, `pattern`, `format`, `minimum`, `maximum`,
   * `enum`, `anyOf`, `oneOf`, `$ref`, nested object/array validation, etc.
   *
   * If the schema has no properties, validation is skipped and the args are
   * considered valid — matching Python's early-return path.
   *
   * @param args - Arguments to validate.
   * @param nullableDefault - The agent's default for whether optional
   *   arguments take null, used when this tool doesn't set its own.
   * @returns A tuple of `[isValid, errors]`. When no validation is needed
   *          (empty schema), returns `[true, []]`.
   */
  validateArgs(args: Record<string, unknown>, nullableDefault?: boolean): [boolean, string[]] {
    const schema = this.ensureParameterStructure(nullableDefault);
    const properties = schema['properties'] as Record<string, unknown> | undefined;
    if (!properties || Object.keys(properties).length === 0) {
      return [true, []];
    }

    const validate = validatorFor(schema);
    const valid = validate(args);
    if (valid) {
      return [true, []];
    }
    const errors = (validate.errors ?? []).map((e) => {
      // Produce messages similar to Python's jsonschema:
      // "instancePath message" or just "message" when path is empty.
      const path = e.instancePath ? e.instancePath.replace(/^\//, '').replace(/\//g, '.') : '';
      return path ? `'${path}' ${e.message}` : (e.message ?? String(e));
    });
    return [false, errors];
  }

  /**
   * Invoke the handler with the given arguments and return a serialized result.
   * @param args - Parsed arguments from the AI.
   * @param rawData - The full raw request payload.
   * @returns A serialized result dictionary suitable for the SWAIG response.
   */
  async execute(
    args: Record<string, unknown>,
    rawData?: SwaigRequest,
    agentOnError?: SwaigErrorHandler,
  ): Promise<SwaigResultDict> {
    return this._executeAs(undefined, args, rawData, agentOnError);
  }

  /**
   * {@link execute}, passing `agent` to the handler as its third argument: the
   * agent running the call, which with a dynamic config callback is the
   * request's configured copy.
   * @internal
   */
  async _executeAs(
    agent: AgentBase | undefined,
    args: Record<string, unknown>,
    rawData?: SwaigRequest,
    agentOnError?: SwaigErrorHandler,
    service: SWMLService | undefined = agent,
  ): Promise<SwaigResultDict> {
    const nullableDefault = service?._nullableOptionalDefault();
    // Soft validation, as the reference's tool_mixin does: arguments that
    // don't match the schema are logged, and the handler still runs.
    if (args && Object.keys(args).length > 0) {
      try {
        const [valid, errors] = this.validateArgs(args, nullableDefault);
        if (!valid) {
          log.warn(`Argument validation failed for function '${this.name}': ${errors.join('; ')}`);
        }
      } catch (err) {
        log.debug(
          `Argument validation error for function '${this.name}': ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    const dispatch = async (
      a: Record<string, unknown>,
      raw: Record<string, unknown>,
    ): Promise<SwaigResultDict> => {
      // A vouched tool runs only when the model vouches for its arguments
      const refusal = this._vouchedRefusal(a);
      if (refusal) return refusal.toDict();
      try {
        // Runtime fallback is the empty object (unchanged); the cast is
        // compile-time only — the backend always sends the full payload, but
        // `execute` allows callers to omit it (e.g. CLI/test harnesses).
        const handlerArgs = this._handlerArgs(a, nullableDefault);
        const result = settleResult(
          this.name,
          await this.handler(handlerArgs, raw as SwaigRequest, agent),
        );
        if (result instanceof FunctionResult) {
          return result.toDict();
        }
        if (typeof result === 'object' && result !== null) {
          // A SWAIG result already: settleResult made sure it has a response
          // or an action.
          return result as SwaigResultDict;
        }
        // Neither a FunctionResult nor an object — warn and fall back to
        // wrapping the stringified value. See Python's web_mixin /
        // serverless_mixin / tool_mixin for the equivalent check.
        if (typeof result !== 'string') {
          log.warn(
            `SWAIG function "${this.name}" returned a value of type "${typeof result}" ` +
              `that is neither FunctionResult nor object; falling back to str(result). ` +
              `The AI will see the stringified value as its tool response. Wrap your ` +
              `return in new FunctionResult(...) or return an object with at least a ` +
              `"response" key.`,
          );
        }
        return new FunctionResult(String(result)).toDict();
      } catch (err) {
        // A refusal is the handler's own outcome, not an error
        if (err instanceof ToolRefusal) return err.result().toDict();

        // Preserve the stack for Error instances (plain `${err}` discards it).
        const detail =
          err instanceof Error ? (err.stack ?? `${err.name}: ${err.message}`) : String(err);
        log.error(`Error executing SWAIG function ${this.name}: ${detail}`);

        // Give authors a programmatic surface: per-tool hook first, then the
        // agent-level hook. Either may return a FunctionResult to control what
        // the AI sees; if a hook itself throws, that's logged and we continue to
        // the next fallback (the error is always contained — a thrown handler
        // must never break the live call).
        const ctx: SwaigErrorContext = {
          functionName: this.name,
          args: a,
          rawData: raw as SwaigRequest,
        };
        for (const hook of [this.onError, agentOnError]) {
          if (!hook) continue;
          try {
            const handled = await hook(err, ctx);
            if (handled instanceof FunctionResult) {
              return handled.toDict();
            }
          } catch (hookErr) {
            log.error(`onError hook for SWAIG function ${this.name} threw: ${hookErr}`);
          }
        }

        // The error itself isn't sent: its text can hold internals, and the
        // model would read it as the outcome, which is unknown.
        if (this.errorMessage !== undefined) return new FunctionResult(this.errorMessage).toDict();
        return toolErrorResult(this.name).toDict();
      }
    };

    const raw = (rawData ?? {}) as Record<string, unknown>;
    const middleware = service?._toolMiddlewareFor(this) ?? this.middleware;
    if (middleware.length === 0) return dispatch(args, raw);
    let outcome: unknown;
    try {
      outcome = await runChain(middleware, this.name, args, raw, dispatch);
    } catch (err) {
      if (err instanceof ToolRefusal) return err.result().toDict();
      log.error(
        `Tool middleware for '${this.name}' threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
      );
      return toolErrorResult(this.name).toDict();
    }
    // Settled inside the boundary, as the reference's async path settles: a
    // result that can't be (a circular object, say) is the unknown outcome,
    // not a failed request, on the first attempt and on every retry of it
    try {
      const settled = settleResult(this.name, outcome);
      if (settled instanceof FunctionResult) return settled.toDict();
      if (typeof settled === 'object' && settled !== null) return settled as SwaigResultDict;
      return new FunctionResult(String(settled)).toDict();
    } catch (err) {
      log.error(
        `The result of tool middleware for '${this.name}' couldn't be settled: ${err instanceof Error ? err.message : String(err)}`,
      );
      return toolErrorResult(this.name).toDict();
    }
  }

  /**
   * Serialize this function to the SWAIG wire format for inclusion in SWML.
   * @param baseUrl - The base URL of the agent server.
   * @param token - Optional session token for secure functions.
   * @param callId - Optional call ID for secure function URLs.
   * @returns A SWAIG function definition object.
   */
  toSwaig(baseUrl: string, token?: string, callId?: string): Record<string, unknown> {
    let url = `${baseUrl}/swaig`;
    if (token && callId) {
      url = `${url}?token=${token}&call_id=${callId}`;
    }
    const def: Record<string, unknown> = {
      function: this.name,
      description: this.description,
      parameters: this.ensureParameterStructure(),
    };
    if (url) def['web_hook_url'] = url;
    if (this.fillers && Object.keys(this.fillers).length > 0) {
      def['fillers'] = this.fillers;
    }
    if (this.waitFile) def['wait_file'] = this.waitFile;
    if (this.waitFileLoops !== undefined) def['wait_file_loops'] = this.waitFileLoops;
    Object.assign(def, this.extraFields);
    _checkGatedFunction(def);
    return def;
  }
}
