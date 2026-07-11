import { ReadResource } from '../../src/rest/base/ReadResource.js';
import { HttpClient } from '../../src/rest/HttpClient.js';
import { FabricAddresses } from '../../src/rest/namespaces/fabric.resources.generated.js';
import { paginate, paginateAll } from '../../src/rest/pagination.js';
import { mockClientOptions } from './helpers.js';

describe('paginate', () => {
  it('yields items from a single page', async () => {
    const { options } = mockClientOptions([
      { status: 200, body: { data: [{ id: 1 }, { id: 2 }] } },
    ]);
    const http = new HttpClient(options);

    const items: { id: number }[] = [];
    for await (const item of paginate<{ id: number }>(http, '/api/test')) {
      items.push(item);
    }
    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('follows links.next across multiple pages', async () => {
    const { options } = mockClientOptions([
      {
        status: 200,
        body: {
          data: [{ id: 1 }],
          links: { next: 'https://test.signalwire.com/api/test?page=2' },
        },
      },
      {
        status: 200,
        body: {
          data: [{ id: 2 }],
          links: { next: 'https://test.signalwire.com/api/test?page=3' },
        },
      },
      {
        status: 200,
        body: {
          data: [{ id: 3 }],
          links: {},
        },
      },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test');
    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('follows next_page_uri for LAML-style pagination', async () => {
    const { options } = mockClientOptions([
      {
        status: 200,
        body: {
          calls: [{ sid: 'CA1' }],
          next_page_uri: '/api/laml/2010-04-01/Accounts/xxx/Calls?page=1',
        },
      },
      {
        status: 200,
        body: {
          calls: [{ sid: 'CA2' }],
          next_page_uri: null,
        },
      },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(
      http,
      '/api/laml/2010-04-01/Accounts/xxx/Calls',
      undefined,
      'calls',
    );
    expect(items).toEqual([{ sid: 'CA1' }, { sid: 'CA2' }]);
  });

  it('handles empty first page', async () => {
    const { options } = mockClientOptions([{ status: 200, body: { data: [] } }]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test');
    expect(items).toEqual([]);
  });

  it('handles missing data key gracefully', async () => {
    const { options } = mockClientOptions([{ status: 200, body: { other: 'stuff' } }]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test');
    expect(items).toEqual([]);
  });

  it('supports custom data key', async () => {
    const { options } = mockClientOptions([
      { status: 200, body: { results: [{ name: 'a' }, { name: 'b' }] } },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test', undefined, 'results');
    expect(items).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('passes initial query params', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: { data: [{ id: 1 }] } },
    ]);
    const http = new HttpClient(options);

    await paginateAll(http, '/api/test', { page_size: 5 });

    const reqs = getRequests();
    expect(reqs[0]!.url).toContain('page_size=5');
  });

  it('handles relative links.next', async () => {
    const { options } = mockClientOptions([
      {
        status: 200,
        body: {
          data: [{ id: 1 }],
          links: { next: '/api/test?page=2' },
        },
      },
      {
        status: 200,
        body: { data: [{ id: 2 }] },
      },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test');
    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

// The resource-base `paginate()` METHOD — the Python `ReadResource.paginate()`
// parity surface. It walks the resource's own `_basePath` list endpoint,
// following the wire cursor, so callers page without hand-building the token loop.
describe('ReadResource.paginate() method', () => {
  // A minimal concrete read-only resource bound to a fixed base path.
  class ThingsResource extends ReadResource<unknown, { id: number }> {
    constructor(http: HttpClient) {
      super(http, '/api/things');
    }
  }

  it('walks two pages of the resource endpoint, following links.next', async () => {
    const { options, getRequests } = mockClientOptions([
      {
        status: 200,
        body: {
          data: [{ id: 1 }, { id: 2 }],
          links: { next: 'https://test.signalwire.com/api/things?page_token=abc' },
        },
      },
      {
        status: 200,
        body: {
          data: [{ id: 3 }],
          links: {},
        },
      },
    ]);
    const things = new ThingsResource(new HttpClient(options));

    const collected: { id: number }[] = [];
    for await (const item of things.paginate()) {
      collected.push(item);
    }

    // Every item across both pages, in order.
    expect(collected).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);

    // Exactly two requests: the first to the base path, the second to the
    // server-supplied next-page cursor URL (proves the cursor was followed).
    const reqs = getRequests();
    expect(reqs).toHaveLength(2);
    expect(reqs[0]!.url).toContain('/api/things');
    expect(reqs[1]!.url).toContain('page_token=abc');
  });

  it('applies initial query params to the first request only', async () => {
    const { options, getRequests } = mockClientOptions([
      {
        status: 200,
        body: {
          data: [{ id: 1 }],
          links: { next: 'https://test.signalwire.com/api/things?page_token=xyz' },
        },
      },
      { status: 200, body: { data: [{ id: 2 }], links: {} } },
    ]);
    const things = new ThingsResource(new HttpClient(options));

    const collected: { id: number }[] = [];
    for await (const item of things.paginate({ page_size: 1 })) {
      collected.push(item);
    }

    expect(collected).toEqual([{ id: 1 }, { id: 2 }]);
    const reqs = getRequests();
    // First request carries the caller's params; the second uses the cursor URL
    // unchanged (no re-applied page_size).
    expect(reqs[0]!.url).toContain('page_size=1');
    expect(reqs[1]!.url).toContain('page_token=xyz');
    expect(reqs[1]!.url).not.toContain('page_size=1');
  });

  it('is available on a generated read-only subclass (FabricAddresses)', async () => {
    const { options, getRequests } = mockClientOptions([
      {
        status: 200,
        body: {
          data: [{ id: 'addr-1' }],
          links: { next: 'https://test.signalwire.com/api/fabric/addresses?page_token=n2' },
        },
      },
      { status: 200, body: { data: [{ id: 'addr-2' }], links: {} } },
    ]);
    const addresses = new FabricAddresses(new HttpClient(options));

    const ids: string[] = [];
    for await (const a of addresses.paginate()) {
      ids.push((a as { id: string }).id);
    }

    expect(ids).toEqual(['addr-1', 'addr-2']);
    const reqs = getRequests();
    expect(reqs[0]!.url).toContain('/api/fabric/addresses');
    expect(reqs[1]!.url).toContain('page_token=n2');
  });
});
