/**
 * generate-relay-protocol.ts — RELAY WS protocol type generator.
 *
 * Unlike the REST namespaces (one OpenAPI doc with components/schemas), the relay
 * contracts are one standalone JSON-Schema file per method+phase under
 * porting-sdk/relay-protocol/ (extracted from the C# switchblade wire classes —
 * the canonical RELAY source). Emits src/relay/protocol.types.generated.ts: one
 * interface per `*.params.json` (<Method>Params, method inputs) and per
 * `*.result.json` (<Method>Result, the JSON-RPC ack the method resolves to),
 * named from each schema's `x-method`. The schemas are draft-2020-12 JSON Schema,
 * which the shared tsType()/objectBody() machinery already handles.
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
  const relayDir = path.join(psdk, 'relay-protocol');
  if (fs.existsSync(relayDir)) {
    const relayOut = 'src/relay/protocol.types.generated.ts';
    const n = await generateRelayProtocol(relayDir, relayOut);
    console.log(`${verb} ${relayOut} (${n} types)`);
  } else {
    console.log(
      `skipped RELAY protocol (no relay-protocol/ at ${relayDir}; ` +
        `using committed src/relay/protocol.types.generated.ts).`,
    );
  }

  finalizeCheck('npx tsx scripts/generate-relay-protocol.ts');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? `generate-relay-protocol: ${err.message}` : err);
  process.exit(1);
});
