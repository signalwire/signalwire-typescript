/**
 * PostPrompt - post-prompt normalization.
 *
 * One conversation can run over voice and over text chat, and both engines
 * deliver "the post-prompt", but not in the same shape. This module absorbs
 * the differences, so an application sees one result whichever engine
 * finished the conversation.
 *
 * | field               | voice                               | chat                                  |
 * | ------------------- | ----------------------------------- | ------------------------------------- |
 * | `app_name`          | `"swml app"`                        | `"ai_chat"`                           |
 * | `conversation_id`   | absent                              | present at top level                  |
 * | full log            | `raw_call_log`                      | `raw_messages`                        |
 * | summary arrives as  | a `summarize_conversation` tool call | a bare `role: assistant` turn in `call_log` |
 * | `post_prompt_data`  | parsed object                       | `{ "raw": "```json ...```" }`         |
 *
 * `conversation_type` tells them apart on both. The voice engine also sends a
 * third `post_prompt_data` shape, the object wrapped in a list under `parsed`
 * (`{ "parsed": [ {...} ], "raw": "..." }`), which misses every field lookup
 * unless handled.
 *
 * Parsing is schema-agnostic: what a summary contains is whatever the
 * application's post-prompt asked the model for, returned as found. Nothing
 * here throws; the conversation that produced the input is already over.
 * Mirrors signalwire-python's `signalwire.core.post_prompt`.
 */

/**
 * Roles that are actual dialogue. Everything else in a call log is machinery:
 * `system` is the prompt, `system-log` is lifecycle and step tracing, `tool` is
 * function output, and `assistant-manual` is filler speech.
 */
export const DIALOGUE_ROLES: readonly string[] = Object.freeze(['user', 'assistant']);

/** One user or assistant turn: `{ role, content }`. */
export type DialogueTurn = Record<'role' | 'content', string>;

/** One finished conversation leg, in a shape that doesn't vary by engine. */
export class NormalizedPostPrompt {
  /** `conversation_type` as reported, e.g. `voice` or `chat`; '' when the engine didn't say. */
  readonly medium: string = '';
  /**
   * Present on chat, absent on voice; null when the engine didn't supply one.
   * Callers that need a stable key should fall back to their own (global
   * data, the call id) rather than treat this as authoritative.
   */
  readonly conversationId: string | null = null;
  /**
   * The parsed `post_prompt_data`, with whatever keys the post-prompt asked
   * for; `{}` when there was none or it couldn't be parsed. A model that
   * answered in prose instead of JSON yields `{ summary: '<the prose>' }`.
   */
  readonly summary: Record<string, unknown> = {};
  /** User and assistant turns only, with tool calls and the chat engine's summary echo removed. */
  readonly dialogue: readonly DialogueTurn[] = [];
  /** The platform call id, when present. */
  readonly callId: string | null = null;
  /** The complete request body, untouched. */
  readonly raw: Record<string, unknown> = {};

  /**
   * @param fields - Field values; any left out take the empty defaults above.
   *   {@link normalizePostPrompt} is the usual way to get one.
   */
  constructor(fields: Partial<NormalizedPostPrompt> = {}) {
    Object.assign(this, fields);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether a JSON value carries anything: an empty array or object counts as absent. */
function present(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return Boolean(value);
}

/**
 * Unwrap ```` ```json ... ``` ```` fencing. The chat engine hands the model's
 * answer back verbatim, fence and all, where the voice engine parses it first.
 * @param text - The text to unwrap.
 * @returns The text without a surrounding code fence.
 */
export function stripJsonFence(text: string): string {
  let stripped = (text ?? '').trim();
  if (stripped.startsWith('```')) {
    stripped = stripped.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');
  }
  return stripped.trim();
}

/** The object inside a `{ parsed: [...] }` wrapper, if there is one. */
function unwrapParsed(data: Record<string, unknown>): Record<string, unknown> | null {
  const parsed = data['parsed'];
  if (isPlainObject(parsed)) return parsed;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (isPlainObject(item) && Object.keys(item).length > 0) return item;
    }
  }
  return null;
}

/**
 * `post_prompt_data` as a plain object, whichever shape it arrived in. Never
 * throws: a malformed summary degrades to `{}` rather than failing the request
 * that delivered it.
 * @param data - The `post_prompt_data` value from a post-prompt body.
 * @returns The summary object, or `{}` when there's nothing usable.
 */
export function parsePostPromptData(data: unknown): Record<string, unknown> {
  if (!isPlainObject(data)) return {};
  const unwrapped = unwrapParsed(data);
  if (unwrapped && Object.keys(unwrapped).length > 0) return unwrapped;

  // Flat shape: real keys already present (anything but raw/parsed).
  const flat = Object.fromEntries(
    Object.entries(data).filter(([k]) => k !== 'raw' && k !== 'parsed'),
  );
  if (Object.keys(flat).length > 0) return flat;

  const raw = data['raw'];
  if (typeof raw !== 'string' || !raw.trim()) return {};
  const unfenced = stripJsonFence(raw);
  let loaded: unknown;
  try {
    loaded = JSON.parse(unfenced);
  } catch {
    // Prose instead of JSON. Still a summary.
    return { summary: unfenced };
  }
  return isPlainObject(loaded) ? loaded : { summary: String(loaded) };
}

/**
 * The real dialogue from a call log: turns in `roles` with content, dropping
 * entries that carry `tool_calls`.
 *
 * `dropEcho` is for one engine behavior: the chat engine appends its own
 * post-prompt output to `call_log` as a bare `role: assistant` turn with no
 * `tool_calls`, indistinguishable from real speech by role. It's identifiable
 * only by content (identical to `post_prompt_data.raw`), which is what this
 * compares against. The voice engine sends the same thing as a
 * `summarize_conversation` tool call, which the `tool_calls` check removes.
 *
 * @param callLog - The log (`call_log`, `raw_call_log` or `raw_messages`).
 * @param opts - `roles` to keep (default {@link DIALOGUE_ROLES}); `dropEcho`,
 *   exact content to treat as the summary echo and drop.
 * @returns The turns, in order.
 */
export function dialogueTurns(
  callLog: unknown,
  opts: { roles?: readonly string[]; dropEcho?: string | null } = {},
): DialogueTurn[] {
  if (!Array.isArray(callLog)) return [];
  const roles = opts.roles ?? DIALOGUE_ROLES;
  const echo = (opts.dropEcho ?? '').trim();
  const out: DialogueTurn[] = [];
  for (const entry of callLog) {
    if (!isPlainObject(entry)) continue;
    const role = entry['role'];
    if (typeof role !== 'string' || !roles.includes(role)) continue;
    if (present(entry['tool_calls'])) continue;
    const content = entry['content'];
    if (typeof content !== 'string' || !content.trim()) continue;
    if (echo && content.trim() === echo) continue;
    out.push({ role, content });
  }
  return out;
}

/**
 * Normalize a post-prompt body from either engine. Never throws; a body it
 * can't make sense of yields a result with empty fields.
 * @param body - The complete post-prompt request body.
 * @returns The normalized leg.
 *
 * @example
 * ```ts
 * const leg = normalizePostPrompt(rawData);
 * if (leg.dialogue.length) store(leg.conversationId, leg.medium, leg.summary, leg.dialogue);
 * ```
 */
export function normalizePostPrompt(body: unknown): NormalizedPostPrompt {
  if (!isPlainObject(body)) return Object.freeze(new NormalizedPostPrompt());

  const ppd = body['post_prompt_data'];
  // The echo is the RAW string the engine returned (the turn carries the fence too).
  const rawSummary = isPlainObject(ppd) && typeof ppd['raw'] === 'string' ? ppd['raw'] : '';
  // An empty log counts as absent, so the next key is tried.
  const log = ['call_log', 'raw_call_log', 'raw_messages'].map((k) => body[k]).find(present);
  const text = (v: unknown) => (typeof v === 'string' && v ? v : null);

  return Object.freeze(
    new NormalizedPostPrompt({
      medium: body['conversation_type'] ? String(body['conversation_type']) : '',
      conversationId: text(body['conversation_id']),
      summary: parsePostPromptData(ppd),
      dialogue: dialogueTurns(log, { dropEcho: rawSummary || null }),
      callId: text(body['call_id']),
      raw: body,
    }),
  );
}
