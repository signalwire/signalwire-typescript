#!/usr/bin/env bash
# run-format.sh — CANONICAL formatter for signalwire-typescript (prettier).
#
# This is the single entry point for formatting. Do NOT call prettier directly;
# run-ci, agents, and humans all go through this script. It self-bootstraps its
# tool environment (via scripts/_env.sh) and runs from ANY directory.
#
# Modes:
#   (default)   APPLY  — `prettier --write`: reformat the tree in place, exit 0
#                        on success even if files changed.
#   --check     VERIFY — `prettier --check`: read-only, exit non-zero if anything
#                        is unformatted. This is the dual-mode CI FMT gate.
#
# Covers both hand-written and generated code across every source + example tree.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"

# Every source + example tree — must match run-ci's FMT gate so a mis-formatted
# rest/examples file can't pass locally and fail in CI.
GLOBS=(
    "src/**/*.ts" "tests/**/*.ts" "scripts/**/*.ts"
    "examples/**/*.ts" "rest/examples/**/*.ts" "relay/examples/**/*.ts"
)

cd "$REPO"

if [ "${1:-}" = "--check" ]; then
    exec npx prettier --check "${GLOBS[@]}"
else
    npx prettier --write "${GLOBS[@]}" >/dev/null
    if ! git diff --quiet 2>/dev/null; then
        echo "(FMT auto-applied formatting to your working tree — review & stage)"
    fi
fi
