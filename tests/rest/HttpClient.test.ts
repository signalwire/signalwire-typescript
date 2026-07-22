import { createRequire } from 'node:module';
import { HttpClient } from '../../src/rest/HttpClient.js';
import { RestError, RestTransportError } from '../../src/rest/RestError.js';
import { createMockFetch, mockClientOptions } from './helpers.js';

const pkgVersion = (createRequire(import.meta.url)('../../package.json') as { version: string })
  .version;

describe('HttpClient', () => {
  it('sends Basic Auth header', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: { ok: true } }]);
    const http = new HttpClient(options);

    await http.get('/api/test');

    const reqs = getRequests();
    expect(reqs).toHaveLength(1);
    const expected = 'Basic ' + Buffer.from('test-project:test-token').toString('base64');
    expect(reqs[0]!.headers['Authorization']).toBe(expected);
  });

  it('sends Accept and User-Agent headers', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: {} }]);
    const http = new HttpClient(options);

    await http.get('/api/test');

    const reqs = getRequests();
    expect(reqs[0]!.headers['Accept']).toBe('application/json');
    // Product token is stable; the version segment is derived from package.json
    // at runtime so it can never drift from a hardcoded literal.
    expect(reqs[0]!.headers['User-Agent']).toBe(`signalwire-typescript/${pkgVersion}`);
  });

  it('sends Content-Type for POST with body', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: { id: '123' } }]);
    const http = new HttpClient(options);

    await http.post('/api/test', { name: 'foo' });

    const reqs = getRequests();
    expect(reqs[0]!.headers['Content-Type']).toBe('application/json');
    expect(reqs[0]!.body).toEqual({ name: 'foo' });
  });

  it('does not send Content-Type for GET', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: {} }]);
    const http = new HttpClient(options);

    await http.get('/api/test');

    const reqs = getRequests();
    expect(reqs[0]!.headers['Content-Type']).toBeUndefined();
  });

  it('returns parsed JSON on success', async () => {
    const { options } = mockClientOptions([{ status: 200, body: { data: [1, 2, 3] } }]);
    const http = new HttpClient(options);

    const result = await http.get('/api/test');
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('returns empty object on 204', async () => {
    const { options } = mockClientOptions([{ status: 204, body: undefined }]);
    const http = new HttpClient(options);

    const result = await http.delete('/api/test/123');
    expect(result).toEqual({});
  });

  it('throws RestError on non-2xx', async () => {
    const { options } = mockClientOptions([{ status: 404, body: { error: 'not found' } }]);
    const http = new HttpClient(options);

    await expect(http.get('/api/test/bad')).rejects.toThrow(RestError);

    try {
      await http.get('/api/test/bad');
    } catch (_e) {
      // Second request will get default 200 response from our mock
    }
  });

  it('RestError contains status, body, url, method', async () => {
    const { options } = mockClientOptions([{ status: 422, body: { errors: ['invalid'] } }]);
    const http = new HttpClient(options);

    try {
      await http.post('/api/test', { bad: true });
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RestError);
      const err = e as RestError;
      expect(err.statusCode).toBe(422);
      expect(err.url).toBe('https://test.signalwire.com/api/test');
      expect(err.method).toBe('POST');
    }
  });

  it('RestError captures response headers and requestId from x-request-id', async () => {
    // §6.6 error-observability: a failed HTTP response carries the platform
    // request id in an `x-request-id` header; RestError must surface it as
    // `requestId` and expose the full header map (client-side observability,
    // no wire-contract change) — mirrors the python reference SignalWireRestError.
    const { options } = mockClientOptions([
      {
        status: 500,
        body: { error: 'boom' },
        headers: { 'x-request-id': 'req-abc-123' },
      },
    ]);
    const http = new HttpClient(options);

    try {
      await http.get('/api/test/boom');
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RestError);
      const err = e as RestError;
      expect(err.requestId).toBe('req-abc-123');
      expect(err.headers?.['x-request-id']).toBe('req-abc-123');
      // the request id is folded into the human-readable message for logs
      expect(err.message).toContain('req-abc-123');
    }
  });

  it('RestError requestId honors header precedence and case-insensitivity', async () => {
    // Precedence order: x-request-id > x-signalwire-request-id > request-id >
    // x-amzn-requestid. Here only x-signalwire-request-id is present (mixed case).
    const { options } = mockClientOptions([
      {
        status: 503,
        body: { error: 'unavailable' },
        headers: { 'X-SignalWire-Request-Id': 'sw-req-777' },
      },
    ]);
    const http = new HttpClient(options);

    try {
      await http.get('/api/test/unavailable');
      throw new Error('Should have thrown');
    } catch (e) {
      const err = e as RestError;
      expect(err.requestId).toBe('sw-req-777');
    }
  });

  it('RestError requestId is null when no request-id header is present', async () => {
    const { options } = mockClientOptions([{ status: 400, body: { error: 'bad' } }]);
    const http = new HttpClient(options);

    try {
      await http.get('/api/test/bad');
      throw new Error('Should have thrown');
    } catch (e) {
      const err = e as RestError;
      expect(err.requestId).toBeNull();
    }
  });

  it('RestTransportError has null headers and requestId', () => {
    const err = new RestTransportError('connection refused', 'https://x/api', 'GET');
    expect(err.headers).toBeNull();
    expect(err.requestId).toBeNull();
  });

  it('appends query params to URL', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: { data: [] } }]);
    const http = new HttpClient(options);

    await http.get('/api/test', { page: 2, limit: 10 });

    const reqs = getRequests();
    expect(reqs[0]!.url).toContain('page=2');
    expect(reqs[0]!.url).toContain('limit=10');
  });

  it('skips undefined query params', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: {} }]);
    const http = new HttpClient(options);

    await http.get('/api/test', { page: 1, filter: undefined });

    const reqs = getRequests();
    expect(reqs[0]!.url).toContain('page=1');
    expect(reqs[0]!.url).not.toContain('filter');
  });

  it('PUT sends body correctly', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: { updated: true } }]);
    const http = new HttpClient(options);

    const result = await http.put('/api/test/123', { name: 'bar' });

    const reqs = getRequests();
    expect(reqs[0]!.method).toBe('PUT');
    expect(reqs[0]!.body).toEqual({ name: 'bar' });
    expect(result).toEqual({ updated: true });
  });

  it('PATCH sends body correctly', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: { patched: true } }]);
    const http = new HttpClient(options);

    const result = await http.patch('/api/test/123', { name: 'baz' });

    const reqs = getRequests();
    expect(reqs[0]!.method).toBe('PATCH');
    expect(reqs[0]!.body).toEqual({ name: 'baz' });
    expect(result).toEqual({ patched: true });
  });

  it('strips trailing slashes from baseUrl', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: {} }]);
    options.baseUrl = 'https://test.signalwire.com///';
    const http = new HttpClient(options);

    await http.get('/api/test');

    const reqs = getRequests();
    expect(reqs[0]!.url).toBe('https://test.signalwire.com/api/test');
  });

  it('handles absolute URLs (for pagination)', async () => {
    const { options, getRequests } = mockClientOptions([{ status: 200, body: { data: [1] } }]);
    const http = new HttpClient(options);

    await http.get('https://other.signalwire.com/api/test?page=2');

    const reqs = getRequests();
    expect(reqs[0]!.url).toBe('https://other.signalwire.com/api/test?page=2');
  });

  it('accepts host option and prepends https://', async () => {
    const [fetchImpl, getRequests] = createMockFetch([{ status: 200, body: { ok: true } }]);
    const http = new HttpClient({
      host: 'example.signalwire.com',
      project: 'test-project',
      token: 'test-token',
      fetchImpl,
    });

    expect(http.baseUrl).toBe('https://example.signalwire.com');

    await http.get('/api/test');

    const reqs = getRequests();
    expect(reqs[0]!.url).toBe('https://example.signalwire.com/api/test');
  });

  it('host takes precedence over baseUrl when both are provided', () => {
    const [fetchImpl] = createMockFetch();
    const http = new HttpClient({
      host: 'from-host.signalwire.com',
      baseUrl: 'https://from-baseurl.signalwire.com',
      project: 'test-project',
      token: 'test-token',
      fetchImpl,
    });

    expect(http.baseUrl).toBe('https://from-host.signalwire.com');
  });

  it('throws when neither host nor baseUrl is provided', () => {
    const [fetchImpl] = createMockFetch();
    expect(
      () =>
        new HttpClient({
          project: 'test-project',
          token: 'test-token',
          fetchImpl,
        }),
    ).toThrow('HttpClientOptions requires either "host" or "baseUrl".');
  });

  it('RestError body is parsed JSON object when server returns JSON error', async () => {
    const { options } = mockClientOptions([{ status: 422, body: { errors: ['invalid'] } }]);
    const http = new HttpClient(options);

    try {
      await http.post('/api/test', { bad: true });
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RestError);
      const err = e as RestError;
      expect(typeof err.body).toBe('object');
      expect(err.body).toEqual({ errors: ['invalid'] });
    }
  });

  it('RestError body is plain string when server returns non-JSON error', async () => {
    // Override the mock to return a non-JSON text body
    const http = new HttpClient({
      baseUrl: 'https://test.signalwire.com',
      project: 'test-project',
      token: 'test-token',
      fetchImpl: async (_input, _init) => {
        return new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/plain' },
        });
      },
    });

    try {
      await http.get('/api/test');
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RestError);
      const err = e as RestError;
      expect(typeof err.body).toBe('string');
      expect(err.body).toBe('Internal Server Error');
    }
  });
  it('wraps a transport failure (fetch rejection) in a typed RestTransportError', async () => {
    // A connection refused / DNS / reset / TLS failure makes fetch REJECT
    // (typically a TypeError) rather than resolve with a response. The client
    // must surface its typed transport error, not leak the bare fetch error.
    const http = new HttpClient({
      baseUrl: 'https://test.signalwire.com',
      project: 'test-project',
      token: 'test-token',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });

    await expect(http.get('/api/test')).rejects.toThrow(RestTransportError);
  });

  it('RestTransportError is a member of the RestError family with statusCode null', async () => {
    const http = new HttpClient({
      baseUrl: 'https://test.signalwire.com',
      project: 'test-project',
      token: 'test-token',
      fetchImpl: async () => {
        // Node's undici throws an Aggregate('ECONNREFUSED')-shaped TypeError.
        throw new TypeError('fetch failed: connect ECONNREFUSED 127.0.0.1:1');
      },
    });

    try {
      await http.get('/api/addresses');
      throw new Error('Should have thrown');
    } catch (e) {
      // instanceof RestError still holds -> one catch handles HTTP + transport.
      expect(e).toBeInstanceOf(RestError);
      expect(e).toBeInstanceOf(RestTransportError);
      const err = e as RestTransportError;
      expect(err.statusCode).toBeNull();
      expect(err.method).toBe('GET');
      expect(err.url).toBe('https://test.signalwire.com/api/addresses');
      // The transport message is carried in body (and the error message).
      expect(String(err.body)).toContain('ECONNREFUSED');
    }
  });

  it('a real connection-refused GET raises the typed transport error (not a bare fetch error)', async () => {
    // No fetchImpl -> the real global fetch. Point at a port with nothing
    // listening so the OS refuses the connection.
    const { createServer } = await import('node:net');
    const deadPort = await new Promise<number>((resolve, reject) => {
      const srv = createServer();
      srv.once('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address();
        const port = addr && typeof addr === 'object' ? addr.port : 0;
        srv.close(() => (port > 0 ? resolve(port) : reject(new Error('no free port'))));
      });
    });

    const http = new HttpClient({
      baseUrl: `http://127.0.0.1:${deadPort}`,
      project: 'test-project',
      token: 'test-token',
    });

    await expect(http.get('/api/fabric/addresses')).rejects.toThrow(RestTransportError);
  });
});
