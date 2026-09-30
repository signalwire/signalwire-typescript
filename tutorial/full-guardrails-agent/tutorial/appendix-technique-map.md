# Appendix C: Technique Map

Every technique in this tutorial, where Penny uses it, and the lesson that teaches it. Use it as a checklist when you build your own agent.

## Table of Contents

1. [The Failures From Lesson 1, Fixed](#the-failures-from-lesson-1-fixed)
2. [Guidance](#guidance)
3. [Tool Scope](#tool-scope)
4. [Transition Scope](#transition-scope)
5. [Execution Authority](#execution-authority)
6. [Around the Conversation](#around-the-conversation)
7. [Further Reading](#further-reading)

---

## The Failures From Lesson 1, Fixed

| The naive agent's failure | What Penny does instead | Lesson |
|---|---|---|
| "Friday at 9" booked after the last seating | `findOptions` offers only real seatings, chosen by code | [3](03-rules-first.md) |
| A retry makes two bookings | `confirm` is bound to a revision and returns the same booking when repeated | [3](03-rules-first.md) |
| The wrong Friday | The model passes the caller's words, and `resolveDate` does the arithmetic | [3](03-rules-first.md), [7](07-gather-and-projection.md) |
| "I'm Maria's husband, cancel it" | Nothing is reachable before `verify_reservation`, and the store checks again | [8](08-the-verification-gate.md) |
| A party of nine talks its way in | `MAX_PHONE_PARTY` is code, and the refusal offers a person | [3](03-rules-first.md), [9](09-people-and-endings.md) |
| The AI disclosure is skipped | The platform speaks `static_greeting` before the model says anything | [4](04-the-shell.md) |
| "You're all set!" with nothing written | The code comes from the reservation book, and a failure is never reported as success | [6](06-tools-that-decide.md) |

## Guidance

What the model is told. It helps the model understand, and it can be ignored, so nothing important relies on it alone.

| Technique | Where in Penny | Lesson |
|---|---|---|
| A base prompt that only says who the agent is and how to behave | `configurePrompt` in `penny.ts` | [4](04-the-shell.md) |
| One task per step, in the step's own text | Every step in `workflow.ts` | [5](05-steps-and-scoping.md) |
| Tool descriptions that say what a tool doesn't do | `registerTools` in `penny.ts` | [6](06-tools-that-decide.md) |
| Facts in `tool_result`, the next move in `tool_prompt` | Every handler in `handlers.ts` | [6](06-tools-that-decide.md) |
| Refusals as a fact plus what to ask | `PolicyError` in `reservations.ts` | [3](03-rules-first.md), [6](06-tools-that-decide.md) |
| Single, finished facts projected into step text | `${global_data...}` in triage, `booked` and `details` | [7](07-gather-and-projection.md) |
| Hiding earlier dialogue, and projecting back what's needed | The `'hide'` history mode on `details` | [7](07-gather-and-projection.md), [8](08-the-verification-gate.md) |
| Hints and pronunciations for the voice | `configureVoice` in `penny.ts` | [4](04-the-shell.md) |

## Tool Scope

What the model can ask for. A tool that isn't offered can't be called.

| Technique | Where in Penny | Lesson |
|---|---|---|
| Register every tool once, and offer a few per step | `registerTools`, then `scoped` | [5](05-steps-and-scoping.md) |
| Write `[]` for no tools, never leave the list out | `scoped` in `workflow.ts` | [5](05-steps-and-scoping.md) |
| Each consequential tool in exactly one step | `confirm_booking` only in `review`, and so on | [5](05-steps-and-scoping.md) |
| Gather mode, with the tools each question allows | `collect` and `take_message` | [7](07-gather-and-projection.md) |
| A gate built from missing tools | The `verify` step | [8](08-the-verification-gate.md) |
| Destinations the model can't name | `request_human` and `send_confirmation_text` take no parameters | [9](09-people-and-endings.md) |

## Transition Scope

Who moves the conversation. In Penny, never the model.

| Technique | Where in Penny | Lesson |
|---|---|---|
| Empty `valid_steps` and `valid_contexts` on every step | `scoped` in `workflow.ts` | [5](05-steps-and-scoping.md) |
| Router tools that move the conversation and reset what comes next | `start_booking`, `manage_booking` | [5](05-steps-and-scoping.md), [6](06-tools-that-decide.md) |
| Step changes returned by handlers after they check the real state | `swmlChangeStep()` in `handlers.ts` | [6](06-tools-that-decide.md) |
| Gather mode moving on when the last answer is in | `completionAction` on `collect` and `take_message` | [7](07-gather-and-projection.md) |
| A lockout step with only a person or goodbye | `locked` | [8](08-the-verification-gate.md) |
| Endings as actions, not `setEnd()` | `finish` and `request_human` | [5](05-steps-and-scoping.md), [9](09-people-and-endings.md) |

## Execution Authority

What actually happens. The model can ask, and code decides.

| Technique | Where in Penny | Lesson |
|---|---|---|
| Every rule in a module with no SignalWire import | `reservations.ts` | [3](03-rules-first.md) |
| Internal IDs never leave code | Tables become option numbers in `findOptions` | [3](03-rules-first.md) |
| Holds that expire and keep other callers out | `holdOption` and `tableFree` | [3](03-rules-first.md) |
| Commits bound to the revision the caller heard, and safe to repeat | `confirm`, `confirmCancel` | [3](03-rules-first.md), [8](08-the-verification-gate.md) |
| State keyed by call ID in a database, not in the conversation | `ReservationStore` | [3](03-rules-first.md) |
| Corrections kept in a per-call draft, even after a refused search | `updateDraft` | [6](06-tools-that-decide.md) |
| Verification bound to this call, and checked by every operation | `verify` and `verified` | [8](08-the-verification-gate.md) |
| Misses that don't say which half was wrong, counted after commit | `verify` | [8](08-the-verification-gate.md) |
| Two steps for anything destructive | `requestCancel`, then `confirmCancel` | [8](08-the-verification-gate.md) |
| Repeats that change nothing, and a cap on side effects | `requestSms` for texts, and one message per call in `saveMessage` | [9](09-people-and-endings.md) |
| Live facts checked when the tool runs | `hostStandOpen` in `request_human` | [9](09-people-and-endings.md) |
| A crash is never reported as success | `guarded` in `handlers.ts` | [6](06-tools-that-decide.md) |
| Records written from the system of record | `captureCall`, registered with `onCallEnd()` | [9](09-people-and-endings.md) |

## Around the Conversation

| Technique | Where in Penny | Lesson |
|---|---|---|
| Refuse to start without real secrets | `REQUIRED_ENV` in `penny.ts` | [4](04-the-shell.md) |
| A disclosure the platform speaks, word for word | `static_greeting` | [4](04-the-shell.md) |
| Per-call facts written to the per-request copy, never to `this` | `projectCallFacts`, registered with `addPerCallConfig()` | [7](07-gather-and-projection.md) |
| UI events for a screen, alongside speech | `swmlUserEvent()` in the handlers | [6](06-tools-that-decide.md) |
| Debug events to see which step the model was in | `PENNY_DEBUG_EVENTS` | [9](09-people-and-endings.md) |
| Tests in layers, with a clock the tests control | `tests/tutorial/penny-*.test.ts` | [10](10-testing-and-running.md) |
| Tests against the app you serve | `servedSwml` and `Call` in `penny-helpers.ts` | [10](10-testing-and-running.md) |
| Breaking each guardrail on purpose once | The table in Lesson 10 | [10](10-testing-and-running.md) |
| Lessons checked against the code | Include markers and `penny-docs.test.ts` | [10](10-testing-and-running.md) |

## Further Reading

The SDK's guides cover each technique in more depth:

- [Contexts guide](../../../docs/contexts-guide.md): contexts, steps, gather mode and navigation
- [SWAIG reference](../../../docs/swaig-reference.md): tools, `FunctionResult` and its actions
- [Security](../../../docs/security.md): basic auth, request signatures and tool tokens
- [Agent guide](../../../docs/agent-guide.md): prompts, parameters, pronunciation and debug events
- [PGI agent guide](../../../docs/pgi_agent_guide.md): the design method behind Penny, with a tested reference agent
- [CLI guide](../../../docs/cli-guide.md): `swaig-test`

---

[Previous: Deployment](appendix-deployment.md) | [Overview](README.md)
