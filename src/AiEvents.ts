/**
 * AI events: what the platform reports during a call, as it happens.
 *
 * With an agent's `event_webhook_url` set, the platform posts each AI event it
 * fires, such as `ai.speech_detect` for each final of what the caller said, to
 * that URL, as `{ event_type, timestamp, project_id, space_id, params: { ...,
 * call_id } }`. `AgentBase.onAiEvent()` and `AgentBase.recordSpeechFinals()`
 * set the URL to the agent's own `/ai_events` endpoint.
 *
 * `ai.speech_detect` carries the final's `text` and, from the recognizer, its
 * `words`: `[{ word, confidence }]`, as heard, before hearing hints and number
 * formatting change the text. A call with `redact_prompt` set doesn't send it
 * unless debug is on.
 */

/** The event a final of the caller's speech fires. */
export const SPEECH_DETECT = 'ai.speech_detect';

/** One word of a final, with the recognizer's confidence. */
export interface SpeechWord {
  /** The word as heard. */
  word: string;
  /** The recognizer's confidence, from 0 to 1. */
  confidence: number;
  [key: string]: unknown;
}

/** What the recognizer heard for one turn of the caller's. */
export interface SpeechFinal {
  /** The final's text. */
  text: string;
  /** Its words with their confidences. */
  words: SpeechWord[];
  /** When the event was sent, in seconds since the epoch. */
  timestamp: unknown;
}

/**
 * The recognizer's finals for each call, newest calls kept.
 *
 * Keeps up to `maxFinals` finals for each of up to `maxCalls` calls, dropping
 * the oldest call's when a new call comes in. The finals live in the process:
 * replicas of an agent each keep their own.
 */
export class SpeechLog {
  /** The most calls to keep finals for. */
  readonly maxCalls: number;
  /** The most finals to keep for one call. */
  readonly maxFinals: number;
  private readonly calls = new Map<string, SpeechFinal[]>();

  /**
   * @param maxCalls - The most calls to keep finals for; the oldest call's go first.
   * @param maxFinals - The most finals to keep for one call.
   */
  constructor(maxCalls = 500, maxFinals = 200) {
    this.maxCalls = maxCalls;
    this.maxFinals = maxFinals;
  }

  /**
   * Keep the final an `ai.speech_detect` event carries; anything else is
   * ignored.
   * @param event - The event, as posted.
   */
  add(event: Record<string, unknown>): void {
    const params = event['params'];
    if (typeof params !== 'object' || params === null || Array.isArray(params)) return;
    const p = params as Record<string, unknown>;
    const callId = p['call_id'];
    const text = p['text'];
    if (typeof callId !== 'string' || typeof text !== 'string') return;
    const words = Array.isArray(p['words'])
      ? (p['words'] as unknown[])
          .filter((w): w is SpeechWord => typeof w === 'object' && w !== null && !Array.isArray(w))
          .map((w) => ({ ...w }))
      : [];
    let finals = this.calls.get(callId);
    if (finals) {
      // The newest call is the last one dropped
      this.calls.delete(callId);
    } else {
      finals = [];
    }
    this.calls.set(callId, finals);
    while (this.calls.size > this.maxCalls) {
      this.calls.delete(this.calls.keys().next().value!);
    }
    finals.push({ text, words, timestamp: event['timestamp'] });
    if (finals.length > this.maxFinals) finals.splice(0, finals.length - this.maxFinals);
  }

  /**
   * A call's finals, oldest first.
   * @param callId - The call.
   * @param since - Only the finals from this time on, in seconds since the epoch.
   * @returns Copies of the finals.
   */
  finals(callId: string, since?: number): SpeechFinal[] {
    let kept = this.calls.get(callId) ?? [];
    if (since !== undefined) {
      kept = kept.filter((f) => typeof f.timestamp === 'number' && f.timestamp >= since);
    }
    return kept.map((f) => ({ ...f, words: f.words.map((w) => ({ ...w })) }));
  }

  /**
   * Drop a call's finals.
   * @param callId - The call.
   */
  forget(callId: string): void {
    this.calls.delete(callId);
  }
}
