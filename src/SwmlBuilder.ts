/**
 * SwmlBuilder - Builds SWML (SignalWire Markup Language) documents.
 *
 * Produces `{ version: "1.0.0", sections: { main: [...verbs] } }`.
 *
 * Verb methods (`.answer()`, `.hangup()`, `.play()`, etc.) are auto-installed
 * at construction from the bundled schema.json. All verb methods support
 * fluent chaining and call `addVerb()` internally.
 */

import { SchemaUtils, SchemaValidationError } from './SchemaUtils.js';
import type { ValidationResult } from './SchemaUtils.js';
import type { TtsGender } from './relay/closedSets.js';

// Ensure module augmentation from generated file is active
import './SwmlVerbMethods.generated.js';

/** Options for constructing a SwmlBuilder. */
export interface SwmlBuilderOptions {
  /** An initial SWML document to seed the builder with, enabling document injection.
   *  When provided, the builder uses this document instead of creating an empty one.
   *  This mirrors the Python SDK's pattern of injecting an SWMLService instance. */
  initialDocument?: { version?: string; sections?: Record<string, unknown[]> };
  /** When false, disables verb schema validation.
   *  Defaults to true unless `SWML_SKIP_SCHEMA_VALIDATION=true` is set in the environment. */
  enableValidation?: boolean;
  /** Optional path to a custom SWML schema JSON file. When set, the builder uses
   *  a per-instance SchemaUtils loaded from this path instead of the bundled schema.
   *  Mirrors Python's `schema_path` constructor parameter on `SWMLService`/`AgentBase`. */
  schemaPath?: string;
  /** The `SWMLService` this builder belongs to, kept as a public back-reference
   *  ({@link SwmlBuilder.service}). The reference's `SWMLBuilder(service)` takes it as
   *  its sole constructor argument and keeps it as public `self.service`. Omit for a
   *  standalone builder (the common case — a builder used to hand-craft SWML has no
   *  service). */
  service?: SWMLServiceLike;
}

/**
 * The `SWMLService` shape a builder holds a back-reference to.
 *
 * Structural (rather than a direct `SWMLService` import) because `SWMLService`
 * constructs a `SwmlBuilder`; a value import here would close an initialization
 * cycle. Only the identity of the service matters to the back-reference, so the
 * members named are the ones a holder of the reference can rely on.
 */
export interface SWMLServiceLike {
  /** The service's name. */
  readonly name: string;
  /** The route the service is mounted at. */
  readonly route: string;
}

/**
 * Builds SWML documents composed of verb instructions organized into named sections.
 *
 * Verb methods (`.answer()`, `.play()`, `.hangup()`, `.transfer()`, etc.) are
 * auto-installed from the bundled SWML schema and all return `this` for fluent chaining.
 *
 * Most users don't instantiate `SwmlBuilder` directly — `AgentBase` uses it internally
 * and exposes higher-level helpers. Use this class directly for `SWMLService` (non-AI
 * call flows) or to hand-craft SWML returned from a route handler.
 *
 * @example Simple SWML document
 * ```ts
 * import { SwmlBuilder } from '@signalwire/sdk';
 *
 * const swml = new SwmlBuilder()
 *   .answer()
 *   .play({ url: 'https://cdn.example.com/greeting.mp3' })
 *   .hangup()
 *   .build();
 *
 * // swml is JSON ready to return from a SignalWire webhook.
 * ```
 *
 * @see {@link SWMLService} — HTTP service that serves a built SWML document
 * @see {@link AgentBase} — for AI-driven call flows
 */
export class SwmlBuilder {
  private _document: { version: string; sections: Record<string, unknown[]> };
  private static _schemaUtils: SchemaUtils | null = null;
  /** Per-instance SchemaUtils used when a custom `schemaPath` was supplied. */
  private _instanceSchemaUtils: SchemaUtils | null = null;
  private enableValidation: boolean;
  /**
   * The `SWMLService` this builder belongs to — the reference's public
   * `self.service` (`core/swml_builder.py:57`) — or `undefined` for a standalone
   * builder.
   *
   * In the reference the builder DELEGATES document construction to the service, so
   * the service is a required constructor argument. TS inverts the ownership (the
   * builder holds its own document and `SWMLService` holds the builder), which is why
   * it is optional here. The read-back is the same: a caller holding the builder can
   * reach the service that owns it.
   */
  readonly service?: SWMLServiceLike;

  /**
   * Creates a new SwmlBuilder.
   * @param opts - Optional configuration.
   *   - `initialDocument`: inject an existing document (mirrors Python SDK's `SWMLService` injection pattern).
   *   - `enableValidation`: explicit override for verb schema validation (falls back to env var).
   *   - `schemaPath`: load SWML schema from a custom JSON file instead of the bundled one.
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
    if (opts?.enableValidation !== undefined) {
      this.enableValidation = opts.enableValidation;
    } else {
      this.enableValidation = process.env['SWML_SKIP_SCHEMA_VALIDATION'] !== 'true';
    }
    if (opts?.schemaPath) {
      this._instanceSchemaUtils = new SchemaUtils({ schemaPath: opts.schemaPath });
    }
    this.service = opts?.service;
    this._installVerbMethods();
  }

  /** Returns the SchemaUtils for this builder — per-instance if a custom
   *  `schemaPath` was supplied, otherwise the shared singleton. */
  private getSchemaUtils(): SchemaUtils {
    return this._instanceSchemaUtils ?? SwmlBuilder.getSchemaUtils();
  }

  /**
   * Public read-only accessor for the underlying SWML document.
   *
   * (Not the reference's `service` — that is the SWMLService back-reference, exposed
   * as {@link service}. This is the document the builder is assembling, which the
   * reference reaches through `self.service`.)
   */
  get document(): { version: string; sections: Record<string, unknown[]> } {
    return this._document;
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
    const schemaUtils = this.getSchemaUtils();
    const verbNames = schemaUtils.getVerbNames();

    for (const verbName of verbNames) {
      // Skip if this instance already has the method (e.g. from prototype)
      if (verbName in this) continue;

      // Special handling for sleep — accepts number directly or config object
      if (verbName === 'sleep') {
        (this as Record<string, unknown>)['sleep'] = (
          durationOrConfig: number | Record<string, unknown>,
        ): SwmlBuilder => {
          if (typeof durationOrConfig === 'number') {
            this.addVerb('sleep', durationOrConfig);
          } else {
            this.addVerb('sleep', durationOrConfig);
          }
          return this;
        };
        continue;
      }

      // Closure factory to capture verbName
      const makeMethod =
        (name: string) =>
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
   * @param opts - When `opts.skipValidation` is true, the config is appended
   *   WITHOUT schema validation. Used by AgentBase for the internally-assembled
   *   `ai` verb, whose config is built from already-typed builder inputs and may
   *   carry real, server-accepted SWML that the bundled schema does not yet model
   *   (e.g. `multilingual`, `SWAIG.mcp_servers`, per-language engine/model/fillers,
   *   `debug_webhook_url`). Validating it against the closed schema would raise on
   *   those legitimate features — the strict-render contract is about rejecting
   *   MISSHAPEN direct `addVerb` input (unknown verb, misspelled/unknown key,
   *   wrong type), NOT about second-guessing trusted internal assembly. The
   *   direct/public `addVerb` path stays fully strict.
   */
  addVerb(verbName: string, config: unknown, opts?: { skipValidation?: boolean }): void {
    if (this.enableValidation && !opts?.skipValidation) {
      // Validate unconditionally — an UNKNOWN verb must raise, not be appended
      // silently (the strict-render contract). `validateVerb` returns
      // "Unknown verb: '<name>'" for a name the schema doesn't define, matching
      // the python reference's `add_verb`. (Previously this was gated on
      // `hasVerb`, which let unknown verbs slip through.)
      const result: ValidationResult = this.getSchemaUtils().validateVerb(verbName, config);
      if (!result.valid) {
        throw new SchemaValidationError(verbName, result.errors);
      }
    }
    // The default document factory always seeds a `main` section; preserve the
    // existing assumption that it is present (assertion is type-only).
    this._document.sections['main']!.push({ [verbName]: config });
  }

  /**
   * Appends a verb to a named section, creating the section if it does not exist.
   *
   * Validates exactly as {@link addVerb} does. The reference validates at BOTH
   * add-verb sites (`core/swml_service.py:558` and `:635`, each raising
   * `SchemaValidationError`); this path previously appended without validating, so a
   * misshapen or unknown verb reached a non-main section silently.
   *
   * @param sectionName - The target section name.
   * @param verbName - The SWML verb name.
   * @param config - The verb's configuration payload.
   * @param opts - When `opts.skipValidation` is true, append without validating
   *   (same trusted-internal-assembly escape hatch as {@link addVerb}).
   * @throws {SchemaValidationError} When validation is enabled and the config does
   *   not satisfy the verb's schema (or the verb is unknown).
   */
  addVerbToSection(
    sectionName: string,
    verbName: string,
    config: unknown,
    opts?: { skipValidation?: boolean },
  ): void {
    if (this.enableValidation && !opts?.skipValidation) {
      const result: ValidationResult = this.getSchemaUtils().validateVerb(verbName, config);
      if (!result.valid) {
        throw new SchemaValidationError(verbName, result.errors);
      }
    }
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
    // `gender` is typed `TtsGender` (`'male' | 'female'`) — the CLOSED literal
    // union, consistent with the RELAY gender: autocomplete + typo-checking, an
    // off-spec value a compile error. Types erase at runtime → the value on the
    // wire is identical to a bare string (parity with Python's `gender: str`);
    // closing the type changes what the compiler accepts, not a wire byte.
    opts?: { voice?: string; language?: string; gender?: TtsGender; volume?: number },
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
   * Build and return the SWML document as a dictionary/object. Canonical name,
   * matching Python's `SWMLBuilder.build()`.
   *
   * @returns The document with version and sections.
   */
  build(): Record<string, unknown> {
    return this._document;
  }

  /**
   * Build and render the SWML document as a JSON string. Canonical name,
   * matching Python's `SWMLBuilder.render()`.
   *
   * @returns The JSON-encoded SWML document.
   */
  render(): string {
    return JSON.stringify(this._document);
  }
}
