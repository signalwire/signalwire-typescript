import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Disable file parallelism so mock-backed REST tests
    // (tests/rest/*_mock.test.ts) don't race on the shared
    // mock_signalwire HTTP journal. Per-file overhead is small
    // (~3s for 80 tests) and the existing pure-unit tests are
    // sequential within each file regardless.
    fileParallelism: false,
  },
});
