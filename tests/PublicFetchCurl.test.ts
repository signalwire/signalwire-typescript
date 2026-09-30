/**
 * _publicFetch's `curl` redirect mode: redirects followed as libcurl follows
 * them with the settings mod_openai's parse_webhook (actions.c) requests a
 * DataMap webhook with (CURLOPT_FOLLOWLOCATION, CURLOPT_MAXREDIRS 15,
 * CURLOPT_POSTREDIR CURL_REDIR_POST_ALL), with every hop still checked.
 * Mirrors signalwire-python's tests/unit/cli/test_datamap_exec_redirects.py
 * (2716dc2). The default mode is unchanged; tests/PublicFetch.test.ts covers it.
 */

import {
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

const post = {
  method: 'POST',
  body: '{"q":"hours"}',
  headers: { 'Content-Type': 'application/json' },
};

afterEach(() => {
  _setPublicFetchTransport(null);
});

describe("_publicFetch redirectMode 'curl'", () => {
  it.each([301, 302, 303, 307, 308])(
    'sends a POST again with its body after a %i',
    async (status) => {
      const { sent, transport } = scripted((_url, n) =>
        n === 1 ? redirect(status, '/final') : new Response('{"answer":"yes"}'),
      );
      _setPublicFetchTransport(transport);
      const res = await _publicFetch('http://203.0.113.10/w', { ...post, redirectMode: 'curl' });
      expect(await res.text()).toBe('{"answer":"yes"}');
      expect(sent.map((s) => [s.method, s.url, s.body])).toEqual([
        ['POST', 'http://203.0.113.10/w', '{"q":"hours"}'],
        ['POST', 'http://203.0.113.10/final', '{"q":"hours"}'],
      ]);
      expect(sent[1]!.headers['content-type']).toBe('application/json');
    },
  );

  it('still turns a POST into a bodyless GET after a 302 in the default mode', async () => {
    const { sent, transport } = scripted((_url, n) =>
      n === 1 ? redirect(302, '/final') : new Response('ok'),
    );
    _setPublicFetchTransport(transport);
    await _publicFetch('http://203.0.113.10/w', post);
    expect(sent[1]!.method).toBe('GET');
    expect(sent[1]!.body).toBeUndefined();
  });

  it('follows up to 15 redirects, and fails on the 16th', async () => {
    const hops = (limit: number) =>
      scripted((_url, n) =>
        n <= limit ? redirect(302, `http://203.0.113.10/${n}`) : new Response('done'),
      );
    const fifteen = hops(15);
    _setPublicFetchTransport(fifteen.transport);
    const res = await _publicFetch('http://203.0.113.10/0', { redirectMode: 'curl' });
    expect(await res.text()).toBe('done');
    expect(fifteen.sent).toHaveLength(16);

    const sixteen = hops(16);
    _setPublicFetchTransport(sixteen.transport);
    await expect(_publicFetch('http://203.0.113.10/0', { redirectMode: 'curl' })).rejects.toThrow(
      /Too many redirects/,
    );
    expect(sixteen.sent).toHaveLength(16);
  });

  it('follows a Location on any 3xx, as curl does', async () => {
    const { sent, transport } = scripted((_url, n) =>
      n === 1 ? redirect(300, '/chosen') : new Response('ok'),
    );
    _setPublicFetchTransport(transport);
    await _publicFetch('http://203.0.113.10/', { redirectMode: 'curl' });
    expect(sent.map((s) => s.url)).toEqual(['http://203.0.113.10/', 'http://203.0.113.10/chosen']);
  });

  it('checks every hop, refusing a redirect to a private address', async () => {
    const { sent, transport } = scripted(() => redirect(307, 'http://169.254.169.254/latest'));
    _setPublicFetchTransport(transport);
    await expect(
      _publicFetch('http://203.0.113.10/', { ...post, redirectMode: 'curl' }),
    ).rejects.toThrow(/Refused to fetch/);
    expect(sent).toHaveLength(1);
  });

  it('drops credentials on a change of origin, and keeps them on the same origin', async () => {
    const { sent, transport } = scripted((_url, n) =>
      n === 1
        ? redirect(302, '/same')
        : n === 2
          ? redirect(302, 'http://203.0.113.99/other')
          : new Response('ok'),
    );
    _setPublicFetchTransport(transport);
    await _publicFetch('http://203.0.113.10/', {
      ...post,
      headers: { ...post.headers, Authorization: 'Basic abc', Cookie: 'c=1' },
      redirectMode: 'curl',
    });
    expect(sent[1]!.headers['authorization']).toBe('Basic abc');
    expect(sent[2]!.headers['authorization']).toBeUndefined();
    expect(sent[2]!.headers['cookie']).toBeUndefined();
    expect(sent[2]!.body).toBe('{"q":"hours"}');
  });
});
