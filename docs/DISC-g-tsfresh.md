# DISC-g-tsfresh — task #327: the "192 exported symbols vs the generator's 78" row

**Verdict up front.** The two counts ARE like-for-like — same file, same measurement,
one committed and one freshly generated. The row's *numbers* survive re-derivation.
The row's *framing* does not: this is neither port drift nor a generator regression.
It is a **spec-fanout stale artifact** — `porting-sdk/schema.json` shrank from **169
`$defs` to 63** at psdk `fb6defc` (2026-08-07), and this port's committed generated
file was last written on 2026-07-26, from the 169-def era.

**Zero INVENTED symbols.** All 139 lost symbols are STALE-GENERATED.

**Regenerating WOULD delete 139 exported type names**, 59 of which are cited as
parameter/return types in this port's own `port_signatures.json`. It is not,
however, a public-API break: nothing in `src/` imports the module (see Blast radius).

Nothing in this lane was fixed. Measurement only, per brief. Working tree is clean.

---

## 1. Re-deriving both counts

### Where the numbers actually come from

Neither number is "the port's exported symbols" vs "the generator's exported symbols".
Both are `src/swml_verbs_generated.ts`, one file:

| number | what it actually is |
|---|---|
| **78** | the live generator's own stdout: `checked src/swml_verbs_generated.ts (78 types)` — `decls.length` from `generateSwmlVerbs`, `scripts/generate-swml-verbs.ts:203` |
| **192** | the count of top-level `export` statements in the **committed** `src/swml_verbs_generated.ts` |

The `192` figure is also written verbatim into the HEAD commit's own message and into
a source comment — `scripts/generate-swml-verbs.ts:607-608` says *"all 192 committed
SWML verb config types went uncompared"*. That comment is now stale: the happy path
emits 78.

### Script — both counts, one method, applied to both files

```python
import re
def exports(path):
    s = open(path).read()
    return re.findall(r'^export\s+(interface|type|const|class|enum|function)\s+([A-Za-z0-9_]+)',
                      s, re.M)
```

Run against the committed blob and against a fresh regen of the same path:

```
COMMITTED exports: 192  {'interface': 158, 'type': 34}
FRESH     exports:  78  {'interface': 74,  'type': 4}
in committed not fresh: 139
in fresh not committed:  25
kept:                    53
```

`decls.length` (the generator's "78") and "top-level `export` statements" (the "192")
are the **same quantity** — `swmlDeclaration()` emits exactly one top-level `export`
per decl, and the fresh file measures 78 both ways. So the units match.

### Like-for-like verdict: **YES**

192 committed vs 78 fresh is a valid comparison of the same file measured the same way.
This is the one hypothesis in the brief's table I was told to rule out first, and it does
**not** apply here. The counts are real; the *label* on them ("port surface vs generator
surface") is what was wrong.

### Reproduction

```
$ cd /Users/michaeljerris/src/signalwire-typescript
$ env PORTING_SDK=/Users/michaeljerris/src/porting-sdk \
      PORTING_SDK_PATH=/Users/michaeljerris/src/porting-sdk \
      npx tsx scripts/generate-swml-verbs.ts --check
checked src/SwmlVerbMethods.generated.ts (39 verb methods)
checked src/PlatformContracts.generated.ts (9 types)
checked src/swml_verbs_generated.ts (78 types)

GEN-FRESH FAIL: 1 generated file(s) are stale — they no longer match what the
canonical schema produces. Run `npx tsx scripts/generate-swml-verbs.ts` and commit:
  - src/swml_verbs_generated.ts
```

Exit code 1; the verdict line is the `GEN-FRESH FAIL` line, not the exit code.

---

## 2. The row says "GEN-FRESH stale" — which GEN gate is actually red?

typescript schedules **five** GEN rules (`scripts/suites/_gen_commands.py:177-195`).
I ran all five in the foreground, at HEAD `0c7f923`, clean tree:

| rule | script | exit | verdict line |
|---|---|---|---|
| GEN-FRESH | `generate-rest-types.ts` | 0 | clean — 29 files checked, incl. 389 fabric types |
| GEN-FRESH-TESTS | `generate-rest-tests.ts` | 0 | `GEN-FRESH OK: 434 generated wire tests up to date` |
| GEN-FRESH-RELAY | `generate-relay-protocol.ts` | 0 | clean — `protocol.types.generated.ts (128 types)` |
| **GEN-FRESH-SWAIG** | `generate-swaig-payloads.ts` | **1** | 1 stale: `src/SwaigActions.generated.ts` |
| **GEN-FRESH-SWML** | `generate-swml-verbs.ts` | **1** | 1 stale: `src/swml_verbs_generated.ts` |

So the row's bare "GEN-FRESH stale" is imprecise in a way that matters: the rule
literally named `GEN-FRESH` is **green**. Two *other* rules in the family are red.

**GEN-FRESH-SWAIG is trivial and additive** — the whole diff is two new optional fields:

```
26a27 >   step?: string;
27a29 >   timeout_step?: string;
```

No deletion, no blast radius. The rest of this document is about GEN-FRESH-SWML.

---

## 3. Root cause: the spec input shrank, a week after this port's HEAD

`generateSwmlVerbs` reads `path.join(psdk, 'schema.json')`
(`scripts/generate-swml-verbs.ts:637`) — and has read that path since the surface was
first created at `f41d446` (2026-06-30). The generator input never moved.

**What moved is the file at the other end of that path.** `$defs` count per psdk
commit that touched `schema.json`:

| psdk commit | date | `$defs` |
|---|---|---|
| `6f57dee` | 2026-03-14 | 167 |
| `cfb69bb` | 2026-07-05 | 167 |
| `756ea55` | 2026-07-26 | **169** |
| **`fb6defc`** | **2026-08-07** | **63**  ← *"drop the hand-edit and re-vendor swml; the extractor derives 11"* |
| `6de8f55` | 2026-08-07 | 63 |
| `26f3268` … `203eb90` | 2026-08-07 → 08-13 | 60 |

This port's `src/swml_verbs_generated.ts` was last written by `d30dcd4` on
**2026-07-26** — i.e. generated against the 169-def schema, two days after `756ea55`
and twelve days before the re-vendor cut it to 63.

### Three falsified hypotheses (each tested, each negative)

1. **"Today's re-vendor `203eb90` did it."** No. Regenerating against
   `203eb90^:schema.json` (staged into a scratch psdk copy) also yields **78**.
   `203eb90` was 60→60 defs.
2. **"The HEAD commit `0c7f923` did it."** No. That commit only converted a silent
   `fs.existsSync` skip into a hard failure. Checking out `0c7f923^`'s generator and
   running it emits **78** as well. `0c7f923` did not *cause* the staleness — it
   **revealed** it. Before it, an absent spec produced a friendly "skipped … using
   committed file" line and **exit 0**, so the gate could report success having
   compared nothing.
3. **"The port drifted ahead / the lost names are hand-written."** No. Nothing in
   `src/` imports the module at all (§5), so no hand-written code could have grown
   it.

---

## 4. Symbol-by-symbol: the 139 lost exports

Classification key, and the evidence used for each:

- **STALE-GENERATED** — the name is a `$defs` key in the *richer* schema this port
  still vendors at `src/schema.json` (169 defs), i.e. it was genuinely emitted by an
  older generator run against a 169-def input, and is no longer produced.
- **STALE-GENERATED (synthesized `<Verb>Config`)** — not a `$defs` key anywhere; the
  generator *synthesizes* these by flattening `$defs.SWMLMethod.anyOf` into
  `<Verb>Config` payload interfaces (`generate-swml-verbs.ts:188`). They are a
  generator product, not a spec name.
- **INVENTED** — no basis in any spec. **Count: 0.**

**126 of 139** are `$defs` keys in `src/schema.json`. The remaining **13** are all
`<Verb>Config` synthesized names. **None** is invented.

**59 of the 139** are cited as a declared parameter/return type inside this port's own
`port_signatures.json` (matched on the module-qualified form
`swml_verbs_generated.<Name>`). Those are the ones with real downstream reach.

| # | symbol | in port `src/schema.json` $defs | cited in port_signatures.json | class |
|---|---|---|---|---|
| 1 | `AIObject` | yes | yes | STALE-GENERATED |
| 2 | `AIParams` | yes | yes | STALE-GENERATED |
| 3 | `AIPostPrompt` | yes | yes | STALE-GENERATED |
| 4 | `AIPostPromptPom` | yes | - | STALE-GENERATED |
| 5 | `AIPostPromptText` | yes | - | STALE-GENERATED |
| 6 | `AIPrompt` | yes | yes | STALE-GENERATED |
| 7 | `AIPromptPom` | yes | - | STALE-GENERATED |
| 8 | `AIPromptText` | yes | - | STALE-GENERATED |
| 9 | `Action` | yes | yes | STALE-GENERATED |
| 10 | `AllOfProperty` | yes | - | STALE-GENERATED |
| 11 | `AmazonBedrockObject` | yes | yes | STALE-GENERATED |
| 12 | `AnyOfProperty` | yes | - | STALE-GENERATED |
| 13 | `ArrayProperty` | yes | - | STALE-GENERATED |
| 14 | `AttentionTimeout` | yes | yes | STALE-GENERATED |
| 15 | `BedrockParams` | yes | yes | STALE-GENERATED |
| 16 | `BedrockPostPrompt` | yes | yes | STALE-GENERATED |
| 17 | `BedrockPrompt` | yes | yes | STALE-GENERATED |
| 18 | `BedrockSWAIG` | yes | yes | STALE-GENERATED |
| 19 | `BedrockSWAIGFunction` | yes | yes | STALE-GENERATED |
| 20 | `BooleanProperty` | yes | - | STALE-GENERATED |
| 21 | `CallStatus` | yes | yes | STALE-GENERATED |
| 22 | `ChangeContextAction` | yes | - | STALE-GENERATED |
| 23 | `ChangeStepAction` | yes | - | STALE-GENERATED |
| 24 | `CondElse` | yes | - | STALE-GENERATED |
| 25 | `CondParams` | yes | yes | STALE-GENERATED |
| 26 | `CondReg` | yes | - | STALE-GENERATED |
| 27 | `ConnectDeviceParallel` | yes | yes | STALE-GENERATED |
| 28 | `ConnectDeviceSerial` | yes | yes | STALE-GENERATED |
| 29 | `ConnectDeviceSerialParallel` | yes | yes | STALE-GENERATED |
| 30 | `ConnectDeviceSingle` | yes | yes | STALE-GENERATED |
| 31 | `ConnectHeaders` | yes | yes | STALE-GENERATED |
| 32 | `ConnectSwitch` | yes | yes | STALE-GENERATED |
| 33 | `ConstProperty` | yes | - | STALE-GENERATED |
| 34 | `ContextPOMSteps` | yes | - | STALE-GENERATED |
| 35 | `ContextSteps` | yes | yes | STALE-GENERATED |
| 36 | `ContextSwitchAction` | yes | - | STALE-GENERATED |
| 37 | `ContextTextSteps` | yes | - | STALE-GENERATED |
| 38 | `Contexts` | yes | yes | STALE-GENERATED |
| 39 | `ContextsObject` | yes | yes | STALE-GENERATED |
| 40 | `ContextsPOMObject` | yes | - | STALE-GENERATED |
| 41 | `ContextsTextObject` | yes | - | STALE-GENERATED |
| 42 | `ConversationMessage` | yes | yes | STALE-GENERATED |
| 43 | `ConversationRole` | yes | yes | STALE-GENERATED |
| 44 | `CustomTranslationFilter` | yes | - | STALE-GENERATED |
| 45 | `DataMap` | yes | yes | STALE-GENERATED |
| 46 | `Direction` | yes | yes | STALE-GENERATED |
| 47 | `EnterQueueObject` | yes | yes | STALE-GENERATED |
| 48 | `ExecuteConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 49 | `ExecuteSwitch` | yes | yes | STALE-GENERATED |
| 50 | `Expression` | yes | yes | STALE-GENERATED |
| 51 | `FunctionFillers` | yes | yes | STALE-GENERATED |
| 52 | `FunctionParameters` | yes | yes | STALE-GENERATED |
| 53 | `GotoConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 54 | `HangUpHookSWAIGFunction` | yes | - | STALE-GENERATED |
| 55 | `HangupAction` | yes | - | STALE-GENERATED |
| 56 | `Hint` | yes | yes | STALE-GENERATED |
| 57 | `HoldAction` | yes | - | STALE-GENERATED |
| 58 | `InjectAction` | yes | - | STALE-GENERATED |
| 59 | `IntegerProperty` | yes | - | STALE-GENERATED |
| 60 | `JoinConferenceObject` | yes | yes | STALE-GENERATED |
| 61 | `JoinRoomConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 62 | `LanguageParams` | yes | yes | STALE-GENERATED |
| 63 | `Languages` | yes | yes | STALE-GENERATED |
| 64 | `LanguagesWithFillers` | yes | - | STALE-GENERATED |
| 65 | `LanguagesWithSoloFillers` | yes | - | STALE-GENERATED |
| 66 | `NullProperty` | yes | - | STALE-GENERATED |
| 67 | `NumberProperty` | yes | - | STALE-GENERATED |
| 68 | `ObjectProperty` | yes | - | STALE-GENERATED |
| 69 | `OmitPropertiesBedrockPostPomptTextOmittedPromptProps` | yes | - | STALE-GENERATED |
| 70 | `OmitPropertiesBedrockPostPromptPomOmittedPromptProps` | yes | - | STALE-GENERATED |
| 71 | `OmitPropertiesBedrockPromptPomOmittedPromptProps` | yes | - | STALE-GENERATED |
| 72 | `OmitPropertiesBedrockPromptTextOmittedPromptProps` | yes | - | STALE-GENERATED |
| 73 | `OneOfProperty` | yes | - | STALE-GENERATED |
| 74 | `Output` | yes | yes | STALE-GENERATED |
| 75 | `POM` | yes | yes | STALE-GENERATED |
| 76 | `PayConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 77 | `PayParameters` | yes | yes | STALE-GENERATED |
| 78 | `PayPromptAction` | yes | yes | STALE-GENERATED |
| 79 | `PayPromptPlayAction` | yes | - | STALE-GENERATED |
| 80 | `PayPromptSayAction` | yes | - | STALE-GENERATED |
| 81 | `PayPrompts` | yes | yes | STALE-GENERATED |
| 82 | `PickPropertiesHangUpHookSWAIGFunctionPickedSWAIGFunctionProps` | yes | - | STALE-GENERATED |
| 83 | `PickPropertiesStartUpHookSWAIGFunctionPickedSWAIGFunctionProps` | yes | - | STALE-GENERATED |
| 84 | `PickPropertiesSummarizeConversationSWAIGFunctionPickedSWAIGFunctionProps` | yes | - | STALE-GENERATED |
| 85 | `PickPropertiesUserSWAIGFunctionPickedSWAIGFunctionProps` | yes | - | STALE-GENERATED |
| 86 | `PlayWithURL` | yes | yes | STALE-GENERATED |
| 87 | `PlayWithURLS` | yes | yes | STALE-GENERATED |
| 88 | `PlaybackBGAction` | yes | - | STALE-GENERATED |
| 89 | `PomSectionBodyContent` | yes | - | STALE-GENERATED |
| 90 | `PomSectionBulletsContent` | yes | - | STALE-GENERATED |
| 91 | `PromptConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 92 | `Pronounce` | yes | yes | STALE-GENERATED |
| 93 | `ReceiveFaxConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 94 | `SMSWithBody` | yes | yes | STALE-GENERATED |
| 95 | `SMSWithMedia` | yes | yes | STALE-GENERATED |
| 96 | `SWAIG` | yes | yes | STALE-GENERATED |
| 97 | `SWAIGDefaults` | yes | yes | STALE-GENERATED |
| 98 | `SWAIGFunction` | yes | yes | STALE-GENERATED |
| 99 | `SWAIGIncludes` | yes | yes | STALE-GENERATED |
| 100 | `SWAIGInternalFiller` | yes | yes | STALE-GENERATED |
| 101 | `SWAIGNativeFunction` | yes | yes | STALE-GENERATED |
| 102 | `SWMLAction` | yes | - | STALE-GENERATED |
| 103 | `SayAction` | yes | - | STALE-GENERATED |
| 104 | `SchemaType` | yes | yes | STALE-GENERATED |
| 105 | `SendDigitsConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 106 | `SendFaxConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 107 | `SetGlobalDataAction` | yes | - | STALE-GENERATED |
| 108 | `SetMetaDataAction` | yes | - | STALE-GENERATED |
| 109 | `SipReferConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 110 | `SpeechEngine` | yes | - | STALE-GENERATED |
| 111 | `StartAction` | yes | - | STALE-GENERATED |
| 112 | `StartUpHookSWAIGFunction` | yes | - | STALE-GENERATED |
| 113 | `StopAction` | yes | - | STALE-GENERATED |
| 114 | `StopPlaybackBGAction` | yes | - | STALE-GENERATED |
| 115 | `StopRecordCallConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 116 | `StopTapConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 117 | `StringFormat` | yes | yes | STALE-GENERATED |
| 118 | `StringProperty` | yes | - | STALE-GENERATED |
| 119 | `SummarizeAction` | yes | - | STALE-GENERATED |
| 120 | `SummarizeActionUnion` | yes | - | STALE-GENERATED |
| 121 | `SummarizeConversationSWAIGFunction` | yes | - | STALE-GENERATED |
| 122 | `TapConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 123 | `ToggleFunctionsAction` | yes | - | STALE-GENERATED |
| 124 | `TranscribeAction` | yes | yes | STALE-GENERATED |
| 125 | `TranscribeDirection` | yes | - | STALE-GENERATED |
| 126 | `TranscribeStartAction` | yes | - | STALE-GENERATED |
| 127 | `TranscribeSummarizeAction` | yes | - | STALE-GENERATED |
| 128 | `TranscribeSummarizeActionUnion` | yes | - | STALE-GENERATED |
| 129 | `TransferConfig` | no | - | STALE-GENERATED (synthesized `<Verb>Config`) |
| 130 | `TranslateAction` | yes | yes | STALE-GENERATED |
| 131 | `TranslateDirection` | yes | - | STALE-GENERATED |
| 132 | `TranslationFilterPreset` | yes | - | STALE-GENERATED |
| 133 | `UnsetGlobalDataAction` | yes | - | STALE-GENERATED |
| 134 | `UnsetMetaDataAction` | yes | - | STALE-GENERATED |
| 135 | `UserInputAction` | yes | - | STALE-GENERATED |
| 136 | `UserSWAIGFunction` | yes | - | STALE-GENERATED |
| 137 | `ValidConfirmMethods` | yes | yes | STALE-GENERATED |
| 138 | `Webhook` | yes | yes | STALE-GENERATED |
| 139 | `play_url` | yes | yes | STALE-GENERATED |

### The 25 symbols a regen would ADD

`AmazonBedrockConfig`, `CallDeviceStream`, `CallPayParameters`, `CallPayPrompts`,
`CallPayPromptsActions`, `ConnectDevice`, `ConnectSerialParallel`, `ConnectSipHeader`,
`Dial`, `DialConfig`, `Echo`, `EnterQueueConfig`, `Eval`, `ExecuteRpc`,
`ExecuteRpcConfig`, `If`, `IfConfig`, `SendSmsConfig`, `SetMeta`, `SetMetaConfig`,
`StopStream`, `Stream`, `Transcribe`, `TranscribeConfig`, `TranscribeStop`

These are the verbs the re-vendored extractor derives that the hand-edited schema did
not carry — real new surface, and the reason the re-vendor is not simply a loss.

---

## 5. Blast radius of regenerating (NOT applied)

**Would regeneration delete public surface? Two answers, and the distinction matters.**

**As a package export: NO.** No file under `src/` imports, re-exports, or otherwise
references `swml_verbs_generated`:

```
$ grep -rn "swml_verbs_generated" . --exclude-dir=node_modules --exclude-dir=.git \
      --exclude-dir=.tmp --exclude-dir=dist | grep -v "^./src/swml_verbs_generated.ts:"
```

returns **only** hits inside `port_signatures.baseline.json` and `port_signatures.json`
— zero hits in `src/`, `tests/`, `examples/`, or `docs/`. `src/index.ts` does not
export it. So the 139 names are not reachable through the published `.` entry point
(`package.json` → `dist/index.d.ts`), and deleting them breaks no consumer import.

**As parity/oracle surface: YES, 59 symbols.** They appear as declared types in
`port_signatures.json`, so regenerating stales that oracle and will move
SIGNATURES-FRESH / DRIFT. Those 59 are marked in the `cited` column of the table above.

### The fix, and why I am not applying it

The mechanical fix is one command:

```
npx tsx scripts/generate-swml-verbs.ts && npx tsx scripts/generate-swaig-payloads.ts
```

followed by regenerating `port_signatures.json` / `port_surface.json` and committing
all of it together.

**Two reasons this lane stops here.** (1) The brief scopes me to measurement and
explicitly parks re-drift under an owner-set order (python first, then typescript).
(2) More substantively — the 139 deletions are *not* this port's decision to make.
They follow from psdk `fb6defc` dropping a hand-edited schema in favour of an
extractor that derives 11 verbs. Whether that shrink is intended to propagate to the
SDK type surface, or whether the extractor is under-deriving, is an **upstream
question**, and answering it in one port would be answering it for all ten.

**Do not allow-list any part of this.** There is no divergence to record: the port is
byte-faithful to the generator it had, and the generator is byte-faithful to the spec
it has now. The gap is entirely a not-yet-run regen.

---

## 6. Pin check

**No SHA pin exists.** This port does not pin a porting-sdk revision; CI floats:

- `.github/workflows/nightly-multi-os.yml:102,111` — `ref: ${{ vars.PORTING_SDK_REF || 'main' }}`
- `.github/workflows/nightly-multi-os.yml:49` — resolves psdk `main`'s HEAD SHA at run
  time purely for a cache key, not as a pin.

Remote tip, via the only authority (`git ls-remote`, not a local `origin/*` ref):

```
$ git -C /Users/michaeljerris/src/porting-sdk config --get-all remote.origin.fetch
+refs/heads/*:refs/remotes/origin/*          # full refspec — NOT frozen in this repo
$ git -C /Users/michaeljerris/src/porting-sdk ls-remote origin HEAD
3b94c6c27b2b1f81b81feabb4ba7781d827362bb    HEAD
```

The local psdk checkout is at `a838faa`, behind that tip. It does, however, already
contain `fb6defc` and `203eb90`, so the local checkout is new enough for every
conclusion here; a fresher psdk can only shrink `$defs` further, never restore the 169.

So: **not a stale-pin failure.** There is no pin to be stale. The port floats on psdk
`main` and simply has not re-run its generator since `main` moved.

---

## 7. Negative control

A detector that cannot separate the classes is not a detector. Three probes through the
same `exports()` function used for every count above:

| probe | committed | fresh | expected | result |
|---|---|---|---|---|
| `Section` | present | present | stable generated — in BOTH | PASS |
| `AIPrompt` | present | absent | 169-era only — committed-only | PASS |
| `Dial` | absent | present | re-vendor-derived — fresh-only | PASS |

Control is **not at zero**: the detector places symbols in all three buckets
(53 kept / 139 lost / 25 gained), so the 139 is a measured partition, not an artifact
of a filter that matches everything or nothing.

Second control, on the *classifier*: `TransferConfig` is absent from **both**
`porting-sdk/schema.json` and `src/schema.json` `$defs`, yet is correctly classed
STALE-GENERATED rather than INVENTED because the generator synthesizes it at
`generate-swml-verbs.ts:188`. Had I checked only `$defs` membership, 13 symbols would
have been mis-reported as INVENTED — a false serious finding.

---

## 8. Fleet check — the refutation holds for every instance

If the cause is an upstream psdk schema shrink, then every port that generates from
`schema.json` and has not regenerated since 2026-08-07 must carry the same stale shape.
Measured:

| port | file | decl count | last written |
|---|---|---|---|
| typescript | `src/swml_verbs_generated.ts` | **192** | 2026-07-26 (`d30dcd4`) |
| go | `pkg/swml/swml_verbs_generated.go` | **192** | 2026-07-26 (`083f9db`) |
| rust | `src/swml/swml_verbs_generated.rs` | 158 | 2026-07-27 (`0761b35`) |

go carries the **identical 192**, from the identical date. This is a fleet-wide
spec-fanout, not a typescript defect — which is exactly what
`porting-sdk/scripts/spec_fanout_gate.py:9` predicts: *"``GEN-FRESH*`` goes red across
the fleet the moment a re-vendor lands."* Fixing this in typescript alone would be
fixing one instance of a ten-port event.

---

## CLEARED (with proof)

- **CLEARED — "the two counts are not comparable."** Both are
  `src/swml_verbs_generated.ts` under one `exports()` regex; the fresh file measures 78
  by both `decls.length` and export-statement count. Like-for-like: **yes**.
- **CLEARED — "the port genuinely drifted ahead / hand-written surface exists."**
  A repo-wide grep finds zero references to the module outside the file itself and two
  oracle JSONs. No hand-written code touches it.
- **CLEARED — "a stale pin."** No pin exists; `nightly-multi-os.yml:102` floats to
  psdk `main`. `ls-remote` gives `3b94c6c`; the local psdk already contains both
  relevant commits.
- **CLEARED — INVENTED surface.** 126/139 are `$defs` keys in the port's vendored
  169-def `src/schema.json`; the other 13 are generator-synthesized `<Verb>Config`
  names emitted at `generate-swml-verbs.ts:188`. **INVENTED count: 0.**
- **CLEARED — "the HEAD commit `0c7f923` caused it."** Its generator and its parent's
  generator both emit 78 against the current schema. It exposed the staleness; it did
  not create it.
- **CLEARED — "today's re-vendor `203eb90` caused it."** Regen against
  `203eb90^:schema.json` also emits 78; that commit was 60→60 defs.

## UNEXPLAINED

- Whether psdk `fb6defc`'s 169→63 shrink is *intended* to remove 139 SDK type names,
  or whether the new extractor under-derives relative to the hand-edited schema it
  replaced. This is an upstream spec question and the reason the fix is not applied
  here. It is the only open item.

## NEW MECHANISMS (numbered)

**M1 — A generator's per-file stdout count and a source-level export count are the
same quantity here, so "N vs M" was a REAL comparison; the label on it was the defect.**
The row read as "port surface (192) vs generator surface (78)", inviting a
units-error diagnosis. Both were one file. The lesson inverts the usual one: re-deriving
the numbers confirmed them, and the error was in the *nouns*, not the arithmetic. Re-derive
the **referent** as well as the value.

**M2 — A silent-skip guard makes an upstream spec shrink invisible for as long as it
lasts.** Before `0c7f923`, a missing spec made `generate-swml-verbs.ts` log "skipped …
using committed file" and exit 0 — `emitFile` never ran, `staleFiles` stayed empty,
`finalizeCheck` passed. Any gate whose freshness check is driven by "did we emit
something" reports success when the emit was skipped. The generalization: **a
freshness gate must fail when its input is unavailable, never pass.** `0c7f923` fixed
this for the two spec reads; the pattern is worth auditing in the other nine ports'
generators.

**M3 — A stale generated artifact survives in a port's SIGNATURE ORACLE even when no
source file imports it.** `swml_verbs_generated` has zero importers in `src/`, yet 59
of its symbols are cited as declared types in `port_signatures.json`. So "is it
exported from the package?" and "does deleting it move a gate?" are **independent
questions**, and answering only the first would have reported blast radius zero. Check
the oracle JSONs separately from the module graph.

**M4 — A `<Verb>Config`-style synthesized name is absent from every spec and is still
not INVENTED.** 13 symbols here match the textbook INVENTED signature — no `$defs`
entry in any schema revision — but are generator products from flattening
`SWMLMethod.anyOf`. Before classifying a symbol as invented, check whether the
*generator synthesizes* it, not merely whether the *spec declares* it. Skipping that
step would have produced 13 false INVENTED findings, the most serious class in the
brief.
