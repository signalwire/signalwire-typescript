/**
 * DataMap.body() sends its data as the webhook's `params`.
 *
 * The platform reads a webhook's request body only from `params`
 * (mod_openai actions.c parse_webhook) and has no `body` field, so a `body`
 * key went out with no request body. createSimpleApiTool's `body` option went
 * through body() and had the same problem.
 */
import { AgentBase } from '../src/AgentBase.js';
import { DataMap, createSimpleApiTool } from '../src/DataMap.js';
import { FunctionResult } from '../src/FunctionResult.js';

function firstWebhook(fn: Record<string, unknown>): Record<string, unknown> {
  const dataMap = fn['data_map'] as Record<string, unknown>;
  return (dataMap['webhooks'] as Record<string, unknown>[])[0]!;
}

describe('DataMap.body() writes params', () => {
  it('body() sets the webhook params and writes no body key', () => {
    const fn = new DataMap('search')
      .webhook('POST', 'https://api.example.com/search')
      .body({ q: '${args.query}', limit: 3 })
      .output(new FunctionResult('Found ${total}'))
      .toSwaigFunction();
    const webhook = firstWebhook(fn);
    expect(webhook['params']).toEqual({ q: '${args.query}', limit: 3 });
    expect('body' in webhook).toBe(false);
  });

  it('a later params() replaces what body() set, as the same field', () => {
    const webhook = firstWebhook(
      new DataMap('search')
        .webhook('POST', 'https://api.example.com/search')
        .body({ q: '${args.query}' })
        .params({ api_key: '12345' })
        .output(new FunctionResult('ok'))
        .toSwaigFunction(),
    );
    expect(webhook['params']).toEqual({ api_key: '12345' });
    expect('body' in webhook).toBe(false);
  });

  it("createSimpleApiTool's body option becomes the webhook's params", () => {
    const webhook = firstWebhook(
      createSimpleApiTool({
        name: 'search',
        url: 'https://api.example.com/search',
        responseTemplate: 'Found ${total} for ${input.args.query}',
        method: 'POST',
        body: { q: '${args.query}' },
      }).toSwaigFunction(),
    );
    expect(webhook['params']).toEqual({ q: '${args.query}' });
    expect('body' in webhook).toBe(false);
    expect(webhook['output']).toEqual({ response: 'Found ${total} for ${input.args.query}' });
  });

  it('the rendered SWML carries the body as params', async () => {
    const agent = new AgentBase({ name: 'dm', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    agent.registerSwaigFunction(
      new DataMap('search')
        .purpose('Search the catalog')
        .parameter('query', 'string', 'Search query', { required: true })
        .webhook('POST', 'https://api.example.com/search')
        .body({ q: '${args.query}' })
        .output(new FunctionResult('Found ${total}'))
        .toSwaigFunction(),
    );
    const res = await agent.getApp().request('/', {
      headers: { Authorization: 'Basic ' + Buffer.from('u:p').toString('base64') },
    });
    expect(res.status).toBe(200);
    const swml = (await res.json()) as {
      sections: { main: Record<string, unknown>[] };
    };
    const ai = swml.sections.main.find((v) => 'ai' in v)!['ai'] as {
      SWAIG: { functions: Record<string, unknown>[] };
    };
    const tool = ai.SWAIG.functions.find((f) => f['function'] === 'search')!;
    const webhook = firstWebhook(tool);
    expect(webhook['params']).toEqual({ q: '${args.query}' });
    expect('body' in webhook).toBe(false);
  });
});
