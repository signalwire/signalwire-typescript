# WIRED_MODES.md — load-bearing run-ci modes for signalwire-typescript

Each `- ` + backtick-quoted regex below MUST be present in `scripts/run-ci.sh`.
`check_wired_modes.py` (the WIRED-MODES gate, Part 1.6 / D7) greps run-ci for each
and fails loud on any missing one — so a future merge cannot silently drop a
strict-mocks/mode line and ship a green-but-vacuous gate (that is exactly what the
strict-mocks × Part-5 merge race did). Lines that don't match the `- ` + backtick
shape are human documentation, ignored by the checker.

- `MOCK_RELAY_STRICT=1` — RELAY strict mode: the mock_relay server rejects an off-contract RELAY wire frame; the EXAMPLES-RUN and SNIPPET-RUN gates run with it so a bad RELAY key fails loud instead of being silently accepted.
- `export MOCK_SIGNALWIRE_STRICT` — REST 400 strict default (D3): the mock_signalwire (REST) server rejects an off-contract wire body/param with a 400; exported fleet-wide so the vitest TEST gate and every per-test mock inherit it, locking the REST wire.
