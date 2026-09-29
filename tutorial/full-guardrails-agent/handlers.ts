/**
 * Penny's tools. Each handler asks the reservation book to do something, then
 * tells two audiences what happened, separately:
 *
 * - the model gets `tool_result` (what is true) and `tool_prompt` (what to say);
 * - the platform gets actions: step changes, session data, UI events, call control.
 *
 * Nothing here trusts the model's claim that something happened. Handlers check
 * the store; the store checks the rules.
 *
 * Copyright (c) 2025 SignalWire. Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { FunctionResult, getLogger } from '@signalwire/sdk';
import {
  HOUSE_FACTS,
  LargePartyError,
  LockedOutError,
  PolicyError,
  ReservationStore,
  spokenCode,
  spokenDate,
  spokenTime,
} from './reservations.js';

export const log = getLogger('penny');

export const GOODBYE = 'Thanks for calling The Copper Pot. Have a wonderful evening!';
export const TRANSFER_NOTICE = "One moment, I'm connecting you with our host stand.";

/** A tool's arguments and the platform's request, both untrusted until checked. */
export type Args = Record<string, unknown>;
export type RawData = Record<string, unknown>;
export type Handler = (args: Args, rawData: RawData) => FunctionResult;

/** Server configuration. The model can't choose any of these values. */
export interface Settings {
  hostNumber?: string; // where request_human may send a call
  smsFrom?: string; // the restaurant's texting number
}

/** A tool request arrived without the call it belongs to. */
export class MissingCallContext extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// region: guarded
/** Turn refusals into facts for the model, and never let a crash sound like success. */
export function guarded(name: string, handler: Handler): Handler {
  return (args, rawData) => {
    try {
      if (!isObject(args) || !isObject(rawData)) {
        throw new PolicyError('The request was malformed.', 'Ask the caller to say that again.');
      }
      return handler(args, rawData);
    } catch (err) {
      if (err instanceof PolicyError) {
        return new FunctionResult({ tool_result: err.fact, tool_prompt: err.ask });
      }
      if (err instanceof MissingCallContext) {
        return new FunctionResult({
          tool_result: 'Nothing was done: the request had no call context.',
          tool_prompt: 'Apologize and offer to take a message.',
        });
      }
      log.error(`tool ${name} failed: ${err instanceof Error ? err.stack : String(err)}`);
      return new FunctionResult({
        tool_result: "The system couldn't finish that, so the outcome is unknown.",
        tool_prompt: "Don't say it worked. Apologize and offer to try again.",
      });
    }
  };
}
// endregion: guarded

function callIdOf(rawData: RawData): string {
  const callId = rawData['call_id'];
  if (typeof callId !== 'string' || !callId) throw new MissingCallContext();
  return callId;
}

/** Answers gather mode stored in global_data. Caller-supplied, so untrusted. */
function gathered(rawData: RawData, key: string): Record<string, unknown> {
  const globalData = rawData['global_data'];
  const value = isObject(globalData) ? globalData[key] : undefined;
  return isObject(value) ? value : {};
}

export class PennyHandlers {
  constructor(
    readonly store: ReservationStore,
    readonly settings: Settings,
  ) {}

  // ---------------------------------------------------------------------------
  // Routing: code, not the model, moves the conversation
  // ---------------------------------------------------------------------------

  // region: start-booking
  readonly startBooking = guarded('start_booking', (_args, rawData) => {
    this.store.resetRequest(callIdOf(rawData));
    return new FunctionResult({
      tool_result: 'A new reservation has been started.',
      tool_prompt: "Tell the caller you'll take a few details.",
    })
      .updateGlobalData({ booking: {}, booking_request: {} })
      .swmlChangeContext('booking');
  });
  // endregion: start-booking

  readonly manageBooking = guarded('manage_booking', (_args, rawData) => {
    callIdOf(rawData);
    return new FunctionResult({
      tool_result: 'Looking up an existing reservation.',
      tool_prompt: 'Ask for the confirmation code and the last name on it.',
    })
      .updateGlobalData({ manage: {} })
      .swmlChangeContext('manage');
  });

  readonly houseInfo = guarded('house_info', (args) => {
    const topic = args['topic'];
    const fact =
      typeof topic === 'string' && Object.hasOwn(HOUSE_FACTS, topic) ? HOUSE_FACTS[topic] : null;
    if (!fact) {
      return new FunctionResult({
        tool_result: "There's no information on that topic.",
        tool_prompt: "Say you don't have that information, then carry on.",
      });
    }
    return new FunctionResult({
      tool_result: fact,
      tool_prompt: 'Answer with this fact in your own words, then carry on.',
    });
  });

  // ---------------------------------------------------------------------------
  // Booking
  // ---------------------------------------------------------------------------

  // region: find-tables
  readonly findTables = guarded('find_tables', (args, rawData) => {
    const callId = callIdOf(rawData);
    // What the caller has asked for: gather's answers, changed by every
    // correction since. A correction passed as an argument changes only
    // that detail, even if the last search was refused.
    const draft = this.store.updateDraft(callId, args, gathered(rawData, 'booking_request'));
    let request, options;
    try {
      [request, options] = this.store.findOptions(
        callId,
        draft.party_size,
        draft.date,
        draft.time,
        draft.name,
      );
    } catch (err) {
      if (!(err instanceof LargePartyError)) throw err;
      return new FunctionResult({ tool_result: err.fact, tool_prompt: err.ask });
    }

    let result: FunctionResult;
    if (options.length > 0) {
      const listed = options.map((option) => option.spoken()).join('; ');
      result = new FunctionResult({
        tool_result: `Open for ${request.partySize} on ${spokenDate(request.day)}: ${listed}.`,
        tool_prompt:
          'Offer these options by number. When the caller picks one, ' +
          'call hold_table with its number.',
      });
    } else {
      result = new FunctionResult({
        tool_result:
          `Nothing is open for ${request.partySize} on ${spokenDate(request.day)} ` +
          `within an hour of ${spokenTime(request.start)}. Seatings run 5 PM to 8:30 PM.`,
        tool_prompt:
          'Say so, and ask whether another time or date would work. ' +
          'Then call find_tables with only what changed.',
      });
    }
    return result
      .updateGlobalData({ booking: { request: request.spoken() } })
      .swmlChangeStep('choose')
      .swmlUserEvent({
        type: 'options_offered',
        day: request.day,
        options: options.map((o) => ({ number: o.number, time: spokenTime(o.start) })),
      });
  });
  // endregion: find-tables

  // region: hold-table
  readonly holdTable = guarded('hold_table', (args, rawData) => {
    const callId = callIdOf(rawData);
    const proposal = this.store.holdOption(callId, args['option']);
    return new FunctionResult({
      tool_result:
        `On hold for five minutes: ${proposal.spoken()}. ` +
        `This is proposal revision ${proposal.revision}.`,
      tool_prompt:
        'Read the proposal back and ask the caller to confirm it. ' +
        `If they clearly say yes, call confirm_booking with revision ${proposal.revision}. ` +
        'If they want a change, call find_tables with only what changed.',
    })
      .updateGlobalData({
        booking: { proposal: proposal.spoken(), revision: proposal.revision },
      })
      .swmlChangeStep('review')
      .swmlUserEvent({
        type: 'table_held',
        revision: proposal.revision,
        day: proposal.day,
        time: spokenTime(proposal.start),
        party_size: proposal.partySize,
      });
  });
  // endregion: hold-table

  // region: confirm-booking
  readonly confirmBooking = guarded('confirm_booking', (args, rawData) => {
    const callId = callIdOf(rawData);
    const booking = this.store.confirm(callId, args['revision']);
    const code = spokenCode(booking.code);
    return new FunctionResult({
      tool_result: `Confirmed: ${booking.spoken()}. Confirmation code: ${code}.`,
      tool_prompt:
        "Tell the caller it's booked and read the confirmation code " +
        'slowly, one character at a time. Then offer to text the details.',
    })
      .updateGlobalData({ booking: { summary: booking.spoken(), code_spoken: code } })
      .swmlChangeStep('booked')
      .swmlUserEvent({
        type: 'booking_confirmed',
        code: booking.code,
        day: booking.day,
        time: spokenTime(booking.start),
        party_size: booking.partySize,
      });
  });
  // endregion: confirm-booking

  // region: send-text
  readonly sendConfirmationText = guarded('send_confirmation_text', (_args, rawData) => {
    const callId = callIdOf(rawData);
    const booking = this.store.bookingForCall(callId);
    if (booking === null) {
      throw new PolicyError(
        "This call hasn't booked a reservation.",
        "Say there's nothing to text yet.",
      );
    }
    if (!this.settings.smsFrom) {
      throw new PolicyError(
        "Texting isn't set up at the restaurant.",
        'Apologize, and make sure they have the confirmation code.',
      );
    }
    // The destination is the number this call comes from. The model can't supply one.
    const caller = String(rawData['caller_id_num'] ?? '');
    if (!/^\+[1-9]\d{9,14}$/.test(caller)) {
      throw new PolicyError(
        "The number this call comes from can't receive a text.",
        "Say you can't text this number, and make sure they have the code.",
      );
    }
    // The platform sends the text after this returns, so Penny can only say
    // a text was requested, never that it was sent or arrived.
    const decision = this.store.requestSms(booking.code);
    if (decision === 'duplicate') {
      return new FunctionResult({
        tool_result: 'A text for this booking was requested moments ago.',
        tool_prompt:
          "Tell the caller a text was requested a moment ago. If it hasn't " +
          'arrived in a couple of minutes, you can request it again.',
      });
    }
    if (decision === 'limit') {
      throw new PolicyError(
        'A text for this booking has been requested as many times as allowed.',
        "Say you can't request another text, and make sure they have the confirmation code.",
      );
    }
    const body =
      `The Copper Pot: ${booking.spoken()}. Confirmation code ${booking.code}. ` +
      'Call us to change or cancel.';
    return new FunctionResult({
      tool_result: `Requested a text of the details to the number ending in ${caller.slice(-4)}.`,
      tool_prompt: "Tell the caller you've requested the text.",
    }).sendSms({ toNumber: caller, fromNumber: this.settings.smsFrom, body });
  });
  // endregion: send-text

  // ---------------------------------------------------------------------------
  // An existing reservation
  // ---------------------------------------------------------------------------

  // region: verify-reservation
  readonly verifyReservation = guarded('verify_reservation', (args, rawData) => {
    const callId = callIdOf(rawData);
    let found;
    try {
      found = this.store.verify(callId, args['confirmation_code'], args['last_name']);
    } catch (err) {
      if (!(err instanceof LockedOutError)) throw err;
      return new FunctionResult({ tool_result: err.fact, tool_prompt: err.ask }).swmlChangeStep(
        'locked',
      );
    }
    return new FunctionResult({
      tool_result: `Verified: ${found.spoken()}. Status: ${found.status}.`,
      tool_prompt: "Tell the caller the details and ask what they'd like to do.",
    })
      .updateGlobalData({ manage: { summary: found.spoken(), status: found.status } })
      .swmlChangeStep('details')
      .swmlUserEvent({ type: 'reservation_verified', status: found.status });
  });
  // endregion: verify-reservation

  // region: cancel
  readonly requestCancel = guarded('request_cancel', (_args, rawData) => {
    const callId = callIdOf(rawData);
    const [found, revision] = this.store.requestCancel(callId);
    return new FunctionResult({
      tool_result: `Ready to cancel ${found.spoken()}. This is cancellation revision ${revision}.`,
      tool_prompt:
        "Read that back and ask if they're sure. If they clearly say yes, " +
        `call confirm_cancel with revision ${revision}. If not, call keep_reservation.`,
    }).swmlChangeStep('confirm_cancel');
  });

  readonly confirmCancel = guarded('confirm_cancel', (args, rawData) => {
    const callId = callIdOf(rawData);
    const cancelled = this.store.confirmCancel(callId, args['revision']);
    return new FunctionResult({
      tool_result: `Cancelled: ${cancelled.spoken()}.`,
      tool_prompt: "Tell the caller it's cancelled, then ask if there's anything else.",
    })
      .updateGlobalData({ manage: { summary: cancelled.spoken(), status: 'cancelled' } })
      .swmlChangeStep('cancelled')
      .swmlUserEvent({ type: 'reservation_cancelled' });
  });
  // endregion: cancel

  readonly keepReservation = guarded('keep_reservation', (_args, rawData) => {
    const callId = callIdOf(rawData);
    const kept = this.store.keepReservation(callId);
    return new FunctionResult({
      tool_result: `Nothing changed: ${kept.spoken()} is still booked.`,
      tool_prompt: 'Tell the caller their reservation is unchanged.',
    }).swmlChangeStep('details');
  });

  // ---------------------------------------------------------------------------
  // People, messages and endings
  // ---------------------------------------------------------------------------

  // region: request-human
  readonly requestHuman = guarded('request_human', (_args, rawData) => {
    callIdOf(rawData);
    if (this.settings.hostNumber && this.store.hostStandOpen()) {
      // say() is an action, so it finishes before connect() runs. The
      // response text is spoken by the model on its own schedule and
      // could be cut off by the transfer.
      return new FunctionResult({
        tool_result: 'The call is being transferred to the host stand.',
        tool_prompt: 'Say nothing more; the transfer notice is playing.',
      })
        .say(TRANSFER_NOTICE)
        .connect(this.settings.hostNumber, true);
    }
    return new FunctionResult({
      tool_result: 'Nobody is at the host stand right now.',
      tool_prompt:
        "Tell the caller nobody is at the host stand, and that you'll take a message for them.",
    })
      .updateGlobalData({ message: {} })
      .swmlChangeContext('help');
  });
  // endregion: request-human

  // region: save-message
  readonly saveMessage = guarded('save_message', (args, rawData) => {
    const callId = callIdOf(rawData);
    const taken = gathered(rawData, 'message');
    const detail = (key: string): string => {
      const given = args[key];
      return String(
        given !== undefined && given !== null && given !== '' ? given : taken[key] || '',
      );
    };

    const saved = this.store.saveMessage(
      callId,
      detail('name'),
      detail('callback'),
      detail('body'),
    );
    return new FunctionResult({
      tool_result:
        'Message saved for the host stand, with a callback number ' +
        `ending in ${saved.callback.slice(-4)}.`,
      tool_prompt: 'Tell the caller the host stand will call them back.',
    })
      .swmlChangeStep('message_saved')
      .swmlUserEvent({ type: 'message_taken' });
  });
  // endregion: save-message

  // region: finish
  readonly finish = guarded('finish', () => {
    // The goodbye is a say() action, not response text: actions run in order,
    // so the caller hears all of it before hangup() ends the call.
    return new FunctionResult({
      tool_result: 'The goodbye is playing and the call will end.',
      tool_prompt: 'Say nothing more.',
    })
      .say(GOODBYE)
      .hangup();
  });
  // endregion: finish

  // region: capture-call
  /** onCallEnd: record what the store says happened, not what the transcript says. */
  captureCall(callLog: unknown[], rawData: RawData): void {
    const callId = isObject(rawData) ? rawData['call_id'] : undefined;
    if (typeof callId !== 'string' || !callId) {
      log.warn('call ended without a call id; nothing recorded');
      return;
    }
    const outcome = this.store.recordCallEnd(callId, (callLog ?? []).length);
    log.info(`call ${callId} ended: ${outcome}`);
  }
  // endregion: capture-call
}
