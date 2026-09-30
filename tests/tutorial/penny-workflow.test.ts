/**
 * Penny, layer 2: the configuration, read from the SWML the agent serves (its
 * tools and navigation for every step), and the HTTP edge of that same app.
 */

import { ContextBuilder, Step } from '../../src/index.js';
import { GREETING, Penny } from '../../tutorial/full-guardrails-agent/penny.js';
import { configureWorkflow } from '../../tutorial/full-guardrails-agent/workflow.js';
import { Call, Clock, type Json, aiVerb, at, newStore, servedSwml } from './penny-helpers.js';

interface StepJson {
  name: string;
  functions?: string[];
  valid_steps?: unknown;
  valid_contexts?: unknown;
  end?: unknown;
  gather_info?: { questions: { key: string; functions?: string[] }[] };
}
type Contexts = Record<string, { steps: StepJson[]; initial_step?: string }>;
type Steps = Record<string, StepJson>;

const contextsOf = (swml: Json): Contexts =>
  (aiVerb(swml)['prompt'] as { contexts: Contexts }).contexts;

/** Every step, keyed "context/step". */
function stepsOf(swml: Json): Steps {
  return Object.fromEntries(
    Object.entries(contextsOf(swml)).flatMap(([name, ctx]) =>
      ctx.steps.map((step) => [`${name}/${step.name}`, step]),
    ),
  );
}

/** The SWML a Penny with a different workflow would serve. */
async function servedWith(change: (builder: ContextBuilder) => void): Promise<Steps> {
  const penny = new Penny({ store: newStore() });
  const builder = configureWorkflow(penny.defineContexts(new ContextBuilder()));
  change(builder);
  return stepsOf(await servedSwml(penny));
}

// region: checks
/** Throws unless every step names its tools and gives the model nowhere to go. */
function checkScoping(steps: Steps): void {
  for (const [where, step] of Object.entries(steps)) {
    if (!Array.isArray(step.functions)) {
      throw new Error(`${where} names no tools, so it inherits the last step's`);
    }
    if (JSON.stringify([step.valid_steps, step.valid_contexts]) !== '[[],[]]') {
      throw new Error(`${where} lets the model navigate`);
    }
    if (step.end !== undefined) throw new Error(`${where} ends step mode`);
  }
}

/** Each consequential tool, and the one step that may offer it. */
const HOMES: Record<string, string> = {
  hold_table: 'booking/choose',
  confirm_booking: 'booking/review',
  send_confirmation_text: 'booking/booked',
  verify_reservation: 'manage/verify',
  request_cancel: 'manage/details',
  confirm_cancel: 'manage/confirm_cancel',
  save_message: 'help/save_message',
};

/** Throws unless each consequential tool lives in exactly one step. */
function checkHomes(steps: Steps): void {
  for (const [tool, home] of Object.entries(HOMES)) {
    const where = Object.keys(steps).filter((w) => steps[w]!.functions?.includes(tool));
    if (JSON.stringify(where) !== JSON.stringify([home])) {
      throw new Error(`${tool} is offered in ${where.join(', ')}, not only ${home}`);
    }
  }
}
// endregion: checks

describe('Penny workflow: the SWML the agent serves', () => {
  let ai: Json;
  let steps: Steps;
  beforeAll(async () => {
    const swml = await servedSwml(new Penny({ store: newStore() }));
    ai = aiVerb(swml);
    steps = stepsOf(swml);
  });

  // region: test-scoping
  it('every step names its tools and cannot navigate', () => {
    expect(Object.keys(steps)).toHaveLength(14);
    expect(() => checkScoping(steps)).not.toThrow();
  });

  it('every tool a step names is registered', () => {
    const registered = (ai['SWAIG'] as { functions: Json[] }).functions.map((f) => f['function']);
    for (const step of Object.values(steps)) {
      const gathered = (step.gather_info?.questions ?? []).flatMap((q) => q.functions ?? []);
      for (const tool of [...step.functions!, ...gathered]) expect(registered).toContain(tool);
    }
  });

  it('consequential tools live in exactly one step', () => {
    expect(() => checkHomes(steps)).not.toThrow();
  });
  // endregion: test-scoping

  it('reaches nothing about a reservation before verifying', () => {
    expect(steps['manage/verify']!.functions).toEqual([
      'verify_reservation',
      'house_info',
      'request_human',
    ]);
  });

  it('asks a locked-out caller before connecting them with a person', () => {
    const locked = steps['manage/locked'] as StepJson & { text?: string };
    expect(locked.functions).toEqual(['request_human', 'finish']);
    expect(locked.text).toContain('Only if they say yes, call request_human');
  });

  it('starts every context on its first step', () => {
    for (const ctx of Object.values(contextsOf({ sections: { main: [{ ai }] } }))) {
      expect(ctx.initial_step).toBe(ctx.steps[0]!.name);
    }
  });

  it('gives every gather question a way out', () => {
    for (const where of ['booking/collect', 'help/take_message']) {
      for (const question of steps[where]!.gather_info!.questions) {
        expect(question.functions?.length, `${where} ${question.key}`).toBeGreaterThan(0);
      }
    }
  });

  // region: test-trap
  it('treats leaving out tools differently from no tools', () => {
    expect(new Step('omitted').setText('Ask.').toDict()).not.toHaveProperty('functions');
    expect(new Step('empty').setText('Ask.').setFunctions([]).toDict().functions).toEqual([]);
  });
  // endregion: test-trap

  it('gives each call its own facts', async () => {
    expect(ai['global_data']).toEqual({ host_stand: 'closed' }); // Tuesday, 3 PM
    const clock = new Clock(at(18));
    const penny = new Penny({ store: newStore(clock) });
    expect(aiVerb(await servedSwml(penny))['global_data']).toEqual({ host_stand: 'open' });
    clock.now = at(23);
    expect(aiVerb(await servedSwml(penny))['global_data']).toEqual({ host_stand: 'closed' });
    // The agent every call shares was never changed: only each request's copy was.
    expect(aiVerb(JSON.parse(penny.renderSwml()))['global_data']).toBeUndefined();
  });

  it('has the platform speak the greeting', () => {
    const params = ai['params'] as Json;
    expect(params['static_greeting']).toBe(GREETING);
    expect(params['static_greeting_no_barge']).toBe(true);
  });

  it('starts without a signing key', () => {
    vi.stubEnv('SIGNALWIRE_SIGNING_KEY', '');
    try {
      expect(new Penny({ store: newStore() }).signingKey).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('refuses to start without its secrets', () => {
    vi.stubEnv('SIGNALWIRE_SWAIG_SECRET', '');
    try {
      expect(() => new Penny({ store: newStore() })).toThrow(
        "Penny won't start without: SIGNALWIRE_SWAIG_SECRET",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

// region: test-breaks
describe('Penny workflow: deliberate breaks fail the checks', () => {
  it('a step added without scoped()', async () => {
    const steps = await servedWith((b) => {
      b.getContext('booking')!.addStep('upsell').setText('Offer the tasting menu.');
    });
    expect(() => checkScoping(steps)).toThrow('booking/upsell names no tools');
  });

  it('a step that lets the model navigate', async () => {
    const steps = await servedWith((b) =>
      b.getContext('booking')!.getStep('choose')!.setValidSteps(['review']),
    );
    expect(() => checkScoping(steps)).toThrow('booking/choose lets the model navigate');
  });

  it('confirm_booking offered in choose as well', async () => {
    const steps = await servedWith((b) => {
      const choose = b.getContext('booking')!.getStep('choose')!;
      choose.setFunctions(['hold_table', 'confirm_booking', 'find_tables']);
    });
    expect(() => checkHomes(steps)).toThrow('confirm_booking is offered in booking/choose');
  });

  it('request_cancel offered before verifying', async () => {
    const steps = await servedWith((b) => {
      const verify = b.getContext('manage')!.getStep('verify')!;
      verify.setFunctions(['verify_reservation', 'request_cancel']);
    });
    expect(() => checkHomes(steps)).toThrow('request_cancel is offered in manage/verify');
  });
});
// endregion: test-breaks

// region: test-security
describe('Penny security: the HTTP edge of the served app', () => {
  it('refuses the wrong password', async () => {
    const wrong = { Authorization: 'Basic ' + Buffer.from('penny:guess').toString('base64') };
    const res = await new Penny({ store: newStore() }).getApp().request('/penny', {
      headers: wrong,
    });
    expect(res.status).toBe(401);
  });

  it('refuses a tool call SignalWire did not sign', async () => {
    const call = new Call(new Penny({ store: newStore() }));
    expect((await call.invoke('finish', {}, {}, { sign: false })).status).toBe(403);
    expect((await call.invoke('finish')).status).toBe(200);
  });

  it("refuses a tool call with another call's token", async () => {
    const penny = new Penny({ store: newStore() });
    const other = await new Call(penny, 'call-2').token('finish');
    const refused = await new Call(penny, 'call-1').invoke('finish', {}, {}, { token: other });
    expect(refused.body['action']).toBeUndefined();
    expect(JSON.stringify(refused.body)).toContain('security token');
  });
});
// endregion: test-security
