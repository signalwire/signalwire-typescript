/**
 * RequestList, from signalwire-python 3.8.0: what the caller asked for while
 * the agent was busy, kept in the call's global_data, to take up when the
 * current task is done.
 */
import { RequestList, type FunctionResult } from '../../src/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;

const raw = (requests: Json[] | null): Json => ({
  global_data: requests !== null ? { later: requests } : {},
});
const stored = (result: FunctionResult): Json =>
  (result.toDict() as Json)['action'][0]['set_global_data'];

const LATER = new RequestList('later', {
  openers: {
    balance: 'You also asked about your balance.',
    question: 'You had a question: {about}.',
  },
});

describe('RequestList', () => {
  it('notes a request and tells the model', () => {
    const result = LATER.note(raw(null), 'question', 'the store hours').toDict() as Json;
    expect(result['response']['tool_result']).toBe('Noted for right after this: the store hours.');
    expect(result['response']['tool_prompt']).toContain('carry on with what you were doing');
    const kept = result['action'][0]['set_global_data'];
    expect(kept['later']).toEqual([{ kind: 'question', about: 'the store hours' }]);
    expect(kept['later_text']).toBe(
      'Noted for right after this:\n1. You had a question: the store hours.\n' +
        "When the current task is done, take these up in order, then ask if there's anything else.",
    );
  });

  it("keeps notes in order and doesn't repeat one", () => {
    const r = raw([{ kind: 'balance', about: 'the balance' }]);
    expect(
      stored(LATER.note(r, 'question', 'returns'))['later'].map((x: Json) => x['about']),
    ).toEqual(['the balance', 'returns']);
    expect(stored(LATER.note(r, 'balance', 'the balance'))['later']).toEqual(
      r['global_data']['later'],
    );
  });

  it('gives the next and removes it when done', () => {
    const r = raw([
      { kind: 'balance', about: 'the balance' },
      { kind: 'other', about: 'store hours' },
    ]);
    expect(LATER.next(r)).toEqual({
      kind: 'balance',
      about: 'the balance',
      opener: 'You also asked about your balance.',
    });
    const kept = stored(LATER.done(r));
    expect(kept['later']).toEqual([{ kind: 'other', about: 'store hours' }]);
    expect(kept['later_text']).toContain('1. store hours');
  });

  it('handles an empty list', () => {
    expect(LATER.next(raw(null))).toBeNull();
    expect(stored(LATER.done(raw([{ kind: 'x', about: 'y' }])))).toEqual({
      later: [],
      later_text: '',
    });
    expect(LATER.defaults()).toEqual({ later: [], later_text: '' });
  });

  it('ignores malformed state', () => {
    expect(LATER.pending({ global_data: { later: 'x' } })).toEqual([]);
    expect(LATER.pending({ global_data: { later: [1, { kind: 'a', about: 'b' }] } })).toEqual([
      { kind: 'a', about: 'b' },
    ]);
    expect(LATER.pending(null)).toEqual([]);
  });

  it('fills in only {about}, and takes the text as written', () => {
    const odd = new RequestList('later', { openers: { x: '{about} {and more}' } });
    expect(odd.opener({ kind: 'x', about: 'hours' })).toBe('hours {and more}');
    expect(odd.opener({ kind: 'x', about: '$& $1' })).toBe('$& $1 {and more}');
    expect(odd.opener({ kind: 'constructor', about: 'hours' })).toBe('hours');
  });
});
