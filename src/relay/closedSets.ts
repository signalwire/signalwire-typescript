/**
 * Closed-set string unions for RELAY call command options.
 *
 * Each alias below is a string-literal union of the values the SignalWire
 * platform actually accepts for a given option. The literal union gives editor
 * autocompletion for the known values and turns a typo (`'femal'`, `'CDN'`)
 * into a **compile-time** error; for a `switch` over a state it also enables
 * the `default: const _: never = s` exhaustiveness guard (a newly-added member
 * becomes a build error at every switch that forgot it). The sets are typed
 * **closed** (no `(string & {})` arm): they are finite and knowable, and on a
 * finite set the open arm only *deletes* the typo/exhaustiveness checks — it is
 * the inverse of a Rust `#[non_exhaustive]`, not an analogue (measured with the
 * port's own `tsc`; see PORT_PHILOSOPHY_TYPESCRIPT.md §"genuine splits").
 * `SkillName` ({@link ../skills/SkillName.SkillName}) is the one set left open —
 * custom/third-party skill names are a genuinely *unbounded* input, the single
 * site where "accept any string" is the real contract.
 *
 * Wire boundary: types erase, so the string placed on the wire is identical
 * however the field is typed. A raw `string` off the wire is cast to the closed
 * type once, at the SDK's hydration boundary (the event ctors / `Call` /
 * `Message`), not smeared across every public read.
 *
 * Drift note: these alias *option-bag fields* (e.g. `playTTS(text, { gender })`)
 * and the event state fields. The signature enumerator collapses an inline
 * options object to a single anonymous `__type`, and collapses a literal union
 * to `string`, so the canonical signature is `string` either way — drift stays
 * zero; pure type-level ergonomics with no surface effect.
 */

/**
 * Text-to-speech voice gender for {@link ../relay/Call.Call.playTTS} /
 * {@link ../relay/Call.Call.promptTTS} (`gender` option). The SignalWire
 * platform recognises `"male"` and `"female"`.
 */
export type TtsGender = 'male' | 'female';

/**
 * Fax tone to detect for {@link ../relay/Call.Call.detectFax} (`tone` option):
 * `"CED"` (called-station, answering fax) or `"CNG"` (calling-station,
 * originating fax). Restricts detection to one tone; omit to detect either.
 */
export type FaxTone = 'CED' | 'CNG';

// ─── RELAY lifecycle state vocabularies ──────────────────────────────────
//
// Three *distinct* server-emitted lifecycle vocabularies — a call's
// `calling.call.state`, an outbound dial's `calling.call.dial` `dial_state`,
// and a message's `messaging.state` `message_state`. They are NEVER
// interchangeable: a `'dialing'` is meaningless on a Call, an `'answered'`
// is meaningless on a Message. Each is typed separately below, and *closed*.
//
// These mirror values the SignalWire platform *emits*. They are typed closed
// (literal union, no `(string & {})` arm) because the consumer reads them, and
// the closed union is what carries the forward-compat net: a `switch` with a
// `default: const _: never = s` guard handles an unknown server value at
// runtime AND turns a future added state into a compile error at every switch
// that forgot it (the open arm makes that guard impossible to write — measured).
// A raw wire value that isn't (yet) a known member is still carried losslessly:
// it's a `string` at runtime (types erase), cast to the closed type at the
// hydration boundary, and the `isXStateTerminal` predicates below accept any
// string so they stay safe on a raw field.
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
export type CallState = 'created' | 'ringing' | 'answered' | 'ending' | 'ended';

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
export type DialState = 'dialing' | 'answered' | 'failed';

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
export const MESSAGE_STATE_TERMINAL = [
  'delivered',
  'undelivered',
  'failed',
] as const satisfies readonly MessageState[];

/**
 * True when `state` is a terminal {@link CallState} — i.e. the call has reached
 * `ended` and will emit no further state transitions. Accepts any string (the
 * value off the wire), so it is safe to call on a raw `call_state` field — a
 * wire-reading predicate widens its *parameter*, never the stored field.
 *
 * @param state - A call state (typed {@link CallState} or any wire string).
 * @returns `true` iff `state === 'ended'`.
 */
export function isCallStateTerminal(state: CallState | string): boolean {
  return (CALL_STATE_TERMINAL as readonly string[]).includes(state);
}

/**
 * True when `state` is a terminal {@link DialState} — i.e. the outbound dial
 * has resolved (`answered` or `failed`) and will emit no further dial
 * progress. Accepts any string (the value off the wire).
 *
 * @param state - A dial state (typed {@link DialState} or any wire string).
 * @returns `true` iff `state` is `answered` or `failed`.
 */
export function isDialStateTerminal(state: DialState | string): boolean {
  return (DIAL_STATE_TERMINAL as readonly string[]).includes(state);
}

/**
 * True when `state` is a terminal {@link MessageState} — i.e. the message has
 * reached a final delivery outcome (`delivered`, `undelivered`, or `failed`)
 * and will emit no further `messaging.state` events. Accepts any string (the
 * value off the wire), matching the runtime `MESSAGE_TERMINAL_STATES` check in
 * {@link ../relay/Message.Message}.
 *
 * @param state - A message state (typed {@link MessageState} or any wire string).
 * @returns `true` iff `state` is `delivered`, `undelivered`, or `failed`.
 */
export function isMessageStateTerminal(state: MessageState | string): boolean {
  return (MESSAGE_STATE_TERMINAL as readonly string[]).includes(state);
}
