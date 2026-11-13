/**
 * The confirm pattern, from signalwire-python 3.8.0: a function reads a change
 * back and records it, and the confirm tool's gates judge the caller's answer
 * on the proposal's dialogue.
 *
 * The platform starts a proposal when semantic_state changes, as of the start
 * of the action object that sets it, and a say in that object runs first, so
 * the read-back is the proposal's first turn. Setting the same state again
 * marks nothing, so asking again needs a new revision.
 */
import { AgentBase } from '../../src/AgentBase.js';
import { Proposal, current, gateDefinitions } from '../../src/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;

const READ_BACK = "That's a large tea for pickup at five. Is that right?";
const raw = (state: Json | null): Json => ({
  global_data: state !== null ? { semantic_state: state } : {},
});
const dict = (r: { toDict(): unknown }): Json => r.toDict() as Json;

describe('Proposal.propose', () => {
  it('makes the read-back and the state one action', () => {
    const result = dict(
      new Proposal('place_order').propose(READ_BACK, { details: { item: 'tea' } }),
    );
    expect(result['action'][0]).toEqual({
      say: READ_BACK,
      set_global_data: { semantic_state: { item: 'tea', proposal: READ_BACK, revision: 1 } },
    });
    expect(result['action'][1]).toEqual({ wait_for_user: true });
    expect(result['action']).toHaveLength(2);
  });

  it('tells the model what to wait for', () => {
    const response = dict(
      new Proposal('place_order', { declineTool: 'change_order' }).propose(READ_BACK),
    )['response'];
    expect(response['tool_result']).toBe(`Read back to the caller: ${READ_BACK}`);
    expect(response['tool_prompt']).toContain('Call place_order only when they say yes');
    expect(response['tool_prompt']).toContain('call change_order');
  });

  it('gives a new proposal the next revision', () => {
    const r = raw({ proposal: 'older', revision: 3 });
    const state = dict(new Proposal('place_order').propose(READ_BACK, { rawData: r }))['action'][0][
      'set_global_data'
    ]['semantic_state'];
    expect(state['revision']).toBe(4);
  });

  it('reads the same change again as a new revision', () => {
    const r = raw({ proposal: READ_BACK, revision: 1, item: 'tea' });
    const first = dict(new Proposal('place_order').askAgain(r))['action'][0];
    expect(first['say']).toBe(READ_BACK);
    expect(first['set_global_data']['semantic_state']).toEqual({
      item: 'tea',
      proposal: READ_BACK,
      revision: 2,
    });
  });

  it('needs a proposal to ask again', () => {
    expect(() => new Proposal('place_order').askAgain(raw({ done: 'x' }))).toThrow(/no proposal/);
  });

  it('records what was done', () => {
    expect(dict(new Proposal('place_order').complete('Order 4471 is placed.'))['action']).toEqual([
      { set_global_data: { semantic_state: { done: 'Order 4471 is placed.' } } },
    ]);
  });
});

describe('Proposal.confirmGates', () => {
  it('gives three gates on the proposal dialogue', () => {
    const gates = new Proposal('place_order').confirmGates().map((g) => g.toDict() as Json);
    expect(gates.map((g) => g['id'])).toEqual(['answered', 'agreed', 'read_back']);
    expect(new Set(gates.map((g) => `${g['dialogue']} ${g['threshold']}`))).toEqual(
      new Set(['proposal 0.8']),
    );
    // The platform's rules hold: one dialogue for all of them
    expect(gateDefinitions(gates, 'place_order')).toHaveLength(3);
  });

  it('quotes the proposal and turns chaining off when one fails', () => {
    const agreed = new Proposal('place_order', { declineTool: 'change_order' }).confirmGates()[1]!;
    const onFail = (agreed.toDict() as Json)['on_fail'];
    expect(onFail['response']['tool_result']).toBe(
      'place_order was not run. The caller has not said yes to this change.',
    );
    expect(onFail['response']['tool_prompt']).toContain('${global_data.semantic_state.proposal}');
    expect(onFail['response']['tool_prompt']).toContain('call change_order');
    expect(onFail['action']).toEqual([{ back_to_back_functions: false }]);
  });

  it('gives unclear gates', () => {
    const gates = new Proposal('place_order', { unclear: true, threshold: 0.6 })
      .confirmGates()
      .map((g) => g.toDict() as Json);
    expect(gates.every((g) => g['unclear'] === true && g['threshold'] === 0.6)).toBe(true);
    expect(gates.every((g) => 'on_unclear' in g)).toBe(true);
  });

  it('renders on the confirm tool', () => {
    const agent = new AgentBase({ name: 'shop', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('x');
    agent.defineTool({
      name: 'place_order',
      description: 'Place the order',
      handler: () => 'placed',
      gates: new Proposal('place_order').confirmGates(),
    });
    const main = JSON.parse(agent.renderSwml())['sections']['main'] as Json[];
    const ai = main.find((v) => 'ai' in v)!['ai'];
    expect(ai['SWAIG']['functions'][0]['gates']).toHaveLength(3);
  });
});

describe('current', () => {
  it('gives the proposal in the request', () => {
    const state = { proposal: READ_BACK, revision: 2 };
    expect(current(raw(state))).toEqual(state);
  });

  it.each([null, {}, raw(null), raw({ done: 'x' }), { global_data: 'x' }])(
    'gives null without one (%j)',
    (r) => {
      expect(current(r as Json)).toBeNull();
    },
  );
});
