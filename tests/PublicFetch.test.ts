/**
 * _publicFetch: fetching a user-supplied URL without reaching private or
 * internal addresses, through redirects and DNS rebinding.
 *
 * Mirrors signalwire-python's tests for _PublicSession (db5c575, 9ca2fef).
 * Redirect targets are public IP literals (TEST-NET-3, 203.0.113.0/24), so
 * these tests need no DNS.
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import {
  _nodeTransport,
  _publicFetch,
  _setPublicFetchTransport,
  type _PublicFetchTransport,
} from '../src/PublicFetch.js';

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/** A transport that answers from a script and records what was sent. */
function scripted(answer: (url: string, n: number) => Response): {
  sent: Sent[];
  transport: _PublicFetchTransport;
} {
  const sent: Sent[] = [];
  const transport: _PublicFetchTransport = async (url, init) => {
    sent.push({ url, method: init.method, headers: { ...init.headers }, body: init.body });
    return answer(url, sent.length);
  };
  return { sent, transport };
}

const redirect = (status: number, location: string) =>
  new Response(null, { status, headers: { location } });

afterEach(() => {
  _setPublicFetchTransport(null);
  delete process.env['SWML_ALLOW_PRIVATE_URLS'];
});

describe('_publicFetch redirects', () => {
  it('refuses a redirect to a private address before requesting it', async () => {
    const { sent, transport } = scripted(() => redirect(302, 'http://127.0.0.1:9/secret'));
    _setPublicFetchTransport(transport);
    await expect(_publicFetch('http://203.0.113.10/page')).rejects.toThrow(/Refused to fetch/);
    expect(sent.map((s) => s.url)).toEqual(['http://203.0.113.10/page']);
  });

  it.each([
    'http://169.254.169.254/latest/meta-data',
    'http://[::ffff:169.254.169.254]/latest/meta-data',
    'http://[::1]:8080/',
    'http://0.0.0.0/',
    'http://10.0.0.5/',
  ])('refuses a redirect to %s', async (target) => {
    const { sent, transport } = scripted(() => redirect(301, target));
    _setPublicFetchTransport(transport);
    await expect(_publicFetch('http://203.0.113.10/')).rejects.toThrow(/Refused to fetch/);
    expect(sent).toHaveLength(1);
  });

  it('refuses a private URL without sending anything', async () => {
    const { sent, transport } = scripted(() => new Response('never'));
    _setPublicFetchTransport(transport);
    await expect(_publicFetch('http://127.0.0.1/')).rejects.toThrow(/Refused to fetch/);
    expect(sent).toHaveLength(0);
  });

  it('follows a redirect to a public address and returns the final response', async () => {
    const { sent, transport } = scripted((_url, n) =>
      n === 1 ? redirect(302, 'http://203.0.113.20/final') : new Response('done'),
    );
    _setPublicFetchTransport(transport);
    const res = await _publicFetch('http://203.0.113.10/start');
    expect(await res.text()).toBe('done');
    expect(sent.map((s) => s.url)).toEqual([
      'http://203.0.113.10/start',
      'http://203.0.113.20/final',
    ]);
  });

  it('stops after 10 redirects', async () => {
    const { sent, transport } = scripted((_url, n) => redirect(302, `http://203.0.113.10/${n}`));
    _setPublicFetchTransport(transport);
    await expect(_publicFetch('http://203.0.113.10/0')).rejects.toThrow(/Too many redirects/);
    expect(sent).toHaveLength(11);
  });

  it('drops credentials on a redirect to another origin, and keeps them on the same origin', async () => {
    const { sent, transport } = scripted((_url, n) =>
      n === 1
        ? redirect(302, 'http://203.0.113.10/same')
        : n === 2
          ? redirect(302, 'http://203.0.113.99/other')
          : new Response('ok'),
    );
    _setPublicFetchTransport(transport);
    await _publicFetch('http://203.0.113.10/', {
      headers: { Authorization: 'Basic abc', Cookie: 'c=1', 'User-Agent': 'ua' },
    });
    expect(sent[1]!.headers['authorization']).toBe('Basic abc');
    expect(sent[2]!.headers['authorization']).toBeUndefined();
    expect(sent[2]!.headers['cookie']).toBeUndefined();
    expect(sent[2]!.headers['user-agent']).toBe('ua');
  });

  it('follows a 303 with a GET and no body', async () => {
    const { sent, transport } = scripted((_url, n) =>
      n === 1 ? redirect(303, 'http://203.0.113.10/result') : new Response('ok'),
    );
    _setPublicFetchTransport(transport);
    await _publicFetch('http://203.0.113.10/submit', {
      method: 'POST',
      body: '{"a":1}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(sent[1]!.method).toBe('GET');
    expect(sent[1]!.body).toBeUndefined();
    expect(sent[1]!.headers['content-type']).toBeUndefined();
  });

  it('allows private redirects when SWML_ALLOW_PRIVATE_URLS is set', async () => {
    process.env['SWML_ALLOW_PRIVATE_URLS'] = 'true';
    const { sent, transport } = scripted((_url, n) =>
      n === 1 ? redirect(302, 'http://127.0.0.1:9/local') : new Response('local'),
    );
    _setPublicFetchTransport(transport);
    const res = await _publicFetch('http://203.0.113.10/');
    expect(await res.text()).toBe('local');
    expect(sent).toHaveLength(2);
  });
});

describe('_nodeTransport connection check', () => {
  let server: http.Server;
  let port = 0;
  let hits = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      hits++;
      if (req.url === '/gzip') {
        res.writeHead(200, { 'content-type': 'text/plain', 'content-encoding': 'gzip' });
        res.end(gzipSync(Buffer.from('compressed body')));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('local body');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    hits = 0;
  });

  it('refuses at connect time a hostname that resolves to a private address', async () => {
    // This is the DNS-rebinding defense: whatever an earlier check saw, the
    // address the connection resolves is checked again before connecting.
    await expect(
      _nodeTransport(`http://localhost:${port}/`, { method: 'GET', headers: {} }, true),
    ).rejects.toMatchObject({ code: 'ERR_SW_BLOCKED_ADDRESS' });
    expect(hits).toBe(0);
  });

  it('connects when the guard is off, and decodes a gzip body', async () => {
    const plain = await _nodeTransport(
      `http://localhost:${port}/`,
      { method: 'GET', headers: {} },
      false,
    );
    expect(plain.status).toBe(200);
    expect(await plain.text()).toBe('local body');

    const gz = await _nodeTransport(
      `http://localhost:${port}/gzip`,
      { method: 'GET', headers: {} },
      false,
    );
    expect(await gz.text()).toBe('compressed body');
    expect(gz.headers.get('content-encoding')).toBeNull();
    expect(hits).toBe(2);
  });

  it('_publicFetch reaches a local server only when private URLs are allowed', async () => {
    await expect(_publicFetch(`http://localhost:${port}/`)).rejects.toThrow(/Refused to fetch/);
    expect(hits).toBe(0);

    const res = await _publicFetch(`http://localhost:${port}/`, { allowPrivate: true });
    expect(await res.text()).toBe('local body');
    expect(hits).toBe(1);
  });
});
