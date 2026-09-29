# AI Chat

The SignalWire AI Chat service runs an agent as a text conversation. The SDK has three classes for it, exported from `@signalwire/sdk`:

- `AIChatClient` calls the service from your server, with your project credentials.
- `ChatGateway` is a Hono router you mount in your app. A chat widget in a browser uses the service through it, without holding an API token.
- `HandoffRouter` is a second Hono router. It moves one conversation between a phone call and the chat, and lets a browser type into a live call.

## Contents

The guide has these sections:

- [AIChatClient](#aichatclient)
  - [Credentials and the service URL](#credentials-and-the-service-url)
  - [Methods](#methods)
  - [Errors](#errors)
  - [Slow turns and the idle timeout](#slow-turns-and-the-idle-timeout)
  - [Conversation IDs](#conversation-ids)
- [ChatGateway](#chatgateway)
  - [Mount the gateway](#mount-the-gateway)
  - [The wire protocol](#the-wire-protocol)
  - [Page context in user_meta_data](#page-context-in-user_meta_data)
  - [What the gateway protects, and what it doesn't](#what-the-gateway-protects-and-what-it-doesnt)
  - [CORS](#cors)
  - [Streaming](#streaming)
  - [Rotate a key](#rotate-a-key)
  - [Gateway reference](#gateway-reference)
- [HandoffRouter](#handoffrouter)
  - [Register a call's nonce](#register-a-calls-nonce)
  - [Routes](#routes)
  - [The ordering guarantee](#the-ordering-guarantee)
  - [What the nonce protects, and what it doesn't](#what-the-nonce-protects-and-what-it-doesnt)
  - [HandoffRouter reference](#handoffrouter-reference)
- [Running more than one replica](#running-more-than-one-replica)
- [Related documentation](#related-documentation)

## AIChatClient

`AIChatClient` sends JSON-RPC 2.0 requests to the AI Chat service. Each request is a `POST` with HTTP Basic auth: the project ID is the username and the API token is the password. The credentials travel only in the `Authorization` header, never in the request body.

This example creates a conversation from an agent's config URL, sends one message, and prints the reply:

<!-- snippet: no-run needs a real project, API token and space, and a reachable agent config URL -->
```typescript
import { AIChatClient } from '@signalwire/sdk';

const client = new AIChatClient(); // reads SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE

const created = await client.createConversation('support.42', {
  configUrl: 'https://agent.example.com/',
});
console.log(created.initialMessage);

const reply = await client.chat('support.42', 'Where is my order?');
console.log(reply.text);

await client.end('support.42');
```

`configUrl` locates the agent config the conversation runs. The service fetches it like any other client, so an agent behind basic auth needs its credentials in the URL, as `agent.getFullUrl(true)` gives them.

### Credentials and the service URL

The constructor takes an `AIChatClientOptions` object. Each credential falls back to an environment variable:

| Option | Environment variable | Description |
|---|---|---|
| `project` | `SIGNALWIRE_PROJECT_ID` | Project ID, the Basic auth username. Required: the constructor throws without it. |
| `token` | `SIGNALWIRE_API_TOKEN` | API token, the Basic auth password |
| `space` | `SIGNALWIRE_SPACE` | Space name (`example`) or space hostname (`example.signalwire.com`) |
| `url` | none | Full service URL, used as it is |
| `readIdleTimeoutSeconds` | none | Seconds without data before a request is abandoned. Default 60; `0` turns it off. |
| `fetchImpl` | none | A `fetch` replacement, for tests |

The client picks the service URL in this order:

1. The `url` option.
2. `RAILS_DEV_MODE`, when it holds a URL. A boolean value (`true`, `false`, `1`, `0`, `yes`, `no`, `on` or `off`) doesn't count as a URL and is skipped.
3. `https://{space}.signalwire.com/api/ai/chat`, from `space` or `SIGNALWIRE_SPACE`. A value that contains a dot is used as the hostname: `example.signalwire.com` gives `https://example.signalwire.com/api/ai/chat`.

If none of the three resolves, the constructor throws. `RAILS_DEV_MODE` points the client at a development chat service, such as `http://localhost:8080/`.

### Methods

Every method returns a promise. The typed methods decode the JSON-RPC result, and throw an `AIChatError` when the response carries an error:

| Method | Service method | Returns |
|---|---|---|
| `createConversation(id, { configUrl, userMessage?, timeout?, reinit?, userMetadata? })` | `create_conversation` | `{ id, status, initialMessage }` |
| `chat(id, message, { role?, configUrl?, timeout?, reinit?, userMetadata? })` | `chat` | `{ text, conversationId, userEvent }` |
| `end(id)` | `end_conversation` | `true` when the service reports `ended` |
| `delete(id)` | `delete` | `true` when the service reports `deleted` |
| `log(id)` | `chat_log` | `{ messages, callTimeline }` |
| `summarize(id, { summaryPrompt?, temperature?, topP?, frequencyPenalty?, presencePenalty?, maxTokens? })` | `summarize` | The summary text |
| `rawPost(method, params)` | any | The `Response`, with its body unread |
| `close()` | none | Nothing; the client holds no connection pool |

The options map to these request fields:

- `timeout` is sent as `conversation_timeout`, in seconds of inactivity.
- `userMetadata` is sent as `user_meta_data`.
- `userMessage` is sent as `user_message`, the opening user message.
- `role` defaults to `user`.

On `chat()`, `configUrl` lets the service create the conversation if it doesn't exist yet, and `timeout` and `reinit` apply to that creation.

`summarize()` throws a `SummaryError` when the service reports that it couldn't generate the summary. The service sends that failure inside a successful JSON-RPC result, so without the check it would look like an empty summary.

The client supports `await using`: `Symbol.asyncDispose` calls `close()`.

### Errors

An error the service returns, a timeout and a response the client can't parse are each an `AIChatError`, with the JSON-RPC `code` (or `null`) and the service's message in `serverMessage`. A transport failure, such as a refused connection, is thrown as `fetch` threw it, usually a `TypeError`. These codes map to subclasses:

| Code | Error class |
|---|---|
| -32001 | `ConversationNotFoundError` |
| -32005, -32006 | `RateLimitError` |
| -32007 | `ChatInProgressError` |
| -32009 | `AuthenticationError` |
| none (summary failed) | `SummaryError` |

Other codes throw the base `AIChatError`. A body that isn't JSON throws `AIChatError` with the HTTP status as the code.

The client decides success from the JSON-RPC body, not the HTTP status. The service can send `200` before a slow turn finishes, so an error can arrive as `200` with an `error` object in the body.

### Slow turns and the idle timeout

A `chat()` call waits for a full model turn, which takes seconds. The service sends whitespace ahead of a slow response so that proxies don't close the connection. Leading whitespace is valid JSON, so parsing isn't affected.

The client has no limit on the whole request. It has an idle timeout instead: `readIdleTimeoutSeconds` (default 60) bounds the wait for the response headers and each wait for the next body chunk. Every chunk restarts it, so a turn the service keeps alive runs as long as it needs. A connection that sends nothing for that long is aborted, and the call fails with an `AIChatError` whose code is `null`.

`rawPost()` returns the response with its body unread, and applies the idle timeout to each read. Use it to relay the body to another client without buffering it. You interpret the result yourself, including an error under HTTP 200. Read the body to the end or cancel it, so the connection is released. This Hono route relays a turn:

```typescript
import { Hono } from 'hono';
import { AIChatClient } from '@signalwire/sdk';

const client = new AIChatClient();
const app = new Hono();

app.post('/relay', async (c) => {
  const { id, message } = await c.req.json<{ id: string; message: string }>();
  const upstream = await client.rawPost('chat', { id, message });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

A browser must not choose the conversation ID in a real relay, or it can continue anyone's conversation. `ChatGateway` solves that with signed handles.

### Conversation IDs

`createConversation()` logs a `conversation_id_will_be_sanitized` warning when an ID contains a character other than letters, digits, `_`, `-`, `.` and `:`. The SDK's source records that the service removes such characters without reporting an error. The warning names the ID the service stores, because anything you file under the requested ID can't be found under the stored one.

Use `.` to compose IDs, such as `root.2` for the second leg of `root`. `_` and `-` appear in the IDs `ChatGateway` generates, and `:` separates fields inside a gateway handle.

## ChatGateway

A chat widget runs in a page, and anything in the page is readable by every visitor. A SignalWire API token carries the whole project, and every chat turn is billed. `ChatGateway` holds the credential in your server and forwards requests on the widget's behalf:

```text
browser --(publishable key)--> your app --(project:token)--> chat service
```

The browser learns the gateway's URL and a publishable key. It doesn't learn the project, the space, the token, or which agent config runs. The gateway sends its own `config_url` on every call, so a key reaches only the agent it was issued for.

### Mount the gateway

`router()` returns a Hono app that serves the gateway at its root. Mount it on your agent with `mount()`:

```typescript
import { AgentBase, ChatGateway } from '@signalwire/sdk';

// SWML_PROXY_URL_BASE (https://support.example.com) is the agent's public URL.
const agent = new AgentBase({ name: 'support', route: '/' });

const gateway = new ChatGateway({
  // The one agent this key reaches, with its basic-auth credentials in the
  // URL, since the chat service fetches its SWML like any other client.
  configUrl: agent.getFullUrl(true),
  key: process.env['CHAT_WIDGET_KEY'], // what the widget carries
  allowedOrigins: ['https://shop.example.com'], // localhost is always allowed
});

agent.mount(gateway.router(), { prefix: '/chat' });
await agent.serve();
```

`mount()` takes the prefix from the host root, and keeps the mount when the agent rebuilds its app. A mounted app isn't behind the agent's basic auth, and the agent's CORS and CSRF middleware don't apply to it. The gateway answers its own preflights. Mount before calling `serve()`.

The gateway works on any Hono app too, with `app.route('/chat', gateway.router())`. Without a `client` option, the gateway builds an `AIChatClient` from the environment, so the constructor throws when `SIGNALWIRE_PROJECT_ID` or the service URL is missing. Pass `client` to supply your own; `close()` closes the client only when the gateway built it.

### The wire protocol

The browser sends every request as `POST {prefix}` with a JSON body and the key in an `Authorization: Bearer` header. The body's `method` is `start`, `chat`, `log` or `end`, and defaults to `chat`. Any other method gets a `400`.

The first `chat` has no handle. The gateway creates a conversation ID, signs it into a handle, and returns the handle in the `X-Chat-Handle` response header:

```http
POST /chat
Authorization: Bearer pk_live_example
Content-Type: application/json

{"message": "hi"}
```

The response body is the chat service's JSON-RPC response, relayed as it arrives. This is a captured response, with the handle shortened:

```http
HTTP/1.1 200 OK
X-Chat-Handle: Y2hhdC05aWxI...
Content-Type: application/json

   
{"jsonrpc":"2.0","result":{"response":"Your order ships tomorrow."},"id":"req-5"}
```

The browser keeps the handle and sends it with every later request, as `{"handle": "...", "message": "..."}`. Two properties of the relayed body matter to a widget:

- A failed turn arrives as a JSON-RPC `error` object under HTTP 200, because the service commits the status before the turn finishes. Check the body for `error`.
- The body can start with whitespace; see [Streaming](#streaming).

The other methods return JSON the gateway builds:

| Method | Needs a handle | Service call | Response body |
|---|---|---|---|
| `start` | No (creates one) | `create_conversation`, no user message | `{ greeting, status, timeout }` |
| `chat` | No (creates one) | `chat` | The service's JSON-RPC response, relayed |
| `log` | Yes | `chat_log` | `{ messages, timeout, last_activity }` |
| `end` | Yes | `end_conversation` | `{ status: 'ended' }` |

`start` opens the conversation with no user message, so the agent speaks first. This is a captured `start` response from a gateway with `conversationTimeout: 1800`:

```json
{"greeting":"Hi! How can I help?","status":"created","timeout":1800}
```

`log` returns what a widget needs to redraw a conversation after a page reload. This is a captured response:

```json
{
  "messages": [
    {"role": "assistant", "content": "Hi! How can I help?", "timestamp": 1786258737.147},
    {"role": "user", "content": "where is my order?", "timestamp": 1786258812.004}
  ],
  "timeout": 1800,
  "last_activity": 1786258813
}
```

The response has three parts:

- `messages` holds user and assistant turns with text, and nothing else. The service's log also holds the system prompt, tool calls and tool results; the gateway drops them.
- `timeout` is the conversation's idle timeout: `conversationTimeout`, or the service default of 3600 seconds when it isn't set. The service's responses don't report the deadline, so the gateway does.
- `last_activity` is the time of the newest message of any role, so a widget can restart its idle clock where it was. It's `null` when no message has a time.

All times are epoch seconds. The service stores microseconds, and the gateway converts them.

### Page context in user_meta_data

`start` and `chat` accept one field the gateway forwards instead of replacing: `user_meta_data`. It holds the page context a widget collects about itself, such as the page URL and title. This `start` request sends it:

```http
POST /chat
Authorization: Bearer pk_live_example
Content-Type: application/json

{"method": "start", "user_meta_data": {"page": {"title": "Pricing", "url": "https://shop.example.com/pricing"}}}
```

The gateway sends it to the service as `user_meta_data`. According to the Python SDK's gateway guide, the service passes it to the agent's config request under `params.user_meta_data`. The service reads it only when it creates the conversation. Metadata on later turns is accepted and not used, so the agent sees the page where the conversation started.

The browser writes this field, so treat it as the visitor's claim about themselves, never as authority. A page can put anything in it, including text aimed at your prompt. The gateway checks it before it counts a new conversation against the cap:

- A value that isn't a JSON object gets `400`.
- A value larger than `MAX_USER_METADATA_BYTES` (8192 bytes, serialized as compact JSON with non-ASCII characters counted as their `\u` escapes) gets `413`.
- An empty object is dropped.

The value stays under its own key, so it can't replace the conversation `id` or the `config_url` the gateway sets.

### What the gateway protects, and what it doesn't

A publishable key is public: it's in the page. Plan for someone else holding it.

The key can't read other conversations. The browser never names a conversation: it presents a handle, which is the conversation ID and an expiry signed with HMAC-SHA256. The gateway checks the signature first and the expiry second, and refuses a bad handle with `403`. A handle can't be guessed or edited, and `log` returns only the dialogue of the handle's own conversation.

The key can start and continue conversations, and each turn costs money. The caps are the main control:

| Option | Default | Limits |
|---|---|---|
| `maxNewConversations` | 60 per `windowSeconds` (60) | How many conversations the gateway creates |
| `maxTurns` | 200 | `chat` turns in one conversation |

A cap that's hit returns `429`. `maxNewConversations` matters most: a leaked key used to open many one-turn conversations is billed for each opening turn, and a per-conversation limit wouldn't catch that.

The gateway protects these things:

- The API token, project and space stay on the server.
- A key reaches only its gateway's `configUrl`; the browser can't choose the agent.
- The key is compared in constant time, and a wrong or missing key gets `401`.
- A handle can't be forged or edited without the signing secret.
- The browser sees user and assistant text, not the system prompt or tool traffic.

These are the limits of that protection:

- **The key isn't user authentication.** Anyone with the page has it. The gateway doesn't know who the visitor is.
- **The origin allowlist is leak containment, not access control.** Browsers send the page's origin, so a key pasted into another site's page gets `403`. A request with no `Origin` header is allowed, because server-side callers send none. A script can also send any value it likes.
- **A handle is a bearer token until it expires.** Whoever holds it can continue, read (`log`) and end that conversation. `end` doesn't revoke it; it stays valid for `handleTtl` (24 hours by default).
- **The caps are counted in the process.** Behind several replicas, each keeps its own counts. The effective cap is the cap times the replica count, so put a shared limiter in front if that matters.
- **The gateway doesn't limit the size of `message`** or of the request body. Only `user_meta_data` has a size limit.
- **A refusal reason names its category.** A bad handle is reported as `invalid handle` or `expired handle`. A cap is reported as `too many new conversations` or `conversation turn limit reached`.

The gateway returns these statuses itself; everything else comes from the service:

| Status | Body `error` | Cause |
|---|---|---|
| 400 | `bad request`, `body must be an object`, `method not allowed`, `message is required`, `log requires a handle`, `end requires a handle`, `malformed handle`, `user_meta_data must be an object` | The request is malformed |
| 401 | `bad key` | The key is missing or wrong |
| 403 | `origin not allowed`, `invalid handle`, `expired handle` | The origin isn't allowed, or the handle doesn't verify |
| 413 | `user_meta_data too large` | `user_meta_data` is over 8192 bytes |
| 429 | `too many new conversations`, `conversation turn limit reached` | A cap was hit |
| 502 | `chat service error` | The service call failed before any of the reply was sent |

A `start`, `log` or `end` whose service call returns a JSON-RPC error also gets `502`, because the gateway reads those results itself.

### CORS

The allowlist also sets the CORS headers. An allowed origin gets `Access-Control-Allow-Origin` with its own value, `Access-Control-Expose-Headers: X-Chat-Handle` and `Vary: Origin` on every response, refusals included. A preflight (`OPTIONS`) from an allowed origin gets `204` with `Access-Control-Allow-Headers: Authorization, Content-Type`, `Access-Control-Allow-Methods: POST, OPTIONS` and `Access-Control-Max-Age: 600`. Any other origin gets no CORS headers.

Origins are compared as whole strings, without a trailing slash, so `https://shop.example.com.evil.test` doesn't match `https://shop.example.com`. The hosts `localhost`, `127.0.0.1` and `::1`, and any host that ends in `.localhost`, are always allowed, on any port and scheme.

### Streaming

The gateway relays a `chat` response body without buffering it. The service pads a slow turn with whitespace so that proxies don't close the connection. A relay that waited for the whole body would hold the padding back and bring the timeout into your own stack.

That's why a new handle comes back in a header. Headers go out before the body, so the widget has its handle without waiting for the turn. If you put another proxy in front of the gateway, make sure it doesn't buffer responses either. The client's idle timeout applies to each read of the relayed body.

### Rotate a key

The key has no expiry, because it lives in a static page. To rotate it, construct the gateway with a new `key` and redeploy. To invalidate outstanding handles too, change `secret` at the same time.

### Gateway reference

The constructor takes a `ChatGatewayOptions` object. Only `configUrl` is required:

| Option | Default | Description |
|---|---|---|
| `configUrl` | none | The agent config every call uses. The constructor throws when it's empty. |
| `key` | `SIGNALWIRE_CHAT_GATEWAY_KEY`, else a generated `pk_` key | The publishable key. A generated key is useful only to a process that also serves the page. |
| `allowedOrigins` | `[]` | Origins allowed besides localhost |
| `client` | Built from the environment | The `AIChatClient` to forward with |
| `secret` | `SIGNALWIRE_CHAT_GATEWAY_SECRET`, else 32 random bytes | The HMAC key for handles. A random secret invalidates handles on restart and across replicas. |
| `handleTtl` | 86400 | Seconds a handle stays valid |
| `conversationTimeout` | `null` (the service default, 3600) | Idle seconds before the service ends a conversation, sent on `start` and `chat` |
| `maxNewConversations` | 60 | New conversations per window |
| `maxTurns` | 200 | `chat` turns per conversation |
| `windowSeconds` | 60 | The window for `maxNewConversations` |

The gateway also has methods for use outside Hono, or for server-side handles:

| Member | Description |
|---|---|
| `router()` | The Hono app to mount |
| `prepare(body, { origin, key })` | Checks a request and returns `[method, params, mintedHandle]`, the service call to make |
| `mintHandle(conversationId?)` | Signs a handle, for a new random ID when none is given |
| `readHandle(handle)` | Returns the conversation ID, or throws a `GatewayRejection` |
| `checkKey(key)`, `checkOrigin(origin)` | The key and origin checks, which throw a `GatewayRejection` |
| `readUserMetadata(body)` | The `user_meta_data` check |
| `ChatGateway.visibleMessages(messages)` | The dialogue a browser may see |
| `ChatGateway.lastActivity(messages)` | Epoch seconds of the newest message, or `null` |
| `effectiveTimeout` | `conversationTimeout`, or 3600 when it isn't set |
| `close()` | Closes the client, if the gateway built it |

A `GatewayRejection` has `status` (400, 401, 403, 413 or 429) and `reason`, the text sent to the browser.

## HandoffRouter

`HandoffRouter` serves three routes a browser client uses beside a `ChatGateway`. The SignalWire address widget calls them at `{gateway-url}/handoff`, `{gateway-url}/escalate` and `{gateway-url}/say`, and sends `handoff_nonce` and `chat_handle` as user variables when it places a call.

The router implements the wire contract: the routes, the nonce, the ordering guarantee and the per-call limit. Your application supplies the rest as callbacks, such as where a leg's transcript is written and how a call is ended.

### Register a call's nonce

A browser can't be trusted to name a call. Sending text into a call needs its call ID, and a page that could supply one could send speech into someone else's call. Instead, the browser puts a random `handoff_nonce` in the user variables of the call it places. Your agent's per-call configuration registers that nonce against the call ID from the platform's request. Later, presenting the nonce shows that the browser placed that call.

This example mounts both routers at the same prefix and registers each call's nonce. It uses the REST client to end calls and to send text into them:

```typescript
import { AgentBase, ChatGateway, HandoffRouter, restClient, userVariables } from '@signalwire/sdk';

// Your code: resolve true once the leg's transcript is stored.
declare function waitForRecord(conversationId: string, medium: string): Promise<boolean>;

const agent = new AgentBase({ name: 'support', route: '/' });
const gateway = new ChatGateway({
  configUrl: agent.getFullUrl(true),
  allowedOrigins: ['https://shop.example.com'],
});
const rest = restClient();

const handoff = new HandoffRouter({
  gateway,
  captureLeg: (conversationId, medium) => waitForRecord(conversationId, medium),
  endCall: async (callId) => {
    await rest.calling.end(callId);
  },
  sendMessage: async (callId, text) => {
    await rest.calling.aiMessage(callId, { role: 'user', message_text: text });
    return true;
  },
});

agent.addPerCallConfig((_query, body) => {
  const vars = userVariables(body);
  const nonce = vars['handoff_nonce'];
  const callId = body.call?.call_id;
  if (typeof nonce !== 'string' || !callId) return;

  // A call started from a chat continues that conversation as its next leg.
  let conversationId = callId;
  const chatHandle = vars['chat_handle'];
  if (typeof chatHandle === 'string') {
    try {
      conversationId = handoff.nextConversationId(gateway.readHandle(chatHandle));
    } catch {
      // Not a handle this gateway issued: treat the call as a new conversation.
    }
  }
  handoff.register(nonce, { conversationId, callId });
});

agent.mount(gateway.router(), { prefix: '/chat' });
agent.mount(handoff.router(), { prefix: '/chat' });
await agent.serve();
```

Take `callId` from the request the platform sent, never from anything the browser supplied. The callback runs on every config request for the call, so registering a nonce again changes nothing: the first registration's call, time and message count stand, and a nonce that `/handoff` has used stays used until it would have expired. `restClient()` reads `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN` and `SIGNALWIRE_SPACE`. `calling.end()` sends the `calling.end` command, and `calling.aiMessage()` sends `calling.ai_message`.

### Routes

Each route takes a JSON body. The browser derives all three paths from the gateway's URL, so mount the router at the gateway's prefix:

| Route | Body | Success | What it does |
|---|---|---|---|
| `POST /handoff` | `{ nonce }` | `200 { handle }` | Ends the call, waits for its record, and returns a handle for the next leg as a chat. Uses up the nonce. |
| `POST /escalate` | `{ handle }` | `200 { ok: true }` | Waits for the chat leg's record, before the browser places a call |
| `POST /say` | `{ nonce, text }` | `200 { ok: true }` | Sends the trimmed text to the nonce's call with `sendMessage` |

These routes return errors:

- `403 { error: 'origin not allowed' }` for an origin the gateway doesn't allow, on every route.
- `404 { error: 'not found' }` when a nonce or handle doesn't verify. An unknown, expired or used nonce gets the same answer, so the routes can't be used to learn whether a call is live.
- `404` from `/say` also when typing is off (no `sendMessage`), the text is empty, the call's limit is reached, or `sendMessage` threw or returned `false`.
- `400 { error: 'bad request' }` from `/escalate` when `handle` is missing.

These are captured responses from the three routes, with the handle shortened:

```text
POST /chat/say       {"nonce":"nonce-1","text":" hello "}  200 {"ok":true}
POST /chat/handoff   {"nonce":"nonce-1"}                   200 {"handle":"Y2hhdC1hYmMuMToxNzkw..."}
POST /chat/handoff   {"nonce":"nonce-1"}                   404 {"error":"not found"}
POST /chat/say       {"nonce":"nonce-1","text":"hello"}    404 {"error":"not found"}
POST /chat/escalate  {}                                    400 {"error":"bad request"}
```

The last two lines show that a redeemed nonce no longer works for `/say` either.

Each route answers its own `OPTIONS` preflight. An origin the gateway allows gets `Access-Control-Allow-Origin` and `Vary: Origin` on every response; its preflight also gets `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Methods: POST, OPTIONS` and `Access-Control-Max-Age: 600`.

The default `nextConversationId` names legs with a dot: `root` becomes `root.1`, and `root.1` becomes `root.2`. An ended conversation can't be reopened, so each leg needs a new ID.

### The ordering guarantee

A medium doesn't start until the one it replaces has ended and its record is written. Without the wait, the new leg's config request can run before the record exists, and the new leg starts with no history.

`/handoff` calls `endCall(callId)`, then `captureLeg(conversationId, 'voice')`, and issues the handle after that. `/escalate` calls `captureLeg(conversationId, 'chat')` and answers after it. `captureLeg` should return `true` once the record is written.

The wait has limits:

- It lasts at most `captureTimeout` seconds (8 by default). After that, or if `captureLeg` throws, the router logs a warning and continues without the record.
- Without `captureLeg`, nothing waits, and the guarantee doesn't hold.
- A failing `endCall` is logged, and the handoff continues.

### What the nonce protects, and what it doesn't

`/handoff` and `/say` check a nonce, and `/escalate` checks a handle; all three check the origin. None of them checks the publishable key.

The nonce protects these things:

- A browser can send text only into the call its nonce was registered for. `/say` finds the call by nonce and forwards only the text, never a call ID or `global_data` from the request.
- `/handoff` works once per nonce. The nonce is used up before the call is ended, even if a later step fails.
- Registering a nonce again doesn't reset its message count, revive it after `/handoff`, or move it to another call.
- A browser can switch to a chat leg only with a nonce from its own call.

These are the limits of that protection:

- **A nonce is a bearer secret.** Whoever holds it can type into the call and take over the conversation through `/handoff`. It's as strong as the random value the browser generates.
- **Typing lasts until the nonce is redeemed or expires.** `nonceTtl` (3600 seconds by default) counts from registration, not from the last message. After that, or after `/handoff`, `/say` returns `404` even when the call is still live.
- **Each typed message is a billed turn.** `maxMessagesPerCall` (200 by default) caps them per nonce. A message that isn't delivered doesn't count.
- **The nonce table is in the process.** A redemption must reach the replica that registered the nonce. Run one replica, route calls to the same replica, or pass a `registry` backed by shared storage.
- **A handle is enough for `/escalate`.** It triggers your `captureLeg` for the chat leg, so make `captureLeg` safe to run more than once.

### HandoffRouter reference

The constructor takes a `HandoffRouterOptions` object. Only `gateway` is required:

| Option | Default | Description |
|---|---|---|
| `gateway` | none | The `ChatGateway` that issues and reads handles and checks origins |
| `captureLeg` | none | `(conversationId, medium) => boolean \| Promise<boolean>`: ends a leg and writes its record; `medium` is `voice` or `chat` |
| `endCall` | none | `(callId) => void \| Promise<void>`: hangs the call up |
| `sendMessage` | none | `(callId, text) => boolean \| Promise<boolean>`: sends typed text into the call. Without it, `/say` returns 404. |
| `nextConversationId` | Appends `.N` | The ID of the next leg |
| `nonceTtl` | 3600 | Seconds a nonce stays usable, from registration |
| `maxMessagesPerCall` | 200 | Typed messages per nonce |
| `captureTimeout` | 8 | Seconds to wait for `captureLeg` |
| `registry` | A new `Map` | The nonce table, a `Map<string, NonceEntry>` |

The router's methods are `router()`, `register(nonce, { conversationId, callId })`, `redeem(nonce)`, `escalate(handle)` and `say(nonce, text)`. `redeem()` returns the new handle or `null`; `escalate()` and `say()` return `true` on success.

## Running more than one replica

The three classes keep some state in the process. This table lists what each replica needs:

| State | Where it lives | Across replicas and restarts |
|---|---|---|
| Handle signing secret | `secret` or `SIGNALWIRE_CHAT_GATEWAY_SECRET` | Set the same value everywhere, or handles from one replica fail on another and after a restart |
| Publishable key | `key` or `SIGNALWIRE_CHAT_GATEWAY_KEY` | Set the same value everywhere; a generated key differs per process |
| Conversation and turn caps | Each gateway's memory | Counted per replica |
| Handoff nonces | `registry` | Pass a shared `registry`, or route a call's requests to one replica |

The agent's own tool tokens have the same requirement: set `swaigSecret` or `SIGNALWIRE_SWAIG_SECRET`. For more information, see the [security guide](security.md).

## Related documentation

For more information, see these documents:

- [Agent guide](agent-guide.md): `mount()`, `addPerCallConfig()` and the agent routes
- [Configuration reference](configuration.md): the AI Chat environment variables
- [Security guide](security.md): basic auth, tool tokens and webhook signatures
- [REST client guide](../rest/docs/guide.md): the `calling` commands used to end calls and send text
