/**
 * SwmlBuilder - Builds SWML (SignalWire Markup Language) documents.
 *
 * Produces `{ version: "1.0.0", sections: { main: [...verbs] } }`.
 *
 * Verb methods (`.answer()`, `.hangup()`, `.play()`, etc.) are auto-installed
 * at construction from the bundled schema.json. All verb methods support
 * fluent chaining and call `addVerb()` internally.
 */

import { SchemaUtils } from './SchemaUtils.js';
import type { ValidationResult } from './SchemaUtils.js';

// Ensure module augmentation from generated file is active
import './SwmlVerbMethods.generated.js';

/** Options for constructing a SwmlBuilder. */
export interface SwmlBuilderOptions {
  /** An initial SWML document to seed the builder with, enabling document injection.
   *  When provided, the builder uses this document instead of creating an empty one.
   *  This mirrors the Python SDK's pattern of injecting an SWMLService instance. */
  initialDocument?: { version?: string; sections?: Record<string, unknown[]> };
}

/** Builds SWML documents composed of verb instructions organized into named sections. */
export class SwmlBuilder {
  private _document: { version: string; sections: Record<string, unknown[]> };
  private static _schemaUtils: SchemaUtils | null = null;
  private enableValidation: boolean;

  /**
   * Creates a new SwmlBuilder.
   * @param opts - Optional configuration. Pass `initialDocument` to inject an
   *   existing document (mirrors Python SDK's `SWMLService` injection pattern).
   */
  constructor(opts?: SwmlBuilderOptions) {
    if (opts?.initialDocument) {
      this._document = {
        version: opts.initialDocument.version ?? '1.0.0',
        sections: opts.initialDocument.sections ?? { main: [] },
      };
    } else {
      this._document = this.createEmpty();
    }
    this.enableValidation = process.env['SWML_SKIP_SCHEMA_VALIDATION'] !== 'true';
    this._installVerbMethods();
  }

  /**
   * Public read-only accessor for the underlying SWML document.
   * Provides direct access to the document, equivalent to the Python SDK's
   * `service` property on `SWMLBuilder`.
   */
  get document(): { version: string; sections: Record<string, unknown[]> } {
    return this._document;
  }

  private createEmpty() {
    return { version: '1.0.0', sections: { main: [] as unknown[] } };
  }

  /**
   * Get or create the shared SchemaUtils singleton.
   * Exposed for use by the type generator and tests.
   */
  static getSchemaUtils(): SchemaUtils {
    if (!SwmlBuilder._schemaUtils) {
      SwmlBuilder._schemaUtils = new SchemaUtils();
    }
    return SwmlBuilder._schemaUtils;
  }

  /**
   * Install verb methods on this instance for every verb defined in the schema.
   * Uses a closure factory so each method captures the correct verb name.
   * Mirrors Python SDK's `_create_verb_methods()`.
   */
  private _installVerbMethods(): void {
    const schemaUtils = SwmlBuilder.getSchemaUtils();
    const verbNames = schemaUtils.getVerbNames();

    for (const verbName of verbNames) {
      // Skip if this instance already has the method (e.g. from prototype)
      if (verbName in this) continue;

      // Special handling for sleep — accepts number directly or config object
      if (verbName === 'sleep') {
        const self = this;
        (this as Record<string, unknown>)['sleep'] = function sleep(
          durationOrConfig: number | Record<string, unknown>,
        ): SwmlBuilder {
          if (typeof durationOrConfig === 'number') {
            self.addVerb('sleep', durationOrConfig);
          } else {
            self.addVerb('sleep', durationOrConfig);
          }
          return self;
        };
        continue;
      }

      // Closure factory to capture verbName
      const makeMethod = (name: string) =>
        (config?: Record<string, unknown>): SwmlBuilder => {
          this.addVerb(name, config ?? {});
          return this;
        };

      (this as Record<string, unknown>)[verbName] = makeMethod(verbName);
    }
  }

  /**
   * Resets the document to an empty SWML structure.
   * @returns this for fluent chaining.
   */
  reset(): this {
    this._document = this.createEmpty();
    return this;
  }

  /**
   * Appends a verb to the main section.
   * Validates the verb config against the schema when validation is enabled.
   * @param verbName - The SWML verb name (e.g., "answer", "ai").
   * @param config - The verb's configuration payload.
   */
  addVerb(verbName: string, config: unknown): void {
    if (this.enableValidation) {
      const schemaUtils = SwmlBuilder.getSchemaUtils();
      if (schemaUtils.hasVerb(verbName)) {
        const result: ValidationResult = schemaUtils.validateVerb(verbName, config);
        if (!result.valid) {
          throw new Error(`SWML verb validation failed: ${result.errors.join('; ')}`);
        }
      }
    }
    this._document.sections['main'].push({ [verbName]: config });
  }

  /**
   * Appends a verb to a named section, creating the section if it does not exist.
   * @param sectionName - The target section name.
   * @param verbName - The SWML verb name.
   * @param config - The verb's configuration payload.
   */
  addVerbToSection(sectionName: string, verbName: string, config: unknown): void {
    if (!this._document.sections[sectionName]) {
      this._document.sections[sectionName] = [];
    }
    this._document.sections[sectionName].push({ [verbName]: config });
  }

  /**
   * Add a 'play' verb with say: prefix for text-to-speech.
   * Convenience wrapper matching Python SDK's `say()` method.
   *
   * @param text - Text to speak.
   * @param opts - Optional TTS parameters (voice, language, gender, volume).
   * @returns this for fluent chaining.
   */
  say(
    text: string,
    opts?: { voice?: string; language?: string; gender?: string; volume?: number },
  ): this {
    const config: Record<string, unknown> = { url: `say:${text}` };
    if (opts?.voice !== undefined) config['say_voice'] = opts.voice;
    if (opts?.language !== undefined) config['say_language'] = opts.language;
    if (opts?.gender !== undefined) config['say_gender'] = opts.gender;
    if (opts?.volume !== undefined) config['volume'] = opts.volume;
    this.addVerb('play', config);
    return this;
  }

  /**
   * Creates a new empty named section in the document.
   * If the section already exists, this is a no-op.
   * Matches Python SDK's `add_section(section_name)`.
   *
   * @param sectionName - The name of the section to create.
   * @returns this for fluent chaining.
   */
  addSection(sectionName: string): this {
    if (!this._document.sections[sectionName]) {
      this._document.sections[sectionName] = [];
    }
    return this;
  }

  /**
   * Returns the raw SWML document object.
   * @returns The document with version and sections.
   */
  getDocument(): Record<string, unknown> {
    return this._document;
  }

  /**
   * Alias for {@link getDocument}. Matches the Python SDK's `build()` method.
   * Build and return the SWML document as a dictionary/object.
   *
   * @returns The document with version and sections.
   */
  build(): Record<string, unknown> {
    return this.getDocument();
  }

  /**
   * Serializes the SWML document to a JSON string.
   * @returns The JSON-encoded SWML document.
   */
  renderDocument(): string {
    return JSON.stringify(this._document);
  }

  /**
   * Alias for {@link renderDocument}. Matches the Python SDK's `render()` method.
   * Build and render the SWML document as a JSON string.
   *
   * @returns The JSON-encoded SWML document.
   */
  render(): string {
    return this.renderDocument();
  }
}
