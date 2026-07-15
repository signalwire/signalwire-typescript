/**
 * paginate_inheritance.test.ts — runtime guard against the hierarchy blind spot.
 *
 * The surface enumerator records only *declared* methods per class and reconciles
 * inherited members against the Python oracle, so a wrong `extends` on a shared
 * base can leave a runtime method (like `paginate()`) OFF every subclass without
 * SURFACE-DIFF / DRIFT noticing — exactly what happened when `CrudResource`
 * extended `BaseResource` instead of `ReadResource`, silently dropping `paginate()`
 * from every CRUD resource.
 *
 * This test closes that blind spot at the level it actually manifests — the live
 * prototype chain. It constructs a real RestClient, walks every resource object
 * mounted on the client tree, and asserts the shared-base invariants:
 *
 *   * every `ReadResource` instance exposes `list()`, `get()`, and `paginate()`;
 *   * every `CrudResource` instance IS a `ReadResource` (so inherits `paginate()`)
 *     and also exposes `create()`, `update()`, and `delete()`.
 *
 * (Resources that extend `BaseResource` directly with a bespoke `list()` and no
 * paginator — e.g. `Recordings`, `VideoRoomRecordings`, `ConferenceLogs` — mirror
 * the Python reference, which also lists them without a paginator; they are
 * correctly NOT in scope here.)
 *
 * A future `extends` regression on any REST base fails HERE, on the object, not
 * a day later against a diff of declared method names.
 */

import { describe, expect, it } from 'vitest';
import { RestClient } from '../../src/rest/index.js';
import { CrudResource } from '../../src/rest/base/CrudResource.js';
import { ReadResource } from '../../src/rest/base/ReadResource.js';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Collect every resource object reachable from the client tree (namespaces + flat). */
function collectResources(client: RestClient): { name: string; res: object }[] {
  const found: { name: string; res: object }[] = [];
  const seen = new Set<object>();
  const c = client as unknown as Record<string, unknown>;
  const consider = (name: string, v: unknown): void => {
    if (isObject(v) && !seen.has(v)) {
      seen.add(v);
      found.push({ name, res: v });
    }
  };
  for (const key of Object.keys(c)) {
    const top = c[key];
    consider(key, top);
    if (isObject(top)) {
      for (const subKey of Object.keys(top)) {
        consider(`${key}.${subKey}`, top[subKey]);
      }
    }
  }
  return found;
}

const hasFn = (o: object, m: string): boolean =>
  typeof (o as Record<string, unknown>)[m] === 'function';

describe('REST resource hierarchy (runtime paginate guard)', () => {
  const client = new RestClient({ project: 'p', token: 't', host: 'example.signalwire.com' });
  const resources = collectResources(client);

  const readResources = resources.filter((r) => r.res instanceof ReadResource);
  const crudResources = resources.filter((r) => r.res instanceof CrudResource);

  it('discovers ReadResource and CrudResource instances (guard against vacuity)', () => {
    expect(readResources.length).toBeGreaterThan(10);
    expect(crudResources.length).toBeGreaterThan(5);
  });

  it('every ReadResource instance exposes list/get/paginate', () => {
    const broken = readResources
      .filter((r) => !hasFn(r.res, 'list') || !hasFn(r.res, 'get') || !hasFn(r.res, 'paginate'))
      .map((r) => r.name);
    expect(broken, `ReadResource instances missing a read method: ${broken.join(', ')}`).toEqual(
      [],
    );
  });

  it('every CrudResource instance is a ReadResource and exposes create/update/delete + paginate', () => {
    const brokenChain = crudResources
      .filter((r) => !(r.res instanceof ReadResource))
      .map((r) => r.name);
    expect(
      brokenChain,
      `CrudResource not extending ReadResource: ${brokenChain.join(', ')}`,
    ).toEqual([]);
    const missing = crudResources
      .filter(
        (r) =>
          !hasFn(r.res, 'create') ||
          !hasFn(r.res, 'update') ||
          !hasFn(r.res, 'delete') ||
          !hasFn(r.res, 'paginate'),
      )
      .map((r) => r.name);
    expect(missing, `CrudResource instances missing a method: ${missing.join(', ')}`).toEqual([]);
  });
});
