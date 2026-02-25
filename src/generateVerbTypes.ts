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

/** Map JSON Schema type to TypeScript type string. */
function mapType(prop: SchemaProperty): string {
  // Handle const values
  if (prop.const !== undefined) {
    return typeof prop.const === 'string' ? `'${prop.const}'` : String(prop.const);
  }

  // Handle $ref
  if (prop.$ref) {
    return 'unknown';
  }

  // Handle anyOf
  if (prop.anyOf) {
    const types = prop.anyOf
      .map(p => mapType(p))
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
    const lines: string[] = [];

    for (const [propName, propDef] of Object.entries(props)) {
      const tsType = mapType(propDef);
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

    const { configType, isOptional } = generateVerbConfig(verbName, innerSchema);
    const paramSig = isOptional ? `config?: ${configType}` : `config: ${configType}`;

    methods.push(`    /** ${cleanDesc} */`);
    methods.push(`    ${verbName}(${paramSig}): this;`);
  }

  const output = `/**
 * AUTO-GENERATED FILE — do not edit manually.
 * Generated by: npx tsx src/generateVerbTypes.ts
 *
 * Provides TypeScript interface augmentation for all SWML verb methods
 * auto-installed on SwmlBuilder from schema.json.
 */

/* eslint-disable @typescript-eslint/no-empty-interface */

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
