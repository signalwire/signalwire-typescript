# SNIPPET_RUN_ALLOW.md — snippets excused from SNIPPET-RUN

Each entry: a `<path>:<line>` substring of a documented snippet the SNIPPET-RUN
gate should skip, followed by a reason. Only for snippets that legitimately can't
run to a zero exit standalone — and specifically for README `<!-- include: -->`
sites, which cannot carry an inline `<!-- snippet: no-run -->` marker (the marker
would break the README-INCLUDE gate's include-comment/fence adjacency). Never a
place to hide a real doc bug.

- README.md:158 — quickstart-rest include: makes a live REST call to SIGNALWIRE_SPACE; the SDK has no plain-HTTP mock override so it can't reach the loopback mock standalone. Include-synced, so it can't carry an inline no-run marker. (user, 2026-07-09)
