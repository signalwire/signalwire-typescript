/**
 * SwmlBuilder - Builds SWML (SignalWire Markup Language) documents.
 *
 * Produces `{ version: "1.0.0", sections: { main: [...verbs] } }`.
 */

export class SwmlBuilder {
  private document: { version: string; sections: Record<string, unknown[]> };

  constructor() {
    this.document = this.createEmpty();
  }

  private createEmpty() {
    return { version: '1.0.0', sections: { main: [] as unknown[] } };
  }

  reset(): void {
    this.document = this.createEmpty();
  }

  addVerb(verbName: string, config: unknown): void {
    this.document.sections['main'].push({ [verbName]: config });
  }

  addVerbToSection(sectionName: string, verbName: string, config: unknown): void {
    if (!this.document.sections[sectionName]) {
      this.document.sections[sectionName] = [];
    }
    this.document.sections[sectionName].push({ [verbName]: config });
  }

  getDocument(): Record<string, unknown> {
    return this.document;
  }

  renderDocument(): string {
    return JSON.stringify(this.document);
  }
}
