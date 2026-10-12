import { CallSessionStore } from '../../src/prefabs/CallSessionStore.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('CallSessionStore', () => {
  it('returns the same state for a call until it is deleted', () => {
    const store = new CallSessionStore<{ n: number }>();
    const a = store.getOrCreate('a', () => ({ n: 1 }));
    a.n = 2;
    expect(store.getOrCreate('a', () => ({ n: 99 })).n).toBe(2);
    expect(store.delete('a')).toBe(true);
    expect(store.getOrCreate('a', () => ({ n: 99 })).n).toBe(99);
  });

  it('evicts the least recently used call past the entry limit', () => {
    const store = new CallSessionStore<string>({ maxEntries: 2 });
    store.getOrCreate('a', () => 'a');
    store.getOrCreate('b', () => 'b');
    store.getOrCreate('a', () => 'a2'); // touch a, so b is now the oldest
    store.getOrCreate('c', () => 'c');
    expect(store.size).toBe(2);
    expect(store.getOrCreate('a', () => 'new')).toBe('a');
    expect(store.getOrCreate('b', () => 'new')).toBe('new');
  });

  it('drops calls idle past the age limit, measured from their last use', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const store = new CallSessionStore<string>({ maxIdleMs: 1000 });
    store.getOrCreate('idle', () => 'idle');
    store.getOrCreate('busy', () => 'busy');
    vi.setSystemTime(Date.now() + 800);
    store.getOrCreate('busy', () => 'x');
    vi.setSystemTime(Date.now() + 800);
    expect(store.getOrCreate('busy', () => 'x')).toBe('busy');
    expect(store.size).toBe(1);
    expect(store.getOrCreate('idle', () => 'fresh')).toBe('fresh');
  });
});
