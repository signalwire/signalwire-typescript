import { describe, it, expect } from 'vitest';
import { SWMLService } from '../src/SWMLService.js';
import { AgentBase } from '../src/AgentBase.js';

/**
 * SWML strict-render contract (Wave-2 P#5) — TS port of the python reference
 * suite (signalwire-python tests/unit/core/test_swml_strict_render.py).
 *
 * Building/rendering an SWML document with a MISSHAPEN config, an UNKNOWN verb,
 * or a MISSPELLED key must RAISE — not silently drop or accept it. The r5
 * "silent-drop family": unknown verbs appended, misspelled/unknown verb-config
 * keys swallowed, and dangling SWAIG step-function references emitted with no
 * warning.
 *
 * Most of the contract is enforced at the `addVerb` choke point via full
 * Draft-2020-12 schema validation (unknown verb, misspelled/unknown keys on
 * closed verbs, wrong-typed config). The two GAPs pinned here:
 *   GAP1 — the `ai` verb must reject unknown/misspelled TOP-LEVEL keys
 *          (`temperatur`, `zzz`) while `ai.params` stays open.
 *   GAP2 — a step's `setFunctions([...])` whitelist referencing a function that
 *          is neither a registered SWAIG tool nor a reserved native must raise.
 */

/** A SWMLService with schema validation ENABLED (the production default). */
const strictService = (): SWMLService => new SWMLService({ name: 'strict', route: '/strict' });

// ── Baseline: already-enforced parts of the contract (regression guards) ──

describe('SWML strict-render — unknown verb', () => {
  it('rejects an unknown verb', () => {
    expect(() => strictService().addVerb('foobar', {})).toThrow(/foobar/);
  });

  it('renders a good verb', () => {
    expect(() => strictService().addVerb('answer', { max_duration: 5 })).not.toThrow();
  });
});

describe('SWML strict-render — misspelled/unknown key on a closed verb', () => {
  const badCases: [string, Record<string, unknown>][] = [
    ['answer', { maxduration: 5 }], // misspelled max_duration
    ['answer', { wibble: 1 }], // unknown key
    ['play', { urlz: ['say:hi'] }], // misspelled urls
    ['play', { url: 'say:hi', foo: 1 }], // valid + unknown extra
    ['record', { formatt: 'wav' }], // misspelled format
    ['prompt', { txt: 'hi' }], // misspelled text
  ];
  it.each(badCases)('rejects %s with %o', (verb, config) => {
    expect(() => strictService().addVerb(verb, config)).toThrow('SWML verb validation failed');
  });

  it('rejects a wrong-typed config', () => {
    expect(() => strictService().addVerb('answer', { max_duration: 'notanumber' })).toThrow(
      'SWML verb validation failed',
    );
  });
});

// ── GAP1 — the ai verb rejects unknown/misspelled top-level keys ──

describe('SWML strict-render — ai verb strict top-level keys (GAP1)', () => {
  it('renders a good ai config', () => {
    expect(() => strictService().addVerb('ai', { prompt: { text: 'hi' } })).not.toThrow();
  });

  it('renders a good ai config with SWAIG', () => {
    expect(() =>
      strictService().addVerb('ai', { prompt: { text: 'hi' }, SWAIG: { functions: [] } }),
    ).not.toThrow();
  });

  it('rejects a misspelled top-level ai key (temperatur)', () => {
    expect(() =>
      strictService().addVerb('ai', { prompt: { text: 'hi' }, temperatur: 0.5 }),
    ).toThrow('SWML verb validation failed');
  });

  it('rejects an unknown top-level ai key (zzz)', () => {
    expect(() => strictService().addVerb('ai', { prompt: { text: 'hi' }, zzz: 1 })).toThrow(
      'SWML verb validation failed',
    );
  });

  it('rejects an ai config missing the required prompt', () => {
    expect(() => strictService().addVerb('ai', { post_prompt: { text: 'bye' } })).toThrow(
      'SWML verb validation failed',
    );
  });

  it('keeps ai.params open (a key inside params is not a misspelling)', () => {
    expect(() =>
      strictService().addVerb('ai', { prompt: { text: 'hi' }, params: { some_future_param: 1 } }),
    ).not.toThrow();
  });
});

// ── GAP2 — dangling step set_functions reference ──

describe('SWML strict-render — dangling step-function reference (GAP2)', () => {
  const strictAgent = (): AgentBase => new AgentBase({ name: 'ctxagent', route: '/ctx' });
  const defineOrderStatus = (agent: AgentBase): void => {
    agent.defineTool({
      name: 'order_status',
      description: 'look up an order',
      parameters: {},
      handler: () => ({}),
    });
  };

  it('rejects a dangling function reference (get_datetime)', () => {
    const agent = strictAgent();
    defineOrderStatus(agent);
    const contexts = agent.defineContexts();
    const step = contexts.addContext('default').addStep('help');
    step.setText('help the caller');
    step.setFunctions(['order_status', 'get_datetime']); // get_datetime dangles
    expect(() => contexts.toDict()).toThrow(/get_datetime/);
  });

  it('renders a registered function reference', () => {
    const agent = strictAgent();
    defineOrderStatus(agent);
    const contexts = agent.defineContexts();
    const step = contexts.addContext('default').addStep('help');
    step.setText('help the caller');
    step.setFunctions(['order_status']);
    expect(contexts.toDict()).toHaveProperty('default');
  });

  it('allows reserved native tool references (next_step/change_context)', () => {
    const agent = strictAgent();
    const contexts = agent.defineContexts();
    const step = contexts.addContext('default').addStep('help');
    step.setText('help the caller');
    step.setFunctions(['next_step', 'change_context']);
    expect(contexts.toDict()).toHaveProperty('default');
  });

  it('renders "none" and [] disable-all sentinels (never dangling)', () => {
    for (const value of ['none', []] as (string | string[])[]) {
      const agent = strictAgent();
      const contexts = agent.defineContexts();
      const step = contexts.addContext('default').addStep('help');
      step.setText('help the caller');
      step.setFunctions(value);
      expect(contexts.toDict()).toHaveProperty('default');
    }
  });
});
