/**
 * Closed-set string unions for RELAY call command options.
 *
 * Each alias below is a string-literal union of the values the SignalWire
 * platform actually accepts for a given option, paired with an
 * `…OrString = <Union> | (string & {})` form that is used at the call sites.
 * This is the same idiom as {@link ../skills/SkillName.SkillName}:
 *
 *   - The literal union gives editor autocompletion for the known values and
 *     turns a typo (`'femal'`, `'CDN'`) into a **compile-time** error rather
 *     than a silent runtime/server failure.
 *   - The `(string & {})` arm widens the parameter back to `string` at the
 *     type level, so any other string is still accepted — preserving parity
 *     with the Python reference (whose `play_tts(gender=...)`,
 *     `play(direction=...)`, `detect_fax(tone=...)` all take a bare `str`) and
 *     leaving room for values the platform may add. It is a pure type-level
 *     annotation: TypeScript erases types, so the value placed on the wire is
 *     the identical string either way.
 *
 * Drift note: these alias the value of *option-bag fields* (e.g.
 * `playTTS(text, { gender })`). The signature enumerator collapses an inline
 * options object to a single anonymous `__type`, so the individual field types
 * never reach the canonical signature; and even where the widened union were
 * to surface directly, the enumerator collapses `Union | (string & {})` back
 * to `string`. Either way drift stays zero — these are autocomplete/typo
 * ergonomics with no surface effect.
 */

/**
 * Text-to-speech voice gender for {@link ../relay/Call.Call.playTTS} /
 * {@link ../relay/Call.Call.promptTTS} (`gender` option). The SignalWire
 * platform recognises `"male"` and `"female"`.
 */
export type TtsGender = 'male' | 'female';

/**
 * A TTS gender option: one of the typed {@link TtsGender} values
 * (autocompleted + typo-checked) or any other string (forward-compat + parity
 * with Python's bare `str`).
 */
export type TtsGenderOrString = TtsGender | (string & {});

/**
 * Fax tone to detect for {@link ../relay/Call.Call.detectFax} (`tone` option):
 * `"CED"` (called-station, answering fax) or `"CNG"` (calling-station,
 * originating fax). Restricts detection to one tone; omit to detect either.
 */
export type FaxTone = 'CED' | 'CNG';

/**
 * A fax-tone option: one of the typed {@link FaxTone} values (autocompleted +
 * typo-checked) or any other string (forward-compat + parity with Python's
 * bare `str`).
 */
export type FaxToneOrString = FaxTone | (string & {});

// ─── RELAY lifecycle state vocabularies ──────────────────────────────────
//
// Three *distinct* server-emitted lifecycle vocabularies — a call's
// `calling.call.state`, an outbound dial's `calling.call.dial` `dial_state`,
// and a message's `messaging.state` `message_state`. They are NEVER
// interchangeable: a `'dialing'` is meaningless on a Call, an `'answered'`
// is meaningless on a Message. Each is typed separately below.
//
// These mirror values the SignalWire platform *emits* (not values the SDK
// sends), so — like a Rust `#[non_exhaustive]` enum — the `…OrString` arm is
// load-bearing: a future server build can add a state and existing typed code
// must still compile and forward it. The typed union gives autocomplete +
// typo-checking on the *known* set; the `(string & {})` arm keeps the field a
// `string` at the type level (types erase → identical runtime value), matching
// the Python reference's bare-`str` `Call.state` / `Message.state`.
//
// The grounding for each set is the reference's own constants
// (`relay/constants.ts`, mirrored from `signalwire/relay/constants.py`) and
// docstrings; the dial set is `signalwire/relay/client.py` (`dialing |
// answered | failed`).

/**
 * Call lifecycle state for {@link ../relay/Call.Call.state} and the
 * `call_state` field of a `calling.call.state` event
 * ({@link ../relay/RelayEvent.CallStateEvent.callState}). The platform walks a
 * call through `created → ringing → answered → ending → ended`; `ended` is the
 * sole terminal state (see {@link isCallStateTerminal}).
 */
export type CallState =
  | 'created'
  | 'ringing'
  | 'answered'
  | 'ending'
  | 'ended';

/**
 * A call-state value: one of the typed {@link CallState} values (autocompleted
 * + typo-checked) or any other string (forward-compat with server-added states
 * + parity with the reference's bare-`str` `Call.state`).
 */
export type CallStateOrString = CallState | (string & {});

/**
 * Outbound-dial state for the `dial_state` field of a `calling.call.dial`
 * event ({@link ../relay/RelayEvent.DialEvent.dialState}). The platform reports
 * `dialing` while a leg is being attempted, then resolves to `answered` (a leg
 * won) or `failed` (all legs failed) — both terminal (see
 * {@link isDialStateTerminal}). Grounded in `signalwire/relay/client.py`.
 *
 * NOTE: distinct from {@link CallState}. A dial's `answered` is the *dial*
 * resolving, not a `Call.state` transition.
 */
export type DialState =
  | 'dialing'
  | 'answered'
  | 'failed';

/**
 * A dial-state value: one of the typed {@link DialState} values (autocompleted
 * + typo-checked) or any other string (forward-compat + parity with the
 * reference's bare-`str` `dial_state`).
 */
export type DialStateOrString = DialState | (string & {});

/**
 * Message lifecycle state for {@link ../relay/Message.Message.state} and the
 * `message_state` field of a `messaging.state` event
 * ({@link ../relay/RelayEvent.MessageStateEvent.messageState}). Outbound
 * messages walk `queued → initiated → sent → delivered` (or `undelivered` /
 * `failed`); inbound messages arrive as `received`. The terminal set is
 * `delivered | undelivered | failed` (see {@link isMessageStateTerminal} and
 * `MESSAGE_TERMINAL_STATES`).
 *
 * NOTE: distinct from {@link CallState} and {@link DialState}.
 */
export type MessageState =
  | 'queued'
  | 'initiated'
  | 'sent'
  | 'delivered'
  | 'undelivered'
  | 'failed'
  | 'received';

/**
 * A message-state value: one of the typed {@link MessageState} values
 * (autocompleted + typo-checked) or any other string (forward-compat + parity
 * with the reference's bare-`str` `Message.state`).
 */
export type MessageStateOrString = MessageState | (string & {});

// The terminal subsets, frozen so callers can iterate/inspect them. Kept as
// `readonly` tuples typed with the *literal* members (not widened to string)
// so `isXTerminal` narrows correctly and the lists stay in lockstep with the
// unions above.

/** The single terminal {@link CallState} (`'ended'`). */
export const CALL_STATE_TERMINAL = ['ended'] as const satisfies readonly CallState[];

/** The terminal {@link DialState} values (`'answered'`, `'failed'`). */
export const DIAL_STATE_TERMINAL = ['answered', 'failed'] as const satisfies readonly DialState[];

/**
 * The terminal {@link MessageState} values
 * (`'delivered'`, `'undelivered'`, `'failed'`). Mirrors the runtime
 * `MESSAGE_TERMINAL_STATES` in `relay/constants.ts`.
 */
export const MESSAGE_STATE_TERMINAL = ['delivered', 'undelivered', 'failed'] as const satisfies readonly MessageState[];

/**
 * True when `state` is a terminal {@link CallState} — i.e. the call has reached
 * `ended` and will emit no further state transitions. Accepts any string (the
 * value off the wire), so it is safe to call on a raw `call_state` field.
 *
 * @param state - A call state (typed {@link CallState} or any string).
 * @returns `true` iff `state === 'ended'`.
 */
export function isCallStateTerminal(state: CallStateOrString): boolean {
  return (CALL_STATE_TERMINAL as readonly string[]).includes(state);
}

/**
 * True when `state` is a terminal {@link DialState} — i.e. the outbound dial
 * has resolved (`answered` or `failed`) and will emit no further dial
 * progress. Accepts any string (the value off the wire).
 *
 * @param state - A dial state (typed {@link DialState} or any string).
 * @returns `true` iff `state` is `answered` or `failed`.
 */
export function isDialStateTerminal(state: DialStateOrString): boolean {
  return (DIAL_STATE_TERMINAL as readonly string[]).includes(state);
}

/**
 * True when `state` is a terminal {@link MessageState} — i.e. the message has
 * reached a final delivery outcome (`delivered`, `undelivered`, or `failed`)
 * and will emit no further `messaging.state` events. Accepts any string (the
 * value off the wire), matching the runtime `MESSAGE_TERMINAL_STATES` check in
 * {@link ../relay/Message.Message}.
 *
 * @param state - A message state (typed {@link MessageState} or any string).
 * @returns `true` iff `state` is `delivered`, `undelivered`, or `failed`.
 */
export function isMessageStateTerminal(state: MessageStateOrString): boolean {
  return (MESSAGE_STATE_TERMINAL as readonly string[]).includes(state);
}
