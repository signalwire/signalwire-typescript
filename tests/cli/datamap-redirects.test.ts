/**
 * swaig-test's DataMap simulator follows a webhook's redirects as the platform
 * does: mod_openai's parse_webhook (actions.c) sets CURLOPT_FOLLOWLOCATION,
 * CURLOPT_MAXREDIRS 15 and, for a POST, CURLOPT_POSTREDIR
 * CURL_REDIR_POST_ALL. Every hop is still checked for private addresses.
 * Mirrors signalwire-python's tests/unit/cli/test_datamap_exec_redirects.py
 * (2716dc2). The URLs are public IP literals, so no DNS is needed.
 */

import { executeDataMap } from '../../src/cli/datamap-exec.js';
import { _setPublicFetchTransport, type _PublicFetchTransport } from '../../src/PublicFetch.js';

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function scripted(routes: Record<string, () => Response>): {
  sent: Sent[];
  transport: _PublicFetchTransport;
} {
  const sent: Sent[] = [];
  const transport: _PublicFetchTransport = async (url, init) => {
    sent.push({ url, method: init.method, headers: { ...init.headers }, body: init.body });
    const route = routes[url];
    if (!route) throw new Error(`no route for ${url}`);
    return route();
  };
  return { sent, transport };
}

const redirect = (status: number, location: string) => () =>
  new Response(null, { status, headers: { location } });
const json = (payload: unknown) => () => new Response(JSON.stringify(payload));

const lookup = (webhook: Record<string, unknown>) => ({
  function: 'lookup',
  data_map: { webhooks: [webhook], output: { response: 'The lookup failed.' } },
});

afterEach(() => {
  _setPublicFetchTransport(null);
});

describe('DataMap webhook redirects, as the platform follows them', () => {
  it('sends a POST again with its body after a 302', async () => {
    const { sent, transport } = scripted({
      'https://203.0.113.10/w': redirect(302, '/final'),
      'https://203.0.113.10/final': json({ answer: 'yes' }),
    });
    _setPublicFetchTransport(transport);
    const result = await executeDataMap(
      lookup({
        url: 'https://203.0.113.10/w',
        method: 'POST',
        params: { q: '${args.q}' },
        output: { response: 'Answer: ${answer}' },
      }),
      { q: 'hours' },
    );
    expect(result).toEqual({ response: 'Answer: yes' });
    expect(sent.map((s) => s.method)).toEqual(['POST', 'POST']);
    expect(JSON.parse(sent[1]!.body!)).toEqual({ q: 'hours' });
  });

  it('follows 15 redirects', async () => {
    const routes: Record<string, () => Response> = {};
    for (let i = 0; i < 15; i++) routes[`https://203.0.113.10/${i}`] = redirect(302, `/${i + 1}`);
    routes['https://203.0.113.10/15'] = json({ answer: 'far' });
    const { sent, transport } = scripted(routes);
    _setPublicFetchTransport(transport);
    const result = await executeDataMap(
      lookup({ url: 'https://203.0.113.10/0', output: { response: '${answer}' } }),
      {},
    );
    expect(result).toEqual({ response: 'far' });
    expect(sent).toHaveLength(16);
  });

  it('refuses a redirect to a private address, and the webhook fails', async () => {
    const { sent, transport } = scripted({
      'https://203.0.113.10/w': redirect(302, 'http://127.0.0.1:8000/private'),
      'http://127.0.0.1:8000/private': json({ answer: 'internal' }),
    });
    _setPublicFetchTransport(transport);
    const result = await executeDataMap(
      lookup({ url: 'https://203.0.113.10/w', output: { response: '${answer}' } }),
      {},
    );
    expect(result).toEqual({ response: 'The lookup failed.' });
    expect(sent.map((s) => s.url)).toEqual(['https://203.0.113.10/w']);
  });
});
