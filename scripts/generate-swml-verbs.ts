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
  // The SWML webhook request is a READ-SIDE payload (what a handler RECEIVES), so it is
  // declared open-shaped exactly like the SWML verb read-side types (swmlDeclaration):
  // every field optional and an open `[key: string]: unknown` tail. Field TYPES are the
  // engine-derived ones (closed enums, the per-device-type `call` union); requiredness
  // and closedness stay facts of the spec, not of the handler signature, so a partial
  // or test body still type-checks -- mirroring Python's `total=False` TypedDicts.
  const decls = Object.entries(schemas).map(([n, s]) => swmlDeclaration(n, s));
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
    return `${doc}export interface ${tsName(name)} ${objectBody(open, 0, true, name)}\n`;
  }
  return `${doc}export type ${tsName(name)} = ${tsType(schema, 0)};\n`;
}

// ---- schema.json transforms (mirrors generate_python_rest_types.py) ----------

type SNode = Record<string, unknown>;
const isNode = (v: unknown): v is SNode => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * True when a SWML verb wrapper (a `SWMLMethod.anyOf` member) is marked
 * `deprecated: true` — on the wrapper itself or on its verb property. Keyed on the
 * schema's annotation only, never on a list of verb names: the schema is the
 * authority on which verbs are retired (reference `swml_verb_is_deprecated`).
 */
export function swmlVerbIsDeprecated(wrapper: SNode): boolean {
  if (wrapper.deprecated === true) return true;
  const props = isNode(wrapper.properties) ? wrapper.properties : {};
  return Object.values(props).some((v) => isNode(v) && v.deprecated === true);
}

/**
 * `defs` without its deprecated verbs (owner ruling 2026-09-24: dial/eval/if stay
 * deprecated and are not SDK surface): the wrapper leaves the `SWMLMethod` union
 * and its wrapper `$def` is not emitted (reference `drop_deprecated_swml_verbs`).
 */
function dropDeprecatedSwmlVerbs(defs: Record<string, SNode>): Record<string, SNode> {
  const swmlMethod = isNode(defs.SWMLMethod) ? defs.SWMLMethod : {};
  const arms = Array.isArray(swmlMethod.anyOf) ? (swmlMethod.anyOf as SNode[]) : [];
  const kept: SNode[] = [];
  const dropped = new Set<string>();
  for (const arm of arms) {
    const wrapper = String(arm.$ref ?? '')
      .split('/')
      .pop()!;
    const wdef = defs[wrapper];
    if (isNode(wdef) && swmlVerbIsDeprecated(wdef)) {
      dropped.add(wrapper);
      continue;
    }
    kept.push(arm);
  }
  if (dropped.size === 0) return defs;
  const out: Record<string, SNode> = {};
  for (const [k, v] of Object.entries(defs)) if (!dropped.has(k)) out[k] = v;
  out.SWMLMethod = { ...swmlMethod, anyOf: kept };
  return out;
}

const PRESENCE_KEYS = new Set(['required', 'anyOf', 'oneOf', 'allOf']);

/**
 * True when every arm constrains only WHICH keys are present (`required` clauses
 * combined by anyOf/oneOf/allOf) — schema.json's one-of rules. Such an `allOf`
 * adds no key and no type, so it must not stop an object from being typed.
 */
function presenceOnly(arms: unknown): boolean {
  if (!Array.isArray(arms) || arms.length === 0) return false;
  for (const arm of arms) {
    if (!isNode(arm) || Object.keys(arm).length === 0) return false;
    if (!Object.keys(arm).every((k) => PRESENCE_KEYS.has(k))) return false;
    const req = arm.required;
    if (req !== undefined && !(Array.isArray(req) && req.every((r) => typeof r === 'string'))) {
      return false;
    }
    for (const key of ['anyOf', 'oneOf', 'allOf']) {
      if (key in arm && !presenceOnly(arm[key])) return false;
    }
  }
  return true;
}

/** `node` minus a presence-only `allOf`; otherwise unchanged. */
function withoutPresenceAllOf(node: SNode): SNode {
  if (!presenceOnly(node.allOf)) return node;
  const out: SNode = {};
  for (const [k, v] of Object.entries(node)) if (k !== 'allOf') out[k] = v;
  return out;
}

/** An inline object schema with named properties (reference `_is_inline_object`). */
function isInlineObject(node: unknown): boolean {
  if (!isNode(node)) return false;
  const n = withoutPresenceAllOf(node);
  return (
    !('$ref' in n) &&
    isNode(n.properties) &&
    Object.keys(n.properties).length > 0 &&
    (n.type === 'object' || n.type === undefined) &&
    !(n.anyOf || n.oneOf || n.allOf)
  );
}

/**
 * Lift every inline property-bearing object into its own named `$def` and point a
 * `$ref` at it, so each becomes a named type — the reference's
 * `hoist_inline_objects`, name for name:
 *   - a verb wrapper's verb object is `<Verb>Config`, its descendants `<Verb>…`;
 *   - any other object is `<Parent><Key>`; an array element adds `Item`;
 *   - a union with ONE object arm gives that arm the union's name; with several,
 *     each takes `<Name><ArmTitle>` (or `<Name>Variant<i>`).
 * A taken name gets a numeric suffix. Originals first, hoisted after, walk order.
 */
function hoistInlineObjects(
  defs: Record<string, SNode>,
  verbRoots: Map<string, string>,
): Record<string, SNode> {
  const taken = new Set(Object.keys(defs));
  const hoisted = new Map<string, SNode>();
  const nameOf = new Map<object, string>();
  const claim = (name: string): string => {
    let cand = name;
    let n = 2;
    while (taken.has(cand)) cand = `${name}${n++}`;
    taken.add(cand);
    return cand;
  };
  const walkChildren = (node: SNode, prefix: string): SNode => {
    const out: SNode = { ...node };
    if (isNode(node.properties)) {
      const props: SNode = {};
      for (const [k, v] of Object.entries(node.properties)) {
        props[k] = visit(v, prefix + pascal(k), prefix + pascal(k));
      }
      out.properties = props;
    }
    if (isNode(node.items)) out.items = visit(node.items, prefix + 'Item', prefix + 'Item');
    if (Array.isArray(node.prefixItems)) {
      out.prefixItems = node.prefixItems.map((p: unknown, i: number) =>
        visit(p, `${prefix}Item${i + 1}`, `${prefix}Item${i + 1}`),
      );
    }
    if (isNode(node.additionalProperties)) {
      out.additionalProperties = visit(
        node.additionalProperties,
        prefix + 'Value',
        prefix + 'Value',
      );
    }
    for (const key of ['anyOf', 'oneOf', 'allOf']) {
      const arms = node[key];
      if (!Array.isArray(arms)) continue;
      const nObj = arms.filter((a) => isInlineObject(a)).length;
      out[key] = arms.map((arm: unknown, i: number) => {
        if (nObj > 1 && isInlineObject(arm)) {
          const title = isNode(arm) && arm.title !== undefined ? String(arm.title) : '';
          const suffix = pascal(title.replace(/[^A-Za-z0-9]+/g, ' '));
          const armName = `${prefix}${suffix || `Variant${i + 1}`}`;
          return visit(arm, armName, armName);
        }
        const own = nameOf.get(node);
        if (own === undefined) throw new Error(`hoist: union at ${prefix} has no name`);
        return visit(arm, own, prefix);
      });
    }
    return out;
  };
  const visit = (node: unknown, name: string, prefix: string): unknown => {
    if (!isNode(node)) return node;
    if (isInlineObject(node)) {
      const final = claim(name);
      // A hoisted object's children are prefixed by its final name, except a verb
      // root, whose children use the bare verb prefix (AiConfig -> AiParams).
      const childPrefix = prefix !== name ? prefix : final;
      hoisted.set(final, {}); // reserve walk order before descending
      hoisted.set(final, walkChildren(withoutPresenceAllOf(node), childPrefix));
      const ref: SNode = { $ref: `#/$defs/${final}` };
      for (const keep of ['description', 'title', 'deprecated', 'x-api-state']) {
        if (keep in node) ref[keep] = node[keep];
      }
      return ref;
    }
    nameOf.set(node, name);
    return walkChildren(node, prefix);
  };
  const out: Record<string, SNode> = {};
  for (const [defName, sch] of Object.entries(defs)) {
    if (!isNode(sch)) {
      out[defName] = sch;
      continue;
    }
    const verb = verbRoots.get(defName);
    if (verb !== undefined) {
      const props: SNode = { ...(isNode(sch.properties) ? sch.properties : {}) };
      const base = pascal(verb);
      props[verb] = visit(props[verb], base + 'Config', base);
      out[defName] = { ...sch, properties: props };
    } else {
      nameOf.set(sch, defName);
      out[defName] = walkChildren(sch, defName);
    }
  }
  for (const [k, v] of hoisted) out[k] = v;
  return out;
}

/**
 * The SWAIG response ENVELOPE types, declared ONCE by SwaigActions.generated.ts
 * (from swaig-response.yaml). schema.json carries the same two shapes as $defs;
 * this module imports them instead of declaring a second copy, and drops the
 * objects hoisted out of them (reference `SWAIG_ENVELOPE_TYPES`).
 */
const SWAIG_ENVELOPE_TYPES = ['SwaigAction', 'SwaigResponse'] as const;

/** The `$ref` of a verb body's config type: its own `$ref`, or its one object arm. */
function verbConfigRef(defs: Record<string, SNode>, inner: SNode): string | null {
  let ref = typeof inner.$ref === 'string' ? inner.$ref : null;
  if (!ref && Array.isArray(inner.anyOf)) {
    const objRefs = (inner.anyOf as unknown[])
      .filter(
        (a): a is SNode =>
          isNode(a) &&
          typeof a.$ref === 'string' &&
          isInlineObject(defs[String(a.$ref).split('/').pop()!]),
      )
      .map((a) => String(a.$ref));
    if (objRefs.length === 1) ref = objRefs[0]!;
  }
  return ref;
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
    $defs?: Record<string, SNode>;
  };
  // Deprecated verbs are not SDK surface (dropped before anything is emitted), and
  // inline objects are lifted to named $defs so a verb config carried inline keeps a
  // typed, named shape — both exactly as the reference generator does.
  let rawDefs = dropDeprecatedSwmlVerbs(schema.$defs ?? {});
  const verbRoots = new Map<string, string>();
  const rootMethod = isNode(rawDefs.SWMLMethod) ? rawDefs.SWMLMethod : {};
  for (const arm of (Array.isArray(rootMethod.anyOf) ? rootMethod.anyOf : []) as SNode[]) {
    const wrapper = String(arm.$ref ?? '')
      .split('/')
      .pop()!;
    const wdef = rawDefs[wrapper];
    const wprops = isNode(wdef) && isNode(wdef.properties) ? Object.keys(wdef.properties) : [];
    if (wprops.length) verbRoots.set(wrapper, wprops[0]!);
  }
  rawDefs = hoistInlineObjects(rawDefs, verbRoots);
  const defs = rawDefs as Record<string, Schema>;
  // The shared resolveRef/flattenSchema/flattenUnion walk a pointer string against
  // the doc root generically, so `#/$defs/<Name>` resolves the same way `#/components
  // /schemas/<Name>` does — the `{ $defs }` root just needs to carry that key. The
  // OpenApiDoc cast is only to satisfy those helpers' parameter type.
  const doc = { $defs: defs } as unknown as OpenApiDoc;

  const decls: string[] = [];
  // 1. One declaration per $defs schema (so every $ref resolves) — except the SWAIG
  //    envelope types (and the objects hoisted out of them), which SwaigActions
  //    .generated.ts declares and this module imports.
  const imported = SWAIG_ENVELOPE_TYPES.filter((n) => n in defs);
  for (const [name, sch] of Object.entries(defs)) {
    const fromEnvelope = imported.some(
      (n) => name === n || (name.startsWith(n) && /^[A-Z]/.test(name.slice(n.length))),
    );
    if (fromEnvelope) continue;
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
    if (inner.type === 'string' || verbConfigRef(rawDefs, inner as SNode)) continue;
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
  const body = decls.join('\n');
  const used = imported.filter((n) => new RegExp(`\\b${n}\\b`).test(body));
  const envelopeImport = used.length
    ? `import type { ${used.join(', ')} } from './SwaigActions.generated.js';\n\n`
    : '';
  const formatted = await formatTs(header + envelopeImport + body, outPath);
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

/** The transformed defs + the config types swml_verbs_generated.ts declares. */
interface TypedSwmlDefs {
  defs: Record<string, SNode>;
  declared: Set<string>;
}

/**
 * Apply the config-module transforms (deprecated verbs dropped, inline objects
 * hoisted) and record which names that module declares — the `$defs` keys plus
 * the flattened `<Verb>Config` of each non-hand-written oneOf/object verb.
 */
function typedSwmlDefs(raw: Record<string, SNode>): TypedSwmlDefs {
  let defs = dropDeprecatedSwmlVerbs(raw);
  const verbRoots = new Map<string, string>();
  const root = isNode(defs.SWMLMethod) ? defs.SWMLMethod : {};
  for (const arm of (Array.isArray(root.anyOf) ? root.anyOf : []) as SNode[]) {
    const wrapper = String(arm.$ref ?? '')
      .split('/')
      .pop()!;
    const wdef = defs[wrapper];
    const wprops = isNode(wdef) && isNode(wdef.properties) ? Object.keys(wdef.properties) : [];
    if (wprops.length) verbRoots.set(wrapper, wprops[0]!);
  }
  defs = hoistInlineObjects(defs, verbRoots);
  return { defs, declared: new Set(Object.keys(defs).map(tsName)) };
}

/**
 * The TS type of a verb method's `config` argument, from the verb body's forms
 * in the transformed schema: the named config type for its object form, plus
 * `string` / `number` / `boolean` / `unknown[]` for the scalar and positional
 * forms the body also accepts. Returns null when no form is typable here (the
 * caller falls back to the legacy mapping).
 */
function verbBodyForms(
  typed: TypedSwmlDefs,
  verb: string,
  inner: SNode,
): { type: string; imports: string[] } | null {
  const parts: string[] = [];
  const imports: string[] = [];
  const add = (t: string): void => {
    if (!parts.includes(t)) parts.push(t);
  };
  const addRef = (ref: string): void => {
    const name = tsName(ref.split('/').pop()!);
    if (!typed.declared.has(name)) return;
    imports.push(name);
    add(name);
  };
  const addScalar = (node: SNode): void => {
    if (typeof node.$ref === 'string') return addRef(node.$ref);
    // A shorthand arm states its base type as the first `allOf` member
    // (`{allOf: [{type: string}, <constraints>]}`).
    if (node.type === undefined && Array.isArray(node.allOf) && isNode(node.allOf[0])) {
      return addScalar(node.allOf[0]);
    }
    switch (node.type) {
      case 'string':
        return add('string');
      case 'integer':
      case 'number':
        return add('number');
      case 'boolean':
        return add('boolean');
      case 'array':
        return add('unknown[]');
      case 'object':
        return add('Record<string, unknown>');
      default:
        return undefined;
    }
  };
  if (Array.isArray(inner.anyOf)) {
    for (const arm of inner.anyOf as unknown[]) if (isNode(arm)) addScalar(arm);
  } else if (inner.oneOf || (inner.type === 'object' && isNode(inner.properties))) {
    const cfg = pascal(verb) + 'Config';
    if (typed.declared.has(cfg)) {
      imports.push(cfg);
      add(cfg);
    } else {
      add('Record<string, unknown>');
    }
  } else {
    addScalar(inner);
  }
  if (parts.length === 0) return null;
  // A body whose only form is a bare variable reference (SWMLVar) keeps the open
  // object form too, matching the pre-hoist signature's `Record<string, unknown>`.
  if (parts.every((p) => p === 'SWMLVar')) add('Record<string, unknown>');
  return { type: parts.join(' | '), imports };
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
  // The same transform the config-type module applies (deprecated verbs dropped,
  // inline objects hoisted to named types), so a verb method can name the config
  // type swml_verbs_generated.ts declares for its body.
  const typed = typedSwmlDefs(defs as unknown as Record<string, SNode>);
  const configImports = new Set<string>();

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
    // A deprecated verb is not SDK surface (owner ruling 2026-09-24): no method.
    if (swmlVerbIsDeprecated(verbDef as unknown as SNode)) continue;

    // Get description
    // schema.json describes a union body by its engine check ("Body shape enforced
    // by …"); the method's summary is the object form's own description.
    const armDesc = (innerSchema.anyOf ?? []).find((a) => a.description)?.description;
    const desc =
      (innerSchema.description?.startsWith('Body shape enforced') ? armDesc : undefined) ??
      innerSchema.description ??
      `Add the ${verbName} verb to the document.`;
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

    const hoistedInner = (
      isNode(typed.defs[schemaName]) && isNode(typed.defs[schemaName]!.properties)
        ? (typed.defs[schemaName]!.properties as SNode)[verbName]
        : undefined
    ) as SNode | undefined;
    const forms = hoistedInner ? verbBodyForms(typed, verbName, hoistedInner) : null;
    let paramSig: string;
    if (forms) {
      for (const n of forms.imports) configImports.add(n);
      // Every form is optional: the verb may be added with no body, and a config
      // type's fields are all optional (open shape) — never narrower than before.
      paramSig = `config?: ${forms.type}`;
    } else {
      const { configType, isOptional } = generateVerbConfig(verbName, innerSchema);
      paramSig = isOptional ? `config?: ${configType}` : `config: ${configType}`;
    }

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

  const importLine = configImports.size
    ? `import type { ${[...configImports].sort().join(', ')} } from './swml_verbs_generated.js';\n\n`
    : '';
  const output = `/**
 * AUTO-GENERATED FILE — do not edit manually.
 * Generated by: npx tsx scripts/generate-swml-verbs.ts
 *
 * Provides TypeScript interface augmentation for all SWML verb methods
 * auto-installed on SwmlBuilder from schema.json.
 */

${importLine}${customInterfaces}

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

  // Both remaining sources are TRACKED files in porting-sdk, so once `psdk` itself
  // resolved they are present in every legitimate configuration. Their absence is
  // therefore NOT a soft "nothing to do" — it is an unverifiable check, and under
  // --check a silent skip is a FALSE GREEN: `emitFile` is never called for the
  // corresponding output, nothing lands in `staleFiles`, and `finalizeCheck` exits 0
  // having compared the committed file against nothing at all. (Measured on this
  // repo: with porting-sdk/schema.json absent the run printed a friendly "skipped"
  // line and exited 0 while all 192 committed SWML verb config types went
  // uncompared.) porting-sdk/schema.json is the legacy hand-maintained SWML spec and
  // is slated for deletion (porting-sdk task #199); on the day it is removed this
  // gate must SAY so rather than report success.
  //
  // This also matches how the `!psdk` branch above already behaves — an
  // unverifiable --check is a hard failure there (exit 2), not a pass. Non-check
  // generate runs stay hard-failing too: emitting a partial tree while exiting 0
  // would silently leave a committed file behind at a stale revision.
  const requireSpec = (specPath: string, what: string, out: string): void => {
    if (fs.existsSync(specPath)) return;
    throw new Error(
      `${what}: spec source not found at ${specPath}. Refusing to skip — under ` +
        `--check a skip would leave the committed ${out} compared against nothing ` +
        `and still exit 0 (a false green). If porting-sdk genuinely no longer ships ` +
        `this spec, update this generator and ${out} deliberately.`,
    );
  };

  // The SWML/CXML webhook platform contracts (manufactured spec from swml.md prose
  // — no upstream OpenAPI).
  const platformSpec = path.join(psdk, 'rest-apis', 'swml-webhooks', 'openapi.yaml');
  requireSpec(platformSpec, 'SWML platform contracts', 'src/PlatformContracts.generated.ts');
  const platformOut = 'src/PlatformContracts.generated.ts';
  const platformN = await generatePlatformContracts(platformSpec, platformOut);
  console.log(`${verb} ${platformOut} (${platformN} types)`);

  // Typed SWML verb CONFIG types from schema.json ($defs). The verb METHOD surface
  // (SwmlVerbMethods.generated.ts) was already emitted above from the vendored
  // src/schema.json.
  const swmlSchema = path.join(psdk, 'schema.json');
  requireSpec(swmlSchema, 'SWML verb contracts', 'src/swml_verbs_generated.ts');
  const swmlOut = 'src/swml_verbs_generated.ts';
  // Verbs this port hand-writes with richer ergonomics — excluded from the verb
  // walk so their <Verb>Config isn't flattened (matches the Python reference's
  // hand_written set; only affects which Config decls are emitted).
  const handWritten = new Set(['answer', 'hangup', 'ai', 'play', 'say']);
  const swmlN = await generateSwmlVerbs(swmlSchema, swmlOut, handWritten);
  console.log(`${verb} ${swmlOut} (${swmlN} types)`);

  finalizeCheck('npx tsx scripts/generate-swml-verbs.ts');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? `generate-swml-verbs: ${err.message}` : err);
  process.exit(1);
});
