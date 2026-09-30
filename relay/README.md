# SignalWire RELAY Client

The RELAY client controls live phone calls and SMS/MMS messages from TypeScript. It holds a WebSocket connection to SignalWire and speaks JSON-RPC 2.0 over it. The platform's events become `Call`, `Message` and `Action` objects that you drive with `async`/`await`.

## Quick Start

This program answers every call on the `default` context, plays a greeting and hangs up. It reads its credentials from the environment variables listed in [Environment Variables](#environment-variables):

<!-- snippet: no-run client.run() opens a live WebSocket to SIGNALWIRE_SPACE and runs until SIGINT/SIGTERM; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient, Call } from '@signalwire/sdk';

const client = new RelayClient({
  contexts: ['default'],
});

client.onCall(async (call: Call) => {
  await call.answer();
  const action = await call.play([
    { type: 'tts', params: { text: 'Welcome to SignalWire.' } },
  ]);
  await action.wait();
  await call.hangup();
});

await client.run();
```

`run()` connects, authenticates and reconnects after a dropped connection. Its promise resolves after `SIGINT` or `SIGTERM` shuts the client down.

## Features

The RELAY client provides:

- Reconnection with exponential backoff when you start it with `run()`
- Call control: answer, play, record, collect DTMF and speech, detect answering machines, connect and transfer
- Call features: SIP REFER, fax, tap, stream, pay, transcribe, conferences, rooms, queues, digit bindings and AI sessions
- SMS/MMS messaging: send messages, receive them, and track delivery state
- `Action` objects for long-running operations, with `wait()` and `stop()`, and `pause()`, `resume()` or `volume()` where the operation supports them
- Typed event classes, such as `CallStateEvent` and `PlayEvent`, built from the raw event payloads
- Project/token or JWT authentication
- Context subscription changes at runtime with `receive()` and `unreceive()`
- Limits on active calls per client and on connections per process

## Documentation

These pages cover the client in depth:

- [RELAY Client Guide](docs/guide.md): a tour of calls, actions, events, messaging, reconnection and errors
- [Getting Started](docs/getting-started.md): installation, configuration and a first call
- [Call Methods Reference](docs/call-methods.md): the methods on a `Call` and the `Action` classes they return
- [Events](docs/events.md): event types, typed event classes and state values
- [Messaging](docs/messaging.md): sending and receiving SMS/MMS messages
- [Client Reference](docs/client-reference.md): `RelayClient` options, methods and connection behavior

## Examples

These examples are in the repository. Run them with `npx tsx relay/examples/<file>`:

- [relay-inbound.ts](examples/relay-inbound.ts): answers an inbound call, plays TTS and collects digits
- [relay-outbound.ts](examples/relay-outbound.ts): dials out, runs answering-machine detection and plays a message
- [relay-messaging.ts](examples/relay-messaging.ts): sends an SMS, tracks its delivery and receives inbound messages

## Environment Variables

The client reads these variables. The credential, host and active-call variables apply only when you omit the matching constructor option:

| Variable | Description |
|----------|-------------|
| `SIGNALWIRE_PROJECT_ID` | Project ID for authentication |
| `SIGNALWIRE_API_TOKEN` | API token for authentication |
| `SIGNALWIRE_JWT_TOKEN` | JWT (alternative to project and token) |
| `SIGNALWIRE_SPACE` | Space hostname, such as `example.signalwire.com`. The client uses `relay.signalwire.com` when neither this nor `host` is set. |
| `RELAY_MAX_ACTIVE_CALLS` | Maximum calls one client tracks at once (default 1000) |
| `RELAY_MAX_CONNECTIONS` | Maximum connected `RelayClient` instances per process (default 1) |
| `SIGNALWIRE_RELAY_CA_FILE` | Path to a CA bundle the WebSocket connection trusts, in place of Node's default store |
| `SIGNALWIRE_LOG_LEVEL` | Log level. `debug` logs WebSocket frames, with credential values masked. |
| `SIGNALWIRE_LOG_MODE` | Set to `off` to turn off logging |

The [Client Reference](docs/client-reference.md#environment-variables) lists the variables meant for tests.

## Module Structure

The client's source is in `src/relay/`:

```text
src/relay/
    index.ts                      # Public exports (re-exported by '@signalwire/sdk')
    RelayClient.ts                # WebSocket connection, auth, event routing, reconnect
    Call.ts                       # Call object: call-control methods, Action tracking
    Action.ts                     # Action base class and its subclasses (PlayAction, RecordAction, ...)
    Message.ts                    # SMS/MMS message tracking with wait()
    RelayEvent.ts                 # RelayEvent, typed event subclasses, parseEvent()
    Deferred.ts                   # Promise wrapper used to correlate requests and events
    RelayError.ts                 # Error class for non-2xx RELAY results
    constants.ts                  # Protocol constants, call states, event types
    closedSets.ts                 # CallState, DialState and MessageState types, terminal-state helpers
    normalize.ts                  # Converts flat play items and devices to the wire shape
    types.ts                      # Option and device interfaces
    protocol.types.generated.ts   # Generated wire types for RELAY requests and results
```
