#!/usr/bin/env bash
# run-tests.sh — CANONICAL test runner for signalwire-typescript (vitest).
#
# This is the single entry point for running the test suite. Do NOT call
# `npm test` / `npx vitest` directly; run-ci, agents, and humans all go through
# this script. It self-bootstraps its tool environment (via scripts/_env.sh) and
# runs from ANY directory.
#
# Runs the full vitest suite; exits non-zero on any failure.
#
#   run-tests.sh [filter ...]   optional filter args passed through to vitest so
#                               a caller can run a subset (a filename substring,
#                               a test path, or vitest flags).

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"

cd "$REPO"

exec npx vitest run "$@"
