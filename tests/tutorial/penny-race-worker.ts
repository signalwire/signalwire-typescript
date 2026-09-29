/**
 * One of several threads that confirm the same proposal at once, for
 * penny-rules.test.ts. Each thread opens its own connection to the same
 * reservation book, waits until every thread is ready, then confirms.
 */

import { parentPort, workerData } from 'node:worker_threads';

import { ReservationStore } from '../../tutorial/full-guardrails-agent/reservations.js';

const { path, now, revision, ready, threads } = workerData as {
  path: string;
  now: number;
  revision: number;
  ready: SharedArrayBuffer;
  threads: number;
};

const store = new ReservationStore(path, () => new Date(now));
const gate = new Int32Array(ready);
Atomics.add(gate, 0, 1);
while (Atomics.load(gate, 0) < threads) Atomics.wait(gate, 0, Atomics.load(gate, 0), 5);
parentPort!.postMessage(store.confirm('call-1', revision).code);
store.close();
