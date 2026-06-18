import { describe, it, expect } from 'vitest';
import { FunctionResult } from '../src/FunctionResult.js';
import { ContextBuilder, GatherInfo, GatherQuestion } from '../src/ContextBuilder.js';
import { PomBuilder, PomSection } from '../src/PomBuilder.js';
import { PromptObjectModel } from '../src/POM/PromptObjectModel.js';

/**
 * Every builder exposes toDict() (Python parity). Issue #19377 adds the
 * TS-native toJSON() hook so JSON.stringify(builder) emits the wire shape
 * instead of the internal field layout. These tests assert the two agree.
 */
describe('toJSON() delegates to toDict() (wire shape)', () => {
  function assertWireShape(obj: { toDict(): unknown }) {
    // JSON.stringify(obj) invokes obj.toJSON(); compare against the dict.
    expect(JSON.parse(JSON.stringify(obj))).toEqual(JSON.parse(JSON.stringify(obj.toDict())));
  }

  it('FunctionResult', () => {
    const r = new FunctionResult('hello').setPostProcess(true);
    assertWireShape(r);
  });

  it('GatherQuestion', () => {
    const q = new GatherQuestion({
      key: 'name',
      question: 'What is your name?',
      confirm: true,
    });
    assertWireShape(q);
  });

  it('GatherInfo', () => {
    const gi = new GatherInfo({ outputKey: 'out' });
    gi.addQuestion({ key: 'color', question: 'Favorite color?' });
    assertWireShape(gi);
  });

  it('Step', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    const step = ctx.addStep('greeting', { task: 'Greet the caller' });
    assertWireShape(step);
  });

  it('Context', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    ctx.addStep('greeting', { task: 'Greet the caller' });
    assertWireShape(ctx);
  });

  it('ContextBuilder', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    ctx.addStep('greeting', { task: 'Greet the caller' });
    assertWireShape(cb);
  });

  it('PomSection', () => {
    const s = new PomSection({ title: 'Role', body: 'You are helpful' });
    assertWireShape(s);
  });

  it('PomBuilder', () => {
    const b = new PomBuilder()
      .addSection('Role', { body: 'You are a helper' })
      .addSection('Rules', { bullets: ['Be nice', 'Be helpful'] });
    assertWireShape(b);
  });

  it('Section (POM)', () => {
    const model = new PromptObjectModel();
    const s = model.addSection('Role', { body: 'You are helpful' });
    assertWireShape(s);
  });

  it('PromptObjectModel', () => {
    const model = new PromptObjectModel();
    model.addSection('Role', { body: 'You are helpful' });
    model.addSection('Rules', { bullets: ['Be nice'] });
    assertWireShape(model);
  });
});
