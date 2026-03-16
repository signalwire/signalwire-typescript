/**
 * Mock WebSocket for testing RelayClient without a real connection.
 */

import { EventEmitter } from 'node:events';

export class MockWebSocket extends EventEmitter {
  sent: string[] = [];
  readyState = 1; // OPEN
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }

  close(_code?: number, _reason?: string): void {
    this.closed = true;
    // Emit close event asynchronously
    setImmediate(() => this.emit('close'));
  }

  removeAllListeners(): this {
    super.removeAllListeners();
    return this;
  }

  /** Simulate receiving a JSON message from the server. */
  receiveMessage(msg: Record<string, unknown>): void {
    this.emit('message', JSON.stringify(msg));
  }

  /** Get the last sent JSON message. */
  getLastSent(): Record<string, unknown> | null {
    if (this.sent.length === 0) return null;
    return JSON.parse(this.sent[this.sent.length - 1]);
  }

  /** Get all sent messages as parsed JSON. */
  getAllSent(): Record<string, unknown>[] {
    return this.sent.map((s) => JSON.parse(s));
  }

  /** Find a sent message by method. */
  findSent(method: string): Record<string, unknown> | undefined {
    return this.getAllSent().find((m) => m.method === method);
  }

  /**
   * Auto-respond to the signalwire.connect auth request.
   * Call this after setting up the WS factory on the client.
   */
  autoAuthenticate(protocol = 'test-protocol'): void {
    // Listen for incoming messages and respond to signalwire.connect
    const origSend = this.send.bind(this);
    this.send = (data: string) => {
      origSend(data);
      const msg = JSON.parse(data);
      if (msg.method === 'signalwire.connect') {
        // Respond with success
        setImmediate(() => {
          this.receiveMessage({
            jsonrpc: '2.0',
            id: msg.id,
            result: { protocol, identity: 'test-identity' },
          });
        });
      } else if (msg.method === 'signalwire.ping') {
        // Auto-respond to pings
        setImmediate(() => {
          this.receiveMessage({
            jsonrpc: '2.0',
            id: msg.id,
            result: {},
          });
        });
      }
    };
  }
}
