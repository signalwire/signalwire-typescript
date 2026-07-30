#!/usr/bin/env bash
# run-py-format.sh — the PY-FMT entry point for signalwire-typescript (tool: ruff).
#
# Same contract as scripts/run-format.sh, for the hand-written Python that
# prettier cannot see: LOCAL APPLIES, CI RUNS --check.
#
# Modes:
#   bash scripts/run-py-format.sh          # DEFAULT: APPLY — reformat in place.
#   bash scripts/run-py-format.sh --check  # VERIFY-ONLY (CI) — exit non-zero if
#                                          #   anything is unformatted.
#
# Formatting is pinned to ruff's STABLE style by `preview = false` in
# eng/ruff.toml, so a CI --check can never resolve preview formatting a local
# apply did not.
#
# Idempotent: a second run right after the first produces no diff.

set -euo pipefail

# shellcheck source=scripts/_env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"

MODE="apply"
if [ "${1:-}" = "--check" ]; then
    MODE="check"
elif [ -n "${1:-}" ]; then
    echo "usage: $0 [--check]" >&2
    exit 2
fi

if [ "$MODE" = "check" ]; then
    echo "==> PY-FMT check (ruff format --check, read-only) — repo: $REPO"
    sw_ruff format --check "${SW_PY_PATHS[@]}"
else
    echo "==> PY-FMT apply (ruff format) — repo: $REPO"
    sw_ruff format "${SW_PY_PATHS[@]}" >/dev/null
    # Re-check so an apply that somehow left the tree unformatted still fails.
    sw_ruff format --check "${SW_PY_PATHS[@]}"
fi
