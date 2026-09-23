#!/usr/bin/env bash
# DOC-SURFACE-FRESH — the committed docs_audit_surface.json must match a fresh regen.
#
# THE HOLE THIS CLOSES
# --------------------
# `docs_audit_surface.json` is a COMMITTED artifact that, uniquely among this port's
# surface artifacts, NOTHING READS. Every consumer regenerates it first:
#
#   * .github/workflows/doc-audit.yml — regenerates (step "Enumerate TS-native
#     doc-audit surface") and only then runs audit_docs.py against it.
#   * porting-sdk/scripts/suites/_doc_audit.py — the driver run-ci's DOC-TRUTH gate
#     invokes for this port: it regenerates, audits, and then RESTORES the committed
#     content via TreeGuard so the gate is side-effect-free.
#   * package.json `enumerate:doc-surface` — a writer, not a reader.
#
# So the committed copy is decorative: the live gates never consult it, and the
# DOC-AUDIT restore actively guarantees that running the gate can never refresh it.
# The staleness is structurally self-perpetuating, and it is invisible — the audit
# reports 0 blocking / 0 report-only either way, because it audits the FRESH file.
#
# Measured 2026-08-04: the committed artifact was generated at c278ce2, 314 commits
# behind HEAD (4ecd9f0). A regen was +6811/-584 lines. Audited AS COMMITTED it
# produced 3 blocking unresolved symbols (`includes`, `send`, `trim`) — all of them
# real TS members present in the current source and absent only from the old
# snapshot. That is the trap this gate exists to prevent: those three names look
# exactly like genuine unresolved references, and ledgering them in
# DOC_AUDIT_IGNORE.md would have MASKED a 314-commit-stale artifact behind three
# plausible ignore entries.
#
# This is the same rot SIGNATURES-FRESH was created for ("perl, cpp and java all
# shipped stale signatures, each found only because some unrelated lane happened to
# regenerate"). A committed artifact with no reader and no freshness gate does not
# stay fresh; it goes stale the next week and nobody notices.
#
# THE CHECK
# ---------
#   1. Snapshot the COMMITTED blob (`git show HEAD:docs_audit_surface.json`), never
#      the working tree — a concurrent lane's dirty artifact would make this measure
#      THEIR state, and it would fail GREEN, the direction nobody double-checks.
#   2. Regenerate with the port's OWN enumerator into .sw-tmp via `--output`, so the
#      working tree is never mutated and there is nothing to restore.
#   3. Prove the regen produced a populated artifact (an enumerator that writes
#      nothing and exits 0 is a BROKEN GATE, not a pass).
#   4. Compare with porting-sdk's check_surface_freshness.py, which already strips
#      the volatile `generated_from` / `typescript_version` provenance keys.
#
# There is deliberately no allowlist. A stale doc surface has exactly one correct
# response: regenerate and commit it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PSDK="${PORTING_SDK_PATH:-${PORTING_SDK:-}}"
if [[ -z "$PSDK" ]]; then
    PSDK="$(cd "$PORT_ROOT/../porting-sdk" 2>/dev/null && pwd || true)"
fi
if [[ -z "$PSDK" || ! -f "$PSDK/scripts/check_surface_freshness.py" ]]; then
    echo "[doc-surface-fresh] ERROR: cannot locate porting-sdk (set PORTING_SDK_PATH)." >&2
    exit 2
fi

ARTIFACT="docs_audit_surface.json"
SCRATCH="$PORT_ROOT/.sw-tmp"
mkdir -p "$SCRATCH"
COMMITTED="$SCRATCH/committed_doc_surface.json"
FRESH="$SCRATCH/fresh_doc_surface.json"

# A leftover from a previous run must never be mistaken for this run's output —
# that is precisely how a no-op regen looks clean.
rm -f "$COMMITTED" "$FRESH"
cleanup() { rm -f "$COMMITTED" "$FRESH"; }
trap cleanup EXIT

if ! git -C "$PORT_ROOT" show "HEAD:$ARTIFACT" > "$COMMITTED" 2>/dev/null || [[ ! -s "$COMMITTED" ]]; then
    echo "[doc-surface-fresh] ERROR: \`git show HEAD:$ARTIFACT\` produced nothing." >&2
    echo "[doc-surface-fresh] The committed artifact is the only valid baseline;" >&2
    echo "[doc-surface-fresh] refusing to fall back to the working tree." >&2
    exit 2
fi

echo "[doc-surface-fresh] regenerating doc surface -> $FRESH"
if ! PORTING_SDK_PATH="$PSDK" PORTING_SDK="$PSDK" \
        npx tsx "$PORT_ROOT/scripts/enumerate-doc-surface.ts" --output "$FRESH"; then
    echo "[doc-surface-fresh] ERROR: the doc-surface enumerator failed." >&2
    echo "[doc-surface-fresh] Cannot judge freshness without a successful regen." >&2
    exit 4
fi

# A silently-no-op regen is indistinguishable from "clean" to any check built on
# "did the file change", so prove the enumerator actually produced content first.
if [[ ! -s "$FRESH" ]]; then
    echo "[doc-surface-fresh] ERROR: the regen exited 0 but wrote no/empty file." >&2
    echo "[doc-surface-fresh] A no-op regen is a BROKEN GATE, not a pass." >&2
    exit 3
fi
if ! python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if isinstance(d,dict) and d.get("modules") else 1)' "$FRESH"; then
    echo "[doc-surface-fresh] ERROR: the regen wrote no populated \`modules\` payload." >&2
    echo "[doc-surface-fresh] An enumerator emitting an empty surface is a BROKEN GATE." >&2
    exit 3
fi

exec python3 "$PSDK/scripts/check_surface_freshness.py" \
    --committed "$COMMITTED" --fresh "$FRESH"
