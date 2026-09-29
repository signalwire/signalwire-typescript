/**
 * The DataMap examples, run through swaig-test's simulator: every template
 * resolves at the stage it is in (mod_openai actions.c), so none expands to
 * an empty string.
 */

import { loadAgent } from '../../src/cli/agent-loader.js';
import { executeDataMap } from '../../src/cli/datamap-exec.js';

type Data = Record<string, unknown>;

/** The example's SWAIG functions, from its rendered SWML. */
async function functionsOf(file: string): Promise<Map<string, Data>> {
  const agent = (await loadAgent(`examples/${file}`)) as { renderSwml(id: string): string };
  const swml = JSON.parse(agent.renderSwml('test-call')) as {
    sections: { main: Data[] };
  };
  const ai = swml.sections.main.find((v) => 'ai' in v)!['ai'] as {
    SWAIG: { functions: Data[] };
  };
  return new Map(ai.SWAIG.functions.map((f) => [f['function'] as string, f]));
}

/** Notes the simulator wrote, such as a template that expanded to nothing. */
let notes: string[] = [];

beforeEach(() => {
  notes = [];
});

afterEach(() => {
  expect(notes).toEqual([]);
});

/** A fetch that answers with `payload` as JSON, collecting the simulator's notes. */
function answer(payload: unknown, status = 200) {
  return {
    fetchImpl: async () => new Response(JSON.stringify(payload), { status }),
    log: (line: string) => void notes.push(line),
  };
}

describe('examples/datamap-tools.ts', () => {
  it("get_weather names the city from the webhook stage's input.args", async () => {
    const fn = (await functionsOf('datamap-tools.ts')).get('get_weather')!;
    const result = await executeDataMap(
      fn,
      { city: 'London' },
      answer({ current_condition: [{ temp_F: '61', weatherDesc: [{ value: 'Overcast' }] }] }),
    );
    expect(result).toEqual({ response: 'Weather in London: 61°F, Overcast' });
  });
});

describe('examples/advanced-datamap.ts', () => {
  const fns = () => functionsOf('advanced-datamap.ts');

  it('lookup_definition names the word, and falls back on a response with title', async () => {
    const fn = (await fns()).get('lookup_definition')!;
    expect(await executeDataMap(fn, { word: 'tea' }, answer([{ word: 'tea' }]))).toEqual({
      response: 'Definition of tea: The word was found in the dictionary.',
    });
    expect(
      await executeDataMap(fn, { word: 'zzz' }, answer({ title: 'No Definitions Found' }, 404)),
    ).toEqual({ response: 'Could not find a definition for that word.' });
  });

  it('get_news names the topic and lists the articles', async () => {
    const fn = (await fns()).get('get_news')!;
    const articles = [
      { title: 'A', description: 'first' },
      { title: 'B', description: 'second' },
    ];
    expect(await executeDataMap(fn, { topic: 'tea' }, answer({ articles }))).toEqual({
      response: 'Latest news on tea:\n- A: first\n- B: second\n',
    });
  });

  it('matches the expression tools case-insensitively', async () => {
    const all = await fns();
    const log = (line: string) => void notes.push(line);
    expect(
      await executeDataMap(all.get('detect_greeting')!, { text: 'Hello there' }, { log }),
    ).toEqual({
      response: 'The user greeted with: Hello there. Respond warmly.',
    });
    expect(await executeDataMap(all.get('check_status')!, { service: 'API' }, { log })).toEqual({
      response: 'The API service is currently operational.',
    });
    expect(await executeDataMap(all.get('check_status')!, { service: 'mail' }, { log })).toEqual({
      response: 'Unknown service "mail". Available services: api, web, database.',
    });
  });
});
