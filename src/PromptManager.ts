/**
 * PromptManager - Manages agent prompts with POM support.
 *
 * Holds either raw prompt text or a PomBuilder for structured prompts.
 */

import { PomBuilder } from './PomBuilder.js';
import type { AgentBase } from './AgentBase.js';

/** Manages agent prompt text, supporting both raw text and structured POM-based prompts. */
export class PromptManager {
  private rawText: string | null = null;
  private postPrompt: string | null = null;
  private pom: PomBuilder | null = null;
  private usePom: boolean;
  private contexts: Record<string, unknown> | null = null;
  /**
   * The agent this manager belongs to (the reference's public `self.agent`,
   * `core/agent/prompt/manager.py:32`), or `undefined` for standalone use.
   *
   * The reference takes the parent agent as its sole constructor argument and keeps
   * it as a public back-reference. A caller holding the manager can therefore walk
   * back to its owner; this is the read-back of that same value.
   */
  readonly agent?: AgentBase;

  /**
   * Creates a new PromptManager.
   * @param usePom - Whether to use structured POM sections (default true).
   * @param agent - Optional parent agent, kept as a public back-reference
   *   (the reference's `PromptManager(agent)`). Omit for standalone use.
   */
  constructor(usePom = true, agent?: AgentBase) {
    this.usePom = usePom;
    this.agent = agent;
    if (usePom) {
      this.pom = new PomBuilder();
    }
  }

  /**
   * Sets the raw prompt text, bypassing POM rendering.
   * @param text - The raw prompt string.
   */
  setPromptText(text: string): void {
    this.rawText = text;
  }

  /**
   * Sets the post-prompt text appended after the main prompt.
   * @param text - The post-prompt string.
   */
  setPostPrompt(text: string): void {
    this.postPrompt = text;
  }

  /**
   * Adds a POM section to the prompt, initializing the PomBuilder if needed.
   * @param title - The section heading.
   * @param opts - Optional body, bullets, numbering, and subsection configuration.
   */
  addSection(
    title: string,
    opts?: {
      body?: string;
      bullets?: string[];
      numbered?: boolean;
      numberedBullets?: boolean;
      subsections?: { title: string; body?: string; bullets?: string[] }[];
    },
  ): void {
    if (!this.pom) {
      this.pom = new PomBuilder();
      this.usePom = true;
    }
    this.pom.addSection(title, opts);
  }

  /**
   * Appends body text or bullets to an existing POM section, creating it if absent.
   * @param title - The section heading to append to.
   * @param opts - Body text and/or bullets to add.
   */
  addToSection(title: string, opts?: { body?: string; bullet?: string; bullets?: string[] }): void {
    if (!this.pom) {
      this.pom = new PomBuilder();
      this.usePom = true;
    }
    this.pom.addToSection(title, opts);
  }

  /**
   * Adds a subsection under a parent POM section, creating the parent if absent.
   * @param parentTitle - The heading of the parent section.
   * @param title - The subsection heading.
   * @param opts - Optional body text and bullets for the subsection.
   */
  addSubsection(
    parentTitle: string,
    title: string,
    opts?: { body?: string; bullets?: string[] },
  ): void {
    if (!this.pom) {
      this.pom = new PomBuilder();
      this.usePom = true;
    }
    this.pom.addSubsection(parentTitle, title, opts);
  }

  /**
   * Checks whether a POM section with the given title exists.
   * @param title - The section heading to look for.
   * @returns True if the section exists.
   */
  hasSection(title: string): boolean {
    return this.pom?.hasSection(title) ?? false;
  }

  /**
   * Returns the fully rendered prompt text, either raw text or POM-rendered Markdown.
   * @returns The prompt string, or empty string if nothing is set.
   */
  getPrompt(): string {
    if (this.rawText !== null) return this.rawText;
    if (this.pom) return this.pom.renderMarkdown();
    return '';
  }

  /**
   * Returns the post-prompt text.
   * @returns The post-prompt string, or null if not set.
   */
  getPostPrompt(): string | null {
    return this.postPrompt;
  }

  /**
   * Returns the underlying PomBuilder instance, if POM mode is active.
   * @returns The PomBuilder, or null if POM is not in use.
   */
  getPomBuilder(): PomBuilder | null {
    return this.pom;
  }

  /**
   * Returns the raw prompt text whatever `setPromptText` stored, or null
   * when no raw prompt has been set.
   * @returns The raw prompt string, or null if not set.
   */
  getRawPrompt(): string | null {
    return this.rawText;
  }

  /**
   * Defines the contexts configuration held by this manager.
   *
   * Mirrors the reference `PromptManager.define_contexts`
   * (`core/agent/prompt/manager.py:79`): the argument is REQUIRED — there is no
   * "define nothing" call — and is either a builder exposing `toDict()` (the
   * reference's `hasattr(contexts, "to_dict")` branch) or a plain object. Anything
   * else is rejected, matching the reference's `ValueError`.
   *
   * @param contexts - A ContextBuilder-like object with `toDict()`, or a plain object.
   * @throws {TypeError} When `contexts` is neither an object nor `toDict()`-bearing.
   */
  defineContexts(contexts: Record<string, unknown> | { toDict(): Record<string, unknown> }): void {
    if (
      contexts !== null &&
      typeof contexts === 'object' &&
      typeof (contexts as { toDict?: unknown }).toDict === 'function'
    ) {
      this.contexts = (contexts as { toDict(): Record<string, unknown> }).toDict();
    } else if (contexts !== null && typeof contexts === 'object' && !Array.isArray(contexts)) {
      this.contexts = contexts as Record<string, unknown>;
    } else {
      throw new TypeError('contexts must be an object or a ContextBuilder');
    }
  }

  /**
   * Returns the contexts configuration set by {@link defineContexts}, or null
   * when none has been defined. Mirrors the reference `PromptManager.get_contexts`
   * (`core/agent/prompt/manager.py:309`).
   * @returns The contexts object, or null if not set.
   */
  getContexts(): Record<string, unknown> | null {
    return this.contexts;
  }
}
