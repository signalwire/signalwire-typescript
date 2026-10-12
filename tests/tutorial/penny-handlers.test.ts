/**
 * Penny, layer 3: what each tool tells the model and the platform.
 *
 * The tools run through the agent's HTTP app as SignalWire calls them: signed,
 * with this call's token, and with the call's global_data and caller ID. Two
 * tests call a handler directly, for requests the SDK refuses before any
 * handler runs.
 */

import {
  GOODBYE,
  PennyHandlers,
  TRANSFER_NOTICE,
  log,
} from '../../tutorial/full-guardrails-agent/handlers.js';
import { Penny } from '../../tutorial/full-guardrails-agent/penny.js';
import { ReservationStore } from '../../tutorial/full-guardrails-agent/reservations.js';
import {
  Call,
  Clock,
  type Json,
  TUESDAY_3PM,
  actionKeys,
  actions,
  at,
  count,
  events,
  movedTo,
  newStore,
  toolPrompt,
  toolResult,
} from './penny-helpers.js';

let clock: Clock;
let store: ReservationStore;
let penny: Penny;
let call: Call;

beforeEach(() => {
  clock = new Clock(TUESDAY_3PM);
  store = newStore(clock);
  penny = new Penny({ store });
  call = new Call(penny, 'call-1');
});

/** Gather's answers, as the platform sends them in global_data. */
function gathered(answers: Json = {}): { global_data: Json } {
  const base = { party_size: 4, date: 'Friday', time: '7:30 PM', name: 'Maria Rivera' };
  return { global_data: { booking_request: { ...base, ...answers } } };
}

/** Book Friday at 7:30 PM on call-1, and return the confirmation code. */
async function book(): Promise<string> {
  await call.tool('find_tables', {}, gathered());
  await call.tool('hold_table', { option: 1 });
  return String(events(await call.tool('confirm_booking', { revision: 1 }))[0]!['code']);
}

describe('Penny handlers: what each tool tells the model and the platform', () => {
  it('takes a whole booking', async () => {
    const found = await call.tool('find_tables', {}, gathered());
    expect(toolResult(found)).toContain('option 1, 7:30 PM');
    expect(movedTo(found)).toBe('choose');
    expect(events(found)[0]!['type']).toBe('options_offered');

    const held = await call.tool('hold_table', { option: 1 });
    expect(toolResult(held)).toContain('revision 1');
    expect(movedTo(held)).toBe('review');

    const booked = await call.tool('confirm_booking', { revision: 1 });
    expect(movedTo(booked)).toBe('booked');
    const code = String(events(booked)[0]!['code']);
    expect(toolResult(booked)).toContain([...code].join(' '));
    expect(actions(booked)[0]!['set_global_data']).toMatchObject({
      booking: { code_spoken: [...code].join(' ') },
    });

    const texted = await call.tool('send_confirmation_text', {}, { caller_id_num: '+15555551234' });
    expect(actionKeys(texted)).toEqual(['send_sms']);
    const again = await call.tool('send_confirmation_text', {}, { caller_id_num: '+15555551234' });
    expect(actions(again)).toEqual([]); // one text, however often the tool fires
  });

  it('lets corrections override what was gathered', async () => {
    const found = await call.tool('find_tables', { time: '5 PM' }, gathered());
    expect(toolResult(found)).toContain('option 1, 5 PM');
  });

  it('keeps a correction to a refused search', async () => {
    const answers = gathered({ party_size: 8, date: 'Monday' });
    const refused = await call.tool('find_tables', { party_size: 4 }, answers);
    expect(toolResult(refused)).toContain('closed on Mondays');
    const found = await call.tool('find_tables', { date: 'Friday' }, answers);
    expect(toolResult(found)).toContain('Open for 4'); // not back to 8
  });

  it('keeps each correction with the ones before it', async () => {
    await call.tool('find_tables', { time: '8 PM' }, gathered());
    const found = await call.tool('find_tables', { party_size: 2 }, gathered());
    expect(toolResult(found)).toContain('Open for 2');
    expect(toolResult(found)).toContain('option 1, 8 PM'); // not back to 7:30
  });

  it('reports refusals as facts, with no actions', async () => {
    await call.tool('find_tables', {}, gathered());
    const refused = await call.tool('hold_table', { option: 9 });
    expect(toolResult(refused)).toContain('no option 9');
    expect(actions(refused)).toEqual([]);
    const stale = await call.tool('confirm_booking', { revision: 7 });
    expect(actions(stale)).toEqual([]);
    expect(await count(store, 'reservations')).toBe(0);
  });

  it('offers a large party a person, not a table', async () => {
    const refused = await call.tool('find_tables', {}, gathered({ party_size: 9 }));
    expect(toolResult(refused)).toContain('events team');
    expect(actions(refused)).toEqual([]);
  });

  it('does nothing without call context', async () => {
    // The SDK refuses a tool request with no call_id before any handler runs,
    // because the call's token can't match it.
    const refused = await call.invoke('find_tables', {}, gathered(), { callId: null });
    expect(JSON.stringify(refused.body)).toContain('security token');
    expect(await count(store, 'sessions')).toBe(0);
    // The handler's own guard, for a request that got past the SDK anyway.
    const tools = new PennyHandlers(store, {});
    const result = tools.findTables({}, gathered()).toJSON() as unknown as Json;
    expect(toolResult(result)).toContain('no call context');
    expect(actions(result)).toEqual([]);
  });

  it('does nothing with malformed arguments', () => {
    const tools = new PennyHandlers(store, {});
    const malformed = ['option', 1] as unknown as Json;
    const result = tools.holdTable(malformed, { call_id: 'call-1' }).toJSON() as unknown as Json;
    expect(actions(result)).toEqual([]);
  });

  // region: test-crash
  it('never makes a crash sound like success', async () => {
    vi.spyOn(store, 'confirm').mockImplementation(() => {
      throw new Error('disk full');
    });
    const logged = vi.spyOn(log, 'error');
    const result = await call.tool('confirm_booking', { revision: 1 });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    expect(toolResult(result)).toContain('outcome is unknown');
    expect(toolPrompt(result)).toContain("Don't say it worked");
    expect(actions(result)).toEqual([]);
  });
  // endregion: test-crash

  // region: test-gate
  it("won't skip verification for a caller who asks nicely", async () => {
    const refused = await new Call(penny, 'call-2').tool('request_cancel');
    expect(toolResult(refused)).toContain("hasn't verified");
    expect(actions(refused)).toEqual([]);
  });

  it('verifies, then cancels in two steps', async () => {
    const code = await book();
    const other = new Call(penny, 'call-2');

    const verified = await other.tool('verify_reservation', {
      confirmation_code: code,
      last_name: 'Rivera',
    });
    expect(movedTo(verified)).toBe('details');
    const staged = await other.tool('request_cancel');
    expect(movedTo(staged)).toBe('confirm_cancel');
    expect(store.verifiedReservation('call-2').status).toBe('confirmed');
    const done = await other.tool('confirm_cancel', { revision: 1 });
    expect(movedTo(done)).toBe('cancelled');
    expect(store.verifiedReservation('call-2').status).toBe('cancelled');
  });

  it('locks the lookup after three misses', async () => {
    const wrong = { confirmation_code: 'ZZZZZZ', last_name: 'Nobody' };
    expect(movedTo(await call.tool('verify_reservation', wrong))).toBeUndefined();
    expect(movedTo(await call.tool('verify_reservation', wrong))).toBeUndefined();
    expect(movedTo(await call.tool('verify_reservation', wrong))).toBe('locked');
  });
  // endregion: test-gate

  it('transfers to a person only when someone is there', async () => {
    const closed = await call.tool('request_human'); // Tuesday 3 PM: the host stand opens at 4
    expect(movedTo(closed)).toBe('help');
    clock.now = at(18);
    const open = await call.tool('request_human');
    expect(actionKeys(open)).toEqual(['say', 'connect']); // announce, then transfer
    expect(actions(open)[0]!['say']).toBe(TRANSFER_NOTICE);
    const connect = actions(open)[1]!['SWML'] as { sections: { main: Json[] } };
    expect(connect.sections.main[0]!['connect']).toEqual({ to: '+15555550100' });
  });

  it('allows another text later, up to a limit', async () => {
    await book();
    const sent: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const result = await call.tool(
        'send_confirmation_text',
        {},
        { caller_id_num: '+15555551234' },
      );
      sent.push(JSON.stringify(actionKeys(result)) === '["send_sms"]');
      clock.advance(121); // later than a duplicate
    }
    expect(sent).toEqual([true, true, true, false]);
  });

  it('texts only the number the call comes from', async () => {
    await book();
    const refused = await call.tool(
      'send_confirmation_text',
      { to_number: '+15550009999' },
      { caller_id_num: 'anonymous' },
    );
    expect(actions(refused)).toEqual([]); // the model can't name a destination
    const sent = await call.tool(
      'send_confirmation_text',
      { to_number: '+15550009999' },
      { caller_id_num: '+15555551234' },
    );
    const sms = actions(sent)[0]!['SWML'] as { sections: { main: Json[] } };
    expect(sms.sections.main[0]!['send_sms']).toMatchObject({ to_number: '+15555551234' });
  });

  it('takes a message from the gathered answers', async () => {
    const taken = { message: { name: 'Ana', callback: '555 123 4567', body: 'Party of 12' } };
    const saved = await call.tool('save_message', {}, { global_data: taken });
    expect(movedTo(saved)).toBe('message_saved');
    expect(toolResult(saved)).toContain('ending in 4567');
  });

  it('plays the goodbye in full before the hangup', async () => {
    const result = await call.tool('finish');
    expect(actionKeys(result)).toEqual(['say', 'hangup']);
    expect(actions(result)[0]!['say']).toBe(GOODBYE);
  });

  it('writes the call record from the store', async () => {
    await book();
    const logged = vi.spyOn(log, 'info');
    // The platform calls hangup_hook when the call ends, with the transcript.
    const ended = await call.invoke('hangup_hook', {}, {}, {});
    expect(ended.status).toBe(200);
    expect(logged).toHaveBeenCalledWith('call call-1 ended: booked');
    expect(await count(store, 'call_records')).toBe(1);
  });
});
