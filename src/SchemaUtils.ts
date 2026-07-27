/**
 * SchemaUtils - JSON Schema validation for SWML documents.
 *
 * Provides basic structural validation of rendered SWML and
 * schema-driven verb extraction/validation.
 * Set SWML_SKIP_SCHEMA_VALIDATION=true to disable.
 */

import { createRequire } from 'module';
import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';

/** Result of validating a SWML document. */
export interface ValidationResult {
  /** Whether the document passed all validation checks. */
  valid: boolean;
  /** List of human-readable error messages; empty when valid. */
  errors: string[];
}

/**
 * Thrown when schema validation of a SWML verb config fails.
 *
 * Mirrors the reference `signalwire.utils.schema_utils.SchemaValidationError`
 * (`SchemaValidationError(verb_name, errors)`, `utils/schema_utils.py:25`) and the
 * same class in java / cpp / dotnet / ruby.
 *
 * Both construction arguments are readable back, so a caller can branch on WHICH
 * verb failed and enumerate the individual messages programmatically. Previously
 * `addVerb` threw a bare `Error` whose only content was a joined string, which meant
 * neither piece was recoverable without parsing the message text.
 */
export class SchemaValidationError extends Error {
  /** The verb whose config failed validation. */
  readonly verbName: string;
  /** The individual human-readable validation error messages. */
  readonly errors: readonly string[];

  /**
   * @param verbName - The verb whose config failed validation.
   * @param errors - The individual validation error messages.
   */
  constructor(verbName: string, errors: string[]) {
    super(`Schema validation failed for '${verbName}': ${errors.join('; ')}`);
    this.name = 'SchemaValidationError';
    this.verbName = verbName;
    this.errors = Object.freeze([...errors]);
  }
}

/** A verb definition extracted from the schema. */
export interface VerbDefinition {
  /** The verb name as used in SWML (e.g. "answer", "hangup", "sip_refer"). */
  name: string;
  /** The PascalCase schema definition name (e.g. "Answer", "Hangup", "SIPRefer"). */
  schemaName: string;
  /** The raw JSON Schema definition object for this verb. */
  definition: Record<string, unknown>;
}

// Basic SWML structure expectations
const REQUIRED_TOP_LEVEL = ['version', 'sections'];
const VALID_VERSIONS = ['1.0.0'];

/** Validates SWML documents against structural rules with an LRU-style result cache. */
export class SchemaUtils {
  private skipValidation: boolean;
  private cache: Map<string, ValidationResult> = new Map();
  private maxCacheSize: number;
  private schema: Record<string, unknown> | null = null;
  private verbs: Map<string, VerbDefinition> = new Map();
  /** Path to the schema file, or null to use the bundled schema. */
  private _schemaPath: string | null;
  /** Per-verb lazily-compiled JSON-Schema (Draft 2020-12) validators, keyed by
   *  verb name. Each validates a single verb's config against JUST that verb's
   *  `$defs` definition (with the schema's `$defs` available for `$ref`s), the
   *  closed-schema check that raises on unknown/misspelled top-level keys and
   *  wrong-typed values — the TS mirror of Python's jsonschema-rs
   *  `_validate_verb_full`, but scoped to one verb so compilation is cheap. A
   *  `null` entry means a validator couldn't be built for that verb (fall back
   *  to lightweight). Shared Ajv instance is created once. */
  private verbValidators: Map<string, ValidateFunction | null> = new Map();
  private ajv: { compile: (s: object) => ValidateFunction } | null | undefined = undefined;

  /**
   * Create a SchemaUtils instance.
   * @param opts - Optional settings for skipping validation, limiting cache size, or overriding the schema file path.
   */
  constructor(opts?: { skipValidation?: boolean; maxCacheSize?: number; schemaPath?: string }) {
    this.skipValidation =
      opts?.skipValidation ?? process.env['SWML_SKIP_SCHEMA_VALIDATION'] === 'true';
    this.maxCacheSize = opts?.maxCacheSize ?? 100;
    this._schemaPath = opts?.schemaPath ?? null;
    this.loadSchema();
  }

  /**
   * The schema file path in effect — the reference's public `self.schema_path`
   * (`utils/schema_utils.py:69`), or `null` when the bundled schema is in use.
   *
   * A caller who passes `schemaPath` at construction can read back which schema the
   * instance actually resolved. The reference additionally rewrites the attribute to
   * the resolved DEFAULT path when none was supplied (line 71); TS keeps `null` for
   * "bundled", which is the same information without hardcoding a filesystem path
   * into the surface — the bundled schema is imported, not read from disk.
   */
  get schemaPath(): string | null {
    return this._schemaPath;
  }

  /**
   * Load the schema from the path specified in opts.schemaPath (if given) or fall back
   * to the bundled schema.json.  Mirrors Python's SchemaUtils which accepts an explicit
   * schema_path and falls back to _get_default_schema_path() when None is supplied.
   * Public accessor matching Python SDK's `load_schema()`, which returns the loaded
   * schema dictionary (or `null` if unavailable). Also (re)populates the internal
   * verb definitions as a side effect.
   * @returns The loaded schema object, or `null` if it could not be loaded.
   */
  loadSchema(): Record<string, unknown> | null {
    // A (re)load may change the schema; drop any compiled verb validators.
    this.verbValidators.clear();
    this.ajv = undefined;
    // Try custom schema path first (mirrors Python's schema_path parameter)
    if (this._schemaPath) {
      try {
        const require = createRequire(import.meta.url);
        this.schema = require(this._schemaPath) as Record<string, unknown>;
        this.verbs = this.extractVerbDefinitions();
        return this.schema;
      } catch {
        // Fall through to bundled schema on load failure
      }
    }
    // Fall back to bundled schema.json
    try {
      const require = createRequire(import.meta.url);
      this.schema = require('./schema.json') as Record<string, unknown>;
      this.verbs = this.extractVerbDefinitions();
    } catch {
      // Schema loading is optional — validation still works structurally
      this.schema = null;
    }
    return this.schema;
  }

  /**
   * Extract verb definitions from `$defs/SWMLMethod.anyOf` in the schema.
   * Mirrors Python SDK's `_extract_verb_definitions()`.
   */
  private extractVerbDefinitions(): Map<string, VerbDefinition> {
    const verbs = new Map<string, VerbDefinition>();
    if (!this.schema) return verbs;

    const defs = this.schema['$defs'] as Record<string, unknown> | undefined;
    if (!defs) return verbs;

    const swmlMethod = defs['SWMLMethod'] as Record<string, unknown> | undefined;
    if (!swmlMethod || !Array.isArray(swmlMethod['anyOf'])) return verbs;

    for (const ref of swmlMethod['anyOf'] as Record<string, unknown>[]) {
      const refPath = ref['$ref'] as string | undefined;
      if (!refPath) continue;

      // Extract the PascalCase name from "#/$defs/Answer"
      const schemaName = refPath.split('/').pop()!;
      const verbDef = defs[schemaName] as Record<string, unknown> | undefined;
      if (!verbDef || !verbDef['properties']) continue;

      // The actual verb name is the first (and only) property key
      const propNames = Object.keys(verbDef['properties'] as Record<string, unknown>);
      if (propNames.length === 0) continue;

      const verbName = propNames[0]!; // length === 0 continues above
      verbs.set(verbName, {
        name: verbName,
        schemaName,
        definition: verbDef,
      });
    }

    return verbs;
  }

  /**
   * Whether full JSON-Schema validation is available. Mirrors Python SDK's
   * `full_validation_available` property (which reports whether `jsonschema` is
   * installed). This SDK always bundles Ajv, so full validation is always
   * available — this is constantly `true`.
   */
  get fullValidationAvailable(): boolean {
    return true;
  }

  /**
   * Get all verb names defined in the schema.
   * @returns Array of verb names (e.g. ["answer", "ai", "hangup", ...]).
   */
  getVerbNames(): string[] {
    return Array.from(this.verbs.keys());
  }

  /**
   * Get the inner properties schema for a specific verb.
   * For example, for "hangup" this returns `{ type: "object", properties: { reason: ... }, ... }`.
   * @param verbName - The verb name (e.g. "answer", "tap").
   * @returns The inner schema definition or an empty object if not found.
   */
  getVerbProperties(verbName: string): Record<string, unknown> {
    const verb = this.verbs.get(verbName);
    if (!verb) return {};
    const outerProps = verb.definition['properties'] as Record<string, unknown> | undefined;
    if (!outerProps || !outerProps[verbName]) return {};
    return outerProps[verbName] as Record<string, unknown>;
  }

  /**
   * Get the parameter definitions for a specific verb — the map of parameter
   * name → JSON-schema definition. Mirrors Python SDK's `get_verb_parameters()`:
   * it returns the nested `properties` object of the verb's inner schema (whereas
   * `getVerbProperties` returns the whole inner schema object).
   * @param verbName - The verb name (e.g. "ai", "answer").
   * @returns Dictionary mapping parameter names to their definitions, or `{}`.
   */
  getVerbParameters(verbName: string): Record<string, unknown> {
    const properties = this.getVerbProperties(verbName);
    const params = properties['properties'];
    if (params && typeof params === 'object') {
      return params as Record<string, unknown>;
    }
    return {};
  }

  /**
   * Get the required properties for a verb's inner config.
   * @param verbName - The verb name.
   * @returns Array of required property names.
   */
  getVerbRequiredProperties(verbName: string): string[] {
    const innerSchema = this.getVerbProperties(verbName);
    if (!innerSchema || !Array.isArray(innerSchema['required'])) return [];
    return innerSchema['required'] as string[];
  }

  /**
   * Get the description text for a verb.
   * @param verbName - The verb name.
   * @returns The description string or empty string.
   */
  getVerbDescription(verbName: string): string {
    const innerSchema = this.getVerbProperties(verbName);
    return (innerSchema['description'] as string) ?? '';
  }

  /**
   * Check if a verb name is defined in the schema.
   * @param verbName - The verb name.
   * @returns True if the verb exists.
   */
  hasVerb(verbName: string): boolean {
    return this.verbs.has(verbName);
  }

  /**
   * Lightweight validation of a verb config against the schema.
   * Checks that the verb exists and required properties are present.
   * Mirrors Python SDK's `_validate_verb_lightweight()`.
   *
   * @param verbName - The verb name.
   * @param config - The verb configuration to validate.
   * @returns Validation result.
   */
  validateVerb(verbName: string, config: unknown): ValidationResult {
    if (this.skipValidation) {
      return { valid: true, errors: [] };
    }

    // Check verb exists (fast, schema-independent).
    if (!this.verbs.has(verbName)) {
      return { valid: false, errors: [`Unknown verb: '${verbName}'`] };
    }

    // The `ai` verb is a HANDLER verb: its strict-render check is TOP-LEVEL keys
    // ONLY (reject unknown/misspelled top-level keys like `temperatur`/`zzz`,
    // require a `prompt`) — NOT the full deep schema. The SDK legitimately emits
    // ai DEEP shapes the bundled JSON-schema does not fully accept (an empty
    // `prompt.pom: []` for a promptless agent, SWAIG `defaults`/function
    // `web_hook_url`/`__token`); full-deep-validating them would false-reject
    // valid documents. `ai.params` stays OPEN. Mirrors the python reference's
    // AIVerbHandler.validate_config + validate_verb_top_level_keys (caea077).
    if (verbName === 'ai') {
      return this.validateAiVerbStrict(config);
    }

    // FULL JSON-Schema validation against JUST THIS VERB's definition — this is
    // what makes the strict-render contract hold: the schema closes each verb
    // (`unevaluatedProperties`) so an unknown/misspelled top-level key or a
    // wrong-typed value fails, while a deliberately-open sub-object (e.g.
    // ai.params) still passes. Same outcomes as validating a whole minimal doc
    // (mirrors Python's jsonschema-rs `_validate_verb_full`) but compiling only
    // the one verb's `$defs` subtree — ~30x cheaper than compiling the entire
    // 39-verb `anyOf` document schema, and it yields a clean per-verb error
    // instead of an anyOf failure for every OTHER verb. Falls back to the
    // lightweight required-props check when a validator can't be built.
    const validate = this.getVerbValidator(verbName);
    if (validate) {
      // The verb def is shaped `{ properties: { <verb>: <config-schema> } }`, so
      // validate the single-key object `{ <verb>: config }` against it.
      if (validate({ [verbName]: config })) {
        return { valid: true, errors: [] };
      }
      const errs = validate.errors ?? [];
      const fmt = (e: (typeof errs)[number]): string => {
        const path = e.instancePath || '/';
        if (e.keyword === 'required') {
          const mp = (e.params as { missingProperty?: string } | undefined)?.missingProperty;
          if (mp) return `${path} missing required property '${mp}'`;
        }
        return `${path} ${e.message ?? ''}`.trim();
      };
      // Prefer a `required` diagnostic (the missing-key name is the most
      // informative), else the first reported error.
      const required = errs.filter((e) => e.keyword === 'required');
      const picked = required.length ? required : errs;
      const raw = picked.map(fmt).join('; ');
      const msg = raw.length > 500 ? raw.slice(0, 500) + '...' : raw;
      return {
        valid: false,
        errors: [`Schema validation error for '${verbName}': ${msg || 'invalid config'}`],
      };
    }

    return this.validateVerbLightweight(verbName, config);
  }

  /**
   * Get the shared Ajv (Draft 2020-12) instance, created on first use. Returns
   * `null` when the schema isn't a full document schema (no `sections` property
   * — a partial/mocked schema) so callers fall back to lightweight validation,
   * the TS mirror of Python's `_validate_verb_full` guard.
   */
  private getAjv(): { compile: (s: object) => ValidateFunction } | null {
    if (this.ajv !== undefined) return this.ajv;
    const props = (this.schema?.['properties'] as Record<string, unknown> | undefined) ?? {};
    if (!this.schema || !('sections' in props)) {
      this.ajv = null;
      return null;
    }
    // Draft 2020-12 (the SWML schema's `$schema`). `strict: false` so unknown
    // formats like "uri" are tolerated rather than throwing at compile time;
    // `logger: false` silences Ajv's per-unknown-format warnings (the SWML
    // schema declares `format: "uri"` on ~40 fields — without this Ajv floods
    // stderr with one warning per field). We validate structure/keys, not
    // formats.
    const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
    this.ajv = new (AjvCtor as new (o: object) => { compile: (s: object) => ValidateFunction })({
      allErrors: true,
      strict: false,
      logger: false,
    });
    return this.ajv;
  }

  /**
   * Get (compiling on first use, then cached) a validator for ONE verb's config,
   * against just that verb's `$defs` definition with the schema's `$defs`
   * available for `$ref` resolution. Returns `null` when a validator cannot be
   * built (no full schema, verb not in schema, or an Ajv compile error) — the
   * caller then falls back to lightweight validation. Scoping to one verb keeps
   * compilation ~30x cheaper than compiling the entire document schema.
   */
  private getVerbValidator(verbName: string): ValidateFunction | null {
    const cached = this.verbValidators.get(verbName);
    if (cached !== undefined) return cached;
    let built: ValidateFunction | null = null;
    const ajv = this.getAjv();
    const verb = this.verbs.get(verbName);
    const defs = this.schema?.['$defs'] as Record<string, unknown> | undefined;
    if (ajv && verb && defs) {
      try {
        // Compile the verb's own definition (which is `{ properties: { <verb>:
        // <config-schema> }, ... }`) with $defs present so cross-verb $refs
        // resolve. Give it a fresh $id so repeat compiles never collide.
        built = ajv.compile({ $defs: defs, ...(verb.definition as object) });
      } catch {
        built = null;
      }
    }
    this.verbValidators.set(verbName, built);
    return built;
  }

  /**
   * Lightweight validation (verb existence + required fields only). The fallback
   * when the full validator can't be built. Mirrors Python's
   * `_validate_verb_lightweight`.
   */
  private validateVerbLightweight(verbName: string, config: unknown): ValidationResult {
    const errors: string[] = [];
    const innerSchema = this.getVerbProperties(verbName);

    // If the inner schema is not an object type (e.g. "label" takes a string,
    // "sleep" takes anyOf int/object), skip property checks
    const innerType = innerSchema['type'];
    if (innerType !== 'object') {
      return { valid: true, errors: [] };
    }

    // Config must be an object for object-typed verbs
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      // Allow empty config for verbs with no required props
      const required = this.getVerbRequiredProperties(verbName);
      if (required.length > 0) {
        errors.push(`Verb '${verbName}' expects an object config`);
        return { valid: false, errors };
      }
      return { valid: true, errors: [] };
    }

    // Check required properties
    const required = this.getVerbRequiredProperties(verbName);
    const configObj = config as Record<string, unknown>;
    for (const prop of required) {
      if (!(prop in configObj)) {
        errors.push(`Missing required property '${prop}' for verb '${verbName}'`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Strict-render check for the `ai` handler verb: TOP-LEVEL keys only.
   *
   * Rejects unknown/misspelled top-level ai keys (e.g. `temperatur`, `zzz`) and
   * requires a well-formed `prompt` (present, an object, with exactly one of
   * `text`/`pom`), but does NOT deep-validate the ai sub-tree — the SDK emits
   * legitimate deep ai shapes the bundled schema doesn't fully model (empty
   * `prompt.pom: []`, SWAIG `defaults`/`web_hook_url`/`__token`). `ai.params`
   * stays open (it is a known top-level key; its contents are never checked).
   * Mirrors the python reference's AIVerbHandler.validate_config +
   * validate_verb_top_level_keys.
   */
  private validateAiVerbStrict(config: unknown): ValidationResult {
    // The ai verb's config must be an object.
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      return { valid: false, errors: ["Verb 'ai' expects an object config"] };
    }
    const cfg = config as Record<string, unknown>;

    // Handler check: a prompt is required and must carry exactly one base prompt.
    if (!('prompt' in cfg)) {
      return { valid: false, errors: ["Missing required field 'prompt' for verb 'ai'"] };
    }
    const prompt = cfg['prompt'];
    if (typeof prompt !== 'object' || prompt === null || Array.isArray(prompt)) {
      return { valid: false, errors: ["'prompt' must be an object"] };
    }
    const p = prompt as Record<string, unknown>;
    const baseCount = ('text' in p ? 1 : 0) + ('pom' in p ? 1 : 0);
    if (baseCount === 0) {
      return {
        valid: false,
        errors: ["'prompt' must contain either 'text' or 'pom' as base prompt"],
      };
    }
    if (baseCount > 1) {
      return {
        valid: false,
        errors: ["'prompt' can only contain one of: 'text' or 'pom' (mutually exclusive)"],
      };
    }

    // Shallow strict check: reject unknown/misspelled TOP-LEVEL keys against the
    // ai verb's known property set (a no-op if the set isn't enumerable/closed).
    const known = this.verbTopLevelPropertyNames('ai');
    if (known) {
      const unknown = Object.keys(cfg).filter((k) => !known.has(k));
      if (unknown.length) {
        return {
          valid: false,
          errors: [
            `Unknown/misspelled key(s) ${JSON.stringify(unknown.sort())} for verb 'ai'. ` +
              `Known keys: ${JSON.stringify([...known].sort())}`,
          ],
        };
      }
    }
    return { valid: true, errors: [] };
  }

  /**
   * Resolve the set of KNOWN top-level property names for a verb's config object,
   * following a single `$ref` (e.g. AI -> AIObject). Returns `null` when the
   * verb's config schema is not a CLOSED object-with-properties (so no shallow
   * key check applies). Mirrors python's `_verb_top_level_property_names`.
   */
  private verbTopLevelPropertyNames(verbName: string): Set<string> | null {
    const verb = this.verbs.get(verbName);
    if (!verb) return null;
    const outerProps = verb.definition['properties'] as Record<string, unknown> | undefined;
    let body = outerProps?.[verbName] as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') return null;
    // Follow a single $ref (AI -> AIObject) to the object declaring the props.
    const ref = body['$ref'];
    if (typeof ref === 'string') {
      const refName = ref.split('/').pop()!;
      const defs = this.schema?.['$defs'] as Record<string, unknown> | undefined;
      body = defs?.[refName] as Record<string, unknown> | undefined;
    }
    if (!body || body['type'] !== 'object') return null;
    const propMap = body['properties'];
    if (!propMap || typeof propMap !== 'object') return null;
    // Only a meaningful closed-key check when the schema closes the object.
    const uneval = body['unevaluatedProperties'];
    const closes =
      body['additionalProperties'] === false ||
      uneval === false ||
      (typeof uneval === 'object' &&
        uneval !== null &&
        'not' in (uneval as Record<string, unknown>) &&
        Object.keys((uneval as Record<string, unknown>)['not'] as Record<string, unknown>)
          .length === 0);
    if (!closes) return null;
    return new Set(Object.keys(propMap as Record<string, unknown>));
  }

  /**
   * Validate a SWML document against structural rules.
   * @param swml - The SWML document as a JSON string or parsed object.
   * @returns The validation result indicating success or a list of errors.
   */
  validate(swml: string | Record<string, unknown>): ValidationResult {
    if (this.skipValidation) {
      return { valid: true, errors: [] };
    }

    const swmlStr = typeof swml === 'string' ? swml : JSON.stringify(swml);

    // Check cache
    const cached = this.cache.get(swmlStr);
    if (cached) return cached;

    const errors: string[] = [];
    let doc: Record<string, unknown>;

    try {
      doc = typeof swml === 'string' ? JSON.parse(swml) : swml;
    } catch {
      const result: ValidationResult = { valid: false, errors: ['Invalid JSON'] };
      this.cacheResult(swmlStr, result);
      return result;
    }

    // Check top-level required keys
    for (const key of REQUIRED_TOP_LEVEL) {
      if (!(key in doc)) {
        errors.push(`Missing required top-level key: ${key}`);
      }
    }

    // Check version
    if (doc['version'] && !VALID_VERSIONS.includes(doc['version'] as string)) {
      errors.push(
        `Invalid version: ${doc['version']}. Expected one of: ${VALID_VERSIONS.join(', ')}`,
      );
    }

    // Check sections
    if (doc['sections']) {
      if (typeof doc['sections'] !== 'object' || Array.isArray(doc['sections'])) {
        errors.push('sections must be an object');
      } else {
        const sections = doc['sections'] as Record<string, unknown>;
        if (!('main' in sections)) {
          errors.push('sections must contain a "main" section');
        }
        // Validate each section is an array
        for (const [name, section] of Object.entries(sections)) {
          if (!Array.isArray(section)) {
            errors.push(`Section "${name}" must be an array`);
          }
        }
      }
    }

    // Validate AI verb structure if present
    if (doc['sections'] && typeof doc['sections'] === 'object') {
      const sections = doc['sections'] as Record<string, unknown[]>;
      const main = sections['main'];
      if (Array.isArray(main)) {
        for (const verb of main) {
          if (typeof verb === 'object' && verb !== null && 'ai' in verb) {
            this.validateAiVerb(
              (verb as Record<string, unknown>)['ai'] as Record<string, unknown>,
              errors,
            );
          }
        }
      }
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
    };
    this.cacheResult(swmlStr, result);
    return result;
  }

  private validateAiVerb(ai: Record<string, unknown>, errors: string[]): void {
    if (!ai) return;

    // Prompt must have text
    if (ai['prompt']) {
      const prompt = ai['prompt'] as Record<string, unknown>;
      if (typeof prompt === 'object' && !prompt['text']) {
        errors.push('AI prompt must have a "text" field');
      }
    }

    // SWAIG validation
    if (ai['SWAIG']) {
      const swaig = ai['SWAIG'] as Record<string, unknown>;
      if (swaig['functions'] && !Array.isArray(swaig['functions'])) {
        errors.push('SWAIG functions must be an array');
      }
      if (Array.isArray(swaig['functions'])) {
        for (let i = 0; i < (swaig['functions'] as unknown[]).length; i++) {
          const fn = (swaig['functions'] as Record<string, unknown>[])[i]!; // i < length
          if (!fn['function']) {
            errors.push(`SWAIG function at index ${i} missing "function" name`);
          }
        }
      }
    }

    // Post-prompt validation
    if (ai['post_prompt']) {
      const pp = ai['post_prompt'] as Record<string, unknown>;
      if (typeof pp === 'object' && !pp['text']) {
        errors.push('AI post_prompt must have a "text" field');
      }
    }
  }

  /** Clear the validation cache */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached validation results.
   * @returns The current cache entry count.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  private cacheResult(key: string, result: ValidationResult): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, result);
  }
}
