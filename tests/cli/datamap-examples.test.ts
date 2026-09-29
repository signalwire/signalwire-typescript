/**
 * The DataMap examples, run through swaig-test's simulator: every template
 * resolves at the stage it is in (mod_openai actions.c), so no result has a
 * `<MISSING:...>` path.
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

/** A fetch that answers with `payload` as JSON. */
function answer(payload: unknown, status = 200) {
  return {
    fetchImpl: async () => new Response(JSON.stringify(payload), { status }),
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
