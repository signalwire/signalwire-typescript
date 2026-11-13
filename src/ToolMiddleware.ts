/**
 * Tool middleware: code that runs around every tool call.
 *
 * A middleware is `(name, args, rawData, callNext)`. It runs before the
 * handler, and calls `callNext(args, rawData)` to run the rest of the chain and
 * the handler, possibly with changed arguments. What it returns is the call's
 * result, so it can return the handler's, change it, or answer without calling
 * `callNext` at all. `callNext` returns a promise of the handler's result, so
 * a middleware awaits it (or returns it as it is).
 *
 * The SDK puts one middleware first in every chain, unless it's turned off
 * (`setToolResendDedupe(false)`): {@link ResendDedupe}, which keeps a transport
 * retry from running a tool twice. SignalWire sends a tool request again, with
 * the same body, after a timeout, a failed connection or a 5xx, so a slow tool
 * can run twice. The retry carries the same `tool_call_id`; a call the model
 * makes again gets a new one.
 */

/** The rest of the chain, as a middleware calls it. */
export type CallNext = (
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
) => Promise<unknown>;

/** A tool middleware. */
export type ToolMiddleware = (
  name: string,
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
  callNext: CallNext,
) => unknown;

/**
 * `value`, awaited when it's a promise. `callNext` always returns a promise in
 * TypeScript, so a middleware can simply `await callNext(...)`; this is the
 * reference's `resolve()` for code ported from it.
 * @param value - A value or a promise of one.
 * @returns The value.
 */
export async function resolve<T>(value: T | Promise<T>): Promise<T> {
  return await value;
}

/**
 * Run `middleware` in order around `dispatch`.
 * @param middleware - The chain, outermost first.
 * @param name - The tool's name.
 * @param args - The arguments.
 * @param rawData - The SWAIG request.
 * @param dispatch - The handler's end of the chain.
 * @returns The call's result.
 */
export async function runChain(
  middleware: readonly ToolMiddleware[],
  name: string,
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
  dispatch: CallNext,
): Promise<unknown> {
  let call: CallNext = dispatch;
  for (const layer of [...middleware].reverse()) {
    const next = call;
    call = async (a, r) => await layer(name, a, r, next);
  }
  return await call(args, rawData);
}

/**
 * The middleware that answers a transport retry of a tool call with the first
 * attempt's result, instead of running the tool again.
 *
 * A call is the same when its `call_id`, `tool_call_id` and function name are.
 * A retry that arrives while the first attempt is still running, as after a
 * timeout, waits for it; one that arrives after it finished gets its result. A
 * call without a `tool_call_id` always runs. Finished results are kept for
 * `ttl` seconds, at most `maxEntries` of them; an attempt still running is
 * never dropped, so a retry of it never runs the tool again. A first attempt
 * whose middleware threw isn't kept, so a retry runs the tool; a handler that
 * threw has an outcome (it's unknown), which is kept like any other.
 *
 * The state lives in the process: replicas of an agent each keep their own.
 */
export class ResendDedupe {
  /** How long a finished result is kept, in seconds. */
  readonly ttl: number;
  /** The most finished results kept. */
  readonly maxEntries: number;
  /** Attempts still running, by key. */
  private readonly pending = new Map<string, Promise<unknown>>();
  /** Finished results, oldest first, by key. */
  private readonly done = new Map<string, { at: number; result: unknown }>();

  /**
   * @param ttl - How long a finished result is kept, in seconds. Default 600.
   * @param maxEntries - The most finished results kept. Default 1024.
   */
  constructor(ttl = 600, maxEntries = 1024) {
    this.ttl = ttl;
    this.maxEntries = maxEntries;
  }

  /** This dedupe as a {@link ToolMiddleware}. */
  readonly middleware: ToolMiddleware = (name, args, rawData, callNext) =>
    this.handle(name, args, rawData, callNext);

  /**
   * Run a call, or answer a retry of one from its first attempt.
   * @param name - The tool's name.
   * @param args - The arguments.
   * @param rawData - The SWAIG request.
   * @param callNext - The rest of the chain.
   * @returns The call's result.
   */
  async handle(
    name: string,
    args: Record<string, unknown>,
    rawData: Record<string, unknown>,
    callNext: CallNext,
  ): Promise<unknown> {
    const key = dedupeKey(name, rawData);
    if (key === null) return await callNext(args, rawData);
    this.expire();
    const finished = this.done.get(key);
    if (finished) return finished.result;
    const running = this.pending.get(key);
    if (running) return await running;
    const attempt = callNext(args, rawData);
    this.pending.set(key, attempt);
    try {
      const result = await attempt;
      this.done.delete(key);
      this.done.set(key, { at: Date.now(), result });
      this.expire();
      return result;
    } finally {
      // Kept as finished, or not at all when it threw: a retry runs the tool
      this.pending.delete(key);
    }
  }

  /** Drop finished results past their time, and the oldest beyond the limit. */
  private expire(): void {
    const cutoff = Date.now() - this.ttl * 1000;
    for (const [key, entry] of this.done) {
      if (entry.at > cutoff && this.done.size <= this.maxEntries) break;
      this.done.delete(key);
    }
  }
}

function dedupeKey(name: string, rawData: Record<string, unknown> | undefined): string | null {
  if (!rawData || typeof rawData !== 'object') return null;
  const toolCallId = rawData['tool_call_id'];
  if (typeof toolCallId !== 'string' || !toolCallId) return null;
  const callId = rawData['call_id'];
  return JSON.stringify([typeof callId === 'string' ? callId : '', toolCallId, name]);
}
