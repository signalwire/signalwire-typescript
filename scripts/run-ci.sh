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

# STRICT-MOCKS (D3, plan 1.2/1.6): 400-default fleet-wide. The mock_signalwire
# (REST) server rejects an off-contract wire body/param with a 400 when
# MOCK_SIGNALWIRE_STRICT=1 — so a typo'd wire key is caught in CI, not silently
# accepted. The vitest TEST gate and every mock the per-test mocktest harness
# spawns inherit this via process.env (mocktest passes `{ ...process.env }` to the
# child). Set here (not just in EXAMPLES/SNIPPET) so the REST wire lock is on for
# the whole suite. A caller may override to 0 to inspect the flag-mode (non-400) view.
export MOCK_SIGNALWIRE_STRICT="${MOCK_SIGNALWIRE_STRICT:-1}"

echo "==> running CI gates for $PORT_NAME (porting-sdk at $PORTING_SDK_DIR)"
echo "==> wave-A gate findings are ${SW_WAVE_A_REPORT_ONLY:+BLOCKING (SW_WAVE_A_REPORT_ONLY=$SW_WAVE_A_REPORT_ONLY)}"


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

# SIGNATURES-FRESH: the signatures analogue of SURFACE-FRESH, and the reason it is
# worth its own gate is that port_signatures.json is not an OUTPUT — it is DRIFT's
# INPUT. diff_port_signatures compares the reference oracle against that file, never
# against this port's source, so a stale artifact makes the whole parity claim a
# comparison against a fiction: it can report clean while the source has diverged.
# Nothing guarded it before (SURFACE-FRESH covers only port_surface.json), and the
# rot was real — perl, cpp and java all shipped stale signatures, each found only
# because some unrelated lane happened to regenerate.
#
# STANDALONE sched_gate, deliberately NOT a rule inside the SURFACE suite table:
# only 8 of the 10 ports invoke suites/surface.py at all — rust and python schedule
# their SURFACE-family gates individually and never read that table — so a rule added
# there would silently skip exactly the two ports nobody would double-check.
#
# res=surface because the regen shells out to this port's enumerator (tsc), the same
# resource class SURFACE declares, so the two never contend. No deps= is needed: it
# regenerates into .sw-tmp/ and reads only the COMMITTED blob (git show HEAD:), so it
# neither consumes nor clobbers another gate's artifact — which also means it is
# immune to SURFACE-FRESH's regenerate-then-git-restore window noted above.
sched_gate SIGNATURES-FRESH res=surface desc="committed port_signatures.json matches a fresh regen" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/_signatures_fresh.py" \
        --port typescript --repo "$PORT_ROOT" --porting-sdk "$PORTING_SDK_DIR"

# TYPE-EROSION: a port may not erase a type the reference DECLARES. compare_param treats
# `any` on EITHER side as matching anything, so a port emitting `any` silently satisfies
# every reference declaration — an unlimited opt-out. ConciergeAgent.hours_of_operation is
# declared optional<dict<string,string>> and go still shipped a bare string, with no gate
# red. RATCHET, not a hard gate: dynamic languages cannot always express a type, so this
# banks the current count and fails only on REGRESSION. Drive the number DOWN; never up.
sched_gate TYPE-EROSION desc="port did not erase a reference-declared param type (ratchet 5)" \
    -- python3 "$PORTING_SDK_DIR/scripts/diff_port_type_erosion.py" --port typescript --repo "$PORT_ROOT" --max 5

# GEN (regen-from-specs family): the 5 GEN-FRESH rules.
sched_gate GEN defer=1 desc="generated-code freshness suite (GEN-FRESH/-TESTS/-RELAY/-SWAIG/-SWML)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/gen.py" --port typescript --repo "$PORT_ROOT"

# BEHAVIORAL (one Layer-D pass per rule): the per-PR rules. WAIT-LIVENESS (nightly)
# is the separate line below.
sched_gate BEHAVIORAL defer=1 desc="behavioral suite (BEHAVIORAL-*/EMISSION/ENVELOPE/ERROR-ENVELOPE/PAGINATION-WIRED/PAGINATION-CORPUS/DOC-WIRE/REST-COVERAGE/SPEC-PARITY/SKILL-CONTRACT/SWAIG-COVERAGE/SWAIG-CLI/SWAIG-HTTP-INVOKE/TLS-VERIFY/CA-VAR/SECRET-SCRUB/SECURE-DEFAULT)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/behavioral.py" --port typescript --repo "$PORT_ROOT" \
        --rules BEHAVIORAL-WIRE,BEHAVIORAL-SWML,BEHAVIORAL-STRICT-RENDER,BEHAVIORAL-STATE,BEHAVIORAL-HTTP,BEHAVIORAL-WIRE-RELAY,EMISSION,ENVELOPE,ERROR-ENVELOPE,PAGINATION-WIRED,PAGINATION-CORPUS,DOC-WIRE,REST-COVERAGE,SPEC-PARITY,SKILL-CONTRACT,SWAIG-COVERAGE,SWAIG-CLI,SWAIG-HTTP-INVOKE,TLS-VERIFY,CA-VAR,SECRET-SCRUB,SECURE-DEFAULT

sched_gate BEHAVIORAL-NIGHTLY tier=nightly defer=1 desc="behavioral suite, nightly rules (WAIT-LIVENESS/RELAY-LIVENESS/SECRET-SCRUB-LIVE)" \
    -- python3 "$PORTING_SDK_DIR/scripts/suites/behavioral.py" --port typescript --repo "$PORT_ROOT" \
        --rules WAIT-LIVENESS,RELAY-LIVENESS,SECRET-SCRUB-LIVE

# TOKEN-INTEROP — property 3 of the SWAIG tool-token contract: a token this port MINTS
# must validate under the REFERENCE's own decoder. SECURE-DEFAULT proves a token is
# minted and the fleet keying check proves the HMAC key; NEITHER sees the base64
# ENVELOPE, so a port could ship correct-key correct-HMAC tokens that no other
# implementation accepts — in production every secure tool call then fails auth. This
# port shipped exactly that (Node's 'base64url' STRIPS padding; the reference's
# urlsafe_b64decode RAISES on a stripped '='), and it was invisible to our own tests
# because Node's base64url DECODER is padding-tolerant, so we round-tripped fine.
# One mint + a pure-python validation → cheap, per-PR (a security property must not
# wait for nightly). Scheduled as its OWN line, not in the BEHAVIORAL suite line
# above, because that line is defer=1 (heavy wave) and this is cheap.
sched_gate TOKEN-INTEROP desc="a token this port mints validates under the reference's decoder (padded urlsafe base64, ':'-signed / '.'-enveloped, hex HMAC keyed by the secret_key string)" \
    -- python3 "$PORTING_SDK_DIR/scripts/diff_port_token_interop.py" --port typescript \
        --mint-cmd "SIGNALWIRE_LOG_MODE=off npx tsx $PORT_ROOT/scripts/token-interop-mint.ts"

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

# PACKAGE-SMOKE-DUAL (TS-2 / r5 B1+G1): the packed tarball must load in BOTH
# module systems — ESM `import` AND CJS `require`. The CJS leg is the B1
# regression guard (the exports map used to lack a require/default condition, so
# require() hard-failed with ERR_PACKAGE_PATH_NOT_EXPORTED). Builds dist (heavy)
# → nightly-tier like PACKAGE-SMOKE for ts/cpp.
sched_gate PACKAGE-SMOKE-DUAL tier=nightly defer=1 desc="packed tarball loads via BOTH import (ESM) and require (CJS)" \
    -- bash "$PORT_ROOT/scripts/package-smoke-dual.sh"

# ---- gates that stay standalone (native toolchains + singletons) -------------
sched_gate NO-CHEAT desc="audit_no_cheat_tests" \
    -- python3 "$PORTING_SDK_DIR/scripts/audit_no_cheat_tests.py" --root "$PORT_ROOT"

sched_gate COORDINATED-PASS desc="a non-main porting-sdk pin must be declared on the PR (Coordinated-With: line or coordinated-pass label)" \
    -- python3 "$PORTING_SDK_DIR/scripts/coordinated_pass.py" --porting-sdk "$PORTING_SDK_DIR"

sched_gate COORDINATED-REFS desc="every coordinated-set checkout (porting-sdk + python oracle + matrix ports) uses PORTING_SDK_REF, not a literal ref" \
    -- python3 "$PORTING_SDK_DIR/scripts/check_coordinated_refs.py" --repo "$PORT_ROOT"

sched_gate ENV-VAR-CONSISTENCY desc="REST base-url override present + custom-CA env vars use the canonical A5 names" \
    -- python3 "$PORTING_SDK_DIR/scripts/env_var_consistency.py" --port typescript --repo "$PORT_ROOT"

sched_gate ACTIONLINT desc="GitHub Actions workflows are valid (no step-level secrets.* in if:, etc.)" \
    -- python3 "$PORTING_SDK_DIR/scripts/actionlint_gate.py" --repo "$PORT_ROOT"

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

# WIRED-MODES (plan 1.6 / D7): the merge-coherence guard. WIRED_MODES.md at the repo
# root lists the load-bearing env/mode lines (strict-mocks exports) that MUST be
# present in THIS run-ci; the checker greps for each and fails loud on a missing one,
# so a future merge can't silently drop a wired mode and ship a green-but-vacuous gate.
sched_gate WIRED-MODES res=dayone desc="load-bearing run-ci modes (WIRED_MODES.md) present — merge-race guard" \
    -- bash -c 'if [ -f "$1/scripts/check_wired_modes.py" ]; then python3 "$1/scripts/check_wired_modes.py" --port typescript --repo "$2"; else echo "[wired-modes] check_wired_modes.py not on porting-sdk main yet — skip-pass (plan-branch dep)"; fi' _ "$PORTING_SDK_DIR" "$PORT_ROOT"

# DOC-SURFACE (plan §6.3): TSDoc coverage floor on the public API surface.
# BLOCKING. The port is at 100.0% (327/327) as of the 2026-07-29 burn and the floor in
# .doc_surface_floor is pinned there, so a newly-undocumented public symbol is a real
# regression with a pinned number to prove it — it must red the run, not print a note.
# Was report-only at graduation, and previously wrapped in a skip-with-pass guard for
# when doc_surface.py still lived only on the porting-sdk plan branch. Both are gone: the
# script is on the pinned PORTING_SDK_REF, and a MISSING gate script must fail, not pass.
sched_gate DOC-SURFACE res=dayone desc="TSDoc coverage floor on the public API surface (100% — blocking; ratchets via .doc_surface_floor)" \
    -- python3 "$PORTING_SDK_DIR/scripts/doc_surface.py" --port typescript --repo "$PORT_ROOT"

# AI-CHAT (task #22, COORDINATED pass ts:ai-chat-client <-> porting-sdk:ai-chat-client):
# wire-behavioral gate for the AIChatClient. Drives scripts/ai-chat-dump.ts through the
# shared ai_chat_corpus against porting-sdk's in-process mock_ai_chat and asserts the
# client speaks the AI Chat JSON-RPC protocol per the vendored spec (ai-chat-specs/
# ai-chat.yaml). The gate script (diff_port_ai_chat.py) + mock live on the porting-sdk
# `ai-chat-client` branch, so during the coordinated pass PORTING_SDK_REF pins that
# branch and the gate runs; on plain main it skip-passes until the branch merges.
sched_gate AI-CHAT desc="AIChatClient speaks the AI Chat protocol per the vendored spec (mock_ai_chat wire-behavioral)" \
    -- bash -c 'if [ -f "$1/scripts/diff_port_ai_chat.py" ]; then python3 "$1/scripts/diff_port_ai_chat.py" --port typescript --dump-cmd "npx tsx $2/scripts/ai-chat-dump.ts"; else echo "[ai-chat] diff_port_ai_chat.py not on porting-sdk main yet — skip-pass (coordinated-branch dep: porting-sdk#118 ai-chat-client)"; fi' _ "$PORTING_SDK_DIR" "$PORT_ROOT"

# GATE-INVENTORY NOTE (plan §2.16): porting-sdk/GATE_INVENTORY.md is generated by
# gen_gate_inventory.py from THIS file — typescript is the canonical reference run-ci
# every other port mirrors. So gates added here (WIRED-MODES, DOC-SURFACE) become part
# of the generated inventory once it is regenerated; a diff of the inventory against
# this file that shows them missing means the inventory is stale, not that this file
# drifted. The strict-mocks lines are load-bearing and declared in WIRED_MODES.md so a
# merge cannot silently drop them: MOCK_SIGNALWIRE_STRICT is exported fleet-wide (D3)
# and MOCK_RELAY_STRICT=1 wraps the EXAMPLES-RUN/SNIPPET-RUN nightly gates.

sched_run
rc=$?
if [ "$rc" -eq 0 ]; then
    echo "==> CI PASS"
else
    echo "==> CI FAIL (gates:$FAILED_GATES )"
fi
exit "$rc"
