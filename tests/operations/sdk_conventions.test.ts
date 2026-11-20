/**
 * The SDK's conventions for the operations module: the request context's
 * name, one install, and where offered tools go.
 */

import { FunctionResult } from '../../src/FunctionResult.js';
import { CallContext, type Operations, ServiceAgent } from '../../src/operations/agent.js';
import * as agentModule from '../../src/operations/agent.js';
import { Change, Field, Operation, type Values } from '../../src/operations/model.js';

function store(): ServiceAgent {
  const agent = new ServiceAgent({ name: 'store', role: 'You run a store.', suppressLogs: true });
  class Cancel extends Operation {
    static override description = 'Cancel an order.';
    order_id = new Field('string', 'The order.');
    override prepare(_call: CallContext, f: Values): Change {
      return new Change({
        readBack: `Cancel ${String(f['order_id'])}. Shall I?`,
        touches: [`order:${String(f['order_id'])}`],
      });
    }
  }
  agent.operation(Cancel, { tool: 'cancel_order' });
  return agent;
}

function steps(agent: ServiceAgent): Record<string, string[]> {
  agent.compile();
  const all = agent.defineContexts().toDict()['default']!.steps;
  return Object.fromEntries(all.map((s) => [s.name, [...((s.functions as string[]) ?? [])]]));
}

describe('SDK conventions', () => {
  it('calls the request context CallContext', () => {
    // Not Call: the RELAY Call is a live call
    expect(agentModule.CallContext).toBe(CallContext);
    expect('Call' in agentModule).toBe(false);
  });

  it('installs once', () => {
    const agent = store();
    let installs = 0;
    const ops = agent.ops as Operations & { install: Operations['install'] };
    const real = ops.install.bind(ops);
    ops.install = (target) => {
      installs += 1;
      return real(target);
    };
    agent.compile();
    agent.compile();
    agent.renderSwml();
    expect(installs).toBe(1);
  });

  it('tries a failed install again', () => {
    const agent = store();
    const ops = agent.ops as Operations & { install: Operations['install'] };
    const real = ops.install.bind(ops);
    let calls = 0;
    ops.install = (target) => {
      calls += 1;
      if (calls === 1) throw new Error('first install fails');
      return real(target);
    };
    expect(() => agent.compile()).toThrow('first install fails');
    agent.compile();
    expect(calls).toBe(2);
  });

  it('offers a tool in every step but confirm by default', () => {
    const agent = store();
    agent.defineTool({
      name: 'weather',
      description: 'Weather.',
      parameters: {},
      handler: () => new FunctionResult('Sunny.'),
    });
    agent.offer(['weather']);
    const s = steps(agent);
    expect(s['main']).toContain('weather');
    expect(s['confirm']).not.toContain('weather');
  });

  it('offers a tool in the steps it names', () => {
    const agent = store();
    agent.defineTool({
      name: 'menu',
      description: 'Menu.',
      parameters: {},
      handler: () => new FunctionResult('Soup.'),
    });
    agent.offer(['menu'], { steps: ['confirm'] });
    const s = steps(agent);
    expect(s['confirm']).toContain('menu');
    expect(s['main']).not.toContain('menu');
  });
});
