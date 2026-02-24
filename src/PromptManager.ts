/**
 * PromptManager - Manages agent prompts with POM support.
 *
 * Holds either raw prompt text or a PomBuilder for structured prompts.
 */

import { PomBuilder } from './PomBuilder.js';

export class PromptManager {
  private rawText: string | null = null;
  private postPrompt: string | null = null;
  private pom: PomBuilder | null = null;
  private usePom: boolean;

  constructor(usePom = true) {
    this.usePom = usePom;
    if (usePom) {
      this.pom = new PomBuilder();
    }
  }

  setPromptText(text: string): void {
    this.rawText = text;
  }

  setPostPrompt(text: string): void {
    this.postPrompt = text;
  }

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

  addToSection(
    title: string,
    opts?: { body?: string; bullet?: string; bullets?: string[] },
  ): void {
    if (!this.pom) {
      this.pom = new PomBuilder();
      this.usePom = true;
    }
    this.pom.addToSection(title, opts);
  }

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

  hasSection(title: string): boolean {
    return this.pom?.hasSection(title) ?? false;
  }

  getPrompt(): string {
    if (this.rawText !== null) return this.rawText;
    if (this.pom) return this.pom.renderMarkdown();
    return '';
  }

  getPostPrompt(): string | null {
    return this.postPrompt;
  }

  getPomBuilder(): PomBuilder | null {
    return this.pom;
  }
}
