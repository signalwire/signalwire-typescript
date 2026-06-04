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
    // Disable file parallelism so mock-backed REST tests
    // (tests/rest/*_mock.test.ts) don't race on the shared
    // mock_signalwire HTTP journal. Per-file overhead is small
    // (~3s for 80 tests) and the existing pure-unit tests are
    // sequential within each file regardless.
    fileParallelism: false,
  },
});
