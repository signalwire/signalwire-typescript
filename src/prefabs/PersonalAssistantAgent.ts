/**
 * PersonalAssistantAgent: answers the phone for one person, built on the
 * operations module.
 */

import { FunctionResult } from '../FunctionResult.js';
import {
  type CallContext,
  Said,
  ServiceAgent,
  type ServiceAgentOptions,
} from '../operations/agent.js';
import type { Appointments } from '../operations/appointments.js';
import type { InfoBotKnowledge } from '../operations/infobot/knowledge.js';
import type { Messages } from '../operations/messages.js';
import { Change, Field, type Values } from '../operations/model.js';
import { packOperation } from '../operations/pack.js';
import { Wording } from '../operations/wording.js';

/**
 * Every key `PersonalAssistantAgent`'s own words come from, with its default
 * (`PersonalAssistantAgent.WORDING`). The rest are its `Operations`' and the packs'.
 */
export const ASSISTANT_WORDING: Readonly<Record<string, string>> = Object.freeze({
  tool: "Put the caller through to {owner}, once they've said who they are and what it's about.",
  'tool.name': 'Who is calling, as they said it.',
  'tool.reason': "What it's about, in a few words.",
  'ask.name': "Who's calling?",
  'ask.reason': "What's it about?",
  whisper: '{name} is calling about {reason}. Press {key} to take the call.',
  trying: 'Seeing whether {owner} can take it.',
  'trying.then': "Tell them you'll see if {owner} can take it, and say nothing more.",
  unavailable: "{owner} isn't taking calls now.",
  chat: "{owner} can't be put through from a chat.",
  not_taken: "{owner} didn't take the call (${connect_failed_reason}).",
  'then.message': 'Tell them, and offer to take a message with {tool}.',
  'then.appointment': 'Tell them, and offer to find a time with {tool}.',
  'then.message_or_appointment':
    'Tell them, and offer to take a message with {message} or find a time ' + 'with {appointment}.',
  'then.nothing': 'Tell them, and ask how else you can help.',
});

const VARIABLE = /[$%]\{/g;

/** Options for a {@link PersonalAssistantAgent}. */
export interface PersonalAssistantAgentOptions extends Omit<ServiceAgentOptions, 'name'> {
  /** The agent's name. Default `"assistant"`. */
  name?: string;
  /** The person's name, as the assistant says it. */
  owner: string;
  /** Where their calls go: a phone number in E.164 form, or a SIP address. */
  reach: string;
  /**
   * `available(call)` says whether they're taking calls now (it may be async);
   * null for always. When they aren't, the call isn't put through.
   */
  available?: ((call: CallContext) => unknown) | null;
  /** The `Messages` pack, to take a message when they don't take the call. */
  messages?: Messages | null;
  /** The `Appointments` pack, for their calendar. */
  appointments?: Appointments | null;
  /** An `InfoBotKnowledge` to answer questions from. */
  knowledge?: InfoBotKnowledge | null;
  /** The number the put-through call comes from; null for the caller's own, so the person sees who it is. */
  callerId?: string | null;
  /** How long to ring them, in seconds. Default 20. */
  ringSeconds?: number;
  /** How long they have, once they answer, to take the call, in seconds. Default 15. */
  answerSeconds?: number;
  /** The voice they hear the whisper in; the platform's default when null. */
  whisperVoice?: string | null;
  /** The whisper's language code, such as `"en-US"`; the platform's default when null. */
  whisperLanguage?: string | null;
  /** The key they press to take the call. Default `"1"`. */
  acceptKey?: string;
  /** The put-through tool's name. Default `put_through`. */
  tool?: string;
  /** Words in place of the assistant's own defaults, by key; the keys are those of `PersonalAssistantAgent.WORDING`. */
  assistantWording?: Readonly<Record<string, string>> | null;
}

/**
 * Answers the phone for one person: screens callers, puts them through when
 * the person takes the call, and otherwise takes a message or books time.
 *
 * @example
 * ```ts
 * const assistant = new PersonalAssistantAgent({
 *   role: "You answer Ann Lee's phone. You are friendly and brief.",
 *   owner: 'Ann',
 *   reach: '+15550100001',
 *   available: () => !calendar.busyNow(),
 *   messages: new Messages({ save: (call, message) => sendText(ANN, message) }),
 *   appointments: new Appointments({ openings: calendar.openNear, book: calendar.book }),
 * });
 * ```
 */
export class PersonalAssistantAgent extends ServiceAgent {
  /** Every key the assistant's own words come from, with its default; `assistantWording` replaces any. */
  static readonly WORDING: Readonly<Record<string, string>> = ASSISTANT_WORDING;
  /** The person's name, as the assistant says it. */
  readonly owner: string;
  private readonly assistantWords: Wording;
  private readonly reach: string;
  private readonly available: ((call: CallContext) => unknown) | null;
  private readonly callerId: string | null;
  private readonly ring: number;
  private readonly answer: number;
  private readonly voice: string | null;
  private readonly language: string | null;
  private readonly key: string;
  private readonly messageTool: string | null;
  private readonly appointmentTool: string | null;

  /**
   * @param opts - `role`, `owner` and `reach`, and the rest of
   *   {@link PersonalAssistantAgentOptions}, with `ServiceAgent`'s.
   * @throws {Error} For an accept key that isn't one key of the keypad, or wording it can't use.
   */
  constructor(opts: PersonalAssistantAgentOptions) {
    const {
      name,
      owner,
      reach,
      available,
      messages,
      appointments,
      knowledge,
      callerId,
      ringSeconds,
      answerSeconds,
      whisperVoice,
      whisperLanguage,
      acceptKey,
      tool,
      assistantWording,
      ...rest
    } = opts;
    super({ ...rest, name: name ?? 'assistant' });
    this.assistantWords = new Wording(
      ASSISTANT_WORDING,
      assistantWording,
      'PersonalAssistantAgent',
      'PersonalAssistantAgent.WORDING',
    );
    this.owner = owner;
    this.reach = reach;
    this.available = available ?? null;
    this.callerId = callerId ?? null;
    this.ring = ringSeconds ?? 20;
    this.answer = answerSeconds ?? 15;
    this.voice = whisperVoice ?? null;
    this.language = whisperLanguage ?? null;
    const key = acceptKey ?? '1';
    if (!(key.length === 1 && '0123456789*#'.includes(key))) {
      throw new Error(`acceptKey must be one key of the keypad, not '${key}'`);
    }
    this.key = key;
    this.messageTool = messages ? messages.tool : null;
    this.appointmentTool = appointments ? appointments.tools['openings']! : null;
    if (knowledge) {
      knowledge.install(this);
      this.offer(knowledge.tools, { beforeIdentity: true });
    }
    if (messages) messages.addTo(this);
    if (appointments) appointments.addTo(this);
    this.addPutThrough(tool ?? 'put_through');
  }

  /** What the model is told to offer when the call isn't put through. */
  private otherwise(): string {
    const w = this.assistantWords;
    const message = this.messageTool;
    const appointment = this.appointmentTool;
    if (message && appointment)
      return w.say('then.message_or_appointment', { message, appointment });
    if (message) return w.say('then.message', { tool: message });
    if (appointment) return w.say('then.appointment', { tool: appointment });
    return w.say('then.nothing');
  }

  private addPutThrough(tool: string): void {
    const w = this.assistantWords;
    this.operation(
      packOperation({
        name: 'PutThrough',
        description: w.say('tool', { owner: this.owner }),
        fields: {
          name: new Field('string', w.say('tool.name'), { ask: w.say('ask.name') }),
          reason: new Field('string', w.say('tool.reason'), { ask: w.say('ask.reason') }),
        },
        confirm: false,
        beforeIdentity: true,
        prepare: async (call: CallContext, f: Values) => {
          // Connecting is a call's
          if (call.medium === 'chat')
            throw new Said(w.say('chat', { owner: this.owner }), this.otherwise());
          if (this.available !== null) {
            const taking = await this.available(call);
            if (!taking) {
              throw new Said(w.say('unavailable', { owner: this.owner }), this.otherwise());
            }
          }
          call.act(
            new FunctionResult().executeSwml(this.ringThem(String(f['name']), String(f['reason']))),
          );
          return new Change({
            readBack: '',
            done: w.say('trying', { owner: this.owner }),
            then: w.say('trying.then', { owner: this.owner }),
          });
        },
      }),
      { tool, kind: tool },
    );
  }

  /**
   * The SWML that rings them with the whisper. Their leg hears it once they
   * answer, and the call is bridged only when they press the accept key; any
   * other key, or none, hangs their leg up and the caller stays with the
   * assistant. Once a bridged call ends, so does the caller's.
   */
  private ringThem(name: string, reason: string): Record<string, unknown> {
    const w = this.assistantWords;
    const whisper = w.say('whisper', { name: spoken(name), reason: spoken(reason), key: this.key });
    const prompt: Record<string, unknown> = {
      play: `say:${whisper}`,
      max_digits: 1,
      initial_timeout: this.answer,
    };
    if (this.voice) prompt['say_voice'] = this.voice;
    if (this.language) prompt['say_language'] = this.language;
    const connect: Record<string, unknown> = {
      to: this.reach,
      timeout: this.ring,
      confirm: [
        { prompt },
        {
          switch: {
            variable: 'prompt_value',
            case: { [this.key]: [{ set: { screened: 'taken' } }] },
            default: [{ hangup: {} }],
          },
        },
      ],
      // From their answer: the whisper, then the time they have to press the key
      confirm_timeout: this.answer + 30,
    };
    if (this.callerId) connect['from'] = this.callerId;
    const notTaken = `${w.say('not_taken', { owner: this.owner })} ${this.otherwise()}`;
    return {
      version: '1.0.0',
      sections: {
        main: [
          { connect },
          {
            switch: {
              variable: 'connect_result',
              case: { connected: [{ hangup: {} }] },
              default: [{ set: { ai_response: notTaken } }],
            },
          },
        ],
      },
    };
  }
}

/** A caller's words for the whisper, with nothing the platform would read as a variable. */
function spoken(text: string): string {
  return String(text).replace(VARIABLE, '').trim();
}
