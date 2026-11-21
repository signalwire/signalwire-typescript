/**
 * Step._extend: a layer adding to a step another layer made.
 */

import { Step } from '../src/ContextBuilder.js';

describe('Step._extend', () => {
  it('joins its text and functions to what the step has', () => {
    const step = new Step('main').setText('Help them.').setFunctions(['a', 'b']);
    step._extend('Also look things up.', ['b', 'c']);
    const data = step.toDict();
    expect(data.text).toBe('Help them.\n\nAlso look things up.');
    expect(data.functions).toEqual(['a', 'b', 'c']);
  });

  it('gives a step written in sections a section', () => {
    const step = new Step('main').addSection('Task', 'Help them.');
    step._extend('Also look things up.', ['c'], 'What else you can do');
    const text = String(step.toDict().text);
    expect(text).toContain('Task');
    expect(text).toContain('What else you can do');
    expect(text).toContain('Also look things up.');
    expect(step.toDict().functions).toEqual(['c']);
  });

  it('gives a step with no functions of its own the ones added', () => {
    const step = new Step('main').setText('Help them.');
    step._extend('', ['x']);
    expect(step.toDict().functions).toEqual(['x']);
    expect(step.toDict().text).toBe('Help them.');
  });
});
