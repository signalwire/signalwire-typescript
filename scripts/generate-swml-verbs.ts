/**
 * generate-swml-verbs.ts — the single canonical SWML-surface generator: typed
 * verb CONFIG types, the chainable verb METHOD augmentation, and the SWML/cXML
 * platform-contract types.
 *
 * Emits three committed modules:
 *   - src/swml_verbs_generated.ts — the typed SWML verb CONFIG surface from
 *     porting-sdk/schema.json ($defs): one interface per $defs schema plus the
 *     flattened <Verb>Config payload shapes (SWMLMethod.anyOf walk).
 *   - src/SwmlVerbMethods.generated.ts — the chainable verb METHOD surface (a
 *     `declare module './SwmlBuilder.js'` augmentation typing `builder.ai(...)`
 *     etc.), from src/schema.json. Folded in from the former standalone
 *     src/generateVerbTypes.ts so ALL SWML output is produced (and freshness-
 *     gated) by this one command — no ungated generator left behind.
 *   - src/PlatformContracts.generated.ts — the SWML/CXML webhook platform contract
 *     types from porting-sdk/rest-apis/swml-webhooks/openapi.yaml (a manufactured
 *     spec from swml.md prose; these were previously hand-written in
 *     PlatformContracts.ts). This is a SWML/platform surface (inbound webhook
 *     payloads the platform POSTs to a SWML/cXML app), so it lives with the SWML
 *     verb config here — not with the REST resource generator.
 *
 * Run: `npx tsx scripts/generate-swml-verbs.ts` (`--check` = the GEN-FRESH-SWML
 * gate: exit non-zero if any of the three committed files is stale).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import {
  CHECK,
  OpenApiDoc,
  Schema,
  declaration,
  emitFile,
  finalizeCheck,
  flattenUnion,
  formatTs,
  objectBody,
  pascal,
  resolvePortingSdk,
  tsName,
  tsType,
} from './_gen-common.js';

// ---- swml-webhooks → PlatformContracts (OpenAPI components + op aliases) ----

function schemaFromContent(content?: Record<string, { schema?: Schema }>): Schema | undefined {
  if (!content) return undefined;
  return (content['application/json'] ?? Object.values(content)[0])?.schema;
}

function operationAliases(doc: OpenApiDoc, taken: Set<string>): string[] {
  const out: string[] = [];
  // emit an alias only if the name is not already a declared schema (a spec that
  // names its request body `CreateApplicationRequest` AND has a create_application
  // op would otherwise declare the identifier twice). `taken` accumulates within
  // the run so two ops can't collide either.
  const emit = (name: string, expr: string): void => {
    if (taken.has(name)) return;
    taken.add(name);
    out.push(`export type ${name} = ${expr};\n`);
  };
  // A request/response that is a bare `$ref` to a named schema already has a
  // surface symbol under that schema's name (which the Python reference also emits
  // and surfaces). An operationId-derived alias (`ListVoiceLogsResponse =
  // LogListResponse`) would just be a SECOND name for the identical type — surface
  // noise the reference doesn't carry. Emit the operation alias ONLY when the
  // request/response schema is inline (no `$ref`), i.e. when the alias is the only
  // name that shape has. (Verified: every spec's op request/response is a bare
  // `$ref`, so today this suppresses all redundant aliases; an inline op body would
  // still get its operation-named type.)
  const isBareRef = (schema: Schema | undefined): boolean =>
    !!schema && typeof schema.$ref === 'string';
  for (const ops of Object.values(doc.paths ?? {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      if (!op.operationId) continue;
      const base = pascal(op.operationId);
      const reqSchema = schemaFromContent(op.requestBody?.content);
      if (reqSchema && !isBareRef(reqSchema)) emit(`${base}Request`, tsType(reqSchema, 0));
      const ok = op.responses?.['200'] ?? op.responses?.['201'] ?? op.responses?.['2XX'];
      const resSchema = schemaFromContent(ok?.content);
      if (resSchema && !isBareRef(resSchema)) emit(`${base}Response`, tsType(resSchema, 0));
    }
  }
  return out;
}

async function generatePlatformContracts(specPath: string, outPath: string): Promise<number> {
  const doc = yaml.load(fs.readFileSync(specPath, 'utf-8')) as OpenApiDoc;
  const schemas = doc.components?.schemas ?? {};
  const taken = new Set(Object.keys(schemas).map(tsName));
  const decls = Object.entries(schemas).map(([n, s]) => declaration(n, s));
  const ops = operationAliases(doc, taken);
  const header = `// AUTO-GENERATED from porting-sdk/rest-apis/swml-webhooks/openapi.yaml — DO NOT EDIT.\n// Regenerate with: npx tsx scripts/generate-swml-verbs.ts\n//\n// Held to the same lint bar as hand-written source (no rule suppressions, no\n// loose types). If the generator cannot emit a clean faithful type, fix the\n// generator rather than weaken the output.\n\n`;
  const formatted = await formatTs(header + decls.join('\n') + '\n' + ops.join('\n'), outPath);
  emitFile(outPath, formatted);
  return decls.length + ops.length;
}

// ---- SWML verb config types (schema.json $defs) ----------------------------

/**
 * Open-shaped declaration for a SWML $defs schema: like the read-side SWAIG
 * payloads, every field is optional (drop `required`) and every named object type
 * carries a top-level `[key: string]: unknown` tail so unmodeled server keys
 * round-trip (mirrors the Python TypedDict `total=False` + open-shape contract).
 * Optionality is invisible to the cross-port oracle — the enumerator records a
 * field's WRITTEN type node, so `params?: AIParams` still reads as `class:AIParams`
 * exactly like Python's `total=False` `params: AIParams`.
 */
function swmlDeclaration(name: string, schema: Schema): string {
  const doc = schema.description ? `/** ${schema.description.split('\n')[0]} */\n` : '';
  const isObject =
    (schema.type === 'object' || (!schema.type && schema.properties)) &&
    !schema.oneOf &&
    !schema.anyOf &&
    !schema.allOf;
  if (isObject && schema.properties) {
    const open: Schema = { ...schema, required: [], additionalProperties: true };
    return `${doc}export interface ${tsName(name)} ${objectBody(open, 0, true)}\n`;
  }
  return `${doc}export type ${tsName(name)} = ${tsType(schema, 0)};\n`;
}

/**
 * Typed SWML verb CONFIG surface from porting-sdk/schema.json ($defs). Mirrors the
 * Python generator's `generate_swml_verbs`: emit one declaration per $defs schema
 * (object-with-props → interface; everything else → a type alias) so every $ref
 * resolves, plus the flattened `<Verb>Config` interfaces produced by walking
 * `$defs.SWMLMethod.anyOf` (each wrapper's single property is the verb, whose inner
 * oneOf/object schema flattens into a `<Verb>Config`). The `$ref`/`oneOf` follows
 * and the x-sdk markup is honored by tsType — no hardcoded per-verb tables.
 *
 * This is the CONFIG TYPE surface (the `<Config>` payload shapes); the verb METHOD
 * surface (the chainable `builder.ai(...)` methods) is the complementary, already-
 * committed src/SwmlVerbMethods.generated.ts module augmentation. Python co-locates
 * both in swml_verbs_generated.py with a `_SwmlVerbs` method class; here the method
 * surface lives in its own module, so this file carries only the config decls (the
 * `_SwmlVerbs` class is `_`-prefixed and never part of the cross-port oracle). Held
 * to the same lint bar as hand-written source.
 *
 * `handWritten` names the verbs THIS port hand-writes with richer ergonomics; they
 * are excluded from the verb walk so their `<Verb>Config` is not flattened (matching
 * the Python reference, which excludes the same set). This only affects which Config
 * decls are emitted — every $defs schema is still emitted unconditionally.
 */
async function generateSwmlVerbs(
  schemaPath: string,
  outPath: string,
  handWritten: ReadonlySet<string>,
): Promise<number> {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as {
    $defs?: Record<string, Schema>;
  };
  const defs = schema.$defs ?? {};
  // The shared resolveRef/flattenSchema/flattenUnion walk a pointer string against
  // the doc root generically, so `#/$defs/<Name>` resolves the same way `#/components
  // /schemas/<Name>` does — the `{ $defs }` root just needs to carry that key. The
  // OpenApiDoc cast is only to satisfy those helpers' parameter type.
  const doc = { $defs: defs } as unknown as OpenApiDoc;

  const decls: string[] = [];
  // 1. One declaration per $defs schema (so every $ref resolves).
  for (const [name, sch] of Object.entries(defs)) {
    if (sch && typeof sch === 'object') decls.push(swmlDeclaration(name, sch));
  }

  // 2. Walk SWMLMethod.anyOf → flatten each non-hand-written verb's inner schema
  //    into a <Verb>Config interface (only when the inner is a oneOf/object-with-
  //    props and has no direct $ref; a $ref inner already names a declared type).
  const swmlMethod = defs.SWMLMethod ?? {};
  for (const ref of swmlMethod.anyOf ?? []) {
    const wrapperName = (ref.$ref ?? '').split('/').pop() ?? '';
    const wdef = defs[wrapperName] ?? {};
    const propNames = Object.keys(wdef.properties ?? {});
    if (propNames.length === 0) continue;
    const verb = propNames[0];
    if (handWritten.has(verb)) continue;
    const inner = wdef.properties![verb];
    if (inner.type === 'string' || inner.$ref) continue;
    const hasInlineProps = inner.type === 'object' && inner.properties;
    if (!inner.oneOf && !hasInlineProps) continue;
    const { props } = flattenUnion(doc, inner);
    if (Object.keys(props).length === 0) continue;
    const cfgName = pascal(verb) + 'Config';
    const desc = (inner.description ?? `Add the ${verb} verb.`).split('\n')[0].trim();
    decls.push(swmlDeclaration(cfgName, { type: 'object', properties: props, description: desc }));
  }

  const header =
    `// AUTO-GENERATED from porting-sdk/schema.json ($defs) — DO NOT EDIT.\n` +
    `// Regenerate with: npx tsx scripts/generate-swml-verbs.ts\n//\n` +
    `// The typed SWML verb CONFIG surface: one interface per schema.json $defs entry\n` +
    `// (object → interface; non-object → type alias) + the flattened <Verb>Config\n` +
    `// payload shapes. These are the config payloads the SwmlBuilder verb methods\n` +
    `// accept; the chainable verb METHODS live in SwmlVerbMethods.generated.ts. Open-\n` +
    `// shaped: every field optional and every named type carries a [key: string]:\n` +
    `// unknown tail so unmodeled server keys round-trip. Held to the same lint bar as\n` +
    `// hand-written source (no rule suppressions, no loose types).\n\n`;
  const formatted = await formatTs(header + decls.join('\n'), outPath);
  emitFile(outPath, formatted);
  return decls.length;
}

// ---- SWML verb METHOD augmentation (SwmlVerbMethods.generated.ts) -----------
//
// Folded in verbatim from the former standalone src/generateVerbTypes.ts so the
// whole SWML surface is one canonical, freshness-gated generator. This emits the
// `declare module './SwmlBuilder.js'` augmentation that types the auto-vivified
// `builder.<verb>(...)` chainable methods for IDE autocomplete. It has its own
// self-contained type→TS mapping (distinct from the config-surface machinery
// above: the config surface is open-shaped payload TYPES; this is the METHOD
// signatures) plus a few verb-specific ergonomic overrides (AiVerbConfig /
// PlayVerbConfig / say_gender union / hangup.reason widening). Reads
// src/schema.json (the vendored copy this port ships), formatted through the
// repo prettier config so the raw emit is formatter-clean by construction (fixes
// the former GEN-FRESH-vs-FMT staleness the standalone generator's un-prettied
// output caused).

interface VerbSchemaProperty {
  type?: string;
  anyOf?: VerbSchemaProperty[];
  oneOf?: VerbSchemaProperty[];
  $ref?: string;
  properties?: Record<string, VerbSchemaProperty>;
  required?: string[];
  description?: string;
  items?: VerbSchemaProperty;
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  format?: string;
  enum?: unknown[];
}

/**
 * Map JSON Schema type to TypeScript type string.
 * @param prop - The schema property to map.
 * @param opts - Optional per-property overrides.
 */
function mapVerbType(prop: VerbSchemaProperty, opts?: { widenStringEnum?: boolean }): string {
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
    if (
      opts?.widenStringEnum &&
      prop.anyOf.every((p) => p.const !== undefined && typeof p.const === 'string')
    ) {
      return 'string';
    }
    const types = prop.anyOf
      .map((p) => mapVerbType(p, opts))
      .filter((t, i, arr) => arr.indexOf(t) === i); // deduplicate
    // Filter out 'unknown' from SWMLVar refs if there are concrete types
    const concreteTypes = types.filter((t) => t !== 'unknown');
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
        const itemType = mapVerbType(prop.items);
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
 * The TTS-gender literal union, emitted INLINE (no import) so the generated
 * file stays self-contained. It mirrors `TtsGender` in `relay/closedSets.ts`:
 * the `'male' | 'female'` CLOSED literal union — autocomplete + typo-checking,
 * with an off-spec value a compile error. Types erase, so the wire value is
 * identical to a bare string (parity with Python's `gender: str`); closing the
 * type changes what the compiler accepts, not a wire byte. Consistent with the
 * RELAY gender, which is also closed (see PORT_PHILOSOPHY_TYPESCRIPT.md).
 */
const SAY_GENDER_TYPE = `'male' | 'female'`;

/**
 * Properties to type as the {@link SAY_GENDER_TYPE} TTS-gender union instead of
 * the schema's bare `string`. Keyed by verbName → set of property names.
 * `play` is handled via its CUSTOM_VERB_TYPES body, so only the generic-path
 * verbs (e.g. `prompt`) need an entry here.
 */
const TYPE_AS_SAY_GENDER: Record<string, Set<string>> = {
  prompt: new Set(['say_gender']),
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
const CUSTOM_VERB_TYPES: Record<
  string,
  { interfaceName: string; interfaceBody: string; isOptional: boolean }
> = {
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
      '  /** Gender for text-to-speech. The `"male" | "female"` literals are autocompleted and typo-checked; any other string value is also accepted. */',
      `  say_gender?: ${SAY_GENDER_TYPE};`,
      '  /** If true, auto-answer the call before playing audio. Default true. */',
      '  auto_answer?: boolean;',
    ].join('\n'),
    isOptional: true,
  },
};

/** Generate the interface for a verb's config parameter. */
function generateVerbConfig(
  verbName: string,
  innerSchema: VerbSchemaProperty,
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
    const sayGenderProps = TYPE_AS_SAY_GENDER[verbName] ?? new Set<string>();
    const lines: string[] = [];

    for (const [propName, propDef] of Object.entries(props)) {
      const tsTypeStr = sayGenderProps.has(propName)
        ? SAY_GENDER_TYPE
        : mapVerbType(propDef, { widenStringEnum: widenProps.has(propName) });
      const opt = required.has(propName) ? '' : '?';
      const desc = propDef.description
        ? ` /** ${propDef.description.replace(/\n/g, ' ').replace(/\*\//g, '* /')} */\n    `
        : '';
      lines.push(`${desc}${propName}${opt}: ${tsTypeStr}`);
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

/**
 * Emit the SwmlBuilder verb-method augmentation from `schemaPath` (src/schema.json).
 * Formatted through the repo prettier config so raw emit is formatter-clean.
 */
async function generateVerbMethods(schemaPath: string, outPath: string): Promise<number> {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as {
    $defs: Record<string, VerbSchemaProperty>;
  };
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

    const verbName = propNames[0]!; // length === 0 continues above
    const innerSchema = verbDef.properties[verbName];

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
    const customVerbType = CUSTOM_VERB_TYPES[verbName];
    if (customVerbType) {
      const { interfaceName, isOptional } = customVerbType;
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
    .map(
      ({ interfaceName, interfaceBody }) =>
        `export interface ${interfaceName} {\n${interfaceBody}\n}`,
    )
    .join('\n\n');

  const output = `/**
 * AUTO-GENERATED FILE — do not edit manually.
 * Generated by: npx tsx scripts/generate-swml-verbs.ts
 *
 * Provides TypeScript interface augmentation for all SWML verb methods
 * auto-installed on SwmlBuilder from schema.json.
 */

${customInterfaces}

declare module './SwmlBuilder.js' {
  interface SwmlBuilder {
${methods.join('\n')}
  }
}

export {};
`;

  const formatted = await formatTs(output, outPath);
  emitFile(outPath, formatted);
  return methods.filter((l) => l.includes('): this;')).length;
}

async function main(): Promise<void> {
  const verb = CHECK ? 'checked' : 'generated';

  // The SWML verb METHOD augmentation (SwmlVerbMethods.generated.ts) is built from
  // src/schema.json — the port's own vendored copy, resolved relative to this
  // script — so it is ALWAYS available (independent of whether porting-sdk is
  // adjacent) and is always freshness-gated, unlike the former standalone
  // generator that had no --check.
  const vendoredSchema = path.join(
    fileURLToPath(new URL('.', import.meta.url)),
    '..',
    'src',
    'schema.json',
  );
  if (fs.existsSync(vendoredSchema)) {
    const methodsOut = 'src/SwmlVerbMethods.generated.ts';
    const n = await generateVerbMethods(vendoredSchema, methodsOut);
    console.log(`${verb} ${methodsOut} (${n} verb methods)`);
  } else {
    throw new Error(`SWML verb methods: vendored schema not found at ${vendoredSchema}`);
  }

  const psdk = resolvePortingSdk();
  // Fail-soft: porting-sdk is only adjacent in dev/CI (not in a published
  // consumer's node_modules). The remaining generated files are committed, so when
  // the spec source isn't resolvable we skip their regeneration rather than
  // erroring (the verb-method augmentation above already ran + gated from the
  // vendored schema).
  if (!psdk) {
    if (CHECK) {
      finalizeCheck('npx tsx scripts/generate-swml-verbs.ts');
      console.error(
        'generate-swml-verbs --check: porting-sdk not found — verified the vendored-schema ' +
          'verb methods, but cannot verify the schema.json config + platform contracts ' +
          '(set $PORTING_SDK or clone adjacent).',
      );
      process.exit(2);
    }
    console.log(
      'generate-swml-verbs: porting-sdk not found (set $PORTING_SDK or clone adjacent) — ' +
        'skipping schema.json config + platform contracts; using committed ' +
        'src/swml_verbs_generated.ts + src/PlatformContracts.generated.ts.',
    );
    return;
  }

  // The SWML/CXML webhook platform contracts (manufactured spec from swml.md prose
  // — no upstream OpenAPI). Skipped cleanly if the spec dir is absent.
  const platformSpec = path.join(psdk, 'rest-apis', 'swml-webhooks', 'openapi.yaml');
  if (fs.existsSync(platformSpec)) {
    const platformOut = 'src/PlatformContracts.generated.ts';
    const n = await generatePlatformContracts(platformSpec, platformOut);
    console.log(`${verb} ${platformOut} (${n} types)`);
  } else {
    console.log(
      `skipped platform contracts (no swml-webhooks spec at ${platformSpec}; ` +
        `using committed src/PlatformContracts.generated.ts).`,
    );
  }

  // Typed SWML verb CONFIG types from schema.json ($defs). The verb METHOD surface
  // (SwmlVerbMethods.generated.ts) was already emitted above from the vendored
  // src/schema.json.
  const swmlSchema = path.join(psdk, 'schema.json');
  if (fs.existsSync(swmlSchema)) {
    const swmlOut = 'src/swml_verbs_generated.ts';
    // Verbs this port hand-writes with richer ergonomics — excluded from the verb
    // walk so their <Verb>Config isn't flattened (matches the Python reference's
    // hand_written set; only affects which Config decls are emitted).
    const handWritten = new Set(['answer', 'hangup', 'ai', 'play', 'say']);
    const n = await generateSwmlVerbs(swmlSchema, swmlOut, handWritten);
    console.log(`${verb} ${swmlOut} (${n} types)`);
  } else {
    console.log(
      `skipped SWML verb contracts (no schema.json at ${swmlSchema}; ` +
        `using committed src/swml_verbs_generated.ts).`,
    );
  }

  finalizeCheck('npx tsx scripts/generate-swml-verbs.ts');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? `generate-swml-verbs: ${err.message}` : err);
  process.exit(1);
});
