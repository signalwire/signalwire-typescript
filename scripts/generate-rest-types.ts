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

// Schema names can contain dots / non-identifier chars (e.g.
// "Types.StatusCodes.StatusCode400"); turn them into a valid TS identifier,
// stable across runs.
function tsName(rawName: string): string {
  const cleaned = rawName.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `Schema_${cleaned}`;
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
  // additionalProperties on a property-bearing object → index signature
  const ap = schema.additionalProperties ?? schema.unevaluatedProperties;
  if (ap === true) lines.push(`${pad}[key: string]: unknown;`);
  else if (ap && typeof ap === 'object')
    lines.push(`${pad}[key: string]: ${tsType(ap, indent + 1)};`);
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

function operationAliases(doc: OpenApiDoc): string[] {
  const out: string[] = [];
  for (const ops of Object.values(doc.paths ?? {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      if (!op.operationId) continue;
      const base = pascal(op.operationId);
      const reqSchema = schemaFromContent(op.requestBody?.content);
      if (reqSchema) out.push(`export type ${base}Request = ${tsType(reqSchema, 0)};\n`);
      const ok = op.responses?.['200'] ?? op.responses?.['201'] ?? op.responses?.['2XX'];
      const resSchema = schemaFromContent(ok?.content);
      if (resSchema) out.push(`export type ${base}Response = ${tsType(resSchema, 0)};\n`);
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

function resolvePortingSdk(): string {
  const env = process.env.PORTING_SDK ?? process.env.PORTING_SDK_PATH;
  if (env && fs.existsSync(path.join(env, 'rest-apis'))) return env;
  const sibling = path.resolve(process.cwd(), '..', 'porting-sdk');
  if (fs.existsSync(path.join(sibling, 'rest-apis'))) return sibling;
  throw new Error('porting-sdk not found (set $PORTING_SDK or clone adjacent)');
}

function generateForSpec(specPath: string, outPath: string, ns: string): number {
  const doc = yaml.load(fs.readFileSync(specPath, 'utf-8')) as OpenApiDoc;
  const schemas = doc.components?.schemas ?? {};
  const decls = Object.entries(schemas).map(([n, s]) => declaration(n, s));
  const ops = operationAliases(doc);
  const header = `// AUTO-GENERATED from porting-sdk/rest-apis/${ns}/openapi.yaml — DO NOT EDIT.\n// Regenerate with: npx tsx scripts/generate-rest-types.ts\n//\n// Held to the same lint bar as hand-written source (no rule suppressions, no\n// loose types). If the generator cannot emit a clean faithful type, fix the\n// generator rather than weaken the output.\n\n`;
  fs.writeFileSync(outPath, header + decls.join('\n') + '\n' + ops.join('\n'));
  return decls.length + ops.length;
}

function main(): void {
  const psdk = resolvePortingSdk();
  // spec dir (under rest-apis/) → output .generated.ts path
  const map: Record<string, string> = {
    datasphere: 'src/rest/namespaces/datasphere.types.generated.ts',
    // The SWML/SWAIG webhook contracts (manufactured spec from swml.md prose —
    // no upstream OpenAPI) live alongside the others and generate the platform
    // contract types that were previously hand-written in PlatformContracts.ts.
    'swml-webhooks': 'src/PlatformContracts.generated.ts',
    // (the rest get added as we roll out)
  };
  for (const [specDir, outPath] of Object.entries(map)) {
    const specPath = path.join(psdk, 'rest-apis', specDir, 'openapi.yaml');
    const n = generateForSpec(specPath, outPath, specDir);
    console.log(`generated ${outPath} (${n} types)`);
  }
}

main();
