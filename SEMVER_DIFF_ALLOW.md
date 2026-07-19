# SEMVER_DIFF_ALLOW.md — approved SEMVER-DIFF exceptions

Each line: `- <symbol> — reason (approver, date)`. An entry excuses a member-level
signature diff that SEMVER-DIFF would otherwise classify as demanding a higher
version bump. Reserved for provable non-breaking changes; prefer a real MAJOR bump
over an entry whenever a change is genuinely breaking.

Note: the revision cycle these branches belong to lands as a deliberate MAJOR
(4.0) across the fleet. These entries keep SEMVER-DIFF honest DURING development
(the relocated declarations are not a break, so they must not read as a false
major mid-wave); the eventual MAJOR is driven by the wave's real breaking work,
not by these.

- signalwire.rest._base.CrudResource.get — NOT a removal: `CrudResource` now `extends ReadResource` (mirroring Python's `CrudResource(ReadResource)`), so `get()` moved to the parent and is INHERITED by every CrudResource and subclass. Every instance still exposes `get()` (proven by tests/rest/paginate_inheritance.test.ts) and additionally GAINED `paginate()` — the instance surface is a strict superset, so no user-facing break. Only the per-class *declared*-method snapshot changed. (approver: mike@signalwire.com — APPROVED 2026-07-19)
- signalwire.rest._base.CrudResource.list — NOT a removal: same as CrudResource.get — `list()` moved to the inherited `ReadResource` parent when the hierarchy was corrected. Every CrudResource instance still exposes `list()` (proven by tests/rest/paginate_inheritance.test.ts); the change is the internal declared-surface only, and the instance surface strictly grew (gained `paginate()`). (approver: mike@signalwire.com — APPROVED 2026-07-19)
