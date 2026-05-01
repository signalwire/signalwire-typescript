/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_pagination_mock.py.
 *
 * The TypeScript pagination contract is an async generator (`paginate`)
 * rather than a class with `__iter__` / `__next__`. The behavioural
 * guarantees the Python tests cover translate to:
 *
 *   1. The generator does no I/O until the first `next()` call.
 *   2. Iterating walks pages following `links.next` cursors and stops at
 *      a page without `links.next`.
 *   3. After the last page the iterator returns `done: true`.
 *
 * The first scenario is staged via the mock's scenario control plane so
 * the test sees deterministic, multi-page responses tagged against a
 * known endpoint id (`fabric.list_fabric_addresses`).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import { HttpClient } from '../../src/rest/HttpClient.js';
import { paginate } from '../../src/rest/pagination.js';
import type { MockHarness } from './mocktest.js';

const FABRIC_ADDRESSES_PATH = '/api/fabric/addresses';
const FABRIC_ADDRESSES_ENDPOINT_ID = 'fabric.list_fabric_addresses';

let mock: MockHarness;
let http: HttpClient;

beforeEach(async () => {
  const { mock: m } = await newMockClient();
  mock = m;
  http = new HttpClient({
    baseUrl: m.url,
    project: 'test_proj',
    token: 'test_tok',
  });
});

describe('paginate (async generator)', () => {
  it('init_state_no_io_before_iteration', async () => {
    // Constructing the generator must NOT have fetched anything yet.
    const gen = paginate<Record<string, unknown>>(
      http,
      FABRIC_ADDRESSES_PATH,
      { page_size: 2 },
      'data',
    );
    // Just creating it without iterating should not produce any journal.
    const journal = await mock.journal();
    expect(journal.length).toBe(0);

    // Returning a Symbol.asyncIterator should return the same object —
    // the TS equivalent of Python's `__iter__` returning self.
    const it = gen[Symbol.asyncIterator]();
    expect(it).toBe(gen);

    // Tear down: drain the generator so it doesn't leak cleanup.
    await gen.return!(undefined);
  });

  it('walks_pages_through_all_items_following_links_next', async () => {
    // Page 1 — has next cursor.
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, {
      data: [
        { id: 'addr-1', name: 'first' },
        { id: 'addr-2', name: 'second' },
      ],
      links: { next: 'http://example.com/api/fabric/addresses?cursor=page2' },
    });
    // Page 2 — terminal (no next cursor).
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, {
      data: [{ id: 'addr-3', name: 'third' }],
      links: {},
    });

    // Reset journal to scope to the paginated walks.
    await mock.reset();
    // Re-stage scenarios — reset clears them too.
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, {
      data: [
        { id: 'addr-1', name: 'first' },
        { id: 'addr-2', name: 'second' },
      ],
      links: { next: 'http://example.com/api/fabric/addresses?cursor=page2' },
    });
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, {
      data: [{ id: 'addr-3', name: 'third' }],
      links: {},
    });

    const collected: Array<{ id: string }> = [];
    for await (const item of paginate<{ id: string }>(http, FABRIC_ADDRESSES_PATH, undefined, 'data')) {
      collected.push(item);
    }

    expect(collected.map((it) => it.id)).toEqual(['addr-1', 'addr-2', 'addr-3']);

    // Journal must show exactly two GETs at the same path.
    const journal = await mock.journal();
    const gets = journal.filter((e) => e.path === FABRIC_ADDRESSES_PATH);
    expect(gets.length).toBe(2);
    // The second fetch carries `cursor=page2` parsed from the first
    // response's `links.next`.
    expect(gets[1]!.query_params['cursor']).toEqual(['page2']);
  });

  it('returns_done_when_terminal_page_exhausted', async () => {
    // One terminal page.
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, {
      data: [{ id: 'only-one' }],
      links: {},
    });

    const gen = paginate<{ id: string }>(http, FABRIC_ADDRESSES_PATH, undefined, 'data');
    // Pull first item explicitly (Python equivalent: `it.__next__()`).
    const first = await gen.next();
    expect(first.done).toBe(false);
    expect(first.value).toEqual({ id: 'only-one' });

    // Exhausted.
    const second = await gen.next();
    expect(second.done).toBe(true);
  });

  it('iter_returns_self_async', async () => {
    const gen = paginate<Record<string, unknown>>(
      http,
      FABRIC_ADDRESSES_PATH,
      undefined,
      'data',
    );
    const same = gen[Symbol.asyncIterator]();
    expect(same).toBe(gen);
    // Still no HTTP yet.
    const journal = await mock.journal();
    expect(journal.length).toBe(0);
    await gen.return!(undefined);
  });
});
