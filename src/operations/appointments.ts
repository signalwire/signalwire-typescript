/**
 * The Appointments task pack: book, move and cancel a caller's appointments
 * against your calendar.
 */

import { FunctionResult } from '../FunctionResult.js';
import type { CallContext } from './agent.js';
import { Change, Field, Need, Refuse, type Values, Write } from './model.js';
import { operationsOf, packOperation } from './pack.js';
import { Wording } from './wording.js';

/** A time open for an appointment. */
export class Slot {
  /**
   * @param id - The calendar's id for it.
   * @param label - How it's said, in the calendar's own time zone and words:
   *   "Tuesday the 3rd at 2 pm".
   */
  constructor(
    readonly id: string,
    readonly label: string,
  ) {
    Object.freeze(this);
  }
}

/** One of the caller's appointments. */
export class Appointment {
  /**
   * @param id - The calendar's id for it.
   * @param label - How it's said: "your cleaning on Tuesday the 3rd at 2 pm".
   */
  constructor(
    readonly id: string,
    readonly label: string,
  ) {
    Object.freeze(this);
  }
}

/** Every key the `Appointments` pack's words come from, with its default. */
export const APPOINTMENTS_WORDING: Readonly<Record<string, string>> = Object.freeze({
  'tool.openings': "Times open for an appointment, near when they'd like it.",
  'tool.openings.when': 'When they\'d like it, in their words, such as "Tuesday afternoon".',
  'tool.kind': 'What the appointment is for.',
  'openings.found': 'Open: {slots}',
  'openings.slot': '{label} (slot {id})',
  'openings.none': 'Nothing is open then.',
  'openings.none.then': 'Tell them, and ask about another time.',
  'openings.then': 'Offer them these, and book the one they choose with {tool}.',
  'openings.ask': 'When would they like it?',
  'tool.booked': 'Their appointments.',
  'booked.found': 'Their appointments: {appointments}',
  'booked.item': '{label} (appointment {id})',
  'booked.none': 'They have no appointments.',
  'tool.book': 'Book an appointment at a time found open.',
  'tool.book.slot': 'The time to book, by its slot id from the openings.',
  'tool.book.note': 'Anything they want noted on it, in their words.',
  'book.read_back': 'Book {label}. Shall I go ahead?',
  'book.read_back.kind': 'Book {label} for {kind}. Shall I go ahead?',
  'book.done': "It's booked: {label}.",
  'slot.unknown': "{slot} isn't one of the times found open.",
  'slot.unknown.then': 'Look up the openings with {tool}, and offer those.',
  'tool.move': 'Move one of their appointments to a time found open.',
  'tool.move.appointment': 'The appointment to move, by its id.',
  'tool.move.slot': 'The new time, by its slot id from the openings.',
  'move.read_back': 'Move {appointment} to {label}. Shall I go ahead?',
  'move.done': "It's moved to {label}.",
  'tool.cancel': 'Cancel one of their appointments.',
  'tool.cancel.appointment': 'The appointment to cancel, by its id.',
  'cancel.read_back': 'Cancel {appointment}. Shall I go ahead?',
  'cancel.done': "It's cancelled: {appointment}.",
  'appointment.unknown': "{appointment} isn't one of their appointments.",
  'appointment.unknown.then': 'Look them up with {tool}.',
  conflict: "an appointment can't be both moved and cancelled",
  'list.and': ' and ',
  'list.or': ' or ',
  'list.comma': ', ',
});

const TOOLS: Readonly<Record<string, string>> = Object.freeze({
  openings: 'find_openings',
  booked: 'my_appointments',
  book: 'book_appointment',
  move: 'move_appointment',
  cancel: 'cancel_appointment',
});

/** A slot or an appointment as a calendar function may give it: the class, or `{ id, label }`. */
export type Labelled = { id: string; label: string };

/** Options for {@link Appointments}. */
export interface AppointmentsOptions {
  /**
   * `openings(call, when, kind)` returns the {@link Slot}s open near `when`,
   * the caller's words ("Tuesday afternoon"); `kind` is one of `kinds`, or
   * null. May be async, and may throw `Refuse` or `Need`.
   */
  openings: (call: CallContext, when: string, kind: string | null) => unknown;
  /** `book(call, slot, kind, note)` books it, once the caller said yes; throw `WriteFailed` when the calendar refuses. */
  book: (call: CallContext, slot: Slot, kind: string | null, note: string | null) => unknown;
  /** `booked(call)` returns the caller's {@link Appointment}s. Needed to move or cancel. */
  booked?: ((call: CallContext) => unknown) | null;
  /** `move(call, appointment, slot)` moves one. */
  move?: ((call: CallContext, appointment: Appointment, slot: Slot) => unknown) | null;
  /** `cancel(call, appointment)` cancels one. */
  cancel?: ((call: CallContext, appointment: Appointment) => unknown) | null;
  /** What an appointment can be for, as the caller would say it ("cleaning"); null for no choice. */
  kinds?: readonly string[] | null;
  /**
   * True to find openings and book before the caller is identified, for new
   * customers. Their own appointments always need an account.
   */
  beforeIdentity?: boolean;
  /** Words in place of the defaults, by key; the keys are those of {@link APPOINTMENTS_WORDING}. */
  wording?: Readonly<Record<string, string>> | null;
  /**
   * Names in place of the tools' (`find_openings`, `my_appointments`,
   * `book_appointment`, `move_appointment`, `cancel_appointment`), keyed by
   * `openings`, `booked`, `book`, `move` and `cancel`.
   */
  tools?: Readonly<Record<string, string>> | null;
  /** Where in `call.state` the pack keeps the slots it found, so a booking can only be for one of them. */
  stateKey?: string;
}

/**
 * Book, move and cancel a caller's appointments against your calendar.
 *
 * @example
 * ```ts
 * new Appointments({
 *   openings: (call, when, kind) => calendar.openNear(when, kind),
 *   book: (call, slot, kind, note) => calendar.book(slot.id, call.accountId, kind, note),
 *   booked: (call) => calendar.forPatient(call.accountId),
 *   move: (call, appointment, slot) => calendar.move(appointment.id, slot.id),
 *   cancel: (call, appointment) => calendar.cancel(appointment.id),
 *   kinds: ['cleaning', 'check-up'],
 * }).addTo(agent);
 * ```
 */
export class Appointments {
  /** The tools' names, by key. */
  readonly tools: Readonly<Record<string, string>>;
  private readonly openingsFn: AppointmentsOptions['openings'];
  private readonly bookFn: AppointmentsOptions['book'];
  private readonly bookedFn: NonNullable<AppointmentsOptions['booked']> | null;
  private readonly moveFn: NonNullable<AppointmentsOptions['move']> | null;
  private readonly cancelFn: NonNullable<AppointmentsOptions['cancel']> | null;
  private readonly kinds: string[] | null;
  private readonly beforeIdentity: boolean;
  private readonly w: Wording;
  private readonly key: string;

  /**
   * @param opts - `openings` and `book`, and `booked`, `move`, `cancel`,
   *   `kinds`, `beforeIdentity`, `wording`, `tools` and `stateKey`.
   * @throws {Error} For `move` or `cancel` without `booked`, a tool key it
   *   doesn't have, or wording it can't use.
   */
  constructor(opts: AppointmentsOptions) {
    if ((opts.move || opts.cancel) && !opts.booked) {
      throw new Error("moving or cancelling appointments needs booked, to find the caller's");
    }
    const unknown = Object.keys(opts.tools ?? {})
      .filter((k) => !Object.hasOwn(TOOLS, k))
      .sort();
    if (unknown.length > 0) {
      throw new Error(
        `tools names no tool ${unknown.join(', ')}; the keys are ${Object.keys(TOOLS).join(', ')}`,
      );
    }
    this.openingsFn = opts.openings;
    this.bookFn = opts.book;
    this.bookedFn = opts.booked ?? null;
    this.moveFn = opts.move ?? null;
    this.cancelFn = opts.cancel ?? null;
    this.kinds = opts.kinds && opts.kinds.length > 0 ? [...opts.kinds] : null;
    this.beforeIdentity = opts.beforeIdentity ?? false;
    this.w = new Wording(
      APPOINTMENTS_WORDING,
      opts.wording,
      'Appointments',
      'APPOINTMENTS_WORDING',
    );
    this.tools = Object.freeze({ ...TOOLS, ...(opts.tools ?? {}) });
    this.key = opts.stateKey ?? 'appointments';
  }

  /**
   * Register the pack's lookups and operations on an `Operations` or a `ServiceAgent`.
   * @param target - The `Operations` or `ServiceAgent`.
   * @returns The target.
   * @throws {TypeError} For anything else.
   */
  addTo<T>(target: T): T {
    const ops = operationsOf(target);
    const { w, tools } = this;
    const kindField = this.kinds
      ? new Field({ type: 'string', enum: this.kinds }, w.say('tool.kind'), { required: false })
      : null;
    const openingsFields: Record<string, Field> = {
      when: new Field('string', w.say('tool.openings.when'), { ask: w.say('openings.ask') }),
    };
    if (kindField !== null) openingsFields['kind'] = kindField;

    ops.lookup(w.say('tool.openings'), {
      tool: tools['openings']!,
      fields: openingsFields,
      beforeIdentity: this.beforeIdentity,
    })(async (call, args) => {
      const when = args['when'] as string | null;
      const kind = (args['kind'] as string | null | undefined) ?? null;
      if (!when) throw new Need(w.say('openings.ask'), ['when']);
      const found = ((await this.openingsFn(call, when, kind)) as unknown[] | null) ?? [];
      const slots = found.map(slotOf);
      const mine = { ...objectOf(call.state[this.key]) };
      mine['offered'] = {
        ...objectOf(mine['offered']),
        ...Object.fromEntries(slots.map((s) => [s.id, s.label])),
      };
      call.state[this.key] = mine;
      if (slots.length === 0) {
        return new FunctionResult(
          undefined,
          false,
          w.say('openings.none'),
          w.say('openings.none.then'),
        );
      }
      const listed = w.joined(
        slots.map((s) => w.say('openings.slot', { label: s.label, id: s.id })),
      );
      return new FunctionResult(
        undefined,
        false,
        w.say('openings.found', { slots: listed }),
        w.say('openings.then', { tool: tools['book'] }),
      );
    });

    const bookFields: Record<string, Field> = {
      slot: new Field('string', w.say('tool.book.slot')),
    };
    if (kindField !== null) bookFields['kind'] = kindField;
    bookFields['note'] = new Field('string', w.say('tool.book.note'), { required: false });
    ops.operation(
      packOperation({
        name: 'Book',
        description: w.say('tool.book'),
        fields: bookFields,
        prepare: (call: CallContext, f: Values) => {
          const slot = this.offered(call, f['slot'] as string | null);
          const kind = f.get('kind') as string | null;
          const readBack = kind
            ? w.say('book.read_back.kind', { label: slot.label, kind })
            : w.say('book.read_back', { label: slot.label });
          return new Change({
            readBack,
            touches: [`slot:${slot.id}`],
            writes: [
              new Write('book_appointment', {
                slot: slot.id,
                label: slot.label,
                kind,
                note: f.get('note'),
              }),
            ],
            done: w.say('book.done', { label: slot.label }),
          });
        },
        apply: (call: CallContext, write: Write) => {
          const a = write.args;
          return this.bookFn(
            call,
            new Slot(String(a['slot']), String(a['label'])),
            (a['kind'] as string | null | undefined) ?? null,
            (a['note'] as string | null | undefined) ?? null,
          );
        },
        beforeIdentity: this.beforeIdentity,
      }),
      { tool: tools['book']!, kind: tools['book']! },
    );

    if (this.bookedFn !== null) {
      ops.lookup(w.say('tool.booked'), { tool: tools['booked']!, fields: {} })(async (call) => {
        const found = await this.appointments(call);
        if (found.length === 0) return w.say('booked.none');
        return w.say('booked.found', {
          appointments: w.joined(
            found.map((a) => w.say('booked.item', { label: a.label, id: a.id })),
          ),
        });
      });
    }

    const rivals = [tools['move']!, tools['cancel']!];
    const moveFn = this.moveFn;
    if (moveFn !== null) {
      ops.operation(
        packOperation({
          name: 'Move',
          description: w.say('tool.move'),
          fields: {
            appointment: new Field('string', w.say('tool.move.appointment')),
            slot: new Field('string', w.say('tool.move.slot')),
          },
          prepare: async (call: CallContext, f: Values) => {
            const appointment = await this.appointment(call, f['appointment'] as string | null);
            const slot = this.offered(call, f['slot'] as string | null);
            return new Change({
              readBack: w.say('move.read_back', {
                appointment: appointment.label,
                label: slot.label,
              }),
              touches: [`appointment:${appointment.id}`, `slot:${slot.id}`],
              writes: [
                new Write('move_appointment', {
                  appointment: appointment.id,
                  appointment_label: appointment.label,
                  slot: slot.id,
                  label: slot.label,
                }),
              ],
              done: w.say('move.done', { label: slot.label }),
            });
          },
          apply: (call: CallContext, write: Write) => {
            const a = write.args;
            return moveFn(
              call,
              new Appointment(String(a['appointment']), String(a['appointment_label'])),
              new Slot(String(a['slot']), String(a['label'])),
            );
          },
          conflict: w.say('conflict'),
          rivals,
          kind: tools['move']!,
        }),
        { tool: tools['move']!, kind: tools['move']! },
      );
    }

    const cancelFn = this.cancelFn;
    if (cancelFn !== null) {
      ops.operation(
        packOperation({
          name: 'Cancel',
          description: w.say('tool.cancel'),
          fields: { appointment: new Field('string', w.say('tool.cancel.appointment')) },
          prepare: async (call: CallContext, f: Values) => {
            const appointment = await this.appointment(call, f['appointment'] as string | null);
            return new Change({
              readBack: w.say('cancel.read_back', { appointment: appointment.label }),
              touches: [`appointment:${appointment.id}`],
              writes: [
                new Write('cancel_appointment', {
                  appointment: appointment.id,
                  appointment_label: appointment.label,
                }),
              ],
              done: w.say('cancel.done', { appointment: appointment.label }),
            });
          },
          apply: (call: CallContext, write: Write) => {
            const a = write.args;
            return cancelFn(
              call,
              new Appointment(String(a['appointment']), String(a['appointment_label'])),
            );
          },
          conflict: w.say('conflict'),
          rivals,
          kind: tools['cancel']!,
        }),
        { tool: tools['cancel']!, kind: tools['cancel']! },
      );
    }
    return target;
  }

  private offered(call: CallContext, slotId: string | null): Slot {
    const offered = objectOf(objectOf(call.state[this.key])['offered']);
    if (slotId === null || slotId === undefined || !Object.hasOwn(offered, slotId)) {
      throw new Refuse(
        this.w.say('slot.unknown', { slot: slotId || 'That' }),
        this.w.say('slot.unknown.then', { tool: this.tools['openings'] }),
      );
    }
    return new Slot(String(slotId), String(offered[slotId]));
  }

  private async appointments(call: CallContext): Promise<Appointment[]> {
    const found = ((await this.bookedFn!(call)) as unknown[] | null) ?? [];
    return found.map(appointmentOf);
  }

  private async appointment(call: CallContext, appointmentId: string | null): Promise<Appointment> {
    for (const a of await this.appointments(call)) if (a.id === appointmentId) return a;
    throw new Refuse(
      this.w.say('appointment.unknown', { appointment: appointmentId || 'That' }),
      this.w.say('appointment.unknown.then', { tool: this.tools['booked'] }),
    );
  }
}

function slotOf(value: unknown): Slot {
  if (value instanceof Slot) return value;
  if (isLabelled(value)) return new Slot(String(value.id), String(value.label));
  throw new TypeError(
    `openings must return Slots (or objects with id and label), got ${typeName(value)}`,
  );
}

function appointmentOf(value: unknown): Appointment {
  if (value instanceof Appointment) return value;
  if (isLabelled(value)) return new Appointment(String(value.id), String(value.label));
  throw new TypeError(
    `booked must return Appointments (or objects with id and label), got ${typeName(value)}`,
  );
}

function isLabelled(value: unknown): value is Labelled {
  return typeof value === 'object' && value !== null && 'id' in value && 'label' in value;
}

function objectOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function typeName(value: unknown): string {
  if (value === null || value === undefined) return 'NoneType';
  return typeof value === 'object' ? (value.constructor?.name ?? 'object') : typeof value;
}
