/**
 * Semantic gates: natural-language preconditions on a SWAIG function.
 *
 * A semantic gate is a yes/no question a decision model answers about the call
 * right before the platform dispatches the function. Every gate on the function
 * must pass for it to run. When one doesn't, the function isn't dispatched, and
 * the model gets that gate's `on_fail` output instead, as if a data_map had
 * returned it.
 *
 * The platform refuses the whole function when any of its gates is invalid, so
 * the SDK checks gates by the platform's rules when a tool is defined, and
 * throws instead of sending a function the platform would drop. A platform
 * release without semantic gates ignores them and runs the function ungated.
 *
 * Python equivalent: `signalwire/core/semantic_gate.py`.
 */

import { FunctionResult } from './FunctionResult.js';

/**
 * Phrases a function says, keyed by language code, `"auto"` (translated into
 * the call's language on first use) or `"default"`. An entry is a phrase, or a
 * list of phrases, a wait script, spoken one at a time while the call waits.
 */
export type FillerPhrases = Record<string, ReadonlyArray<string | readonly string[]>>;

/** The most gates one function can carry. */
export const MAX_GATES = 8;
/** The longest gate question, in UTF-8 bytes. */
export const MAX_QUESTION_BYTES = 8192;
/** The longest `criteria.true` or `criteria.false`, in UTF-8 bytes. */
export const MAX_CRITERIA_BYTES = 2048;
/** The largest `on_fail` output, as compact JSON in UTF-8 bytes. */
export const MAX_ON_FAIL_BYTES = 8192;

const GATE_KEYS: ReadonlySet<string> = new Set([
  'id',
  'question',
  'criteria',
  'threshold',
  'on_fail',
]);
const GATE_ID = /^[A-Za-z0-9_]{1,64}$/;

/**
 * Hooks the platform calls itself, the function it intercepts by name, and the
 * built-in function names: gates on any of them are refused.
 */
export const RESERVED_FUNCTION_NAMES: ReadonlySet<string> = new Set([
  'startup_hook',
  'hangup_hook',
  'check_for_input',
  'end_call',
  'hangup',
  'check_time',
  'wait_for_user',
  'wait_seconds',
  'adjust_response_latency',
  'next_step',
  'change_context',
  'gather_submit',
  'get_visual_input',
  'get_ideal_strategy',
  'pause_conversation',
]);

/** Options for {@link SemanticGate} besides its question, threshold and `on_fail`. */
export interface SemanticGateOptions {
  /**
   * The gate's id, 1 to 64 letters, digits or underscores, unique within the
   * function. Defaults to `gate_<n>`, 1-based.
   */
  id?: string;
  /** What yes means, at most 2 KB. */
  trueMeans?: string;
  /** What no means, at most 2 KB. */
  falseMeans?: string;
}

/**
 * One semantic gate: a yes/no question about the call, and what the model gets
 * when the answer isn't yes.
 *
 * The decision model sees the recent dialogue as `conversation`, the call's
 * `global_data.semantic_state` as `semantic_state`, and the proposed call as
 * `proposed_function`. Write each question as one proposition and name what
 * it's about with those field names, in backticks. The model reads literally
 * and doesn't do arithmetic or compare dates, so put a computed result in
 * `semantic_state` instead of asking for it.
 *
 * The gate is checked when the tool that carries it is defined, not when it's
 * built.
 *
 * @example
 * ```typescript
 * new SemanticGate(
 *   'Has the caller explicitly asked to cancel their account in `conversation`?',
 *   0.95,
 *   new FunctionResult()
 *     .setToolResponse(
 *       'cancel_account was not run.',
 *       'Ask the caller to confirm that they want to cancel.',
 *     )
 *     .updateGlobalData({ cancel_attempted: true }),
 *   {
 *     id: 'explicit_request',
 *     trueMeans: 'The caller says they want to cancel.',
 *     falseMeans: 'The caller asked about cancelling, or said something else.',
 *   },
 * );
 * ```
 */
export class SemanticGate {
  /** The yes/no question. */
  question: string;
  /** The probability of yes, above 0 and at most 1, at or above which the gate passes. */
  threshold: number;
  /** The gate's id, or undefined for the default `gate_<n>`. */
  id?: string;
  /** What yes and no mean, keyed `true` and `false`. */
  criteria: { true?: string; false?: string };
  /** The output the model gets when this is the first gate that fails. */
  onFail: Record<string, unknown>;

  /**
   * @param question - The yes/no question, at most 8 KB. Its `${...}`
   *   variables are expanded from the call's global data when the gate is
   *   checked; `@{...}` functions are not.
   * @param threshold - The probability of yes, above 0 and at most 1, at or
   *   above which the gate passes. Thresholds are calibrated per decision model
   *   version.
   * @param onFail - What the model gets when this is the first gate that fails:
   *   the tool result text, a FunctionResult, or a data_map output object. A
   *   FunctionResult's response and actions are used; its `tool_prompt` becomes
   *   a system message after the tool result in the text pipeline, which OpenAI
   *   Realtime agents don't use. The actions run as written, without template
   *   expansion.
   * @param opts - The gate's id, and what yes and no mean.
   * @throws {Error} When `onFail` has no response: a blocked call must never
   *   read as a success.
   */
  constructor(
    question: string,
    threshold: number,
    onFail: string | FunctionResult | Record<string, unknown>,
    opts: SemanticGateOptions = {},
  ) {
    this.question = question;
    this.threshold = threshold;
    this.id = opts.id;
    this.criteria = {};
    if (opts.trueMeans !== undefined) this.criteria.true = opts.trueMeans;
    if (opts.falseMeans !== undefined) this.criteria.false = opts.falseMeans;
    this.onFail = onFailOutput(onFail);
  }

  /**
   * The gate as the platform reads it.
   * @returns The gate object: `id` (when set), `question`, `criteria` (when
   *   set), `threshold` and `on_fail`.
   */
  toDict(): Record<string, unknown> {
    const gate: Record<string, unknown> = {};
    if (this.id !== undefined) gate['id'] = this.id;
    gate['question'] = this.question;
    if (Object.keys(this.criteria).length > 0) gate['criteria'] = { ...this.criteria };
    gate['threshold'] = this.threshold;
    gate['on_fail'] = deepCopy(this.onFail);
    return gate;
  }
}

/** Build an on_fail output object from a string, FunctionResult or object. */
function onFailOutput(
  onFail: string | FunctionResult | Record<string, unknown>,
): Record<string, unknown> {
  if (onFail instanceof FunctionResult) {
    const dict = onFail.toDict() as Record<string, unknown>;
    // toDict() fills in "Action completed." when there is no response; a
    // blocked call must never read as a success, so the platform requires one.
    const hasResponse = typeof dict['response'] === 'object' || onFail.response !== '';
    if (!hasResponse) {
      throw new Error("on_fail needs a response saying the function didn't run");
    }
    const output: Record<string, unknown> = { response: dict['response'] };
    if (onFail.action.length > 0) {
      output['action'] = onFail.action;
      if (onFail.postProcess) output['post_process'] = true;
    }
    return output;
  }
  if (typeof onFail === 'string') {
    if (!onFail) throw new Error("on_fail needs a response saying the function didn't run");
    return { response: onFail };
  }
  return onFail;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function utf8Length(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Why the platform would refuse `on_fail`, or an empty string. */
function checkOnFail(onFail: unknown): string {
  if (!isPlainObject(onFail)) return 'on_fail must be an object';
  const response = onFail['response'];
  if (typeof response === 'string') {
    if (!response) return 'on_fail.response is empty';
  } else if (isPlainObject(response)) {
    const toolResult = response['tool_result'];
    if (typeof toolResult !== 'string' || !toolResult) {
      return 'on_fail.response.tool_result is missing or empty';
    }
    if ('tool_prompt' in response && typeof response['tool_prompt'] !== 'string') {
      return 'on_fail.response.tool_prompt must be a string';
    }
  } else {
    return 'on_fail.response is missing';
  }
  if ('action' in onFail && !Array.isArray(onFail['action'])) {
    return 'on_fail.action must be an array';
  }
  // Measured as the platform measures it: compact JSON, non-ASCII as UTF-8
  if (utf8Length(JSON.stringify(onFail)) > MAX_ON_FAIL_BYTES) {
    return `on_fail is larger than ${MAX_ON_FAIL_BYTES} bytes`;
  }
  return '';
}

/** Why the platform would refuse `criteria`, or an empty string. */
function checkCriteria(criteria: unknown): string {
  if (!isPlainObject(criteria) || Object.keys(criteria).length === 0) {
    return 'criteria must be an object with true and/or false';
  }
  for (const [key, value] of Object.entries(criteria)) {
    if (key !== 'true' && key !== 'false') {
      return `criteria has an unknown key '${key}'; only true and false are allowed`;
    }
    if (typeof value !== 'string' || !value) return `criteria.${key} must be a non-empty string`;
    if (utf8Length(value) > MAX_CRITERIA_BYTES) {
      return `criteria.${key} is longer than ${MAX_CRITERIA_BYTES} bytes`;
    }
  }
  return '';
}

/** Why the platform would refuse one gate, or an empty string. */
function checkGate(gate: unknown): string {
  if (!isPlainObject(gate)) return 'must be an object';
  for (const key of Object.keys(gate)) {
    if (!GATE_KEYS.has(key)) return `unknown key '${key}'`;
  }
  const question = gate['question'];
  if (typeof question !== 'string' || !question) return 'question is missing or empty';
  if (utf8Length(question) > MAX_QUESTION_BYTES) {
    return `question is longer than ${MAX_QUESTION_BYTES} bytes`;
  }
  const threshold = gate['threshold'];
  if (
    typeof threshold !== 'number' ||
    !Number.isFinite(threshold) ||
    !(threshold > 0 && threshold <= 1)
  ) {
    return 'threshold must be a number above 0 and at most 1';
  }
  if (!('on_fail' in gate)) return 'on_fail is missing';
  const onFailWhy = checkOnFail(gate['on_fail']);
  if (onFailWhy) return onFailWhy;
  if ('criteria' in gate) {
    const criteriaWhy = checkCriteria(gate['criteria']);
    if (criteriaWhy) return criteriaWhy;
  }
  if ('id' in gate) {
    const id = gate['id'];
    if (typeof id !== 'string' || !GATE_ID.test(id)) {
      return 'id must be 1 to 64 letters, digits or underscores';
    }
  }
  return '';
}

/**
 * Return a function's gates as the platform reads them.
 *
 * Internal: tools call this through {@link _applyGateFields}.
 * @param gates - SemanticGate objects or gate objects, 1 to 8.
 * @param functionName - The function's name.
 * @returns Each gate as a plain object, deep-copied.
 * @throws {Error} For anything that would make the platform refuse the
 *   function, with the platform's reason.
 */
export function _gateDefinitions(gates: unknown, functionName: string): Record<string, unknown>[] {
  if (RESERVED_FUNCTION_NAMES.has(functionName)) {
    throw new Error(`gates are not supported on ${functionName}, a hook or built-in function name`);
  }
  if (!Array.isArray(gates)) throw new Error(`${functionName}: gates must be a list`);
  if (gates.length < 1 || gates.length > MAX_GATES) {
    throw new Error(
      `${functionName}: gates must hold 1 to ${MAX_GATES} gates, not ${gates.length}`,
    );
  }
  const definitions: Record<string, unknown>[] = [];
  const ids: string[] = [];
  gates.forEach((gate: unknown, index: number) => {
    const definition = gate instanceof SemanticGate ? gate.toDict() : gate;
    const why = checkGate(definition);
    if (why) throw new Error(`${functionName}: gate ${index + 1}: ${why}`);
    const gateDefinition = definition as Record<string, unknown>;
    const id = (gateDefinition['id'] as string | undefined) ?? `gate_${index + 1}`;
    const earlier = ids.indexOf(id);
    if (earlier >= 0) {
      throw new Error(
        `${functionName}: gate ${index + 1}: id '${id}' is already used by gate ${earlier + 1}`,
      );
    }
    ids.push(id);
    definitions.push(deepCopy(gateDefinition));
  });
  return definitions;
}

/**
 * Check and normalize `gates` and `gate_fillers` in a function's fields, in
 * place.
 *
 * `fields` is a function definition, or the extra fields of one. Its `gates`
 * become the objects the platform reads; a null or undefined `gates` or
 * `gate_fillers` is removed.
 *
 * Internal: every way to define a tool calls it.
 * @param fields - The function definition or its extra fields.
 * @param functionName - The function's name.
 * @throws {Error} For gates the platform would refuse, or `gate_fillers` on a
 *   function without gates, which the platform ignores.
 */
export function _applyGateFields(fields: Record<string, unknown>, functionName: string): void {
  if (fields['gates'] !== undefined && fields['gates'] !== null) {
    fields['gates'] = _gateDefinitions(fields['gates'], functionName);
  } else {
    delete fields['gates'];
  }
  const gateFillers = fields['gate_fillers'];
  if (gateFillers === undefined || gateFillers === null) {
    delete fields['gate_fillers'];
    return;
  }
  if (!('gates' in fields)) {
    throw new Error(
      `${functionName}: gate_fillers needs gates; the platform ignores them on a ` +
        'function without gates',
    );
  }
  if (!isPlainObject(gateFillers)) {
    throw new Error(
      `${functionName}: gate_fillers must map a language code, 'auto' or ` +
        "'default' to a list of phrases",
    );
  }
}
