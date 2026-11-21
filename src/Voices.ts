/**
 * A voice as the platform takes it in every voice field: one
 * `engine.voice:model` string, or a list of them, the first speaking and the
 * rest its fallbacks, tried in order when it fails.
 * @internal
 */

import { _pyRepr as pyRepr, _pyStrip as pyStrip } from './PyCompat.js';

/** @internal The most voices a voice field takes: the one that speaks and its fallbacks. */
export const _MAX_VOICES = 8;

/** A voice field's value: one voice, or a list of up to 8, the first speaking. */
export type VoiceChain = string | readonly string[];

/** A voice, a list of them, or voices by language code (with a `default` entry for the rest). */
export type VoicesByLanguage = VoiceChain | Readonly<Record<string, VoiceChain>>;

/**
 * @internal A voice field's value, checked: a non-empty string, or a list of 1
 * to 8 non-empty strings (a one-item list is kept as a list).
 * @throws {Error} For an empty voice, an empty list, more than 8, or a non-string entry.
 */
export function _voiceChain(value: unknown, what = 'voice'): string | string[] {
  if (typeof value === 'string') {
    if (!pyStrip(value)) throw new Error(`${what} must be a non-empty string, or a list of them`);
    return value;
  }
  if (Array.isArray(value)) {
    const voices = [...(value as unknown[])];
    if (voices.length === 0) throw new Error(`${what} must name at least one voice`);
    if (voices.length > _MAX_VOICES) {
      throw new Error(
        `${what} takes at most ${_MAX_VOICES} voices, the first speaking and the rest its fallbacks; ` +
          `got ${voices.length}`,
      );
    }
    for (const v of voices) {
      if (typeof v !== 'string' || !pyStrip(v)) {
        throw new Error(`each of ${what}'s voices must be a non-empty string, got ${pyRepr(v)}`);
      }
    }
    return voices as string[];
  }
  throw new Error(`${what} must be a string, or a list of up to ${_MAX_VOICES} strings`);
}

/**
 * @internal A voice, a list of them, or an object of language codes (with a
 * `default` entry for the rest) to either.
 * @throws {Error} For an empty mapping, a language that isn't a code, or a bad voice.
 */
export function _voicesByLanguage(
  value: unknown,
  what = 'default_voice',
): string | string[] | Record<string, string | string[]> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) throw new Error(`${what} by language needs at least one language`);
    const out: Record<string, string | string[]> = {};
    for (const [code, voices] of entries) {
      if (!pyStrip(code)) {
        throw new Error(
          `${what}'s languages must be codes such as 'es-MX' or 'default', got ${pyRepr(code)}`,
        );
      }
      // Defined, not assigned: a `__proto__` code is a key like any other
      Object.defineProperty(out, code, {
        value: _voiceChain(voices, `${what}[${pyRepr(code)}]`),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  }
  return _voiceChain(value, what);
}
