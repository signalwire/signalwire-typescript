# SNIPPET_RUN_ALLOW.md — snippets excused from SNIPPET-RUN

Each entry: a `<path>:<line>` substring of a documented snippet the SNIPPET-RUN
gate should skip, followed by a reason. Only for snippets that legitimately can't
run to a zero exit standalone — and specifically for README `<!-- include: -->`
sites, which cannot carry an inline `<!-- snippet: no-run -->` marker (the marker
would break the README-INCLUDE gate's include-comment/fence adjacency). Never a
place to hide a real doc bug.

- README.md:158 — quickstart-rest include: the fixture constructs a RestClient with PLACEHOLDER credentials (`project: '...'`, `token: '...'`) against a non-mock host (`example.signalwire.com`) and then makes four live REST calls, so it cannot run to a zero exit standalone. (The SDK CAN reach a loopback mock over plain HTTP — `RestClient` preserves an `http://` host verbatim (src/rest/index.ts) and the DOC-WIRE runner + rest tests drive it that way; the blocker here is the placeholder creds/host, not any transport limitation.) Include-synced, so it can't carry an inline no-run marker. (user, 2026-07-09; rationale corrected 2026-07-15) (approver: mike@signalwire.com; date: 2026-07-15)
