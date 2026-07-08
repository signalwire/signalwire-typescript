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
- port_surface.json — required audit-artifact file read by porting-sdk audit scripts (orchestrator, 2026-07-06)
