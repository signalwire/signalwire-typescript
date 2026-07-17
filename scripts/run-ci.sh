#!/usr/bin/env bash
# run-ci.sh — canonical local-and-CI gate runner for signalwire-typescript.
#
# Same script invoked locally (`bash scripts/run-ci.sh`) AND by the
# GitHub Actions workflow. No drift between local and CI behavior.
#
# The FMT / LINT / TEST gates delegate to the canonical scripts under scripts/
# (the single documented entry points; see RUN_LINT_FORMAT_SPEC in porting-sdk):
#   FMT  → scripts/run-format.sh [--check]   (prettier)
#   LINT → scripts/run-lint.sh               (tsc + eslint)
#   TEST → scripts/run-tests.sh [filter]     (vitest)
# They self-bootstrap their node toolchain (scripts/_env.sh) and run from any CWD.
#
# GATE SCHEDULING (porting-sdk/scripts/gate_scheduler.sh — CI_PERF S1 + S2):
#   Gates no longer run strictly serially. They are registered with their DATA
#   dependencies and run CONCURRENTLY up to a cap (SW_CI_JOBS, default nproc):
#     * S2 concurrent wave: the pure-Python, side-effect-free gates (DRIFT, NO-CHEAT,
#       SWAIG-COVERAGE, EMISSION, SKILL-CONTRACT, SURFACE-DIFF, DOC-AUDIT, SWAIG-CLI,
#       GEN-FRESH) overlap — they share no mutable state.
#     * S1 fail-fast: the heavy gates (TEST, LINT, FMT, REST-COVERAGE, SPEC-PARITY)
#       are deferred behind the cheap wave, so a trivial cheap-gate failure surfaces
#       in seconds. With --fail-fast it aborts the run before TEST even starts.
#   HARD ordering is data-dependency ONLY:
#     * DRIFT reads port_signatures.json that SIGNATURES writes → deps=SIGNATURES.
#     * SURFACE-FRESH (regen+restore) and SURFACE-DIFF (reads) share port_surface.json
#       → res=surface (mutually exclusive; a regen would clobber a concurrent read).
#   Per-gate PASS/FAIL + the final FAILED_GATES tally are preserved exactly; each
#   gate's output is captured and replayed atomically.
#
# Flags:
#   --fail-fast   stop launching new gates at the first failure (local dev loop).
#                 Default: run every gate for a full CI report.
#
# Exit codes:
#   0  all gates passed
#   1  one or more gates failed
#   2  porting-sdk not found (configuration error, distinct from gate failure)
#
# Resolves porting-sdk via $PORTING_SDK or sibling ../porting-sdk/.

set -u
set -o pipefail

PORT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$PORT_ROOT/.sw-tmp"  # repo-local CI scratch (never /tmp)
PORT_NAME="signalwire-typescript"

# Ensure the pinned node is on PATH for vitest/npx/tsx when the caller points
# $SW_NODE_BIN at one (local-dev convenience). In CI, actions/setup-node already
# puts node 24 on PATH, so $SW_NODE_BIN is unset and the existing PATH is used.
NODE_BIN="${SW_NODE_BIN:-}"
if [ -n "$NODE_BIN" ] && [ -d "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$PATH"
fi

resolve_porting_sdk() {
    # PORTING_SDK env var takes precedence. Otherwise expect porting-sdk
    # adjacent to this repo (the canonical layout). The cross-port runner
    # always sets PORTING_SDK, so this fallback only kicks in for
    # direct ``bash scripts/run-ci.sh`` invocations.
    if [ -n "${PORTING_SDK:-}" ] && [ -d "$PORTING_SDK/scripts" ]; then
        echo "$PORTING_SDK"
        return 0
    fi
    if [ -d "$PORT_ROOT/../porting-sdk/scripts" ]; then
        (cd "$PORT_ROOT/../porting-sdk" && pwd)
        return 0
    fi
    return 1
}

PORTING_SDK_DIR="$(resolve_porting_sdk)" || {
    echo "FATAL: porting-sdk not found, clone it adjacent to this repo" >&2
    echo "       (expected $PORT_ROOT/../porting-sdk or \$PORTING_SDK env var)" >&2
    exit 2
}

# Export the resolved path under every name the enumerator scripts read, so the
# tsx subprocesses (enumerate-signatures/surface/doc-surface) find porting-sdk's
# type_aliases.yaml / python_surface.json instead of falling back to a hardcoded
# absolute path. PORTING_SDK is read by enumerate-signatures.ts; PORTING_SDK_PATH
# by enumerate-surface.ts / enumerate-doc-surface.ts. Both pointed here.
export PORTING_SDK="$PORTING_SDK_DIR"
export PORTING_SDK_PATH="$PORTING_SDK_DIR"

# signalwire-python is the oracle source for the Layer-D BEHAVIORAL-* gates
# (diff_port_<surface>.py build the oracle by importing signalwire-python's
# package). Resolve it the same way diff_port_emission.py's _resolve_python_sdk
# does: $PYTHON_SDK env wins, else adjacency next to this repo (CI checks it out
# as a sibling; local dev has it at ~/src/signalwire-python == that same
# adjacency). Passed explicitly via --python-sdk so the gate never depends on the
# caller's ambient sys.path.
if [ -n "${PYTHON_SDK:-}" ] && [ -d "$PYTHON_SDK/signalwire" ]; then
    PYTHON_SDK_DIR="$PYTHON_SDK"
elif [ -d "$PORT_ROOT/../signalwire-python/signalwire" ]; then
    PYTHON_SDK_DIR="$(cd "$PORT_ROOT/../signalwire-python" && pwd)"
else
    PYTHON_SDK_DIR="$PORT_ROOT/../signalwire-python"
fi

# The shared gate scheduler (concurrency + deps + fail-fast). Defines sched_init /
# sched_gate / sched_run and the FAILED_GATES contract.
# shellcheck source=/dev/null
source "$PORTING_SDK_DIR/scripts/gate_scheduler.sh"

cd "$PORT_ROOT"

# Gate-enforcement plan (Part D): typescript's Wave-A red list is burned, so its
# widened (wave-A) gate findings BLOCK rather than report-only. Default OFF here;
# a caller may still set SW_WAVE_A_REPORT_ONLY=1 to inspect the report-only view.
export SW_WAVE_A_REPORT_ONLY="${SW_WAVE_A_REPORT_ONLY:-0}"

echo "==> running CI gates for $PORT_NAME (porting-sdk at $PORTING_SDK_DIR)"
echo "==> wave-A gate findings are ${SW_WAVE_A_REPORT_ONLY:+BLOCKING (SW_WAVE_A_REPORT_ONLY=$SW_WAVE_A_REPORT_ONLY)}"

# ---- gate helper functions (unchanged bodies; run as --fn gates) -------------

pick_free_port() {
    python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'
}

# SURFACE-FRESH — DRIFT only gates Layer A (signatures), so the committed
# port_surface.json can silently rot. Save the committed copy, regenerate in place
# via the surface enumerator (enumerate-surface.ts writes port_surface.json directly,
# like enumerate-signatures.ts — no redirect), compare modulo the generated_from
# git-sha, then always restore the working tree.
surface_fresh_gate() {
    git show HEAD:port_surface.json > "$PORT_ROOT/.sw-tmp/committed_surface.json" 2>/dev/null \
        || cp "$PORT_ROOT/port_surface.json" "$PORT_ROOT/.sw-tmp/committed_surface.json"
    npx tsx scripts/enumerate-surface.ts
    local rc=$?
    if [ "$rc" -ne 0 ]; then
        git checkout -- port_surface.json 2>/dev/null || true
        return "$rc"
    fi
    python3 "$PORTING_SDK_DIR/scripts/check_surface_freshness.py" \
        --committed "$PORT_ROOT/.sw-tmp/committed_surface.json" \
        --fresh "$PORT_ROOT/port_surface.json"
    rc=$?
    git checkout -- port_surface.json 2>/dev/null || true
    return "$rc"
}

# GEN-FRESH family — the committed generated modules must still match what the
# canonical sources produce. The ONLY gates that validate the generated types'
# SHAPE. Read-only (--check never writes). Five separate scripts mirror the other
# ports' fixed 5-command generator contract (REST / RELAY / SWAIG / SWML surfaces).
genfresh_gate() {
    PORTING_SDK="$PORTING_SDK_DIR" PORTING_SDK_PATH="$PORTING_SDK_DIR" \
        npx tsx scripts/generate-rest-types.ts --check
}

genfresh_relay_gate() {
    PORTING_SDK="$PORTING_SDK_DIR" PORTING_SDK_PATH="$PORTING_SDK_DIR" \
        npx tsx scripts/generate-relay-protocol.ts --check
}

genfresh_swaig_gate() {
    PORTING_SDK="$PORTING_SDK_DIR" PORTING_SDK_PATH="$PORTING_SDK_DIR" \
        npx tsx scripts/generate-swaig-payloads.ts --check
}

genfresh_swml_gate() {
    PORTING_SDK="$PORTING_SDK_DIR" PORTING_SDK_PATH="$PORTING_SDK_DIR" \
        npx tsx scripts/generate-swml-verbs.ts --check
}

# REST-COVERAGE — every implemented REST route covered success+error. Self-
# contained: spins its own mock on a free port, runs the rest suite serially, then
# checks the journal.
rest_coverage_gate() {
    local port
    port="$(pick_free_port)" || { echo "could not allocate a free port" >&2; return 1; }
    local mock_pkg_parent="$PORTING_SDK_DIR/test_harness/mock_signalwire"
    export PYTHONPATH="$mock_pkg_parent${PYTHONPATH:+:$PYTHONPATH}"
    python3 -m mock_signalwire --host 127.0.0.1 --port "$port" --log-level error \
        >"$PORT_ROOT/.sw-tmp/rest_cov_mock.$$.log" 2>&1 &
    local mock_pid=$!
    # shellcheck disable=SC2064
    trap "kill $mock_pid 2>/dev/null" RETURN
    # Fail LOUD if the mock dies mid-startup or never becomes healthy — never hang.
    local i ready=0
    for i in $(seq 1 60); do
        if ! kill -0 "$mock_pid" 2>/dev/null; then
            echo "mock_signalwire died on port $port — log:" >&2
            cat "$PORT_ROOT/.sw-tmp/rest_cov_mock.$$.log" >&2
            return 1
        fi
        if python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:$port/__mock__/health',timeout=1)" 2>/dev/null; then
            ready=1
            break
        fi
        sleep 0.5
    done
    if [ "$ready" -ne 1 ]; then
        echo "mock_signalwire on port $port not healthy within 30s" >&2
        return 1
    fi
    python3 -c "import urllib.request; urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:$port/__mock__/journal/reset',method='POST'),timeout=5).read()"
    MOCK_SIGNALWIRE_PORT="$port" npx vitest run tests/rest --no-file-parallelism || return 1
    python3 -m mock_signalwire.rest_coverage \
        --mock-url "http://127.0.0.1:$port" \
        --spec-root "$PORTING_SDK_DIR/rest-apis" \
        --allowlist "$PORTING_SDK_DIR/REST_COVERAGE_BASELINE.md" \
        --allowlist "$PORT_ROOT/REST_COVERAGE_GAPS.md" \
        --gap-baseline "$PORTING_SDK_DIR/REST_COVERAGE_GAP_BASELINE.md"
}

# SPEC-PARITY — implemented routes == canonical spec. route-registry.ts drives the
# live RestClient through a recording fetchImpl and captures every dispatched route.
spec_parity_gate() {
    local mock_pkg_parent="$PORTING_SDK_DIR/test_harness/mock_signalwire"
    export PYTHONPATH="$mock_pkg_parent${PYTHONPATH:+:$PYTHONPATH}"
    local registry
    registry="$(mktemp)"
    # SIGNALWIRE_LOG_MODE=off so the SDK logger doesn't pollute stdout JSON.
    SIGNALWIRE_LOG_MODE=off npx tsx "$PORT_ROOT/scripts/route-registry.ts" >"$registry" 2>/dev/null || {
        rm -f "$registry"; return 1
    }
    python3 "$PORTING_SDK_DIR/scripts/diff_spec_implementation.py" \
        --registry-json "$registry" \
        --gaps "$PORTING_SDK_DIR/SPEC_IMPLEMENTATION_GAPS.md"
    local rc=$?
    rm -f "$registry"
    return $rc
}

# DOC-AUDIT — every symbol referenced in docs/ + examples resolves. Regenerates
# docs_audit_surface.json then audits, restoring it after (side-effect-free).
docaudit_gate() {
    trap 'git checkout -- docs_audit_surface.json 2>/dev/null' RETURN
    PORTING_SDK_PATH="$PORTING_SDK_DIR" npx tsx scripts/enumerate-doc-surface.ts || return 1
    python3 "$PORTING_SDK_DIR/scripts/audit_docs.py" \
        --root "$PORT_ROOT" \
        --surface "$PORT_ROOT/docs_audit_surface.json" \
        --ignore "$PORT_ROOT/DOC_AUDIT_IGNORE.md"
}

# ARTIFACT-DENY — no porting-process artifact may ship inside the PUBLISHED
# package. The git-ls-files proxy over-reports files that are tracked in-repo but
# excluded from the npm package (via package.json "files"); this feeds the REAL
# published listing to artifact_deny.py --listing -. `npm pack --dry-run --json`
# emits the authoritative set the tarball would contain; we extract files[].path.
# --ignore-scripts: skip the prepack build hook during the DRY-RUN listing. prepack
# (npm run build) writes codegen progress to stdout, which would prepend non-JSON to
# the --json output and break the parse below. The file listing derives from
# package.json "files" (dist/**, README) and does not need dist rebuilt to enumerate
# it; the real PACKAGE-SMOKE pack still runs prepack. (stdout must stay pure JSON.)
dayone_artifact_deny() {
    npm pack --dry-run --ignore-scripts --json 2>/dev/null \
        | python3 -c 'import sys,json; [print(f["path"]) for f in json.load(sys.stdin)[0]["files"]]' \
        | python3 "$PORTING_SDK_DIR/scripts/artifact_deny.py" --port typescript --listing -
}

# ---- register gates ----------------------------------------------------------
sched_init "$@"

# HEAVY (deferred behind the cheap wave for S1 fail-fast).
sched_gate TEST defer=1 desc="scripts/run-tests.sh (vitest)" \
    -- bash "$PORT_ROOT/scripts/run-tests.sh"

# ---- Part 5 gate SUITES ------------------------------------------------------
# The former per-gate SIGNATURES/DRIFT/SURFACE-*/GEN-FRESH*/BEHAVIORAL-*/EMISSION/
# ERROR-ENVELOPE/PAGINATION-WIRED/WAIT-LIVENESS/DOC-WIRE/REST-COVERAGE/SPEC-PARITY/
# SKILL-CONTRACT/SWAIG-*/DOC-*/COUNT-CLAIM/ACCESSOR-TRUTH/STATUS-CLAIM/README-INCLUDE/
# SEMVER-DIFF/GEN-TYPE-DEGENERACY/GEN-IDIOM/PACKAGE-*/META-CONSISTENT/ARTIFACT-DENY/
# RELEASE-FRESH/*-LEDGER gates now run under 6 SUITE engines. Each suite emits every
# original gate NAME as a `[SUITE:RULE] ... PASS/FAIL` rule ID (failure identity is
# preserved; allowlists + finding output unchanged). A suite exits nonzero iff any of
# its rules fails. Byte-identity vs the old per-gate path is proven by
# porting-sdk/tests/test_suite_parity*.py. See porting-sdk PART5 plan.
#
# The `--fn` helpers the old gates used (surface_fresh_gate, genfresh_*, docaudit_gate,
# rest_coverage_gate, spec_parity_gate) are reproduced INSIDE the suites, so they are
# no longer defined here.
#
# The former single-gate scheduler features are preserved by the suites internally:
#   * SIGNATURES→DRIFT ordering + the SURFACE-FRESH/SURFACE-DIFF surface mutex live
#     inside the SURFACE suite (it regenerates + git-restores in order).
#   * mixed tiers are split with --rules: PACKAGE + BEHAVIORAL each schedule a per-PR
#     line and a nightly line (their nightly members are broken out below).

# SURFACE (parity spine): SIGNATURES→DRIFT ordered, SURFACE-FRESH/DIFF mutex, SEMVER-
# DIFF, GEN-TYPE-DEGENERACY, GEN-IDIOM (+ ROUTE-COLLISION where scheduled) — all read
# the one enumeration. Not deferred: it writes port_signatures.json that nothing else
# depends on cross-suite, and it is the parity spine (run it in the cheap wave).
sched_gate SURFACE desc="surface parity suite (SIGNATURES/DRIFT/SURFACE-FRESH/SURFACE-DIFF/SEMVER-DIFF/GEN-TYPE-DEGENERACY/GEN-IDIOM)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/surface.py" --port typescript --repo "$PORT_ROOT"

# GEN (regen-from-specs family): the 5 GEN-FRESH rules.
sched_gate GEN defer=1 desc="generated-code freshness suite (GEN-FRESH/-TESTS/-RELAY/-SWAIG/-SWML)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/gen.py" --port typescript --repo "$PORT_ROOT"

# BEHAVIORAL (one Layer-D pass per rule): the per-PR rules. WAIT-LIVENESS (nightly)
# is the separate line below.
sched_gate BEHAVIORAL defer=1 desc="behavioral suite (BEHAVIORAL-*/EMISSION/ERROR-ENVELOPE/PAGINATION-WIRED/DOC-WIRE/REST-COVERAGE/SPEC-PARITY/SKILL-CONTRACT/SWAIG-COVERAGE/SWAIG-CLI)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/behavioral.py" --port typescript --repo "$PORT_ROOT" \
        --rules BEHAVIORAL-WIRE,BEHAVIORAL-SWML,BEHAVIORAL-STATE,BEHAVIORAL-HTTP,BEHAVIORAL-WIRE-RELAY,EMISSION,ERROR-ENVELOPE,PAGINATION-WIRED,DOC-WIRE,REST-COVERAGE,SPEC-PARITY,SKILL-CONTRACT,SWAIG-COVERAGE,SWAIG-CLI

sched_gate BEHAVIORAL-NIGHTLY tier=nightly defer=1 desc="behavioral suite, nightly rules (WAIT-LIVENESS)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/behavioral.py" --port typescript --repo "$PORT_ROOT" \
        --rules WAIT-LIVENESS

# DOC-TRUTH (one markdown walk): DOC-AUDIT/DOC-LINKS/DOC-LANG-PURITY/DOC-ENV/COUNT-CLAIM/
# ACCESSOR-TRUTH/STATUS-CLAIM/README-INCLUDE.
sched_gate DOC-TRUTH res=surface desc="doc-truth suite (DOC-AUDIT/DOC-LINKS/DOC-LANG-PURITY/DOC-ENV/COUNT-CLAIM/ACCESSOR-TRUTH/STATUS-CLAIM/README-INCLUDE)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/doc_truth.py" --port typescript --repo "$PORT_ROOT"

# LEDGER: SUPPRESSION-LEDGER + IGNORE-LEDGER-VERIFY.
sched_gate LEDGER res=dayone desc="ledger governance suite (SUPPRESSION-LEDGER/IGNORE-LEDGER-VERIFY)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/ledger.py" --port typescript --repo "$PORT_ROOT"

# PACKAGE: per-PR rules (ARTIFACT-DENY/RELEASE-FRESH); nightly rules (PACKAGE-SMOKE/
# META-CONSISTENT) on the separate line below.
sched_gate PACKAGE res=dayone desc="package suite, per-PR rules (ARTIFACT-DENY/RELEASE-FRESH)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/package.py" --port typescript --repo "$PORT_ROOT" \
        --rules ARTIFACT-DENY,RELEASE-FRESH

sched_gate PACKAGE-NIGHTLY tier=nightly defer=1 desc="package suite, nightly rules (PACKAGE-SMOKE/META-CONSISTENT)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/package.py" --port typescript --repo "$PORT_ROOT" \
        --rules PACKAGE-SMOKE,META-CONSISTENT

# ---- gates that stay standalone (native toolchains + singletons) -------------
sched_gate NO-CHEAT desc="audit_no_cheat_tests" \
    -- python3 "$PORTING_SDK_DIR/scripts/audit_no_cheat_tests.py" --root "$PORT_ROOT"

sched_gate FMT defer=1 desc="scripts/run-format.sh (local: auto-fix; CI: --check)" \
    -- bash "$PORT_ROOT/scripts/run-format.sh" ${CI:+--check}

sched_gate LINT defer=1 desc="scripts/run-lint.sh (tsc src+examples+tests + eslint)" \
    -- bash "$PORT_ROOT/scripts/run-lint.sh"

# ---- §C1 doc/example/CLI execution gates ------------------------------------
# SNIPPET-COMPILE (tsc --noEmit each doc code fence with the real SDK source
# mapped) + DOC-CLI (probe documented swaig-test invocations against the real
# CLI parser) are cheap → cheap wave, blocking. EXAMPLES-RUN loads/starts the
# shipped examples against the mock (defer, blocking, modulo EXAMPLES_RUN_ALLOW.md).
# SNIPPET-RUN executes each runnable doc snippet via tsx against the shared mock;
# non-program fragments auto-skip and server/live-network snippets carry a
# `<!-- snippet: no-run -->` marker. Blocking (defer wave — it can run several
# server snippets to their timeout).
# SNIPPET-COMPILE / SNIPPET-RUN / EXAMPLES-RUN are the HEAVY doc-execution gates —
# tier=nightly: skipped on per-PR run-ci (they dominate wall time), run blocking by
# the nightly workflow (and by a per-PR run when the diff touches docs/examples, via
# SW_CI_TIER=nightly). DOC-CLI stays per-PR (cheap CLI-parse probe).
sched_gate SNIPPET-COMPILE tier=nightly defer=1 desc="documented code snippets compile against the real SDK" \
    -- python3 "$PORTING_SDK_DIR/scripts/snippet_compile.py" --port typescript --repo "$PORT_ROOT"

sched_gate DOC-CLI desc="documented swaig-test invocations parse against the real CLI" \
    -- python3 "$PORTING_SDK_DIR/scripts/doc_cli.py" --port typescript --repo "$PORT_ROOT"

# DEAD-PUBLIC-ERROR stays standalone (source analysis of exported error types — not a
# doc-truth/behavioral rule). ERROR-ENVELOPE/PAGINATION-WIRED/DOC-WIRE run under the
# BEHAVIORAL suite; DOC-ENV/COUNT-CLAIM/ACCESSOR-TRUTH/STATUS-CLAIM under DOC-TRUTH.
sched_gate DEAD-PUBLIC-ERROR desc="exported error types are raised/caught/user-signalled (no dead error surface)" \
    -- python3 "$PORTING_SDK_DIR/scripts/dead_public_error.py" --port typescript --repo "$PORT_ROOT"

# STRICT-MOCKS: MOCK_RELAY_STRICT=1 makes the mock REJECT an off-contract wire
# frame instead of silently tolerating it, so a doc/example that puts the wrong
# shape on the wire fails loud. Applied to the nightly execution gates.
sched_gate EXAMPLES-RUN tier=nightly defer=1 desc="shipped examples load/start against the mock (modulo EXAMPLES_RUN_ALLOW.md; STRICT-MOCKS: MOCK_RELAY_STRICT=1)" \
    -- env MOCK_RELAY_STRICT=1 python3 "$PORTING_SDK_DIR/scripts/examples_run.py" --port typescript --repo "$PORT_ROOT"

sched_gate SNIPPET-RUN tier=nightly defer=1 desc="documented doc snippets run to a zero exit against the mock (fragments auto-skip; server/live snippets are no-run; STRICT-MOCKS: MOCK_RELAY_STRICT=1)" \
    -- env MOCK_RELAY_STRICT=1 python3 "$PORTING_SDK_DIR/scripts/snippet_run.py" --port typescript --repo "$PORT_ROOT"

# WAIT-LIVENESS runs under BEHAVIORAL-NIGHTLY; SUPPRESSION-LEDGER/IGNORE-LEDGER-VERIFY
# under LEDGER; PACKAGE-SMOKE/META-CONSISTENT/ARTIFACT-DENY/RELEASE-FRESH under PACKAGE
# (+ PACKAGE-NIGHTLY); DOC-LANG-PURITY/DOC-LINKS/README-INCLUDE under DOC-TRUTH;
# GEN-TYPE-DEGENERACY/GEN-IDIOM/SEMVER-DIFF under SURFACE. ROOT-HYGIENE + PUBLIC-JARGON
# stay standalone (source/root analysis, not a suite family).
sched_gate ROOT-HYGIENE res=dayone desc="no audit/scratch clutter tracked at repo root (allowlist ROOT_HYGIENE_ALLOW.md)" \
    -- python3 "$PORTING_SDK_DIR/scripts/root_hygiene.py" --port typescript --repo .
sched_gate PUBLIC-JARGON res=dayone desc="no porting-process jargon in public API surface" \
    -- python3 "$PORTING_SDK_DIR/scripts/public_jargon.py" --port typescript --repo .

sched_run
rc=$?
if [ "$rc" -eq 0 ]; then
    echo "==> CI PASS"
else
    echo "==> CI FAIL (gates:$FAILED_GATES )"
fi
exit "$rc"
