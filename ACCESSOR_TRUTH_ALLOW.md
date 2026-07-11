# ACCESSOR_TRUTH_ALLOW.md

Backtick `method()` mentions the `accessor_truth` (ACCESSOR-TRUTH) gate flags as
"documented but not defined", excused with a real reason. Two justified classes:

1. **Real methods the gate's TS `def_re` cannot parse.** The gate's TypeScript
   method-definition regex requires the parameter list to close on the SAME line
   (`name(...)[:{ ]`). These methods have a multi-line object-typed signature
   (`static createLambdaHandler(app: {` … `}): …`), so the closing `)` is on a
   later line and the regex never matches — a gate-parser gap, not a phantom. Each
   is a genuinely-defined, exported method (file:line cited). Reported to the
   orchestrator as a `def_re` multiline-signature gap.

2. **Other-library / language-builtin references** — a method that belongs to a
   dependency (Hono middleware) or the JS language, shown to explain integration,
   never claimed as SignalWire SDK surface.

- createLambdaHandler — real static method, `src/ServerlessAdapter.ts:247`; multi-line `(app: {…})` signature the gate's single-line def_re misses (orchestrator gate-gap, 2026-07-11)
- createGcfHandler — real static method, `src/ServerlessAdapter.ts:259`; multi-line signature the gate's single-line def_re misses (orchestrator gate-gap, 2026-07-11)
- createAzureHandler — real static method, `src/ServerlessAdapter.ts:385`; multi-line signature the gate's single-line def_re misses (orchestrator gate-gap, 2026-07-11)
- defineTypedTool — real method, `src/AgentBase.ts:1472`; multi-line `(opts: {…})` signature the gate's single-line def_re misses (orchestrator gate-gap, 2026-07-11)
- cors — Hono's `cors()` middleware (`docs/security.md` shows `app.use('*', cors({…}))`); a dependency's function, not SignalWire SDK surface (orchestrator, 2026-07-11)
- import — JavaScript dynamic `import()` language builtin (`docs/cli-guide.md`: "the CLI uses dynamic `import()` to load your agent module"); a language feature, not an SDK method (orchestrator, 2026-07-11)
- validateRequestWithBody — the Compatibility API's `RestClient.validateRequestWithBody()`, named in `README.md` only to explain that this SDK's `validateRequest()` folds both Compat methods into one; an other-package method reference, not a claim of local surface (orchestrator, 2026-07-11)
