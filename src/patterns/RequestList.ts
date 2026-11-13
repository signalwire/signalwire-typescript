/**
 * What the caller asked for while the agent was busy with something else.
 *
 * A caller in the middle of one task often asks for another: "and can you also
 * check my balance?" Taking it up at once loses the first task; ignoring it
 * loses the second. A tool notes the request, and the agent tells the caller
 * it's noted for right after this. When the first task is done, the step's
 * text, which shows the list, has the agent take up the next one.
 *
 * The list lives in the call's `global_data`, so it lasts for the call and a
 * step's text can show it, as `${global_data.<key>_text}`.
 */

import { FunctionResult } from '../FunctionResult.js';

/** One request the caller made. */
export interface NotedRequest {
  /** The kind of request, one of the app's (it picks the opener). */
  kind: string;
  /** What it's about, in a few words. */
  about: string;
}

/** Options for a {@link RequestList}. */
export interface RequestListOptions {
  /**
   * How the agent opens each kind of request when it takes it up, keyed by
   * kind, with `{about}` for what it's about. A kind without one opens with
   * what it's about.
   */
  openers?: Record<string, string>;
  /** The first line of the list's text. Default "Noted for right after this:". */
  heading?: string;
}

/**
 * The caller's requests to come back to, in the order they asked.
 *
 * @example
 * ```ts
 * const later = new RequestList('later', {
 *   openers: {
 *     balance: 'You also asked about your balance.',
 *     question: 'You had a question: {about}.',
 *   },
 * });
 *
 * agent.setGlobalData(later.defaults());
 * agent.defineTool({
 *   name: 'note_request',
 *   description: 'Note a request to come back to',
 *   parameters: NOTE,
 *   handler: (args, rawData) => later.note(rawData, args.kind, args.about),
 * });
 * ctx.addStep('take_order').setText("Take the caller's order.\n\n${global_data.later_text}");
 * ```
 *
 * A step's text is expanded when the step is entered, so the list it shows is
 * the one from then; the model hears of each new request in the tool result.
 * Return `refreshStep()` with the note to show it at once.
 */
export class RequestList {
  /** The `global_data` key the list is kept under. */
  globalKey: string;
  /** The `global_data` key its text for step text is kept under: `<globalKey>_text`. */
  textKey: string;
  /** How the agent opens each kind of request. */
  openers: Record<string, string>;
  /** The first line of the list's text. */
  heading: string;

  /**
   * @param globalKey - The `global_data` key the list is kept under. Its text
   *   for step text is kept under `<globalKey>_text`.
   * @param opts - `openers` and `heading`.
   */
  constructor(globalKey: string, opts: RequestListOptions = {}) {
    this.globalKey = globalKey;
    this.textKey = `${globalKey}_text`;
    this.openers = { ...(opts.openers ?? {}) };
    this.heading = opts.heading ?? 'Noted for right after this:';
  }

  /**
   * The `global_data` to start a call with, an empty list, so step text that
   * shows it has a value before anything is noted.
   * @returns The global data.
   */
  defaults(): Record<string, unknown> {
    return { [this.globalKey]: [], [this.textKey]: '' };
  }

  /**
   * The requests a call has noted, oldest first, from its request's `global_data`.
   * @param rawData - The call's request.
   * @returns The requests.
   */
  pending(rawData: Record<string, unknown> | null | undefined): NotedRequest[] {
    if (!isRecord(rawData)) return [];
    const globalData = rawData['global_data'];
    const stored = isRecord(globalData) ? globalData[this.globalKey] : undefined;
    if (!Array.isArray(stored)) return [];
    return stored.filter(isRecord).map((r) => ({
      kind: String(r['kind'] ?? ''),
      about: String(r['about'] ?? ''),
    }));
  }

  /**
   * Note a request to come back to, and tell the model so.
   *
   * The model gets "Noted for right after this: <about>.", with a tool prompt to
   * tell the caller and carry on with what it was doing. The same request noted
   * twice is kept once.
   *
   * @param rawData - The noting call's request.
   * @param kind - The kind of request, one of the app's (it picks the opener).
   * @param about - What it's about, in a few words.
   * @param result - A result to add to.
   * @returns The result.
   */
  note(
    rawData: Record<string, unknown> | null | undefined,
    kind: string,
    about: string,
    result?: FunctionResult,
  ): FunctionResult {
    const requests = this.pending(rawData);
    if (!requests.some((r) => r.kind === kind && r.about === about)) {
      requests.push({ kind, about });
    }
    const out = (result ?? new FunctionResult()).setToolResponse(
      `Noted for right after this: ${about}.`,
      "Tell the caller you've noted it for right after this, and carry on " +
        'with what you were doing.',
    );
    return this.store(out, requests);
  }

  /**
   * The oldest request not yet taken up, with its `opener`, or null.
   * @param rawData - The call's request.
   * @returns The request.
   */
  next(
    rawData: Record<string, unknown> | null | undefined,
  ): (NotedRequest & { opener: string }) | null {
    const first = this.pending(rawData)[0];
    return first ? { ...first, opener: this.opener(first) } : null;
  }

  /**
   * Remove the oldest request, once it has been taken up.
   * @param rawData - The call's request.
   * @param result - A result to add to.
   * @returns The result.
   */
  done(
    rawData: Record<string, unknown> | null | undefined,
    result?: FunctionResult,
  ): FunctionResult {
    return this.store(result ?? new FunctionResult(), this.pending(rawData).slice(1));
  }

  /**
   * How the agent opens a request when it takes it up.
   * @param request - The request.
   * @returns The opener.
   */
  opener(request: Partial<NotedRequest>): string {
    const about = String(request.about ?? '');
    const kind = String(request.kind ?? '');
    const template = Object.hasOwn(this.openers, kind) ? this.openers[kind] : undefined;
    return template ? template.replaceAll('{about}', () => about) : about;
  }

  /**
   * The list as step text: the heading and one numbered line a request, or ""
   * when there are none.
   * @param requests - The requests.
   * @returns The text.
   */
  asText(requests: readonly NotedRequest[]): string {
    if (requests.length === 0) return '';
    return [
      this.heading,
      ...requests.map((r, n) => `${n + 1}. ${this.opener(r)}`),
      "When the current task is done, take these up in order, then ask if there's anything else.",
    ].join('\n');
  }

  private store(result: FunctionResult, requests: NotedRequest[]): FunctionResult {
    return result.updateGlobalData({
      [this.globalKey]: requests,
      [this.textKey]: this.asText(requests),
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
