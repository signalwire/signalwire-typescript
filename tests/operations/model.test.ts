/**
 * What a developer writes for an operations agent: fields, changes, writes,
 * and the two ways `prepare` says no.
 */

import {
  Change,
  Field,
  NOT_SAID,
  Need,
  Operation,
  Refuse,
  Values,
  Write,
  WriteFailed,
} from '../../src/operations/model.js';

describe('Need, Refuse and WriteFailed', () => {
  it('carry what the model is told', () => {
    const need = new Need('Which size?', ['size']);
    expect(need).toBeInstanceOf(Error);
    expect([need.ask, need.fields, need.message]).toEqual(['Which size?', ['size'], 'Which size?']);
    const refuse = new Refuse('Only pending orders.', 'Offer a return.', { keep: true });
    expect([refuse.why, refuse.then, refuse.keep]).toEqual([
      'Only pending orders.',
      'Offer a return.',
      true,
    ]);
    expect([new Refuse('No.').then, new Refuse('No.').keep]).toEqual([null, false]);
    expect(new WriteFailed('Declined.').reason).toBe('Declined.');
  });
});

describe('Write', () => {
  it('round-trips through the record and compares by value', () => {
    const w = new Write('cancel', { order_id: '#1', items: [1, { a: 2 }] });
    expect(w.toDict()).toEqual({ name: 'cancel', args: { order_id: '#1', items: [1, { a: 2 }] } });
    expect(Write.fromDict(w.toDict()).equals(w)).toBe(true);
    expect(w.equals(new Write('cancel', { order_id: '#2', items: [1, { a: 2 }] }))).toBe(false);
    expect(w.equals({ name: 'cancel', args: w.args })).toBe(false);
    const empty = Write.fromDict({ name: null, args: null });
    expect([empty.name, empty.args]).toEqual(['', {}]);
  });
});

describe('Change', () => {
  const writes = (n: number) => Array.from({ length: n }, (_, i) => new Write(`w${i}`));

  it('says the default line once the last write went through', () => {
    const c = new Change({
      readBack: 'Cancel #1. Refund $5. Shall I go ahead?',
      writes: writes(3),
      money: [-5, '1.50'],
    });
    expect(c.doneLines()).toEqual(['', '', "It's done: Cancel #1. Refund $5."]);
    expect(c.moneyMoved()).toEqual(['-5', '1.50', '0']);
  });

  it('takes one sentence for the whole change, or one per write', () => {
    expect(new Change({ readBack: 'x', done: 'All done.', writes: writes(2) }).doneLines()).toEqual(
      ['', 'All done.'],
    );
    expect(
      new Change({ readBack: 'x', done: ['one', 'two', 'three'], writes: writes(2) }).doneLines(),
    ).toEqual(['one', 'two']);
    expect(new Change({ readBack: 'x', done: ['one'], writes: writes(2) }).doneLines()).toEqual([
      'one',
      '',
    ]);
  });

  it('moves all its money when it has no writes', () => {
    expect(new Change({ readBack: 'x', money: [1, -2.5, '0.10'] }).moneyMoved()).toEqual([
      '1',
      '-2.5',
      '0.10',
    ]);
    expect(new Change({ readBack: 'x' }).moneyMoved()).toEqual([]);
  });

  it('keeps the read-back when every sentence is a question', () => {
    expect(new Change({ readBack: 'Is it ok? Really?' }).doneLines('{statement}')).toEqual([
      'Is it ok? Really?',
    ]);
    expect(new Change({ readBack: 'Do it! Ok? Fine.' }).doneLines('{statement}')).toEqual([
      'Do it! Fine.',
    ]);
  });
});

describe('Field', () => {
  it('gives its JSON schema', () => {
    expect(new Field(['a', 'b'], 'd', { ask: 'q' }).schema()).toEqual({
      type: 'string',
      enum: ['a', 'b'],
      description: 'd',
    });
    expect(new Field({ type: 'array', items: { type: 'string' } }, 'd').schema()).toEqual({
      type: 'array',
      items: { type: 'string' },
      description: 'd',
    });
    expect(new Field(String, 'd').schema()).toEqual({ type: 'string', description: 'd' });
    expect(new Field('integer', 'd').schema()).toEqual({ type: 'integer', description: 'd' });
    const f = new Field('string', 'd');
    expect([f.required, f.ask, Object.isFrozen(f)]).toEqual([true, null, true]);
  });

  it("fails on a kind it can't make a schema of, when the schema is made", () => {
    const f = new Field('text' as never, 'd');
    expect(() => f.schema()).toThrow(TypeError);
  });
});

describe('Values', () => {
  it('reads a field not given as null', () => {
    const v = new Values(
      { a: new Field('string', 'x'), b: new Field('string', 'y'), c: new Field('string', 'z') },
      { a: ` ${NOT_SAID.replace('n', 'N')} `, b: 0 },
    );
    expect([v['a'], v['b'], v['c']]).toEqual([null, 0, null]);
    expect(v.get('a', 'dflt')).toBe('dflt');
    expect(v.args).toEqual({ a: ' Not said ', b: 0 });
    expect(v['other']).toBeUndefined();
  });
});

describe('Operation', () => {
  class Base extends Operation {
    items = new Field({ type: 'array' }, 'items');
  }
  class Op extends Base {
    static override description = 'Cancel things.\n\nMore detail.';
    note = new Field('string', 'n', { required: false });
  }

  it('lists its fields in declaration order, the base class first', () => {
    expect(Object.keys(new Op().fields())).toEqual(['items', 'note']);
  });

  it("describes itself by its description's first paragraph", () => {
    expect(Op.describe()).toBe('Cancel things.');
    expect(Operation.describe()).toBe('');
  });

  it('merges a request made as well into the one waiting', () => {
    expect(
      new Op().merge({ items: [1, 2], note: 'keep' }, { items: [2, 3], note: NOT_SAID }),
    ).toEqual({ items: [1, 2, 3], note: 'keep' });
  });

  it('applies through the service by default, and has no conflicts or split', () => {
    const write = new Write('w');
    const call = { service: { applyWrite: (_c: unknown, w: Write) => `wrote ${w.name}` } };
    const op = new Op();
    expect(op.apply(call, write)).toBe('wrote w');
    expect(
      op.conflictsWith('x', new Change({ readBack: 'a' }), new Change({ readBack: 'b' })),
    ).toBeNull();
    expect(op.without({}, new Set())).toBeNull();
    expect(() => op.prepare(call, new Values({}, {}))).toThrow(/Op\.prepare/);
  });
});
