#!/usr/bin/env node
/**
 * generateVerbTypes.ts
 *
 * Build-time script that reads schema.json and generates SwmlVerbMethods.generated.ts.
 * This provides TypeScript interface augmentation so IDE autocomplete works for all
 * auto-vivified verb methods on SwmlBuilder.
 *
 * Usage: npx tsx src/generateVerbTypes.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SchemaProperty {
  type?: string;
  anyOf?: SchemaProperty[];
  oneOf?: SchemaProperty[];
  $ref?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  description?: string;
  items?: SchemaProperty;
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  format?: string;
  enum?: unknown[];
}

interface Schema {
  $defs: Record<string, SchemaProperty>;
}

/**
 * Map JSON Schema type to TypeScript type string.
 * @param prop - The schema property to map.
 * @param opts - Optional per-property overrides.
 */
function mapType(prop: SchemaProperty, opts?: { widenStringEnum?: boolean }): string {
  // Handle const values
  if (prop.const !== undefined) {
    // If the caller wants a widened string type, emit 'string' instead of the literal.
    // Used for fields like hangup.reason where Python accepts any string.
    if (opts?.widenStringEnum && typeof prop.const === 'string') return 'string';
    return typeof prop.const === 'string' ? `'${prop.const}'` : String(prop.const);
  }

  // Handle $ref
  if (prop.$ref) {
    return 'unknown';
  }

  // Handle anyOf
  if (prop.anyOf) {
    // If wideningStringEnum, and every branch is a string const, collapse to 'string'
    if (opts?.widenStringEnum && prop.anyOf.every(p => p.const !== undefined && typeof p.const === 'string')) {
      return 'string';
    }
    const types = prop.anyOf
      .map(p => mapType(p, opts))
      .filter((t, i, arr) => arr.indexOf(t) === i); // deduplicate
    // Filter out 'unknown' from SWMLVar refs if there are concrete types
    const concreteTypes = types.filter(t => t !== 'unknown');
    if (concreteTypes.length > 0) {
      return concreteTypes.join(' | ');
    }
    return types.join(' | ');
  }

  // Handle oneOf
  if (prop.oneOf) {
    return 'Record<string, unknown>';
  }

  // Handle basic types
  switch (prop.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      if (prop.items) {
        const itemType = mapType(prop.items);
        return `${itemType}[]`;
      }
      return 'unknown[]';
    case 'object':
      if (prop.properties) {
        return 'Record<string, unknown>';
      }
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

/**
 * Properties that should be widened from a string-const enum to `string` in TypeScript.
 * Python accepts any string for these; the schema's enum values are documentation-only hints.
 * Keyed by verbName, value is the set of property names to widen.
 */
const WIDEN_TO_STRING: Record<string, Set<string>> = {
  // Python's SWMLService accepts any string for hangup.reason; the three schema values
  // ('hangup', 'busy', 'decline') are the common platform values, not an exhaustive set.
  hangup: new Set(['reason']),
};

/**
 * Custom typed interface definitions for verbs whose schema shape (e.g., $ref or oneOf)
 * cannot be fully expressed by the generic generateVerbConfig() logic.
 *
 * These interfaces match the Python SDK's named parameters for each verb:
 *   - AiVerbConfig mirrors: prompt_text, prompt_pom, post_prompt, post_prompt_url, swaig, **kwargs
 *   - PlayVerbConfig mirrors: url, urls, volume, say_voice, say_language, say_gender, auto_answer
 *
 * Keyed by verbName. interfaceName is emitted as a top-level export in the generated file;
 * configType references that name; isOptional=true because all Python params are optional.
 */
const CUSTOM_VERB_TYPES: Record<string, { interfaceName: string; interfaceBody: string; isOptional: boolean }> = {
  ai: {
    interfaceName: 'AiVerbConfig',
    interfaceBody: [
      '  /** Text prompt for the AI agent (mutually exclusive with prompt when using POM). */',
      '  prompt?: string | Array<Record<string, unknown>>;',
      '  /** Optional post-prompt text sent to the LLM after the conversation ends. */',
      '  post_prompt?: string;',
      '  /** URL to receive post-prompt status callbacks. */',
      '  post_prompt_url?: string;',
      '  /** SignalWire AI Gateway (SWAIG) configuration for custom function/tool definitions. */',
      '  SWAIG?: Record<string, unknown>;',
      '  /** Additional AI parameters passed through to the platform. */',
      '  [key: string]: unknown;',
    ].join('\n'),
    isOptional: true,
  },
  play: {
    interfaceName: 'PlayVerbConfig',
    interfaceBody: [
      '  /** Single URL to play (mutually exclusive with urls). */',
      '  url?: string;',
      '  /** Array of URLs to play (mutually exclusive with url). */',
      '  urls?: string[];',
      '  /** Volume level for audio playback. Valid range -40 to 40. Default 0. */',
      '  volume?: number;',
      '  /** Voice name to use for text-to-speech (e.g. "Polly.Joanna"). */',
      '  say_voice?: string;',
      '  /** Language code for text-to-speech (e.g. "en-US"). */',
      '  say_language?: string;',
      '  /** Gender for text-to-speech ("male" or "female"). */',
      '  say_gender?: string;',
      '  /** If true, auto-answer the call before playing audio. Default true. */',
      '  auto_answer?: boolean;',
    ].join('\n'),
    isOptional: true,
  },
};

/** Generate the interface for a verb's config parameter. */
function generateVerbConfig(
  verbName: string,
  innerSchema: SchemaProperty,
): { configType: string; isOptional: boolean } {
  // Some verbs have non-object inner types (e.g. "label" is a string, "sleep" is anyOf)
  if (!innerSchema.type && !innerSchema.anyOf && !innerSchema.oneOf && !innerSchema.properties) {
    // No type info at all (like "return") — accept any
    return { configType: 'unknown', isOptional: true };
  }

  // String type (e.g. "label")
  if (innerSchema.type === 'string') {
    return { configType: 'string', isOptional: false };
  }

  // anyOf (e.g. "sleep" which accepts int or object)
  if (innerSchema.anyOf && innerSchema.type !== 'object') {
    return { configType: 'Record<string, unknown> | number', isOptional: false };
  }

  // oneOf with $ref (e.g. "play")
  if (innerSchema.oneOf) {
    return { configType: 'Record<string, unknown>', isOptional: false };
  }

  // Standard object with properties
  if (innerSchema.type === 'object' && innerSchema.properties) {
    const props = innerSchema.properties;
    const required = new Set(innerSchema.required ?? []);
    const widenProps = WIDEN_TO_STRING[verbName] ?? new Set<string>();
    const lines: string[] = [];

    for (const [propName, propDef] of Object.entries(props)) {
      const tsType = mapType(propDef, { widenStringEnum: widenProps.has(propName) });
      const opt = required.has(propName) ? '' : '?';
      const desc = propDef.description
        ? ` /** ${propDef.description.replace(/\n/g, ' ').replace(/\*\//g, '* /')} */\n    `
        : '';
      lines.push(`${desc}${propName}${opt}: ${tsType}`);
    }

    if (lines.length === 0) {
      // Object type but no props — accept empty config
      return { configType: 'Record<string, unknown>', isOptional: true };
    }

    const hasRequired = required.size > 0;
    const configType = `{ ${lines.join('; ')} }`;
    return { configType, isOptional: !hasRequired };
  }

  // Object type with no properties defined
  if (innerSchema.type === 'object') {
    return { configType: 'Record<string, unknown>', isOptional: true };
  }

  // Fallback
  return { configType: 'Record<string, unknown>', isOptional: true };
}

function generate(): void {
  const schemaPath = join(__dirname, 'schema.json');
  const outputPath = join(__dirname, 'SwmlVerbMethods.generated.ts');

  const schema: Schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const defs = schema.$defs;
  const swmlMethod = defs['SWMLMethod'];

  if (!swmlMethod?.anyOf) {
    throw new Error('Schema missing $defs/SWMLMethod.anyOf');
  }

  const methods: string[] = [];

  for (const ref of swmlMethod.anyOf) {
    const refPath = ref.$ref;
    if (!refPath) continue;

    const schemaName = refPath.split('/').pop()!;
    const verbDef = defs[schemaName];
    if (!verbDef?.properties) continue;

    const propNames = Object.keys(verbDef.properties);
    if (propNames.length === 0) continue;

    const verbName = propNames[0];
    const innerSchema = verbDef.properties[verbName] as SchemaProperty;

    // Get description
    const desc = innerSchema.description ?? `Add the ${verbName} verb to the document.`;
    const cleanDesc = desc.replace(/\n/g, ' ').replace(/\*\//g, '* /');

    // Special handling for sleep
    if (verbName === 'sleep') {
      methods.push(`    /** ${cleanDesc} */`);
      methods.push(`    sleep(durationOrConfig: number | { duration: number }): this;`);
      continue;
    }

    // Special handling for label (takes a string directly)
    if (innerSchema.type === 'string') {
      methods.push(`    /** ${cleanDesc} */`);
      methods.push(`    ${verbName}(value: string): this;`);
      continue;
    }

    // Use custom typed interface if defined for this verb (e.g. ai, play)
    if (CUSTOM_VERB_TYPES[verbName]) {
      const { interfaceName, isOptional } = CUSTOM_VERB_TYPES[verbName];
      const paramSig = isOptional ? `config?: ${interfaceName}` : `config: ${interfaceName}`;
      methods.push(`    /** ${cleanDesc} */`);
      methods.push(`    ${verbName}(${paramSig}): this;`);
      continue;
    }

    const { configType, isOptional } = generateVerbConfig(verbName, innerSchema);
    const paramSig = isOptional ? `config?: ${configType}` : `config: ${configType}`;

    methods.push(`    /** ${cleanDesc} */`);
    methods.push(`    ${verbName}(${paramSig}): this;`);
  }

  // Collect custom interface definitions to emit before the module augmentation
  const customInterfaces = Object.values(CUSTOM_VERB_TYPES)
    .map(({ interfaceName, interfaceBody }) =>
      `export interface ${interfaceName} {\n${interfaceBody}\n}`)
    .join('\n\n');

  const output = `/**
 * AUTO-GENERATED FILE — do not edit manually.
 * Generated by: npx tsx src/generateVerbTypes.ts
 *
 * Provides TypeScript interface augmentation for all SWML verb methods
 * auto-installed on SwmlBuilder from schema.json.
 */

/* eslint-disable @typescript-eslint/no-empty-interface */

${customInterfaces}

declare module './SwmlBuilder.js' {
  interface SwmlBuilder {
${methods.join('\n')}
  }
}

export {};
`;

  writeFileSync(outputPath, output, 'utf-8');
  const verbCount = methods.filter(l => l.includes('): this;')).length;
  console.log(`Generated ${outputPath} with ${verbCount} verb methods.`);
}

generate();
