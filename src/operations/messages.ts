/**
 * The Messages task pack: take a message for someone and pass it on.
 */

import type { CallContext } from './agent.js';
import { Change, Field, Need, type Values, Write } from './model.js';
import { _operationsOf as operationsOf, _packOperation as packOperation } from './pack.js';
import { _Wording as Wording } from './wording.js';

/** The fields of a {@link Message}. */
export interface MessageFields {
  /** The message, in the caller's words. */
  text: string;
  /** Who it's from, as they said it, or `""`. */
  name: string;
  /** A number to reach them on, as they gave it or agreed to, or `""`. */
  number: string;
  /** Who it's for (one of `recipients`), or `""`. */
  to: string;
  /** The platform's id for the call. */
  callId: string;
  /** The account identified, or `""`. */
  accountId: string;
}

/** A message the caller left, as `save` gets it. */
export class Message implements MessageFields {
  /** The message, in the caller's words. */
  readonly text: string;
  /** Who it's from, as they said it, or `""`. */
  readonly name: string;
  /** A number to reach them on, as they gave it or agreed to, or `""`. */
  readonly number: string;
  /** Who it's for (one of `recipients`), or `""`. */
  readonly to: string;
  /** The platform's id for the call. */
  readonly callId: string;
  /** The account identified, or `""`. */
  readonly accountId: string;

  /** @param fields - The message's fields. */
  constructor(fields: MessageFields) {
    this.text = fields.text;
    this.name = fields.name;
    this.number = fields.number;
    this.to = fields.to;
    this.callId = fields.callId;
    this.accountId = fields.accountId;
    Object.freeze(this);
  }
}

/** Every key the `Messages` pack's words come from, with its default. */
export const MESSAGES_WORDING: Readonly<Record<string, string>> = Object.freeze({
  tool: 'Take a message to pass on.',
  'tool.text': 'The message, in their words.',
  'tool.name': "Who it's from, as they said it.",
  'tool.number': 'A number to reach them on, as they said it.',
  'tool.to': "Who it's for.",
  'ask.text': 'What would they like the message to say?',
  'ask.name': 'Who is the message from?',
  'ask.number': "What's the best number to reach them on?",
  'ask.to': 'Who is the message for?',
  read_back: 'The message: "{text}"{parts}. Shall I pass it on?',
  'read_back.to': ', for {to}',
  'read_back.name': ', from {name}',
  'read_back.number': ', to call back on {number}',
  'read_back.caller_id': ", to call back on the number they're calling from, {number}",
  done: 'The message is passed on.',
});

/** Options for {@link Messages}. */
export interface MessagesOptions {
  /**
   * `save(call, message)` passes the {@link Message} on, once the caller said
   * yes; throw `WriteFailed` when it can't. May be async.
   */
  save: (call: CallContext, message: Message) => unknown;
  /**
   * Who a message can be for, by name, each with a few words on who they are;
   * null when there's only one place it goes.
   */
  recipients?: Readonly<Record<string, string>> | null;
  /**
   * What's asked for when the caller hasn't said it, of `name` and `number`;
   * the message itself always is, and who it's for whenever there are
   * `recipients`. Default both.
   */
  askFor?: readonly string[];
  /** True to offer the number they're calling from, read back for them to agree to, when they haven't given one. Default true. */
  callerId?: boolean;
  /** The tool's name. Default `take_message`. */
  tool?: string;
  /** Words in place of the defaults, by key; the keys are those of {@link MESSAGES_WORDING}. */
  wording?: Readonly<Record<string, string>> | null;
  /** False to take messages only from callers who are identified. Default true. */
  beforeIdentity?: boolean;
}

/**
 * Take a message for someone and pass it on.
 *
 * @example
 * ```ts
 * new Messages({
 *   save: (call, message) => inbox.add(message.to, message.text, message.name, message.number),
 *   recipients: { 'Dr. Lee': 'the dentist', 'the front desk': 'bookings and bills' },
 * }).addTo(agent);
 * ```
 */
export class Messages {
  /** The tool's name. */
  readonly tool: string;
  private readonly save: MessagesOptions['save'];
  private readonly recipients: Record<string, string> | null;
  private readonly askFor: Set<string>;
  private readonly callerId: boolean;
  private readonly w: Wording;
  private readonly beforeIdentity: boolean;

  /**
   * @param opts - `save`, and `recipients`, `askFor`, `callerId`, `tool`,
   *   `wording` and `beforeIdentity`.
   * @throws {Error} For `askFor` naming anything but `name` and `number`, or
   *   wording it can't use.
   */
  constructor(opts: MessagesOptions) {
    const askFor = opts.askFor ?? ['name', 'number'];
    const unknown = [...new Set(askFor)].filter((k) => k !== 'name' && k !== 'number').sort();
    if (unknown.length > 0) {
      throw new Error(`askFor takes name and number, not ${unknown.join(', ')}`);
    }
    this.save = opts.save;
    this.recipients =
      opts.recipients && Object.keys(opts.recipients).length > 0 ? { ...opts.recipients } : null;
    this.askFor = new Set(askFor);
    this.callerId = opts.callerId ?? true;
    this.tool = opts.tool ?? 'take_message';
    this.w = new Wording(MESSAGES_WORDING, opts.wording, 'Messages', 'MESSAGES_WORDING');
    this.beforeIdentity = opts.beforeIdentity ?? true;
  }

  /**
   * Register the pack's operation on an `Operations` or a `ServiceAgent`.
   * @param target - The `Operations` or `ServiceAgent`.
   * @returns The target.
   * @throws {TypeError} For anything else.
   */
  addTo<T>(target: T): T {
    const ops = operationsOf(target);
    const w = this.w;
    const fields: Record<string, Field> = {};
    if (this.recipients) {
      fields['to'] = new Field(
        { type: 'string', enum: Object.keys(this.recipients) },
        `${w.say('tool.to')} ${Object.entries(this.recipients)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ')}`,
        { ask: w.say('ask.to') },
      );
    }
    fields['text'] = new Field('string', w.say('tool.text'), { ask: w.say('ask.text') });
    const nameAsked = this.askFor.has('name');
    fields['name'] = new Field('string', w.say('tool.name'), {
      required: nameAsked,
      ask: nameAsked ? w.say('ask.name') : null,
    });
    const numberAsked = this.askFor.has('number') && !this.callerId;
    fields['number'] = new Field('string', w.say('tool.number'), {
      required: numberAsked,
      ask: numberAsked ? w.say('ask.number') : null,
    });

    ops.operation(
      packOperation({
        name: 'TakeMessage',
        description: w.say('tool'),
        fields,
        beforeIdentity: this.beforeIdentity,
        prepare: (call: CallContext, f: Values) => {
          let number = f.get('number') as string | null;
          let parts = '';
          const to = (f.get('to') as string | null) || '';
          const name = (f.get('name') as string | null) || '';
          if (to) parts += w.say('read_back.to', { to });
          if (name) parts += w.say('read_back.name', { name });
          if (number) {
            parts += w.say('read_back.number', { number });
          } else if (this.callerId && this.askFor.has('number')) {
            number = String(call.rawData['caller_id_num'] || '');
            if (!number) throw new Need(w.say('ask.number'), ['number']);
            parts += w.say('read_back.caller_id', { number });
          }
          return new Change({
            readBack: w.say('read_back', { text: f['text'], parts }),
            // One message per person waiting for a yes: another for them amends it
            touches: [`message:${to}`],
            writes: [
              new Write('take_message', { text: f['text'], name, number: number || '', to }),
            ],
            done: w.say('done'),
          });
        },
        apply: (call: CallContext, write: Write) => {
          const a = write.args;
          return this.save(
            call,
            new Message({
              text: String(a['text'] || ''),
              name: String(a['name'] || ''),
              number: String(a['number'] || ''),
              to: String(a['to'] || ''),
              callId: call.callId,
              accountId: call.accountId,
            }),
          );
        },
      }),
      { tool: this.tool, kind: this.tool },
    );
    return target;
  }
}
