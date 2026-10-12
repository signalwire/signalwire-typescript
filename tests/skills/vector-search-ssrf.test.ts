/**
 * native_vector_search remote mode checks every request for private and
 * internal addresses, not only remote_url at setup: a server that redirects
 * a search to the cloud metadata service must not reach it.
 */

import { NativeVectorSearchSkill } from '../../src/skills/builtin/index.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';
import { _setPublicFetchTransport } from '../../src/PublicFetch.js';

const REMOTE = 'http://203.0.113.20';
const sent: string[] = [];

beforeAll(() => suppressAllLogs(true));

afterEach(() => {
  _setPublicFetchTransport(null);
  vi.unstubAllGlobals();
  sent.length = 0;
});

async function search(remoteUrl: string, onSearch: () => Response): Promise<string> {
  // The skill must not use the global fetch, which checks nothing.
  vi.stubGlobal('fetch', async (url: string) => {
    throw new Error(`global fetch used for ${url}`);
  });
  _setPublicFetchTransport(async (url, init) => {
    sent.push(`${init.method} ${url} ${init.headers['authorization'] ?? ''}`.trim());
    const path = new URL(url).pathname;
    if (path === '/health') return new Response('{"status":"ok"}');
    if (path === '/search') return onSearch();
    return new Response('{"results":[{"content":"metadata secrets","score":1,"metadata":{}}]}');
  });
  const skill = new NativeVectorSearchSkill({ remote_url: remoteUrl });
  expect(await skill.setup()).toBe(true);
  const result = (await skill.getTools()[0]!.handler({ query: 'manual' }, {})) as FunctionResult;
  return result.response;
}

describe('native_vector_search remote requests', () => {
  it('sends the health check and the search through the checked fetch', async () => {
    const response = await search(
      REMOTE,
      () => new Response('{"results":[{"content":"The manual","score":0.9,"metadata":{}}]}'),
    );
    expect(response).toContain('The manual');
    expect(sent).toEqual([`GET ${REMOTE}/health`, `POST ${REMOTE}/search`]);
  });

  it('refuses a search redirected to a private address', async () => {
    const response = await search(
      `http://user:pw@203.0.113.20`,
      () =>
        new Response(null, {
          status: 307,
          headers: { location: 'http://169.254.169.254/latest/meta-data' },
        }),
    );
    expect(response).not.toContain('metadata secrets');
    expect(sent.some((r) => r.includes('169.254.169.254'))).toBe(false);
  });
});
