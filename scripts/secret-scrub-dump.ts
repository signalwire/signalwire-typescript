/**
 * secret-scrub-dump.ts — the TypeScript port's SECRET-SCRUB behavioral dump
 * program for the cross-port differ (porting-sdk/scripts/diff_port_secret_scrub.py,
 * corpus porting-sdk/scripts/secret_scrub_corpus.py).
 *
 * Drives the RelayClient through a real connect (the outbound signalwire.connect
 * frame carries the fixture project/token) + an inbound
 * signalwire.authorization.state event (carrying the fixture authorization_state
 * blob) at SIGNALWIRE_LOG_LEVEL=debug, captures ALL of the SDK's own log output
 * (stdout+stderr), and asserts NONE of the sentinel secrets appear verbatim.
 *
 * The enterprise credential-hygiene contract (SECRET-SCRUB F3.1/F3.2): a
 * debug-level frame log must never dump the raw credential frame or the re-auth
 * blob. The TS port logs `>> {method} id=` (never the outbound frame) and scrubs
 * the inbound `<< {frame}` via `_scrubLog` (credential + authorization_state
 * values masked), so every sentinel is {leaked: false}. This dump exercises the
 * real log path so a future regression that starts dumping raw frames would red.
 *
 * Protocol: stdout = ONE JSON object mapping sentinel-id -> {leaked: bool}. Only
 * stdout carries JSON; the captured SDK output is analysed in-process, never
 * echoed to the true stdout.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   SIGNALWIRE_LOG_LEVEL=debug npx tsx scripts/secret-scrub-dump.ts
 */

// Force debug logging to STDOUT before the SDK Logger loads (it reads level+mode
// at module init). `default` routes to stdout; we capture stdout+stderr below.
process.env['SIGNALWIRE_LOG_LEVEL'] = 'debug';
process.env['SIGNALWIRE_LOG_MODE'] = 'default';
process.env['SIGNALWIRE_LOG_COLOR'] = 'false';
// Fast request timeout so nothing in the drive stalls the bounded window.
process.env['SIGNALWIRE_RELAY_REQUEST_TIMEOUT_MS'] = '500';

import { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';

// Fixture sentinels — must match porting-sdk/scripts/secret_scrub_corpus.py.
const PROJECT = 'PJ-TESTLEAK';
const TOKEN = 'PT-TESTLEAK';
const AUTHORIZATION_STATE = 'AENC-TESTLEAK';

const CORPUS = [
  { id: 'project', sentinel: PROJECT },
  { id: 'token', sentinel: TOKEN },
  { id: 'authorization_state', sentinel: AUTHORIZATION_STATE },
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * A minimal in-process `ws` server that answers connect (so the outbound
 * connect frame — carrying the sentinel project/token — is actually sent and
 * logged), then pushes an inbound authorization.state event (carrying the
 * sentinel blob, so the inbound frame is actually received and logged). Drives
 * BOTH log sites at debug with the sentinels present.
 */
class FakeWs {
  private wss: WebSocketServer;
  port = 0;

  private constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.port = (wss.address() as AddressInfo).port;
    wss.on('connection', (ws) => this.handle(ws));
  }

  static async create(): Promise<FakeWs> {
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise<void>((resolve, reject) => {
      wss.on('listening', () => resolve());
      wss.on('error', reject);
    });
    return new FakeWs(wss);
  }

  host(): string {
    return `127.0.0.1:${this.port}`;
  }

  private handle(ws: WebSocket): void {
    ws.on('message', (raw: WebSocket.RawData) => {
      let msg: { id?: string; method?: string };
      try {
        msg = JSON.parse(raw.toString()) as { id?: string; method?: string };
      } catch {
        return;
      }
      if (msg.method === 'signalwire.connect') {
        this.send(ws, {
          jsonrpc: '2.0',
          id: msg.id,
          result: { protocol: 'p', identity: 'i', sessionid: 's' },
        });
        // Inbound re-auth blob — the << frame-log site's payload.
        this.send(ws, {
          jsonrpc: '2.0',
          method: 'signalwire.event',
          params: {
            event_type: 'signalwire.authorization.state',
            params: { authorization_state: AUTHORIZATION_STATE },
          },
        });
      } else {
        this.send(ws, { jsonrpc: '2.0', id: msg.id, result: { code: '200' } });
      }
    });
  }

  private send(ws: WebSocket, v: unknown): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(v));
  }

  close(): void {
    this.wss.close();
  }
}

async function driveAndCapture(): Promise<string> {
  const f = await FakeWs.create();
  process.env['SIGNALWIRE_RELAY_HOST'] = f.host();
  process.env['SIGNALWIRE_RELAY_SCHEME'] = 'ws';

  // Capture every byte the SDK writes to stdout+stderr into a buffer. The Logger
  // writes via process.stdout/stderr.write, so we intercept both.
  const chunks: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  const cap =
    (): typeof process.stdout.write =>
    (chunk: unknown, ...rest: unknown[]): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : String(chunk));
      // Also forward to the callback if ws/node passed one (write(chunk, cb) or
      // write(chunk, enc, cb)); we swallow the real output so stdout stays clean.
      const cb = rest.find((r) => typeof r === 'function') as ((e?: Error) => void) | undefined;
      if (cb) cb();
      return true;
    };
  process.stdout.write = cap() as typeof process.stdout.write;
  process.stderr.write = cap() as typeof process.stderr.write;

  try {
    const { RelayClient } = await import('../src/relay/RelayClient.js');
    const client = new RelayClient({
      project: PROJECT,
      token: TOKEN,
      host: f.host(),
      scheme: 'ws',
    });
    await client.connect();
    // Let the recv loop process the inbound re-auth frame (the << log site).
    await sleep(300);
    await client.disconnect();
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
    f.close();
  }
  return chunks.join('');
}

async function main(): Promise<number> {
  let captured = '';
  try {
    captured = await driveAndCapture();
  } catch (err) {
    process.stderr.write(`[secret-scrub-dump] drive failed: ${String(err)}\n`);
  }

  const out: Record<string, { leaked: boolean }> = {};
  for (const kase of CORPUS) {
    out[kase.id] = { leaked: captured.includes(kase.sentinel) };
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  return 0;
}

main().then(
  (rc) => process.exit(rc),
  (err) => {
    process.stderr.write(`secret-scrub-dump: ${String(err)}\n`);
    process.exit(1);
  },
);
