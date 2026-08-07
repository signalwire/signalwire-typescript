/**
 * _relay-shapes.ts — the TypeScript realization of the shared RELAY-protocol
 * reader `porting-sdk/scripts/relay_protocol_shapes.py` (ledger row R11).
 *
 * R11 retires `porting-sdk/relay-protocol/` (130 standalone JSON-Schema files,
 * one per method+phase) in favour of the single combined document
 * `porting-sdk/combined-specs/relay.yaml`, which carries the same shapes as
 *
 *     methods.<name>.request.params_dto        (58 methods)
 *     methods.<name>.response.result           (58 methods)
 *     param_shapes_unattached.methods.<name>   ( 6 methods — extracted, not registered)
 *     result_shapes_unattached.methods.<name>  ( 6 methods)
 *
 * …64 methods per phase either way. This module exposes the one thing the
 * generator needs — `shapes(psdk, phase) -> Map<method, node>`, deterministically
 * ordered by method name — so the generator's loop is "iterate the mapping"
 * rather than "glob, split the suffix, read x-method with a filename fallback".
 *
 * WHY A TypeScript PORT RATHER THAN CALLING THE PYTHON READER
 * -----------------------------------------------------------
 * Go ported the reader for the same reason and the reasoning here is the same
 * shape: this generator is one of five siblings that all read their spec
 * directly with `js-yaml` (already a direct dependency of `_gen-common.ts` and
 * of every other generator). Shelling out to `python3` would make a TS build
 * step depend on a Python interpreter AND on PyYAML at generate time — a new
 * cross-language runtime dependency none of the other four generators carry,
 * and one that `resolvePortingSdk()`'s deliberately fail-soft contract (a
 * published consumer has no porting-sdk at all) would not be able to degrade
 * cleanly around. Reading the YAML in-process keeps the generator single-
 * language, dependency-free beyond what is already installed, and synchronous.
 *
 * The Python module is the SPEC this file implements; its invariants are
 * pinned by `porting-sdk/tests/test_relay_protocol_shapes.py`, and the two are
 * kept honest by the GEN-FRESH-RELAY gate byte-comparing the emitted output.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type { Schema } from './_gen-common.js';

/** Where the combined RELAY document lives, relative to the porting-sdk root. */
export const COMBINED_RELAY = 'combined-specs/relay.yaml';

export type Phase = 'params' | 'result';

/** The two phases this reader serves, params first (the emit order). */
export const PHASES: readonly Phase[] = ['params', 'result'] as const;

/**
 * phase -> [containing block, shape key, the unattached top-level block].
 *
 * These are the ONLY phases. The legacy tree's `.event.json` files were a third
 * phase (`x-phase: event`) that no RELAY-protocol generator ever emitted — every
 * one filters to the two suffixes below — so they are out of scope here exactly
 * as they were out of scope there.
 */
const PHASE_BLOCKS: Record<Phase, readonly [string, string, string]> = {
  params: ['request', 'params_dto', 'param_shapes_unattached'],
  result: ['response', 'result', 'result_shapes_unattached'],
};

/**
 * The one keyword-spelling pair this reader folds, as [snake, camel].
 *
 * The combined document has spelled ONE JSON-Schema keyword two ways. The fix
 * landed at the emitter (`spec_pipeline.py` now carries `additionalProperties`
 * through verbatim, so relay.yaml measures 0 snake / 207 camel nodes), which
 * makes this fold a NO-OP on emitter-owned nodes today. It stays as read-time
 * TOLERANCE — for the vendored nodes that never pass through that carriage, and
 * for anyone holding an older combined-specs checkout.
 *
 * CANONICAL FORM IS camelCase, per the owner ruling of 2026-08-06 ("same case as
 * we did in legacy" — and legacy is camel unanimously: 158 camel / 0 snake across
 * the 130 legacy files). That is also the only spelling JSON Schema defines, and
 * the only one `_gen-common.ts` reads (`objectBody` line ~550). Serving the snake
 * spelling to this emitter makes the keyword INVISIBLE: 124 of 128 types lose
 * their `[key: string]: unknown` open tail and `SignalwireDisconnectResult`
 * degrades to a syntactically invalid empty-bodied interface (`tsc` exits 2).
 *
 * The table is EXPLICIT and small, never a regex over key names — a blanket case
 * rewrite would rename real DATA. `max_length` is a live SWML wire parameter of
 * the `record` verb and is deliberately absent for exactly that reason.
 */
const KEYWORD_CASE_PAIRS: readonly (readonly [string, string])[] = [
  ['additional_properties', 'additionalProperties'],
];

/**
 * Keys whose VALUE is a real JSON-Schema subtree rather than more of the combined
 * document's own envelope vocabulary. The fold STOPS at these.
 *
 * This boundary is load-bearing and measured, not guessed. The document mixes two
 * vocabularies: the envelope level (the pipeline's own carriage vocabulary, where
 * the house snake_case convention applies) and, inside `properties`, literal JSON
 * Schema copied VERBATIM out of the legacy tree. Folding INSIDE `properties` would
 * rewrite bytes the legacy tree owns and break the byte-identical-`properties`
 * contract every port generator depends on — measured when the Python fold was
 * first written unscoped: 12 of 64 params and 2 of 64 result shapes stopped
 * matching the legacy tree.
 */
const SCHEMA_SUBTREE_KEYS: ReadonlySet<string> = new Set([
  'properties',
  'items',
  'prefixItems',
  '$defs',
]);

type Node = Record<string, unknown>;

/**
 * `node` with the combined document's OWN keyword spelling folded to camelCase.
 *
 * Recursive and PURE — the parsed document is never mutated. Applied on the way
 * OUT so every consumer sees exactly one vocabulary. Only the names in
 * KEYWORD_CASE_PAIRS move; any other key — including a payload field that merely
 * LOOKS like a keyword — passes through untouched. A node carrying both spellings
 * keeps the canonical one and drops the alias (measured empty today; a guard
 * against future drift, not a live policy).
 */
export function normaliseKeywords(value: unknown, inSchema = false): unknown {
  if (Array.isArray(value)) return value.map((item) => normaliseKeywords(item, inSchema));
  if (value !== null && typeof value === 'object') {
    const out: Node = {};
    for (const [key, inner] of Object.entries(value as Node)) {
      let folded = key;
      if (!inSchema) {
        for (const [snake, camel] of KEYWORD_CASE_PAIRS) if (key === snake) folded = camel;
      }
      // An already-canonical key wins over its alias; never clobber it.
      if (folded !== key && folded in out) continue;
      out[folded] = normaliseKeywords(inner, inSchema || SCHEMA_SUBTREE_KEYS.has(key));
    }
    return out;
  }
  return value;
}

const CACHE = new Map<string, Node>();

/**
 * Parse combined-specs/relay.yaml once per porting-sdk root.
 *
 * Fails LOUD on a missing or malformed document: a generator that silently
 * produced zero types because its input vanished would look like a successful
 * surface deletion, which is the failure mode this whole lane exists to prevent.
 */
function load(psdk: string): Node {
  const key = path.resolve(psdk);
  const cached = CACHE.get(key);
  if (cached) return cached;
  const docPath = path.join(key, COMBINED_RELAY);
  if (!fs.existsSync(docPath)) {
    throw new Error(`relay-shapes: ${docPath} not found (need a porting-sdk checkout)`);
  }
  const doc = yaml.load(fs.readFileSync(docPath, 'utf-8')) as Node | undefined;
  if (!doc || typeof doc !== 'object' || typeof doc.methods !== 'object' || !doc.methods) {
    throw new Error(
      `relay-shapes: ${docPath} has no \`methods\` mapping — refusing to emit an ` +
        `empty RELAY surface from a malformed spec`,
    );
  }
  CACHE.set(key, doc);
  return doc;
}

function isRecord(v: unknown): v is Node {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * method name -> the carried schema node for `phase`, ordered by method name.
 *
 * Both sources of a shape are merged, attached first:
 *   - `methods.<name>.request.params_dto` / `.response.result` — the shape attached
 *     to a method the vendored spec registers;
 *   - `<phase>_shapes_unattached.methods.<name>` — a shape the extractor found whose
 *     method the vendored spec does NOT register. Carried rather than dropped:
 *     dropping them would silently shrink the port surface relative to the legacy
 *     tree, which had no such distinction.
 *
 * The returned nodes speak the JSON-Schema vocabulary (`additionalProperties`) —
 * the equivalent of the Python reader's `shapes_for_schema_consumers`, which is the
 * entry point a generator feeding real schema-shaped logic must use.
 */
export function shapes(psdk: string, phase: Phase): Map<string, Schema> {
  const blocks = PHASE_BLOCKS[phase];
  if (!blocks) throw new Error(`relay-shapes: unknown phase ${phase}`);
  const [block, shapeKey, unattachedKey] = blocks;
  const doc = load(psdk);

  const out = new Map<string, Node>();
  const methods = isRecord(doc.methods) ? doc.methods : {};
  for (const [name, method] of Object.entries(methods)) {
    if (!isRecord(method)) continue;
    const carrier = method[block];
    if (!isRecord(carrier)) continue;
    const node = carrier[shapeKey];
    if (isRecord(node)) out.set(name, node);
  }

  const unattachedBlock = doc[unattachedKey];
  const unattached =
    isRecord(unattachedBlock) && isRecord(unattachedBlock.methods) ? unattachedBlock.methods : {};
  for (const [name, node] of Object.entries(unattached)) {
    if (isRecord(node) && !out.has(name)) out.set(name, node);
  }

  // Deterministic order + the keyword fold on the way out (see normaliseKeywords):
  // done here rather than in `load` so the cached document stays byte-faithful to
  // the file on disk.
  const sorted = new Map<string, Schema>();
  for (const name of [...out.keys()].sort()) {
    sorted.set(name, normaliseKeywords(out.get(name)) as Schema);
  }
  return sorted;
}
