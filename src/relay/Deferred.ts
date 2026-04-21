/**
 * Deferred promise utility — maps Python's asyncio.Future for the RELAY client.
 *
 * Uses a manual promise constructor for Node 18+ compatibility.
 */

/**
 * A promise with externalised `resolve`/`reject` and a `settled` flag,
 * used by the RELAY client to bridge server-push events back to in-flight
 * JSON-RPC request callers.
 */
export interface Deferred<T> {
  /** The wrapped promise. */
  promise: Promise<T>;
  /** Resolve the promise idempotently (later calls are ignored). */
  resolve: (value: T | PromiseLike<T>) => void;
  /** Reject the promise idempotently (later calls are ignored). */
  reject: (reason?: unknown) => void;
  /** True once either `resolve` or `reject` has been called. */
  readonly settled: boolean;
}

/**
 * Create a Deferred<T> with externalized resolve/reject and a settled flag.
 * The `settled` property is true once resolve() or reject() has been called.
 */
export function createDeferred<T>(): Deferred<T> {
  let _resolve!: (value: T | PromiseLike<T>) => void;
  let _reject!: (reason?: unknown) => void;
  let _settled = false;

  const promise = new Promise<T>((res, rej) => {
    _resolve = res;
    _reject = rej;
  });

  return {
    promise,
    resolve: (value: T | PromiseLike<T>) => {
      if (_settled) return;
      _settled = true;
      _resolve(value);
    },
    reject: (reason?: unknown) => {
      if (_settled) return;
      _settled = true;
      _reject(reason);
    },
    get settled() {
      return _settled;
    },
  };
}

/**
 * Race a promise against a timeout. Rejects with an Error if the timeout
 * expires before the promise settles.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Operation',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timer);
        reject(reason);
      },
    );
  });
}
