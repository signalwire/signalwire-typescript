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

# Ensure node 24 is on PATH for vitest/npx/tsx (matches CI image expectation).
NODE_BIN="/home/devuser/.config/nvm/versions/node/v24.14.1/bin"
if [ -d "$NODE_BIN" ]; then
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

# The shared gate scheduler (concurrency + deps + fail-fast). Defines sched_init /
# sched_gate / sched_run and the FAILED_GATES contract.
# shellcheck source=/dev/null
source "$PORTING_SDK_DIR/scripts/gate_scheduler.sh"

cd "$PORT_ROOT"

echo "==> running CI gates for $PORT_NAME (porting-sdk at $PORTING_SDK_DIR)"

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

# GEN-FRESH — the committed src/**/*.types.generated.ts must still match what the
# canonical schemas produce. The ONLY gate that validates the generated types'
# SHAPE. Read-only (--check never writes).
genfresh_gate() {
    PORTING_SDK="$PORTING_SDK_DIR" PORTING_SDK_PATH="$PORTING_SDK_DIR" \
        npx tsx scripts/generate-rest-types.ts --check
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

# ---- register gates ----------------------------------------------------------
sched_init "$@"

# HEAVY (deferred behind the cheap wave for S1 fail-fast).
sched_gate TEST defer=1 desc="scripts/run-tests.sh (vitest)" \
    -- bash "$PORT_ROOT/scripts/run-tests.sh"

# SIGNATURES writes port_signatures.json → DRIFT deps on it. Not deferred: it is a
# writer the cheap DRIFT gate depends on (deferring it would stall the wave).
sched_gate SIGNATURES desc="regenerate port_signatures.json" \
    -- npx tsx scripts/enumerate-signatures.ts

sched_gate DRIFT deps=SIGNATURES desc="diff_port_signatures vs python reference" \
    -- python3 "$PORTING_SDK_DIR/scripts/diff_port_signatures.py" \
        --reference "$PORTING_SDK_DIR/python_signatures.json" \
        --port-signatures "$PORT_ROOT/port_signatures.json" \
        --surface-omissions "$PORT_ROOT/PORT_OMISSIONS.md" \
        --surface-additions "$PORT_ROOT/PORT_ADDITIONS.md" \
        --omissions "$PORT_ROOT/PORT_SIGNATURE_OMISSIONS.md" \
        --numeric-monotype

# SURFACE-FRESH + SURFACE-DIFF share port_surface.json → res=surface (mutex).
sched_gate SURFACE-FRESH res=surface desc="check_surface_freshness vs committed port_surface.json" \
    --fn surface_fresh_gate

sched_gate GEN-FRESH desc="generated types match canonical schema (--check)" \
    --fn genfresh_gate

sched_gate GEN-FRESH-TESTS desc="generated REST wire tests match the canonical specs (--check)" \
    -- npx tsx scripts/generate-rest-tests.ts --check

sched_gate SWAIG-COVERAGE desc="every engine SWAIG action emittable (modulo allowlist)" \
    -- python3 "$PORTING_SDK_DIR/scripts/swaig_coverage.py" --check \
        --emission "$PORT_ROOT/src/FunctionResult.ts"

sched_gate NO-CHEAT desc="audit_no_cheat_tests" \
    -- python3 "$PORTING_SDK_DIR/scripts/audit_no_cheat_tests.py" --root "$PORT_ROOT"

sched_gate REST-COVERAGE defer=1 desc="every implemented REST route covered success+error (parity + allowlist)" \
    --fn rest_coverage_gate

sched_gate SPEC-PARITY defer=1 desc="implemented routes == canonical spec (modulo SPEC_IMPLEMENTATION_GAPS.md)" \
    --fn spec_parity_gate

sched_gate EMISSION desc="diff_port_emission vs python oracle" \
    -- python3 "$PORTING_SDK_DIR/scripts/diff_port_emission.py" \
        --dump-cmd "npx tsx scripts/emit-corpus.ts" \
        --port-repo "$PORT_ROOT"

sched_gate SKILL-CONTRACT desc="diff_skill_contracts vs python reference" \
    -- python3 "$PORTING_SDK_DIR/scripts/diff_skill_contracts.py" \
        --dump-cmd "npx tsx scripts/emit-skills.ts" \
        --port-repo "$PORT_ROOT"

sched_gate FMT defer=1 desc="scripts/run-format.sh (local: auto-fix; CI: --check)" \
    -- bash "$PORT_ROOT/scripts/run-format.sh" ${CI:+--check}

sched_gate LINT defer=1 desc="scripts/run-lint.sh (tsc src+examples+tests + eslint)" \
    -- bash "$PORT_ROOT/scripts/run-lint.sh"

sched_gate DOC-AUDIT res=surface desc="audit_docs vs docs_audit_surface.json" \
    --fn docaudit_gate

sched_gate SURFACE-DIFF res=surface desc="diff_port_surface vs python_surface.json" \
    -- python3 "$PORTING_SDK_DIR/scripts/diff_port_surface.py" \
        --reference "$PORTING_SDK_DIR/python_surface.json" \
        --port-surface "$PORT_ROOT/port_surface.json" \
        --omissions "$PORT_ROOT/PORT_OMISSIONS.md" \
        --additions "$PORT_ROOT/PORT_ADDITIONS.md"

sched_gate SWAIG-CLI desc="swaig-test shared mini-contract (verbs/serverless-reject/default-action)" \
    -- python3 "$PORTING_SDK_DIR/scripts/audit_swaig_cli_contract.py" \
        --port typescript \
        --cmd "npx tsx $PORT_ROOT/src/cli/swaig-test.ts" \
        --default-action-argv 'AGENT_FILE_PLACEHOLDER' \
        --has-serverless \
        --serverless-argv 'AGENT_FILE_PLACEHOLDER|--simulate-serverless|bogus-platform-xyz' \
        --agent-file-suffix '.ts' \
        --agent-file-content "import { AgentBase } from '$PORT_ROOT/src/AgentBase.ts'; const a = new AgentBase({ name: 'probe', route: '/' }); a.setPromptText('hi'); export default a;"

sched_run
rc=$?
if [ "$rc" -eq 0 ]; then
    echo "==> CI PASS"
else
    echo "==> CI FAIL (gates:$FAILED_GATES )"
fi
exit "$rc"
