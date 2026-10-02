/**
 * FunctionResult: builder for SWAIG function responses.
 *
 * Carries a response for the model and a list of structured actions (connect,
 * hangup, SMS and others). Every mutating method returns `this` for fluent chaining.
 */

/**
 * A single SWAIG action object. Each action is keyed by its action name (for
 * example `hangup`, `say` or `SWML`) mapped to that action's payload. `connect()`,
 * `swmlTransfer()` and `executeSwml(..., true)` also put a `transfer` key beside
 * `SWML` in the same object.
 * The name set is open-ended (the platform adds new actions), so this is an open
 * key-to-value map rather than a closed union. {@link FunctionResult}'s
 * `addAction`, `connect`, `swmlTransfer` and the other helpers build these, and
 * they are emitted as given under the `action` key of the SWAIG response.
 */
export type SwaigAction = Record<string, unknown>;

/**
 * The object {@link FunctionResult.toDict} serializes to: the SWAIG response
 * body. `toDict` only ever sets these three keys (plus the `response` fallback),
 * so the shape is closed (no index signature).
 */
export interface SwaigResultDict {
  /**
   * Context for the model: a string, or `{ tool_result, tool_prompt }`
   * separating what the tool found from what the model should do next. Omitted
   * when empty (unless it is the sole fallback).
   */
  response?: string | { tool_result?: string; tool_prompt?: string };
  /** Ordered list of actions to execute. Omitted when there are none. */
  action?: SwaigAction[];
  /** Present (and `true`) only when post-processing is on and actions exist. */
  post_process?: boolean;
}

/** Prompt configuration for a payment collection flow. */
export interface PaymentPrompt {
  /** The payment step this prompt applies to (for example "payment-card-number"). */
  for: string;
  /** Actions to perform for this prompt. */
  actions: PaymentAction[];
  /** Optional card type filter for this prompt. */
  card_type?: string;
  /** Optional error type this prompt handles. */
  error_type?: string;
}

/** A single action within a payment prompt: a phrase to say or a file to play. */
export interface PaymentAction {
  /** The action type: "Say" or "Play" (the SWML `pay` schema's values). */
  type: string;
  /** The text to say, or for "Play" the URL of the audio file. */
  phrase: string;
}

/** A custom key-value parameter passed to the payment connector. */
export interface PaymentParameter {
  /** The parameter name. */
  name: string;
  /** The parameter value. */
  value: string;
}

/**
 * A SWML variable reference, such as `${timeout}` or `%{timeout}`, which the
 * SWML schema accepts wherever it accepts an integer or a boolean.
 */
const SWML_VAR = /^[$%]\{.*\}$/;

/** Show a rejected value in an error message: strings quoted, the rest as written. */
function showValue(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/**
 * Return `value` as an integer for a SWML verb, or throw.
 *
 * Accepts an integer, a string of digits (optionally negative, surrounding
 * spaces ignored), or a SWML variable reference, which is passed through as
 * written. An integer must be within `minimum` and `maximum` when they are
 * given. Mirrors Python's `_swml_int()`.
 */
function swmlInt(
  name: string,
  value: unknown,
  minimum?: number,
  maximum?: number,
): number | string {
  let num: number | undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    if (SWML_VAR.test(text)) return text;
    if (/^-?\d+$/.test(text)) num = Number(text);
  } else if (typeof value === 'number' && Number.isInteger(value)) {
    num = value;
  }
  const inRange =
    num !== undefined &&
    (minimum === undefined || num >= minimum) &&
    (maximum === undefined || num <= maximum);
  if (!inRange) {
    let expected = 'an integer';
    if (minimum !== undefined && maximum !== undefined) {
      expected = `an integer from ${minimum} to ${maximum}`;
    } else if (minimum !== undefined) {
      expected = `an integer of at least ${minimum}`;
    } else if (maximum !== undefined) {
      expected = `an integer of at most ${maximum}`;
    }
    throw new Error(`${name} must be ${expected}, got ${showValue(value)}`);
  }
  return num!; // inRange implies num is set
}

/**
 * Return `value` as a boolean for a SWML verb, or throw.
 *
 * Accepts a boolean, the strings `"true"` and `"false"` in any case, or a
 * SWML variable reference, which is passed through as written. Mirrors
 * Python's `_swml_bool()`.
 */
function swmlBool(name: string, value: unknown): boolean | string {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const text = value.trim();
    const lower = text.toLowerCase();
    if (lower === 'true' || lower === 'false') return lower === 'true';
    if (SWML_VAR.test(text)) return text;
  }
  throw new Error(`${name} must be a boolean, got ${showValue(value)}`);
}

/**
 * Builder for SWAIG function responses.
 *
 * Carries a response and a list of structured actions (connect, hangup, SMS,
 * record, transfer and others) that the SignalWire platform executes. Every
 * mutating method returns `this` for fluent chaining.
 *
 * The response is context for the model, not speech played to the caller. The
 * model reads it and decides what to say. It can carry facts, an instruction, or
 * both. The clearest form keeps them apart with {@link setToolResponse}, or the
 * constructor's `toolResult` and `toolPrompt`: `tool_result` holds the facts and
 * `tool_prompt` the instruction. A plain string of facts ("Order 1234 shipped
 * Tuesday.") or an instruction ("Tell the caller their order shipped Tuesday.")
 * also works. Avoid a line written for the caller ("Your order shipped
 * Tuesday."): the model interprets it rather than speaking it, so it can drift
 * or be rephrased. Set `postProcess` when the caller must hear something before
 * an action takes effect (hold, connect, transfer, hangup).
 *
 * Return an instance (or a promise that resolves to one) from any SWAIG tool
 * handler. Handlers receive `(args, rawData, agent)`.
 *
 * @example Simple text response
 * ```ts
 * agent.defineTool({
 *   name: 'say_hi',
 *   description: 'Say hello.',
 *   parameters: { type: 'object', properties: {} },
 *   handler: () => new FunctionResult('Greet the caller warmly.'),
 * });
 * ```
 *
 * @example Response plus a call-control action
 * ```ts
 * agent.defineTool({
 *   name: 'transfer_to_sales',
 *   description: 'Forward the caller to sales.',
 *   parameters: { type: 'object', properties: {} },
 *   handler: () =>
 *     new FunctionResult('Tell the caller you are connecting them to sales.', true).connect(
 *       '+15551112222',
 *     ),
 * });
 * ```
 *
 * @example Chained actions
 * ```ts
 * new FunctionResult('Tell the caller they are all set and say goodbye.', true)
 *   .sendSms({ toNumber: '+15551234567', fromNumber: '+15559998888', body: 'Confirmation!' })
 *   .hangup();
 * ```
 *
 * @see {@link AgentBase.defineTool}, where handlers return a `FunctionResult`
 * @see {@link DataMap}, an alternative for data-driven tools with no handler
 */
export class FunctionResult {
  /**
   * The response string returned to the model as context. When the structured
   * form is set ({@link setToolResponse}), that is sent instead.
   */
  response: string;
  /** The structured response set by {@link setToolResponse}, sent instead of `response`. */
  private _toolResponse: { tool_result?: string; tool_prompt?: string } | null = null;
  /** Ordered list of actions to execute after the response. */
  action: SwaigAction[];
  /** Whether actions should be post-processed after the AI responds. */
  postProcess: boolean;

  /**
   * @param response - Initial response: a string of context for the model
   *   (facts or an instruction), or the structured `{ tool_result, tool_prompt }`
   *   form. Defaults to an empty string.
   * @param postProcess - Whether the model takes one more turn before the
   *   actions execute (set it when the caller must hear something first).
   * @param toolResult - Sets the structured response's `tool_result` (see
   *   {@link setToolResponse}).
   * @param toolPrompt - Sets the structured response's `tool_prompt`.
   */
  constructor(
    response?: string | { tool_result?: string; tool_prompt?: string },
    postProcess = false,
    toolResult?: string,
    toolPrompt?: string,
  ) {
    this.action = [];
    this.postProcess = postProcess;
    if (typeof response === 'object' && response !== null) {
      this.response = '';
      this._toolResponse = { ...response };
    } else {
      this.response = response ?? '';
    }
    if (toolResult !== undefined || toolPrompt !== undefined) {
      this.setToolResponse(toolResult, toolPrompt);
    }
  }

  // ── Core ────────────────────────────────────────────────────────────

  /**
   * Set the response string returned to the model as context. Clears any
   * structured response set by {@link setToolResponse}.
   * @param response - The response text: facts or an instruction.
   * @returns This instance for chaining.
   */
  setResponse(response: string): this {
    this.response = response;
    this._toolResponse = null;
    return this;
  }

  /**
   * Set the structured response, separating facts from instruction:
   * `{ tool_result, tool_prompt }`. Replaces any string response.
   *
   * - `toolResult`: what the tool did or found. Facts for the model to reason
   *   from ("hold initiated", "payment declined", "3 seats left").
   * - `toolPrompt`: what the model should do next. An instruction, such as
   *   "Tell the caller how many seats are left."
   *
   * Splitting them keeps the model from reading a status line aloud, and keeps
   * the instruction from being mistaken for data.
   *
   * @param toolResult - Facts from the call; omit if there is nothing to
   *   report beyond the instruction.
   * @param toolPrompt - Instruction for what to do next; omit for a
   *   facts-only result.
   * @returns This instance for chaining.
   */
  setToolResponse(toolResult?: string, toolPrompt?: string): this {
    const payload: { tool_result?: string; tool_prompt?: string } = {};
    if (toolResult !== undefined) payload.tool_result = toolResult;
    if (toolPrompt !== undefined) payload.tool_prompt = toolPrompt;
    this._toolResponse = payload;
    this.response = '';
    return this;
  }

  /**
   * Enable or disable post-processing. When enabled, the model takes one more
   * turn before the actions execute, so it can tell the caller something first.
   * @param postProcess - Whether to post-process actions.
   * @returns This instance for chaining.
   */
  setPostProcess(postProcess: boolean): this {
    this.postProcess = postProcess;
    return this;
  }

  /**
   * Append a single named action to the action list.
   * @param name - The action name (e.g., "hangup", "say").
   * @param data - The action payload.
   * @returns This instance for chaining.
   */
  addAction(name: string, data: unknown): this {
    this.action.push({ [name]: data });
    return this;
  }

  /**
   * Append multiple action objects to the action list.
   * @param actions - Array of action objects to append.
   * @returns This instance for chaining.
   */
  addActions(actions: SwaigAction[]): this {
    this.action.push(...actions);
    return this;
  }

  // ── Call control ────────────────────────────────────────────────────

  /**
   * Connect the call to another destination with an inline SWML `connect`
   * document, emitted with `transfer: "true"` or `"false"` beside it.
   * @param destination - The destination address (phone number or SIP URI).
   * @param final - `true` (default) for a permanent transfer that leaves the
   *   agent; `false` returns the call to the agent when the far end hangs up.
   * @param fromAddr - Optional caller ID to use for the outbound leg.
   * @returns This instance for chaining.
   */
  connect(destination: string, final = true, fromAddr?: string): this {
    const connectParams: Record<string, string> = { to: destination };
    if (fromAddr !== undefined) {
      connectParams['from'] = fromAddr;
    }
    this.action.push({
      SWML: {
        sections: { main: [{ connect: connectParams }] },
        version: '1.0.0',
      },
      transfer: String(final),
    });
    return this;
  }

  /**
   * Transfer the call with an inline SWML document that sets `ai_response` and
   * then runs the `transfer` verb, emitted with `transfer` beside it.
   * @param dest - The transfer destination (a SWML URL, SIP address or similar).
   * @param aiResponse - Stored as `ai_response`, for the agent to use when a
   *   non-final transfer returns the call.
   * @param final - `true` (default) for a permanent transfer; `false` to return.
   * @returns This instance for chaining.
   */
  swmlTransfer(dest: string, aiResponse: string, final = true): this {
    this.action.push({
      SWML: {
        version: '1.0.0',
        sections: {
          main: [{ set: { ai_response: aiResponse } }, { transfer: { dest } }],
        },
      },
      transfer: String(final),
    });
    return this;
  }

  /**
   * Hang up the call. Emits `{ hangup: true }`.
   * @returns This instance for chaining.
   */
  hangup(): this {
    return this.addAction('hangup', true);
  }

  /**
   * Put the call on hold, optionally announcing it and routing what happens next.
   *
   * The hold action carries no prompt of its own, and during a hold speech
   * detection is paused and the agent doesn't respond, so anything the caller
   * needs to hear has to be said before the hold takes effect. Passing `prompt`
   * does that: it becomes the structured response's `tool_prompt` (with
   * `tool_result: "status: on hold"`) and turns on `postProcess`, so the model
   * takes one more turn, and can tell the caller, before the hold runs.
   *
   * `step` and `timeoutStep` move the call to a step when the hold ends:
   * `step` when it's taken off hold, `timeoutStep` when the hold times out.
   * They fire when the hold ends, unlike {@link swmlChangeStep}, which applies
   * at once and would move the caller before the hold begins. Omit one, and a
   * hold that ends that way resumes in the current step. Omitting both emits
   * the bare timeout (`{ hold: 300 }`); either one emits
   * `{ hold: { timeout, step?, timeout_step? } }`.
   *
   * @example
   * ```ts
   * new FunctionResult().hold('Tell the caller you are checking if they are available.', 300,
   *   'back_with_agent', 'take_a_message');
   * ```
   *
   * @param prompt - Instruction for the model to act on before the hold. A
   *   number here is taken as `timeout`, so `hold(120)` keeps working.
   * @param timeout - Hold duration in seconds, clamped to 0-900 (default 300).
   * @param step - Step to move to when the call is taken off hold.
   * @param timeoutStep - Step to move to when the hold times out.
   * @returns This instance for chaining.
   */
  hold(prompt?: string | number, timeout = 300, step?: string, timeoutStep?: string): this {
    let text: string | undefined;
    if (typeof prompt === 'number') {
      timeout = prompt;
    } else {
      text = prompt;
    }
    if (text !== undefined) {
      this.setToolResponse('status: on hold', text);
      this.postProcess = true;
    }
    const clamped = Math.max(0, Math.min(timeout, 900));
    if (step === undefined && timeoutStep === undefined) {
      return this.addAction('hold', clamped);
    }
    const config: Record<string, unknown> = { timeout: clamped };
    if (step !== undefined) config['step'] = step;
    if (timeoutStep !== undefined) config['timeout_step'] = timeoutStep;
    return this.addAction('hold', config);
  }

  /**
   * Emit a `wait_for_user` action. The first option set wins, in this order:
   * `answerFirst` (emits `"answer_first"`), `timeout`, `enabled`; with none,
   * it emits `true`.
   * @param opts - Options controlling wait behavior: enable/disable, timeout in
   *   seconds, or answer-first mode.
   * @returns This instance for chaining.
   */
  waitForUser(opts?: { enabled?: boolean; timeout?: number; answerFirst?: boolean }): this {
    let value: unknown = true;
    if (opts?.answerFirst) {
      value = 'answer_first';
    } else if (opts?.timeout !== undefined) {
      value = opts.timeout;
    } else if (opts?.enabled !== undefined) {
      value = opts.enabled;
    }
    return this.addAction('wait_for_user', value);
  }

  /**
   * Stop the AI conversation. Emits `{ stop: true }`.
   * @returns This instance for chaining.
   */
  stop(): this {
    return this.addAction('stop', true);
  }

  // ── Audio ───────────────────────────────────────────────────────────

  /**
   * Speak text to the caller via TTS. Unlike the response, this text is
   * spoken to the caller.
   * @param text - The text to speak.
   * @returns This instance for chaining.
   */
  say(text: string): this {
    return this.addAction('say', text);
  }

  /**
   * Play an audio file in the background during the call.
   * @param filename - URL or path of the audio file.
   * @param wait - Whether to wait for playback to finish before continuing.
   *   `true` emits `{ file, wait: true }`; `false` emits the file name alone.
   * @returns This instance for chaining.
   */
  playBackgroundFile(filename: string, wait = false): this {
    if (wait) {
      return this.addAction('playback_bg', { file: filename, wait: true });
    }
    return this.addAction('playback_bg', filename);
  }

  /**
   * Stop any currently playing background audio file.
   * @returns This instance for chaining.
   */
  stopBackgroundFile(): this {
    return this.addAction('stop_playback_bg', true);
  }

  /**
   * Change the agent's voice for the rest of the call.
   *
   * The voice is an `engine.voice:model` spec — the same form a language's voice
   * takes in the SWML `languages` list (e.g. `"elevenlabs.rachel"`); the
   * `engine.` prefix and the `:model` suffix are optional. It replaces the voice
   * of the language currently in use, and switching to a voice on a different
   * TTS engine is allowed. The platform applies it at the next speech batch
   * boundary (never mid-utterance), and it then persists for that language for
   * the rest of the call. If the new voice cannot be opened, the platform falls
   * back to its fallback voice. The platform ignores an empty spec, so the SDK
   * refuses one.
   * @param voice - Voice spec in `engine.voice:model` form.
   * @returns This instance for chaining.
   * @throws {Error} When `voice` is empty or only whitespace.
   */
  changeVoice(voice: string): this {
    if (typeof voice !== 'string' || !voice.trim()) {
      throw new Error('voice must be a non-empty string');
    }
    return this.addAction('change_voice', voice);
  }

  // ── Speech ──────────────────────────────────────────────────────────

  /**
   * Add dynamic speech recognition hints to improve transcription accuracy.
   * @param hints - Array of hint strings or pattern-replacement objects.
   * @returns This instance for chaining.
   */
  addDynamicHints(
    hints: (string | { pattern: string; replace: string; ignore_case?: boolean })[],
  ): this {
    return this.addAction('add_dynamic_hints', hints);
  }

  /**
   * Remove all previously added dynamic speech hints.
   * @returns This instance for chaining.
   */
  clearDynamicHints(): this {
    this.action.push({ clear_dynamic_hints: {} });
    return this;
  }

  /**
   * Set the silence after detected speech that finalizes speech recognition.
   * @param milliseconds - Timeout in milliseconds.
   * @returns This instance for chaining.
   */
  setEndOfSpeechTimeout(milliseconds: number): this {
    return this.addAction('end_of_speech_timeout', milliseconds);
  }

  /**
   * Set the time since the last speech detection event after which speech
   * recognition is finalized. Suits noisy environments.
   * @param milliseconds - Timeout in milliseconds.
   * @returns This instance for chaining.
   */
  setSpeechEventTimeout(milliseconds: number): this {
    return this.addAction('speech_event_timeout', milliseconds);
  }

  // ── Data ────────────────────────────────────────────────────────────

  /**
   * Merge key-value pairs into the call's global data (`set_global_data`),
   * which persists for the AI session and is readable by every function.
   * @param data - Key-value pairs to set or update.
   * @returns This instance for chaining.
   */
  updateGlobalData(data: Record<string, unknown>): this {
    return this.addAction('set_global_data', data);
  }

  /**
   * Set the semantic state the call's semantic gates judge, besides the
   * dialogue.
   *
   * The state is `global_data.semantic_state`, and this replaces it as a whole:
   * to change one field, send the whole state with that field changed, and
   * send `{}` to reset it. Keep it to what the application has established,
   * such as an order the caller confirmed, rather than what the caller claims;
   * nothing else from the global data reaches the decision model.
   * @param state - The semantic state.
   * @returns This instance for chaining.
   */
  setSemanticState(state: Record<string, unknown>): this {
    return this.updateGlobalData({ semantic_state: state });
  }

  /**
   * Remove keys from the global data store.
   * @param keys - A single key or array of keys to remove.
   * @returns This instance for chaining.
   */
  removeGlobalData(keys: string | string[]): this {
    return this.addAction('unset_global_data', keys);
  }

  /**
   * Set metadata (`set_meta_data`) scoped to the current function's
   * `meta_data_token`. Functions sharing a token share the metadata.
   * @param data - Metadata key-value pairs to set.
   * @returns This instance for chaining.
   */
  setMetadata(data: Record<string, unknown>): this {
    return this.addAction('set_meta_data', data);
  }

  /**
   * Remove metadata keys (`unset_meta_data`) from the current function's
   * `meta_data_token` scope.
   * @param keys - A single key or array of keys to remove.
   * @returns This instance for chaining.
   */
  removeMetadata(keys: string | string[]): this {
    return this.addAction('unset_meta_data', keys);
  }

  // ── SWML helpers ────────────────────────────────────────────────────

  /**
   * Execute arbitrary SWML content as an action.
   *
   * A JSON string is parsed; a string that isn't JSON is sent as
   * `{ raw_swml: <string> }`. An object with a `toDict()` method is converted
   * through it, and a plain object is copied. Any other value throws.
   *
   * @param swmlContent - SWML as a JSON string, a plain object, or an object
   *   with `toDict()`.
   * @param transfer - When `true`, emits `transfer: "true"` beside the `SWML`
   *   key, so the call leaves the agent for the SWML.
   * @returns This instance for chaining.
   * @throws {Error} When `swmlContent` is not a string, a plain object, or an
   *   object with `toDict()` (for example a number, an array or `null`).
   */
  executeSwml(
    swmlContent: string | Record<string, unknown> | { toDict(): Record<string, unknown> },
    transfer = false,
  ): this {
    let swmlData: Record<string, unknown>;
    if (typeof swmlContent === 'string') {
      try {
        swmlData = JSON.parse(swmlContent) as Record<string, unknown>;
      } catch {
        swmlData = { raw_swml: swmlContent };
      }
    } else if (
      typeof swmlContent === 'object' &&
      swmlContent !== null &&
      typeof (swmlContent as { toDict?: unknown }).toDict === 'function'
    ) {
      // SWML SDK object - convert via toDict(). The object/null check guards the
      // property access (Python's hasattr is null-safe; TS member access is not).
      swmlData = (swmlContent as { toDict(): Record<string, unknown> }).toDict();
    } else if (
      typeof swmlContent === 'object' &&
      swmlContent !== null &&
      !Array.isArray(swmlContent)
    ) {
      // Plain object (dict) - copy to avoid mutating the caller's data.
      swmlData = { ...(swmlContent as Record<string, unknown>) };
    } else {
      // Mirror Python's execute_swml: a non-string / non-toDict / non-dict value
      // (number, array, null, ...) is a programming error. This is the shared sink
      // for every SWML helper, so a bad value must fail loudly rather than spread.
      throw new Error('swml_content must be string, dict, or SWML object');
    }
    // transfer rides BESIDE the SWML document, not inside it: the same shape
    // connect() and swmlTransfer() emit. Inside the document it isn't a SWML
    // key, and the call never leaves the agent.
    const action: SwaigAction = { SWML: swmlData };
    if (transfer) action['transfer'] = 'true';
    this.action.push(action);
    return this;
  }

  /**
   * Move the conversation to a step in the current context (`change_step`).
   * The change applies at once, and the step must exist in the current
   * context of the agent's contexts (see `defineContexts()`).
   * @param stepName - The name of the step to switch to.
   * @returns This instance for chaining.
   */
  swmlChangeStep(stepName: string): this {
    return this.addAction('change_step', stepName);
  }

  /**
   * Move the conversation to another context (`change_context`). The context
   * must exist in the agent's contexts (see `defineContexts()`).
   * @param contextName - The name of the context to switch to.
   * @returns This instance for chaining.
   */
  swmlChangeContext(contextName: string): this {
    return this.addAction('change_context', contextName);
  }

  /**
   * Send an event to the client connected to the call, through an inline SWML
   * `user_event` verb. The client receives it as a `user_event` event.
   * @param eventData - The event payload.
   * @returns This instance for chaining.
   */
  swmlUserEvent(eventData: Record<string, unknown>): this {
    return this.addAction('SWML', {
      sections: { main: [{ user_event: { event: eventData } }] },
      version: '1.0.0',
    });
  }

  /**
   * Replace the agent's prompt mid-call (`context_switch`). With only
   * `systemPrompt`, emits the prompt string; otherwise emits an object with the
   * fields that are set.
   * @param opts - The new system prompt, a user prompt to add, whether to
   *   summarize the conversation so far (`consolidate`), and whether to reset the
   *   context completely (`fullReset`).
   * @returns This instance for chaining.
   */
  switchContext(opts?: {
    systemPrompt?: string;
    userPrompt?: string;
    consolidate?: boolean;
    fullReset?: boolean;
  }): this {
    const sp = opts?.systemPrompt;
    const up = opts?.userPrompt;
    const cons = opts?.consolidate;
    const fr = opts?.fullReset;

    if (sp && !up && !cons && !fr) {
      return this.addAction('context_switch', sp);
    }
    const data: Record<string, unknown> = {};
    if (sp) data['system_prompt'] = sp;
    if (up) data['user_prompt'] = up;
    if (cons) data['consolidate'] = true;
    if (fr) data['full_reset'] = true;
    return this.addAction('context_switch', data);
  }

  // ── Functions ───────────────────────────────────────────────────────

  /**
   * Enable or disable SWAIG functions by name.
   * @param toggles - Array of function name and active state pairs.
   * @returns This instance for chaining.
   */
  toggleFunctions(toggles: { function: string; active: boolean }[]): this {
    return this.addAction('toggle_functions', toggles);
  }

  /**
   * Control whether functions can be called on speaker timeout
   * (`functions_on_speaker_timeout`).
   * @param enabled - Whether to enable function execution on timeout.
   * @returns This instance for chaining.
   */
  enableFunctionsOnTimeout(enabled = true): this {
    return this.addAction('functions_on_speaker_timeout', enabled);
  }

  /**
   * Update AI settings at runtime (`settings`). The platform validates the
   * keys, such as `temperature`, `top-p` and `barge-confidence`.
   * @param settings - Key-value pairs of settings to update.
   * @returns This instance for chaining.
   */
  updateSettings(settings: Record<string, unknown>): this {
    return this.addAction('settings', settings);
  }

  // ── User input / history ────────────────────────────────────────────

  /**
   * Queue text as if the user had said it (`user_input`).
   * @param text - The simulated user input text.
   * @returns This instance for chaining.
   */
  simulateUserInput(text: string): this {
    return this.addAction('user_input', text);
  }

  /**
   * Send the full data to the model for this turn only, then a smaller
   * replacement in later turns (`extensive_data`).
   * @param enabled - Whether to send extensive data this turn.
   * @returns This instance for chaining.
   */
  enableExtensiveData(enabled = true): this {
    return this.addAction('extensive_data', enabled);
  }

  /**
   * After the first send, replace this tool call and its result in the
   * conversation history (`replace_in_history`).
   * @param text - A string replaces the pair with an assistant message holding
   *   that text; `true` (default) removes the pair from the history.
   * @returns This instance for chaining.
   */
  replaceInHistory(text: string | boolean = true): this {
    return this.addAction('replace_in_history', text);
  }

  // ── Comms ───────────────────────────────────────────────────────────

  /**
   * Send an SMS or MMS message from within the call flow.
   *
   * @param opts - SMS parameters. Must include `body` (text SMS), `media`
   *   (MMS), or both; supplying neither throws.
   * @returns This instance for chaining.
   * @throws {Error} When neither `body` nor `media` is provided.
   */
  sendSms(opts: {
    toNumber: string;
    fromNumber: string;
    body?: string;
    media?: string[];
    tags?: string[];
    region?: string;
  }): this {
    if (!opts.body && !opts.media) {
      throw new Error('Either body or media must be provided');
    }
    const smsParams: Record<string, unknown> = {
      to_number: opts.toNumber,
      from_number: opts.fromNumber,
    };
    if (opts.body) smsParams['body'] = opts.body;
    if (opts.media) smsParams['media'] = opts.media;
    if (opts.tags) smsParams['tags'] = opts.tags;
    if (opts.region) smsParams['region'] = opts.region;

    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ send_sms: smsParams }] },
    });
  }

  /**
   * Start a background recording of the call (SWML `record_call`).
   * @param opts - Recording options including format, direction, and timeouts.
   * @returns This instance for chaining.
   */
  recordCall(opts?: {
    controlId?: string;
    stereo?: boolean;
    format?: 'wav' | 'mp3' | 'mp4';
    direction?: 'speak' | 'listen' | 'both';
    terminators?: string;
    beep?: boolean;
    inputSensitivity?: number;
    initialTimeout?: number;
    endSilenceTimeout?: number;
    maxLength?: number;
    statusUrl?: string;
  }): this {
    const format = opts?.format ?? 'wav';
    const direction = opts?.direction ?? 'both';
    const params: Record<string, unknown> = {
      stereo: opts?.stereo ?? false,
      format,
      direction,
      beep: opts?.beep ?? false,
      input_sensitivity: opts?.inputSensitivity ?? 44.0,
    };
    if (opts?.controlId) params['control_id'] = opts.controlId;
    if (opts?.terminators) params['terminators'] = opts.terminators;
    if (opts?.initialTimeout !== undefined) params['initial_timeout'] = opts.initialTimeout;
    if (opts?.endSilenceTimeout !== undefined)
      params['end_silence_timeout'] = opts.endSilenceTimeout;
    if (opts?.maxLength !== undefined) params['max_length'] = opts.maxLength;
    if (opts?.statusUrl) params['status_url'] = opts.statusUrl;

    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ record_call: params }] },
    });
  }

  /**
   * Stop an active call recording.
   * @param controlId - Optional control ID of the recording to stop.
   * @returns This instance for chaining.
   */
  stopRecordCall(controlId?: string): this {
    const params: Record<string, unknown> = {};
    if (controlId) params['control_id'] = controlId;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ stop_record_call: params }] },
    });
  }

  /**
   * Start a media tap to stream audio to an external URI (`ws://`, `wss://` or
   * `rtp://IP:port`). `direction` is always sent; `codec` and `rtpPtime` are
   * sent only when they differ from `PCMU` and 20.
   * @param opts - Tap parameters including URI, direction, and codec.
   * @throws {Error} On a `direction` or `codec` outside the allowed values, or
   *   an `rtpPtime` that isn't positive.
   * @returns This instance for chaining.
   */
  tap(opts: {
    uri: string;
    controlId?: string;
    /** `speak` (what the party says), `listen` (what it hears) or `both` (default). */
    direction?: 'speak' | 'listen' | 'both';
    codec?: 'PCMU' | 'PCMA';
    rtpPtime?: number;
    statusUrl?: string;
  }): this {
    // Runtime guards matching the Python reference: a JS caller can pass any
    // string, and the types can't express rtp_ptime > 0.
    const direction = opts.direction ?? 'both';
    if (!['speak', 'listen', 'both'].includes(direction)) {
      throw new Error("direction must be one of ['speak', 'listen', 'both']");
    }
    if (opts.codec !== undefined && !['PCMU', 'PCMA'].includes(opts.codec)) {
      throw new Error("codec must be one of ['PCMU', 'PCMA']");
    }
    if (opts.rtpPtime !== undefined && opts.rtpPtime <= 0) {
      throw new Error('rtp_ptime must be a positive integer');
    }
    const params: Record<string, unknown> = { uri: opts.uri };
    if (opts.controlId) params['control_id'] = opts.controlId;
    // Always sent: the verb's own default is "speak", not this helper's
    // "both", so leaving it out would tap less than the caller asked for.
    params['direction'] = direction;
    if (opts.codec && opts.codec !== 'PCMU') params['codec'] = opts.codec;
    if (opts.rtpPtime && opts.rtpPtime !== 20) params['rtp_ptime'] = opts.rtpPtime;
    if (opts.statusUrl) params['status_url'] = opts.statusUrl;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ tap: params }] },
    });
  }

  /**
   * Stop an active media tap.
   * @param controlId - Optional control ID of the tap to stop.
   * @returns This instance for chaining.
   */
  stopTap(controlId?: string): this {
    const params: Record<string, unknown> = {};
    if (controlId) params['control_id'] = controlId;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ stop_tap: params }] },
    });
  }

  // ── Rooms / Conferences ─────────────────────────────────────────────

  /**
   * Join a RELAY room by name (SWML `join_room`).
   * @param name - The room name to join.
   * @returns This instance for chaining.
   */
  joinRoom(name: string): this {
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ join_room: { name } }] },
    });
  }

  /**
   * Send a SIP REFER to transfer the call.
   * @param toUri - The SIP URI to refer the call to.
   * @returns This instance for chaining.
   */
  sipRefer(toUri: string): this {
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ sip_refer: { to_uri: toUri } }] },
    });
  }

  /**
   * Join a conference by name with optional configuration. Options at their
   * default value are left out; with none left, `join_conference` is the name
   * string alone.
   *
   * `maxParticipants` is sent whenever it is given, as an integer of 2 or
   * more: the platform refuses a conference of fewer than 2 and sets no upper
   * limit (the SWML schema's cap of 100000 isn't enforced). A numeric string
   * is converted, and a SWML variable reference such as `'${room_size}'` is
   * passed through.
   * @param name - The conference name to join.
   * @param opts - Optional conference settings such as mute, recording, and callbacks.
   * @throws {Error} When `name` is blank, or `maxParticipants` isn't an
   *   integer of at least 2 or a SWML variable reference.
   * @returns This instance for chaining.
   */
  joinConference(
    name: string,
    opts?: {
      muted?: boolean;
      beep?: 'true' | 'false' | 'onEnter' | 'onExit';
      startOnEnter?: boolean;
      endOnExit?: boolean;
      waitUrl?: string;
      maxParticipants?: number | string;
      record?: 'do-not-record' | 'record-from-start';
      region?: string;
      trim?: 'trim-silence' | 'do-not-trim';
      coach?: string;
      statusCallbackEvent?: string;
      statusCallback?: string;
      statusCallbackMethod?: 'GET' | 'POST';
      recordingStatusCallback?: string;
      recordingStatusCallbackMethod?: 'GET' | 'POST';
      recordingStatusCallbackEvent?: string;
      result?: unknown;
    },
  ): this {
    // Runtime guards matching the Python reference (beep/record/trim/method are
    // covered at compile time by the literal-union types in the signature; these two cannot be).
    if (!name.trim()) {
      throw new Error('name cannot be empty');
    }
    // The platform refuses fewer than 2 members and has no upper limit.
    const maxParticipants =
      opts?.maxParticipants !== undefined && opts.maxParticipants !== null
        ? swmlInt('max_participants', opts.maxParticipants, 2)
        : undefined;
    const hasNonDefaults =
      opts &&
      (opts.muted ||
        (opts.beep && opts.beep !== 'true') ||
        opts.startOnEnter === false ||
        opts.endOnExit ||
        opts.waitUrl ||
        maxParticipants !== undefined ||
        (opts.record && opts.record !== 'do-not-record') ||
        opts.region ||
        (opts.trim && opts.trim !== 'trim-silence') ||
        opts.coach ||
        opts.statusCallbackEvent ||
        opts.statusCallback ||
        (opts.statusCallbackMethod && opts.statusCallbackMethod !== 'POST') ||
        opts.recordingStatusCallback ||
        (opts.recordingStatusCallbackMethod && opts.recordingStatusCallbackMethod !== 'POST') ||
        (opts.recordingStatusCallbackEvent && opts.recordingStatusCallbackEvent !== 'completed') ||
        opts.result !== undefined);

    let joinParams: unknown;
    if (!hasNonDefaults) {
      joinParams = name;
    } else {
      const p: Record<string, unknown> = { name };
      if (opts!.muted) p['muted'] = opts!.muted;
      if (opts!.beep && opts!.beep !== 'true') p['beep'] = opts!.beep;
      if (opts!.startOnEnter === false) p['start_on_enter'] = false;
      if (opts!.endOnExit) p['end_on_exit'] = opts!.endOnExit;
      if (opts!.waitUrl) p['wait_url'] = opts!.waitUrl;
      if (maxParticipants !== undefined) p['max_participants'] = maxParticipants;
      if (opts!.record && opts!.record !== 'do-not-record') p['record'] = opts!.record;
      if (opts!.region) p['region'] = opts!.region;
      if (opts!.trim && opts!.trim !== 'trim-silence') p['trim'] = opts!.trim;
      if (opts!.coach) p['coach'] = opts!.coach;
      if (opts!.statusCallbackEvent) p['status_callback_event'] = opts!.statusCallbackEvent;
      if (opts!.statusCallback) p['status_callback'] = opts!.statusCallback;
      if (opts!.statusCallbackMethod && opts!.statusCallbackMethod !== 'POST')
        p['status_callback_method'] = opts!.statusCallbackMethod;
      if (opts!.recordingStatusCallback)
        p['recording_status_callback'] = opts!.recordingStatusCallback;
      if (opts!.recordingStatusCallbackMethod && opts!.recordingStatusCallbackMethod !== 'POST')
        p['recording_status_callback_method'] = opts!.recordingStatusCallbackMethod;
      if (opts!.recordingStatusCallbackEvent && opts!.recordingStatusCallbackEvent !== 'completed')
        p['recording_status_callback_event'] = opts!.recordingStatusCallbackEvent;
      if (opts!.result !== undefined) p['result'] = opts!.result;
      joinParams = p;
    }

    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ join_conference: joinParams }] },
    });
  }

  // ── RPC ─────────────────────────────────────────────────────────────

  /**
   * Execute a SignalWire RPC method via SWML.
   * @param opts - RPC parameters including method name and optional call/node IDs.
   * @returns This instance for chaining.
   */
  executeRpc(opts: {
    method: string;
    params?: Record<string, unknown>;
    callId?: string;
    nodeId?: string;
  }): this {
    const rpcParams: Record<string, unknown> = { method: opts.method };
    if (opts.callId) rpcParams['call_id'] = opts.callId;
    if (opts.nodeId) rpcParams['node_id'] = opts.nodeId;
    // Match Python's `if params:`: a falsy/EMPTY params dict is dropped, so an
    // empty `{}` (e.g. from rpcAiUnhold) emits no `params` key at all. A plain
    // `if (opts.params)` would wrongly keep `{}` because every object is truthy
    // in JS; gate on key count to mirror the reference (function_result.py:1324).
    if (opts.params && Object.keys(opts.params).length > 0) rpcParams['params'] = opts.params;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ execute_rpc: rpcParams }] },
    });
  }

  /**
   * Dial out with the `dial` RPC method, optionally specifying device type.
   * @param toNumber - The destination phone number.
   * @param fromNumber - The caller ID number.
   * @param destSwml - URL of the SWML that handles the dialed call.
   * @param deviceType - The device type (defaults to "phone").
   * @returns This instance for chaining.
   */
  rpcDial(toNumber: string, fromNumber: string, destSwml: string, deviceType = 'phone'): this {
    return this.executeRpc({
      method: 'dial',
      params: {
        devices: {
          type: deviceType,
          params: { to_number: toNumber, from_number: fromNumber },
        },
        dest_swml: destSwml,
      },
    });
  }

  /**
   * Send a message and/or global data to an AI agent on another call.
   *
   * Two payloads, either or both: `messageText` lands as a turn in the other
   * agent's conversation, where it competes with everything else arriving at
   * that moment; `globalData` is merged into the other call's global data,
   * where it stays silent until a prompt expands it with
   * `${global_data.your_key}`. That makes data the better channel for content a
   * later step needs to say.
   *
   * @param callId - The target call ID.
   * @param messageText - Message to inject into the other conversation.
   * @param role - The message role (defaults to "system"); sent with the message.
   * @param globalData - Object merged into the target call's global data.
   * @returns This instance for chaining.
   * @throws Error when neither `messageText` nor `globalData` is given.
   */
  rpcAiMessage(
    callId: string,
    messageText?: string | null,
    role = 'system',
    globalData?: Record<string, unknown>,
  ): this {
    const params: Record<string, unknown> = {};
    if (messageText !== undefined && messageText !== null) {
      params['role'] = role;
      params['message_text'] = messageText;
    }
    if (globalData !== undefined) params['global_data'] = globalData;
    if (Object.keys(params).length === 0) {
      throw new Error('rpc_ai_message needs message_text, global_data, or both');
    }
    return this.executeRpc({ method: 'ai_message', callId, params });
  }

  /**
   * Merge data into another call's global data, with no conversation turn.
   * The other call's prompt reads it back with `${global_data.key}`.
   * @param callId - The target call ID.
   * @param data - Object merged into that call's global data.
   * @returns This instance for chaining.
   */
  rpcAiGlobalData(callId: string, data: Record<string, unknown>): this {
    return this.rpcAiMessage(callId, undefined, 'system', data);
  }

  /**
   * Take another call off hold with the `ai_unhold` RPC method.
   * @param callId - The target call ID to unhold.
   * @returns This instance for chaining.
   */
  rpcAiUnhold(callId: string): this {
    return this.executeRpc({
      method: 'ai_unhold',
      callId,
      params: {},
    });
  }

  // ── Payment ─────────────────────────────────────────────────────────

  /**
   * Start a payment collection flow on the call. Emits an inline SWML document
   * that sets `ai_response` and then runs the `pay` verb.
   *
   * `timeout`, `max_attempts`, `min_postal_code_length`, `security_code` and
   * `postal_code` are sent as strings, as the platform reads them: its SWML
   * validator requires strings for `security_code` and `postal_code`, and the
   * pay request reads all five as strings. Each input is checked first:
   * `timeout`, `maxAttempts` and `minPostalCodeLength` must be integers (or
   * numeric strings), and `securityCode` a boolean (or `"true"`/`"false"`).
   * A SWML variable reference such as `'${timeout}'` is passed through.
   * `postalCode` is a boolean (whether to ask for it) or the postal code
   * itself, as a string.
   * @param opts - Payment configuration including connector URL, method, and prompt options.
   * @throws {Error} When `timeout`, `maxAttempts` or `minPostalCodeLength`
   *   isn't an integer, or `securityCode` isn't a boolean, or a SWML variable
   *   reference.
   * @returns This instance for chaining.
   */
  pay(opts: {
    paymentConnectorUrl: string;
    inputMethod?: string;
    statusUrl?: string;
    paymentMethod?: string;
    timeout?: number | string;
    maxAttempts?: number | string;
    securityCode?: boolean | string;
    postalCode?: boolean | string;
    minPostalCodeLength?: number | string;
    tokenType?: string;
    chargeAmount?: string;
    currency?: string;
    language?: string;
    voice?: string;
    description?: string;
    validCardTypes?: string;
    parameters?: PaymentParameter[];
    prompts?: PaymentPrompt[];
    aiResponse?: string;
  }): this {
    const payParams: Record<string, unknown> = {
      payment_connector_url: opts.paymentConnectorUrl,
      input: opts.inputMethod ?? 'dtmf',
      payment_method: opts.paymentMethod ?? 'credit-card',
      // Checked as integers and a boolean, sent as strings: the platform's
      // validator requires strings for security_code and postal_code, and its
      // pay request reads all five as strings (mod_infrastructure
      // swml_schema.c, relay.c generate_pay_request).
      timeout: String(swmlInt('timeout', opts.timeout ?? 5)),
      max_attempts: String(swmlInt('max_attempts', opts.maxAttempts ?? 1)),
      security_code: String(swmlBool('security_code', opts.securityCode ?? true)),
      min_postal_code_length: String(
        swmlInt('min_postal_code_length', opts.minPostalCodeLength ?? 0),
      ),
      token_type: opts.tokenType ?? 'reusable',
      currency: opts.currency ?? 'usd',
      language: opts.language ?? 'en-US',
      voice: opts.voice ?? 'woman',
      valid_card_types: opts.validCardTypes ?? 'visa mastercard amex',
    };

    // A boolean (whether to ask for it) or the postal code itself, as a string
    payParams['postal_code'] = String(opts.postalCode ?? true);

    if (opts.statusUrl) payParams['status_url'] = opts.statusUrl;
    if (opts.chargeAmount) payParams['charge_amount'] = opts.chargeAmount;
    if (opts.description) payParams['description'] = opts.description;
    if (opts.parameters) payParams['parameters'] = opts.parameters;
    if (opts.prompts) payParams['prompts'] = opts.prompts;

    const aiResponse =
      opts.aiResponse ??
      'The payment status is ${pay_result}, do not mention anything else about collecting payment if successful.';

    return this.executeSwml({
      version: '1.0.0',
      sections: {
        main: [{ set: { ai_response: aiResponse } }, { pay: payParams }],
      },
    });
  }

  // ── Static payment helpers ──────────────────────────────────────────

  /**
   * Create a payment prompt configuration object.
   * @param forSituation - The situation this prompt applies to.
   * @param actions - Actions to perform for this prompt.
   * @param cardType - Optional card type filter.
   * @param errorType - Optional error type this prompt handles.
   * @returns A new PaymentPrompt object.
   */
  static createPaymentPrompt(
    forSituation: string,
    actions: PaymentAction[],
    cardType?: string,
    errorType?: string,
  ): PaymentPrompt {
    const prompt: PaymentPrompt = { for: forSituation, actions };
    if (cardType) prompt.card_type = cardType;
    if (errorType) prompt.error_type = errorType;
    return prompt;
  }

  /**
   * Create a payment action for use within a payment prompt.
   * @param actionType - The action type: "Say" or "Play".
   * @param phrase - The text to say, or for "Play" the audio file URL.
   * @returns A new PaymentAction object.
   */
  static createPaymentAction(actionType: string, phrase: string): PaymentAction {
    return { type: actionType, phrase };
  }

  /**
   * Create a custom payment parameter for the payment connector.
   * @param name - The parameter name.
   * @param value - The parameter value.
   * @returns A new PaymentParameter object.
   */
  static createPaymentParameter(name: string, value: string): PaymentParameter {
    return { name, value };
  }

  // ── Serialization ───────────────────────────────────────────────────

  /**
   * Serialize this result to a plain object for the SWAIG response.
   * @returns A dictionary with response, action, and post_process fields; falls back to "Action completed." if empty.
   */
  toDict(): SwaigResultDict {
    const result: SwaigResultDict = {};
    // The structured form counts only when it has a field, as an empty dict
    // is falsy in the reference.
    if (this._toolResponse && Object.keys(this._toolResponse).length > 0) {
      result.response = { ...this._toolResponse };
    } else if (this.response) {
      result.response = this.response;
    }
    if (this.action.length > 0) {
      result.action = this.action;
    }
    if (this.postProcess && this.action.length > 0) {
      result.post_process = true;
    }
    if (Object.keys(result).length === 0) {
      result.response = 'Action completed.';
    }
    return result;
  }

  /**
   * TS-native serialization hook. `JSON.stringify(result)` emits the wire
   * shape (delegates to {@link FunctionResult.toDict}) instead of the
   * internal field layout. No Python counterpart.
   */
  toJSON(): SwaigResultDict {
    return this.toDict();
  }
}
