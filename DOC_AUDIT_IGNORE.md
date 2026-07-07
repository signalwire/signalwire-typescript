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
trim: String.prototype.trim() — JavaScript built-in
floor: Math.floor() — JavaScript built-in
round: Math.round() — JavaScript built-in
random: Math.random() — JavaScript built-in
includes: Array.prototype.includes() / String.prototype.includes() — JavaScript built-in
entries: Object.entries() / Map.prototype.entries() — JavaScript built-in
digest: SubtleCrypto.digest() — Web Crypto API built-in
exit: process.exit() — Node.js built-in
uptime: process.uptime() — Node.js built-in
memoryUsage: process.memoryUsage() — Node.js built-in
createServer: https.createServer() / http.createServer() — Node.js built-in
cwd: process.cwd() — Node.js built-in (ConfigLoader.search doc lists CWD as a search path)

## Hono (HTTP framework)

use: Hono app.use(middleware) — Hono framework method; not on SDK classes
fetch: Hono app.fetch(request) — Hono framework request entry point; not on SDK classes

## Wire-level snake_case identifiers referenced in docs

The following snake_case identifiers appear literally in the docs — as RELAY
RPC method names (`calling.ai_hold`), platform JSON keys (`set_global_data`),
DataMap tool names (`list_orders`), or REST wire params (`phone_number`) — in
reference tables and wire-shape examples. They are not TypeScript SDK API calls
(the SDK exposes the camelCase form); the auditor sees the wire spelling and
would otherwise flag it.

ai_hold: RELAY RPC method `calling.ai_hold` (TS API: aiHold) — referenced in a wire/reference table
ai_message: Python snake_case form of aiMessage — referenced in python-syntax doc block
ai_unhold: Python snake_case form of aiUnhold — referenced in python-syntax doc block
bind_digit: Python snake_case form of bindDigit — referenced in python-syntax doc block
clear_digit_bindings: Python snake_case form of clearDigitBindings — referenced in python-syntax doc block
leave_conference: Python snake_case form of leaveConference — referenced in python-syntax doc block
leave_room: Python snake_case form of leaveRoom — referenced in python-syntax doc block
list_orders: Python snake_case form of listOrders — referenced in python-syntax doc block
phone_number: Python snake_case form of phoneNumber — referenced in python-syntax doc block
play_and_collect: Python snake_case form of playAndCollect — referenced in python-syntax doc block
send_message: Python snake_case form of sendMessage — referenced in python-syntax doc block
set_global_data: Python snake_case form of setGlobalData — referenced in python-syntax doc block
start_recording: Python snake_case form of startRecording — referenced in python-syntax doc block

## README/sub-doc audit (example-local user code, not SDK surface)

buildDocument: example-local method the swml_service_guide sample class defines on itself (this.buildDocument()), not SDK API
buildVoicemailDocument: example-local helper defined within the swml_service_guide voicemail sample, not SDK API
registerCustomerRoute: example-local helper in the swml_service_guide routing sample, not SDK API
registerProductRoute: example-local helper in the swml_service_guide routing sample, not SDK API
handleWeather: example-local handler function in the third_party_skills sample, not SDK API
http: Azure Functions SDK app.http(...) call in cloud_functions_guide (external SDK), not a SignalWire symbol
