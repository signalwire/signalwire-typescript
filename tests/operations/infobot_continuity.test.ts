/**
 * InfoBot continuity: a conversation's legs, carried across a switch between
 * voice and chat; and speaking into a live call.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentBase } from '../../src/AgentBase.js';
import {
  Continuity,
  type Leg,
  LegStore,
  buildSeed,
  mediumOf,
  pairTools,
  sayIntoCall,
} from '../../src/operations/infobot/index.js';
import type { Loose } from './helpers.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'infobot-'));
const agentOf = (name: string) => new AgentBase({ name, route: `/${name}`, suppressLogs: true });
const internals = (agent: AgentBase): Loose => agent as Loose;
const capture = (c: Continuity, log: Record<string, unknown>[], raw: Record<string, unknown>) =>
  (c as Loose).captureLeg(log, raw) as Promise<void>;
const seed = (c: Continuity, body: Record<string, unknown>, agent: AgentBase) =>
  (c as Loose).seedCallback({}, body, {}, agent) as Promise<void>;

describe('continuity helpers', () => {
  it('finds the medium', () => {
    expect(mediumOf({ conversation_type: 'chat' })).toBe('chat');
    expect(mediumOf({ conversation_type: 'voice' })).toBe('voice');
    expect(mediumOf({})).toBe('voice');
    expect(mediumOf(null)).toBe('voice');
    expect(mediumOf({ global_data: { conversation_type: 'chat' } })).toBe('chat');
    expect(mediumOf({ vars: { userVariables: { conversation_type: 'chat' } } })).toBe('chat');
  });

  it('drops orphan results and unanswered calls', () => {
    const out = pairTools([
      { role: 'user', content: 'hi' },
      { role: 'assistant', tool_calls: [{ id: 'a' }, { id: 'b' }] },
      { role: 'tool', tool_call_id: 'a', content: 'ra' },
      { role: 'tool', tool_call_id: 'z', content: 'orphan' },
    ]);
    expect(out.map((m) => m['role'])).toEqual(['user', 'assistant', 'tool']);
    expect((out[1]!['tool_calls'] as Loose[]).map((tc) => tc.id)).toEqual(['a']);
    expect(out[2]!['tool_call_id']).toBe('a');
  });

  it('drops an assistant turn with no surviving result', () => {
    expect(
      pairTools([
        { role: 'assistant', tool_calls: [{ id: 'x' }] },
        { role: 'user', content: 'hi' },
      ]).map((m) => m['role']),
    ).toEqual(['user']);
  });

  it('seeds from the latest leg and appends the switch turns', () => {
    const convo = buildSeed(
      [
        { turns: [{ role: 'user', content: 'old' }] },
        { turns: [{ role: 'assistant', content: 'latest' }] },
      ],
      'voice',
    );
    const contents = convo.map((m) => m['content']);
    expect(contents).toContain('latest');
    expect(contents).not.toContain('old');
    expect(convo.at(-2)).toEqual({ role: 'user', content: 'I want to switch to voice.' });
    expect(convo.at(-1)!['role']).toBe('system');
    expect(String(convo.at(-1)!['content'])).toContain('switched from chat to voice');
  });

  it('seeds nothing from nothing, and dedupes', () => {
    expect(buildSeed([], 'chat')).toEqual([]);
    expect(buildSeed([{ turns: [] }], 'chat')).toEqual([]);
    const convo = buildSeed(
      [
        {
          turns: [
            { role: 'user', content: 'dup' },
            { role: 'user', content: 'dup' },
          ],
        },
      ],
      'chat',
    );
    expect(convo.filter((m) => m['role'] === 'user').map((m) => m['content'])).toEqual([
      'dup',
      'I want to switch to chat.',
    ]);
  });

  it('can drop tool turns', () => {
    const convo = buildSeed(
      [
        {
          turns: [
            { role: 'assistant', tool_calls: [{ id: 'a' }] },
            { role: 'tool', tool_call_id: 'a', content: 'r' },
            { role: 'assistant', content: 'answer' },
          ],
        },
      ],
      'voice',
      { includeTools: false },
    );
    expect(convo.every((m) => m['role'] !== 'tool' && !('tool_calls' in m))).toBe(true);
    expect(convo.some((m) => m['content'] === 'answer')).toBe(true);
  });
});

describe('Continuity', () => {
  it('captures a leg, then seeds the next across a switch', async () => {
    const c = new Continuity({ store: new LegStore({ cacheDir: tmp() }) });
    await capture(
      c,
      [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
      ],
      { conversation_id: 'root' },
    );
    const agent = agentOf('c');
    await seed(c, { conversation_id: 'root.2', conversation_type: 'voice' }, agent);
    const convo = internals(agent).params['convo'];
    const contents = convo.map((m: Loose) => m.content);
    expect(contents).toContain('q1');
    expect(contents).toContain('a1');
    expect(convo.at(-2).content).toBe('I want to switch to voice.');
    expect(convo.at(-1).role).toBe('system');
  });

  it('ignores a request with no id', async () => {
    const c = new Continuity({ store: new LegStore({ cacheDir: tmp() }) });
    await capture(c, [{ role: 'user', content: 'x' }], {});
    expect(await c.store.legs('')).toEqual([]);
  });

  it('installs', () => {
    const agent = agentOf('ci');
    expect(new Continuity().install(agent)).toBe(agent);
  });

  it('reports the whole conversation', async () => {
    const sent: Loose[] = [];
    const c = new Continuity({
      store: new LegStore({ cacheDir: tmp() }),
      report: (r) => sent.push(r),
    });
    await capture(c, [{ role: 'user', content: 'q1' }], { conversation_id: 'r' });
    await capture(c, [{ role: 'user', content: 'q2' }], { conversation_id: 'r.2' });
    expect(sent.at(-1).conversation_id).toBe('r');
    expect(sent.at(-1).legs).toHaveLength(2);
    expect(sent.at(-1).legs.map((leg: Loose) => leg.turns[0].content)).toEqual(['q1', 'q2']);
  });

  it('merges the visitor context into global data', async () => {
    const c = new Continuity({
      store: new LegStore({ cacheDir: tmp() }),
      visitorContext: () => ({ visitor: 'acme' }),
    });
    const agent = agentOf('v');
    await seed(c, { conversation_id: 'x' }, agent);
    expect(internals(agent).globalData['visitor']).toBe('acme');
  });

  it("runs the agent's own callback first", async () => {
    const ran: string[] = [];
    const agent = agentOf('ch');
    agent.setDynamicConfigCallback(() => {
      ran.push('own');
    });
    const c = new Continuity({
      store: new LegStore({ cacheDir: tmp() }),
      visitorContext: () => {
        ran.push('seed');
        return null;
      },
    });
    c.install(agent);
    for (const cb of internals(agent).perCallConfigs)
      await cb({}, { conversation_id: 'x' }, {}, agent);
    expect(ran).toEqual(['own', 'seed']);
  });

  it('records a leg with its medium, and seeds with it', async () => {
    const c = new Continuity({
      store: new LegStore({ cacheDir: tmp() }),
      switchTurn: (now) => `Cambio a ${now}.`,
    });
    const agent = agentOf('m');
    // The chat leg's request says it's chat; its end, which may not, finds it in global_data
    await seed(c, { conversation_id: 'r', conversation_type: 'chat' }, agent);
    expect(internals(agent).globalData['conversation_type']).toBe('chat');
    await capture(c, [{ role: 'user', content: 'hola' }], {
      conversation_id: 'r',
      global_data: internals(agent).globalData,
    });
    expect((await c.store.legs('r'))[0]!['medium']).toBe('chat');
    await seed(c, { conversation_id: 'r.2', conversation_type: 'chat' }, agent);
    const convo = internals(agent).params['convo'];
    expect(convo.at(-2).content).toBe('Cambio a chat.');
    // The medium recorded, not a guess
    expect(convo.at(-1).content).toContain('from chat to chat');
  });

  it('keeps every leg appended at once in the file store', async () => {
    const store = new LegStore({ cacheDir: tmp() });
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.record('c', { n: i })));
    expect((await store.legs('c')).map((leg) => leg['n'] as number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i),
    );
  });
});

describe('LegStore', () => {
  it('roots ids and numbers the next leg', () => {
    expect(LegStore.rootId('abc')).toBe('abc');
    expect(LegStore.rootId('abc.2')).toBe('abc');
    expect(LegStore.nextLegId('abc', 1)).toBe('abc.2');
    // A suffixed id is rooted first, so the next leg counts off the root
    expect(LegStore.nextLegId('abc.3', 3)).toBe('abc.4');
  });

  it('round-trips through the default store', async () => {
    const store = new LegStore({ cacheDir: tmp() });
    expect(await store.legs('c1')).toEqual([]);
    expect(await store.record('c1', { turns: ['a'] })).toBe(true);
    expect(await store.record('c1', { turns: ['b'] })).toBe(true);
    expect((await store.legs('c1')).map((leg) => leg['turns'])).toEqual([['a'], ['b']]);
    expect(await store.legs('c2')).toEqual([]);
  });

  it('takes persistence of its own', async () => {
    const mem: Record<string, Leg[]> = {};
    const store = new LegStore().setStore({
      load: (cid) => mem[cid] ?? [],
      append: (cid, leg) => {
        (mem[cid] ??= []).push(leg);
        return true;
      },
    });
    await store.record('x', { n: 1 });
    expect(await store.legs('x')).toEqual([{ n: 1 }]);
  });
});

describe('sayIntoCall', () => {
  it('uses the client given', async () => {
    const calls: [string, unknown][] = [];
    const client = {
      calling: {
        aiMessage: async (callId: string, options: unknown) => {
          calls.push([callId, options]);
          return 'ok';
        },
      },
    };
    expect(await sayIntoCall('c1', 'hello', { client })).toBe('ok');
    expect(calls).toEqual([['c1', { role: 'assistant', message_text: 'hello' }]]);
  });
});
