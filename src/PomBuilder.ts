/**
 * PomBuilder - Prompt Object Model for structured prompt sections.
 *
 * Built-in replacement for the external signalwire-pom package.
 * Sections have a title, body, bullets (optionally numbered),
 * and nested subsections.
 */

import { PromptObjectModel, Section as PomModelSection } from './POM/PromptObjectModel.js';

/** Serializable representation of a POM section, used for JSON export. */
export interface PomSectionData {
  /** Section heading text. */
  title?: string;
  /** Section body paragraph text. */
  body?: string;
  /** List of bullet point strings. */
  bullets?: string[];
  /** Whether subsections are numbered. */
  numbered?: boolean;
  /** Whether bullet points are rendered as a numbered list. */
  numberedBullets?: boolean;
  /** Nested child sections. */
  subsections?: PomSectionData[];
}

/** A single section in a Prompt Object Model, with optional title, body, bullets, and nested subsections. */
export class PomSection {
  /** Section heading text, or null if untitled. */
  title: string | null;
  /** Section body paragraph text. */
  body: string;
  /** List of bullet point strings. */
  bullets: string[];
  /** Nested child sections. */
  subsections: PomSection[];
  /** Whether this section is numbered when rendered; null means inherit from parent context. */
  numbered: boolean | null;
  /** Whether bullet points are rendered as a numbered list. */
  numberedBullets: boolean;

  /**
   * Creates a new PomSection.
   * @param opts - Optional section configuration.
   */
  constructor(opts?: {
    title?: string | null;
    body?: string;
    bullets?: string[];
    numbered?: boolean | null;
    numberedBullets?: boolean;
  }) {
    this.title = opts?.title ?? null;
    this.body = opts?.body ?? '';
    this.bullets = opts?.bullets ?? [];
    this.subsections = [];
    this.numbered = opts?.numbered ?? null;
    this.numberedBullets = opts?.numberedBullets ?? false;
  }

  /**
   * Adds a nested subsection to this section.
   * @param opts - Subsection configuration including title and optional body/bullets.
   * @returns The newly created child PomSection.
   */
  addSubsection(opts: {
    title: string;
    body?: string;
    bullets?: string[];
    numbered?: boolean;
    numberedBullets?: boolean;
  }): PomSection {
    const sub = new PomSection({
      title: opts.title,
      body: opts.body,
      bullets: opts.bullets,
      numbered: opts.numbered ?? false,
      numberedBullets: opts.numberedBullets ?? false,
    });
    this.subsections.push(sub);
    return sub;
  }

  /**
   * Serializes this section to a plain data object.
   * @returns A PomSectionData representation of this section and its subsections.
   */
  toDict(): PomSectionData {
    const data: PomSectionData = {};
    if (this.body) data.body = this.body;
    if (this.bullets.length) data.bullets = this.bullets;
    if (this.subsections.length) data.subsections = this.subsections.map((s) => s.toDict());
    if (this.title !== null) data.title = this.title;
    if (this.numbered) data.numbered = this.numbered;
    if (this.numberedBullets) data.numberedBullets = this.numberedBullets;
    return data;
  }

  /**
   * Renders this section and its subsections as a Markdown string.
   * @param level - The heading level to start at (default 2 for ##).
   * @param sectionNumber - Hierarchical numbering prefix for numbered sections.
   * @returns The rendered Markdown string.
   */
  renderMarkdown(level = 2, sectionNumber: number[] = []): string {
    const lines: string[] = [];

    if (this.title !== null) {
      const prefix = sectionNumber.length ? `${sectionNumber.join('.')}. ` : '';
      lines.push(`${'#'.repeat(level)} ${prefix}${this.title}\n`);
    }

    if (this.body) {
      lines.push(`${this.body}\n`);
    }

    for (let i = 0; i < this.bullets.length; i++) {
      if (this.numberedBullets) {
        lines.push(`${i + 1}. ${this.bullets[i]}`);
      } else {
        lines.push(`- ${this.bullets[i]}`);
      }
    }
    if (this.bullets.length) lines.push('');

    const anyNumbered = this.subsections.some((s) => s.numbered);
    for (let i = 0; i < this.subsections.length; i++) {
      const sub = this.subsections[i];
      let newNumber: number[];
      let nextLevel: number;
      if (this.title !== null || sectionNumber.length) {
        if (anyNumbered && sub.numbered !== false) {
          newNumber = [...sectionNumber, i + 1];
        } else {
          newNumber = sectionNumber;
        }
        nextLevel = level + 1;
      } else {
        newNumber = sectionNumber;
        nextLevel = level;
      }
      lines.push(sub.renderMarkdown(nextLevel, newNumber));
    }

    return lines.join('\n');
  }

  /**
   * Renders this section and its subsections as an XML string.
   * @param indent - The indentation depth (default 0).
   * @param sectionNumber - Hierarchical numbering prefix for numbered sections.
   * @returns The rendered XML string.
   */
  renderXml(indent = 0, sectionNumber: number[] = []): string {
    const pad = '  '.repeat(indent);
    const lines: string[] = [];

    lines.push(`${pad}<section>`);

    if (this.title !== null) {
      const prefix = sectionNumber.length ? `${sectionNumber.join('.')}. ` : '';
      lines.push(`${pad}  <title>${prefix}${this.title}</title>`);
    }

    if (this.body) {
      lines.push(`${pad}  <body>${this.body}</body>`);
    }

    if (this.bullets.length) {
      lines.push(`${pad}  <bullets>`);
      for (let i = 0; i < this.bullets.length; i++) {
        if (this.numberedBullets) {
          lines.push(`${pad}    <bullet id="${i + 1}">${this.bullets[i]}</bullet>`);
        } else {
          lines.push(`${pad}    <bullet>${this.bullets[i]}</bullet>`);
        }
      }
      lines.push(`${pad}  </bullets>`);
    }

    if (this.subsections.length) {
      lines.push(`${pad}  <subsections>`);
      const anyNumbered = this.subsections.some((s) => s.numbered);
      for (let i = 0; i < this.subsections.length; i++) {
        const sub = this.subsections[i];
        let newNumber: number[];
        if (this.title !== null || sectionNumber.length) {
          if (anyNumbered && sub.numbered !== false) {
            newNumber = [...sectionNumber, i + 1];
          } else {
            newNumber = sectionNumber;
          }
        } else {
          newNumber = sectionNumber;
        }
        lines.push(sub.renderXml(indent + 2, newNumber));
      }
      lines.push(`${pad}  </subsections>`);
    }

    lines.push(`${pad}</section>`);
    return lines.join('\n');
  }
}

/**
 * Builds a structured prompt by composing named POM sections, with Markdown and dict export.
 *
 * The Prompt Object Model lets you assemble a large system prompt from reusable,
 * named sections (Role, Objective, Constraints, etc.) instead of a single string.
 * This plays well with {@link AgentBase} methods like `promptAddSection()` and
 * `promptAddToSection()` that let user code and skills add prompt content
 * incrementally.
 *
 * @example Build a structured prompt
 * ```ts
 * import { PomBuilder } from '@signalwire/sdk';
 *
 * const pom = new PomBuilder()
 *   .addSection('Role', { body: 'You are a friendly customer service agent.' })
 *   .addSection('Objectives', { bullets: [
 *     'Identify the customer politely',
 *     'Resolve their issue in under 3 turns if possible',
 *   ]})
 *   .addSection('Constraints', { bullets: [
 *     'Never reveal internal tool names',
 *   ]});
 *
 * const systemPrompt = pom.renderMarkdown();
 * ```
 *
 * @see {@link PomSection}
 * @see {@link AgentBase.promptAddSection}
 */
export class PomBuilder {
  private sections: PomSection[] = [];
  private sectionMap: Map<string, PomSection> = new Map();

  /**
   * Clears all sections, returning the builder to its initial empty state.
   * @returns This builder for chaining.
   */
  reset(): this {
    this.sections = [];
    this.sectionMap.clear();
    return this;
  }

  /**
   * Adds a new top-level section to the prompt.
   * @param title - The section heading.
   * @param opts - Optional body, bullets, numbering, and subsection configuration.
   * @returns This builder for chaining.
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
  ): this {
    const section = new PomSection({
      title,
      body: opts?.body,
      bullets: opts?.bullets,
      numbered: opts?.numbered,
      numberedBullets: opts?.numberedBullets,
    });
    this.sections.push(section);
    this.sectionMap.set(title, section);

    if (opts?.subsections) {
      for (const sub of opts.subsections) {
        section.addSubsection({
          title: sub.title,
          body: sub.body,
          bullets: sub.bullets,
        });
      }
    }
    return this;
  }

  /**
   * Appends body text or bullets to an existing section, creating it if absent.
   * @param title - The section heading to append to.
   * @param opts - Body text and/or bullets to add.
   * @returns This builder for chaining.
   */
  addToSection(
    title: string,
    opts?: { body?: string; bullet?: string; bullets?: string[] },
  ): this {
    if (!this.sectionMap.has(title)) {
      this.addSection(title);
    }
    const section = this.sectionMap.get(title)!;
    if (opts?.body) {
      section.body = section.body ? `${section.body}\n\n${opts.body}` : opts.body;
    }
    if (opts?.bullet) section.bullets.push(opts.bullet);
    if (opts?.bullets) section.bullets.push(...opts.bullets);
    return this;
  }

  /**
   * Adds a subsection under an existing parent section, creating the parent if absent.
   * @param parentTitle - The heading of the parent section.
   * @param title - The subsection heading.
   * @param opts - Optional body text and bullets for the subsection.
   * @returns This builder for chaining.
   */
  addSubsection(
    parentTitle: string,
    title: string,
    opts?: { body?: string; bullets?: string[] },
  ): this {
    if (!this.sectionMap.has(parentTitle)) {
      this.addSection(parentTitle);
    }
    this.sectionMap.get(parentTitle)!.addSubsection({
      title,
      body: opts?.body,
      bullets: opts?.bullets,
    });
    return this;
  }

  /**
   * Checks whether a top-level section with the given title exists.
   * @param title - The section heading to look for.
   * @returns True if the section exists.
   */
  hasSection(title: string): boolean {
    return this.sectionMap.has(title);
  }

  /**
   * Returns a top-level section by title.
   * @param title - The section heading to retrieve.
   * @returns The matching PomSection, or undefined if not found.
   */
  getSection(title: string): PomSection | undefined {
    return this.sectionMap.get(title);
  }

  /**
   * Recursively searches all sections and subsections for one matching the given title.
   * @param title - The section heading to search for.
   * @returns The matching PomSection, or undefined if not found.
   */
  findSection(title: string): PomSection | undefined {
    const recurse = (sections: PomSection[]): PomSection | undefined => {
      for (const s of sections) {
        if (s.title === title) return s;
        const found = recurse(s.subsections);
        if (found) return found;
      }
      return undefined;
    };
    return recurse(this.sections);
  }

  /**
   * Appends every top-level section of another PomBuilder as subsections of a target section.
   * @param target - The heading of the target section, or the PomSection to append into.
   * @param pomToAdd - The PomBuilder whose sections should be appended as subsections.
   * @returns This builder for chaining.
   * @throws {Error} If target is a string and no section with that title is found.
   */
  addPomAsSubsection(target: string | PomSection, pomToAdd: PomBuilder): this {
    let targetSection: PomSection;
    if (typeof target === 'string') {
      const found = this.findSection(target);
      if (!found) {
        throw new Error(`No section with title '${target}' found.`);
      }
      targetSection = found;
    } else {
      targetSection = target;
    }

    for (const section of pomToAdd.sections) {
      targetSection.subsections.push(section);
    }
    return this;
  }

  /**
   * Serializes all sections to an array of plain data objects.
   * @returns An array of PomSectionData representing all top-level sections.
   */
  toDict(): PomSectionData[] {
    return this.sections.map((s) => s.toDict());
  }

  /**
   * Serializes all sections to a JSON string.
   * @returns A JSON string representation of all top-level sections.
   */
  toJson(): string {
    return JSON.stringify(this.toDict());
  }

  /**
   * Creates a PomBuilder from an array of section data objects.
   * @param sections - Array of section data to reconstruct.
   * @returns A new PomBuilder populated with the given sections.
   */
  static fromSections(sections: PomSectionData[]): PomBuilder {
    const builder = new PomBuilder();
    for (const s of sections) {
      builder.addSection(s.title ?? '', {
        body: s.body,
        bullets: s.bullets,
        numbered: s.numbered,
        numberedBullets: s.numberedBullets,
        subsections: s.subsections as { title: string; body?: string; bullets?: string[] }[],
      });
    }
    return builder;
  }

  /**
   * Returns the underlying {@link PromptObjectModel} for the builder.
   *
   * Mirrors Python's `PomBuilder.pom` attribute (the wrapped low-level model).
   * Returns a fresh `PromptObjectModel` populated from the builder's current
   * sections; mutations on the returned instance do not propagate back to
   * this builder.
   */
  get pom(): PromptObjectModel {
    const pom = new PromptObjectModel();
    const convert = (s: PomSection): PomModelSection => {
      const out = new PomModelSection(s.title, {
        body: s.body,
        bullets: [...s.bullets],
        numbered: s.numbered,
        numberedBullets: s.numberedBullets,
      });
      for (const sub of s.subsections) {
        out.subsections.push(convert(sub));
      }
      return out;
    };
    for (const s of this.sections) {
      pom.sections.push(convert(s));
    }
    return pom;
  }

  /**
   * Renders all sections as a combined Markdown string.
   * @returns The complete rendered Markdown prompt text.
   */
  renderMarkdown(): string {
    const anyNumbered = this.sections.some((s) => s.numbered);
    const parts: string[] = [];
    let counter = 0;
    for (const section of this.sections) {
      let sectionNumber: number[] = [];
      if (section.title !== null) {
        counter++;
        if (anyNumbered && section.numbered !== false) {
          sectionNumber = [counter];
        }
      }
      parts.push(section.renderMarkdown(2, sectionNumber));
    }
    return parts.join('\n');
  }

  /**
   * Renders all sections as a combined XML string with a `<prompt>` root element.
   * @returns The complete rendered XML prompt text.
   */
  renderXml(): string {
    const anyNumbered = this.sections.some((s) => s.numbered);
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<prompt>'];
    let counter = 0;
    for (const section of this.sections) {
      let sectionNumber: number[] = [];
      if (section.title !== null) {
        counter++;
        if (anyNumbered && section.numbered !== false) {
          sectionNumber = [counter];
        }
      }
      lines.push(section.renderXml(1, sectionNumber));
    }
    lines.push('</prompt>');
    return lines.join('\n');
  }
}
