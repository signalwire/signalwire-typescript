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
    case 'array': {
      // Parenthesize a union/intersection item type before `[]` — otherwise
      // `A | B | C[]` binds as `A | B | (C[])` (only the last member an array)
      // instead of the intended `(A | B | C)[]`.
      const item = tsType(schema.items, indent);
      const needsParens = / [|&] /.test(item);
      return wrapNull(`${needsParens ? `(${item})` : item}[]`);
    }
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

function objectBody(schema: Schema, indent: number, topLevel = false): string {
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
  // additionalProperties:true → an open `[key: string]: unknown` index signature.
  // We emit it ONLY on the TOP-LEVEL declared type, NOT on nested inline objects:
  // an index signature on a property-bearing object silently swallows TYPOS in
  // known fields (`{ formt: 'mp3' }` compiles), and the nested objects are what
  // callers fill via indexed access — so closing them there is where the
  // typo-safety matters. The top-level type keeps the open tail for forward-
  // compatibility (a new server field round-trips). When additionalProperties is
  // a typed schema (not `true`), the index value must also include the declared
  // prop types so TS accepts them against the index (TS2411).
  const ap = schema.additionalProperties ?? schema.unevaluatedProperties;
  if (ap === true) {
    if (topLevel) lines.push(`${pad}[key: string]: unknown;`);
  } else if (ap && typeof ap === 'object') {
    const base = tsType(ap, indent + 1);
    const propTypes = Object.values(props).map((p) => tsType(p, indent + 1));
    const hasOptional = Object.keys(props).some((k) => !required.has(k));
    const members = [base, ...propTypes, ...(hasOptional ? ['undefined'] : [])];
    const value = [...new Set(members)].join(' | ');
    lines.push(`${pad}[key: string]: ${value};`);
  }
  // No declared members AND no emitted index signature → this is an open object
  // with nothing modeled. Emit `Record<string, unknown>` rather than a bare `{}`
  // (which `no-empty-object-type` flags and which means "any non-null value").
  if (lines.length === 0) return 'Record<string, unknown>';
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
    // topLevel=true: the open `[key: string]: unknown` tail is emitted here (the
    // named type) but suppressed on nested inline objects (see objectBody).
    return `${doc}export interface ${id} ${objectBody(schema, 0, true)}\n`;
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

// ===========================================================================
// Markup-driven resource generation (RULES.md §2–§8).
//
// Mirrors the Python reference generator
// (porting-sdk/scripts/generate_python_rest_types.py). The resource set is read
// from the spec's `x-sdk-resource` markup (NOT inferred from path structure):
// name / base / kind / collection / update_method / methods / set_methods /
// namespace / attr / aliases / exclude. Each resource becomes a typed class:
//   - CRUD bases (Crud/Read/Fabric) → a subclass bound to the resource's 4 (or 2)
//     spec types; the enumerator reads the binding as a `crud_base` so it matches
//     the Python reference structurally (CRUD create/update use the args-object
//     idiom — `create(body, extras?)`).
//   - declared `methods:` → typed operation methods (exploded body params, like
//     the Python reference, so per-method drift matches).
//   - `kind: command-dispatch` → one typed method per discriminator command.
//   - `set_methods` → typed `update()` wrappers binding a fixed handler value.
//
// TS-specific simplification: TypeScript has no reserved-word identifier problem
// (`from: string` is a valid param), so the Python `from_` / `_reserved_kw` /
// `**kwargs` machinery is skipped entirely — field names are emitted directly.
// ===========================================================================

// ---- the SDK base class each `x-sdk-bases` base maps to --------------------
// The spec declares the base CONTRACT (method-set); this maps the base NAME to
// the TS runtime base class. PUT vs PATCH is the per-resource `update_method`
// (the base reads `_updateMethod`), not a separate base. The `FabricResource*`
// pair carries the PUT/PATCH split because the fabric bases pre-date the shared
// `_updateMethod` switch; non-fabric resources use the plain Crud/Read bases.
const BASE_CLASS: Record<string, { import: string; module: string }> = {
  BaseResource: { import: 'BaseResource', module: '../base/BaseResource.js' },
  ReadResource: { import: 'ReadResource', module: '../base/ReadResource.js' },
  CrudResource: { import: 'CrudResource', module: '../base/CrudResource.js' },
  FabricResource: { import: 'FabricResource', module: '../base/FabricResource.js' },
};
// Bases that take no implicit CRUD methods and no type binding (the resource's
// whole surface is its declared `methods` / command-dispatch / set_methods).
const PLAIN_BASES = new Set(['BaseResource']);
// Bases bound by the read-only 2-tuple [TList, TItem] rather than the CRUD 4-tuple.
const READONLY_BASES = new Set(['ReadResource']);

interface XSdkResource {
  name: string;
  base: string;
  update_method?: string;
  collection?: string;
  kind?: string;
  request?: string;
  methods?: Record<string, { op?: string } | string>;
  set_methods?: Record<
    string,
    { handler?: string; args?: Record<string, { field?: string; required?: boolean }> }
  >;
  namespace?: string;
  attr?: string;
  aliases?: string[];
  exclude?: boolean | { exclude?: boolean; reason?: string };
}

interface ResourceRole {
  verb: string;
  reqRef: string;
  resRef: string;
}

function groupResources(doc: OpenApiDoc): Record<string, Record<string, ResourceRole>> {
  const resources: Record<string, Record<string, ResourceRole>> = {};
  for (const [p, ops] of Object.entries(doc.paths ?? {})) {
    const isItem = /\/\{[^}]+\}$/.test(p);
    const collection = p.replace(/\/\{[^}]+\}$/, '');
    for (const [method, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const reqRef = (op.requestBody?.content?.['application/json']?.schema as Schema)?.$ref ?? '';
      const ok = op.responses?.['200'] ?? op.responses?.['201'] ?? op.responses?.['2XX'];
      const resSchema = (ok?.content?.['application/json']?.schema ?? {}) as Schema;
      let resRef = resSchema.$ref ?? '';
      if (!resRef && resSchema.type === 'array') resRef = (resSchema.items as Schema)?.$ref ?? '';
      const role =
        method === 'get'
          ? isItem
            ? 'get'
            : 'list'
          : method === 'post'
            ? 'create'
            : method === 'put' || method === 'patch'
              ? 'update'
              : 'delete';
      (resources[collection] ??= {})[role] = { verb: method.toUpperCase(), reqRef, resRef };
    }
  }
  return resources;
}

function resolveRef(doc: OpenApiDoc, ref: string): Schema {
  let node: unknown = doc;
  for (const part of ref.replace('#/', '').split('/')) {
    node = (node as Record<string, unknown>)?.[part];
  }
  return (node ?? {}) as Schema;
}

function identityField(doc: OpenApiDoc, resRef: string): string {
  if (!resRef) return 'id';
  const flat = flattenSchema(doc, { $ref: resRef }).props;
  for (const k of Object.keys(flat)) {
    if (k.toLowerCase() === 'id' || k.toLowerCase() === 'sid') return k;
  }
  return 'id';
}

/** Resolve a (possibly $ref / allOf) object schema to its property map + required list. */
function flattenSchema(
  doc: OpenApiDoc,
  schema: Schema | undefined,
): { props: Record<string, Schema>; required: string[] } {
  if (!schema) return { props: {}, required: [] };
  let s = schema;
  if (s.$ref) s = resolveRef(doc, s.$ref);
  const props: Record<string, Schema> = {};
  const required: string[] = [];
  for (const sub of s.allOf ?? []) {
    const f = flattenSchema(doc, sub);
    Object.assign(props, f.props);
    required.push(...f.required);
  }
  Object.assign(props, s.properties ?? {});
  required.push(...(s.required ?? []));
  return { props, required };
}

/**
 * Like flattenSchema but also resolves an anyOf/oneOf UNION: the property set is
 * the union of the variants' properties (every reachable field becomes a typed
 * param); a field is required only if EVERY variant requires it. Used for
 * command-dispatch `params` (RULES §6) — the OPPOSITE of a CRUD union body.
 */
function flattenUnion(
  doc: OpenApiDoc,
  schema: Schema | undefined,
): { props: Record<string, Schema>; required: string[] } {
  if (!schema) return { props: {}, required: [] };
  let s = schema;
  if (s.$ref) s = resolveRef(doc, s.$ref);
  const base = flattenSchema(doc, s);
  const props = { ...base.props };
  const required = [...base.required];
  const variants = s.anyOf ?? s.oneOf;
  if (variants && variants.length) {
    const reqSets: Set<string>[] = [];
    for (const sub of variants) {
      const f = flattenUnion(doc, sub);
      Object.assign(props, f.props);
      reqSets.push(new Set(f.required));
    }
    if (reqSets.length) {
      const inter = [...reqSets[0]].filter((k) => reqSets.every((rs) => rs.has(k)));
      required.push(...inter);
    }
  }
  return { props, required };
}

/** The namespace URL-path prefix from `servers[0].url` (the path portion). */
function serverPrefix(doc: OpenApiDoc): string {
  const servers = (doc as { servers?: { url?: string }[] }).servers ?? [];
  const url = servers[0]?.url ?? '';
  // Strip scheme+host and `{var}` so we are left with a clean path.
  const cleaned = url.replace(/\{[^}]+\}/g, 'x');
  let p = '';
  try {
    p = new URL(cleaned).pathname;
  } catch {
    p = cleaned.replace(/^[a-z]+:\/\/[^/]+/i, '');
  }
  // Fail loud on a trailing slash (it would compose a double slash) — fix the spec.
  if (p !== '/' && p.endsWith('/')) {
    throw new Error(
      `servers[0].url has a trailing slash (${url}); remove it in the spec — it ` +
        `would compose a double slash with each resource's collection path`,
    );
  }
  return p;
}

function snakeCase(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .toLowerCase();
}

/** `list_streams` / `play.pause` → `listStreams` / `playPause` (TS method idiom). */
function camelCase(s: string): string {
  return s
    .replace(/[.\-]/g, '_')
    .replace(/_+([a-z0-9])/g, (_m, c: string) => c.toUpperCase())
    .replace(/^([A-Z])/, (_m, c: string) => c.toLowerCase());
}

const leafName = (ref: string): string => (ref ? tsName(ref.split('/').pop() as string) : '');

/**
 * The TS type expression for a method PARAMETER. An inline object-with-properties
 * (no `$ref`) would otherwise produce a structural `{ … }` literal the type
 * checker names `__type`; the Python reference renders such inline objects as
 * `dict[str, Any]`. Collapse them to `Record<string, unknown>` so the param TYPE
 * matches the reference (the wire payload is an open object either way).
 */
function paramType(schema: Schema | undefined): string {
  const isInlineObject = (s: Schema | undefined): boolean =>
    !!s &&
    !s.$ref &&
    !s.enum &&
    s.const === undefined &&
    !s.oneOf &&
    !s.anyOf &&
    !s.allOf &&
    (s.type === 'object' || (s.type === undefined && !!s.properties)) &&
    !!s.properties;
  if (isInlineObject(schema)) return 'Record<string, unknown>';
  // An array whose items are an inline object → `Record<string, unknown>[]` (the
  // reference renders `list[dict[str, Any]]`); other arrays follow tsType.
  if (schema && schema.type === 'array' && isInlineObject(schema.items)) {
    return 'Record<string, unknown>[]';
  }
  return tsType(schema);
}

/** A param identifier — a non-identifier wire key is reachable only via extras. */
function safeParam(key: string): string | null {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return null;
  return key;
}

// ---- find an operation by operationId --------------------------------------
function findOperation(
  doc: OpenApiDoc,
  opId: string,
): { path: string; method: string; op: Operation } | null {
  for (const [p, ops] of Object.entries(doc.paths ?? {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (op && typeof op === 'object' && op.operationId === opId) return { path: p, method, op };
    }
  }
  return null;
}

// ---- collect generated-type leaf names referenced by a type expression -----
function referencedTypes(ann: string, schemaNames: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const tok of ann.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
    if (schemaNames.has(tok)) out.add(tok);
  }
  return out;
}

interface ParamSpec {
  name: string;
  ann: string; // the TS type expression
  required: boolean;
}

/** Render leading positional path-id params + an exploded body (required-first). */
function renderSignature(
  pathArgs: string[],
  bodyParams: ParamSpec[],
  opts: { extras: boolean; query: boolean },
): string {
  const parts: string[] = [];
  for (const a of pathArgs) parts.push(`${a}: string`);
  const req = bodyParams.filter((p) => p.required);
  const opt = bodyParams.filter((p) => !p.required);
  for (const p of req) parts.push(`${p.name}: ${p.ann}`);
  for (const p of opt) parts.push(`${p.name}?: ${p.ann}`);
  if (opts.extras) parts.push('extras?: Record<string, unknown>');
  if (opts.query) parts.push('params?: QueryParams');
  return parts.join(', ');
}

/**
 * Assemble the runtime body/params object from exploded params: named optionals
 * are sent only when defined (the server applies its own default for unset
 * fields), then `extras` is merged. `varName` is `body` or `params`.
 */
function renderBodyAssembly(bodyParams: ParamSpec[], extras: boolean, varName = 'body'): string {
  if (bodyParams.length === 0) {
    return extras ? `    const ${varName}: Record<string, unknown> = { ...extras };\n` : '';
  }
  const entries = bodyParams.map((p) => `      ${p.name},`).join('\n');
  let src = `    const ${varName}: Record<string, unknown> = {};\n`;
  src += `    const _fields = {\n${entries}\n    };\n`;
  src += `    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) ${varName}[k] = v;\n`;
  if (extras) src += `    if (extras) Object.assign(${varName}, extras);\n`;
  return src;
}

/**
 * Emit one typed operation method (a declared `x-sdk-resource.methods` entry).
 * Path `{param}` segments → leading positional string args; an object body →
 * exploded typed params (+ extras); a union body → a single `body` param; a GET
 * with no body → a trailing `params?` query. Mirrors `_emit_operation_method`.
 */
function emitOperationMethod(
  doc: OpenApiDoc,
  collection: string,
  methodName: string,
  opId: string,
  prefix: string,
  schemaNames: Set<string>,
): { src: string; refs: Set<string>; needsQuery: boolean } {
  const found = findOperation(doc, opId);
  if (!found) {
    throw new Error(
      `x-sdk-resource on ${collection}: methods.${methodName} references operationId ` +
        `${opId} which is not in the spec`,
    );
  }
  const { path, method, op } = found;
  const httpVerb = method.toLowerCase();
  const refs = new Set<string>();

  // Path composition: UNDER-COLLECTION (compose the tail below the collection,
  // since `_path` is relative to `_basePath`) vs SIBLING (a different top-level
  // path → build the absolute, server-prefix-rooted path).
  const under = path.startsWith(collection);
  const rel = under ? path.slice(collection.length) : path;
  const segments = rel.split('/').filter(Boolean);
  const pathArgs: string[] = [];
  const pathParts: string[] = []; // args for this._path(...)
  const absParts: string[] = []; // pieces for a sibling absolute template
  for (const seg of segments) {
    const m = /^\{([^}]+)\}$/.exec(seg);
    if (m) {
      const arg = snakeCase(m[1]);
      pathArgs.push(arg);
      pathParts.push(arg);
      absParts.push('${' + arg + '}');
    } else {
      pathParts.push(JSON.stringify(seg));
      absParts.push(seg);
    }
  }

  // Response type.
  const responses = op.responses ?? {};
  const okRes = responses['200'] ?? responses['201'] ?? responses['2XX'] ?? {};
  const resSchema = (okRes.content?.['application/json']?.schema ?? {}) as Schema;
  const resRef =
    resSchema.$ref ?? (resSchema.type === 'array' ? (resSchema.items?.$ref ?? '') : '') ?? '';
  const returnT = resRef ? leafName(resRef) : 'Record<string, unknown>';
  if (resRef) for (const t of referencedTypes(returnT, schemaNames)) refs.add(t);

  // Request body.
  const reqSchema = (op.requestBody?.content?.['application/json']?.schema ?? {}) as Schema;
  const reqRef = reqSchema.$ref ?? '';
  const unionRefs = (reqSchema.anyOf ?? reqSchema.oneOf ?? [])
    .map((v) => v.$ref ?? '')
    .filter(Boolean);
  const flat = flattenSchema(doc, reqRef ? { $ref: reqRef } : undefined);

  const hasBody = Boolean(reqRef) || unionRefs.length > 0;
  const singleBody =
    unionRefs.length > 0 || (Boolean(reqRef) && Object.keys(flat.props).length === 0);

  let sig: string;
  let bodyExpr = '';
  let preamble = '';
  const bodyParams: ParamSpec[] = [];
  if (singleBody) {
    const variantTs = (unionRefs.length ? unionRefs : [reqRef]).map(leafName);
    for (const t of variantTs) refs.add(t);
    const bodyT = variantTs.join(' | ');
    const parts = pathArgs.map((a) => `${a}: string`);
    parts.push(`body: ${bodyT}`);
    parts.push('extras?: Record<string, unknown>');
    sig = parts.join(', ');
    bodyExpr = '{ ...body, ...extras }';
  } else if (Object.keys(flat.props).length) {
    for (const [key, sch] of Object.entries(flat.props)) {
      const name = safeParam(key);
      if (name === null) continue;
      const ann = paramType(sch);
      for (const t of referencedTypes(ann, schemaNames)) refs.add(t);
      bodyParams.push({ name, ann, required: flat.required.includes(key) });
    }
    sig = renderSignature(pathArgs, bodyParams, { extras: true, query: false });
    preamble = renderBodyAssembly(bodyParams, true);
    bodyExpr = 'body';
  } else {
    const query = httpVerb === 'get';
    sig = renderSignature(pathArgs, [], { extras: false, query });
  }

  // Call target.
  let target: string;
  if (under) {
    target = pathParts.length ? `this._path(${pathParts.join(', ')})` : 'this._basePath';
  } else {
    target = pathArgs.length
      ? '`' + prefix + '/' + absParts.join('/') + '`'
      : JSON.stringify(prefix + '/' + absParts.join('/'));
  }

  let call: string;
  const needsQuery = httpVerb === 'get' && !hasBody;
  if (hasBody) {
    call = `this._http.${httpVerb}<${returnT}>(${target}, ${bodyExpr})`;
  } else if (httpVerb === 'get') {
    call = `this._http.get<${returnT}>(${target}, params)`;
  } else {
    call = `this._http.${httpVerb}<${returnT}>(${target})`;
  }

  const src =
    `  async ${camelCase(methodName)}(${sig}): Promise<${returnT}> {\n` +
    preamble +
    `    return ${call};\n` +
    `  }`;
  return { src, refs, needsQuery };
}

/** Emit the closed typed create/update overrides for a full-CRUD resource. */
function emitCrudMethod(
  isCreate: boolean,
  verb: string,
  reqRef: string,
  itemT: string,
  idName: string,
): { src: string; refs: Set<string> } | null {
  // CRUD uses the args-object idiom (closed body + extras). The structural
  // crud_base binding is what the oracle matches; the per-method form is excused.
  if (!reqRef) return null;
  const bodyT = leafName(reqRef);
  const refs = new Set<string>([bodyT]);
  if (isCreate) {
    const src =
      `  /** Create — typed request body plus an \`extras\` escape hatch for fields not yet typed. */\n` +
      `  override async create(body: ${bodyT}, extras?: Record<string, unknown>): Promise<${itemT}> {\n` +
      `    return this._http.post<${itemT}>(this._basePath, { ...body, ...extras });\n` +
      `  }`;
    return { src, refs };
  }
  const httpVerb = verb === 'PUT' ? 'put' : 'patch';
  const src =
    `  /** Update — typed request body plus an \`extras\` escape hatch. */\n` +
    `  override async update(${idName}: string, body: ${bodyT}, extras?: Record<string, unknown>): Promise<${itemT}> {\n` +
    `    return this._http.${httpVerb}<${itemT}>(this._path(${idName}), { ...body, ...extras });\n` +
    `  }`;
  return { src, refs };
}

/** Derive the command-dispatch method name (strip a leading `calling.`, dots → `_`). */
function commandMethodName(command: string): string {
  const s = command.startsWith('calling.') ? command.slice('calling.'.length) : command;
  return s.replace(/\./g, '_');
}

/**
 * Emit the methods of a command-dispatch resource (RULES §6) from a oneOf
 * request schema's discriminator mapping. Each command → a typed method posting
 * `{command, params, id?}`. Union `params` are FLATTENED.
 */
function emitCommandDispatch(
  doc: OpenApiDoc,
  requestName: string,
  schemaNames: Set<string>,
): { srcs: string[]; refs: Set<string> } {
  const req = doc.components?.schemas?.[requestName];
  if (!req) throw new Error(`command-dispatch request ${requestName} not in components.schemas`);
  const mapping = (req as Schema & { discriminator?: { mapping?: Record<string, string> } })
    .discriminator?.mapping;
  if (!mapping || Object.keys(mapping).length === 0) {
    throw new Error(`command-dispatch request ${requestName} has no discriminator.mapping`);
  }
  const returnT = 'CallResponse';
  const refs = new Set<string>([returnT]);
  const srcs: string[] = [];
  for (const [command, ref] of Object.entries(mapping)) {
    const sch = typeof ref === 'string' ? resolveRef(doc, ref) : ({} as Schema);
    const props = sch.properties ?? {};
    const hasId = 'id' in props;
    const methodName = commandMethodName(command);
    const flat = flattenUnion(doc, props.params);
    const bodyParams: ParamSpec[] = [];
    for (const [key, ps] of Object.entries(flat.props)) {
      const name = safeParam(key);
      if (name === null) continue;
      const ann = paramType(ps);
      for (const t of referencedTypes(ann, schemaNames)) refs.add(t);
      bodyParams.push({ name, ann, required: flat.required.includes(key) });
    }
    const parts: string[] = [];
    if (hasId) parts.push('callId: string');
    const reqP = bodyParams.filter((p) => p.required);
    const optP = bodyParams.filter((p) => !p.required);
    for (const p of reqP) parts.push(`${p.name}: ${p.ann}`);
    for (const p of optP) parts.push(`${p.name}?: ${p.ann}`);
    parts.push('extras?: Record<string, unknown>');
    let src = `  async ${camelCase(methodName)}(${parts.join(', ')}): Promise<${returnT}> {\n`;
    src += renderBodyAssembly(bodyParams, true, 'params');
    const wire = hasId
      ? `{ command: ${JSON.stringify(command)}, params, id: callId }`
      : `{ command: ${JSON.stringify(command)}, params }`;
    src += `    return this._http.post<${returnT}>(this._basePath, ${wire});\n  }`;
    srcs.push(src);
  }
  return { srcs, refs };
}

/**
 * Emit the declared `set_methods` (RULES §7): typed wrappers over `update()`
 * that bind a fixed handler value + map each arg to an update-request field.
 * Fail loud if a bound field isn't a property of the update request schema.
 */
function emitSetMethods(
  doc: OpenApiDoc,
  setMethods: NonNullable<XSdkResource['set_methods']>,
  itemT: string,
  updateReqRef: string,
  schemaNames: Set<string>,
): { srcs: string[]; refs: Set<string> } {
  const updateProps = flattenSchema(doc, updateReqRef ? { $ref: updateReqRef } : undefined).props;
  const refs = new Set<string>([itemT]);
  const srcs: string[] = [];
  for (const [name, spec] of Object.entries(setMethods)) {
    const handler = spec.handler;
    if (!handler) throw new Error(`set_methods.${name} missing 'handler'`);
    const reqArgs: { arg: string; field: string; ann: string }[] = [];
    const optArgs: { arg: string; field: string; ann: string }[] = [];
    for (const [arg, binding] of Object.entries(spec.args ?? {})) {
      const field = binding.field;
      if (!field) throw new Error(`set_methods.${name}.args.${arg} missing 'field'`);
      if (!(field in updateProps)) {
        throw new Error(
          `set_methods.${name}.args.${arg}: field ${field} is not a property of the ` +
            `update request schema`,
        );
      }
      const ann = paramType(updateProps[field]);
      for (const t of referencedTypes(ann, schemaNames)) refs.add(t);
      (binding.required ? reqArgs : optArgs).push({ arg, field, ann });
    }
    const params = ['resourceId: string'];
    for (const a of reqArgs) params.push(`${a.arg}: ${a.ann}`);
    for (const a of optArgs) params.push(`${a.arg}?: ${a.ann}`);
    params.push('extra?: Record<string, unknown>');
    let src = `  async ${camelCase(name)}(${params.join(', ')}): Promise<${itemT}> {\n`;
    src += `    const body: Record<string, unknown> = { call_handler: ${JSON.stringify(handler)} };\n`;
    for (const a of reqArgs) src += `    body[${JSON.stringify(a.field)}] = ${a.arg};\n`;
    for (const a of optArgs)
      src += `    if (${a.arg} !== undefined) body[${JSON.stringify(a.field)}] = ${a.arg};\n`;
    src += '    if (extra) Object.assign(body, extra);\n';
    src += `    return this.update(resourceId, body as ${leafName(updateReqRef)});\n  }`;
    srcs.push(src);
  }
  return { srcs, refs };
}

// ---- x-sdk-bases registry (the base method-sets, `extends` flattened) -------
function loadXSdkBases(
  psdk: string,
  ns: string,
): Record<string, { methods: Record<string, unknown> }> {
  const registry: Record<string, { methods?: Record<string, unknown>; extends?: string }> = {};
  for (const p of [
    path.join(psdk, 'rest-apis', 'x-sdk-bases.yaml'),
    path.join(psdk, 'rest-apis', ns, 'x-sdk-bases.yaml'),
  ]) {
    if (fs.existsSync(p)) {
      const loaded = (
        yaml.load(fs.readFileSync(p, 'utf-8')) as { 'x-sdk-bases'?: typeof registry }
      )?.['x-sdk-bases'];
      Object.assign(registry, loaded ?? {});
    }
  }
  const resolve = (
    name: string,
    seen = new Set<string>(),
  ): { methods: Record<string, unknown> } => {
    if (seen.has(name)) throw new Error(`x-sdk-bases: cyclic extends at ${name}`);
    seen.add(name);
    const entry = registry[name];
    if (entry === undefined) throw new Error(`x-sdk-bases: undefined base ${name}`);
    const methods: Record<string, unknown> = {};
    if (entry.extends) Object.assign(methods, resolve(entry.extends, seen).methods);
    Object.assign(methods, entry.methods ?? {});
    return { methods };
  };
  const out: Record<string, { methods: Record<string, unknown> }> = {};
  for (const name of Object.keys(registry)) out[name] = resolve(name);
  return out;
}

/** The (collection, x-sdk-resource) generate-targets in a spec (not `exclude`). */
function xSdkResources(doc: OpenApiDoc): { coll: string; x: XSdkResource }[] {
  const out: { coll: string; x: XSdkResource }[] = [];
  for (const [coll, ops] of Object.entries(doc.paths ?? {})) {
    const x = (ops as Record<string, unknown>)['x-sdk-resource'] as XSdkResource | undefined;
    if (!x) continue;
    const excl = x.exclude;
    if (excl === true || (typeof excl === 'object' && excl.exclude)) continue;
    const required = ['name', 'base'];
    if (!READONLY_BASES.has(x.base) && !PLAIN_BASES.has(x.base)) required.push('update_method');
    const missing = required.filter((k) => !(k in x));
    if (missing.length) {
      throw new Error(
        `x-sdk-resource on ${coll} missing required field(s) ${missing.join(', ')} ` +
          `(and not exclude: true)`,
      );
    }
    out.push({ coll, x });
  }
  return out;
}

/**
 * Emit `<ns>.resources.generated.ts` — one typed class per `x-sdk-resource`.
 * Returns the module source (formatted later), or null if the spec has no
 * generate-target resources.
 */
function emitResourcesModule(doc: OpenApiDoc, ns: string, psdk: string): string | null {
  const targets = xSdkResources(doc);
  if (targets.length === 0) return null;
  const bases = loadXSdkBases(psdk, ns);
  const resources = groupResources(doc);
  const prefix = serverPrefix(doc);
  const schemaNames = new Set(Object.keys(doc.components?.schemas ?? {}).map(tsName));

  const classes: string[] = [];
  const usedTypes = new Set<string>();
  const basesUsed = new Set<string>();
  let needsQuery = false;

  for (const { coll: anchorPath, x } of targets) {
    const collection = x.collection ?? anchorPath;
    const baseName = x.base;
    if (!(baseName in BASE_CLASS)) {
      throw new Error(`x-sdk-resource on ${collection}: base ${baseName} has no SDK class mapping`);
    }
    const plain = PLAIN_BASES.has(baseName);
    const readonly = READONLY_BASES.has(baseName);
    if (!plain && !(baseName in bases)) {
      throw new Error(
        `x-sdk-resource on ${collection}: base ${baseName} is not defined in x-sdk-bases`,
      );
    }
    const baseImport = BASE_CLASS[baseName].import;
    basesUsed.add(baseName);
    const resourceName = pascal(x.name);
    const roles = resources[collection] ?? {};

    // Base binding + CRUD overrides.
    let bindClause = '';
    let itemT = '';
    let updateReqRef = '';
    const crudSrcs: string[] = [];
    if (plain) {
      bindClause = baseImport;
    } else if (readonly) {
      const listT = leafName(roles.list?.resRef ?? '');
      itemT = leafName(roles.get?.resRef ?? '');
      if (!itemT) throw new Error(`x-sdk-resource on ${collection}: missing a get response schema`);
      const a = listT || itemT;
      bindClause = `${baseImport}<${a}, ${itemT}>`;
      usedTypes.add(a);
      usedTypes.add(itemT);
    } else {
      const listT = leafName(roles.list?.resRef ?? '');
      itemT = leafName(roles.get?.resRef ?? '');
      if (!itemT) throw new Error(`x-sdk-resource on ${collection}: missing a get response schema`);
      const idName = identityField(doc, roles.get?.resRef ?? '');
      const specVerb = roles.update?.verb;
      if (specVerb && specVerb !== x.update_method) {
        throw new Error(
          `x-sdk-resource on ${collection}: declared update_method ${x.update_method} != ` +
            `the spec's actual update verb ${specVerb}`,
        );
      }
      const createT = leafName(roles.create?.reqRef ?? '');
      updateReqRef = roles.update?.reqRef ?? '';
      const updateT = leafName(updateReqRef);
      if (!createT || !updateT) {
        throw new Error(
          `x-sdk-resource on ${collection}: missing a create/update request schema — not full CRUD`,
        );
      }
      const a = listT || itemT;
      bindClause = `${baseImport}<${a}, ${itemT}, ${createT}, ${updateT}>`;
      usedTypes.add(a);
      usedTypes.add(itemT);
      usedTypes.add(createT);
      usedTypes.add(updateT);
      const cm = emitCrudMethod(
        true,
        x.update_method ?? 'PATCH',
        roles.create?.reqRef ?? '',
        itemT,
        idName,
      );
      const um = emitCrudMethod(false, x.update_method ?? 'PATCH', updateReqRef, itemT, idName);
      if (cm) {
        crudSrcs.push(cm.src);
        cm.refs.forEach((t) => usedTypes.add(t));
      }
      if (um) {
        crudSrcs.push(um.src);
        um.refs.forEach((t) => usedTypes.add(t));
      }
    }

    const subSrcs: string[] = [];
    // Command-dispatch.
    if (x.kind === 'command-dispatch') {
      if (!x.request)
        throw new Error(`x-sdk-resource on ${collection}: command-dispatch needs 'request'`);
      const cd = emitCommandDispatch(doc, x.request, schemaNames);
      subSrcs.push(...cd.srcs);
      cd.refs.forEach((t) => usedTypes.add(t));
    }
    // Declared operation methods.
    for (const [methodName, spec] of Object.entries(x.methods ?? {})) {
      const opId = typeof spec === 'string' ? spec : spec.op;
      if (!opId)
        throw new Error(`x-sdk-resource on ${collection}: methods.${methodName} has no 'op'`);
      const m = emitOperationMethod(doc, collection, methodName, opId, prefix, schemaNames);
      subSrcs.push(m.src);
      m.refs.forEach((t) => usedTypes.add(t));
      if (m.needsQuery) needsQuery = true;
    }
    // set_methods.
    if (x.set_methods) {
      if (plain || readonly) {
        throw new Error(`x-sdk-resource on ${collection}: set_methods require a CRUD base`);
      }
      const sm = emitSetMethods(doc, x.set_methods, itemT, updateReqRef, schemaNames);
      subSrcs.push(...sm.srcs);
      sm.refs.forEach((t) => usedTypes.add(t));
    }

    // The base path baked into the constructor.
    const basePath = prefix + collection;
    const verbAttr =
      !plain && !readonly && x.update_method === 'PUT'
        ? `  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';\n\n`
        : '';
    const ctor = `  constructor(http: HttpClient) {\n    super(http, ${JSON.stringify(basePath)});\n  }`;
    const bodyMethods = [...crudSrcs, ...subSrcs];
    const body = verbAttr + [ctor, ...bodyMethods].join('\n\n');
    let cls = `export class ${resourceName} extends ${bindClause} {\n${body}\n}`;
    for (const alias of x.aliases ?? []) cls += `\n\nexport const ${alias} = ${resourceName};`;
    classes.push(cls);
  }
  if (classes.length === 0) return null;

  // Imports: bases (value), generated types (type), HttpClient / QueryParams.
  const baseImportsByModule: Record<string, string[]> = {};
  for (const b of basesUsed) {
    const { import: imp, module } = BASE_CLASS[b];
    (baseImportsByModule[module] ??= []).push(imp);
  }
  const baseImportLines = Object.entries(baseImportsByModule)
    .sort()
    .map(([mod, imps]) => `import { ${[...new Set(imps)].sort().join(', ')} } from '${mod}';`)
    .join('\n');
  const typeNames = [...usedTypes].filter((t) => schemaNames.has(t)).sort();
  const typeImport = typeNames.length
    ? `import type {\n  ${typeNames.join(',\n  ')},\n} from './${ns}.types.generated.js';\n`
    : '';
  const httpImports = needsQuery
    ? `import type { HttpClient } from '../HttpClient.js';\nimport type { QueryParams } from '../types.js';\n`
    : `import type { HttpClient } from '../HttpClient.js';\n`;
  const header =
    `// AUTO-GENERATED from porting-sdk/rest-apis/${ns}/openapi.yaml — DO NOT EDIT.\n` +
    `// Regenerate with: npx tsx scripts/generate-rest-types.ts\n//\n` +
    `// One typed resource class per x-sdk-resource: CRUD bases bound to the\n` +
    `// resource's spec types (closed body + extras door) plus declared operation\n` +
    `// methods, command-dispatch, and set_methods — mirrors the Python reference's\n` +
    `// <ns>_resources_generated module.\n\n` +
    httpImports +
    `${baseImportLines}\n` +
    typeImport +
    '\n';
  return header + classes.join('\n\n') + '\n';
}

// ===========================================================================
// Client object tree (RULES §8): placement resolution + assembly.
//
// Mirrors the Python reference's `_resolve_placement` / `emit_client_assembly`
// (porting-sdk/scripts/generate_python_rest_types.py). Every x-sdk-resource
// resolves to FLAT (`client.<accessor>`) or CONTAINERED
// (`client.<container>.<accessor>`); a whole-spec container is declared once via
// the spec-level `x-sdk-namespace.attr`, a cross-spec/subset container per
// resource via `x-sdk-resource.namespace` (+ `attr`). The generator emits one
// `<Pascal>Namespace` container class per group plus a `_GeneratedResourceTree`
// base the hand `RestClient` extends (wiring the flat resources + containers).
//
// TS idiom: accessor names are camelCase (Python's snake_case `conference_tokens`
// → `conferenceTokens`); the container classes + the wiring live in
// `_client_tree_generated.ts` (the `_`-prefixed file mirrors Python's private
// module name `signalwire.rest.namespaces._client_tree_generated`).
// ===========================================================================

// The accessor-name override table (the irregular handful), keyed by class name.
// Mirrors the Python reference's `_ATTR_OVERRIDE`; values are the snake_case
// accessor (camelCased on emit). Most accessors derive mechanically and need no
// entry — only the cross-spec log family + the fabric/datasphere/pubsub/project
// singletons whose accessor isn't the class name's snake form.
const ATTR_OVERRIDE: Record<string, string> = {
  GenericResources: 'resources',
  FabricAddresses: 'addresses',
  FabricTokens: 'tokens',
  DatasphereDocuments: 'documents',
  ProjectTokens: 'tokens',
  PubSub: 'pubsub',
  MessageLogs: 'messages',
  VoiceLogs: 'voice',
  FaxLogs: 'fax',
  ConferenceLogs: 'conferences',
};

/** `foo_bar` / `FooBar` → `fooBar` (the camelCase accessor idiom). */
function camelCaseAccessor(s: string): string {
  return s
    .replace(/[-\s]/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/_+([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

/**
 * The SDK accessor name for a resource: an explicit `attr` override, else the
 * snake-cased class name with the container-name prefix stripped (VideoRooms
 * under `video` → `rooms`). Mirrors Python's `_accessor_attr`; returns the
 * snake_case form (camelCased by the caller).
 */
function accessorAttr(cls: string, container: string | null): string {
  if (cls in ATTR_OVERRIDE) return ATTR_OVERRIDE[cls];
  let s = snakeCase(cls);
  if (container && s.startsWith(container + '_')) s = s.slice(container.length + 1);
  return s;
}

interface PlacedResource {
  cls: string;
  module: string; // the generated resources module leaf (e.g. `video.resources.generated`)
  accessor: string; // camelCase accessor
}

/**
 * Resolve every resource's SDK placement across all specs. Returns
 * `{ flat: PlacedResource[], containers: { <container>: PlacedResource[] } }`.
 * A whole-spec container is the spec-level `x-sdk-namespace.attr`; a per-resource
 * `x-sdk-resource.namespace` wins over it (cross-spec groups like logs/registry).
 */
function resolvePlacement(docs: Record<string, OpenApiDoc>): {
  flat: PlacedResource[];
  containers: Record<string, PlacedResource[]>;
} {
  const flat: PlacedResource[] = [];
  const containers: Record<string, PlacedResource[]> = {};
  for (const [ns, doc] of Object.entries(docs)) {
    const module = `${ns}.resources.generated`;
    const specContainer =
      (doc as { 'x-sdk-namespace'?: { attr?: string } })['x-sdk-namespace']?.attr ?? null;
    for (const { x } of xSdkResources(doc)) {
      const cls = pascal(x.name);
      const container = x.namespace ?? specContainer; // per-resource wins
      const accessor = camelCaseAccessor(x.attr ?? accessorAttr(cls, container));
      const placed: PlacedResource = { cls, module, accessor };
      if (container) (containers[container] ??= []).push(placed);
      else flat.push(placed);
    }
  }
  return { flat, containers };
}

/**
 * Emit `_client_tree_generated.ts`: one `<Pascal>Namespace` container class per
 * group plus the `_GeneratedResourceTree` base the hand `RestClient` extends.
 * Flat resources sit directly on the client; containered ones under their
 * container instance. All placement is read from the specs (RULES §8).
 */
function emitClientTree(docs: Record<string, OpenApiDoc>): string {
  const { flat, containers } = resolvePlacement(docs);
  const containerNames = Object.keys(containers).sort();

  // Imports: every (class, module) used, grouped by module.
  const importsByModule: Record<string, Set<string>> = {};
  const allPlaced = [...flat, ...Object.values(containers).flat()];
  for (const p of allPlaced) (importsByModule[p.module] ??= new Set()).add(p.cls);
  const importLines = Object.keys(importsByModule)
    .sort()
    .map((mod) => {
      const classes = [...importsByModule[mod]].sort();
      return `import {\n${classes.map((c) => `  ${c},`).join('\n')}\n} from './${mod}.js';`;
    })
    .join('\n');

  // One container class per group.
  const containerClasses = containerNames.map((container) => {
    const members = [...containers[container]].sort((a, b) => a.accessor.localeCompare(b.accessor));
    const clsName = pascal(container) + 'Namespace';
    const fields = members.map((m) => `  readonly ${m.accessor}: ${m.cls};`).join('\n');
    const ctorBody = members.map((m) => `    this.${m.accessor} = new ${m.cls}(http);`).join('\n');
    return (
      `/** Generated \`client.${container}\` namespace container. */\n` +
      `export class ${clsName} {\n${fields}\n\n` +
      `  constructor(http: HttpClient) {\n${ctorBody}\n  }\n}`
    );
  });

  // The wiring base the hand RestClient extends. Flat resources + container
  // instances are assigned in `_wireResources(http)` (called from the RestClient
  // constructor after it builds the HTTP layer). The `_`-prefixed CLASS name keeps
  // it out of the enumerated surface (the accessors are TS-idiom static typing of
  // the dynamically-wired Python tree). Fields use a definite-assignment `!` and
  // are NOT `readonly` (a readonly field can only be set in the constructor, but
  // these are set in `_wireResources`).
  const flatSorted = [...flat].sort((a, b) => a.accessor.localeCompare(b.accessor));
  const treeFields = [
    ...flatSorted.map((m) => `  ${m.accessor}!: ${m.cls};`),
    ...containerNames.map((c) => `  ${camelCaseAccessor(c)}!: ${pascal(c)}Namespace;`),
  ].join('\n');
  const treeAssign = [
    ...flatSorted.map((m) => `    this.${m.accessor} = new ${m.cls}(http);`),
    ...containerNames.map(
      (c) => `    this.${camelCaseAccessor(c)} = new ${pascal(c)}Namespace(http);`,
    ),
  ].join('\n');
  const treeClass =
    `/**\n` +
    ` * Generated resource wiring for \`RestClient\` (flat resources + namespace\n` +
    ` * containers). The hand \`RestClient\` extends this and calls \`_wireResources\`\n` +
    ` * after constructing the HTTP layer; it keeps only the non-spec-derivable bits\n` +
    ` * (auth, HTTP construction).\n` +
    ` */\n` +
    `export class _GeneratedResourceTree {\n${treeFields}\n\n` +
    `  protected _wireResources(http: HttpClient): void {\n${treeAssign}\n  }\n}`;

  const header =
    `// AUTO-GENERATED from porting-sdk/rest-apis/*/openapi.yaml — DO NOT EDIT.\n` +
    `// Regenerate with: npx tsx scripts/generate-rest-types.ts\n//\n` +
    `// The SDK client object tree: one namespace container class per\n` +
    `// x-sdk-namespace group plus the flat resources, wired from each resource's\n` +
    `// spec placement (RULES §8). The hand RestClient composes _GeneratedResourceTree.\n\n` +
    `import type { HttpClient } from '../HttpClient.js';\n` +
    importLines +
    '\n\n';
  return header + [...containerClasses, treeClass].join('\n\n') + '\n';
}

async function generateForSpec(specPath: string, outPath: string, ns: string): Promise<number> {
  // Fail with a clear, actionable message rather than a raw ENOENT stack trace
  // when a spec is absent — the usual cause is porting-sdk checked out at a
  // branch/SHA that predates the spec (e.g. the spec lives on an unmerged
  // porting-sdk PR while this repo's CI pulls porting-sdk@main).
  if (!fs.existsSync(specPath)) {
    throw new Error(
      `spec not found: ${specPath}\n` +
        `  The '${ns}' spec is missing from the resolved porting-sdk. If it lives on an\n` +
        `  unmerged porting-sdk PR, check out that branch (or merge it) before running\n` +
        `  GEN-FRESH; CI pulls porting-sdk@main.`,
    );
  }
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
  // Accumulate the resource-bearing docs so the client tree (RULES §8) can resolve
  // placement across ALL specs after the per-spec pass.
  const resourceDocs: Record<string, OpenApiDoc> = {};
  for (const [specDir, outPath] of Object.entries(map)) {
    const specPath = path.join(psdk, 'rest-apis', specDir, 'openapi.yaml');
    // Spec-dir discovery is dynamic (mirrors the Python generator's
    // ``spec_dirs``): a mapped spec whose dir is absent from the resolved
    // porting-sdk (e.g. ``compatibility``, which is hand-written and not yet
    // spec-backed) is skipped, leaving its committed *.types.generated.ts in
    // place — rather than throwing and breaking the whole prebuild.
    if (!fs.existsSync(specPath)) {
      console.log(`skipped ${specDir} (no spec at ${specPath}; using committed output)`);
      continue;
    }
    const n = await generateForSpec(specPath, outPath, specDir);
    console.log(`${verb} ${outPath} (${n} types)`);

    // Typed resource classes (markup-driven, one per x-sdk-resource). Emitted for
    // every spec that declares x-sdk-resource markup; the namespace .ts file
    // imports + constructs these. Mirrors the Python resources_generated module.
    const doc = yaml.load(fs.readFileSync(specPath, 'utf-8')) as OpenApiDoc;
    const resSrc = emitResourcesModule(doc, specDir, psdk);
    if (resSrc !== null) {
      resourceDocs[specDir] = doc;
      const resOut = `src/rest/namespaces/${specDir}.resources.generated.ts`;
      const config = (await prettier.resolveConfig(resOut)) ?? {};
      const formatted = await prettier.format(resSrc, { ...config, parser: 'typescript' });
      emitFile(resOut, formatted);
      console.log(`${verb} ${resOut} (resources)`);
    }
  }

  // The client object tree (RULES §8): container classes + the RestClient wiring
  // base, from the placement markup resolved across all resource-bearing specs.
  if (Object.keys(resourceDocs).length) {
    const treeOut = 'src/rest/namespaces/_client_tree_generated.ts';
    const treeSrc = emitClientTree(resourceDocs);
    const config = (await prettier.resolveConfig(treeOut)) ?? {};
    const formatted = await prettier.format(treeSrc, { ...config, parser: 'typescript' });
    emitFile(treeOut, formatted);
    console.log(`${verb} ${treeOut} (client tree)`);
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
  // Print just the message for our own thrown errors (clean gate output); keep
  // the full object for unexpected failures so they remain debuggable.
  console.error(err instanceof Error ? `generate-rest-types: ${err.message}` : err);
  process.exit(1);
});
