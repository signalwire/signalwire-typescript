/**
 * FrontDeskAgent: a business's front desk, built on the operations module.
 */

import { FunctionResult } from '../FunctionResult.js';
import { type CallContext, ServiceAgent, type ServiceAgentOptions } from '../operations/agent.js';
import type { Appointments } from '../operations/appointments.js';
import type { InfoBotKnowledge } from '../operations/infobot/knowledge.js';
import type { Messages } from '../operations/messages.js';
import { Refuse } from '../operations/model.js';
import { Wording } from '../operations/wording.js';

/** Where the front desk puts a caller through to. */
export class Department {
  /** What callers go to it for, as the model reads it: "questions about a bill". */
  readonly description: string;
  /** Where the call goes: a phone number in E.164 form, or a SIP address. */
  readonly to: string;
  /** `open(call)` says whether it's taking calls now (it may be async); null for always. */
  readonly open: ((call: CallContext) => unknown) | null;

  /**
   * @param description - What callers go to it for, as the model reads it.
   * @param to - Where the call goes: a phone number in E.164 form, or a SIP address.
   * @param open - `open(call)` says whether it's taking calls now; null for always.
   */
  constructor(
    description: string,
    to: string,
    open: ((call: CallContext) => unknown) | null = null,
  ) {
    this.description = description;
    this.to = to;
    this.open = open;
    Object.freeze(this);
  }
}

/**
 * Every key `FrontDeskAgent`'s own words come from, with its default
 * (`FrontDeskAgent.WORDING`). The rest of its words are its `Operations`' and
 * the packs'.
 */
export const FRONT_DESK_WORDING: Readonly<Record<string, string>> = Object.freeze({
  closed: "{department} isn't taking calls now.",
  chat: "{department} can't be reached from a chat.",
  'closed.then': 'Tell them, and offer to take a message with {tool}.',
  'closed.then.no_messages': 'Tell them, and ask how else you can help.',
});

/** Options for a {@link FrontDeskAgent}. */
export interface FrontDeskAgentOptions extends Omit<ServiceAgentOptions, 'name'> {
  /** The agent's name. Default `"front_desk"`. */
  name?: string;
  /** Where callers can be put through to, by the name callers use for it. */
  departments?: Readonly<Record<string, Department>> | null;
  /** The `Appointments` pack, to book them. */
  appointments?: Appointments | null;
  /** The `Messages` pack, to take them, and to offer when a department isn't taking calls. */
  messages?: Messages | null;
  /** An `InfoBotKnowledge` to answer from the business's documents; it's offered before the caller is identified. */
  knowledge?: InfoBotKnowledge | null;
  /** The number calls put through come from; the platform's default when null. */
  callerId?: string | null;
  /** Words in place of the desk's own defaults, by key; the keys are those of `FrontDeskAgent.WORDING`. */
  deskWording?: Readonly<Record<string, string>> | null;
}

/**
 * A business's front desk: departments to put callers through to,
 * appointments, messages and answers from its documents, each when given.
 *
 * Its own words are in `FrontDeskAgent.WORDING`, by key.
 *
 * @example
 * ```ts
 * const desk = new FrontDeskAgent({
 *   role: 'You answer the phone for Bayside Dental. You are warm and brief.',
 *   departments: {
 *     billing: new Department('questions about a bill', '+15550100001', billingHours),
 *     'the hygienist': new Department('questions about a cleaning', '+15550100002'),
 *   },
 *   appointments: new Appointments({ openings: calendar.openNear, book: calendar.book }),
 *   messages: new Messages({ save: inbox.add }),
 *   knowledge: new InfoBotKnowledge({ search: searchFaq }),
 * });
 * ```
 */
export class FrontDeskAgent extends ServiceAgent {
  /** Every key the desk's own words come from, with its default; `deskWording` replaces any. */
  static readonly WORDING: Readonly<Record<string, string>> = FRONT_DESK_WORDING;
  private readonly deskWords: Wording;
  private readonly departments: Record<string, Department>;
  private readonly messages: Messages | null;
  private readonly callerId: string | null;

  /**
   * @param opts - `role`, and `name`, `departments`, `appointments`,
   *   `messages`, `knowledge`, `callerId`, `deskWording`, and `ServiceAgent`'s
   *   (`Operations`' options and the agent's).
   * @throws {Error} For wording it can't use.
   */
  constructor(opts: FrontDeskAgentOptions) {
    const { departments, appointments, messages, knowledge, callerId, deskWording, name, ...rest } =
      opts;
    super({ ...rest, name: name ?? 'front_desk' });
    this.deskWords = new Wording(
      FRONT_DESK_WORDING,
      deskWording,
      'FrontDeskAgent',
      'FrontDeskAgent.WORDING',
    );
    this.departments = { ...(departments ?? {}) };
    this.messages = messages ?? null;
    this.callerId = callerId ?? null;
    if (knowledge) {
      knowledge.install(this);
      this.offer(knowledge.tools, { beforeIdentity: true });
    }
    if (appointments) appointments.addTo(this);
    if (messages) messages.addTo(this);
    if (Object.keys(this.departments).length > 0) {
      this.transferWith((call, _summary, to) => this.putThrough(call, String(to)), {
        destinations: Object.fromEntries(
          Object.entries(this.departments).map(([k, d]) => [k, d.description]),
        ),
        gated: false,
      });
    }
  }

  private closedThen(): string {
    return this.messages
      ? this.deskWords.say('closed.then', { tool: this.messages.tool })
      : this.deskWords.say('closed.then.no_messages');
  }

  private async putThrough(call: CallContext, to: string): Promise<FunctionResult> {
    const department = this.departments[to]!;
    const w = this.deskWords;
    // Putting through is a call's
    if (call.medium === 'chat')
      throw new Refuse(w.say('chat', { department: to }), this.closedThen());
    if (department.open !== null) {
      const taking = await department.open(call);
      if (!taking) throw new Refuse(w.say('closed', { department: to }), this.closedThen());
    }
    return new FunctionResult().connect(department.to, true, this.callerId ?? undefined);
  }
}
