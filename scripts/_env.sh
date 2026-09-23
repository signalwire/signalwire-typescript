#!/usr/bin/env bash
# _env.sh — shared self-bootstrap for the canonical lint/format/test scripts
# (run-format.sh, run-lint.sh, run-tests.sh) AND run-ci.sh.
#
# Source this — do NOT execute it — from the top of each script:
#     source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
#
# It is CWD-independent: it resolves the repo root from THIS file's own path,
# not from $PWD, so the callers work from any directory. It makes the node
# toolchain (npx/tsc/eslint/prettier/vitest) resolvable no matter where the
# caller's shell was set up, and installs dev-deps if node_modules is absent.
#
# Exposes: $REPO (repo root). Fails loud with an install hint if npm is missing.

set -euo pipefail

# Resolve repo root from this script's own location (scripts/ is directly under
# the repo root). Independent of the caller's CWD.
_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$_ENV_DIR")"
export REPO

# --- node toolchain on PATH ---------------------------------------------------
# Prefer a pinned node bin dir when the caller points $SW_NODE_BIN at one
# (local-dev convenience: e.g. an nvm install of node 24), then fall back to
# whatever node/npm is already on the caller's PATH. In CI, actions/setup-node
# puts the right node on PATH, so $SW_NODE_BIN is unset there and the fallback
# is used.
_NODE_BIN="${SW_NODE_BIN:-}"
if [ -n "$_NODE_BIN" ] && [ -d "$_NODE_BIN" ]; then
    export PATH="$_NODE_BIN:$PATH"
fi

# The repo's own installed binaries (prettier, eslint, tsc, vitest, tsx) so we
# never depend on a global install and the exact pinned versions are used.
export PATH="$REPO/node_modules/.bin:$PATH"

# --- fail loud if npm is unavailable -----------------------------------------
if ! command -v npm >/dev/null 2>&1; then
    echo "FATAL: npm not found on PATH." >&2
    echo "       Install Node.js (>=22) — e.g. 'brew install node' or via nvm — then re-run." >&2
    exit 1
fi

# --- install dev-deps if absent ----------------------------------------------
# node_modules is what carries prettier/eslint/tsc/vitest. If it is missing,
# bootstrap it deterministically. Prefer `npm ci` (honors the lockfile) when a
# package-lock.json exists; otherwise `npm install`.
if [ ! -d "$REPO/node_modules" ]; then
    echo "==> node_modules absent; bootstrapping dependencies in $REPO" >&2
    if [ -f "$REPO/package-lock.json" ]; then
        ( cd "$REPO" && npm ci ) || {
            echo "FATAL: 'npm ci' failed in $REPO." >&2
            echo "       Try 'cd $REPO && npm install' manually to see the error." >&2
            exit 1
        }
    else
        ( cd "$REPO" && npm install ) || {
            echo "FATAL: 'npm install' failed in $REPO." >&2
            exit 1
        }
    fi
fi

# --- ruff: the PYTHON half of the lint/format toolchain -----------------------
# This repo is a TypeScript SDK, but it tracks hand-written Python that eslint
# and prettier cannot see. Today that is exactly one file
# (tests/fixtures/scrape-parity/python_extract.py, the scrape-parity reference
# extractor); the gates exist so the NEXT .py file is linted from the day it
# lands rather than starting a new blind spot.
#
# SW_PY_PATHS lists what PY-LINT / PY-FMT cover. Keep it in sync with
# `git ls-files '*.py'` -- a path listed here that no longer exists makes ruff
# fail loud (good), and a .py file NOT listed here is unlinted (bad).
SW_PY_PATHS=("tests/fixtures/scrape-parity/python_extract.py")

# --- PINNED TOOL VERSIONS (local MUST match CI) -------------------------------
# A floating linter version is a green-locally/red-in-CI generator: CI installs
# fresh (newest release) while local runs whatever was installed months ago, so a
# release that adds a rule or changes a format heuristic fails the gate on code
# that never changed. Both halves are pinned to the SAME version:
#   * ruff       -> .github/workflows/{test,nightly}.yml `pip install "ruff==…"`
#   * actionlint -> .github/workflows/{test,nightly}.yml installer version arg
# Bumping either means editing BOTH this file and the workflow(s), and committing
# whatever the new version's findings require in the same commit.
SW_RUFF_VERSION="0.15.21"
SW_ACTIONLINT_VERSION="1.7.12"
export SW_RUFF_VERSION SW_ACTIONLINT_VERSION

# sw_assert_tool_version <label> <wanted> <actual-version-string>
# Fails LOUD on a mismatch. Set SW_ALLOW_TOOL_VERSION_DRIFT=1 to downgrade to a
# warning (for a deliberate local bump-and-reformat run only).
sw_assert_tool_version() {
    local label="$1" wanted="$2" actual="$3"
    case "$actual" in
        *"$wanted"*) return 0 ;;
    esac
    if [ "${SW_ALLOW_TOOL_VERSION_DRIFT:-0}" = "1" ]; then
        echo "WARNING: $label is '${actual:-unknown}', not the pinned $wanted (drift allowed)." >&2
        return 0
    fi
    echo "FATAL: $label on PATH is '${actual:-unknown}', not the pinned $wanted." >&2
    echo "       CI installs exactly $wanted, so a different version here means" >&2
    echo "       local and CI disagree about what passes. Install the pin, or set" >&2
    echo "       SW_ALLOW_TOOL_VERSION_DRIFT=1 for a deliberate bump run (then" >&2
    echo "       update scripts/_env.sh + .github/workflows/*.yml together)." >&2
    return 1
}

# ruff is a NATIVE binary (not an npm package), so it is declared here rather
# than in package.json devDependencies: `python3 -m ruff` when the module is
# importable, else the `ruff` binary on PATH, else fail loud with an install
# hint. Never a silent skip, which would let the gate pass vacuously.
_sw_ruff_cmd() {
    if python3 -c 'import ruff' >/dev/null 2>&1; then
        echo "python3 -m ruff"
        return 0
    fi
    if command -v ruff >/dev/null 2>&1; then
        echo "ruff"
        return 0
    fi
    echo "FATAL: ruff not found (needed to lint/format the Python in this repo)." >&2
    echo "       Install it with: python3 -m pip install ruff==$SW_RUFF_VERSION" >&2
    echo "                   (or: brew install ruff, then verify the version)" >&2
    return 1
}

# sw_ruff <subcommand> <ruff-args…> — run ruff from the repo root with the repo
# config PINNED.
#
# --config is load-bearing, not decoration: the config lives at eng/ruff.toml
# (ROOT-HYGIENE keeps tool config out of a public port's root), and ruff only
# auto-discovers a config by walking UP from the TARGET's directory. Without the
# flag it would silently fall back to its BUILT-IN defaults. Measured on this
# repo's one fixture: the built-in defaults find 0, this config finds 2. A gate
# running the wrong ruleset passes vacuously, which is worse than no gate.
#
# The resolved ruff is ALSO version-asserted against SW_RUFF_VERSION, so a local
# run on a different ruff fails loud here instead of disagreeing with CI silently.
sw_ruff() {
    local cmd sub ver
    cmd="$(_sw_ruff_cmd)" || return 1
    # shellcheck disable=SC2086 # $cmd is our own 1-or-3 word command, intentionally split
    ver="$($cmd --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
    sw_assert_tool_version "ruff" "$SW_RUFF_VERSION" "$ver" || return 1
    sub="$1"
    shift
    # shellcheck disable=SC2086 # $cmd is our own 1-or-3 word command, intentionally split
    ( cd "$REPO" && $cmd "$sub" --config "$REPO/eng/ruff.toml" "$@" )
}
