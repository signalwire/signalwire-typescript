/**
 * generate-rest-tests.ts — the REST *wire-test* generator for the TypeScript SDK.
 *
 * The TS port of the portable REST-test algorithm (porting-sdk/REST_TEST_GENERATOR_RULES.md,
 * reference: generate_python_rest_types.py::generate_rest_tests). For every REST route the SDK
 * IMPLEMENTS it emits, into tests/rest/<spec>_generated.test.ts:
 *   - a SUCCESS test: call the real SDK method against the shared mock harness, assert the mock
 *     journaled the expected (method, matched_route);
 *   - an ERROR test: arm a 5xx for that route and assert the SDK rejects with RestError
 *     (statusCode 500).
 *
 * The assertion oracle is INDEPENDENT of the resource generator (RULES §1): the (method, path)
 * to call comes from the route registry (scripts/route-registry.ts — captured from the real
 * client), and the matched_route to assert comes from the OpenAPI operationId
 * (<spec_name>.<operationId>, the same value the mock derives its route table from). A generated
 * test therefore catches SDK-vs-contract drift, not a generator self-snapshot.
 *
 * Inputs joined by (METHOD, normalized-path) (RULES §2):
 *   1. the route registry's `routes` (the SDK's real routes, every path param normalized to {id});
 *   2. the OpenAPI specs' operationIds (the spec path normalized the SAME way before the join).
 * Routing collisions are resolved longest-template-wins (RULES §7) so the asserted route is the
 * one the mock actually journals.
 *
 * Call args are type-correct (RULES §4): each method's real parameter types are resolved with the
 * TypeScript compiler API off the live SDK source, and a value of the right kind is synthesized
 * (string→'x', number→1, boolean→true, array→[], object/interface→{}, string-literal union→first
 * member). Generated files are strict-clean BY CONSTRUCTION (RULES §6) so they pass tsc + the
 * test typecheck with no suppressions.
 *
 * GEN-FRESH: re-running the generator must produce byte-identical output (the FMT/GEN gate).
 *
 * Run:   npx tsx scripts/generate-rest-tests.ts
 *        npx tsx scripts/generate-rest-tests.ts --check   (freshness gate, exit 1 if stale)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import yaml from 'js-yaml';
import * as prettier from 'prettier';
import { RestClient } from '../src/rest/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_REST = path.join(REPO_ROOT, 'src', 'rest');
const TESTS_REST = path.join(REPO_ROOT, 'tests', 'rest');

// $PORTING_SDK / $PORTING_SDK_PATH first, adjacency only as a fallback.
//
// Adjacency alone is FALSE IN CI. This repo is checked out INSIDE porting-sdk's workspace
// there, so `REPO_ROOT/../porting-sdk` resolved to
// `<runner-workspace>/porting-sdk/porting-sdk/porting-sdk/rest-apis` -- note the tripled
// segment -- and GEN-FRESH-TESTS reported `STALE (exit 2)` when nothing was stale at all.
// exit 2 is this script's missing-input code; a genuine staleness exits 1.
//
// run-ci.sh already exports BOTH names for exactly this reason (see its comment: "so the tsx
// subprocesses ... find porting-sdk instead of falling back to a hardcoded absolute path"),
// and three workflows set PORTING_SDK_PATH. enumerate-signatures.ts reads PORTING_SDK,
// enumerate-surface.ts / enumerate-doc-surface.ts read PORTING_SDK_PATH, and emit-skills.ts
// takes env-then-adjacency. This script was the one tsx entry point honouring neither, so it
// was the only one that broke when the checkout layout changed.
const PORTING_SDK =
  [
    process.env['PORTING_SDK'],
    process.env['PORTING_SDK_PATH'],
    path.resolve(REPO_ROOT, '..', 'porting-sdk'),
  ]
    .filter((p): p is string => Boolean(p))
    .find((p) => fs.existsSync(path.join(p, 'rest-apis'))) ??
  // Keep the adjacent guess when nothing resolves, so the error below names the conventional
  // location rather than `undefined`.
  path.resolve(REPO_ROOT, '..', 'porting-sdk');
const REST_APIS = path.join(PORTING_SDK, 'rest-apis');

// The path-param sentinel the route registry substitutes back to {id}.
const REG_SENTINEL_NORM = '{id}';
// The route registry's known capture artifact for a SECOND path param: it passes `{}` as the
// second positional arg, which stringifies to `[object Object]` (URL-encoded `[object%20Object]`)
// in the captured path. We normalize it to {id} so multi-path-param routes still join. (This is
// a route-registry capture bug — reported, not silenced: it under-captures the 2nd param's value
// but the (method, normalized-path) shape still joins correctly to the spec operationId.)
const REG_OBJOBJ = /\/\[object(%20| )Object\]/g;

interface RouteRec {
  method: string;
  path_template: string;
  via: string[];
}

interface JoinedRow {
  method: string;
  path: string; // registry path_template (normalized to {id})
  opId: string; // <spec_name>.<operationId>
  via: string; // <ns>.<resource>.<method>
  spec: string; // spec dir name (= matched_route prefix; the test-file group key)
}

// ---------------------------------------------------------------------------
// 1. The route registry — captured from the real client (RULES §3).
// ---------------------------------------------------------------------------
//
// We re-use scripts/route-registry.ts by spawning it (it already constructs the live client with
// a recording fetch and walks every namespace/resource/method). Reading its JSON keeps a SINGLE
// capture implementation (no second walk that could drift).

function loadRegistry(): RouteRec[] {
  const out = execFileSync('npx', ['tsx', path.join(REPO_ROOT, 'scripts', 'route-registry.ts')], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, SIGNALWIRE_LOG_MODE: 'off' },
    maxBuffer: 64 * 1024 * 1024,
  });
  // route-registry.ts may emit a log line before the JSON; slice from the first '{'.
  const json = out.slice(out.indexOf('{'));
  const parsed = JSON.parse(json) as { routes: RouteRec[] };
  return parsed.routes;
}

// ---------------------------------------------------------------------------
// 2. The join — registry routes × spec operationIds by (method, normalized-path) (RULES §2).
// ---------------------------------------------------------------------------

function normParams(p: string): string {
  // Every {param} → {id} (the registry already does this for its captured params; do it to the
  // spec path so renamed params — {token_id}, {name} — line up). Also fold the registry's
  // [object Object] 2nd-param artifact to {id}.
  return p.replace(REG_OBJOBJ, '/' + REG_SENTINEL_NORM).replace(/\{[^}]+\}/g, '{id}');
}

function wireKey(p: string): string {
  // All params → X: the wire-identical key used for collision ranking.
  return p.replace(REG_OBJOBJ, '/X').replace(/\{[^}]+\}/g, 'X');
}

function specPrefix(doc: any): string {
  const url: string = doc?.servers?.[0]?.url ?? '';
  const i = url.indexOf('signalwire.com');
  return i >= 0 ? url.slice(i + 'signalwire.com'.length) : '';
}

function join(routes: RouteRec[]): JoinedRow[] {
  // (method, normalized-path) → matched_route, and (method, wireKey) → longest-template winner.
  const opBy = new Map<string, string>();
  const wireWinner = new Map<string, { len: number; route: string }>();

  const specDirs = fs
    .readdirSync(REST_APIS)
    .filter((d) => fs.existsSync(path.join(REST_APIS, d, 'openapi.yaml')))
    .sort();

  for (const spec of specDirs) {
    const doc = yaml.load(
      fs.readFileSync(path.join(REST_APIS, spec, 'openapi.yaml'), 'utf-8'),
    ) as any;
    const prefix = specPrefix(doc);
    for (const [p, methods] of Object.entries((doc?.paths ?? {}) as Record<string, any>)) {
      const orig = prefix + p; // original spec path with real param names
      const full = orig.replace(/\{[^}]+\}/g, '{id}');
      const wk = orig.replace(/\{[^}]+\}/g, 'X');
      for (const [verb, op] of Object.entries(methods as Record<string, any>)) {
        if (!op || typeof op !== 'object' || !op.operationId) continue;
        const route = `${spec}.${op.operationId}`;
        opBy.set(`${verb.toUpperCase()} ${full}`, route);
        const cur = wireWinner.get(`${verb.toUpperCase()} ${wk}`);
        if (!cur || orig.length > cur.len) {
          wireWinner.set(`${verb.toUpperCase()} ${wk}`, { len: orig.length, route });
        }
      }
    }
  }

  const rows: JoinedRow[] = [];
  for (const r of routes) {
    const np = normParams(r.path_template);
    if (!opBy.has(`${r.method} ${np}`) || !r.via.length) continue; // helper route w/o spec op — skip
    const winner = wireWinner.get(`${r.method} ${wireKey(r.path_template)}`)!;
    const opId = winner.route;
    const spec = opId.slice(0, opId.indexOf('.'));
    rows.push({ method: r.method, path: np, opId, via: r.via[0], spec });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 3. Type-correct call synthesis (RULES §4).
// ---------------------------------------------------------------------------
//
// We resolve each method's REAL parameter types with the TS compiler (the analog of Python's
// inspect.signature + annotation introspection). The live client gives us the method's host
// CLASS (via constructor.name) and method name; the checker resolves inherited + generic-bound
// signatures and aliases.

interface ParamInfo {
  name: string;
  type: ts.Type;
  optional: boolean;
}

class SignatureResolver {
  private checker: ts.TypeChecker;
  private program: ts.Program;
  // className -> methodName -> params
  private byClassMethod = new Map<string, Map<string, ParamInfo[]>>();

  constructor() {
    const configPath = path.join(REPO_ROOT, 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile).config;
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, REPO_ROOT);
    // Limit the program to the REST source tree for speed.
    const files = parsed.fileNames.filter((f) => f.startsWith(SRC_REST));
    this.program = ts.createProgram(files.length ? files : parsed.fileNames, {
      ...parsed.options,
      noEmit: true,
    });
    this.checker = this.program.getTypeChecker();
    this.index();
  }

  private index(): void {
    for (const sf of this.program.getSourceFiles()) {
      if (!sf.fileName.startsWith(SRC_REST)) continue;
      ts.forEachChild(sf, (node) => {
        if (ts.isClassDeclaration(node) && node.name) {
          this.indexClass(node.name.text, node);
        }
      });
    }
  }

  private indexClass(className: string, node: ts.ClassDeclaration): void {
    const sym = this.checker.getSymbolAtLocation(node.name!);
    if (!sym) return;
    const type = this.checker.getDeclaredTypeOfSymbol(sym);
    const methods = new Map<string, ParamInfo[]>();
    // getPropertiesOfType resolves inherited members (base classes / generic instantiation).
    for (const prop of this.checker.getPropertiesOfType(type)) {
      const propType = this.checker.getTypeOfSymbolAtLocation(prop, node);
      const sigs = propType.getCallSignatures();
      if (!sigs.length) continue;
      const sig = sigs[0]!;
      const params: ParamInfo[] = sig.getParameters().map((ps) => {
        const decl = ps.valueDeclaration as ts.ParameterDeclaration | undefined;
        const optional =
          !!decl && (!!decl.questionToken || !!decl.initializer || !!decl.dotDotDotToken);
        return {
          name: ps.getName(),
          type: this.checker.getTypeOfSymbolAtLocation(ps, decl ?? node),
          optional,
        };
      });
      methods.set(prop.getName(), params);
    }
    this.byClassMethod.set(className, methods);
  }

  params(className: string, methodName: string): ParamInfo[] | undefined {
    return this.byClassMethod.get(className)?.get(methodName);
  }

  /** A literal source-text sentinel for a parameter type (RULES §4 / Python _sentinel_for). */
  sentinel(type: ts.Type, depth = 0): string {
    if (depth > 8) return "'x'";

    // Unwrap unions: a `T | undefined` (optional) reduces to T; a real union of string literals
    // picks the first member; otherwise pick the first non-undefined constituent.
    if (type.isUnion()) {
      const parts = type.types.filter(
        (t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)),
      );
      // All-string-literal union (enum) → first literal member.
      if (parts.length && parts.every((t) => t.isStringLiteral())) {
        return JSON.stringify((parts[0] as ts.StringLiteralType).value);
      }
      if (parts.length === 1) return this.sentinel(parts[0]!, depth + 1);
      if (parts.length) return this.sentinel(parts[0]!, depth + 1);
      return "'x'";
    }

    if (type.isStringLiteral()) return JSON.stringify((type as ts.StringLiteralType).value);
    if (type.isNumberLiteral()) return String((type as ts.NumberLiteralType).value);
    if (type.flags & ts.TypeFlags.BooleanLiteral) {
      return this.checker.typeToString(type) === 'true' ? 'true' : 'false';
    }
    if (type.flags & ts.TypeFlags.String) return "'x'";
    if (type.flags & ts.TypeFlags.Number) return '1';
    if (type.flags & ts.TypeFlags.Boolean) return 'true';

    // Array / tuple → [].
    if (this.checker.isArrayType(type) || this.checker.isTupleType(type)) return '[]';

    // Object / interface / TypedDict-like. A bare `{}` fails to type-check against a closed
    // request type that has REQUIRED fields (TS2345 under strict). So fill each required
    // property with its own sentinel; optional props are omitted. An index-signature-only /
    // all-optional object still yields `{}`.
    if (type.flags & ts.TypeFlags.Object) {
      const required = this.checker
        .getPropertiesOfType(type)
        .filter((sym) => !(sym.flags & ts.SymbolFlags.Optional));
      if (required.length === 0) return '{}';
      const entries = required.map((sym) => {
        const propType = this.checker.getTypeOfSymbolAtLocation(
          sym,
          sym.valueDeclaration ?? sym.declarations?.[0] ?? (undefined as unknown as ts.Node),
        );
        const key = /^[A-Za-z_$][\w$]*$/.test(sym.name) ? sym.name : JSON.stringify(sym.name);
        return `${key}: ${this.sentinel(propType, depth + 1)}`;
      });
      return `{ ${entries.join(', ')} }`;
    }

    // any / unknown / fallback.
    return "'x'";
  }
}

// ---------------------------------------------------------------------------
// 4. Walk the live client to map each `via` -> (class, method, instance) (RULES §4).
// ---------------------------------------------------------------------------

interface CallInfo {
  className: string;
  method: string;
}

function buildClientCallIndex(): Map<string, CallInfo> {
  // via path (<ns>.<resource>.<method>) -> {className, method}. Mirror the registry's attribute
  // walk: a flat namespace doubles its name (calling.calling.dial -> client.calling.dial).
  const client = new RestClient({ project: 'p', token: 't', host: 'example.signalwire.com' });
  const index = new Map<string, CallInfo>();

  function methodsOf(obj: object): string[] {
    const names = new Set<string>();
    let proto = Object.getPrototypeOf(obj);
    while (proto && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor' || name.startsWith('_')) continue;
        const desc = Object.getOwnPropertyDescriptor(proto, name);
        if (desc && typeof desc.value === 'function') names.add(name);
      }
      proto = Object.getPrototypeOf(proto);
    }
    return [...names];
  }

  function record(nsName: string, resName: string, res: object): void {
    const className = res.constructor.name;
    for (const m of methodsOf(res)) {
      index.set(`${nsName}.${resName}.${m}`, { className, method: m });
    }
  }

  for (const [nsName, ns] of Object.entries(client)) {
    if (nsName.startsWith('_')) continue;
    if (typeof ns !== 'object' || ns === null || ns.constructor === Object) continue;
    if (methodsOf(ns).length > 0) record(nsName, nsName, ns);
    for (const [resName, res] of Object.entries(ns)) {
      if (resName.startsWith('_')) continue;
      if (typeof res !== 'object' || res === null || (res as object).constructor === Object)
        continue;
      record(nsName, resName, res as object);
    }
  }
  return index;
}

/** A literal `<ns-relative call expr>` for a via path, or null if uninvokable. */
function synthCall(
  via: string,
  callIndex: Map<string, CallInfo>,
  resolver: SignatureResolver,
): string | null {
  // Collapse the flat-namespace leading duplicate (calling.calling.dial -> calling.dial) for the
  // emitted client.<...> expression; container namespaces (video.rooms.get) keep all segments.
  const segs = via.split('.');
  const attr = segs.length >= 2 && segs[0] === segs[1] ? segs.slice(1).join('.') : via;

  const info = callIndex.get(via);
  if (!info) return null;
  const params = resolver.params(info.className, info.method);
  if (!params) return null;

  const args: string[] = [];
  for (const p of params) {
    if (p.optional) break; // optional params (and the trailing rest/extras) are omitted
    args.push(resolver.sentinel(p.type));
  }
  return `client.${attr}(${args.join(', ')})`;
}

// ---------------------------------------------------------------------------
// 5. Emit (RULES §5) — one tests/rest/<spec>_generated.test.ts per spec namespace.
// ---------------------------------------------------------------------------

function header(spec: string): string {
  return `/**
 * AUTO-GENERATED REST wire tests for the \`${spec}\` namespace — DO NOT EDIT.
 * Regenerate: npx tsx scripts/generate-rest-tests.ts
 *
 * Each route the SDK implements (captured from the real client by scripts/route-registry.ts,
 * joined to the spec operationId) gets a SUCCESS test (call it, assert method + matched_route on
 * the mock journal) and an ERROR test (arm a 5xx, assert RestError). The assertion oracle is the
 * spec operationId — independent of the resource generator — so these catch SDK-vs-contract
 * drift, not a generator self-snapshot. Full-mock harness fixtures.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';
import { RestError } from '../../src/rest/RestError.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});
`;
}

function slug(via: string): string {
  // The resource.method tail of the via, slugified — stable for GEN-FRESH.
  const tail = via.slice(via.indexOf('.') + 1);
  return tail.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/g, '');
}

async function emit(
  rows: RowWithCall[],
  check: boolean,
): Promise<{ total: number; stale: string[] }> {
  const bySpec = new Map<string, RowWithCall[]>();
  for (const r of rows) {
    if (!bySpec.has(r.spec)) bySpec.set(r.spec, []);
    bySpec.get(r.spec)!.push(r);
  }

  const stale: string[] = [];
  let total = 0;
  const prettierConfig = (await prettier.resolveConfig(path.join(TESTS_REST, 'x.ts'))) ?? {};

  for (const [spec, srows] of [...bySpec.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    srows.sort((a, b) => (a.via + a.method).localeCompare(b.via + b.method));
    const lines: string[] = [header(spec), '', `describe('${spec} wire (generated)', () => {`];
    for (const r of srows) {
      const name = slug(r.via);
      lines.push(
        `  it('${name} success', async () => {`,
        `    await ${r.call};`,
        `    const last = await mock.last();`,
        `    expect(last.method).toBe('${r.method}');`,
        `    expect(last.matched_route).toBe('${r.opId}');`,
        `  });`,
        ``,
        `  it('${name} error', async () => {`,
        `    await mock.pushScenario('${r.opId}', 500, { error: 'x' });`,
        `    await expect(${r.call}).rejects.toThrow(RestError);`,
        `    const last = await mock.last();`,
        `    expect(last.response_status).toBe(500);`,
        `  });`,
        ``,
      );
      total += 2;
    }
    lines.push('});', '');
    const raw = lines.join('\n');
    const formatted = await prettier.format(raw, { ...prettierConfig, parser: 'typescript' });
    const outPath = path.join(TESTS_REST, `${spec.replace(/-/g, '_')}_generated.test.ts`);
    if (check) {
      const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf-8') : '';
      if (current !== formatted) stale.push(outPath);
    } else {
      fs.writeFileSync(outPath, formatted);
      process.stdout.write(
        `generated ${path.relative(REPO_ROOT, outPath)} (${srows.length} routes, ${srows.length * 2} tests)\n`,
      );
    }
  }
  return { total, stale };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

interface RowWithCall extends JoinedRow {
  call: string;
}

async function main(): Promise<number> {
  const check = process.argv.includes('--check');
  if (!fs.existsSync(REST_APIS)) {
    process.stderr.write(
      `rest-apis not found at ${REST_APIS} ` +
        `(set PORTING_SDK or PORTING_SDK_PATH, or clone porting-sdk adjacent)\n`,
    );
    return 2;
  }

  const routes = loadRegistry();
  const joined = join(routes);
  const callIndex = buildClientCallIndex();
  const resolver = new SignatureResolver();

  const rows: RowWithCall[] = [];
  const uncovered: string[] = [];
  for (const r of joined) {
    const call = synthCall(r.via, callIndex, resolver);
    if (call === null) {
      uncovered.push(`${r.via} (${r.method} ${r.path})`);
      continue;
    }
    rows.push({ ...r, call });
  }

  const { total, stale } = await emit(rows, check);

  if (uncovered.length) {
    process.stderr.write(`\nUNCOVERED (${uncovered.length}) — via not invokable / no signature:\n`);
    for (const u of uncovered) process.stderr.write(`  - ${u}\n`);
  }

  if (check) {
    if (stale.length) {
      process.stderr.write(`\nGEN-FRESH FAIL: ${stale.length} generated test file(s) stale:\n`);
      for (const f of stale) process.stderr.write(`  - ${path.relative(REPO_ROOT, f)}\n`);
      return 1;
    }
    process.stdout.write(`GEN-FRESH OK: ${total} generated wire tests up to date\n`);
  } else {
    process.stdout.write(
      `total: ${total} generated wire tests across ${new Set(rows.map((r) => r.spec)).size} namespaces\n`,
    );
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(`generate-rest-tests failed: ${e?.stack ?? e}\n`);
    process.exit(2);
  });
