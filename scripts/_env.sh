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
# Prefer the CI image's pinned node if present (matches run-ci's expectation),
# then fall back to whatever node/npm is already on the caller's PATH.
_NODE_BIN="/home/devuser/.config/nvm/versions/node/v24.14.1/bin"
if [ -d "$_NODE_BIN" ]; then
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
