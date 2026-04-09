/**
 * ContextBuilder - Contexts and Steps workflow system.
 *
 * Contexts contain ordered Steps, each with prompt text/POM sections,
 * completion criteria, function restrictions, and navigation rules.
 */

const MAX_CONTEXTS = 50;
const MAX_STEPS_PER_CONTEXT = 100;

/**
 * Reserved tool names auto-injected by the runtime when contexts/steps are
 * present. User-defined SWAIG tools must not collide with these names.
 *
 * - `next_step` / `change_context` are injected when valid_steps or
 *   valid_contexts is set so the model can navigate the flow.
 * - `gather_submit` is injected while a step's gather_info is collecting
 *   answers.
 *
 * ContextBuilder.validate() rejects any agent that registers a user tool
 * sharing one of these names — the runtime would never call the user tool
 * because the native one wins.
 */
export const RESERVED_NATIVE_TOOL_NAMES: ReadonlySet<string> = new Set([
  'next_step',
  'change_context',
  'gather_submit',
]);

// ── GatherQuestion ──────────────────────────────────────────────────

/** Represents a single question within a gather operation. */
export class GatherQuestion {
  /** Unique key used to store the answer. */
  key: string;
  /** The question text presented to the user. */
  question: string;
  /** Expected answer type (e.g., "string", "number"). */
  type: string;
  /** Whether the answer requires user confirmation. */
  confirm: boolean;
  /** Optional additional prompt context for this question. */
  prompt?: string;
  /** Optional list of SWAIG function names available during this question. */
  functions?: string[];

  /**
   * Creates a new GatherQuestion.
   * @param opts - Question configuration including key, question text, and optional type/confirm/prompt/functions.
   */
  constructor(opts: {
    key: string;
    question: string;
    type?: string;
    confirm?: boolean;
    prompt?: string;
    functions?: string[];
  }) {
    this.key = opts.key;
    this.question = opts.question;
    this.type = opts.type ?? 'string';
    this.confirm = opts.confirm ?? false;
    this.prompt = opts.prompt;
    this.functions = opts.functions;
  }

  /**
   * Serializes this question to a plain object for SWML output.
   * @returns A dictionary representation of this question.
   */
  toDict(): Record<string, unknown> {
    const d: Record<string, unknown> = { key: this.key, question: this.question };
    if (this.type !== 'string') d['type'] = this.type;
    if (this.confirm) d['confirm'] = true;
    if (this.prompt) d['prompt'] = this.prompt;
    if (this.functions) d['functions'] = this.functions;
    return d;
  }
}

// ── GatherInfo ──────────────────────────────────────────────────────

/** Collects structured information from the user through a series of questions. */
export class GatherInfo {
  private questions: GatherQuestion[] = [];
  private outputKey?: string;
  private completionAction?: string;
  private prompt?: string;

  /**
   * Creates a new GatherInfo.
   * @param opts - Optional output key, completion action, and prompt configuration.
   */
  constructor(opts?: { outputKey?: string; completionAction?: string; prompt?: string }) {
    this.outputKey = opts?.outputKey;
    this.completionAction = opts?.completionAction;
    this.prompt = opts?.prompt;
  }

  /**
   * Adds a question to this gather operation.
   * @param opts - Question configuration including key, question text, and optional type/confirm/prompt/functions.
   * @returns This GatherInfo for chaining.
   */
  addQuestion(opts: {
    key: string;
    question: string;
    type?: string;
    confirm?: boolean;
    prompt?: string;
    functions?: string[];
  }): this {
    this.questions.push(new GatherQuestion(opts));
    return this;
  }

  /**
   * Returns all questions in this gather operation.
   * @returns The array of GatherQuestion instances.
   */
  getQuestions(): GatherQuestion[] {
    return this.questions;
  }

  /**
   * Returns the completion action for this gather info.
   * @internal
   */
  getCompletionAction(): string | undefined {
    return this.completionAction;
  }

  /**
   * Serializes this gather operation to a plain object for SWML output.
   * @returns A dictionary representation of the gather info and its questions.
   */
  toDict(): Record<string, unknown> {
    if (!this.questions.length) throw new Error('gather_info must have at least one question');
    const d: Record<string, unknown> = { questions: this.questions.map((q) => q.toDict()) };
    if (this.prompt) d['prompt'] = this.prompt;
    if (this.outputKey) d['output_key'] = this.outputKey;
    if (this.completionAction) d['completion_action'] = this.completionAction;
    return d;
  }
}

// ── Step ────────────────────────────────────────────────────────────

/** Internal structure for a POM-like section within a step or context. */
interface StepSection {
  /** Section heading text. */
  title: string;
  /** Section body paragraph text. */
  body?: string;
  /** List of bullet point strings. */
  bullets?: string[];
}

/** A single step within a context, with prompt content, criteria, function restrictions, and navigation rules. */
export class Step {
  /** The unique name identifying this step within its context. */
  name: string;
  private text: string | null = null;
  private stepCriteria: string | null = null;
  private functions: string | string[] | null = null;
  private validSteps: string[] | null = null;
  private validContexts: string[] | null = null;
  private sections: StepSection[] = [];
  private gatherInfo: GatherInfo | null = null;
  private _end = false;
  private skipUserTurn = false;
  private _skipToNextStep = false;
  private resetSystemPrompt: string | null = null;
  private resetUserPrompt: string | null = null;
  private resetConsolidate = false;
  private resetFullReset = false;

  /**
   * Creates a new Step.
   * @param name - The unique step name.
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Sets raw text content for this step, mutually exclusive with POM sections.
   * @param text - The raw prompt text.
   * @returns This step for chaining.
   */
  setText(text: string): this {
    if (this.sections.length) throw new Error('Cannot use setText() when POM sections have been added.');
    this.text = text;
    return this;
  }

  /**
   * Adds a POM section with a body, mutually exclusive with raw text.
   * @param title - The section heading.
   * @param body - The section body text.
   * @returns This step for chaining.
   */
  addSection(title: string, body: string): this {
    if (this.text !== null) throw new Error('Cannot add POM sections when setText() has been used.');
    this.sections.push({ title, body });
    return this;
  }

  /**
   * Adds a POM section with bullet points, mutually exclusive with raw text.
   * @param title - The section heading.
   * @param bullets - The list of bullet point strings.
   * @returns This step for chaining.
   */
  addBullets(title: string, bullets: string[]): this {
    if (this.text !== null) throw new Error('Cannot add POM sections when setText() has been used.');
    this.sections.push({ title, bullets });
    return this;
  }

  /**
   * Sets the criteria that must be met before this step is considered complete.
   * @param criteria - A description of the completion criteria.
   * @returns This step for chaining.
   */
  setStepCriteria(criteria: string): this {
    this.stepCriteria = criteria;
    return this;
  }

  /**
   * Set which non-internal functions are callable while this step is active.
   *
   * IMPORTANT — inheritance behavior:
   *   If you do NOT call this method, the step inherits whichever function
   *   set was active on the previous step (or the previous context's last
   *   step). The server-side runtime only resets the active set when a
   *   step explicitly declares its `functions` field. This is by design,
   *   but it is the most common source of bugs in multi-step agents:
   *   forgetting setFunctions() on a later step lets the previous step's
   *   tools leak through.
   *
   *   Best practice: call setFunctions() explicitly on every step that
   *   should have a different toolset than the previous one.
   *
   * Keep the per-step active set small: LLM tool selection accuracy
   * degrades noticeably past ~7-8 simultaneously-active tools per call.
   * Use per-step whitelisting to partition large tool collections.
   *
   * Internal functions (e.g. `startup_hook`, `hangup_hook`, `gather_submit`)
   * are ALWAYS protected and cannot be deactivated by this whitelist. The
   * native navigation tools `next_step` and `change_context` are injected
   * automatically when validSteps/validContexts is set; they are not
   * affected by this list and do not need to appear in it.
   *
   * @param functions - One of:
   *   - `string[]` — whitelist of function names allowed in this step.
   *     Functions not in the list become inactive.
   *   - `[]` — explicit disable-all (no user functions callable).
   *   - `"none"` — synonym for `[]`, same effect.
   * @returns This step for chaining.
   *
   * @example
   * step.setFunctions(['lookup_account', 'check_balance']); // whitelist
   * step.setFunctions([]);                                  // disable all
   * step.setFunctions('none');                              // disable all (alt)
   */
  setFunctions(functions: string | string[]): this {
    this.functions = functions;
    return this;
  }

  /**
   * Sets which steps the AI may navigate to from this step.
   * @param steps - List of allowed step names.
   * @returns This step for chaining.
   */
  setValidSteps(steps: string[]): this {
    this.validSteps = steps;
    return this;
  }

  /**
   * Sets which contexts the AI may navigate to from this step.
   * @param contexts - List of allowed context names.
   * @returns This step for chaining.
   */
  setValidContexts(contexts: string[]): this {
    this.validContexts = contexts;
    return this;
  }

  /**
   * Mark this step as terminal for the step flow.
   *
   * IMPORTANT: `end=true` does NOT end the conversation or hang up the
   * call. It exits step mode entirely after this step executes — clearing
   * the steps list, current step index, validSteps, and validContexts.
   * The agent keeps running, but operates only under the base system
   * prompt and the context-level prompt; no more step instructions are
   * injected and no more `next_step` tool is offered.
   *
   * To actually end the call, call a hangup tool or define a hangup hook.
   *
   * @param end - True to exit step mode after this step.
   * @returns This step for chaining.
   */
  setEnd(end: boolean): this {
    this._end = end;
    return this;
  }

  /**
   * Sets whether to skip waiting for user input when entering this step.
   * @param skip - Whether to skip the user turn.
   * @returns This step for chaining.
   */
  setSkipUserTurn(skip: boolean): this {
    this.skipUserTurn = skip;
    return this;
  }

  /**
   * Sets whether to automatically advance to the next step after this one completes.
   * @param skip - Whether to skip to the next step.
   * @returns This step for chaining.
   */
  setSkipToNextStep(skip: boolean): this {
    this._skipToNextStep = skip;
    return this;
  }

  /**
   * Initializes a gather info operation on this step for collecting structured data.
   * @param opts - Optional output key, completion action, and prompt configuration.
   * @returns This step for chaining.
   */
  setGatherInfo(opts?: { outputKey?: string; completionAction?: string; prompt?: string }): this {
    this.gatherInfo = new GatherInfo(opts);
    return this;
  }

  /**
   * Add a question to this step's gather_info configuration.
   * setGatherInfo() must be called before this method.
   *
   * IMPORTANT — gather mode locks function access:
   *   While the model is asking gather questions, the runtime forcibly
   *   deactivates ALL of the step's other functions. The only callable
   *   tools during a gather question are:
   *
   *     - `gather_submit` (the native answer-submission tool)
   *     - Whatever names you list in this question's `functions` option
   *
   *   `next_step` and `change_context` are also filtered out — the model
   *   cannot navigate away until the gather completes. This is by design:
   *   it forces a tight ask → submit → next-question loop.
   *
   *   If a question needs to call out to a tool (e.g. validate an email,
   *   geocode a ZIP), list that tool name in this question's `functions`.
   *   Functions listed here are active ONLY for this question.
   *
   * @param opts - Question configuration including key, question text, and optional type/confirm/prompt/functions.
   * @returns This step for chaining.
   */
  addGatherQuestion(opts: {
    key: string;
    question: string;
    type?: string;
    confirm?: boolean;
    prompt?: string;
    functions?: string[];
  }): this {
    if (!this.gatherInfo) throw new Error('Must call setGatherInfo() before addGatherQuestion()');
    this.gatherInfo.addQuestion(opts);
    return this;
  }

  /**
   * Returns the gather info for this step, if any.
   * @internal
   */
  getGatherInfo(): GatherInfo | null {
    return this.gatherInfo;
  }

  /**
   * Removes all POM sections and raw text from this step.
   * @returns This step for chaining.
   */
  clearSections(): this {
    this.sections = [];
    this.text = null;
    return this;
  }

  /**
   * Sets the system prompt to use when resetting context at this step.
   * @param systemPrompt - The replacement system prompt text.
   * @returns This step for chaining.
   */
  setResetSystemPrompt(systemPrompt: string): this {
    this.resetSystemPrompt = systemPrompt;
    return this;
  }

  /**
   * Sets the user prompt to use when resetting context at this step.
   * @param userPrompt - The replacement user prompt text.
   * @returns This step for chaining.
   */
  setResetUserPrompt(userPrompt: string): this {
    this.resetUserPrompt = userPrompt;
    return this;
  }

  /**
   * Sets whether to consolidate conversation history when resetting at this step.
   * @param consolidate - Whether to consolidate.
   * @returns This step for chaining.
   */
  setResetConsolidate(consolidate: boolean): this {
    this.resetConsolidate = consolidate;
    return this;
  }

  /**
   * Sets whether to perform a full conversation reset at this step.
   * @param fullReset - Whether to fully reset.
   * @returns This step for chaining.
   */
  setResetFullReset(fullReset: boolean): this {
    this.resetFullReset = fullReset;
    return this;
  }

  private renderText(): string {
    if (this.text !== null) return this.text;
    if (!this.sections.length) throw new Error(`Step '${this.name}' has no text or POM sections defined`);
    const parts: string[] = [];
    for (const section of this.sections) {
      parts.push(`## ${section.title}`);
      if (section.bullets) {
        for (const b of section.bullets) parts.push(`- ${b}`);
      } else if (section.body) {
        parts.push(section.body);
      }
      parts.push('');
    }
    return parts.join('\n').trim();
  }

  /**
   * Serializes this step to a plain object for SWML output.
   * @returns A dictionary representation of this step.
   */
  toDict(): Record<string, unknown> {
    const d: Record<string, unknown> = { name: this.name, text: this.renderText() };
    if (this.stepCriteria) d['step_criteria'] = this.stepCriteria;
    if (this.functions !== null) d['functions'] = this.functions;
    if (this.validSteps !== null) d['valid_steps'] = this.validSteps;
    if (this.validContexts !== null) d['valid_contexts'] = this.validContexts;
    if (this._end) d['end'] = true;
    if (this.skipUserTurn) d['skip_user_turn'] = true;
    if (this._skipToNextStep) d['skip_to_next_step'] = true;

    const reset: Record<string, unknown> = {};
    if (this.resetSystemPrompt !== null) reset['system_prompt'] = this.resetSystemPrompt;
    if (this.resetUserPrompt !== null) reset['user_prompt'] = this.resetUserPrompt;
    if (this.resetConsolidate) reset['consolidate'] = true;
    if (this.resetFullReset) reset['full_reset'] = true;
    if (Object.keys(reset).length) d['reset'] = reset;

    if (this.gatherInfo) d['gather_info'] = this.gatherInfo.toDict();
    return d;
  }
}

// ── Context ─────────────────────────────────────────────────────────

/** A named context containing ordered steps, prompt configuration, and navigation rules. */
export class Context {
  /** The unique name identifying this context. */
  name: string;
  private steps: Map<string, Step> = new Map();
  private stepOrder: string[] = [];
  private _validContexts: string[] | null = null;
  private _validSteps: string[] | null = null;
  private _postPrompt: string | null = null;
  private _systemPrompt: string | null = null;
  private systemPromptSections: StepSection[] = [];
  private _consolidate = false;
  private _fullReset = false;
  private _userPrompt: string | null = null;
  private _isolated = false;
  private promptText: string | null = null;
  private promptSections: StepSection[] = [];
  private _enterFillers: Record<string, string[]> | null = null;
  private _exitFillers: Record<string, string[]> | null = null;

  /**
   * Creates a new Context.
   * @param name - The unique context name.
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Adds a new step to this context.
   * @param name - The unique step name within this context.
   * @param opts - Optional shorthand for task text, bullets, criteria, functions, and valid steps.
   * @returns The newly created Step for further configuration.
   */
  addStep(
    name: string,
    opts?: {
      task?: string;
      bullets?: string[];
      criteria?: string;
      functions?: string | string[];
      validSteps?: string[];
    },
  ): Step {
    if (this.steps.size >= MAX_STEPS_PER_CONTEXT) {
      throw new Error(`Maximum steps per context (${MAX_STEPS_PER_CONTEXT}) exceeded`);
    }
    if (this.steps.has(name)) throw new Error(`Step '${name}' already exists in context '${this.name}'`);
    const step = new Step(name);
    this.steps.set(name, step);
    this.stepOrder.push(name);
    if (opts?.task) step.addSection('Task', opts.task);
    if (opts?.bullets) step.addBullets('Process', opts.bullets);
    if (opts?.criteria) step.setStepCriteria(opts.criteria);
    if (opts?.functions) step.setFunctions(opts.functions);
    if (opts?.validSteps) step.setValidSteps(opts.validSteps);
    return step;
  }

  /**
   * Returns a step by name.
   * @param name - The step name to retrieve.
   * @returns The matching Step, or undefined if not found.
   */
  getStep(name: string): Step | undefined {
    return this.steps.get(name);
  }

  /**
   * Removes a step from this context by name.
   * @param name - The step name to remove.
   * @returns This context for chaining.
   */
  removeStep(name: string): this {
    this.steps.delete(name);
    this.stepOrder = this.stepOrder.filter((s) => s !== name);
    return this;
  }

  /**
   * Moves a step to a new position in the step order.
   * @param name - The step name to move.
   * @param position - The zero-based index to insert at.
   * @returns This context for chaining.
   */
  moveStep(name: string, position: number): this {
    if (!this.steps.has(name)) throw new Error(`Step '${name}' not found in context '${this.name}'`);
    this.stepOrder = this.stepOrder.filter((s) => s !== name);
    this.stepOrder.splice(position, 0, name);
    return this;
  }

  /**
   * Sets which contexts the AI may navigate to from this context.
   * @param contexts - List of allowed context names.
   * @returns This context for chaining.
   */
  setValidContexts(contexts: string[]): this {
    this._validContexts = contexts;
    return this;
  }

  /**
   * Sets which steps the AI may navigate to from this context.
   * @param steps - List of allowed step names.
   * @returns This context for chaining.
   */
  setValidSteps(steps: string[]): this {
    this._validSteps = steps;
    return this;
  }

  /**
   * Sets the post-prompt text for this context.
   * @param postPrompt - The post-prompt string.
   * @returns This context for chaining.
   */
  setPostPrompt(postPrompt: string): this {
    this._postPrompt = postPrompt;
    return this;
  }

  /**
   * Sets raw system prompt text, mutually exclusive with system POM sections.
   * @param systemPrompt - The system prompt string.
   * @returns This context for chaining.
   */
  setSystemPrompt(systemPrompt: string): this {
    if (this.systemPromptSections.length) throw new Error('Cannot use setSystemPrompt() when POM sections have been added.');
    this._systemPrompt = systemPrompt;
    return this;
  }

  /**
   * Sets whether to consolidate conversation history when entering this context.
   * @param consolidate - Whether to consolidate.
   * @returns This context for chaining.
   */
  setConsolidate(consolidate: boolean): this {
    this._consolidate = consolidate;
    return this;
  }

  /**
   * Sets whether to fully reset conversation history when entering this context.
   * @param fullReset - Whether to fully reset.
   * @returns This context for chaining.
   */
  setFullReset(fullReset: boolean): this {
    this._fullReset = fullReset;
    return this;
  }

  /**
   * Sets the user prompt text for this context.
   * @param userPrompt - The user prompt string.
   * @returns This context for chaining.
   */
  setUserPrompt(userPrompt: string): this {
    this._userPrompt = userPrompt;
    return this;
  }

  /**
   * Mark this context as isolated — entering it wipes conversation history.
   *
   * When `isolated=true` and the context is entered via change_context, the
   * runtime wipes the conversation array. The model starts fresh with only
   * the new context's systemPrompt + step instructions, with no memory of
   * prior turns.
   *
   * EXCEPTION — `reset` overrides the wipe:
   *   If the context also has a `reset` configuration (via consolidate or
   *   full_reset), the wipe is skipped in favor of the reset behavior. Use
   *   reset with consolidate=true to summarize prior history into a single
   *   message instead of dropping it entirely.
   *
   * Use cases:
   *   - Switching to a sensitive billing flow that should not see prior
   *     small-talk
   *   - Handing off to a different agent persona
   *   - Resetting after a long off-topic detour
   *
   * @param isolated - True to wipe conversation history on context entry
   *   (subject to the reset exception above).
   * @returns This context for chaining.
   */
  setIsolated(isolated: boolean): this {
    this._isolated = isolated;
    return this;
  }

  /**
   * Adds a POM section to the system prompt, mutually exclusive with raw system prompt text.
   * @param title - The section heading.
   * @param body - The section body text.
   * @returns This context for chaining.
   */
  addSystemSection(title: string, body: string): this {
    if (this._systemPrompt !== null) throw new Error('Cannot add POM sections when setSystemPrompt() has been used.');
    this.systemPromptSections.push({ title, body });
    return this;
  }

  /**
   * Adds a POM section with bullets to the system prompt, mutually exclusive with raw system prompt text.
   * @param title - The section heading.
   * @param bullets - The list of bullet point strings.
   * @returns This context for chaining.
   */
  addSystemBullets(title: string, bullets: string[]): this {
    if (this._systemPrompt !== null) throw new Error('Cannot add POM sections when setSystemPrompt() has been used.');
    this.systemPromptSections.push({ title, bullets });
    return this;
  }

  /**
   * Sets raw prompt text for this context, mutually exclusive with POM prompt sections.
   * @param prompt - The prompt string.
   * @returns This context for chaining.
   */
  setPrompt(prompt: string): this {
    if (this.promptSections.length) throw new Error('Cannot use setPrompt() when POM sections have been added.');
    this.promptText = prompt;
    return this;
  }

  /**
   * Adds a POM section with a body to the context prompt, mutually exclusive with raw prompt text.
   * @param title - The section heading.
   * @param body - The section body text.
   * @returns This context for chaining.
   */
  addSection(title: string, body: string): this {
    if (this.promptText !== null) throw new Error('Cannot add POM sections when setPrompt() has been used.');
    this.promptSections.push({ title, body });
    return this;
  }

  /**
   * Adds a POM section with bullets to the context prompt, mutually exclusive with raw prompt text.
   * @param title - The section heading.
   * @param bullets - The list of bullet point strings.
   * @returns This context for chaining.
   */
  addBullets(title: string, bullets: string[]): this {
    if (this.promptText !== null) throw new Error('Cannot add POM sections when setPrompt() has been used.');
    this.promptSections.push({ title, bullets });
    return this;
  }

  /**
   * Sets filler phrases spoken when entering this context, keyed by language code.
   * @param fillers - Map of language codes to arrays of filler phrases.
   * @returns This context for chaining.
   */
  setEnterFillers(fillers: Record<string, string[]>): this {
    this._enterFillers = fillers;
    return this;
  }

  /**
   * Sets filler phrases spoken when exiting this context, keyed by language code.
   * @param fillers - Map of language codes to arrays of filler phrases.
   * @returns This context for chaining.
   */
  setExitFillers(fillers: Record<string, string[]>): this {
    this._exitFillers = fillers;
    return this;
  }

  /**
   * Adds enter filler phrases for a specific language.
   * @param languageCode - The language code (e.g., "en-US").
   * @param fillers - Array of filler phrases.
   * @returns This context for chaining.
   */
  addEnterFiller(languageCode: string, fillers: string[]): this {
    if (!this._enterFillers) this._enterFillers = {};
    this._enterFillers[languageCode] = fillers;
    return this;
  }

  /**
   * Adds exit filler phrases for a specific language.
   * @param languageCode - The language code (e.g., "en-US").
   * @param fillers - Array of filler phrases.
   * @returns This context for chaining.
   */
  addExitFiller(languageCode: string, fillers: string[]): this {
    if (!this._exitFillers) this._exitFillers = {};
    this._exitFillers[languageCode] = fillers;
    return this;
  }

  /** @internal */
  getSteps(): Map<string, Step> {
    return this.steps;
  }

  /** @internal */
  getStepOrder(): readonly string[] {
    return this.stepOrder;
  }

  /** @internal */
  getValidContexts(): string[] | null {
    return this._validContexts;
  }

  private renderPrompt(): string | null {
    if (this.promptText !== null) return this.promptText;
    if (!this.promptSections.length) return null;
    return this.renderSections(this.promptSections);
  }

  private renderSystemPrompt(): string | null {
    if (this._systemPrompt !== null) return this._systemPrompt;
    if (!this.systemPromptSections.length) return null;
    return this.renderSections(this.systemPromptSections);
  }

  private renderSections(sections: StepSection[]): string {
    const parts: string[] = [];
    for (const s of sections) {
      parts.push(`## ${s.title}`);
      if (s.bullets) for (const b of s.bullets) parts.push(`- ${b}`);
      else if (s.body) parts.push(s.body);
      parts.push('');
    }
    return parts.join('\n').trim();
  }

  /**
   * Serializes this context and all its steps to a plain object for SWML output.
   * @returns A dictionary representation of this context.
   */
  toDict(): Record<string, unknown> {
    if (!this.steps.size) throw new Error(`Context '${this.name}' has no steps defined`);
    const d: Record<string, unknown> = {
      steps: this.stepOrder.map((name) => this.steps.get(name)!.toDict()),
    };
    if (this._validContexts !== null) d['valid_contexts'] = this._validContexts;
    if (this._validSteps !== null) d['valid_steps'] = this._validSteps;
    if (this._postPrompt !== null) d['post_prompt'] = this._postPrompt;
    const sp = this.renderSystemPrompt();
    if (sp !== null) d['system_prompt'] = sp;
    if (this._consolidate) d['consolidate'] = true;
    if (this._fullReset) d['full_reset'] = true;
    if (this._userPrompt !== null) d['user_prompt'] = this._userPrompt;
    if (this._isolated) d['isolated'] = true;
    if (this.promptSections.length) {
      d['pom'] = this.promptSections;
    } else if (this.promptText !== null) {
      d['prompt'] = this.promptText;
    }
    if (this._enterFillers) d['enter_fillers'] = this._enterFillers;
    if (this._exitFillers) d['exit_fillers'] = this._exitFillers;
    return d;
  }
}

// ── ContextBuilder ──────────────────────────────────────────────────

/**
 * Builder for multi-step, multi-context AI agent workflows.
 *
 * A ContextBuilder owns one or more Contexts; each Context owns an ordered
 * list of Steps. Only one context and one step is active at a time. Per
 * chat turn, the runtime injects the current step's instructions as a
 * system message, then asks the LLM for a response.
 *
 * ## Native tools auto-injected by the runtime
 *
 * When a step (or its enclosing context) declares `validSteps` or
 * `validContexts`, the runtime auto-injects two native tools so the model
 * can navigate the flow:
 *
 *   - `next_step(step: enum)`         — present when validSteps is set
 *   - `change_context(context: enum)` — present when validContexts is set
 *
 * Their `enum` schemas are rewritten on every turn to match whatever
 * validSteps / validContexts apply to the current step. You do NOT need
 * to define these tools yourself; they appear automatically.
 *
 * A third native tool — `gather_submit` — is injected during gather_info
 * questioning (see Step.setGatherInfo / addGatherQuestion).
 *
 * These three names — `next_step`, `change_context`, `gather_submit` —
 * are reserved. ContextBuilder.validate() will reject any agent that
 * defines a SWAIG tool with one of these names.
 *
 * ## Function whitelisting (Step.setFunctions)
 *
 * Each step may declare a `functions` whitelist. The whitelist is applied
 * in-memory at the start of each LLM turn. CRITICALLY: if a step does NOT
 * declare a `functions` field, it INHERITS the previous step's active set.
 * See Step.setFunctions() for details and examples.
 *
 * ## Validation
 *
 * Call validate() (or toDict(), which calls it) to check that:
 *
 *   - At least one context is defined
 *   - A single context must be named "default"
 *   - Every context has at least one step
 *   - validSteps references resolve to real step names (or "next")
 *   - validContexts references resolve to real context names
 *   - gather_info questions are non-empty and have unique keys
 *   - gather_info completion_action targets a reachable step
 *   - No user-defined SWAIG tool collides with a reserved native name
 */
export class ContextBuilder {
  private contexts: Map<string, Context> = new Map();
  private contextOrder: string[] = [];
  private agent: { getTool?: (name: string) => unknown; [k: string]: unknown } | null = null;

  /**
   * Attach an agent reference so validate() can check user tool names
   * against reserved native tool names. Called internally by
   * AgentBase.defineContexts().
   * @internal
   */
  attachAgent(agent: unknown): this {
    this.agent = agent as typeof this.agent;
    return this;
  }

  /**
   * Adds a new named context to the builder.
   * @param name - The unique context name.
   * @returns The newly created Context for further configuration.
   */
  addContext(name: string): Context {
    if (this.contexts.size >= MAX_CONTEXTS) {
      throw new Error(`Maximum number of contexts (${MAX_CONTEXTS}) exceeded`);
    }
    if (this.contexts.has(name)) throw new Error(`Context '${name}' already exists`);
    const ctx = new Context(name);
    this.contexts.set(name, ctx);
    this.contextOrder.push(name);
    return ctx;
  }

  /**
   * Returns a context by name.
   * @param name - The context name to retrieve.
   * @returns The matching Context, or undefined if not found.
   */
  getContext(name: string): Context | undefined {
    return this.contexts.get(name);
  }

  /**
   * Validates that all contexts have steps, naming constraints are met, and cross-context references are valid.
   * @throws Error if validation fails.
   */
  validate(): void {
    if (!this.contexts.size) throw new Error('At least one context must be defined');
    if (this.contexts.size === 1) {
      const name = [...this.contexts.keys()][0];
      if (name !== 'default') throw new Error("When using a single context, it must be named 'default'");
    }
    for (const [name, ctx] of this.contexts) {
      if (!ctx.getSteps().size) throw new Error(`Context '${name}' must have at least one step`);
    }
    // Validate context references
    for (const [, ctx] of this.contexts) {
      const vc = ctx.getValidContexts();
      if (vc) {
        for (const ref of vc) {
          if (!this.contexts.has(ref)) {
            throw new Error(`Context '${ctx.name}' references unknown context '${ref}'`);
          }
        }
      }
    }
    // Validate completion_action references in gather_info
    for (const [ctxName, ctx] of this.contexts) {
      const stepOrder = ctx.getStepOrder();
      const steps = ctx.getSteps();
      for (let i = 0; i < stepOrder.length; i++) {
        const stepName = stepOrder[i];
        const step = steps.get(stepName)!;
        const gi = step.getGatherInfo();
        if (!gi) continue;
        const action = gi.getCompletionAction();
        if (!action) continue;
        if (action === 'next_step') {
          if (i === stepOrder.length - 1) {
            throw new Error(
              `Step '${stepName}' in context '${ctxName}' has gather_info ` +
                `completion_action='next_step' but it is the last step in the context. ` +
                `Either (1) add another step after '${stepName}', ` +
                `(2) set completion_action to the name of an existing step in this ` +
                `context to jump to it, or (3) omit completion_action (default) to ` +
                `stay in '${stepName}' after gathering completes.`,
            );
          }
        } else if (!steps.has(action)) {
          const available = [...steps.keys()].sort();
          throw new Error(
            `Step '${stepName}' in context '${ctxName}' has gather_info ` +
              `completion_action='${action}' but '${action}' is not a step in this ` +
              `context. Valid options: 'next_step' (advance to the next sequential ` +
              `step), undefined (stay in the current step), or one of ` +
              `[${available.map((n) => `'${n}'`).join(', ')}].`,
          );
        }
      }
    }

    // Validate that user-defined tools do not collide with reserved native
    // tool names. The runtime auto-injects next_step / change_context /
    // gather_submit when contexts/steps are present, so user tools sharing
    // those names would never be called.
    if (this.agent && typeof (this.agent as { getRegisteredTools?: unknown }).getRegisteredTools === 'function') {
      const getRegisteredTools = (this.agent as { getRegisteredTools: () => Array<{ name: string }> }).getRegisteredTools.bind(this.agent);
      const registered = getRegisteredTools();
      const colliding: string[] = [];
      for (const tool of registered) {
        if (tool && typeof tool.name === 'string' && RESERVED_NATIVE_TOOL_NAMES.has(tool.name)) {
          colliding.push(tool.name);
        }
      }
      colliding.sort();
      if (colliding.length > 0) {
        const reserved = [...RESERVED_NATIVE_TOOL_NAMES].sort();
        throw new Error(
          `Tool name(s) [${colliding.map((n) => `'${n}'`).join(', ')}] collide ` +
            `with reserved native tools auto-injected by contexts/steps. The ` +
            `names [${reserved.join(', ')}] are reserved and cannot be used ` +
            `for user-defined SWAIG tools when contexts/steps are in use. ` +
            `Rename your tool(s) to avoid the collision.`,
        );
      }
    }
  }

  /**
   * Validates and serializes all contexts to a plain object for SWML output.
   * @returns A dictionary mapping context names to their serialized representations.
   */
  toDict(): Record<string, unknown> {
    this.validate();
    const result: Record<string, unknown> = {};
    for (const name of this.contextOrder) {
      result[name] = this.contexts.get(name)!.toDict();
    }
    return result;
  }
}

// ── Helper ──────────────────────────────────────────────────────────

/**
 * Creates a standalone Context instance without a ContextBuilder.
 * @param name - The context name (defaults to "default").
 * @returns A new Context instance.
 */
export function createSimpleContext(name = 'default'): Context {
  return new Context(name);
}
