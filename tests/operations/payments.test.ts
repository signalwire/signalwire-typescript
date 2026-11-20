/**
 * The Payments task pack: a card payment, read back first, taken by the
 * platform's pay verb, and counted once the platform says how it went.
 */

import { AgentBase } from '../../src/AgentBase.js';
import { CallContext, Operations, ServiceAgent } from '../../src/operations/agent.js';
import { Refuse } from '../../src/operations/model.js';
import { Charge, type PaymentResult, Payments } from '../../src/operations/payments.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';
import type { Loose } from './helpers.js';

const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });
const ops = (sim: CallSimulator): Loose => sim.globalData['ops'];
const INVOICES: Record<string, string> = { '1042': '54.04' };

function charge(_call: CallContext, invoice: string): Charge {
  if (!(invoice in INVOICES)) throw new Refuse(`${invoice} isn't one of their invoices.`);
  return new Charge(INVOICES[invoice]!, `invoice ${invoice}`);
}

function billing(results: PaymentResult[], extra: { reusable?: boolean } = {}): ServiceAgent {
  const agent = new ServiceAgent({
    name: 'billing',
    role: 'You take payments for a utility.',
    currency: 'USD',
    suppressLogs: true,
  });
  agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.spore' });
  new Payments({
    connectorUrl: 'https://pay.example.com/connector',
    charge,
    onResult: (_call, result) => {
      results.push(result);
    },
    ...extra,
  }).addTo(agent);
  return agent;
}

const swmlOf = (actions: unknown[]): Loose =>
  (actions as Record<string, unknown>[]).find((a) => 'SWML' in a)!['SWML'];
const payOf = (actions: unknown[]): Loose => ({ ...swmlOf(actions).sections.main[0].pay });

describe('Payments', () => {
  it('reads a payment back, takes it and records it', async () => {
    const results: PaymentResult[] = [];
    const sim = new CallSimulator(billing(results), {
      requestFields: {
        SWMLVars: {
          pay_result: 'success',
          pay_payment_results: '{"payment_confirmation_code": "C9"}',
        },
      },
    });
    expect(sim.params['swaig_post_swml_vars']).toEqual(['pay_result', 'pay_payment_results']);
    await sim.call('take_payment', said({ paying_for: '1042' }));
    expect(ops(sim)['waiting']['read_back']).toBe(
      'Take $54.04 on a card for invoice 1042. Shall I go ahead?',
    );
    sim.caller('yes');
    const started = await sim.call('confirm_change', { change: 'take_payment' });
    expect(
      started.response.startsWith('Done. The card details are taken next, on the keypad.'),
    ).toBe(true);
    expect(started.toolPrompt).toBe(
      "Tell them they'll enter their card on the keypad now, and say nothing more.",
    );
    const pay = payOf(started.actions);
    expect([pay.charge_amount, pay.currency, pay.language, pay.voice]).toEqual([
      '54.04',
      'usd',
      'en-US',
      'rime.spore',
    ]);
    expect(pay.token_type).toBe('one-time');
    expect(pay.description).toBe('invoice 1042');
    // The pay helper's own, as documented
    expect(pay.valid_card_types).toBe('visa mastercard amex');
    expect(swmlOf(started.actions).sections.main[1].set.ai_response).toBe(
      'The payment has finished. Call payment_result now, and say nothing before it.',
    );
    // Nothing is counted until the platform says how it went
    expect(ops(sim)['history'].at(-1)['money']).toBe('0');
    const out = await sim.call('payment_result', said({}));
    expect(out.response).toBe('Done. The payment went through: $54.04 for invoice 1042.');
    expect(ops(sim)['history'].at(-1)['money']).toBe('54.04');
    expect(results[0]!.succeeded).toBe(true);
    expect(results[0]!.details).toEqual({ payment_confirmation_code: 'C9' });
    const again = await sim.call('payment_result', said({}));
    expect(again.response).toBe('No payment was started.');
  });

  it('asks for a reusable token when told to', async () => {
    const sim = new CallSimulator(billing([], { reusable: true }));
    await sim.call('take_payment', said({ paying_for: '1042' }));
    sim.caller('yes');
    const started = await sim.call('confirm_change', { change: 'take_payment' });
    expect(payOf(started.actions).token_type).toBe('reusable');
  });

  it('charges nothing for a failed payment', async () => {
    const results: PaymentResult[] = [];
    const sim = new CallSimulator(billing(results), {
      requestFields: { SWMLVars: { pay_result: 'too-many-failed-attempts' } },
    });
    await sim.call('take_payment', said({ paying_for: '1042' }));
    sim.caller('yes');
    await sim.call('confirm_change', { change: 'take_payment' });
    const out = await sim.call('payment_result', said({}));
    expect(out.response).toBe(
      "The payment didn't go through (too-many-failed-attempts). Nothing was charged.",
    );
    expect(ops(sim)['history'].at(-1)['money']).toBe('0');
    expect(results[0]!.result).toBe('too-many-failed-attempts');
    expect(results[0]!.succeeded).toBe(false);
  });

  it("assumes nothing without the platform's result", async () => {
    const sim = new CallSimulator(billing([]));
    await sim.call('take_payment', said({ paying_for: '1042' }));
    sim.caller('yes');
    await sim.call('confirm_change', { change: 'take_payment' });
    const out = await sim.call('payment_result', said({}));
    expect(out.response).toBe("There's no payment result yet.");
  });

  it('takes the amount from charge, and needs a currency and a language', async () => {
    const sim = new CallSimulator(billing([]));
    const refused = await sim.call('take_payment', said({ paying_for: '9' }));
    expect(refused.response).toBe("Nothing is changed: 9 isn't one of their invoices.");
    const noLanguage = new ServiceAgent({
      name: 'b',
      role: 'r',
      currency: 'USD',
      suppressLogs: true,
    });
    new Payments({ connectorUrl: 'https://pay.example.com/c', charge }).addTo(noLanguage);
    expect(() => noLanguage.compile()).toThrow(/language/);
    const service = new Operations({ role: 'r' });
    new Payments({ connectorUrl: 'https://pay.example.com/c', charge, language: 'es-MX' }).addTo(
      service,
    );
    const agent = service.install(new AgentBase({ name: 't', suppressLogs: true }));
    await expect(
      service._prepare(new CallContext(service, {}), service._operations.get('take_payment')!, {
        paying_for: '1042',
      }),
    ).rejects.toThrow(/needs a currency/);
    expect(
      (agent as unknown as { params: Record<string, unknown> }).params['swaig_post_swml_vars'],
    ).toEqual(['pay_result', 'pay_payment_results']);
  });

  it("isn't taken in a chat", async () => {
    const sim = new CallSimulator(billing([]), {
      globalData: { ops: { medium: 'chat' } },
    });
    const out = await sim.call('take_payment', said({ paying_for: '1042' }));
    expect(out.response).toBe('A card payment is taken on a call, not in a chat.');
  });
});
