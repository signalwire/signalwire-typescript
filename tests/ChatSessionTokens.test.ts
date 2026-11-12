/**
 * A chat session's requests carry the token minted for its conversation.
 *
 * The chat service fetches an agent's SWML under the conversation's id, so the
 * SDK mints that SWML's tokens (each secure function's, and the post-prompt
 * URL's) for the conversation id. It then sends every request under its own
 * runtime call id, with the conversation's id as `conversation_id` (mod_openai
 * ais_get_post_data, and the function post_data in actions.c). Comparing the
 * token with `call_id` alone refused every secure function call and every
 * post-prompt summary in chat. From signalwire-python #166.
 */

import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');
const CONVERSATION = 'chat--2A8gj_DXZDQc2tPtpKigQ6V';
const RUNTIME_CALL = '78a8fdfa-8d7c-4a09-ad6d-9cd749516d32';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;

function chatAgent(summaries: unknown[]): AgentBase {
  const agent = new AgentBase({ name: 'chat', route: '/', basicAuth: ['u', 'p'] });
  agent.setPromptText('Help the caller.');
  agent.setPostPrompt('Summarize the conversation.');
  agent.onSummary = async (_summary, rawData) => void summaries.push(rawData);
  agent.defineTool({
    name: 'lookup',
    description: 'Look up',
    handler: () => new FunctionResult('found'),
    secure: true,
  });
  return agent;
}

function post(agent: AgentBase, path: string, body: Json): Promise<Response> {
  return Promise.resolve(
    agent.getApp().request(path, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

/** The post-prompt and lookup tokens the SWML fetched for `callId` carries. */
async function tokens(agent: AgentBase, callId: string): Promise<[string, string]> {
  const res = await post(agent, '/', { call: { call_id: callId } });
  expect(res.status).toBe(200);
  const main = ((await res.json()) as Json)['sections']['main'] as Json[];
  const ai = main.find((v) => 'ai' in v)!['ai'] as Json;
  const token = (url: string) => new URL(url).searchParams.get('__token')!;
  const lookup = (ai['SWAIG']['functions'] as Json[]).find((f) => f['function'] === 'lookup')!;
  return [token(ai['post_prompt_url']), token(lookup['web_hook_url'])];
}

async function postPrompt(agent: AgentBase, token: string, conversationId?: string) {
  const body: Json = {
    call_id: RUNTIME_CALL,
    action: 'post_conversation',
    post_prompt_data: { raw: 'The caller asked about pricing.' },
  };
  if (conversationId !== undefined) body['conversation_id'] = conversationId;
  return (await post(agent, `/post_prompt?__token=${token}`, body)).status;
}

async function callLookup(agent: AgentBase, token: string, conversationId?: string) {
  const body: Json = { function: 'lookup', argument: { parsed: [{}] }, call_id: RUNTIME_CALL };
  if (conversationId !== undefined) body['conversation_id'] = conversationId;
  const res = await post(agent, `/swaig?__token=${token}`, body);
  return String(((await res.json()) as Json)['response']);
}

describe('a chat session', () => {
  it('has its summary accepted under the runtime call id', async () => {
    const summaries: Json[] = [];
    const agent = chatAgent(summaries);
    const [postPromptToken] = await tokens(agent, CONVERSATION);
    expect(await postPrompt(agent, postPromptToken, CONVERSATION)).toBe(200);
    expect(summaries[0]?.['call_id']).toBe(RUNTIME_CALL);
  });

  it('runs a secure tool', async () => {
    const agent = chatAgent([]);
    const [, lookupToken] = await tokens(agent, CONVERSATION);
    expect(await callLookup(agent, lookupToken, CONVERSATION)).toBe('found');
  });

  it('still needs a token that names this conversation', async () => {
    const agent = chatAgent([]);
    const [postPromptToken, lookupToken] = await tokens(agent, CONVERSATION);
    expect(await postPrompt(agent, postPromptToken, 'chat--another')).toBe(403);
    expect(await postPrompt(agent, postPromptToken)).toBe(403);
    expect(await callLookup(agent, lookupToken, 'chat--another')).not.toBe('found');
    expect(await callLookup(agent, lookupToken)).not.toBe('found');
  });

  it("doesn't let a token for one function run another", async () => {
    const agent = chatAgent([]);
    const [postPromptToken] = await tokens(agent, CONVERSATION);
    expect(await callLookup(agent, postPromptToken, CONVERSATION)).not.toBe('found');
  });

  it('ignores a conversation_id that is not a string', async () => {
    const agent = chatAgent([]);
    const [postPromptToken, lookupToken] = await tokens(agent, CONVERSATION);
    const body: Json = {
      function: 'lookup',
      argument: { parsed: [{}] },
      call_id: RUNTIME_CALL,
      conversation_id: [CONVERSATION],
    };
    const res = await post(agent, `/swaig?__token=${lookupToken}`, body);
    expect(String(((await res.json()) as Json)['response'])).not.toBe('found');
    const summary = await post(agent, `/post_prompt?__token=${postPromptToken}`, {
      call_id: RUNTIME_CALL,
      conversation_id: { id: CONVERSATION },
      post_prompt_data: { raw: 'x' },
    });
    expect(summary.status).toBe(403);
  });
});

describe('a voice call', () => {
  it('is unchanged: the SWML and every request carry the same call id', async () => {
    const agent = chatAgent([]);
    const [postPromptToken, lookupToken] = await tokens(agent, RUNTIME_CALL);
    expect(await postPrompt(agent, postPromptToken)).toBe(200);
    expect(await callLookup(agent, lookupToken)).toBe('found');
  });
});
