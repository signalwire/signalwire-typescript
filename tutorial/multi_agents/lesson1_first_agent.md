# Lesson 1: Creating Your First Agent

This lesson builds Morgan, a sales agent for PC Builder Pro that helps callers choose a PC build. Morgan is an AI voice agent built with the SignalWire Agents SDK for TypeScript: an HTTP service that tells SignalWire how to run the call.

## Table of Contents

1. [How an agent works](#how-an-agent-works)
2. [Creating a basic agent](#creating-a-basic-agent)
3. [Configuring agent prompts](#configuring-agent-prompts)
4. [Adding voice and language](#adding-voice-and-language)
5. [Running your agent](#running-your-agent)
6. [Testing your agent](#testing-your-agent)
7. [Enabling SSL/HTTPS](#enabling-sslhttps)
8. [Summary](#summary)

---

## How an agent works

An agent is an `AgentBase` instance. You configure it with method calls, as this lesson does, or by extending the class. Every agent has these parts:

- **Name**: identifies the agent in logs
- **Route**: the HTTP path the agent answers on, such as `/` or `/sales`
- **Host and port**: where its HTTP server listens
- **Prompt**: the instructions that define the agent's behavior
- **Languages and voices**: the text-to-speech configuration

When a call arrives, SignalWire requests the agent's route. The agent answers with SWML (SignalWire Markup Language), a JSON document that describes the call. For Morgan, it says: answer the call, then run an AI with this prompt and this voice.

## Creating a basic agent

This section creates Morgan's agent in `tutorial/multi_agents/sales_agent.ts`.

### Step 1: Create the agent

Import `AgentBase` and create the agent with a name, a route and a host:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent.ts#construct -->
```typescript
import { pathToFileURL } from 'node:url';
import { AgentBase } from '@signalwire/sdk';

export const agent = new AgentBase({
  name: 'PC Builder Sales Agent - Morgan',
  route: '/',
  host: '0.0.0.0',
});
```

The `pathToFileURL` import is for the last step, which starts the server.

### Step 2: Understand the options

The constructor takes an options object. These are the ones Morgan uses:

- `name`: identifies the agent in logs and debugging
- `route`: the URL path the agent answers on. Use `/` for the root.
- `host`: the network interface to listen on. `0.0.0.0`, the default, listens on all of them.

The agent listens on the port in the `PORT` environment variable, or 3000 when it's unset. A `port` option overrides both.

## Configuring agent prompts

The Prompt Object Model (POM) structures a prompt as titled sections instead of one long string. Each call to `promptAddSection()` adds a section with a body, bullets, or both.

### Step 3: Add the agent's role

Add a section that names Morgan and describes the character:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent.ts#role -->
```typescript
// Configure the agent's personality and role
agent.promptAddSection('AI Role', {
  body:
    'You are Morgan, a passionate PC building expert and sales specialist ' +
    "at PC Builder Pro. You're known for your deep knowledge of components " +
    'and your ability to match customers with their perfect build. You get ' +
    'excited about the latest hardware and love sharing that enthusiasm. ' +
    'Always introduce yourself by name.',
});
```

### Step 4: Define areas of expertise

Add a second section that lists what Morgan specializes in:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent.ts#expertise -->
```typescript
// Add expertise section
agent.promptAddSection('Your Expertise', {
  body: 'Areas of specialization:',
  bullets: [
    'Custom PC builds for all budgets',
    'Component compatibility and optimization',
    'Performance recommendations',
    'Price/performance analysis',
    'Current market trends',
  ],
});
```

### Step 5: Define tasks and workflow

Add the steps Morgan follows during a sales call:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent.ts#tasks -->
```typescript
// Define the sales workflow
agent.promptAddSection('Your Tasks', {
  body: 'Complete sales process workflow with passion and expertise:',
  bullets: [
    'Greet customers warmly and introduce yourself',
    'Understand their specific PC building requirements',
    'Ask about budget, intended use, and preferences',
    'Provide knowledgeable recommendations',
    'Share your enthusiasm for PC building',
    'Offer to explain technical details when helpful',
  ],
});
```

### Step 6: Add voice instructions

Add a section that describes how Morgan should sound:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent.ts#voice-instructions -->
```typescript
// Voice and tone instructions
agent.promptAddSection('Voice Instructions', {
  body:
    'Share your passion for PC building and get excited about ' +
    'helping customers create their perfect system. Your enthusiasm ' +
    'should be genuine and infectious.',
});
```

The prompt's warm tone belongs to the persona. The model reads these sections as instructions, and callers hear the result.

## Adding voice and language

A language entry tells SignalWire which language the caller speaks and which text-to-speech voice answers.

### Step 7: Configure the voice

Add English with the `rime.marsh` voice:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent.ts#language -->
```typescript
// Configure language and voice
agent.addLanguage({
  name: 'English',
  code: 'en-US',
  voice: 'rime.marsh', // A friendly, enthusiastic voice
});
```

This tutorial gives each persona its own Rime voice: `rime.marsh` for Morgan, `rime.spore` for Alex and `rime.cove` for Sam. For the full list of voices, see the [SignalWire documentation](https://signalwire.com/docs).

## Running your agent

The last step starts the HTTP server, but only when you run the file. Tests and `swaig-test` import the file to reach `agent`, and don't need a server.

### Step 8: Start the server

Add the code that prints where the agent is and starts it:

<!-- snippet: no-compile a region of tutorial/multi_agents/sales_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/sales_agent.ts#main -->
```typescript
// Start the server only when this file is run, not when it's imported
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Starting PC Builder Sales Agent - Morgan');
  console.log(`Agent running at: ${agent.getFullUrl()}/`);
  console.log('Press Ctrl+C to stop');
  await agent.run();
}
```

Apart from the comment at the top, steps 1 and 3 through 8, in order, make up the whole file.

### Step 9: Run the agent

Every request to the agent needs basic auth. Without `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD`, the agent generates a password and keeps it out of the logs, so set both first. Then run the file with `tsx` from the root of the SDK repository:

```bash
export SWML_BASIC_AUTH_USER=devuser
export SWML_BASIC_AUTH_PASSWORD=devpassword
npx tsx tutorial/multi_agents/sales_agent.ts
```

The agent prints its address, and the SDK logs the address it listens on and the credentials' source:

```text
2026-09-29T17:33:51.165Z [WARN] [AgentBase] [signalwire] webhook signature validation is disabled — set signingKey or SIGNALWIRE_SIGNING_KEY to enable
Starting PC Builder Sales Agent - Morgan
Agent running at: http://localhost:3000/
Press Ctrl+C to stop
2026-09-29T17:33:51.170Z [INFO] [AgentBase] Agent 'PC Builder Sales Agent - Morgan' running at http://0.0.0.0:3000/
2026-09-29T17:33:51.170Z [INFO] [AgentBase] Auth: devuser:**** (source: environment)
```

The warning says the agent can't yet tell whether a request came from SignalWire. Lesson 4 sets `SIGNALWIRE_SIGNING_KEY` for production.

## Testing your agent

You can test the agent over HTTP while it runs, or load it with `swaig-test` without a server.

### Method 1: Request the SWML document

From a second terminal, request the SWML with curl, and pretty-print it with `jq`:

```bash
curl -u devuser:devpassword http://localhost:3000/ | jq .
```

A request without the credentials gets `401 Unauthorized`.

### Method 2: Use swaig-test

`swaig-test` loads the file, finds the agent it exports, and prints its SWML without starting a server:

```bash
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/sales_agent.ts --dump-swml
```

In a project that installs the SDK, the same command is `npx swaig-test tutorial/multi_agents/sales_agent.ts --dump-swml`.

### Understanding the SWML output

The agent returns this document, shortened here to its first prompt section. `answer` picks up the call, and `ai` carries the prompt and the voice:

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      {
        "answer": {}
      },
      {
        "ai": {
          "prompt": {
            "pom": [
              {
                "body": "You are Morgan, a passionate PC building expert and sales specialist at PC Builder Pro. You're known for your deep knowledge of components and your ability to match customers with their perfect build. You get excited about the latest hardware and love sharing that enthusiasm. Always introduce yourself by name.",
                "title": "AI Role"
              }
            ]
          },
          "languages": [
            {
              "name": "English",
              "code": "en-US",
              "voice": "rime.marsh"
            }
          ]
        }
      }
    ]
  }
}
```

The other three sections follow `AI Role` in the `pom` list, in the order you added them.

## Enabling SSL/HTTPS

SignalWire needs to reach the agent over the internet, and production traffic should be encrypted. The agent serves HTTPS itself when three environment variables name a certificate and key:

- `SWML_SSL_ENABLED`: `true`, `1` or `yes`
- `SWML_SSL_CERT_PATH`: the PEM certificate file
- `SWML_SSL_KEY_PATH`: the PEM private key file

With HTTPS on, the URLs the agent puts in its SWML for SignalWire to call back (its webhook URLs) use `https`. Set `SWML_SSL_DOMAIN` to the domain in the certificate, so those URLs use it instead of `localhost`. If a certificate or key file doesn't exist, the agent stops at startup with an `ENOENT` error that names the file.

### Method 1: Export the variables

Export the variables in the shell, then run the agent:

```bash
export SWML_SSL_ENABLED=true
export SWML_SSL_CERT_PATH=/path/to/your/certificate.pem
export SWML_SSL_KEY_PATH=/path/to/your/private-key.pem
export SWML_SSL_DOMAIN=agents.example.com

npx tsx tutorial/multi_agents/sales_agent.ts
```

### Method 2: Set them for one command

Set the same variables on the command that starts the agent:

```bash
SWML_SSL_ENABLED=true \
SWML_SSL_CERT_PATH=/path/to/cert.pem \
SWML_SSL_KEY_PATH=/path/to/key.pem \
SWML_SSL_DOMAIN=agents.example.com \
npx tsx tutorial/multi_agents/sales_agent.ts
```

### Self-signed certificates for development

For local testing, create a self-signed certificate with `openssl`:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=localhost"
```

Run the agent with it:

```bash
SWML_SSL_ENABLED=true \
SWML_SSL_CERT_PATH=cert.pem \
SWML_SSL_KEY_PATH=key.pem \
npx tsx tutorial/multi_agents/sales_agent.ts
```

The agent now reports HTTPS addresses:

```text
Agent running at: https://localhost:3000/
Press Ctrl+C to stop
2026-09-29T17:33:32.151Z [INFO] [AgentBase] Agent 'PC Builder Sales Agent - Morgan' running at https://0.0.0.0:3000/
```

curl rejects a self-signed certificate unless you pass `-k`:

```bash
curl -k -u devuser:devpassword https://localhost:3000/
```

A self-signed certificate is for development only. SignalWire won't trust it, so use a certificate from a certificate authority in production. You can also terminate TLS at a reverse proxy or load balancer, and set `SWML_PROXY_URL_BASE` to the agent's public `https://` URL. For more information, see [SSL/TLS](../../docs/security.md#ssltls) in the security guide.

## Summary

This lesson built a working agent. The main points:

- An agent is an `AgentBase` instance, configured with method calls
- `promptAddSection()` builds a structured prompt from titled sections
- `addLanguage()` sets the language and the voice
- `agent.run()` serves the SWML, over HTTPS when `SWML_SSL_ENABLED` and the certificate paths are set
- `curl` and `swaig-test` show the SWML without placing a call

### Practice exercises

Try these changes before you move on:

1. **Change Morgan's voice**: try `rime.spore` or `rime.cove`.
2. **Change the personality**: make Morgan more formal, or more casual.
3. **Add a section**: add a section about return policies or warranties.
4. **Change the port**: run the agent on port 3001 with `PORT=3001`.

### Troubleshooting

These problems come up most often in this lesson:

- **Port in use**: set `PORT` to another port, or stop the process that holds it.
- **`Cannot find module '@signalwire/sdk'`**: run `npm install`, and run the commands from the project root.
- **The agent serves HTTP when you expected HTTPS**: check that `SWML_SSL_ENABLED` is `true`. Set both path variables in the shell that starts the agent.
- **`ENOENT` at startup with SSL on**: a certificate or key path is wrong. The error names the file it couldn't open.

### Next steps

Next, give Morgan a knowledge base to search. Continue with [Lesson 2: Adding Intelligence with Knowledge Bases](lesson2_knowledge_bases.md).

---

[Tutorial Overview](README.md) | [Next: Lesson 2 - Adding Intelligence with Knowledge Bases](lesson2_knowledge_bases.md)
