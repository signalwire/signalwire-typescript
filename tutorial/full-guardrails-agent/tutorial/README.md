# Full-Guardrails Agent Tutorial: Building Penny, a Reservation Line That Keeps Its Rules

The [Fred tutorial](../../fred/fred.ts) gave an agent a personality and a skill. This tutorial builds an agent whose actions have consequences, such as booking tables and cancelling reservations, with the SignalWire TypeScript SDK. It keeps that agent correct when the model misunderstands, when a caller pushes, and when a tool fires twice.

## What You'll Build

Penny answers the phone for **The Copper Pot**, a neighborhood restaurant. Callers can use Penny to:

- Book a table and hear a confirmation code
- Look up and cancel an existing reservation, after proving it's theirs
- Ask questions about the restaurant
- Reach a person, or leave a message when nobody is at the host stand
- Get the confirmation by text at the number they called from

What sets Penny apart from Fred is what the model **doesn't** know. It never sees the reservation book, the house rules, other guests' reservations or table numbers. At any moment it has one small task and a few tools, and code does everything that matters.

## The Idea in One Sentence

Program what the model can see and ask for at each moment, and keep what actually happens in code. SignalWire calls this **Programmatically Governed Inference** (PGI).

## Lessons

Each lesson builds on the one before it, so work through them in order:

1. [Why Guardrails](01-why-guardrails.md): the obvious way to build this agent, how it fails, and the idea that fixes it
2. [Design Before Code](02-design-first.md): what must always be true, who enforces it, and what the model sees at each step
3. [The Rules First](03-rules-first.md): the reservation book, with every business rule tested and no agent involved
4. [The Agent Shell](04-the-shell.md): secrets that fail closed, a greeting the model can't skip, and a small prompt
5. [Steps and Scoping](05-steps-and-scoping.md): contexts and steps where every step names its tools, and only code moves the conversation
6. [Tools That Decide](06-tools-that-decide.md): handlers that check the real state, then report to the model and the platform
7. [Gather Mode and Projection](07-gather-and-projection.md): questions asked one at a time, and only the facts each step needs
8. [The Verification Gate](08-the-verification-gate.md): nothing about a reservation is reachable until the caller proves it's theirs
9. [People, Messages and Endings](09-people-and-endings.md): transfers, messages, texts and goodbyes that code carries out
10. [Testing and Running](10-testing-and-running.md): tests that prove the guardrails hold, attack scenarios, and running Penny

The appendices are for reference:

- [Appendix A: Complete Code](appendix-complete-code.md): every file, in full
- [Appendix B: Deployment](appendix-deployment.md): settings, secrets, Docker and a checklist for going live
- [Appendix C: Technique Map](appendix-technique-map.md): every technique, where Penny uses it, and the lesson that teaches it

## Prerequisites

You need:

- Node.js 22.16 or later, for the built-in `node:sqlite` module and its `timeout` option
- A clone of this repository with its packages installed (`npm install` at the repository root)
- The [Fred tutorial](../../fred/fred.ts), or working knowledge of `AgentBase`, prompt sections and tools

The lessons take about two hours in total, 10 to 15 minutes each.

## The Files

Penny is four TypeScript modules. The rest of the directory runs and deploys them, and the tests live with the SDK's other tests:

```text
tutorial/full-guardrails-agent/
├── reservations.ts   the rules and the records (no SignalWire import)
├── workflow.ts       what the model sees and may do, step by step
├── handlers.ts       what each tool does, and what it tells the model and the platform
├── penny.ts          the agent, which wires the other three together
├── penny.sh          start, stop, status, logs, test
├── package.json      the dependencies, for running Penny outside this repository
├── .env.example
├── .gitignore
├── Dockerfile
└── tutorial/         the lessons
tests/tutorial/
├── penny-rules.test.ts      the reservation book, with no agent
├── penny-workflow.test.ts   the SWML Penny serves, and its HTTP edge
├── penny-handlers.test.ts   what each tool tells the model and the platform
├── penny-docs.test.ts       the code in these lessons is the real code
├── penny-helpers.ts         a clock, a reservation book and a simulated call
└── penny-race-worker.ts     one of four threads that confirm at once
```

Code blocks that quote a file carry a marker naming the file and region they quote, and `penny-docs.test.ts` checks each one against that file. If the code changes and a lesson doesn't, a test fails.

## Quick Start

Run the tests from the repository root:

```bash
npx vitest run tests/tutorial/penny
```

## What Is and Isn't Verified

The tutorial separates what its tests prove from what still needs a real call:

- **Verified by the tests:** the business rules, the SWML the agent serves (tools and navigation for every step), and what every tool returns to the model and the platform, including under attack
- **Verified in a real conversation:** a booking, a verified cancellation, an attempt on another guest's reservation, and a message for the host stand. Each ran through SignalWire's AI service with a live model ([Lesson 10](10-testing-and-running.md)).
- **Not verified here:** speech on a real phone line, including barge-in and timing, and a live transfer or text. Test those on your own number before going live.

## Getting Help

These resources cover the SDK features the lessons use:

- **SDK documentation:** the [docs](../../../docs/) folder in this repository, especially the [contexts guide](../../../docs/contexts-guide.md), the [SWAIG reference](../../../docs/swaig-reference.md) and the [PGI agent guide](../../../docs/pgi_agent_guide.md)
- **GitHub Issues:** [github.com/signalwire/signalwire-typescript](https://github.com/signalwire/signalwire-typescript)

Start with [Lesson 1: Why Guardrails](01-why-guardrails.md).

---

*This tutorial was written for `@signalwire/sdk` 3.5.0.*
