import { webcrypto } from 'node:crypto';

// Polyfill globalThis.crypto for Hono's basicAuth middleware in Node.js test environments
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}
