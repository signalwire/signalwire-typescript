/**
 * InfoBotKnowledge: governed, grounded knowledge search, standalone or beside
 * Operations.
 */

import { AgentBase } from '../../src/AgentBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { Operations } from '../../src/operations/agent.js';
import { InfoBotKnowledge, type Result } from '../../src/operations/infobot/index.js';
import { Change, Field, Operation } from '../../src/operations/model.js';
import type { Loose } from './helpers.js';

const agentOf = (name: string) => new AgentBase({ name, route: `/${name}`, suppressLogs: true });
const paramsOf = (agent: AgentBase): Record<string, unknown> => (agent as Loose).params;

function mainStep(agent: AgentBase): Loose {
  const contexts = agent.defineContexts().toDict();
  return contexts['default']!.steps.find((s) => s.name === 'main');
}

async function search(kb: InfoBotKnowledge, args: Record<string, unknown>): Promise<string> {
  const result: FunctionResult = await (kb as Loose).handleSearch(args);
  return String(result.toDict().response);
}

async function contact(kb: InfoBotKnowledge, args: Record<string, unknown>): Promise<string> {
  const result: FunctionResult = await (kb as Loose).handleContact(args);
  return String(result.toDict().response);
}

function opsWithCancel(): Operations {
  const ops = new Operations({ role: 'You help customers.' });
  ops.writesWith(() => null);
  class Cancel extends Operation {
    static override description = 'Cancel an order.';
    override prepare(): Change {
      return new Change({ readBack: 'Cancel it. Shall I?' });
    }
  }
  ops.operation(Cancel, { tool: 'cancel_order' });
  return ops;
}

describe('InfoBotKnowledge', () => {
  it('installs standalone', () => {
    const agent = agentOf('kb');
    new InfoBotKnowledge({ search: () => [] }).install(agent);
    const main = mainStep(agent);
    expect(main.functions).toContain('search_knowledge');
    expect(JSON.stringify(main)).toContain('search_knowledge');
    // Search keeps no record, so it adds no conscience line
    expect('conscience' in paramsOf(agent)).toBe(false);
  });

  it('composes beside Operations', () => {
    const agent = agentOf('both');
    new InfoBotKnowledge({ search: () => [] }).install(agent);
    opsWithCancel().install(agent);
    const main = mainStep(agent);
    expect(main.functions).toContain('search_knowledge');
    expect(main.functions).toContain('cancel_order');
    expect(JSON.stringify(main)).toContain('cancel_order');
    expect(paramsOf(agent)['conscience']).toBe('${global_data.ops.now}');
  });

  it('asks rather than searches for a blank query', async () => {
    const seen: string[] = [];
    const kb = new InfoBotKnowledge({
      search: (q) => {
        seen.push(q);
        return [{ content: 'x', score: 1.0 }];
      },
    });
    expect((await search(kb, { query: '  ' })).toLowerCase()).toContain('no query');
    expect(seen).toEqual([]);
  });

  it('excludes, demotes, ranks and labels', async () => {
    const kb = new InfoBotKnowledge({
      search: () => [
        { content: 'low', score: 0.4, kind: 'keep' },
        { content: 'high', score: 0.9, kind: 'keep' },
        { content: 'commentary', score: 0.95, kind: 'demote' },
        { content: 'spam', score: 0.99, kind: 'drop' },
      ],
    });
    kb.setExclude((r) => r['kind'] === 'drop');
    kb.setDemote((r) => r['kind'] === 'demote');
    kb.setResultContext((r) => `[${String(r['kind'])}]`);
    const blob = await search(kb, { query: 'anything' });
    expect(blob).not.toContain('spam');
    expect(blob.indexOf('high')).toBeLessThan(blob.indexOf('low'));
    expect(blob.indexOf('low')).toBeLessThan(blob.indexOf('commentary'));
    expect(blob).toContain('[keep]');
    expect(blob.startsWith((kb as Loose).grounding)).toBe(true);
  });

  it('limits results, and says when none cover it', async () => {
    const kb = new InfoBotKnowledge({
      search: () => Array.from({ length: 10 }, (_, i) => ({ content: `r${i}`, score: i / 10 })),
      resultLimit: 3,
    });
    const blob = await search(kb, { query: 'q' });
    for (const r of ['r9', 'r8', 'r7']) expect(blob).toContain(r);
    expect(blob).not.toContain('r6');
    const empty = new InfoBotKnowledge({ search: () => [] });
    expect((await search(empty, { query: 'q' })).toLowerCase()).toContain('do not cover it');
  });

  it('offers the contact tool only when enabled', () => {
    const bare = agentOf('a');
    new InfoBotKnowledge({ search: () => [] }).install(bare);
    expect(mainStep(bare).functions).not.toContain('collect_contact');
    const withContact = agentOf('b');
    new InfoBotKnowledge({ search: () => [], contact: () => null }).install(withContact);
    expect(mainStep(withContact).functions).toContain('collect_contact');
  });

  it('records contact details and confirms', async () => {
    const captured: Record<string, string>[] = [];
    const kb = new InfoBotKnowledge({ search: () => [], contact: (f) => captured.push(f) });
    const out = await contact(kb, { name: 'Ann', email: 'ann@example.com', topic: 'pricing' });
    expect(captured).toEqual([{ name: 'Ann', email: 'ann@example.com', topic: 'pricing' }]);
    expect(out.toLowerCase()).toContain('follow up');
  });

  it('requires an email for contact', async () => {
    const captured: Record<string, string>[] = [];
    const kb = new InfoBotKnowledge({ search: () => [], contact: (f) => captured.push(f) });
    expect((await contact(kb, { name: 'Ann' })).toLowerCase()).toContain('email');
    expect(captured).toEqual([]);
  });

  it('fires rules by condition', async () => {
    const kb = new InfoBotKnowledge({
      search: (q) => (q === 'has' ? [{ content: 'hit', score: 1.0 }] : []),
    });
    kb.addRule('ALWAYS', { when: 'always' });
    kb.addRule('RESULTS', { when: 'results' });
    kb.addRule('EMPTY', { when: 'empty' });
    const withResults = await search(kb, { query: 'has' });
    expect(withResults).toContain('ALWAYS');
    expect(withResults).toContain('RESULTS');
    expect(withResults).not.toContain('EMPTY');
    const none = await search(kb, { query: 'none' });
    expect(none).toContain('ALWAYS');
    expect(none).toContain('EMPTY');
    expect(none).not.toContain('RESULTS');
  });

  it('fires a result rule on content', async () => {
    const kb = new InfoBotKnowledge({ search: (q) => [{ content: q, score: 1.0 }] });
    kb.addResultRule((_q, rs) => rs.some((r) => String(r['content']).includes('code')), 'SAW CODE');
    expect(await search(kb, { query: 'show code' })).toContain('SAW CODE');
    expect(await search(kb, { query: 'pricing' })).not.toContain('SAW CODE');
  });

  it('qualifies the search, not the grounding, with a query type', async () => {
    const searched: string[] = [];
    const kb = new InfoBotKnowledge({
      search: (q) => {
        searched.push(q);
        return [{ content: 'x', score: 1.0 }];
      },
    });
    kb.addQueryType('code', 'code example').setQueryTypeHelp('pick code for code');
    await search(kb, { query: 'send a fax', query_type: 'code' });
    expect(searched).toEqual(['send a fax code example']);
    await search(kb, { query: 'pricing' });
    expect(searched.at(-1)).toBe('pricing');
    await search(kb, { query: 'pricing', query_type: 'nope' });
    expect(searched.at(-1)).toBe('pricing');
  });

  it('posts to a search service and parses its results', async () => {
    const captured: Loose = {};
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured.endpoint = url;
      captured.json = JSON.parse(String(init.body));
      captured.auth = (init.headers as Record<string, string>)['Authorization'];
      return new Response(JSON.stringify({ results: [{ content: 'hit', score: 0.9 }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const kb = new InfoBotKnowledge().useSearchService('http://svc:8001', {
      user: 'u',
      password: 'p',
      indexName: 'idx',
      count: 7,
      fetchImpl,
    });
    expect(await search(kb, { query: 'fax' })).toContain('hit');
    expect(captured.endpoint).toBe('http://svc:8001/search');
    expect(captured.json).toEqual({ query: 'fax', index_name: 'idx', count: 7 });
    expect(captured.auth).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`);
  });

  it('fails fast without a backend', () => {
    expect(() => new InfoBotKnowledge().install(agentOf('nb'))).toThrow(/search backend/);
  });

  it('ranks by authority before score', async () => {
    const kb = new InfoBotKnowledge({
      search: () => [
        { content: 'low-auth-high-score', score: 0.9, auth: 1 },
        { content: 'high-auth-low-score', score: 0.4, auth: 5 },
      ],
    });
    kb.setAuthority((r) => r['auth'] as number);
    const blob = await search(kb, { query: 'q' });
    expect(blob.indexOf('high-auth-low-score')).toBeLessThan(blob.indexOf('low-auth-high-score'));
  });

  it('rewrites the search, not the grounding, with a query transform', async () => {
    const searched: string[] = [];
    const kb = new InfoBotKnowledge({
      search: (q) => {
        searched.push(q);
        return [{ content: 'x', score: 1.0 }];
      },
    });
    kb.setQueryTransform((q) => q.replace('fax', 'send_fax'));
    await search(kb, { query: 'how to fax' });
    expect(searched).toEqual(['how to send_fax']);
  });

  it('uses the fallback only when nothing is found', async () => {
    const kb = new InfoBotKnowledge({ search: () => [] });
    kb.setFallback((q) => `web says: ${q}`);
    const blob = await search(kb, { query: 'obscure' });
    expect(blob).toContain('web says: obscure');
    expect(blob.toLowerCase()).not.toContain('do not cover it');
    kb.setFallback(() => null);
    expect((await search(kb, { query: 'x' })).toLowerCase()).toContain('do not cover it');
  });

  it('transforms the kept results with an expander', async () => {
    const kb = new InfoBotKnowledge({ search: () => [{ content: 'short', score: 1.0 }] });
    kb.setExpander((results: Result[]) =>
      results.map((r) => ({ ...r, content: `${String(r['content'])} (expanded)` })),
    );
    expect(await search(kb, { query: 'q' })).toContain('short (expanded)');
  });

  it('installs after Operations too', () => {
    const agent = agentOf('later');
    opsWithCancel().install(agent);
    new InfoBotKnowledge({ search: () => [], contact: () => null }).install(agent);
    const main = mainStep(agent);
    expect(main.functions).toEqual(
      expect.arrayContaining(['cancel_order', 'search_knowledge', 'collect_contact']),
    );
    expect(main.text).toContain('cancel_order');
    expect(main.text).toContain('from search_knowledge, not memory');
  });

  it('goes in the step named', () => {
    const agent = agentOf('faq');
    new InfoBotKnowledge({ search: () => [], step: 'answers' }).install(agent);
    const steps = agent.defineContexts().toDict()['default']!.steps;
    expect(steps.map((s) => s.name)).toEqual(['answers']);
    expect(steps[0]!.functions).toEqual(['search_knowledge']);
  });

  it('takes any one of its contact field sets', async () => {
    const took: Record<string, string>[] = [];
    const kb = new InfoBotKnowledge({
      search: () => [],
      contact: (f) => took.push(f),
      contactFields: {
        name: new Field('string', "The caller's name.", { required: false }),
        email: new Field('string', 'An email address.'),
        phone: new Field('string', 'A phone number to call back.', {
          ask: 'Ask for a number to call them back on.',
        }),
      },
      contactAnyOf: [['email'], ['phone']],
    });
    const agent = agentOf('cb');
    kb.install(agent);
    const tool = agent.getTool('collect_contact')!;
    expect(tool.required ?? []).toEqual([]);
    expect(await contact(kb, { name: 'Ann' })).toBe('Ask them for email or phone.');
    expect((await contact(kb, { phone: '555' })).startsWith('Thanks')).toBe(true);
    expect(took).toEqual([{ name: '', email: '', phone: '555' }]);
    expect(() => new InfoBotKnowledge({ search: () => [], contactAnyOf: [['fax']] })).toThrow(
      /fax/,
    );
  });

  it('takes the default contact fields for an empty set of them', async () => {
    const took: Record<string, string>[] = [];
    const kb = new InfoBotKnowledge({
      search: () => [],
      contact: (f) => took.push(f),
      contactFields: {},
    });
    expect(await contact(kb, {})).toBe('Ask them for an email address to reach them at.');
    expect(took).toEqual([]);
  });

  it("asks for one contact set with each field's own words", async () => {
    const kb = new InfoBotKnowledge({ search: () => [], contact: () => null });
    expect(await contact(kb, {})).toBe('Ask them for an email address to reach them at.');
  });

  it('awaits an async search', async () => {
    const kb = new InfoBotKnowledge({
      search: async (q) => [{ content: `about ${q}`, score: 1.0 }],
    });
    kb.install(agentOf('as'));
    expect(await search(kb, { query: 'hours' })).toContain('about hours');
  });

  it('takes wording of its own', () => {
    const kb = new InfoBotKnowledge({
      search: () => [],
      wording: { 'search.not_covered': 'No lo cubren.' },
    });
    expect(kb._format('q', []).endsWith('No lo cubren.')).toBe(true);
    expect(() => new InfoBotKnowledge({ search: () => [], wording: { nope: 'x' } })).toThrow(
      /KNOWLEDGE_WORDING/,
    );
  });
});
