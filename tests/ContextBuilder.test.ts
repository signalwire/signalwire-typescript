import { describe, it, expect } from 'vitest';
import { ContextBuilder, Context, GatherInfo, GatherQuestion } from '../src/ContextBuilder.js';

describe('ContextBuilder', () => {
  it('addContext throws when exceeding MAX_CONTEXTS (50)', () => {
    const cb = new ContextBuilder();
    for (let i = 0; i < 50; i++) {
      cb.addContext(`ctx_${i}`);
    }
    expect(() => cb.addContext('one_too_many')).toThrow('Maximum number of contexts (50) exceeded');
  });

  it('addStep throws when exceeding MAX_STEPS_PER_CONTEXT (100)', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    for (let i = 0; i < 100; i++) {
      ctx.addStep(`step_${i}`, { task: `Task ${i}` });
    }
    expect(() => ctx.addStep('one_too_many', { task: 'Overflow' })).toThrow(
      'Maximum steps per context (100) exceeded'
    );
  });

  it('allows exactly 50 contexts', () => {
    const cb = new ContextBuilder();
    for (let i = 0; i < 50; i++) {
      cb.addContext(`ctx_${i}`);
    }
    expect(cb.getContext('ctx_49')).toBeDefined();
  });

  it('allows exactly 100 steps per context', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    for (let i = 0; i < 100; i++) {
      ctx.addStep(`step_${i}`, { task: `Task ${i}` });
    }
    expect(ctx.getStep('step_99')).toBeDefined();
  });

  // ── completion_action validation ─────────────────────────────────

  it('next_step valid when following step exists', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    ctx.addStep('step1', { task: 'First step' })
      .setGatherInfo({ completionAction: 'next_step' })
      .addGatherQuestion({ key: 'name', question: 'What is your name?' });
    ctx.addStep('step2', { task: 'Second step' });
    expect(() => cb.validate()).not.toThrow();
  });

  it('next_step invalid on last step', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    ctx.addStep('only_step', { task: 'Only step' })
      .setGatherInfo({ completionAction: 'next_step' })
      .addGatherQuestion({ key: 'name', question: 'What is your name?' });
    expect(() => cb.validate()).toThrow(
      "Step 'only_step' in context 'default' has gather_info completion_action='next_step' but it is the last step in the context",
    );
  });

  it('named step valid when step exists', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    ctx.addStep('step1', { task: 'First step' })
      .setGatherInfo({ completionAction: 'step2' })
      .addGatherQuestion({ key: 'name', question: 'What is your name?' });
    ctx.addStep('step2', { task: 'Second step' });
    expect(() => cb.validate()).not.toThrow();
  });

  it('named step invalid when not defined', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    ctx.addStep('step1', { task: 'First step' })
      .setGatherInfo({ completionAction: 'nonexistent' })
      .addGatherQuestion({ key: 'name', question: 'What is your name?' });
    ctx.addStep('step2', { task: 'Second step' });
    expect(() => cb.validate()).toThrow(
      "Step 'step1' in context 'default' has gather_info completion_action='nonexistent' but step 'nonexistent' does not exist in this context",
    );
  });

  it('no completion_action always valid', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    ctx.addStep('step1', { task: 'First step' })
      .setGatherInfo({})
      .addGatherQuestion({ key: 'name', question: 'What is your name?' });
    expect(() => cb.validate()).not.toThrow();
  });

  it('GatherInfo requires at least one question', () => {
    const gi = new GatherInfo({});
    expect(() => gi.toDict()).toThrow('gather_info must have at least one question');
  });

  it('GatherQuestion basic creation and serialization', () => {
    const q = new GatherQuestion({ key: 'age', question: 'How old are you?', type: 'number', confirm: true });
    const d = q.toDict();
    expect(d.key).toBe('age');
    expect(d.question).toBe('How old are you?');
    expect(d.type).toBe('number');
    expect(d.confirm).toBe(true);
  });
});
