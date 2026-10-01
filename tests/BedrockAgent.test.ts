/**
 * BedrockAgent's amazon_bedrock rendering. It stored maxTokens but never
 * rendered it, dropped the presence_penalty and frequency_penalty settings
 * the Bedrock prompt object defines, and setPromptLlmParams() ignored every
 * setting. Mirrors signalwire-python fbd4be7 (B12, B13, B14): the rendered
 * verb is validated against the SWML schema. The platform's Bedrock session
 * (mod_openai bedrock_config.cpp) reads only the prompt's text or pom,
 * voice_id, temperature and top_p, so confidence and the penalties are
 * ignored with a warning (signalwire-python 623cf3e).
 */

import { BedrockAgent } from '../src/agents/BedrockAgent.js';
import { SchemaUtils } from '../src/SchemaUtils.js';

type Doc = { sections: { main: Record<string, unknown>[] } };

function bedrockVerb(agent: BedrockAgent): Record<string, unknown> {
  const doc = JSON.parse(agent.renderSwml()) as Doc;
  return doc.sections.main.find((v) => 'amazon_bedrock' in v)!['amazon_bedrock'] as Record<
    string,
    unknown
  >;
}

const promptOf = (agent: BedrockAgent) => bedrockVerb(agent)['prompt'] as Record<string, unknown>;

function makeAgent(): BedrockAgent {
  const agent = new BedrockAgent({ name: 'bedrock', voiceId: 'tiffany', maxTokens: 512 });
  agent.setPromptText('You are a helpful assistant.');
  agent.setPromptLlmParams({
    presence_penalty: 0.3,
    frequency_penalty: 0.2,
    confidence: 0.5,
    barge_confidence: 0.4,
  });
  return agent;
}

describe('BedrockAgent prompt', () => {
  it('renders an amazon_bedrock verb in place of ai', () => {
    const doc = JSON.parse(makeAgent().renderSwml()) as Doc;
    expect(doc.sections.main.some((v) => 'ai' in v)).toBe(false);
    expect(doc.sections.main.some((v) => 'amazon_bedrock' in v)).toBe(true);
  });

  it('carries max_tokens', () => {
    expect(promptOf(makeAgent())['max_tokens']).toBe(512);
  });

  it('takes max_tokens from setInferenceParams', () => {
    const agent = makeAgent();
    agent.setInferenceParams(undefined, undefined, 2048);
    expect(promptOf(agent)['max_tokens']).toBe(2048);
  });

  it('drops the prompt settings the Bedrock session does not read', () => {
    const prompt = promptOf(makeAgent());
    expect(prompt['voice_id']).toBe('tiffany');
    for (const key of ['presence_penalty', 'frequency_penalty', 'confidence', 'barge_confidence']) {
      expect(prompt).not.toHaveProperty(key);
    }
  });

  it('routes temperature, top_p and max_tokens from setPromptLlmParams to the inference settings', () => {
    const agent = makeAgent();
    agent.setPromptLlmParams({ temperature: 0.2, top_p: 0.5, max_tokens: 300 });
    expect(promptOf(agent)).toMatchObject({ temperature: 0.2, top_p: 0.5, max_tokens: 300 });
  });

  it('warns about a setting the Bedrock session does not use', () => {
    const agent = new BedrockAgent();
    const warn = vi.spyOn((agent as unknown as { log: { warn: () => void } }).log, 'warn');
    expect(agent.setPromptLlmParams({ barge_confidence: 0.4, confidence: 0.5 })).toBe(agent);
    expect(warn).toHaveBeenCalledWith(
      "setPromptLlmParams(): the platform's Bedrock session doesn't use barge_confidence, confidence, so they're ignored",
    );
  });

  it('renders a verb the SWML schema accepts', () => {
    const result = new SchemaUtils().validateVerb('amazon_bedrock', bedrockVerb(makeAgent()));
    expect(result.errors).toEqual([]);
  });

  it('renders a verb the SWML schema accepts for an agent with contexts', () => {
    const agent = makeAgent();
    agent.defineContexts().addContext('default').addStep('greet').setText('Say hello.');
    const result = new SchemaUtils().validateVerb('amazon_bedrock', bedrockVerb(agent));
    expect(result.errors).toEqual([]);
  });

  it('passes schema validation with a voice outside the known list', () => {
    // The engine-derived schema lists Bedrock's known voices but marks an
    // unlisted voice_id as ignored, not rejected, so validation accepts it.
    const agent = new BedrockAgent({ voiceId: 'inworld.Mark' });
    agent.setPromptText('You are a helpful assistant.');
    const result = new SchemaUtils().validateVerb('amazon_bedrock', bedrockVerb(agent));
    expect(result).toEqual({ valid: true, errors: [] });
  });
});

describe('BedrockAgent debug events', () => {
  it('carries debug webhook config through into params', () => {
    // The rewrite rebuilds the verb from a fixed key allowlist, so a key
    // outside it is dropped. debug_webhook_url / debug_webhook_level are
    // `params` members (not ai top-level keys), so they survive the rewrite.
    const agent = makeAgent();
    agent.enableDebugEvents(2);
    const params = bedrockVerb(agent)['params'] as Record<string, unknown>;

    expect(params['debug_webhook_url']).toBeDefined();
    expect(params['debug_webhook_url']).toContain('/debug_events');
    expect(params['debug_webhook_level']).toBe(2);
  });
});
