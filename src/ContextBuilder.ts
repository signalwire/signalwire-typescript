/**
 * ContextBuilder - Contexts and Steps workflow system.
 *
 * Contexts contain ordered Steps, each with prompt text/POM sections,
 * completion criteria, function restrictions, and navigation rules.
 */

// ── GatherQuestion ──────────────────────────────────────────────────

export class GatherQuestion {
  key: string;
  question: string;
  type: string;
  confirm: boolean;
  prompt?: string;
  functions?: string[];

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

export class GatherInfo {
  private questions: GatherQuestion[] = [];
  private outputKey?: string;
  private completionAction?: string;
  private prompt?: string;

  constructor(opts?: { outputKey?: string; completionAction?: string; prompt?: string }) {
    this.outputKey = opts?.outputKey;
    this.completionAction = opts?.completionAction;
    this.prompt = opts?.prompt;
  }

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

  getQuestions(): GatherQuestion[] {
    return this.questions;
  }

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

interface StepSection {
  title: string;
  body?: string;
  bullets?: string[];
}

export class Step {
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

  constructor(name: string) {
    this.name = name;
  }

  setText(text: string): this {
    if (this.sections.length) throw new Error('Cannot use setText() when POM sections have been added.');
    this.text = text;
    return this;
  }

  addSection(title: string, body: string): this {
    if (this.text !== null) throw new Error('Cannot add POM sections when setText() has been used.');
    this.sections.push({ title, body });
    return this;
  }

  addBullets(title: string, bullets: string[]): this {
    if (this.text !== null) throw new Error('Cannot add POM sections when setText() has been used.');
    this.sections.push({ title, bullets });
    return this;
  }

  setStepCriteria(criteria: string): this {
    this.stepCriteria = criteria;
    return this;
  }

  setFunctions(functions: string | string[]): this {
    this.functions = functions;
    return this;
  }

  setValidSteps(steps: string[]): this {
    this.validSteps = steps;
    return this;
  }

  setValidContexts(contexts: string[]): this {
    this.validContexts = contexts;
    return this;
  }

  setEnd(end: boolean): this {
    this._end = end;
    return this;
  }

  setSkipUserTurn(skip: boolean): this {
    this.skipUserTurn = skip;
    return this;
  }

  setSkipToNextStep(skip: boolean): this {
    this._skipToNextStep = skip;
    return this;
  }

  setGatherInfo(opts?: { outputKey?: string; completionAction?: string; prompt?: string }): this {
    this.gatherInfo = new GatherInfo(opts);
    return this;
  }

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

  clearSections(): this {
    this.sections = [];
    this.text = null;
    return this;
  }

  setResetSystemPrompt(systemPrompt: string): this {
    this.resetSystemPrompt = systemPrompt;
    return this;
  }

  setResetUserPrompt(userPrompt: string): this {
    this.resetUserPrompt = userPrompt;
    return this;
  }

  setResetConsolidate(consolidate: boolean): this {
    this.resetConsolidate = consolidate;
    return this;
  }

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

export class Context {
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

  constructor(name: string) {
    this.name = name;
  }

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

  getStep(name: string): Step | undefined {
    return this.steps.get(name);
  }

  removeStep(name: string): this {
    this.steps.delete(name);
    this.stepOrder = this.stepOrder.filter((s) => s !== name);
    return this;
  }

  moveStep(name: string, position: number): this {
    if (!this.steps.has(name)) throw new Error(`Step '${name}' not found in context '${this.name}'`);
    this.stepOrder = this.stepOrder.filter((s) => s !== name);
    this.stepOrder.splice(position, 0, name);
    return this;
  }

  setValidContexts(contexts: string[]): this {
    this._validContexts = contexts;
    return this;
  }

  setValidSteps(steps: string[]): this {
    this._validSteps = steps;
    return this;
  }

  setPostPrompt(postPrompt: string): this {
    this._postPrompt = postPrompt;
    return this;
  }

  setSystemPrompt(systemPrompt: string): this {
    if (this.systemPromptSections.length) throw new Error('Cannot use setSystemPrompt() when POM sections have been added.');
    this._systemPrompt = systemPrompt;
    return this;
  }

  setConsolidate(consolidate: boolean): this {
    this._consolidate = consolidate;
    return this;
  }

  setFullReset(fullReset: boolean): this {
    this._fullReset = fullReset;
    return this;
  }

  setUserPrompt(userPrompt: string): this {
    this._userPrompt = userPrompt;
    return this;
  }

  setIsolated(isolated: boolean): this {
    this._isolated = isolated;
    return this;
  }

  addSystemSection(title: string, body: string): this {
    if (this._systemPrompt !== null) throw new Error('Cannot add POM sections when setSystemPrompt() has been used.');
    this.systemPromptSections.push({ title, body });
    return this;
  }

  addSystemBullets(title: string, bullets: string[]): this {
    if (this._systemPrompt !== null) throw new Error('Cannot add POM sections when setSystemPrompt() has been used.');
    this.systemPromptSections.push({ title, bullets });
    return this;
  }

  setPrompt(prompt: string): this {
    if (this.promptSections.length) throw new Error('Cannot use setPrompt() when POM sections have been added.');
    this.promptText = prompt;
    return this;
  }

  addSection(title: string, body: string): this {
    if (this.promptText !== null) throw new Error('Cannot add POM sections when setPrompt() has been used.');
    this.promptSections.push({ title, body });
    return this;
  }

  addBullets(title: string, bullets: string[]): this {
    if (this.promptText !== null) throw new Error('Cannot add POM sections when setPrompt() has been used.');
    this.promptSections.push({ title, bullets });
    return this;
  }

  setEnterFillers(fillers: Record<string, string[]>): this {
    this._enterFillers = fillers;
    return this;
  }

  setExitFillers(fillers: Record<string, string[]>): this {
    this._exitFillers = fillers;
    return this;
  }

  addEnterFiller(languageCode: string, fillers: string[]): this {
    if (!this._enterFillers) this._enterFillers = {};
    this._enterFillers[languageCode] = fillers;
    return this;
  }

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

export class ContextBuilder {
  private contexts: Map<string, Context> = new Map();
  private contextOrder: string[] = [];

  addContext(name: string): Context {
    if (this.contexts.has(name)) throw new Error(`Context '${name}' already exists`);
    const ctx = new Context(name);
    this.contexts.set(name, ctx);
    this.contextOrder.push(name);
    return ctx;
  }

  getContext(name: string): Context | undefined {
    return this.contexts.get(name);
  }

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
  }

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

export function createSimpleContext(name = 'default'): Context {
  return new Context(name);
}
