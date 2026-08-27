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
  // Use the harness's per-test random project so this hand-built HttpClient's
  // requests carry the same Authorization header the harness filters the
  // journal by (keeps the test isolated under file parallelism).
  http = new HttpClient({
    baseUrl: m.url,
    project: m.project,
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
    // Page 1 — has a next page. The server's links.next carries the real wire
    // param the fabric list endpoint round-trips: `page_token` (a cursor token
    // that starts with PA/PB), NOT a `cursor` param (which no SignalWire REST
    // endpoint accepts — see rest-apis/fabric/openapi.yaml ListFabricAddressesQuery).
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, {
      data: [
        { id: 'addr-1', name: 'first' },
        { id: 'addr-2', name: 'second' },
      ],
      links: { next: 'http://example.com/api/fabric/addresses?page_token=PA_page2' },
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
      links: { next: 'http://example.com/api/fabric/addresses?page_token=PA_page2' },
    });
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, {
      data: [{ id: 'addr-3', name: 'third' }],
      links: {},
    });

    const collected: Array<{ id: string }> = [];
    for await (const item of paginate<{ id: string }>(
      http,
      FABRIC_ADDRESSES_PATH,
      undefined,
      'data',
    )) {
      collected.push(item);
    }

    expect(collected.map((it) => it.id)).toEqual(['addr-1', 'addr-2', 'addr-3']);

    // Journal must show exactly two GETs at the same path.
    const journal = await mock.journal();
    const gets = journal.filter((e) => e.path === FABRIC_ADDRESSES_PATH);
    expect(gets.length).toBe(2);
    // The second fetch carries the `page_token` param parsed from the first
    // response's `links.next` — the real wire token the server round-trips.
    expect(gets[1]!.query_params['page_token']).toEqual(['PA_page2']);
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
    const gen = paginate<Record<string, unknown>>(http, FABRIC_ADDRESSES_PATH, undefined, 'data');
    const same = gen[Symbol.asyncIterator]();
    expect(same).toBe(gen);
    // Still no HTTP yet.
    const journal = await mock.journal();
    expect(journal.length).toBe(0);
    await gen.return!(undefined);
  });

  // ---- TS-3: PAGINATION-CORPUS behavioral contract (repeating-cursor guard +
  // continue-past-empty). Mirrors porting-sdk/scripts/pagination_corpus.py.

  it('continues_past_an_empty_page_that_carries_links_next', async () => {
    // Page 1 is EMPTY but carries a next cursor; page 2 holds the real item.
    // A naive `while data:` paginator STOPS on the empty page and drops page 2.
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, {
      data: [],
      links: { next: 'http://mock.test/api/fabric/addresses?page_token=EP_page2' },
    });
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, {
      data: [{ id: 'found-after-empty' }],
      links: {},
    });
    const items: Record<string, unknown>[] = [];
    for await (const item of paginate<Record<string, unknown>>(
      http,
      FABRIC_ADDRESSES_PATH,
      undefined,
      'data',
    )) {
      items.push(item);
    }
    expect(items.map((i) => i['id'])).toEqual(['found-after-empty']);
  });

  it('terminates_on_a_repeating_next_cursor_instead_of_looping_forever', async () => {
    // Both pages point at the SAME next cursor (a server loop). A paginator that
    // terminates only on an ABSENT next would re-fetch forever. It must detect
    // the repeat and stop after consuming each page's item exactly once.
    // Arm several copies so an UNGUARDED walk would keep finding a page to fetch
    // (a guarded walk stops after page 2 regardless).
    const loopBody = {
      data: [{ id: 'loop-1' }],
      links: { next: 'http://mock.test/api/fabric/addresses?page_token=LOOP' },
    };
    const loopBody2 = {
      data: [{ id: 'loop-2' }],
      links: { next: 'http://mock.test/api/fabric/addresses?page_token=LOOP' },
    };
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, loopBody);
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, loopBody2);
    // Extra armed copies: if the guard failed, the walk would consume these too
    // (and then hang on the endless self-referential cursor).
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, loopBody2);
    await mock.pushScenario(FABRIC_ADDRESSES_ENDPOINT_ID, 200, loopBody2);

    const items: Record<string, unknown>[] = [];
    // Bound the walk so a regression (infinite loop) fails the test instead of
    // hanging the whole suite.
    const walk = (async () => {
      for await (const item of paginate<Record<string, unknown>>(
        http,
        FABRIC_ADDRESSES_PATH,
        undefined,
        'data',
      )) {
        items.push(item);
        if (items.length > 50) throw new Error('paginate did not terminate on repeating cursor');
      }
    })();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('paginate HUNG on repeating cursor')), 5000),
    );
    await Promise.race([walk, timeout]);

    expect(items.map((i) => i['id'])).toEqual(['loop-1', 'loop-2']);
  });
});
