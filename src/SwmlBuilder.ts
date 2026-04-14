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

/** Builds SWML documents composed of verb instructions organized into named sections. */
export class SwmlBuilder {
  private document: { version: string; sections: Record<string, unknown[]> };
  private static _schemaUtils: SchemaUtils | null = null;
  private enableValidation: boolean;

  /**
   * Creates a new SwmlBuilder with an empty SWML document.
   * @param enableValidation - When false, disables verb schema validation.
   *   Defaults to true unless `SWML_SKIP_SCHEMA_VALIDATION=true` is set in the environment.
   */
  constructor(enableValidation?: boolean) {
    this.document = this.createEmpty();
    if (enableValidation !== undefined) {
      this.enableValidation = enableValidation;
    } else {
      this.enableValidation = process.env['SWML_SKIP_SCHEMA_VALIDATION'] !== 'true';
    }
    this._installVerbMethods();
  }

  /**
   * Enable or disable verb schema validation at runtime.
   * Matches the Python `schema_validation` constructor parameter on AgentBase.
   * @param enabled - True to enable validation, false to disable.
   */
  setValidation(enabled: boolean): void {
    this.enableValidation = enabled;
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

  /** Resets the document to an empty SWML structure. */
  reset(): void {
    this.document = this.createEmpty();
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
    this.document.sections['main'].push({ [verbName]: config });
  }

  /**
   * Appends a verb to a named section, creating the section if it does not exist.
   * @param sectionName - The target section name.
   * @param verbName - The SWML verb name.
   * @param config - The verb's configuration payload.
   */
  addVerbToSection(sectionName: string, verbName: string, config: unknown): void {
    if (!this.document.sections[sectionName]) {
      this.document.sections[sectionName] = [];
    }
    this.document.sections[sectionName].push({ [verbName]: config });
  }

  /**
   * Returns the raw SWML document object.
   * @returns The document with version and sections.
   */
  getDocument(): Record<string, unknown> {
    return this.document;
  }

  /**
   * Serializes the SWML document to a JSON string.
   * @returns The JSON-encoded SWML document.
   */
  renderDocument(): string {
    return JSON.stringify(this.document);
  }
}
