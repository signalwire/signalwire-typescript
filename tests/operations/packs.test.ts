/**
 * The Appointments and Messages task packs.
 */

import { AgentBase } from '../../src/AgentBase.js';
import { type CallContext, Operations, ServiceAgent } from '../../src/operations/agent.js';
import { Appointment, Appointments, Slot } from '../../src/operations/appointments.js';
import { Message, Messages } from '../../src/operations/messages.js';
import { WriteFailed } from '../../src/operations/model.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';
import type { Loose } from './helpers.js';

const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });
const ops = (sim: CallSimulator): Loose => sim.globalData['ops'];

class Calendar {
  open: Record<string, string> = { s1: 'Tuesday at 2 pm', s2: 'Wednesday at 10 am' };
  booked: Record<string, string> = { a1: 'your cleaning on Friday at 9 am' };
  log: unknown[][] = [];

  openings = (_call: CallContext, when: string, kind: string | null): Slot[] => {
    this.log.push(['openings', when, kind]);
    return when.includes('week') ? Object.entries(this.open).map(([i, l]) => new Slot(i, l)) : [];
  };

  book = (_call: CallContext, slot: Slot, kind: string | null, note: string | null): void => {
    if (slot.id === 's2') throw new WriteFailed('that time was just taken');
    this.log.push(['book', slot, kind, note]);
  };

  mine = async (): Promise<Appointment[]> =>
    Object.entries(this.booked).map(([i, l]) => new Appointment(i, l));

  move = (_call: CallContext, appointment: Appointment, slot: Slot): void => {
    this.log.push(['move', appointment.id, slot.id]);
  };

  cancel = (_call: CallContext, appointment: Appointment): void => {
    this.log.push(['cancel', appointment.id]);
  };
}

function desk(cal: Calendar): ServiceAgent {
  const agent = new ServiceAgent({
    name: 'dentist',
    role: 'You answer the phone for a dental practice.',
    suppressLogs: true,
  });
  new Appointments({
    openings: cal.openings,
    book: cal.book,
    booked: cal.mine,
    move: cal.move,
    cancel: cal.cancel,
    kinds: ['cleaning', 'check-up'],
  }).addTo(agent);
  return agent;
}

describe('Appointments', () => {
  it('finds openings, then books one', async () => {
    const cal = new Calendar();
    const sim = new CallSimulator(desk(cal));
    const found = await sim.call('find_openings', { when: 'next week', kind: 'cleaning' });
    expect(found.response).toBe('Open: Tuesday at 2 pm (slot s1) and Wednesday at 10 am (slot s2)');
    expect(found.toolPrompt).toBe(
      'Offer them these, and book the one they choose with book_appointment.',
    );
    const asked = await sim.call(
      'book_appointment',
      said({ slot: 's1', kind: 'cleaning', note: 'sensitive teeth' }),
    );
    expect(asked.ran).toBe(true);
    expect(sim.step).toBe('confirm');
    expect(ops(sim)['waiting']['read_back']).toBe(
      'Book Tuesday at 2 pm for cleaning. Shall I go ahead?',
    );
    sim.caller('yes');
    const done = await sim.call('confirm_change', { change: 'book_appointment' });
    expect(done.response.startsWith("Done. It's booked: Tuesday at 2 pm.")).toBe(true);
    expect(cal.log.at(-1)).toEqual([
      'book',
      new Slot('s1', 'Tuesday at 2 pm'),
      'cleaning',
      'sensitive teeth',
    ]);
  });

  it('books only a time found open', async () => {
    const sim = new CallSimulator(desk(new Calendar()));
    const out = await sim.call('book_appointment', said({ slot: 's9' }));
    expect(out.response).toBe("Nothing is changed: s9 isn't one of the times found open.");
    expect(out.toolPrompt).toBe('Look up the openings with find_openings, and offer those.');
    const none = await sim.call('find_openings', { when: 'tomorrow' });
    expect(none.response).toBe('Nothing is open then.');
  });

  it('says so when a booking is refused', async () => {
    const sim = new CallSimulator(desk(new Calendar()));
    await sim.call('find_openings', { when: 'this week' });
    await sim.call('book_appointment', said({ slot: 's2' }));
    sim.caller('yes');
    const out = await sim.call('confirm_change', { change: 'book_appointment' });
    expect(out.response.startsWith("The change didn't go through: that time was just taken.")).toBe(
      true,
    );
  });

  it('moves and cancels their own appointments', async () => {
    const cal = new Calendar();
    const sim = new CallSimulator(desk(cal));
    const mine = await sim.call('my_appointments', {});
    expect(mine.response).toBe(
      'Their appointments: your cleaning on Friday at 9 am (appointment a1)',
    );
    await sim.call('find_openings', { when: 'next week' });
    const moving = await sim.call('move_appointment', said({ appointment: 'a1', slot: 's1' }));
    expect(moving.ran).toBe(true);
    expect(ops(sim)['waiting']['read_back']).toBe(
      'Move your cleaning on Friday at 9 am to Tuesday at 2 pm. Shall I go ahead?',
    );
    // A cancel of the same appointment while the move waits takes its place
    const cancelling = await sim.call('cancel_appointment', said({ appointment: 'a1' }));
    expect(cancelling.response).toContain('takes the place of the change read back before');
    expect(cancelling.response).toContain("an appointment can't be both moved and cancelled");
    sim.caller('yes');
    await sim.call('confirm_change', { change: 'cancel_appointment' });
    expect(cal.log.at(-1)).toEqual(['cancel', 'a1']);
    expect(cal.log.some((e) => e[0] === 'move')).toBe(false);
    const unknown = await sim.call('cancel_appointment', said({ appointment: 'a7' }));
    expect(unknown.response).toBe("Nothing is changed: a7 isn't one of their appointments.");
  });

  it('needs an account for their appointments, and can book before it', async () => {
    const cal = new Calendar();
    const agent = new ServiceAgent({ name: 'dentist', role: 'r', suppressLogs: true });
    agent.identify({ anyOf: [['phone']], find: () => 'p1', required: false });
    new Appointments({
      openings: cal.openings,
      book: cal.book,
      booked: cal.mine,
      cancel: cal.cancel,
      beforeIdentity: true,
    }).addTo(agent);
    const sim = new CallSimulator(agent);
    expect((await sim.call('my_appointments', {})).response).toBe("Their account isn't found yet.");
    expect(
      (await sim.call('find_openings', { when: 'next week' })).response.startsWith('Open:'),
    ).toBe(true);
    expect((await sim.call('book_appointment', said({ slot: 's1' }))).ran).toBe(true);
  });

  it('can be renamed, reworded and put on an Operations', async () => {
    const cal = new Calendar();
    const service = new Operations({ role: 'r' });
    new Appointments({
      openings: cal.openings,
      book: cal.book,
      tools: { book: 'book_visit' },
      wording: { 'book.read_back': 'Reservo {label}. ¿Le parece bien?' },
    }).addTo(service);
    const sim = new CallSimulator(
      service.install(new AgentBase({ name: 't', suppressLogs: true })),
    );
    await sim.call('find_openings', { when: 'next week' });
    await sim.call('book_visit', said({ slot: 's1' }));
    expect(ops(sim)['waiting']['read_back']).toBe('Reservo Tuesday at 2 pm. ¿Le parece bien?');
    // No booked, no list of their own
    expect('my_appointments' in sim.functions).toBe(false);
    expect(
      () => new Appointments({ openings: cal.openings, book: cal.book, cancel: cal.cancel }),
    ).toThrow(/needs booked/);
    expect(
      () =>
        new Appointments({ openings: cal.openings, book: cal.book, tools: { reschedule: 'x' } }),
    ).toThrow(/no tool reschedule/);
    expect(() => new Appointments({ openings: cal.openings, book: cal.book }).addTo({})).toThrow(
      /Operations or a ServiceAgent/,
    );
  });
});

function inboxAgent(saved: Message[]): ServiceAgent {
  const agent = new ServiceAgent({
    name: 'office',
    role: 'You answer the phone for a small office.',
    suppressLogs: true,
  });
  new Messages({
    save: (_call, message) => {
      saved.push(message);
    },
    recipients: { 'Dr. Lee': 'the dentist', Sam: 'the office manager' },
  }).addTo(agent);
  return agent;
}

describe('Messages', () => {
  it('takes a message with the number they call from', async () => {
    const saved: Message[] = [];
    const sim = new CallSimulator(inboxAgent(saved), {
      requestFields: { caller_id_num: '+15551230000' },
    });
    await sim.call(
      'take_message',
      said({ to: 'Dr. Lee', text: 'Call me about the crown', name: 'Ann' }),
    );
    expect(ops(sim)['waiting']['read_back']).toBe(
      'The message: "Call me about the crown", for Dr. Lee, from Ann, to call back on the number they\'re ' +
        'calling from, +15551230000. Shall I pass it on?',
    );
    sim.caller('yes');
    const done = await sim.call('confirm_change', { change: 'take_message' });
    expect(done.response.startsWith('Done. The message is passed on.')).toBe(true);
    expect(saved).toEqual([
      new Message({
        text: 'Call me about the crown',
        name: 'Ann',
        number: '+15551230000',
        to: 'Dr. Lee',
        callId: 'simulated-call',
        accountId: '',
      }),
    ]);
  });

  it('asks for what it needs', async () => {
    const sim = new CallSimulator(inboxAgent([]));
    const asked = await sim.call(
      'take_message',
      said({ to: 'Sam', text: 'Running late', name: 'Bo' }),
    );
    expect(
      (asked.toolPrompt ?? '').startsWith("Ask them: What's the best number to reach them on?"),
    ).toBe(true);
    const missing = await sim.call('take_message', said({ text: 'hi' }));
    expect((missing.toolPrompt ?? '').startsWith('Ask them: Who is the message for?')).toBe(true);
    expect(() => new Messages({ save: () => null, askFor: ['email'] })).toThrow(/askFor/);
  });

  it('amends a message for the same person with a second one', async () => {
    const saved: Message[] = [];
    const sim = new CallSimulator(inboxAgent(saved), {
      requestFields: { caller_id_num: '+15551230000' },
    });
    await sim.call('take_message', said({ to: 'Sam', text: 'Running late', name: 'Bo' }));
    const out = await sim.call(
      'take_message',
      said({ to: 'Sam', text: 'Running very late', name: 'Bo' }),
    );
    expect(out.response).toContain('takes the place of the change read back before');
    sim.caller('yes');
    await sim.call('confirm_change', { change: 'take_message' });
    expect(saved.map((m) => m.text)).toEqual(['Running very late']);
  });
});
