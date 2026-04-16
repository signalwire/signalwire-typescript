/**
 * SwaigFunction - Wraps a handler function with metadata for SWAIG registration.
 */

import Ajv from 'ajv';
import { FunctionResult } from './FunctionResult.js';
import { getLogger } from './Logger.js';

const ajv = new Ajv({ allErrors: true });

const log = getLogger('SwaigFunction');

/**
 * Handler function for a SWAIG tool invocation.
 * @param args - Parsed arguments extracted by the AI from user speech.
 * @param rawData - The full raw request payload from SignalWire.
 * @returns A FunctionResult, a plain object with a response key, a string, or a Promise of any of these.
 */
export type SwaigHandler = (
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
) => FunctionResult | Record<string, unknown> | string | Promise<FunctionResult | Record<string, unknown> | string>;

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
  /** Whether this tool requires session token authentication. */
  secure?: boolean;
  /** Language-keyed filler phrases spoken while the tool executes. */
  fillers?: Record<string, string[]>;
  /** Audio file URL to play while waiting for the tool to complete. */
  waitFile?: string;
  /** Number of times to loop the wait file. */
  waitFileLoops?: number;
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
  /** Language-keyed filler phrases spoken while the tool executes. */
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

  /**
   * Create a new SwaigFunction.
   *
   * @param opts - Configuration options for the SWAIG function.
   *   Use `opts.extraFields` to pass any additional SWAIG-only fields
   *   (e.g. `meta_data_token`, `web_hook_auth_user`, `web_hook_auth_password`).
   *   This mirrors the Python constructor's `**extra_swaig_fields` kwargs:
   *   both are merged directly into the serialized SWAIG definition, so the
   *   wire format is identical — only the call-site syntax differs.
   */
  constructor(opts: SwaigFunctionOptions) {
    this.name = opts.name;
    this.handler = opts.handler;
    this.description = opts.description;
    this.parameters = opts.parameters ?? {};
    this.secure = opts.secure ?? false;
    this.fillers = opts.fillers;
    this.waitFile = opts.waitFile;
    this.waitFileLoops = opts.waitFileLoops;
    this.webhookUrl = opts.webhookUrl;
    this.required = opts.required ?? [];
    this.extraFields = opts.extraFields ?? {};
    this.isTypedHandler = opts.isTypedHandler ?? false;
    this.isExternal = opts.webhookUrl !== undefined;
  }

  private ensureParameterStructure(): Record<string, unknown> {
    if (!this.parameters || Object.keys(this.parameters).length === 0) {
      return { type: 'object', properties: {} };
    }
    if ('type' in this.parameters && 'properties' in this.parameters) {
      return this.parameters;
    }
    const result: Record<string, unknown> = {
      type: 'object',
      properties: this.parameters,
    };
    if (this.required.length) result['required'] = this.required;
    return result;
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
   * @returns A tuple of `[isValid, errors]`. When no validation is needed
   *          (empty schema), returns `[true, []]`.
   */
  validateArgs(args: Record<string, unknown>): [boolean, string[]] {
    const schema = this.ensureParameterStructure();
    const properties = schema['properties'] as Record<string, unknown> | undefined;
    if (!properties || Object.keys(properties).length === 0) {
      return [true, []];
    }

    const validate = ajv.compile(schema);
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
    rawData?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.handler(args, rawData ?? {});
      if (result instanceof FunctionResult) {
        return result.toDict();
      }
      if (typeof result === 'object' && result !== null && !('response' in result)) {
        // Plain object without a "response" key — matches Python's behavior:
        // `elif isinstance(result, dict): return FunctionResult("Function completed successfully").to_dict()`
        // Python replaces such dicts entirely; do the same here.
        return new FunctionResult('Function completed successfully').toDict();
      }
      if (typeof result === 'object' && result !== null) {
        return result as Record<string, unknown>;
      }
      // Neither a FunctionResult nor a dict — warn and fall back to
      // wrapping the stringified value. See Python's web_mixin /
      // serverless_mixin / tool_mixin for the equivalent check.
      log.warn(
        `SWAIG function "${this.name}" returned a value of type "${typeof result}" ` +
          `that is neither FunctionResult nor object; falling back to str(result). ` +
          `The AI will see the stringified value as its tool response. Wrap your ` +
          `return in new FunctionResult(...) or return an object with at least a ` +
          `"response" key.`,
      );
      return new FunctionResult(String(result)).toDict();
    } catch (err) {
      log.error(`Error executing SWAIG function ${this.name}: ${err}`);
      return new FunctionResult(
        "Sorry, I couldn't complete that action. Please try again or contact support if the issue persists.",
      ).toDict();
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
    return def;
  }
}
