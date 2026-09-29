/**
 * Regression tests for LiveWire fixes: tools given as a name-keyed object,
 * LLM plugin objects as the `llm` option, and runApp() serving the agent.
 */
import { Agent, AgentSession, tool } from '../../src/livewire/index.js';
import type { AgentBase } from '../../src/AgentBase.js';

interface AiBlock {
  params?: Record<string, unknown>;
  SWAIG?: { functions?: Array<{ function: string }> };
}

interface SwmlDoc {
  sections: { main: Array<{ ai?: AiBlock }> };
}

/** Fetch the SWML document the built AgentBase serves at `/`. */
async function fetchSwml(swAgent: AgentBase): Promise<SwmlDoc> {
  const [user, pass] = swAgent.getBasicAuthCredentials();
  const res = await swAgent.getApp().request('/', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  expect(res.status).toBe(200);
  return (await res.json()) as SwmlDoc;
}

function aiBlock(swml: SwmlDoc): AiBlock {
  const ai = swml.sections.main.find((v) => v.ai)?.ai;
  expect(ai).toBeDefined();
  return ai!;
}

function toolNames(ai: AiBlock): string[] {
  return (ai.SWAIG?.functions ?? []).map((f) => f.function);
}

describe('LiveWire tools given as a name-keyed object (LiveKit agents-js shape)', () => {
  const getWeather = tool({
    description: 'Get weather',
    parameters: { type: 'object', properties: { city: { type: 'string' } } },
    execute: (p: { city: string }) => `Sunny in ${p.city}`,
  });

  it('Agent({ tools: { name: tool } }) keys each tool by its object key', () => {
    const agent = new Agent({ instructions: 'x', tools: { get_weather: getWeather } });
    expect(Object.keys(agent.tools)).toEqual(['get_weather']);
    expect(agent.tools['get_weather']!.name).toBe('get_weather');
    expect(agent.tools['get_weather']!.description).toBe('Get weather');
  });

  it('the array form still works', () => {
    const agent = new Agent({ tools: [{ ...getWeather, name: 'get_weather' }] });
    expect(Object.keys(agent.tools)).toEqual(['get_weather']);
  });

  it('updateTools() accepts the object form', async () => {
    const agent = new Agent();
    await agent.updateTools({ a: getWeather, b: getWeather });
    expect(Object.keys(agent.tools)).toEqual(['a', 'b']);
    expect(agent.tools['b']!.name).toBe('b');
  });

  it('AgentSession({ tools }) accepts the object form', async () => {
    const session = new AgentSession({ tools: { session_tool: getWeather } });
    await session.start({ agent: new Agent({ instructions: 'x' }) });
    expect(toolNames(aiBlock(await fetchSwml(session.getSwAgent()!)))).toContain('session_tool');
  });

  it('object-form tools are served as SWAIG functions and dispatch to execute()', async () => {
    const session = new AgentSession();
    await session.start({
      agent: new Agent({ instructions: 'x', tools: { get_weather: getWeather } }),
    });
    const swAgent = session.getSwAgent()!;
    expect(toolNames(aiBlock(await fetchSwml(swAgent)))).toEqual(['get_weather']);

    const [user, pass] = swAgent.getBasicAuthCredentials();
    const token = swAgent.createToolToken('get_weather', 'call-1');
    const res = await swAgent.getApp().request(`/swaig?__token=${token}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        function: 'get_weather',
        call_id: 'call-1',
        argument: { parsed: [{ city: 'Austin' }] },
      }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { response: string }).response).toBe('Sunny in Austin');
  });
});
