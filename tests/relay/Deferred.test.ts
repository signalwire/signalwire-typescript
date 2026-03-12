import { describe, it, expect } from 'vitest';
import { createDeferred, withTimeout } from '../../src/relay/Deferred.js';

describe('createDeferred', () => {
  it('creates an unsettled deferred', () => {
    const d = createDeferred<string>();
    expect(d.settled).toBe(false);
  });

  it('resolves and marks settled', async () => {
    const d = createDeferred<number>();
    d.resolve(42);
    expect(d.settled).toBe(true);
    expect(await d.promise).toBe(42);
  });

  it('rejects and marks settled', async () => {
    const d = createDeferred<number>();
    d.reject(new Error('fail'));
    expect(d.settled).toBe(true);
    await expect(d.promise).rejects.toThrow('fail');
  });

  it('ignores double resolve', async () => {
    const d = createDeferred<string>();
    d.resolve('first');
    d.resolve('second');
    expect(await d.promise).toBe('first');
  });

  it('ignores resolve after reject', async () => {
    const d = createDeferred<string>();
    d.reject(new Error('rejected'));
    d.resolve('too late');
    expect(d.settled).toBe(true);
    await expect(d.promise).rejects.toThrow('rejected');
  });

  it('ignores reject after resolve', async () => {
    const d = createDeferred<string>();
    d.resolve('ok');
    d.reject(new Error('too late'));
    expect(await d.promise).toBe('ok');
  });
});

describe('withTimeout', () => {
  it('resolves before timeout', async () => {
    const result = await withTimeout(Promise.resolve('fast'), 1000, 'test');
    expect(result).toBe('fast');
  });

  it('rejects on timeout', async () => {
    const slow = new Promise<string>(() => {}); // never resolves
    await expect(withTimeout(slow, 10, 'slow op')).rejects.toThrow(
      'slow op timed out after 10ms',
    );
  });

  it('propagates rejection before timeout', async () => {
    const failing = Promise.reject(new Error('boom'));
    await expect(withTimeout(failing, 1000, 'test')).rejects.toThrow('boom');
  });

  it('uses default label', async () => {
    const slow = new Promise<string>(() => {});
    await expect(withTimeout(slow, 10)).rejects.toThrow(
      'Operation timed out after 10ms',
    );
  });
});
