/**
 * SchemaUtils - JSON Schema validation for SWML documents.
 *
 * Provides basic structural validation of rendered SWML and
 * schema-driven verb extraction/validation.
 * Set SWML_SKIP_SCHEMA_VALIDATION=true to disable.
 */

import { createRequire } from 'module';

/** Result of validating a SWML document. */
export interface ValidationResult {
  /** Whether the document passed all validation checks. */
  valid: boolean;
  /** List of human-readable error messages; empty when valid. */
  errors: string[];
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
  private schemaPath: string | null;

  /**
   * Create a SchemaUtils instance.
   * @param opts - Optional settings for skipping validation, limiting cache size, or overriding the schema file path.
   */
  constructor(opts?: { skipValidation?: boolean; maxCacheSize?: number; schemaPath?: string }) {
    this.skipValidation = opts?.skipValidation ?? (process.env['SWML_SKIP_SCHEMA_VALIDATION'] === 'true');
    this.maxCacheSize = opts?.maxCacheSize ?? 100;
    this.schemaPath = opts?.schemaPath ?? null;
    this.loadSchema();
  }

  /**
   * Load the schema from the path specified in opts.schemaPath (if given) or fall back
   * to the bundled schema.json.  Mirrors Python's SchemaUtils which accepts an explicit
   * schema_path and falls back to _get_default_schema_path() when None is supplied.
   */
  private loadSchema(): void {
    // Try custom schema path first (mirrors Python's schema_path parameter)
    if (this.schemaPath) {
      try {
        const require = createRequire(import.meta.url);
        this.schema = require(this.schemaPath) as Record<string, unknown>;
        this.verbs = this.extractVerbDefinitions();
        return;
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

      const verbName = propNames[0];
      verbs.set(verbName, {
        name: verbName,
        schemaName,
        definition: verbDef,
      });
    }

    return verbs;
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

    const errors: string[] = [];

    // Check verb exists
    if (!this.verbs.has(verbName)) {
      errors.push(`Unknown verb: '${verbName}'`);
      return { valid: false, errors };
    }

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
      errors.push(`Invalid version: ${doc['version']}. Expected one of: ${VALID_VERSIONS.join(', ')}`);
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
            this.validateAiVerb((verb as Record<string, unknown>)['ai'] as Record<string, unknown>, errors);
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
          const fn = (swaig['functions'] as Record<string, unknown>[])[i];
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
