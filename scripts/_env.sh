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
    echo "       Install it with: python3 -m pip install ruff   (or: brew install ruff)" >&2
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
sw_ruff() {
    local cmd sub
    cmd="$(_sw_ruff_cmd)" || return 1
    sub="$1"
    shift
    # shellcheck disable=SC2086 # $cmd is our own 1-or-3 word command, intentionally split
    ( cd "$REPO" && $cmd "$sub" --config "$REPO/eng/ruff.toml" "$@" )
}
