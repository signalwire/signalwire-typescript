import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Collect ONLY this checkout's own tests. Without an explicit include,
    // vitest's default glob sweeps the entire tree from the project root --
    // which, on a working machine, includes sibling agent worktrees under
    // .claude/worktrees/*. Measured: 955 files collected, of which 816 (85%)
    // belonged to OTHER checkouts, including four copies of every test in
    // this suite, all EXECUTED as part of `npm test`.
    //
    // That is not merely wasted work: those copies are different revisions of
    // the same tests running against THIS checkout's shared resources, so a
    // sibling worktree's content decides whether this repo's suite is green.
    // (It concretely broke SecurityConfig.configFileTls.test.ts, whose fixture
    // dir was cwd-derived and therefore identical across all four copies.)
    //
    // INCLUDE rather than EXCLUDE, deliberately: an exclude list is open by
    // construction -- it only bars the directory shapes we thought to name, so
    // the next stray checkout (a differently-named worktree dir, a vendored
    // copy, a node_modules-nested fixture) silently starts running again, and
    // the failure it causes looks like a flake because it depends on what else
    // happens to be on disk. An include is closed by construction: every test
    // this repo runs lives under tests/, so anything outside it is not ours to
    // run. Verified to collect exactly the same 139 files as before.
    include: ['tests/**/*.test.ts'],
    // Wire CA trust for the TLS capability tests (tests/tls/*) BEFORE the
    // worker forks: this globalSetup runs gen_certs.sh and exports
    // NODE_EXTRA_CA_CERTS so the worker boots trusting the porting-sdk test CA.
    // It is a no-op (and the TLS tests skip) when porting-sdk is not adjacent,
    // and only *adds* a CA to trust, so all other tests are unaffected.
    globalSetup: ['./tests/tls/gen_certs_setup.ts', './tests/rest/mock_server_setup.ts'],
    // Per-TEST timeout stays at vitest's tight 5s default on purpose: a test
    // body should assert, not set up, so 5s is ample and a real hang fails fast.
    //
    // Hooks are different. The mock-backed suites do their fixture work in
    // beforeEach — a WebSocket handshake against the shared mock_relay, which
    // measures ~200ms idle. Under run-ci that is 50x inside the 10s default,
    // yet one hook still blew through it: run-ci schedules gates concurrently,
    // so a starved worker can stall far past any idle-time margin, and when a
    // relay beforeEach dies the client is left connected — with the (Python-
    // mirroring) per-process connection limit that turns ONE slow hook into a
    // cascade of failures in every later test in the file. Raising only the
    // HOOK budget removes that wall-clock cliff without loosening what a test
    // body itself is allowed to take.
    hookTimeout: 60000,
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
