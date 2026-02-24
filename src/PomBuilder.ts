/**
 * PomBuilder - Prompt Object Model for structured prompt sections.
 *
 * Built-in replacement for the external signalwire-pom package.
 * Sections have a title, body, bullets (optionally numbered),
 * and nested subsections.
 */

export interface PomSectionData {
  title?: string;
  body?: string;
  bullets?: string[];
  numbered?: boolean;
  numberedBullets?: boolean;
  subsections?: PomSectionData[];
}

export class PomSection {
  title: string | null;
  body: string;
  bullets: string[];
  subsections: PomSection[];
  numbered: boolean | null;
  numberedBullets: boolean;

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
}

export class PomBuilder {
  private sections: PomSection[] = [];
  private sectionMap: Map<string, PomSection> = new Map();

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

  hasSection(title: string): boolean {
    return this.sectionMap.has(title);
  }

  getSection(title: string): PomSection | undefined {
    return this.sectionMap.get(title);
  }

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

  toDict(): PomSectionData[] {
    return this.sections.map((s) => s.toDict());
  }

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
}
