# Changelog

All notable changes to `@signalwire/sdk` are documented here. This project
follows [Semantic Versioning](https://semver.org/).

## 2.0.6

Patch on the `2.0.x` maintenance line.

### Fixed

- **RELAY: a redelivered `calling.call.receive` no longer orphans the
  application's `Call`.** `RelayClient._handleInboundCall` constructed a new
  `Call` and wrote it into its call map on every receive event, with no check
  for an entry already there. When RELAY redelivered the event for a call
  already in flight, the live `Call` was evicted, so every later event routed
  to the replacement and the object the application held went silent — an
  awaited `connect()` / `play()` / `record()` hung to its timeout instead of
  resolving at hangup, and the `onCall` handler was entered a second time for
  the same call. Receive is now idempotent per `call_id`: the existing instance
  is kept and the handler is not re-entered. Redeliveries are still ACKed, so
  the server stops retrying. Applications that worked around this by restoring
  the original instance from `client._calls` can drop that code.
  ([cloud-product#20481](https://github.com/signalwire/cloud-product/issues/20481))
