/**
 * _gen-common.ts — shared machinery for the 5 code-generators
 * (generate-rest-types / generate-rest-tests / generate-relay-protocol /
 * generate-swaig-payloads / generate-swml-verbs).
 *
 * Holds the pieces every generator needs so they stay DRY: the `--check`
 * (GEN-FRESH) plumbing (emitFile / finalizeCheck), the porting-sdk path
 * resolution, the OpenAPI/JSON-Schema → TS type machinery (tsType / objectBody /
 * declaration + the ref/flatten helpers), the prettier format-on-emit pass, and
 * the small name/case helpers. Each generator imports what it needs and keeps
 * only its own surface-specific emit functions.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as prettier from 'prettier';
import * as yaml from 'js-yaml';

// ---- --check (GEN-FRESH) plumbing ------------------------------------------
// `--check`: regenerate in-memory and FAIL if any committed output differs from
// what the canonical schema produces — instead of writing. This is the real
// validator for the generated files' SHAPE: DRIFT can't check it (≈40% of the
// Python reference is `Any`, which matches any TS type), so the only thing
// proving the committed types still match their source is that they reproduce
// exactly from that source. Mirrors the SURFACE-FRESH gate. Every generator
// shares this one flag + stale list so `--check` behaves identically across the
// 5 scripts.
export const CHECK = process.argv.includes('--check');
export const staleFiles: string[] = [];

/** Write `formatted` to `outPath`, or (in --check) record it as stale on mismatch. */
export function emitFile(outPath: string, formatted: string): void {
  if (CHECK) {
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf-8') : '';
    if (current !== formatted) staleFiles.push(outPath);
    return;
  }
  fs.writeFileSync(outPath, formatted);
}

/**
 * The shared tail of every generator's `main()` in `--check` mode: if any file
 * was stale, print the actionable GEN-FRESH failure and exit non-zero. `regenCmd`
 * is the script's own regenerate command (e.g. `npx tsx scripts/generate-relay-protocol.ts`).
 */
export function finalizeCheck(regenCmd: string): void {
  if (CHECK && staleFiles.length) {
    console.error(
      `\nGEN-FRESH FAIL: ${staleFiles.length} generated file(s) are stale — ` +
        `they no longer match what the canonical schema produces. Run ` +
        `\`${regenCmd}\` and commit:`,
    );
    for (const f of staleFiles) console.error(`  - ${f}`);
    process.exit(1);
  }
}

/** Format `raw` through the repo's prettier config so output passes the FMT gate. */
export async function formatTs(raw: string, outPath: string): Promise<string> {
  const config = (await prettier.resolveConfig(outPath)) ?? {};
  return prettier.format(raw, { ...config, parser: 'typescript' });
}

// ---- spec types (minimal) --------------------------------------------------

export interface Schema {
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
  // SWML schema (schema.json) field-markup overrides, mirrored from the Python
  // generator's py_type: `x-sdk-enum-literal` forces a closed literal union the
  // schema itself doesn't carry; `x-sdk-widen` does the opposite (a schema
  // enum/const is only a hint → widen to the base scalar). REST specs never carry
  // these keys, so honoring them in tsType is inert for the OpenAPI path.
  'x-sdk-enum-literal'?: unknown[];
  'x-sdk-widen'?: boolean;
}

export interface Operation {
  operationId?: string;
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, { content?: Record<string, { schema?: Schema }> }>;
}

export interface OpenApiDoc {
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
export function tsName(rawName: string): string {
  const cleaned = rawName.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '');
  const id = /^[A-Za-z_]/.test(cleaned) ? cleaned : `Schema_${cleaned}`;
  return RESERVED_GLOBALS.has(id) ? `${id}_` : id;
}

export function refName(ref: string): string {
  // Take the last pointer segment for both OpenAPI (#/components/schemas/<Name>)
  // and JSON-Schema ($defs) refs (#/$defs/<Name>) — the leaf name is the type
  // identifier in either form. (Mirrors the Python generator's ref_name.)
  return tsName(ref.slice(ref.lastIndexOf('/') + 1));
}

// ---- cross-file $ref resolution --------------------------------------------
// A `<file>.yaml#/components/schemas/<Name>` ref points at a schema owned by a
// SIBLING spec file, so the type is declared in a different generated MODULE and
// the emitting module needs an `import type`. Resolving these by last-pointer-
// segment alone (refName) silently emits an undefined type name — which is
// exactly the defect the Python generator's resolve_cross_file_ref fixed
// (porting-sdk 4ddda70): it verifies the file exists AND declares the schema,
// AND records the import. This is the TS analog, kept deliberately identical in
// behaviour so the two generators cannot drift.

/**
 * Spec FILE NAME → the generated TS module (import specifier, relative to `src/`)
 * that hosts its schemas. A cross-file ref into an UNREGISTERED file is an error,
 * not a silent widening to `Record<string, unknown>` — adding a new cross-file
 * link is a deliberate act. Mirrors the Python CROSS_FILE_MODULES table.
 */
const CROSS_FILE_MODULES: Record<string, string> = {
  // Both swaig-request.yaml and swaig-response.yaml resolve INTO the two committed
  // SWAIG modules. SwaigRequest is co-located in SwaigContracts.generated.ts (the
  // module that also owns post-prompt.yaml), so a ref to it from that same module
  // needs no import — recordCrossFileRef() drops a self-ref (see `selfModule`).
  'swaig-request.yaml': './SwaigContracts.generated.js',
  'swaig-response.yaml': './SwaigActions.generated.js',
};

/** Directories (relative to the resolved porting-sdk) searched for a ref target. */
const CROSS_FILE_SEARCH_DIRS = ['swaig-specs'];

export class CrossFileRefError extends Error {}

const _crossFileSpecCache = new Map<string, OpenApiDoc>();
// Populated by tsType() while one module is being emitted; the emitter reads it to
// write the import block and clears it before the next module.
let _crossFileImports = new Map<string, Set<string>>();
let _crossFileSelfModule: string | null = null;

/**
 * Start recording cross-file refs for a fresh output module. `selfModule` is the
 * module specifier being emitted; refs that resolve to it are same-module and
 * recorded as no import.
 */
export function resetCrossFileImports(selfModule?: string): void {
  _crossFileImports = new Map();
  _crossFileSelfModule = selfModule ?? null;
}

/**
 * The `import type` statements for every cross-file name resolved since the last
 * reset, or `''` when there were none. Type-only imports: these names appear
 * exclusively in annotations, so a value import would be a needless (and
 * potentially circular) runtime dependency — the TS analog of Python's
 * `if TYPE_CHECKING:` block.
 */
export function crossFileImportBlock(): string {
  if (!_crossFileImports.size) return '';
  const lines: string[] = [];
  for (const mod of [..._crossFileImports.keys()].sort()) {
    const names = [...(_crossFileImports.get(mod) ?? [])].sort();
    lines.push(`import type { ${names.join(', ')} } from '${mod}';`);
  }
  return `${lines.join('\n')}\n`;
}

function loadCrossFileSpec(fileName: string): OpenApiDoc {
  const cached = _crossFileSpecCache.get(fileName);
  if (cached) return cached;
  const psdk = resolvePortingSdk();
  if (!psdk) {
    throw new CrossFileRefError(
      `cannot resolve cross-file $ref target ${fileName}: porting-sdk not found ` +
        `(set $PORTING_SDK or clone adjacent)`,
    );
  }
  for (const dir of CROSS_FILE_SEARCH_DIRS) {
    const candidate = path.join(psdk, dir, fileName);
    if (fs.existsSync(candidate)) {
      const doc = yaml.load(fs.readFileSync(candidate, 'utf-8')) as OpenApiDoc;
      _crossFileSpecCache.set(fileName, doc);
      return doc;
    }
  }
  throw new CrossFileRefError(
    `cross-file $ref target ${fileName} not found under ` +
      `${CROSS_FILE_SEARCH_DIRS.map((d) => `${d}/`).join(', ')} of the resolved porting-sdk`,
  );
}

/**
 * `<file>.yaml#/components/schemas/<Name>` → the TS type name for `<Name>`.
 *
 * Verifies the file exists AND declares the schema, records the import the
 * emitting module needs, and returns the resolved name. Throws CrossFileRefError
 * — naming the file and the schema — on any of the three failure modes, rather
 * than silently widening to an opaque record or emitting an undefined name.
 */
export function resolveCrossFileRef(ref: string): string {
  const hash = ref.indexOf('#');
  const filePart = ref.slice(0, hash);
  const pointer = ref.slice(hash);
  if (!pointer.startsWith('#/components/schemas/')) {
    throw new CrossFileRefError(
      `unsupported cross-file $ref pointer '${pointer}' in '${ref}'; only ` +
        `'#/components/schemas/<Name>' is resolvable`,
    );
  }
  const schemaName = pointer.slice(pointer.lastIndexOf('/') + 1);
  const module = CROSS_FILE_MODULES[filePart];
  if (module === undefined) {
    throw new CrossFileRefError(
      `cross-file $ref into unregistered spec file '${filePart}' (schema ` +
        `'${schemaName}'); add it to CROSS_FILE_MODULES with the generated module ` +
        `that hosts its schemas`,
    );
  }
  const schemas = loadCrossFileSpec(filePart).components?.schemas ?? {};
  if (!(schemaName in schemas)) {
    const declared = Object.keys(schemas).sort().join(', ') || '<none>';
    throw new CrossFileRefError(
      `cross-file $ref names schema '${schemaName}' which does not exist in ` +
        `'${filePart}' (it declares: ${declared})`,
    );
  }
  const resolved = tsName(schemaName);
  if (module !== _crossFileSelfModule) {
    const set = _crossFileImports.get(module) ?? new Set<string>();
    set.add(resolved);
    _crossFileImports.set(module, set);
  }
  return resolved;
}

// ---- schema → TS type expression ------------------------------------------

export function tsType(schema: Schema | undefined, indent = 0): string {
  if (!schema) return 'unknown';

  // Field-markup overrides (the SWML schema's formulaic-enrichment vocabulary,
  // mirrored from the Python generator's py_type). REST specs never set these.
  const lit = schema['x-sdk-enum-literal'];
  if (lit && lit.length) {
    return lit.map((v) => (v === null ? 'null' : JSON.stringify(v))).join(' | ');
  }
  if (schema['x-sdk-widen']) {
    const t = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    return t === 'integer' || t === 'number' ? 'number' : t === 'boolean' ? 'boolean' : 'string';
  }

  if (schema.$ref) {
    // An external/file ref (e.g. "SWMLObject.json") points outside this document —
    // the type isn't emitted here, so treat the value as an opaque record (the TS
    // analog of Python's dict[str, Any]).
    if (!schema.$ref.startsWith('#/') && schema.$ref.endsWith('.json')) {
      return 'Record<string, unknown>';
    }
    // A cross-file ref into a SIBLING spec (`<file>.yaml#/components/schemas/X`)
    // is resolved through the registry, which verifies the target and records the
    // `import type` the emitting module needs. refName() alone would emit an
    // undefined type name by discarding the file part.
    if (!schema.$ref.startsWith('#/')) {
      return resolveCrossFileRef(schema.$ref);
    }
    return refName(schema.$ref);
  }

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

// ---- SDK-surface policy overlay (the single source; NOT wire truth) --------
// porting-sdk/rest-apis/x-sdk-overlay.yaml is the ONE authoritative place that
// says which spec fields the SDKs HIDE (dropped from the surface entirely, still
// on the wire) or DEPRECATE (emitted-but-flagged). It is a policy overlay, not
// markup in the (often vendored) specs, so the same field is governed once and
// applied wherever it surfaces (schema.json $defs/AIParams + the calling/fabric
// REST projections). Mirrors the Python reference generator
// (porting-sdk/scripts/generate_python_rest_types.py).
//
// MATCHING: each rule is (field, scope-or-undefined). `scope` is matched against
// the containing SPEC schema name — the `$defs/<name>` / `components/schemas/
// <name>` key exactly as it appears in the spec — NOT the language-idiomatic type
// name this generator later emits, so one `scope` value works cross-port. An
// unscoped rule matches everywhere; a scoped rule only inside its schema.
type OverlayRule = { field: string; scope?: string };
type Overlay = { hidden: OverlayRule[]; deprecated: OverlayRule[] };
let _overlayCache: Overlay | null = null;

function loadOverlay(): Overlay {
  if (_overlayCache) return _overlayCache;
  const psdk = resolvePortingSdk();
  const empty: Overlay = { hidden: [], deprecated: [] };
  if (!psdk) {
    _overlayCache = empty;
    return empty;
  }
  const overlayPath = path.join(psdk, 'rest-apis', 'x-sdk-overlay.yaml');
  if (!fs.existsSync(overlayPath)) {
    _overlayCache = empty;
    return empty;
  }
  const data = (yaml.load(fs.readFileSync(overlayPath, 'utf-8')) ?? {}) as {
    hidden?: OverlayRule[];
    deprecated?: OverlayRule[];
  };
  const rules = (list?: OverlayRule[]): OverlayRule[] =>
    (list ?? [])
      .filter((e): e is OverlayRule => !!e && typeof e.field === 'string')
      .map((e) => ({ field: e.field, scope: e.scope }));
  _overlayCache = { hidden: rules(data.hidden), deprecated: rules(data.deprecated) };
  return _overlayCache;
}

// A rule matches when its field equals `field` AND (it is unscoped OR its scope
// equals the containing SPEC schema name).
function overlayMatch(rules: OverlayRule[], field: string, schemaName?: string): boolean {
  return rules.some((r) => r.field === field && (r.scope === undefined || r.scope === schemaName));
}

export function overlayHidden(field: string, schemaName?: string): boolean {
  return overlayMatch(loadOverlay().hidden, field, schemaName);
}

export function overlayDeprecated(field: string, schemaName?: string): boolean {
  return overlayMatch(loadOverlay().deprecated, field, schemaName);
}

// `schemaName` is the SPEC schema name of the type being emitted (the $defs /
// components.schemas key). It is threaded through only at the TOP-LEVEL named-
// declaration sites (declaration / swmlDeclaration / swaig payloads) where the
// name is known; nested inline objects pass it undefined (an unscoped overlay
// rule would still match, a scoped one — like AIParams — would not, which is
// correct since AIParams always surfaces as a top-level named schema).
export function objectBody(
  schema: Schema,
  indent: number,
  topLevel = false,
  schemaName?: string,
): string {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const pad = '  '.repeat(indent + 1);
  const closePad = '  '.repeat(indent);
  const lines: string[] = [];
  for (const [key, propSchema] of Object.entries(props)) {
    // SDK-surface policy comes from the single overlay (x-sdk-overlay.yaml), NOT
    // from markup in the (often vendored) specs. Hidden → drop from the surface
    // entirely (still on the wire); deprecated → emit but flag with TSDoc.
    if (overlayHidden(key, schemaName)) continue;
    const optional = required.has(key) ? '' : '?';
    const keyTok = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
    const deprecated = overlayDeprecated(key, schemaName);
    const descLine = propSchema.description ? propSchema.description.split('\n')[0] : '';
    if (deprecated) {
      // Combine the @deprecated tag with any existing description in one TSDoc block.
      lines.push(descLine ? `${pad}/** @deprecated ${descLine} */` : `${pad}/** @deprecated */`);
    } else if (descLine) {
      lines.push(`${pad}/** ${descLine} */`);
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

export function declaration(name: string, schema: Schema): string {
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
    return `${doc}export interface ${id} ${objectBody(schema, 0, true, name)}\n`;
  }
  return `${doc}export type ${id} = ${tsType(schema, 0)};\n`;
}

// ---- case helpers ----------------------------------------------------------

export function pascal(s: string): string {
  return s
    .split(/[_\-\s]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

// ---- $ref / schema resolution ----------------------------------------------

export function resolveRef(doc: OpenApiDoc, ref: string): Schema {
  let node: unknown = doc;
  for (const part of ref.replace('#/', '').split('/')) {
    node = (node as Record<string, unknown>)?.[part];
  }
  return (node ?? {}) as Schema;
}

/** Resolve a (possibly $ref / allOf) object schema to its property map + required list. */
export function flattenSchema(
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
export function flattenUnion(
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

// ---- porting-sdk path resolution -------------------------------------------

export function resolvePortingSdk(): string | null {
  const env = process.env.PORTING_SDK ?? process.env.PORTING_SDK_PATH;
  if (env && fs.existsSync(path.join(env, 'rest-apis'))) return env;
  const sibling = path.resolve(process.cwd(), '..', 'porting-sdk');
  if (fs.existsSync(path.join(sibling, 'rest-apis'))) return sibling;
  return null;
}
