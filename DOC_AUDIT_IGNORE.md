# DOC_AUDIT_IGNORE.md

Identifiers that the porting-sdk `audit_docs.py` tool would otherwise flag as
unresolved references in this SDK's documentation and examples. Every line
has the form:

    <identifier>: <rationale>

Lines starting with `#` are comments and are ignored by the audit tool.

The audit is stricter about genuine phantom APIs than this ignore list —
anything called on an SDK object that doesn't exist is a bug to fix, not a
line to add here. This file is for **external** identifiers only:

- JavaScript / Node.js / browser / DOM stdlib calls
- Hono (the HTTP framework the SDK uses internally, referenced in docs)
- Third-party SDKs referenced in skill-integration examples
- Wire-level identifiers (snake_case RPC method names, JSON keys, DataMap tool
  names) that appear literally in docs/tables but are not TypeScript API calls

---

## JavaScript / Node.js stdlib

toISOString: Date.prototype.toISOString() — JavaScript built-in
toLocaleString: Date.prototype.toLocaleString() — JavaScript built-in
toLocaleTimeString: Date.prototype.toLocaleTimeString() — JavaScript built-in
toLowerCase: String.prototype.toLowerCase() — JavaScript built-in
toUpperCase: String.prototype.toUpperCase() — JavaScript built-in
floor: Math.floor() — JavaScript built-in
round: Math.round() — JavaScript built-in
random: Math.random() — JavaScript built-in
entries: Object.entries() / Map.prototype.entries() — JavaScript built-in
digest: SubtleCrypto.digest() — Web Crypto API built-in
exit: process.exit() — Node.js built-in
uptime: process.uptime() — Node.js built-in
memoryUsage: process.memoryUsage() — Node.js built-in
createServer: https.createServer() / http.createServer() — Node.js built-in
cwd: process.cwd() — Node.js built-in (ConfigLoader.search doc lists CWD as a search path)
Date: new Date() — JavaScript built-in constructor (README quick-start tool handler)
randomUUID: crypto.randomUUID() — Web Crypto API built-in (RELAY guide internal-dial sketch)

## Hono (HTTP framework)

use: Hono app.use(middleware) — Hono framework method, not an SDK surface symbol; reason: third-party framework API referenced in docs, absent from port_surface.json; approver: mike@signalwire.com; date: 2026-07-13
fetch: Hono app.fetch(request) — Hono framework request entry point, not an SDK surface symbol; reason: third-party framework API referenced in docs, absent from port_surface.json; approver: mike@signalwire.com; date: 2026-07-13

## Wire-level snake_case identifiers referenced in docs

The following snake_case identifiers appear literally in the docs — as RELAY
RPC method names (`calling.ai_hold`), platform JSON keys (`set_global_data`),
DataMap tool names (`list_orders`), or REST wire params (`phone_number`) — in
reference tables and wire-shape examples. They are not TypeScript SDK API calls
(the SDK exposes the camelCase form); the auditor sees the wire spelling and
would otherwise flag it.


## README/sub-doc audit (example-local user code, not SDK surface)

buildDocument: reader-authored doc example — method the swml_service_guide sample class defines on itself (this.buildDocument()), not SDK API; reason: example-local symbol absent from port_surface.json; approver: mike@signalwire.com; date: 2026-07-13
buildVoicemailDocument: reader-authored doc example — helper defined within the swml_service_guide voicemail sample, not SDK API; reason: example-local symbol absent from port_surface.json; approver: mike@signalwire.com; date: 2026-07-13
handleWeather: reader-authored doc example — handler function in the third_party_skills sample, not SDK API; reason: example-local symbol absent from port_surface.json; approver: mike@signalwire.com; date: 2026-07-13
http: Azure Functions SDK app.http(...) call in cloud_functions_guide (external SDK), not a SignalWire symbol; reason: third-party framework API referenced in docs, absent from port_surface.json; approver: mike@signalwire.com; date: 2026-07-13

## Third-party / cross-language / internal-sketch identifiers (widened doc perimeter)

object: Zod z.object(...) schema builder in the livewire migration-guide examples, not a SignalWire symbol; reason: third-party (Zod) API referenced in migration examples, absent from port_surface.json; approver: mike@signalwire.com; date: 2026-07-15
dispatchEvent: internal RELAY dispatch loop sketch (call.dispatchEvent(payload)) in RELAY_IMPLEMENTATION_GUIDE, an SDK-implementation illustration not part of the public API; reason: internal-implementation sketch (marked no-compile) absent from port_surface.json; approver: mike@signalwire.com; date: 2026-07-15
contains: illustrative pseudo-code err.contains(...) in CHECKLIST rule #7 describing a BANNED stub-test assertion pattern, not a call the SDK makes; reason: illustrative/prose identifier absent from port_surface.json; approver: mike@signalwire.com; date: 2026-07-15

## PGI reference implementation (examples/pgi/, quoted in docs/pgi_agent_guide.md section 6)

CaseHandlers#failure: defined in examples/pgi/support-agent.ts; turns a refused request into a result with no actions; reason: a name from the PGI reference implementation or the JavaScript runtime, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-28
CaseHandlers#finish: defined in examples/pgi/support-agent.ts; the finish tool's handler; reason: a name from the PGI reference implementation or the JavaScript runtime, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-28
CaseHandlers#submit: defined in examples/pgi/support-agent.ts; the submit_request tool's handler (MemoryCaseStore#submit in case-domain.ts shares the name); reason: a name from the PGI reference implementation or the JavaScript runtime, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-28
Number.isInteger: JavaScript built-in, used by examples/pgi/case-domain.ts; reason: a name from the PGI reference implementation or the JavaScript runtime, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-28

## Tutorials (tutorial/fred, tutorial/full-guardrails-agent, tutorial/multi_agents)

ReservationStore#bookingForCall: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#checkCall: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#checkNotice: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#clock: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#confirmCancel: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#findOptions: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#holdOption: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#hostStandOpen: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#keepReservation: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#newCode: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#proposal: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#recordCallEnd: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#requestCancel: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#requestSms: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#reservation: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#resetRequest: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#saveMessage: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#seedDemo: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#tableFree: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#tooSoon: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#tx: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#updateDraft: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
ReservationStore#verifiedReservation: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Request#spoken: defined in tutorial/full-guardrails-agent/reservations.ts, Penny's reservation book; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Penny#configurePrompt: defined in tutorial/full-guardrails-agent/penny.ts or handlers.ts; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Penny#configureVoice: defined in tutorial/full-guardrails-agent/penny.ts or handlers.ts; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Penny#registerTools: defined in tutorial/full-guardrails-agent/penny.ts or handlers.ts; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Penny#projectCallFacts: defined in tutorial/full-guardrails-agent/penny.ts or handlers.ts; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
PennyHandlers#captureCall: defined in tutorial/full-guardrails-agent/penny.ts or handlers.ts; reason: a name from a tutorial's own code, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Intl.DateTimeFormat: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Intl.DateTimeFormat#formatToParts: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Date.UTC: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Date#getTime: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Date#getUTCDay: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Date#getUTCMonth: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Math.abs: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Math.trunc: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Promise.all: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Array#at: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Array#flat: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Array#flatMap: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Array#indexOf: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Array.isArray: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Object.fromEntries: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Object.hasOwn: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
RegExp#exec: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
RegExp#test: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
String#localeCompare: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
String#padStart: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
String#repeat: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
String#replaceAll: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
String#startsWith: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Number#toFixed: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
crypto.randomBytes: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Worker#unref: JavaScript or Node.js built-in, used by the tutorials' code; reason: a JavaScript runtime name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
HonoRequest#header: Hono request API, used by tutorial/multi_agents code; reason: a third-party framework name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
vi.spyOn: vitest API, used in the tutorials' test lessons; reason: a test-framework name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
MockInstance#mockImplementation: vitest API, used in the tutorials' test lessons; reason: a test-framework name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
expect.stringContaining: vitest API, used in the tutorials' test lessons; reason: a test-framework name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Assertion#toBeUndefined: vitest API, used in the tutorials' test lessons; reason: a test-framework name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Assertion#toHaveBeenCalledWith: vitest API, used in the tutorials' test lessons; reason: a test-framework name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Assertion#toHaveLength: vitest API, used in the tutorials' test lessons; reason: a test-framework name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
Assertion#toHaveProperty: vitest API, used in the tutorials' test lessons; reason: a test-framework name, not SDK API, absent from port_surface.json; approver: anthm@signalwire.com; date: 2026-09-29
