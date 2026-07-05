/**
 * generate-swml-verbs.ts — typed SWML verb CONFIG + platform-contract type
 * generator.
 *
 * Emits two committed modules:
 *   - src/swml_verbs_generated.ts — the typed SWML verb CONFIG surface from
 *     porting-sdk/schema.json ($defs): one interface per $defs schema plus the
 *     flattened <Verb>Config payload shapes (SWMLMethod.anyOf walk).
 *   - src/PlatformContracts.generated.ts — the SWML/CXML webhook platform contract
 *     types from porting-sdk/rest-apis/swml-webhooks/openapi.yaml (a manufactured
 *     spec from swml.md prose; these were previously hand-written in
 *     PlatformContracts.ts). This is a SWML/platform surface (inbound webhook
 *     payloads the platform POSTs to a SWML/cXML app), so it lives with the SWML
 *     verb config here — not with the REST resource generator.
 *
 * The complementary verb METHOD surface (the chainable `builder.ai(...)` methods)
 * is src/SwmlVerbMethods.generated.ts, produced by a separate legacy generator
 * (`npm run generate:verbs`) — this script does NOT emit it.
 *
 * Run: `npx tsx scripts/generate-swml-verbs.ts` (`--check` = the GEN-FRESH-SWML
 * gate: exit non-zero if either committed file is stale).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
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
  const header = `// AUTO-GENERATED from porting-sdk/rest-apis/swml-webhooks/openapi.yaml — DO NOT EDIT.\n// Regenerate with: npx tsx scripts/generate-rest-types.ts\n//\n// Held to the same lint bar as hand-written source (no rule suppressions, no\n// loose types). If the generator cannot emit a clean faithful type, fix the\n// generator rather than weaken the output.\n\n`;
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
    `// Regenerate with: npx tsx scripts/generate-rest-types.ts\n//\n` +
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

async function main(): Promise<void> {
  const psdk = resolvePortingSdk();
  // Fail-soft: porting-sdk is only adjacent in dev/CI (not in a published
  // consumer's node_modules). The generated files are committed, so when the spec
  // source isn't resolvable we skip regeneration rather than erroring.
  if (!psdk) {
    if (CHECK) {
      console.error(
        'generate-swml-verbs --check: porting-sdk not found — cannot verify generated-type ' +
          'freshness (set $PORTING_SDK or clone adjacent).',
      );
      process.exit(2);
    }
    console.log(
      'generate-swml-verbs: porting-sdk not found (set $PORTING_SDK or clone adjacent) — ' +
        'skipping; using committed src/swml_verbs_generated.ts + src/PlatformContracts.generated.ts.',
    );
    return;
  }
  const verb = CHECK ? 'checked' : 'generated';

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
  // stays in the committed src/SwmlVerbMethods.generated.ts (separate generator).
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
