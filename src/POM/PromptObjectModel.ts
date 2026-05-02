/**
 * PromptObjectModel — direct port of Python's `signalwire.pom.pom`.
 *
 * A structured data format for composing, organizing, and rendering prompt
 * instructions for large language models. The Prompt Object Model provides a
 * tree-based representation of a prompt document composed of nested sections,
 * each of which can include a title, body text, bullet points, and arbitrarily
 * nested subsections.
 *
 * This is the lower-level building block. Most agent code uses the higher-level
 * {@link PomBuilder} wrapper, but `PromptObjectModel` is exposed directly so
 * that callers can mirror Python parity (`agent.pom` is a `PromptObjectModel`)
 * and load/save POMs as JSON/YAML.
 */

import * as yaml from 'js-yaml';

/** Plain serializable representation of a section, used for JSON/YAML and `to_dict()` exchange. */
export interface SectionData {
  title?: string;
  body?: string;
  bullets?: string[];
  subsections?: SectionData[];
  numbered?: boolean;
  numberedBullets?: boolean;
}

/**
 * A section in the Prompt Object Model.
 *
 * Each section contains a title, optional body text, optional bullet points,
 * and can have any number of nested subsections.
 */
export class Section {
  /** The name of the section. */
  title: string | null;
  /** A paragraph of text associated with the section. */
  body: string;
  /** Bullet-pointed items. */
  bullets: string[];
  /** Nested sections with the same structure. */
  subsections: Section[];
  /** Whether this section should be numbered. */
  numbered: boolean | null;
  /** Whether bullets should be numbered instead of using bullet points. */
  numberedBullets: boolean;

  /**
   * @param title Section title (null permitted only on the very first top-level section).
   * @param opts Keyword-style options matching Python's `body=`/`bullets=`/`numbered=`/`numberedBullets=`.
   */
  constructor(
    title: string | null = null,
    opts: {
      body?: string;
      bullets?: string[] | null;
      numbered?: boolean | null;
      numberedBullets?: boolean;
    } = {},
  ) {
    this.title = title;

    const body = opts.body ?? '';
    if (typeof body !== 'string') {
      throw new TypeError(
        `body must be a string, not ${typeof body}. ` +
          `If you meant to pass a list of bullet points, use bullets parameter instead.`,
      );
    }
    this.body = body;

    const bullets = opts.bullets;
    if (bullets !== undefined && bullets !== null && !Array.isArray(bullets)) {
      throw new TypeError(`bullets must be a list or null, not ${typeof bullets}`);
    }
    this.bullets = bullets ?? [];

    this.subsections = [];
    this.numbered = opts.numbered ?? null;
    this.numberedBullets = opts.numberedBullets ?? false;
  }

  /** Add or replace the body text for this section. */
  addBody(body: string): void {
    if (typeof body !== 'string') {
      throw new TypeError(`body must be a string, not ${typeof body}`);
    }
    this.body = body;
  }

  /** Add bullet points to this section (extends the existing list). */
  addBullets(bullets: string[]): void {
    if (!Array.isArray(bullets)) {
      throw new TypeError(`bullets must be a list, not ${typeof bullets}`);
    }
    this.bullets.push(...bullets);
  }

  /**
   * Add a subsection to this section.
   *
   * @param title The title of the subsection (required — subsections must have a title).
   * @param opts Optional body / bullets / numbering for the subsection.
   * @returns The newly created Section.
   */
  addSubsection(
    title: string,
    opts: {
      body?: string;
      bullets?: string[] | null;
      numbered?: boolean;
      numberedBullets?: boolean;
    } = {},
  ): Section {
    if (title === null || title === undefined) {
      throw new Error('Subsections must have a title');
    }
    const sub = new Section(title, {
      body: opts.body ?? '',
      bullets: opts.bullets ?? [],
      numbered: opts.numbered ?? false,
      numberedBullets: opts.numberedBullets ?? false,
    });
    this.subsections.push(sub);
    return sub;
  }

  /** Convert the section to a dictionary representation. */
  toDict(): SectionData {
    const data: SectionData = {};
    // Insertion order matches Python: title, body, bullets, subsections, numbered, numberedBullets.
    if (this.title !== null) data.title = this.title;
    if (this.body) data.body = this.body;
    if (this.bullets.length) data.bullets = [...this.bullets];
    if (this.subsections.length) data.subsections = this.subsections.map((s) => s.toDict());
    if (this.numbered) data.numbered = this.numbered;
    if (this.numberedBullets) data.numberedBullets = this.numberedBullets;
    return data;
  }

  /**
   * Render this section and all its subsections as markdown.
   *
   * @param level The heading level to start with (default 2 = `##`).
   * @param sectionNumber The current section number for numbered sections.
   */
  renderMarkdown(level = 2, sectionNumber: number[] | null = null): string {
    const md: string[] = [];

    if (sectionNumber === null) sectionNumber = [];

    if (this.title !== null) {
      const prefix = sectionNumber.length ? `${sectionNumber.join('.')}. ` : '';
      md.push(`${'#'.repeat(level)} ${prefix}${this.title}\n`);
    }

    if (this.body) md.push(`${this.body}\n`);

    for (let i = 0; i < this.bullets.length; i++) {
      if (this.numberedBullets) md.push(`${i + 1}. ${this.bullets[i]}`);
      else md.push(`- ${this.bullets[i]}`);
    }
    if (this.bullets.length) md.push('');

    const anySubsectionNumbered = this.subsections.some((s) => s.numbered);

    for (let i = 0; i < this.subsections.length; i++) {
      const sub = this.subsections[i];
      let newSectionNumber: number[];
      let nextLevel: number;
      if (this.title !== null || sectionNumber.length) {
        if (anySubsectionNumbered && sub.numbered !== false) {
          newSectionNumber = [...sectionNumber, i + 1];
        } else {
          newSectionNumber = sectionNumber;
        }
        nextLevel = level + 1;
      } else {
        newSectionNumber = sectionNumber;
        nextLevel = level;
      }
      md.push(sub.renderMarkdown(nextLevel, newSectionNumber));
    }

    return md.join('\n');
  }

  /**
   * Render this section and all its subsections as XML.
   *
   * @param indent The indentation level to start with (default 0).
   * @param sectionNumber The current section number for numbered sections.
   */
  renderXml(indent = 0, sectionNumber: number[] | null = null): string {
    const indentStr = '  '.repeat(indent);
    const xml: string[] = [];

    if (sectionNumber === null) sectionNumber = [];

    xml.push(`${indentStr}<section>`);

    if (this.title !== null) {
      const prefix = sectionNumber.length ? `${sectionNumber.join('.')}. ` : '';
      xml.push(`${indentStr}  <title>${prefix}${this.title}</title>`);
    }

    if (this.body) {
      xml.push(`${indentStr}  <body>${this.body}</body>`);
    }

    if (this.bullets.length) {
      xml.push(`${indentStr}  <bullets>`);
      for (let i = 0; i < this.bullets.length; i++) {
        if (this.numberedBullets) {
          xml.push(`${indentStr}    <bullet id="${i + 1}">${this.bullets[i]}</bullet>`);
        } else {
          xml.push(`${indentStr}    <bullet>${this.bullets[i]}</bullet>`);
        }
      }
      xml.push(`${indentStr}  </bullets>`);
    }

    if (this.subsections.length) {
      xml.push(`${indentStr}  <subsections>`);
      const anySubsectionNumbered = this.subsections.some((s) => s.numbered);
      for (let i = 0; i < this.subsections.length; i++) {
        const sub = this.subsections[i];
        let newSectionNumber: number[];
        if (this.title !== null || sectionNumber.length) {
          if (anySubsectionNumbered && sub.numbered !== false) {
            newSectionNumber = [...sectionNumber, i + 1];
          } else {
            newSectionNumber = sectionNumber;
          }
        } else {
          newSectionNumber = sectionNumber;
        }
        xml.push(sub.renderXml(indent + 2, newSectionNumber));
      }
      xml.push(`${indentStr}  </subsections>`);
    }

    xml.push(`${indentStr}</section>`);
    return xml.join('\n');
  }
}

/**
 * The Prompt Object Model — a structured, serializable representation of a
 * full prompt document. Direct port of Python's
 * `signalwire.pom.pom.PromptObjectModel`.
 */
export class PromptObjectModel {
  /** Top-level sections in the model. */
  sections: Section[];
  /** Whether to print debug info during {@link renderMarkdown}. */
  debug: boolean;

  constructor(debug = false) {
    this.sections = [];
    this.debug = debug;
  }

  /**
   * Add a top-level section to the model.
   *
   * @throws Error if a section without a title is added after the first section.
   */
  addSection(
    title: string | null = null,
    opts: {
      body?: string;
      bullets?: string[] | string | null;
      numbered?: boolean | null;
      numberedBullets?: boolean;
    } = {},
  ): Section {
    if (title === null && this.sections.length > 0) {
      throw new Error('Only the first section can have no title');
    }

    let bulletsList: string[];
    const bullets = opts.bullets;
    if (typeof bullets === 'string') {
      bulletsList = [bullets];
    } else if (Array.isArray(bullets)) {
      bulletsList = bullets;
    } else {
      bulletsList = [];
    }

    const section = new Section(title, {
      body: opts.body ?? '',
      bullets: bulletsList,
      numbered: opts.numbered ?? null,
      numberedBullets: opts.numberedBullets ?? false,
    });
    this.sections.push(section);
    return section;
  }

  /**
   * Find a section by its title (recursive search through all sections and subsections).
   *
   * @returns The matching Section or null if not found.
   */
  findSection(title: string): Section | null {
    const recurse = (sections: Section[]): Section | null => {
      for (const section of sections) {
        if (section.title === title) return section;
        const found = recurse(section.subsections);
        if (found) return found;
      }
      return null;
    };
    return recurse(this.sections);
  }

  /** Convert the entire model to a list of dictionaries. */
  toDict(): SectionData[] {
    return this.sections.map((s) => s.toDict());
  }

  /** Convert the entire model to a JSON string (pretty-printed with 2-space indent). */
  toJson(): string {
    return JSON.stringify(this.toDict(), null, 2);
  }

  /** Convert the entire model to a YAML string. */
  toYaml(): string {
    return yaml.dump(this.toDict(), { noRefs: true, sortKeys: false });
  }

  /**
   * Render the entire model as markdown.
   */
  renderMarkdown(): string {
    const anySectionNumbered = this.sections.some((s) => s.numbered);

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(`Any section numbered: ${anySectionNumbered}`);
      this.sections.forEach((section, i) => {
        // eslint-disable-next-line no-console
        console.log(`Section ${i + 1}: ${section.title}, numbered=${section.numbered}`);
      });
    }

    const md: string[] = [];
    let sectionCounter = 0;
    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      let sectionNumber: number[];
      if (section.title !== null) {
        sectionCounter += 1;
        if (anySectionNumbered && section.numbered !== false) {
          sectionNumber = [sectionCounter];
        } else {
          sectionNumber = [];
        }
      } else {
        sectionNumber = [];
      }

      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log(
          `Rendering section ${i}: ${section.title} with sectionNumber=${JSON.stringify(sectionNumber)}`,
        );
      }

      md.push(section.renderMarkdown(2, sectionNumber));
    }

    return md.join('\n');
  }

  /**
   * Render the entire model as XML.
   */
  renderXml(): string {
    const xml: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<prompt>'];
    const anySectionNumbered = this.sections.some((s) => s.numbered);

    let sectionCounter = 0;
    for (const section of this.sections) {
      let sectionNumber: number[];
      if (section.title !== null) {
        sectionCounter += 1;
        if (anySectionNumbered && section.numbered !== false) {
          sectionNumber = [sectionCounter];
        } else {
          sectionNumber = [];
        }
      } else {
        sectionNumber = [];
      }
      xml.push(section.renderXml(1, sectionNumber));
    }

    xml.push('</prompt>');
    return xml.join('\n');
  }

  /**
   * Add another PromptObjectModel as subsections of an existing section.
   *
   * @param target Either the title of the target section, or a `Section` reference.
   * @param pomToAdd The model whose top-level sections will be appended as subsections.
   * @throws Error if `target` is a string and no section with that title is found.
   */
  addPomAsSubsection(target: string | Section, pomToAdd: PromptObjectModel): void {
    let targetSection: Section;
    if (typeof target === 'string') {
      const found = this.findSection(target);
      if (!found) {
        throw new Error(`No section with title '${target}' found.`);
      }
      targetSection = found;
    } else if (target instanceof Section) {
      targetSection = target;
    } else {
      throw new TypeError('Target must be a string or a Section object.');
    }

    for (const section of pomToAdd.sections) {
      targetSection.subsections.push(section);
    }
  }

  /**
   * Create a PromptObjectModel from JSON data (string or already-parsed object).
   */
  static fromJson(jsonData: string | unknown): PromptObjectModel {
    let data: unknown;
    if (typeof jsonData === 'string') {
      data = JSON.parse(jsonData);
    } else {
      data = jsonData;
    }
    return PromptObjectModel._fromList(data);
  }

  /**
   * Create a PromptObjectModel from YAML data (string or already-parsed object).
   */
  static fromYaml(yamlData: string | unknown): PromptObjectModel {
    let data: unknown;
    if (typeof yamlData === 'string') {
      data = yaml.load(yamlData);
    } else {
      data = yamlData;
    }
    return PromptObjectModel._fromList(data);
  }

  /**
   * Internal: build a PromptObjectModel from a parsed array-of-sections shape.
   *
   * Mirrors Python's `_from_dict` (despite the name, Python takes a list at
   * the top level — the function name is historical).
   */
  private static _fromList(data: unknown): PromptObjectModel {
    if (!Array.isArray(data)) {
      throw new Error('Top-level POM data must be a list of sections.');
    }

    const buildSection = (d: unknown, isSubsection: boolean): Section => {
      if (typeof d !== 'object' || d === null || Array.isArray(d)) {
        throw new Error('Each section must be a dictionary.');
      }
      const dict = d as Record<string, unknown>;

      if ('title' in dict && typeof dict['title'] !== 'string') {
        throw new Error("'title' must be a string if present.");
      }
      if ('subsections' in dict && !Array.isArray(dict['subsections'])) {
        throw new Error("'subsections' must be a list if provided.");
      }
      if ('bullets' in dict && !Array.isArray(dict['bullets'])) {
        throw new Error("'bullets' must be a list if provided.");
      }
      if ('numbered' in dict && typeof dict['numbered'] !== 'boolean') {
        throw new Error("'numbered' must be a boolean if provided.");
      }
      if ('numberedBullets' in dict && typeof dict['numberedBullets'] !== 'boolean') {
        throw new Error("'numberedBullets' must be a boolean if provided.");
      }

      const hasBody = 'body' in dict && Boolean(dict['body']);
      const hasBullets = 'bullets' in dict && Array.isArray(dict['bullets']) && (dict['bullets'] as unknown[]).length > 0;
      const hasSubsections = 'subsections' in dict && Array.isArray(dict['subsections']) && (dict['subsections'] as unknown[]).length > 0;
      if (!hasBody && !hasBullets && !hasSubsections) {
        throw new Error(
          'All sections must have either a non-empty body, non-empty bullets, or subsections',
        );
      }

      if (isSubsection && !('title' in dict)) {
        throw new Error('All subsections must have a title');
      }

      const sectionOpts: {
        body?: string;
        bullets?: string[] | null;
        numbered?: boolean | null;
        numberedBullets?: boolean;
      } = {
        body: typeof dict['body'] === 'string' ? (dict['body'] as string) : '',
        bullets: Array.isArray(dict['bullets']) ? (dict['bullets'] as string[]) : [],
      };

      if ('numbered' in dict) sectionOpts.numbered = dict['numbered'] as boolean;
      if ('numberedBullets' in dict) sectionOpts.numberedBullets = dict['numberedBullets'] as boolean;

      const section = new Section(
        typeof dict['title'] === 'string' ? (dict['title'] as string) : null,
        sectionOpts,
      );

      if (Array.isArray(dict['subsections'])) {
        for (const sub of dict['subsections'] as unknown[]) {
          section.subsections.push(buildSection(sub, true));
        }
      }

      return section;
    };

    const pom = new PromptObjectModel();

    for (let i = 0; i < data.length; i++) {
      const sec = data[i] as Record<string, unknown>;
      if (i > 0 && !('title' in sec)) {
        sec['title'] = 'Untitled Section';
      }
      pom.sections.push(buildSection(sec, false));
    }

    return pom;
  }
}
