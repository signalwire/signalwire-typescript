#!/usr/bin/env bash
# run-py-lint.sh — the PY-LINT entry point for signalwire-typescript (tool: ruff).
#
# This repo is a TypeScript SDK and its TypeScript is fully covered by
# run-lint.sh (tsc + eslint over src/tests/examples at one flat ruleset). But
# eslint cannot see a .py file, so the hand-written Python this repo tracks was
# linted by nothing.
#
# Today that is exactly one file — tests/fixtures/scrape-parity/python_extract.py,
# the reference HTML→text extractor used to regenerate the scrape-parity
# expected/*.json. The gate is wired anyway so the NEXT .py file added here is
# linted from the day it lands, rather than starting a fresh blind spot.
#
# This is NOT a second, looser tier: eng/ruff.toml mirrors the reference
# implementation's rule selection (signalwire-python/pyproject.toml [tool.ruff])
# exactly, with no per-file-ignores, so the Python here is held to the same bar
# the reference holds its own.
#
# Callable from ANY directory; the tool environment is self-bootstrapped via
# scripts/_env.sh (see porting-sdk/RUN_LINT_FORMAT_SPEC.md).
#
# Modes:
#   bash scripts/run-py-lint.sh          # report; exit non-zero on any finding.
#   bash scripts/run-py-lint.sh --fix    # apply SAFE fixes first, then report.

set -euo pipefail

# shellcheck source=scripts/_env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"

if [ "${1:-}" = "--fix" ]; then
    echo "==> PY-LINT autofix (ruff check --fix, safe only) — repo: $REPO"
    sw_ruff check --fix "${SW_PY_PATHS[@]}" >/dev/null || true
elif [ -n "${1:-}" ]; then
    echo "usage: $0 [--fix]" >&2
    exit 2
fi

echo "==> PY-LINT (ruff check, zero findings) — repo: $REPO"
sw_ruff check "${SW_PY_PATHS[@]}"
