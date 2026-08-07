/**
 * generate-relay-protocol.ts — RELAY WS protocol type generator.
 *
 * Source (ledger row R11): the canonical porting-sdk `combined-specs/relay.yaml`,
 * read through `scripts/_relay-shapes.ts` — the TypeScript realization of the
 * shared reader `porting-sdk/scripts/relay_protocol_shapes.py`. That reader serves
 * `{method: schema_node}` per phase, merging the shapes carried on a registered
 * method (`methods.<name>.request.params_dto` / `.response.result`) with the six
 * per phase the extractor found for methods the vendored spec does not register
 * (`<phase>_shapes_unattached.methods.<name>`) — 64 methods per phase either way.
 *
 * This replaced a directory of standalone per-method JSON-Schema files
 * (`porting-sdk/relay-protocol/<method>.<params|result>.json`). The method name
 * now comes from the document's own key rather than from an `x-method` field with
 * a filename fallback, and the phase from the block the shape was carried in
 * rather than from a filename suffix.
 *
 * Emits src/relay/protocol.types.generated.ts: one declaration per method+phase —
 * <Method>Params (method inputs) and <Method>Result (the JSON-RPC ack the method
 * resolves to). The nodes are draft-2020-12 JSON Schema, which the shared
 * tsType()/objectBody() machinery already handles.
 *
 * Run: `npx tsx scripts/generate-relay-protocol.ts` (`--check` = the
 * GEN-FRESH-RELAY gate: exit non-zero if the committed file is stale).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CHECK,
  Schema,
  declaration,
  emitFile,
  finalizeCheck,
  formatTs,
  pascal,
  resolvePortingSdk,
} from './_gen-common.js';
import { COMBINED_RELAY, PHASES, Phase, shapes } from './_relay-shapes.js';

/**
 * The TSDoc summary for one declaration, rebuilt from the metadata the combined
 * document carries (`x-source-file`).
 *
 * The legacy per-file tree stored a `description` on each schema, and
 * `declaration()` emitted it as the type's TSDoc. The combined document does not
 * carry it: it was a per-file ENVELOPE key that existed only because each shape
 * was a standalone schema document that had to re-declare its own identity, and
 * `relay_protocol_shapes.py` deliberately does not re-synthesise those keys.
 *
 * But that prose was never hand-written for these: `porting-sdk/scripts/
 * extract_relay_schemas.py` GENERATED it from a fixed template over `method`,
 * `phase` and the source class name — and `x-source-file` still carries that class
 * name. So the summary is DERIVED here from the surviving metadata, rather than
 * either being lost or being frozen into a port-local table of spec prose.
 *
 * Measured against the legacy tree: 122 of 128 shapes reproduce their legacy
 * description EXACTLY, with zero mismatches. The other 6 (`calling.call`,
 * `calling.conference` and `messaging.send`, both phases each) carried
 * hand-written prose that the combined document does not carry in any form —
 * those emit with no TSDoc rather than having a port invent spec text.
 */
function summary(method: string, phase: Phase, schema: Schema): string | undefined {
  const sourceFile = (schema as { 'x-source-file'?: unknown })['x-source-file'];
  if (typeof sourceFile !== 'string' || !sourceFile.endsWith('.cs')) return undefined;
  const cls = sourceFile.slice(sourceFile.lastIndexOf('/') + 1);
  // Two templates, keyed by where in switchblade the class lives — mirroring the
  // extractor's own two call sites.
  if (sourceFile.includes('Messages/')) {
    return (
      `Wire schema for the Blade envelope \`${method}\` (${phase}). ` +
      `Extracted from switchblade \`Messages/${cls}\`.`
    );
  }
  return (
    `Wire schema for the JSON payload of \`${method}\` (${phase}). ` +
    `Extracted from switchblade \`${cls}\`.`
  );
}

async function generateRelayProtocol(psdk: string, outPath: string): Promise<number> {
  // Both phases, params first: <Method>Params (method inputs) then <Method>Result
  // (the JSON-RPC ack the method resolves to). The reader already orders each
  // phase by method name, so there is no sort here.
  const decls: string[] = [];
  for (const phase of PHASES) {
    const suffix = phase === 'params' ? 'Params' : 'Result';
    for (const [method, schema] of shapes(psdk, phase)) {
      // calling.detect.stop → CallingDetectStopParams / CallingDetectStopResult
      const name = pascal(method.replace(/[.]/g, '_')) + suffix;
      const doc = summary(method, phase, schema);
      decls.push(declaration(name, doc ? { ...schema, description: doc } : schema));
    }
  }
  const header =
    `// AUTO-GENERATED from porting-sdk/combined-specs/relay.yaml — DO NOT EDIT.\n` +
    `// Regenerate with: npx tsx scripts/generate-relay-protocol.ts\n//\n` +
    `// One interface per RELAY method's params (<Method>Params) and ack result\n` +
    `// (<Method>Result), from the canonical switchblade wire schemas. Held to the\n` +
    `// same lint bar as hand-written source (no rule suppressions, no loose types).\n\n`;
  const formatted = await formatTs(header + decls.join('\n'), outPath);
  emitFile(outPath, formatted);
  return decls.length;
}

async function main(): Promise<void> {
  const psdk = resolvePortingSdk();
  // Fail-soft: porting-sdk is only adjacent in dev/CI (not in a published
  // consumer's node_modules). The generated file is committed, so when the spec
  // source isn't resolvable we skip regeneration rather than erroring.
  if (!psdk) {
    if (CHECK) {
      console.error(
        'generate-relay-protocol --check: porting-sdk not found — cannot verify generated-type ' +
          'freshness (set $PORTING_SDK or clone adjacent).',
      );
      process.exit(2);
    }
    console.log(
      'generate-relay-protocol: porting-sdk not found (set $PORTING_SDK or clone adjacent) — ' +
        'skipping; using committed src/relay/protocol.types.generated.ts.',
    );
    return;
  }
  const verb = CHECK ? 'checked' : 'generated';
  const relayDoc = path.join(psdk, COMBINED_RELAY);
  if (fs.existsSync(relayDoc)) {
    const relayOut = 'src/relay/protocol.types.generated.ts';
    const n = await generateRelayProtocol(psdk, relayOut);
    console.log(`${verb} ${relayOut} (${n} types)`);
  } else {
    console.log(
      `skipped RELAY protocol (no ${COMBINED_RELAY} at ${relayDoc}; ` +
        `using committed src/relay/protocol.types.generated.ts).`,
    );
  }

  finalizeCheck('npx tsx scripts/generate-relay-protocol.ts');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? `generate-relay-protocol: ${err.message}` : err);
  process.exit(1);
});
