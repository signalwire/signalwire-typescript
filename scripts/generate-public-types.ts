/**
 * generate-public-types.ts — emit the PUBLIC type barrels that re-export the
 * generated REST/Relay wire & serialization DTOs from the package root.
 *
 * The problem this closes (issue #19530): every `RestClient.*` and `Call.*`
 * method takes/returns a generated `*Request`/`*Response`/`*Params`/`*Result`
 * type, but the namespace `*.types.generated.ts` files are internal — no barrel
 * re-exports them. A consumer calling `client.compat.calls.list()` or building a
 * `CallCreateRequest` body cannot name the type, and is forced into `as`,
 * `ReturnType<typeof …>`, or `any`. This generator surfaces those DTOs so they
 * are importable from `@signalwire/sdk`.
 *
 * Unlike the other generators, this one does NOT read porting-sdk specs — it
 * reads the already-committed `*.types.generated.ts` outputs (the product of
 * generate-rest-types / generate-relay-protocol) and re-exports their public
 * DTOs. That makes it self-contained: it runs identically in dev, in CI, and in
 * a consumer checkout with no porting-sdk adjacent. It is ordered AFTER the type
 * generators in `prebuild`, so when porting-sdk IS present and the type files
 * are regenerated, the barrels reflect the fresh set on the same run.
 *
 * Two barrels are emitted:
 *   - src/rest/types.public.generated.ts — every `*Request` / `*Response` type
 *     declared across src/rest/namespaces/<ns>.types.generated.ts (the method
 *     param/return DTOs). A handful of names are declared, with DIFFERENT shapes,
 *     in more than one namespace spec (e.g. fabric vs relay-rest
 *     `SipEndpointResponse`); those genuine collisions cannot be re-exported flat
 *     under one name, so each occurrence is aliased with its namespace prefix
 *     (`FabricSipEndpointResponse`, `RelayRestSipEndpointResponse`). All other
 *     names stay flat, so the common cases from the issue (`CallCreateRequest`,
 *     `CallResponse`, `CallListResponse`) import directly.
 *   - src/relay/types.public.generated.ts — the relay protocol wire DTOs
 *     (`Calling*Params` / `Calling*Result`) from
 *     src/relay/protocol.types.generated.ts, which back the `Call.*` signatures.
 *
 * Run: `npx tsx scripts/generate-public-types.ts` (wired into prebuild after the
 * type generators). `--check` fails if the committed barrels are stale.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CHECK, emitFile, finalizeCheck, formatTs, pascal } from './_gen-common.js';

const REST_NS_DIR = 'src/rest/namespaces';
const REST_OUT = 'src/rest/types.public.generated.ts';
const RELAY_PROTOCOL = 'src/relay/protocol.types.generated.ts';
const RELAY_OUT = 'src/relay/types.public.generated.ts';

/** Every top-level `export interface|type <Name>` declared in a generated file. */
function exportedTypeNames(file: string): string[] {
  const src = fs.readFileSync(file, 'utf-8');
  const names: string[] = [];
  const re = /^export (?:interface|type) ([A-Za-z_][A-Za-z0-9_]*)\b/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) names.push(m[1]);
  return names;
}

/** The namespace leaf of a `<ns>.types.generated.ts` file (e.g. `relay-rest`). */
function nsLeaf(file: string): string {
  return path.basename(file).replace(/\.types\.generated\.ts$/, '');
}

/** A re-export member: the source name plus its public (possibly aliased) name. */
interface Member {
  source: string;
  exported: string;
}

/**
 * Build the per-module re-export groups for the REST DTOs. Names that resolve to
 * exactly one namespace are re-exported flat; names declared in more than one
 * (genuine cross-spec collisions with different shapes) are namespace-prefixed so
 * every one stays importable under a stable, unambiguous identifier.
 */
function restGroups(): { module: string; members: Member[] }[] {
  const files = fs
    .readdirSync(REST_NS_DIR)
    .filter((f) => f.endsWith('.types.generated.ts'))
    .sort();

  // name -> namespace leaves that declare it (only the *Request/*Response set).
  const owners = new Map<string, string[]>();
  const perFile = new Map<string, string[]>();
  for (const f of files) {
    const dto = exportedTypeNames(path.join(REST_NS_DIR, f)).filter((n) =>
      /(Request|Response)$/.test(n),
    );
    perFile.set(f, dto);
    for (const n of dto) owners.set(n, [...(owners.get(n) ?? []), nsLeaf(f)]);
  }

  const seen = new Set<string>();
  const groups: { module: string; members: Member[] }[] = [];
  for (const f of files) {
    const dto = perFile.get(f) ?? [];
    if (dto.length === 0) continue;
    const leaf = nsLeaf(f);
    const members: Member[] = dto
      .map((source) => {
        const collides = (owners.get(source) ?? []).length > 1;
        const exported = collides ? `${pascal(leaf)}${source}` : source;
        return { source, exported };
      })
      .sort((a, b) => a.exported.localeCompare(b.exported));
    for (const m of members) {
      if (seen.has(m.exported)) {
        throw new Error(
          `generate-public-types: public name collision on '${m.exported}' ` +
            `(from ${leaf}.types.generated.ts). Two DTOs would export the same ` +
            `identifier — extend the disambiguation rule.`,
        );
      }
      seen.add(m.exported);
    }
    groups.push({ module: `./namespaces/${leaf}.types.generated.js`, members });
  }
  return groups;
}

/** Render an `export type { … } from '<module>';` block for one source module. */
function renderGroup(module: string, members: Member[]): string {
  const specifiers = members.map((m) =>
    m.exported === m.source ? m.source : `${m.source} as ${m.exported}`,
  );
  return `export type {\n  ${specifiers.join(',\n  ')},\n} from '${module}';`;
}

const REST_HEADER =
  `// AUTO-GENERATED from src/rest/namespaces/*.types.generated.ts — DO NOT EDIT.\n` +
  `// Regenerate with: npx tsx scripts/generate-public-types.ts\n//\n` +
  `// The public re-export barrel for the REST wire & serialization DTOs — the\n` +
  `// generated \`*Request\`/\`*Response\` types every RestClient method takes and\n` +
  `// returns. Wired into src/rest/index.ts so they import from '@signalwire/sdk'.\n` +
  `// Cross-spec name collisions (same identifier, different shape in two specs)\n` +
  `// are namespace-prefixed; all other names are re-exported flat.\n\n`;

const RELAY_HEADER =
  `// AUTO-GENERATED from src/relay/protocol.types.generated.ts — DO NOT EDIT.\n` +
  `// Regenerate with: npx tsx scripts/generate-public-types.ts\n//\n` +
  `// The public re-export barrel for the RELAY protocol wire DTOs — the generated\n` +
  `// \`Calling*Params\` / \`Calling*Result\` types that back the Call.* signatures.\n` +
  `// Wired into src/relay/index.ts so they import from '@signalwire/sdk'.\n\n`;

async function main(): Promise<void> {
  // REST barrel.
  const groups = restGroups();
  const restBody = groups.map((g) => renderGroup(g.module, g.members)).join('\n\n');
  const restRaw = REST_HEADER + restBody + '\n';
  emitFile(REST_OUT, await formatTs(restRaw, REST_OUT));
  const restCount = groups.reduce((n, g) => n + g.members.length, 0);
  console.log(`${CHECK ? 'checked' : 'generated'} ${REST_OUT} (${restCount} DTOs)`);

  // Relay barrel — the protocol wire DTOs, in declaration order.
  const relayNames = exportedTypeNames(RELAY_PROTOCOL);
  const relayBody = `export type {\n  ${relayNames.join(',\n  ')},\n} from './protocol.types.generated.js';`;
  const relayRaw = RELAY_HEADER + relayBody + '\n';
  emitFile(RELAY_OUT, await formatTs(relayRaw, RELAY_OUT));
  console.log(`${CHECK ? 'checked' : 'generated'} ${RELAY_OUT} (${relayNames.length} DTOs)`);

  finalizeCheck('npx tsx scripts/generate-public-types.ts');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? `generate-public-types: ${err.message}` : err);
  process.exit(1);
});
