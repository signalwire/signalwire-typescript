# ROOT_HYGIENE_ALLOW.md

Repo-root files excused from the `root_hygiene` gate. Each is a LOAD-BEARING
porting-audit contract or artifact file that porting-sdk audit scripts (and this
port's own `scripts/run-ci.sh`) read at the repo root by relative path. Moving
them under `eng/` would break the shared audit pipeline, which this port cannot
edit. See porting-sdk `CLAUDE.md` §5b (the `./PORT_OMISSIONS.md` / `./PORT_ADDITIONS.md`
verify recipe) and the individual audit scripts.

- ROOT_HYGIENE_ALLOW.md — this allowlist itself (the gate reads it at repo root) (orchestrator, 2026-07-06)
- CHECKLIST.md — required audit-contract file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- DOC_AUDIT_IGNORE.md — required audit-contract file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- PORT_ADDITIONS.md — required audit-contract file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- PORT_BEHAVIORAL_NOTES.md — required audit-contract file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- PORT_EXAMPLE_OMISSIONS.md — required audit-contract file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- PORT_OMISSIONS.md — required audit-contract file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- PORT_SIGNATURE_OMISSIONS.md — required audit-contract file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- PORT_TEST_OMISSIONS.md — required audit-contract file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- REST_COVERAGE_GAPS.md — required audit-contract file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- audit_coverage.json — required audit-artifact file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- audit_coverage_baseline.json — required audit-artifact file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- docs_audit_surface.json — required audit-artifact file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- port_signatures.json — required audit-artifact file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
- port_signatures.baseline.json — release-floor artifact read at repo root by porting-sdk semver_diff.py (SEMVER-DIFF gate) (mike@signalwire.com, 2026-07-13)
- port_surface.json — required audit-artifact file read by porting-sdk audit scripts (orchestrator, 2026-07-06)

## Gate allowlist files (each read by its gate at repo root)

- EXAMPLES_RUN_ALLOW.md — allowlist read by the examples_run (EXAMPLES-RUN) gate at repo root (approver: user, 2026-07-09)
- SNIPPET_RUN_ALLOW.md — allowlist read by the snippet_run (SNIPPET-RUN) gate at repo root (approver: user, 2026-07-09)
- SEMVER_DIFF_ALLOW.md — allowlist read by the semver_diff (SEMVER-DIFF) gate at repo root (approver: mike@signalwire.com, 2026-07-15)
- WIRE_VIOLATIONS_ALLOW.md — STRICT-MOCKS signed-exception ledger read by porting-sdk assert_no_wire_violations.py / examples_run.py / snippet_run.py at repo root (approver: mike@signalwire.com, 2026-07-18)
- WIRED_MODES.md — WIRED-MODES gate manifest declaring the load-bearing run-ci env/mode lines, read by porting-sdk check_wired_modes.py at repo root (plan 1.6/D7, 2026-07-19)
- .doc_surface_floor — DOC-SURFACE TSDoc-coverage floor pin, read + ratcheted at repo root by porting-sdk doc_surface.py (plan 6.3, 2026-07-19)
