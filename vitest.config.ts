import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Wire CA trust for the TLS capability tests (tests/tls/*) BEFORE the
    // worker forks: this globalSetup runs gen_certs.sh and exports
    // NODE_EXTRA_CA_CERTS so the worker boots trusting the porting-sdk test CA.
    // It is a no-op (and the TLS tests skip) when porting-sdk is not adjacent,
    // and only *adds* a CA to trust, so all other tests are unaffected.
    globalSetup: ['./tests/tls/gen_certs_setup.ts'],
    // File parallelism is ON: every mock-backed test is session-isolated, so
    // tests across files can run concurrently without racing on the shared
    // singleton mock servers.
    //   - Relay (tests/relay/*_mock.test.ts): the mock_relay journal AND
    //     scenario store are session-scoped by the RELAY handshake `sessionid`.
    //   - REST (tests/rest/*_mock.test.ts): REST is pure request/response with
    //     no handshake, so each test's client uses a unique random project
    //     (`test_proj_<hex>`) => a unique Authorization header. The harness
    //     filters the shared journal by that header (client-side) and the
    //     mock_signalwire scenario store scopes overrides by it (server-side),
    //     so a test only ever sees/consumes its own requests and scenarios.
    // Both verified green + deterministic under `--fileParallelism` across
    // repeated runs. (Pure-unit tests are sequential within each file anyway.)
    fileParallelism: true,
  },
});
