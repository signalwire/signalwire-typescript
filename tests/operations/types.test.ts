/**
 * The registration and install methods give back what they were given, typed
 * as it was: an agent subclass, an Operation subclass.
 */

import { AgentBase } from '../../src/AgentBase.js';
import { Operations, ServiceAgent } from '../../src/operations/agent.js';
import { Continuity, InfoBotKnowledge } from '../../src/operations/infobot/index.js';
import { Change, Operation } from '../../src/operations/model.js';

class MyAgent extends AgentBase {
  customMethod(): string {
    return 'mine';
  }
}

class MyOperation extends Operation {
  static override description = 'Do a thing.';
  static customStaticMethod(): string {
    return 'static';
  }
  override prepare(): Change {
    return new Change({ readBack: 'Do it?' });
  }
}

describe('what install and operation give back', () => {
  it('keeps the subclass types', () => {
    const agent = () => new MyAgent({ name: 'm', suppressLogs: true });
    expect(new Operations({ role: 'r' }).install(agent()).customMethod()).toBe('mine');
    expect(new InfoBotKnowledge({ search: () => [] }).install(agent()).customMethod()).toBe('mine');
    expect(new Continuity().install(agent()).customMethod()).toBe('mine');
    expect(new Operations({ role: 'r' }).operation(MyOperation).customStaticMethod()).toBe(
      'static',
    );
    const service = new ServiceAgent({ name: 's', role: 'r', suppressLogs: true });
    expect(service.operation(MyOperation).customStaticMethod()).toBe('static');
  });
});
