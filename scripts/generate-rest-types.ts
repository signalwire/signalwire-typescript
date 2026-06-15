/**
 * generate-rest-types.ts — faithful OpenAPI-3.1 → TypeScript type generator for
 * the REST namespaces.
 *
 * For each porting-sdk/rest-apis/<ns>/openapi.yaml it emits
 * src/rest/namespaces/<ns>.types.generated.ts containing one exported type per
 * `components/schemas` entry (interfaces for objects, unions for oneOf/anyOf,
 * string-literal unions for enums, etc.), plus per-operation Request/Response
 * aliases keyed by operationId.
 *
 * The whole point: types are derived MECHANICALLY from the canonical spec, so
 * the KIND is correct by construction (a `type: string` field becomes `string`,
 * never `Record<string, unknown>`). The namespace .ts files import + apply these.
 *
 * Run: `npx tsx scripts/generate-rest-types.ts` (wired into prebuild). The specs
 * live in $PORTING_SDK/rest-apis (resolved like run-ci.sh).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import * as prettier from 'prettier';

// `--check` (the GEN-FRESH gate): regenerate in-memory and FAIL if any committed
// output differs from what the canonical schema produces — instead of writing.
// This is the real validator for the generated types' SHAPE: DRIFT can't check
// it (≈40% of the Python reference is `Any`, which matches any TS type), so the
// only thing proving the committed types still match their source is that they
// reproduce exactly from that source. Mirrors the SURFACE-FRESH gate.
const CHECK = process.argv.includes('--check');
const staleFiles: string[] = [];

/** Write `formatted` to `outPath`, or (in --check) record it as stale on mismatch. */
function emitFile(outPath: string, formatted: string): void {
  if (CHECK) {
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf-8') : '';
    if (current !== formatted) staleFiles.push(outPath);
    return;
  }
  fs.writeFileSync(outPath, formatted);
}

// ---- spec types (minimal) --------------------------------------------------

interface Schema {
  type?: string | string[];
  $ref?: string;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  enum?: unknown[];
  const?: unknown;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  unevaluatedProperties?: boolean | Schema;
  nullable?: boolean;
  description?: string;
  format?: string;
}

interface Operation {
  operationId?: string;
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, { content?: Record<string, { schema?: Schema }> }>;
}

interface OpenApiDoc {
  components?: { schemas?: Record<string, Schema> };
  paths?: Record<string, Record<string, Operation>>;
}

// ---- name sanitisation -----------------------------------------------------

// TS lib globals a schema name must not shadow — shadowing `Record` breaks every
// `Record<string, unknown>` the generator emits, etc. Colliding schema names get
// a `_` suffix; the rename is applied uniformly through tsName() so $ref
// resolution (refName) and declarations stay consistent.
const RESERVED_GLOBALS = new Set([
  'Record',
  'Array',
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Promise',
  'Map',
  'Set',
  'Date',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Function',
  'Error',
]);

// Schema names can contain dots / non-identifier chars (e.g.
// "Types.StatusCodes.StatusCode400"); turn them into a valid TS identifier,
// stable across runs.
function tsName(rawName: string): string {
  const cleaned = rawName.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '');
  const id = /^[A-Za-z_]/.test(cleaned) ? cleaned : `Schema_${cleaned}`;
  return RESERVED_GLOBALS.has(id) ? `${id}_` : id;
}

function refName(ref: string): string {
  return tsName(ref.replace('#/components/schemas/', ''));
}

// ---- schema → TS type expression ------------------------------------------

function tsType(schema: Schema | undefined, indent = 0): string {
  if (!schema) return 'unknown';

  if (schema.$ref) return refName(schema.$ref);

  // const → literal
  if (schema.const !== undefined) return JSON.stringify(schema.const);

  // enum → string/number-literal union
  if (schema.enum) {
    const lits = schema.enum.map((v) => (v === null ? 'null' : JSON.stringify(v)));
    return lits.join(' | ') || 'never';
  }

  // allOf: single ref (wrapper for description) → the ref; multiple → intersection
  if (schema.allOf && schema.allOf.length) {
    const parts = schema.allOf.map((s) => tsType(s, indent));
    return parts.length === 1 ? parts[0] : parts.map((p) => `(${p})`).join(' & ');
  }

  // oneOf / anyOf → union (null members collapse to `| null`)
  const union = schema.oneOf ?? schema.anyOf;
  if (union && union.length) {
    const parts = union.map((s) => tsType(s, indent));
    return [...new Set(parts)].join(' | ');
  }

  // explicit nullable on a typed schema
  const wrapNull = (t: string): string => (schema.nullable ? `${t} | null` : t);

  // type may be an array (e.g. ['string','null'])
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length > 1) {
    return types
      .map((t) => (t === 'null' ? 'null' : tsType({ ...schema, type: t, nullable: false }, indent)))
      .join(' | ');
  }
  const type = types[0];

  switch (type) {
    case 'string':
      return wrapNull('string');
    case 'integer':
    case 'number':
      return wrapNull('number');
    case 'boolean':
      return wrapNull('boolean');
    case 'null':
      return 'null';
    case 'array':
      return wrapNull(`${tsType(schema.items, indent)}[]`);
    case 'object':
    case undefined: {
      // object with known properties → inline interface body
      if (schema.properties) {
        return wrapNull(objectBody(schema, indent));
      }
      // free-form object → Record. additionalProperties may give a value type.
      const ap = schema.additionalProperties ?? schema.unevaluatedProperties;
      if (ap && typeof ap === 'object') return wrapNull(`Record<string, ${tsType(ap, indent)}>`);
      // a bare `type: object` with no shape, or no type at all → open record
      return wrapNull('Record<string, unknown>');
    }
    default:
      return 'unknown';
  }
}

function objectBody(schema: Schema, indent: number): string {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);
  const lines: string[] = [];
  for (const [key, propSchema] of Object.entries(props)) {
    const optional = required.has(key) ? '' : '?';
    const keyTok = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    if (propSchema.description) {
      lines.push(`${pad}/** ${propSchema.description.split('\n')[0]} */`);
    }
    lines.push(`${pad}${keyTok}${optional}: ${tsType(propSchema, indent + 1)};`);
  }
  // additionalProperties on a property-bearing object → index signature. TS
  // requires every declared property to be assignable to the index value, so the
  // index value must include each declared prop's type (and `undefined` when any
  // declared prop is optional). With no declared props this is just the ap type.
  const ap = schema.additionalProperties ?? schema.unevaluatedProperties;
  if (ap === true) lines.push(`${pad}[key: string]: unknown;`);
  else if (ap && typeof ap === 'object') {
    const base = tsType(ap, indent + 1);
    const propTypes = Object.values(props).map((p) => tsType(p, indent + 1));
    const hasOptional = Object.keys(props).some((k) => !required.has(k));
    const members = [base, ...propTypes, ...(hasOptional ? ['undefined'] : [])];
    const value = [...new Set(members)].join(' | ');
    lines.push(`${pad}[key: string]: ${value};`);
  }
  return `{\n${lines.join('\n')}\n${closePad}}`;
}

// ---- top-level declaration per schema --------------------------------------

function declaration(name: string, schema: Schema): string {
  const id = tsName(name);
  const doc = schema.description ? `/** ${schema.description.split('\n')[0]} */\n` : '';
  // object with properties → interface (extensible, readable)
  const isObject =
    (schema.type === 'object' || (!schema.type && schema.properties)) &&
    !schema.oneOf &&
    !schema.anyOf &&
    !schema.allOf;
  if (isObject && schema.properties) {
    return `${doc}export interface ${id} ${objectBody(schema, 0)}\n`;
  }
  return `${doc}export type ${id} = ${tsType(schema, 0)};\n`;
}

// ---- operation request/response aliases ------------------------------------

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
  for (const ops of Object.values(doc.paths ?? {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      if (!op.operationId) continue;
      const base = pascal(op.operationId);
      const reqSchema = schemaFromContent(op.requestBody?.content);
      if (reqSchema) emit(`${base}Request`, tsType(reqSchema, 0));
      const ok = op.responses?.['200'] ?? op.responses?.['201'] ?? op.responses?.['2XX'];
      const resSchema = schemaFromContent(ok?.content);
      if (resSchema) emit(`${base}Response`, tsType(resSchema, 0));
    }
  }
  return out;
}

function pascal(s: string): string {
  return s
    .split(/[_\-\s]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

// ---- driver ----------------------------------------------------------------

function resolvePortingSdk(): string | null {
  const env = process.env.PORTING_SDK ?? process.env.PORTING_SDK_PATH;
  if (env && fs.existsSync(path.join(env, 'rest-apis'))) return env;
  const sibling = path.resolve(process.cwd(), '..', 'porting-sdk');
  if (fs.existsSync(path.join(sibling, 'rest-apis'))) return sibling;
  return null;
}

async function generateForSpec(specPath: string, outPath: string, ns: string): Promise<number> {
  const doc = yaml.load(fs.readFileSync(specPath, 'utf-8')) as OpenApiDoc;
  const schemas = doc.components?.schemas ?? {};
  const taken = new Set(Object.keys(schemas).map(tsName));
  const decls = Object.entries(schemas).map(([n, s]) => declaration(n, s));
  const ops = operationAliases(doc, taken);
  const header = `// AUTO-GENERATED from porting-sdk/rest-apis/${ns}/openapi.yaml — DO NOT EDIT.\n// Regenerate with: npx tsx scripts/generate-rest-types.ts\n//\n// Held to the same lint bar as hand-written source (no rule suppressions, no\n// loose types). If the generator cannot emit a clean faithful type, fix the\n// generator rather than weaken the output.\n\n`;
  const raw = header + decls.join('\n') + '\n' + ops.join('\n');
  // Format through the repo's own prettier config so generated files pass the
  // FMT gate by construction (the gate is `prettier --check` in CI).
  const config = (await prettier.resolveConfig(outPath)) ?? {};
  const formatted = await prettier.format(raw, { ...config, parser: 'typescript' });
  emitFile(outPath, formatted);
  return decls.length + ops.length;
}

/**
 * RELAY WS protocol types. Unlike the REST namespaces (one OpenAPI doc with
 * components/schemas), the relay contracts are one standalone JSON-Schema file
 * per method+phase under porting-sdk/relay-protocol/ (extracted from the C#
 * switchblade wire classes — the canonical RELAY source). Emit one interface per
 * `*.params.json`, named from its `x-method` (e.g. calling.detect →
 * CallingDetectParams). The schemas are draft-2020-12 JSON Schema, which the same
 * tsType()/objectBody() machinery already handles.
 */
async function generateRelayProtocol(dir: string, outPath: string): Promise<number> {
  // Both phases: `.params.json` → <Method>Params (method inputs) and
  // `.result.json` → <Method>Result (JSON-RPC ack the method resolves to).
  const decls: string[] = [];
  for (const phase of ['params', 'result'] as const) {
    const suffix = phase === 'params' ? 'Params' : 'Result';
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(`.${phase}.json`))
      .sort();
    for (const f of files) {
      const schema = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Schema & {
        'x-method'?: string;
      };
      // calling.detect.stop → CallingDetectStopParams / CallingDetectStopResult
      const method = (schema['x-method'] ??
        f.replace(new RegExp(`\\.${phase}\\.json$`), '')) as string;
      const name = pascal(method.replace(/[.]/g, '_')) + suffix;
      decls.push(declaration(name, schema));
    }
  }
  const header =
    `// AUTO-GENERATED from porting-sdk/relay-protocol/*.{params,result}.json — DO NOT EDIT.\n` +
    `// Regenerate with: npx tsx scripts/generate-rest-types.ts\n//\n` +
    `// One interface per RELAY method's params (<Method>Params) and ack result\n` +
    `// (<Method>Result), from the canonical switchblade wire schemas. Held to the\n` +
    `// same lint bar as hand-written source (no rule suppressions, no loose types).\n\n`;
  const config = (await prettier.resolveConfig(outPath)) ?? {};
  const formatted = await prettier.format(header + decls.join('\n'), {
    ...config,
    parser: 'typescript',
  });
  emitFile(outPath, formatted);
  return decls.length;
}

async function main(): Promise<void> {
  const psdk = resolvePortingSdk();
  // Fail-soft: this runs in prebuild, but porting-sdk is only adjacent in dev/CI
  // (not in a published consumer's node_modules). The generated files are
  // committed, so when the spec source isn't resolvable we skip regeneration and
  // build against the committed outputs rather than erroring the build.
  if (!psdk) {
    if (CHECK) {
      // The freshness gate needs the canonical schemas to compare against; if
      // they aren't reachable we can't prove freshness, so fail loudly rather
      // than passing silently.
      console.error(
        'generate-rest-types --check: porting-sdk not found — cannot verify generated-type freshness ' +
          '(set $PORTING_SDK or clone adjacent).',
      );
      process.exit(2);
    }
    console.log(
      'generate-rest-types: porting-sdk not found (set $PORTING_SDK or clone adjacent) — ' +
        'skipping; using committed *.types.generated.ts.',
    );
    return;
  }
  // spec dir (under rest-apis/) → output .generated.ts path
  const map: Record<string, string> = {
    // The SWML/SWAIG webhook contracts (manufactured spec from swml.md prose —
    // no upstream OpenAPI) live alongside the others and generate the platform
    // contract types that were previously hand-written in PlatformContracts.ts.
    'swml-webhooks': 'src/PlatformContracts.generated.ts',
    // REST namespace specs → one generated module per spec. A namespace .ts file
    // imports the named schema/operation types it needs from its spec's module;
    // some specs back several namespace files (fabric → addresses/registry/…).
    calling: 'src/rest/namespaces/calling.types.generated.ts',
    chat: 'src/rest/namespaces/chat.types.generated.ts',
    compatibility: 'src/rest/namespaces/compatibility.types.generated.ts',
    datasphere: 'src/rest/namespaces/datasphere.types.generated.ts',
    fabric: 'src/rest/namespaces/fabric.types.generated.ts',
    fax: 'src/rest/namespaces/fax.types.generated.ts',
    logs: 'src/rest/namespaces/logs.types.generated.ts',
    message: 'src/rest/namespaces/message.types.generated.ts',
    project: 'src/rest/namespaces/project.types.generated.ts',
    pubsub: 'src/rest/namespaces/pubsub.types.generated.ts',
    'relay-rest': 'src/rest/namespaces/relay-rest.types.generated.ts',
    video: 'src/rest/namespaces/video.types.generated.ts',
    voice: 'src/rest/namespaces/voice.types.generated.ts',
  };
  const verb = CHECK ? 'checked' : 'generated';
  for (const [specDir, outPath] of Object.entries(map)) {
    const specPath = path.join(psdk, 'rest-apis', specDir, 'openapi.yaml');
    const n = await generateForSpec(specPath, outPath, specDir);
    console.log(`${verb} ${outPath} (${n} types)`);
  }

  // RELAY WS protocol params (separate source tree + format from the REST specs).
  const relayDir = path.join(psdk, 'relay-protocol');
  if (fs.existsSync(relayDir)) {
    const relayOut = 'src/relay/protocol.types.generated.ts';
    const n = await generateRelayProtocol(relayDir, relayOut);
    console.log(`${verb} ${relayOut} (${n} types)`);
  }

  if (CHECK && staleFiles.length) {
    console.error(
      `\nGEN-FRESH FAIL: ${staleFiles.length} generated file(s) are stale — ` +
        `they no longer match what the canonical schema produces. Run ` +
        `\`npx tsx scripts/generate-rest-types.ts\` and commit:`,
    );
    for (const f of staleFiles) console.error(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
