/**
 * BedrockAgent's amazon_bedrock rendering. It stored maxTokens but never
 * rendered it, dropped the presence_penalty and frequency_penalty settings
 * the Bedrock prompt object defines, and setPromptLlmParams() ignored every
 * setting. Mirrors signalwire-python fbd4be7 (B12, B13, B14): the rendered
 * verb is validated against the SWML schema.
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

  it('keeps the settings the Bedrock prompt defines, and drops barge_confidence', () => {
    const prompt = promptOf(makeAgent());
    expect(prompt).toMatchObject({
      presence_penalty: 0.3,
      frequency_penalty: 0.2,
      confidence: 0.5,
      voice_id: 'tiffany',
    });
    expect(prompt).not.toHaveProperty('barge_confidence');
  });

  it('routes temperature, top_p and max_tokens from setPromptLlmParams to the inference settings', () => {
    const agent = makeAgent();
    agent.setPromptLlmParams({ temperature: 0.2, top_p: 0.5, max_tokens: 300 });
    expect(promptOf(agent)).toMatchObject({ temperature: 0.2, top_p: 0.5, max_tokens: 300 });
  });

  it('warns about a setting the Bedrock prompt does not define', () => {
    const agent = new BedrockAgent();
    const warn = vi.spyOn((agent as unknown as { log: { warn: () => void } }).log, 'warn');
    expect(agent.setPromptLlmParams({ barge_confidence: 0.4, confidence: 0.5 })).toBe(agent);
    expect(warn).toHaveBeenCalledWith(
      "setPromptLlmParams(): Bedrock's prompt doesn't define barge_confidence, so it's ignored",
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

  it('fails schema validation with a voice Bedrock does not offer', () => {
    const agent = new BedrockAgent({ voiceId: 'inworld.Mark' });
    agent.setPromptText('You are a helpful assistant.');
    const result = new SchemaUtils().validateVerb('amazon_bedrock', bedrockVerb(agent));
    expect(result.errors[0]).toContain('voice_id must be one of');
  });
});
