#!/usr/bin/env bash
# run-lint.sh — CANONICAL linter for signalwire-typescript (tsc + eslint).
#
# This is the single entry point for linting. Do NOT call tsc/eslint directly;
# run-ci, agents, and humans all go through this script. It self-bootstraps its
# tool environment (via scripts/_env.sh) and runs from ANY directory.
#
# Runs the type floor (tsc --noEmit over src + examples + tests) and eslint over
# every source + example tree with --max-warnings 0, plus the file-level
# no-explicit-any-disable honesty guard and the TS-idiom checks. Exits non-zero
# on any finding.
#
#   --fix   pass through to eslint --fix (autofix where supported); tsc has no
#           autofix and still runs report-only.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"

cd "$REPO"

FIX=0
if [ "${1:-}" = "--fix" ]; then
    FIX=1
fi

# tsc runs over BOTH tsconfigs (default=src, and tsconfig.examples.json — the
# examples have their own config), plus tsconfig.test.json (src+tests strict).
npx tsc --noEmit || exit 1
npx tsc --noEmit --project tsconfig.examples.json || exit 1
npx tsc --noEmit --project tsconfig.test.json || exit 1

# eslint over EVERY tree (src + tests + all three example trees).
if [ "$FIX" -eq 1 ]; then
    npx eslint --fix src tests examples rest/examples relay/examples --max-warnings 0 || exit 1
else
    npx eslint src tests examples rest/examples relay/examples --max-warnings 0 || exit 1
fi

# Honesty guard: forbid the file-level no-explicit-any disable (hides every
# `any` in a file). Only line-level `eslint-disable-next-line` is allowed.
if grep -rn --include='*.ts' '/\* *eslint-disable .*no-explicit-any' \
    src tests examples rest/examples relay/examples; then
    echo "ERROR: file-level no-explicit-any disable found (use line-level only)" >&2
    exit 1
fi

# TS-idiom guards the type system can't enforce.
npx tsx scripts/check-ts-idioms.ts || exit 1
