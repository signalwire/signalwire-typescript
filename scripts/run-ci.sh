#!/usr/bin/env bash
# run-ci.sh — canonical local-and-CI gate runner for signalwire-typescript.
#
# Same script invoked locally (`bash scripts/run-ci.sh`) AND by the
# GitHub Actions workflow. No drift between local and CI behavior.
#
# Gates (in order, fail-fast):
#   1. vitest run                         — language test runner
#   2. signature regen                    — npx tsx scripts/enumerate-signatures.ts
#   3. drift gate                         — porting-sdk diff_port_signatures.py
#   4. surface-fresh gate                 — porting-sdk check_surface_freshness.py
#                                           (regenerates port_surface.json in place via
#                                            enumerate-surface.ts and fails if the
#                                            committed copy is stale modulo the
#                                            generated_from git-sha; closes the Layer-B-
#                                            not-gated hole — DRIFT gates Layer A only,
#                                            so port_surface.json silently rots)
#  4b. gen-fresh gate                      — generate-rest-types.ts --check
#                                           (regenerates the committed *.types.generated.ts
#                                            from the canonical schemas and fails on any
#                                            mismatch; the ONLY gate that validates the
#                                            generated types' SHAPE — DRIFT can't, since
#                                            ~40% of the Python reference is Dict[str,Any]
#                                            and `any` matches any port type)
#   5. no-cheat gate                      — porting-sdk audit_no_cheat_tests.py
#   6. emission gate                      — porting-sdk diff_port_emission.py
#                                           (byte-compares this port's FunctionResult
#                                            serialisation vs Python's to_dict() over
#                                            the shared 81-entry corpus; closes the
#                                            drift-0 hole the surface gates can't see)
#   7. fmt gate                           — prettier (local: auto-fix; CI: --check)
#   8. lint gate                          — tsc --noEmit + eslint (.golangci-equiv)
#   9. doc-audit gate                     — porting-sdk audit_docs.py
#  10. surface-diff gate                  — porting-sdk diff_port_surface.py
#
# Each gate prints `[GATE-NAME] ... PASS` or `[GATE-NAME] ... FAIL: <reason>`
# Final line: `==> CI PASS` or `==> CI FAIL (gates: <list>)`.
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

FAILED_GATES=""

run_gate() {
    local name="$1"; shift
    local description="$1"; shift
    local logfile
    logfile="$(mktemp)"
    "$@" >"$logfile" 2>&1
    local rc=$?
    if [ "$rc" -eq 0 ]; then
        echo "[$name] $description ... PASS"
        rm -f "$logfile"
        return 0
    fi
    echo "[$name] $description ... FAIL: exit $rc"
    sed 's/^/    /' "$logfile" | tail -40
    rm -f "$logfile"
    FAILED_GATES="$FAILED_GATES $name"
    return $rc
}

cd "$PORT_ROOT"

echo "==> running CI gates for $PORT_NAME (porting-sdk at $PORTING_SDK_DIR)"

# Gate 1: vitest
run_gate "TEST" "npx vitest run" \
    npx vitest run

# Gate 2: signature regen
run_gate "SIGNATURES" "regenerate port_signatures.json" \
    npx tsx scripts/enumerate-signatures.ts

# Gate 3: drift gate
run_gate "DRIFT" "diff_port_signatures vs python reference" \
    python3 "$PORTING_SDK_DIR/scripts/diff_port_signatures.py" \
        --reference "$PORTING_SDK_DIR/python_signatures.json" \
        --port-signatures "$PORT_ROOT/port_signatures.json" \
        --surface-omissions "$PORT_ROOT/PORT_OMISSIONS.md" \
        --surface-additions "$PORT_ROOT/PORT_ADDITIONS.md" \
        --omissions "$PORT_ROOT/PORT_SIGNATURE_OMISSIONS.md" \
        --numeric-monotype  # TS has one numeric type (number); int ≡ float

# Gate 4: surface-fresh — DRIFT only gates Layer A (signatures), so the committed
# port_surface.json can silently rot. Save the committed copy, regenerate in place
# via the surface enumerator (enumerate-surface.ts writes port_surface.json directly,
# like enumerate-signatures.ts — no redirect), compare modulo the generated_from
# git-sha, then always restore the working tree.
surface_fresh_gate() {
    git show HEAD:port_surface.json > /tmp/committed_surface.json 2>/dev/null \
        || cp "$PORT_ROOT/port_surface.json" /tmp/committed_surface.json
    npx tsx scripts/enumerate-surface.ts
    local rc=$?
    if [ "$rc" -ne 0 ]; then
        git checkout -- port_surface.json 2>/dev/null || true
        return "$rc"
    fi
    python3 "$PORTING_SDK_DIR/scripts/check_surface_freshness.py" \
        --committed /tmp/committed_surface.json \
        --fresh "$PORT_ROOT/port_surface.json"
    rc=$?
    git checkout -- port_surface.json 2>/dev/null || true
    return "$rc"
}
run_gate "SURFACE-FRESH" "check_surface_freshness vs committed port_surface.json" \
    surface_fresh_gate

# Gate 4b: gen-fresh — the committed src/**/*.types.generated.ts (+ PlatformContracts
# / relay protocol types) must still match what the canonical schemas produce. This
# is the ONLY gate that validates the generated types' SHAPE: DRIFT can't, because
# ~40% of the Python reference is `Dict[str, Any]` and the drift comparator treats
# `any` as matching any port type — so a generated `Record→named-interface` upgrade
# (or a hand-edit, or a spec change with stale output) sails through DRIFT unchecked.
# Regenerating from the schema and requiring byte-equality is what proves the
# committed types are faithful to their source. Read-only (--check never writes).
genfresh_gate() {
    PORTING_SDK="$PORTING_SDK_DIR" PORTING_SDK_PATH="$PORTING_SDK_DIR" \
        npx tsx scripts/generate-rest-types.ts --check
}
run_gate "GEN-FRESH" "generated types match canonical schema (--check)" genfresh_gate

# Gate 5: no-cheat
run_gate "NO-CHEAT" "audit_no_cheat_tests" \
    python3 "$PORTING_SDK_DIR/scripts/audit_no_cheat_tests.py" --root "$PORT_ROOT"

# Gate 5b: REST-COVERAGE — every canonical REST route the SDK implements must be
# exercised with BOTH a success (2xx) AND an error (4xx/5xx) response on the
# correct on-the-wire path (parity). Measured by replaying the mock journal of a
# REST-suite run through porting-sdk's rest_coverage checker. Accepted gaps —
# routes with no SDK method, malformed canonical routes, mock-router collisions —
# are allowlisted: the shared baseline (porting-sdk/REST_COVERAGE_BASELINE.md) +
# this port's REST_COVERAGE_GAPS.md. A stale entry (route now actually covered)
# fails the gate. Self-contained: spins its own mock, runs the rest suite serially
# against it (MOCK_SIGNALWIRE_PORT so all traffic lands in one journal), then
# checks that journal. Same shape as python's/java's gate.
# Pick a free TCP port on 127.0.0.1 (bind :0, read the OS-assigned port,
# release). Never reuse a hardcoded port — a leftover or concurrent mock
# squatting a fixed port otherwise makes the gate hang on its health poll.
pick_free_port() {
    python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'
}
rest_coverage_gate() {
    local port
    port="$(pick_free_port)" || { echo "could not allocate a free port" >&2; return 1; }
    local mock_pkg_parent="$PORTING_SDK_DIR/test_harness/mock_signalwire"
    export PYTHONPATH="$mock_pkg_parent${PYTHONPATH:+:$PYTHONPATH}"
    python3 -m mock_signalwire --host 127.0.0.1 --port "$port" --log-level error \
        >/tmp/rest_cov_mock.$$.log 2>&1 &
    local mock_pid=$!
    # shellcheck disable=SC2064
    trap "kill $mock_pid 2>/dev/null" RETURN
    # Fail LOUD if the mock dies mid-startup or never becomes healthy — never hang.
    local i ready=0
    for i in $(seq 1 60); do
        if ! kill -0 "$mock_pid" 2>/dev/null; then
            echo "mock_signalwire died on port $port — log:" >&2
            cat "/tmp/rest_cov_mock.$$.log" >&2
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
run_gate "REST-COVERAGE" "every implemented REST route covered success+error (parity + allowlist)" \
    rest_coverage_gate

# Gate 5c: SPEC-PARITY — the routes the SDK actually IMPLEMENTS must equal the
# canonical spec route set, modulo porting-sdk/SPEC_IMPLEMENTATION_GAPS.md. This
# is the spec-first guard REST-COVERAGE can't give: REST-COVERAGE only proves
# *tested* routes match the spec, so a route the SDK implements that the spec
# doesn't define (or vice versa) would slip past it. Set B is built by
# scripts/route-registry.ts — it drives the live RestClient through a recording
# fetchImpl and captures every dispatched (method, path), so it sees every
# implemented route whether or not it's tested (not an AST scrape, not the
# journal). The shared porting-sdk diff consumes that JSON via --registry-json.
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
run_gate "SPEC-PARITY" "implemented routes == canonical spec (modulo SPEC_IMPLEMENTATION_GAPS.md)" \
    spec_parity_gate

# Gate 6: emission — byte-compare FunctionResult serialisation vs the Python
# to_dict() oracle over the shared corpus (scripts/emit-corpus.ts builds the
# native dump). Pure serialisation: no mock servers, no network — just
# signalwire-python adjacent (already required by the drift gate).
run_gate "EMISSION" "diff_port_emission vs python oracle" \
    python3 "$PORTING_SDK_DIR/scripts/diff_port_emission.py" \
        --dump-cmd "npx tsx scripts/emit-corpus.ts" \
        --port-repo "$PORT_ROOT"

# Gate 6b: skill-contract — compare each built-in skill's SWAIG tool contract
# (name/parameters/required/enum from getTools()) against the Python reference.
# The sibling of EMISSION for SKILLS: drift/surface see signatures + symbol
# names, EMISSION sees FunctionResult.to_dict(), but NONE saw a skill's tool
# schema — so a wrong `required`, a renamed/retyped param, or an extra/missing
# tool was drift-0 and invisible. scripts/emit-skills.ts builds the native dump;
# dynamic skills (mcp_gateway/claude_skills/etc.) are excluded + logged by the
# corpus. Same prereqs as EMISSION (signalwire-python adjacent; no network).
run_gate "SKILL-CONTRACT" "diff_skill_contracts vs python reference" \
    python3 "$PORTING_SDK_DIR/scripts/diff_skill_contracts.py" \
        --dump-cmd "npx tsx scripts/emit-skills.ts" \
        --port-repo "$PORT_ROOT"

# Gate 7: FMT — the language format gate (ts: prettier, governed by .prettierrc.json:
# printWidth 100, singleQuote, semi — the house style). Source-style only, proven
# surface/emission-neutral (a reformat leaves port_signatures.json byte-identical).
#   * LOCAL ($CI unset)  → `prettier --write`: reformats your working tree in place.
#   * CI ($CI=true)      → `prettier --check`: read-only, FAILS on any unformatted file.
fmt_gate() {
    # Cover every source + example tree (scripts + all three example dirs), so a
    # mis-formatted rest/examples file can't pass FMT locally and fail in CI.
    local globs=(
        "src/**/*.ts" "tests/**/*.ts" "scripts/**/*.ts"
        "examples/**/*.ts" "rest/examples/**/*.ts" "relay/examples/**/*.ts"
    )
    if [ -n "${CI:-}" ]; then
        npx prettier --check "${globs[@]}"
    else
        npx prettier --write "${globs[@]}" >/dev/null
        if ! git diff --quiet 2>/dev/null; then
            echo "    (FMT auto-applied formatting to your working tree — review & stage)"
        fi
    fi
}
run_gate "FMT" "prettier (local: auto-fix; CI: --check)" fmt_gate

# Gate 8: LINT — the language lint gate (ts: tsc --noEmit type floor + eslint).
# tsc proves the types compile (strict); eslint (.golangci-equivalent: eslint.config.mjs)
# enforces the deeper rule set incl. no-explicit-any=error after the burndown to zero.
# Both blocking. --max-warnings 0 so a warning can't slip through.
#
# tsc runs over BOTH tsconfigs: the default (src) AND tsconfig.examples.json — the
# examples have their own config (the default tsconfig only includes src/**), and
# without the second pass a type error in examples/ slips past LINT locally and
# only fails in the separate doc-audit workflow. Folding it in keeps local==CI.
lint_gate() {
    npx tsc --noEmit || return 1
    npx tsc --noEmit --project tsconfig.examples.json || return 1
    # eslint must cover EVERY example tree (examples/, rest/examples/,
    # relay/examples/), not just the top-level one — a file-level disable or `any`
    # in rest/examples slipped past when only `examples` was linted.
    npx eslint src tests examples rest/examples relay/examples --max-warnings 0 || return 1
    # Honesty guard: a file-level `eslint-disable .../no-explicit-any` switches the
    # rule OFF for the whole file, hiding every `any` from the gate (this exact
    # blind spot once made a "no-explicit-any=0" claim false). Forbid the
    # file-level form outright; only line-level `eslint-disable-next-line` on a
    # justified site is allowed. Generated modules already carry zero disables.
    # Cover EVERY tree eslint lints — not just src; the gap let file-disables hide
    # in tests/ + examples/ (~50 `any`) undetected.
    if grep -rn --include='*.ts' '/\* *eslint-disable .*no-explicit-any' \
        src tests examples rest/examples relay/examples; then
        echo "ERROR: file-level no-explicit-any disable found (use line-level only)" >&2
        return 1
    fi
    # TS-idiom guards the type system can't enforce: no widened typed-callback
    # params, no nested open index signatures in generated types, no dead
    # defensive casts in example demos, generic safe<T> wrappers.
    npx tsx scripts/check-ts-idioms.ts || return 1
}
run_gate "LINT" "tsc (src + examples) + eslint (lint gate)" lint_gate

# Gate 9: DOC-AUDIT — every symbol referenced in docs/ + examples must resolve to a
# real symbol in the doc-surface. Mirrors .github/workflows/doc-audit.yml; folded in
# so local==CI. Regenerates docs_audit_surface.json then audits, restoring it after
# (side-effect-free whether it passes or fails).
docaudit_gate() {
    trap 'git checkout -- docs_audit_surface.json 2>/dev/null' RETURN
    PORTING_SDK_PATH="$PORTING_SDK_DIR" npx tsx scripts/enumerate-doc-surface.ts || return 1
    python3 "$PORTING_SDK_DIR/scripts/audit_docs.py" \
        --root "$PORT_ROOT" \
        --surface "$PORT_ROOT/docs_audit_surface.json" \
        --ignore "$PORT_ROOT/DOC_AUDIT_IGNORE.md"
}
run_gate "DOC-AUDIT" "audit_docs vs docs_audit_surface.json" docaudit_gate

# Gate 10: SURFACE-DIFF — diff the port surface against the Python reference
# (omissions/additions in PORT_OMISSIONS.md / PORT_ADDITIONS.md). SURFACE-FRESH only
# checks the committed surface matches a regen; this checks it MATCHES PYTHON.
# Mirrors .github/workflows/surface-audit.yml.
run_gate "SURFACE-DIFF" "diff_port_surface vs python_surface.json" \
    python3 "$PORTING_SDK_DIR/scripts/diff_port_surface.py" \
        --reference "$PORTING_SDK_DIR/python_surface.json" \
        --port-surface "$PORT_ROOT/port_surface.json" \
        --omissions "$PORT_ROOT/PORT_OMISSIONS.md" \
        --additions "$PORT_ROOT/PORT_ADDITIONS.md"

# Gate 11: SWAIG-CLI — the lightweight shared swaig-test mini-contract (NOT
# python parity; python's in-process simulator surface is reference-only). Black-
# box: invokes this port's swaig-test --help + a couple golden invocations and
# asserts (1) the shared verbs are documented, (2) an unknown --simulate-serverless
# platform errors instead of silently falling back, (3) no-action errors instead
# of a silent default. TS accepts --simulate-serverless (lambda/gcf/azure/cgi), so
# the unknown-platform clause applies.
run_gate "SWAIG-CLI" "swaig-test shared mini-contract (verbs/serverless-reject/default-action)" \
    python3 "$PORTING_SDK_DIR/scripts/audit_swaig_cli_contract.py" \
        --port typescript \
        --cmd "npx tsx $PORT_ROOT/src/cli/swaig-test.ts" \
        --default-action-argv 'AGENT_FILE_PLACEHOLDER' \
        --has-serverless \
        --serverless-argv 'AGENT_FILE_PLACEHOLDER|--simulate-serverless|bogus-platform-xyz' \
        --agent-file-suffix '.ts' \
        --agent-file-content "import { AgentBase } from '$PORT_ROOT/src/AgentBase.ts'; const a = new AgentBase({ name: 'probe', route: '/' }); a.setPromptText('hi'); export default a;"

if [ -z "$FAILED_GATES" ]; then
    echo "==> CI PASS"
    exit 0
else
    echo "==> CI FAIL (gates:$FAILED_GATES )"
    exit 1
fi
