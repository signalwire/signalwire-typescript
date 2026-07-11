/**
 * route-registry.ts — enumerate the REST routes the TypeScript SDK IMPLEMENTS.
 *
 * This is "Set B" for the cross-port SPEC-PARITY gate: the routes the live
 * RestClient actually dispatches, captured from the REAL code path — not parsed
 * from source (an AST scraper would have to re-implement the CrudResource /
 * base-path machinery and would drift) and not read from the test journal
 * (which only sees routes that happen to be tested, the exact blind spot the
 * gate closes).
 *
 * How: construct RestClient with a recording `fetchImpl` that captures
 * `(method, path)` from each request and returns a stub 200 Response instead of
 * doing network I/O. Every route — CRUD-base, custom createToken, etc. — funnels
 * through HttpClient._request → fetch. We then walk every namespace on the
 * client, every public method on every sub-resource, and invoke each with
 * sentinel arguments. The path param sentinel is normalized back to `{id}` so
 * the captured template matches the spec's path_template.
 *
 * A method that cannot be invoked is NOT silently skipped — a dropped method is
 * a route missing from Set B, which would turn a real divergence into a false
 * pass. Methods that don't map to a single route go in REGISTRY_SKIP with a
 * reason; anything else that throws on invocation is a hard error (non-zero exit
 * + recorded in `errors`), mirroring python_route_registry.py.
 *
 * Output: JSON `{routes:[{method,path_template,via}], skipped:[...], errors:[...]}`
 * on stdout. Exit 1 if any uninvokable, un-skip-listed method (Set B incomplete).
 *
 * Run: `npx tsx scripts/route-registry.ts`
 */

import { RestClient } from '../src/rest/index.js';

// Sentinel for any path parameter — one segment, no slash; normalized to {id}.
const SENTINEL = '__ID__';

// Methods that do NOT map to a single canonical REST route, keyed by
// "<namespace>.<resource>.<method>" or a "<namespace>.<resource>.*" wildcard.
// Every entry needs a reason; a method that merely throws is an ERROR, not an
// implicit skip — add it here (justified) or fix the harness so it invokes.
const REGISTRY_SKIP: Record<string, string> = {
  // cXML applications expose the CRUD surface but create is unsupported
  // (mirrors python: no POST /cxml_applications canonical route).
  'fabric.cxmlApplications.create': 'no create route — unsupported by design',
};

// Method names that are client-side HELPERS on every resource that carries them:
// they issue no HTTP request at call time (they wrap another verb / return a lazy
// iterator), so they are not distinct wire routes. `paginate()` returns a lazy
// paginator that follows the cursor via the already-covered `list` route on
// iteration — its coverage is `list`'s, not a new route. Mirrors the python
// reference's SKIP_METHODS in porting-sdk/scripts/python_route_registry.py.
const SKIP_METHODS: Record<string, string> = {
  paginate:
    'client-side pagination helper — returns a lazy paginator that follows the ' +
    'cursor via the already-covered list route; issues no HTTP request itself',
};

interface RouteRec {
  method: string;
  path_template: string;
  via: string[];
}

const captured: Array<{ method: string; path: string }> = [];

/** A recording fetch: capture (method, pathname) and return a stub 200. */
const recordingFetch: typeof globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.toString();
  const method = (init?.method ?? 'GET').toUpperCase();
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  captured.push({ method, path });
  // Minimal Response the SDK's _request can consume (.ok, .status, .json/.text).
  return new Response('{}', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

function isResourceLike(v: unknown): v is object {
  // A namespace or resource instance: a non-null object that is not a plain
  // data value. We treat any class instance hanging off the client as walkable.
  return typeof v === 'object' && v !== null && v.constructor !== Object;
}

/** Public method names on an instance (walk its prototype chain, skip ctor). */
function publicMethods(obj: object): string[] {
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
  return [...names].sort();
}

/** Own enumerable resource-instance properties of a namespace. */
function subResources(ns: object): Array<[string, object]> {
  const out: Array<[string, object]> = [];
  for (const [name, val] of Object.entries(ns)) {
    if (name.startsWith('_')) continue;
    if (isResourceLike(val)) out.push([name, val]);
  }
  return out;
}

function skipReason(key: string): string | undefined {
  if (key in REGISTRY_SKIP) return REGISTRY_SKIP[key];
  const wildcard = key.slice(0, key.lastIndexOf('.')) + '.*';
  if (wildcard in REGISTRY_SKIP) return REGISTRY_SKIP[wildcard];
  // global client-side-helper method names (e.g. paginate), skipped on any resource
  const method = key.slice(key.lastIndexOf('.') + 1);
  return SKIP_METHODS[method];
}

async function invokeAndCapture(fn: (...a: unknown[]) => unknown): Promise<void> {
  // Pass enough sentinel positional args to satisfy the common shapes:
  // (resourceId), (resourceId, body), (body). Extra args are harmless — JS
  // ignores params beyond the signature. The path captures the sentinel in
  // resource-id position; body args don't affect the URL.
  const args = [SENTINEL, {}, SENTINEL];
  await fn(...args);
}

async function build(): Promise<{
  routes: RouteRec[];
  skipped: Array<{ key: string; reason: string }>;
  errors: Array<{ key: string; error: string }>;
}> {
  const client = new RestClient({
    project: 'p',
    token: 't',
    host: 'example.signalwire.com',
    fetchImpl: recordingFetch,
  });

  const routes: RouteRec[] = [];
  const skipped: Array<{ key: string; reason: string }> = [];
  const errors: Array<{ key: string; error: string }> = [];

  async function handleResource(nsName: string, resName: string, res: object) {
    for (const m of publicMethods(res)) {
      const key = `${nsName}.${resName}.${m}`;
      const reason = skipReason(key);
      if (reason !== undefined) {
        skipped.push({ key, reason });
        continue;
      }
      const fn = (res as Record<string, unknown>)[m];
      if (typeof fn !== 'function') continue;
      captured.length = 0;
      try {
        await invokeAndCapture((fn as (...a: unknown[]) => unknown).bind(res));
      } catch (e) {
        errors.push({ key, error: `${(e as Error).name}: ${(e as Error).message}` });
        continue;
      }
      if (captured.length === 0) {
        errors.push({
          key,
          error: 'invoked but issued no HTTP request (client-side helper? add to REGISTRY_SKIP)',
        });
        continue;
      }
      for (const c of captured) {
        const path = c.path.split(SENTINEL).join('{id}');
        routes.push({ method: c.method, path_template: path, via: [key] });
      }
    }
  }

  for (const [nsName, ns] of Object.entries(client)) {
    if (nsName.startsWith('_')) continue;
    if (!isResourceLike(ns)) continue;
    // The namespace may itself be a flat resource (has its own routes)…
    if (publicMethods(ns).length > 0) await handleResource(nsName, nsName, ns);
    // …and/or a container of sub-resources.
    for (const [resName, res] of subResources(ns)) {
      await handleResource(nsName, resName, res);
    }
  }

  // De-dupe identical (method, path); collect the `via` accessors.
  const byRoute = new Map<string, RouteRec>();
  for (const r of routes) {
    const k = `${r.method} ${r.path_template}`;
    const existing = byRoute.get(k);
    if (existing) existing.via.push(...r.via);
    else byRoute.set(k, { ...r });
  }
  const deduped = [...byRoute.values()].sort((a, b) =>
    (a.path_template + a.method).localeCompare(b.path_template + b.method),
  );
  return { routes: deduped, skipped, errors };
}

build()
  .then((out) => {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    process.exit(out.errors.length ? 1 : 0);
  })
  .catch((e) => {
    process.stderr.write(`route-registry failed: ${e?.stack ?? e}\n`);
    process.exit(2);
  });
