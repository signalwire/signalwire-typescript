/**
 * The medium: given to a service, or found on each call's first request.
 */

import { AgentBase } from '../../src/AgentBase.js';
import { type CallContext, Operations, ServiceAgent } from '../../src/operations/agent.js';
import { Change, Operation } from '../../src/operations/model.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';
import type { Loose } from './helpers.js';

function withCancel<T extends Operations | ServiceAgent>(ops: T): T {
  ops.writesWith(() => null);
  class Cancel extends Operation {
    static override description = 'Cancel an order.';
    override prepare(call: CallContext): Change {
      return new Change({ readBack: `Cancel it (${call.medium || 'no medium'}). Shall I?` });
    }
  }
  ops.operation(Cancel, { tool: 'cancel_order' });
  return ops;
}

function rulesOf(agent: AgentBase): string[] {
  return [...(agent.pom!.toDict().find((s) => s.title === 'Rules')!.bullets ?? [])];
}

function aiOf(swml: string): Loose {
  const doc = JSON.parse(swml);
  return doc.sections.main.find((v: Loose) => 'ai' in v).ai;
}

const agentOf = (name: string) => new AgentBase({ name, suppressLogs: true });

describe('the medium', () => {
  it('goes in the rules of a service given one', () => {
    const voice = withCancel(new Operations({ role: 'r', medium: 'voice' })).install(agentOf('v'));
    expect(rulesOf(voice)[0]).toBe(
      'This is a phone call. Keep each reply short, but give every fact the caller asks for.',
    );
    const chat = withCancel(new Operations({ role: 'r', medium: 'chat' })).install(agentOf('c'));
    expect(rulesOf(chat)[0]!.startsWith('This is a chat. Keep each reply short')).toBe(true);
    expect(() => new Operations({ role: 'r', medium: 'fax' })).toThrow(/voice, chat/);
  });

  it("isn't assumed in the rules without one", () => {
    const agent = withCancel(new Operations({ role: 'r' })).install(agentOf('n'));
    expect(rulesOf(agent)[0]).toBe(
      'Keep each reply short, but give every fact the caller asks for.',
    );
    expect((agent as Loose).globalData['ops']['medium']).toBe('');
  });

  it('changes rules by key, or a list replaces them', () => {
    const keyed = withCancel(
      new Operations({ role: 'r', rules: { facts: null, tone: 'Be warm.' } }),
    );
    expect(rulesOf(keyed.install(agentOf('k')))).toEqual([
      'Keep each reply short, but give every fact the caller asks for.',
      'Nothing changes until the caller says yes to a change read back to them and it is confirmed.',
      'Be warm.',
    ]);
    const listed = withCancel(
      new Operations({ role: 'r', rules: ['Only this.'], medium: 'voice' }),
    );
    expect(rulesOf(listed.install(agentOf('l')))).toEqual(['Only this.']);
    const lookupsOnly = new Operations({ role: 'r' });
    lookupsOnly.lookup('Hours.')(function hours() {
      return '9 to 5';
    });
    expect(rulesOf(lookupsOnly.install(agentOf('h')))).toHaveLength(2);
  });

  it("is found on the call's first request", async () => {
    const ops = withCancel(new Operations({ role: 'r' }));
    const chat: Loose = await ops.prefilled({ conversation_type: 'chat' });
    expect(chat['ops']['medium']).toBe('chat');
    expect(chat['ops']['now']).toBe('This is a chat.');
    const voice: Loose = await ops.prefilled({ call: { call_id: 'c1' } });
    expect(voice['ops']['medium']).toBe('voice');
    expect(await ops.prefilled({})).toBeNull();
    expect(await ops.prefilled({ conversation_type: 'fax' })).toBeNull();
    const fixed = withCancel(new Operations({ role: 'r', medium: 'voice' }));
    // A service's own medium stands
    expect(await fixed.prefilled({ conversation_type: 'chat' })).toBeNull();
  });

  it("is the service's, or the call's", async () => {
    const ops = withCancel(new Operations({ role: 'r' }));
    const agent = ops.install(agentOf('m'));
    const sim = new CallSimulator(agent, {
      globalData: (await ops.prefilled({ conversation_type: 'chat' }))!,
    });
    const out = await sim.call('cancel_order', { data_supplied_by_user: true });
    expect(out.response).toContain('Cancel it (chat)');
    expect(String((sim.globalData['ops'] as Loose)['now'])).toMatch(
      /^This is a chat\.\nWaiting for their answer/,
    );
  });

  it('starts each call with its record on both render paths', async () => {
    const agent = withCancel(
      new ServiceAgent({ name: 's', role: 'r', suppressLogs: true, basicAuth: ['u', 'p'] }),
    );
    const mods: Loose = await agent.onSwmlRequest({ conversation_type: 'chat' });
    expect(mods['global_data']['ops']['medium']).toBe('chat');
    // With a per-request callback the SWML renders on a copy, with the same modifications
    const seen: string[] = [];
    agent.setDynamicConfigCallback((_q, body) => {
      seen.push(String((body as Record<string, unknown>)['conversation_type']));
    });
    const auth = `Basic ${Buffer.from('u:p').toString('base64')}`;
    const [status, , body] = await agent.handleRequest(
      'POST',
      'http://localhost/',
      { authorization: auth },
      { conversation_type: 'chat' },
    );
    expect(status).toBe(200);
    expect(seen).toEqual(['chat']);
    expect(aiOf(body)['global_data']['ops']['medium']).toBe('chat');
    // The agent itself is left as it was
    expect(aiOf(agent.renderSwml())['global_data']['ops']['medium']).toBe('');
  });
});

describe('a per-request copy', () => {
  it('starts with the record before its callbacks, which keep their changes', async () => {
    const agent = withCancel(
      new ServiceAgent({ name: 's2', role: 'r', suppressLogs: true, basicAuth: ['u', 'p'] }),
    );
    agent.identify({
      anyOf: [['phone']],
      find: (_call, keys) => (keys['phone'] === '555' ? 'u1' : null),
      describe: () => 'Ann',
      prefill: (requestData) => ({ phone: requestData['caller_id_num'] }),
    });
    const seen: Loose[] = [];
    agent.setDynamicConfigCallback((_q, _body, _h, copy) => {
      const record = structuredClone((copy as Loose).globalData['ops']);
      seen.push({ account_id: record['account_id'], medium: record['medium'] });
      record['state'] = { custom: 'kept' };
      copy.updateGlobalData({ ops: record });
    });
    const auth = `Basic ${Buffer.from('u:p').toString('base64')}`;
    const [status, , body] = await agent.handleRequest(
      'POST',
      'http://localhost/',
      { authorization: auth },
      { conversation_type: 'chat', caller_id_num: '555' },
    );
    expect(status).toBe(200);
    expect(seen).toEqual([{ account_id: 'u1', medium: 'chat' }]);
    const ops = aiOf(body)['global_data']['ops'];
    expect(ops['state']).toEqual({ custom: 'kept' });
    expect(ops['account_id']).toBe('u1');
  });
});
