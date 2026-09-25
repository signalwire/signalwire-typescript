/**
 * BedrockAgent's amazon_bedrock rendering. It stored maxTokens but never
 * rendered it, dropped the presence_penalty and frequency_penalty settings
 * the Bedrock prompt object defines, and setPromptLlmParams() ignored every
 * setting. Mirrors signalwire-python fbd4be7 (B12, B13, B14): the rendered
 * verb is validated against the SWML schema.
 */

import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { BedrockAgent } from '../src/agents/BedrockAgent.js';

/**
 * The whole rendered document against the SWML schema, as the reference's
 * validate_document does. SchemaUtils.validateVerb can't be used here: for a
 * verb whose schema refers back to the document schema (amazon_bedrock, among
 * others) it falls back to checking required properties only.
 */
const validateDocument = (() => {
  const schema = JSON.parse(readFileSync(new URL('../src/schema.json', import.meta.url), 'utf8'));
  const Ajv = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  return new Ajv({ allErrors: true, strict: false, logger: false }).compile(schema);
})();

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
      "setPromptLlmParams(): Bedrock's prompt doesn't define barge_confidence, so they're ignored",
    );
  });

  it('renders a document the SWML schema accepts', () => {
    expect(validateDocument(JSON.parse(makeAgent().renderSwml()))).toBe(true);
  });

  it('fails schema validation with a voice Bedrock does not offer', () => {
    const agent = new BedrockAgent({ voiceId: 'inworld.Mark' });
    agent.setPromptText('You are a helpful assistant.');
    expect(validateDocument(JSON.parse(agent.renderSwml()))).toBe(false);
  });
});
