/**
 * The Fred tutorial (tutorial/fred/), driven through the agent's own HTTP app
 * as SignalWire drives it: SWML fetched with basic auth, tools called on
 * /fred/swaig with the per-call token from that SWML's web_hook_url. Each test
 * checks a claim the lessons in tutorial/fred/tutorial/ make.
 *
 * search_wiki runs against a local stand-in for the MediaWiki API
 * (WIKIPEDIA_BASE_URL), so the tests don't need the network.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

type Json = Record<string, unknown>;
type FredModule = typeof import('../../tutorial/fred/fred.js');
type Fred = Awaited<ReturnType<FredModule['createFred']>>;

const USER = 'fred';
const PASS = 'fred-test-password';
const AUTH = { Authorization: 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64') };

let mod: FredModule;
let wiki: Server;
let wikiRequests: string[] = [];

/** A stand-in for en.wikipedia.org/w/api.php: two hits for anything but "nothing-matches". */
function startWiki(): Promise<string> {
  wiki = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://wiki.test');
    wikiRequests.push(url.search);
    res.setHeader('Content-Type', 'application/json');
    if (url.searchParams.get('list') === 'search') {
      const query = url.searchParams.get('srsearch') ?? '';
      const limit = Number(url.searchParams.get('srlimit'));
      const hits =
        query === 'nothing-matches'
          ? []
          : [{ title: query }, { title: `${query} (disambiguation)` }].slice(0, limit);
      res.end(JSON.stringify({ query: { search: hits } }));
      return;
    }
    const title = url.searchParams.get('titles') ?? '';
    res.end(JSON.stringify({ query: { pages: { '1': { title, extract: `About ${title}.` } } } }));
  });
  return new Promise((resolve) =>
    wiki.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(wiki.address() as AddressInfo).port}`),
    ),
  );
}

beforeAll(async () => {
  vi.stubEnv('SIGNALWIRE_LOG_MODE', 'off');
  vi.stubEnv('SWML_BASIC_AUTH_USER', USER);
  vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', PASS);
  vi.stubEnv('SIGNALWIRE_SIGNING_KEY', '');
  vi.stubEnv('SWML_PROXY_URL_BASE', '');
  vi.stubEnv('WIKIPEDIA_BASE_URL', await startWiki());
  mod = await import('../../tutorial/fred/fred.js');
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise((resolve) => wiki.close(resolve));
});

beforeEach(() => {
  wikiRequests = [];
});

/** The ai verb of a SWML document. */
function aiVerb(swml: Json): Json {
  const main = (swml['sections'] as { main: Json[] }).main;
  const verb = main.find((v) => 'ai' in v);
  if (!verb) throw new Error('no ai verb in the SWML');
  return verb['ai'] as Json;
}

const functionsOf = (swml: Json): Json[] => (aiVerb(swml)['SWAIG'] as Json)['functions'] as Json[];

/** One simulated call against Fred's HTTP app. */
class Call {
  constructor(
    readonly fred: Fred,
    readonly callId: string,
  ) {}

  async swml(): Promise<Json> {
    const res = await this.fred.getApp().request(`/fred?call_id=${this.callId}`, {
      headers: AUTH,
    });
    expect(res.status).toBe(200);
    return (await res.json()) as Json;
  }

  /** The function's token, from the web_hook_url in this call's SWML. */
  async token(fn: string): Promise<string> {
    const entry = functionsOf(await this.swml()).find((f) => f['function'] === fn);
    return new URL(String(entry?.['web_hook_url'])).searchParams.get('__token') ?? '';
  }

  /** POST /fred/swaig the way SignalWire does, with this call's token unless one is given. */
  async invoke(
    fn: string,
    args: Json = {},
    token?: string,
  ): Promise<{ status: number; body: Json }> {
    const t = token ?? (await this.token(fn));
    const res = await this.fred.getApp().request(`/fred/swaig?__token=${t}`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        function: fn,
        call_id: this.callId,
        argument: { parsed: [args], raw: JSON.stringify(args) },
      }),
    });
    return { status: res.status, body: (await res.json()) as Json };
  }
}

const response = (body: Json): string => String(body['response']);

describe("Fred's SWML (lessons 3 and 4)", () => {
  it('serves /fred only with the credentials, and /fred/health without them', async () => {
    const fred = await mod.createFred();
    expect((await fred.getApp().request('/fred')).status).toBe(401);
    const wrong = { Authorization: 'Basic ' + Buffer.from(`${USER}:nope`).toString('base64') };
    expect((await fred.getApp().request('/fred', { headers: wrong })).status).toBe(401);
    expect((await fred.getApp().request('/fred', { headers: AUTH })).status).toBe(200);

    const health = await fred.getApp().request('/fred/health');
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });
  });

  it('builds the prompt from three sections, then the skill adds its own', async () => {
    const pom = (aiVerb(await new Call(await mod.createFred(), 'c1').swml())['prompt'] as Json)[
      'pom'
    ] as Json[];
    expect(pom.map((s) => s['title'])).toEqual([
      'Personality',
      'Goal',
      'Instructions',
      'Wikipedia Search',
    ]);
    expect(String(pom[0]!['body'])).toMatch(/^You are Fred/);
    expect(pom[2]!['bullets']).toContain(
      'Use the search_wiki function whenever users ask about factual topics',
    );
    // Found in live testing: without it the model skipped the search for made-up topics
    expect(pom[2]!['bullets']).toContain(
      'Search before you say Wikipedia has nothing on a topic, even one that sounds made up',
    );
    // num_results: 2 reaches the prompt the skill writes
    expect(String(pom[3]!['body'])).toContain('up to 2 Wikipedia article summaries');
  });

  it('sets the voice, hints, parameters and global data lesson 3 describes', async () => {
    const ai = aiVerb(await new Call(await mod.createFred(), 'c1').swml());
    expect(ai['languages']).toEqual([
      {
        name: 'English',
        code: 'en-US',
        voice: 'rime.bolt',
        fillers: [
          'Hmm, let me think...',
          "Oh, that's interesting...",
          'Great question!',
          'Let me see...',
        ],
      },
    ]);
    expect(ai['hints']).toEqual([
      'Wikipedia',
      'Fred',
      'tell me about',
      'what is',
      'who is',
      'search for',
      'look up',
    ]);
    expect(ai['params']).toEqual({
      ai_model: 'gpt-4.1-nano',
      wait_for_user: true,
      end_of_speech_timeout: 1000,
      ai_volume: 7,
      local_tz: 'America/New_York',
    });
    expect(ai['global_data']).toEqual({
      assistant_name: 'Fred',
      specialty: 'Wikipedia knowledge',
      personality_traits: ['friendly', 'curious', 'enthusiastic', 'helpful'],
    });
  });

  it('registers search_wiki with its fillers, then share_fun_fact with its enum', async () => {
    const fns = functionsOf(await new Call(await mod.createFred(), 'c1').swml());
    expect(fns.map((f) => f['function'])).toEqual(['search_wiki', 'share_fun_fact']);
    expect(fns[0]!['fillers']).toEqual({
      'en-US': [
        'Let me look that up on Wikipedia for you...',
        'Searching Wikipedia for that information...',
        'One moment, checking Wikipedia...',
        'Let me find that in the encyclopedia...',
      ],
    });
    const props = (fns[1]!['parameters'] as Json)['properties'] as Json;
    expect((props['category'] as Json)['enum']).toEqual([
      'statistics',
      'history',
      'records',
      'random',
    ]);
    // Each function URL carries a token for this call
    for (const f of fns) expect(String(f['web_hook_url'])).toMatch(/\/fred\/swaig\?__token=/);
  });

  it('exports a ready Fred for swaig-test, without starting a server on import', () => {
    expect(mod.fred).toBeInstanceOf(mod.FredTheWikiBot);
    expect(mod.fred.hasSkill('wikipedia_search')).toBe(true);
    expect(mod.fred.getTools().map((t) => t.name)).toEqual(['search_wiki', 'share_fun_fact']);
  });
});

describe('search_wiki (lesson 4)', () => {
  it('returns up to two article summaries, separated by a line of = characters', async () => {
    const { status, body } = await new Call(await mod.createFred(), 'c2').invoke('search_wiki', {
      query: 'FreeSWITCH',
    });
    expect(status).toBe(200);
    expect(response(body)).toBe(
      '**FreeSWITCH**\n\nAbout FreeSWITCH.\n\n' +
        '='.repeat(50) +
        '\n\n**FreeSWITCH (disambiguation)**\n\nAbout FreeSWITCH (disambiguation).',
    );
    // num_results: 2 is the search limit
    expect(wikiRequests[0]).toContain('srlimit=2');
  });

  it("returns Fred's no-results message with the query in it", async () => {
    const { body } = await new Call(await mod.createFred(), 'c3').invoke('search_wiki', {
      query: 'nothing-matches',
    });
    expect(response(body)).toBe(
      "Oh, I couldn't find anything about 'nothing-matches' on Wikipedia. " +
        'Maybe try different keywords or let me know if you meant something else!',
    );
  });
});

describe('share_fun_fact (lesson 5)', () => {
  const history = [
    'Wikipedia was launched on January 15, 2001!',
    'Wikipedia started as a side project of Nupedia, an encyclopedia written by experts!',
    "Wikipedia's name comes from 'wiki' (Hawaiian for 'quick') and 'encyclopedia'!",
    'Jimmy Wales and Larry Sanger founded Wikipedia!',
  ];

  it('returns a fact from the category it was asked for', async () => {
    const call = new Call(await mod.createFred(), 'c4');
    for (let i = 0; i < 10; i++) {
      const text = response((await call.invoke('share_fun_fact', { category: 'history' })).body);
      const prefix = "Here's a history fact about Wikipedia: ";
      expect(text.startsWith(prefix)).toBe(true);
      expect(history).toContain(text.slice(prefix.length));
    }
  });

  it('draws from every category when the category is random, missing or unknown', async () => {
    const call = new Call(await mod.createFred(), 'c5');
    for (const args of [{ category: 'random' }, {}, { category: 'science' }]) {
      const text = response((await call.invoke('share_fun_fact', args)).body);
      expect(text).toMatch(/^Here's a fun Wikipedia fact: .+!$/);
    }
  });

  it("refuses a token from another call's SWML", async () => {
    const fred = await mod.createFred();
    const token = await new Call(fred, 'call-a').token('share_fun_fact');
    const { body } = await new Call(fred, 'call-b').invoke('share_fun_fact', {}, token);
    expect(response(body)).toMatch(/security token for this function is invalid or expired/);
  });
});
