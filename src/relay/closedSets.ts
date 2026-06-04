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
