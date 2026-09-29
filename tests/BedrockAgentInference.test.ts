/**
 * BedrockAgent's temperature, top_p and max_tokens must be numbers: a value
 * such as "hot" reached the SWML, which the schema rejects and where the
 * platform fails to set up the Bedrock connection. The constructor,
 * setInferenceParams() and setPromptLlmParams() convert numeric strings and
 * throw for anything else, leaving the settings unchanged. temperature and
 * top_p also take a SWML variable reference, which the schema allows.
 * Mirrors signalwire-python 3c85e38.
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

function agentWith(config: ConstructorParameters<typeof BedrockAgent>[0] = {}): BedrockAgent {
  const agent = new BedrockAgent(config);
  agent.setPromptText('Hi.');
  return agent;
}

// Values a JavaScript caller, or a config file, can pass past the types.
const loose = (value: unknown) => value as number;

describe('BedrockAgent inference settings', () => {
  it('converts numeric strings from the constructor', () => {
    const agent = agentWith({ temperature: '0.5', topP: ' 0.8 ', maxTokens: '300' });
    expect(promptOf(agent)).toMatchObject({ temperature: 0.5, top_p: 0.8, max_tokens: 300 });
    expect(new SchemaUtils().validateVerb('amazon_bedrock', bedrockVerb(agent)).errors).toEqual([]);
  });

  it('passes a SWML variable reference through for temperature and top_p', () => {
    const agent = agentWith({ temperature: '${temperature}', topP: '%{top_p}' });
    expect(promptOf(agent)).toMatchObject({ temperature: '${temperature}', top_p: '%{top_p}' });
    expect(new SchemaUtils().validateVerb('amazon_bedrock', bedrockVerb(agent)).errors).toEqual([]);
  });

  it.each([
    ['temperature', { temperature: 'hot' }, 'BedrockAgent temperature must be a number, got "hot"'],
    ['top_p', { topP: loose(true) }, 'BedrockAgent top_p must be a number, got true'],
    [
      'temperature',
      { temperature: loose(NaN) },
      'BedrockAgent temperature must be a number, got NaN',
    ],
    ['top_p', { topP: '' }, 'BedrockAgent top_p must be a number, got ""'],
    ['top_p', { topP: '0x1' }, 'BedrockAgent top_p must be a number, got "0x1"'],
    [
      'max_tokens',
      { maxTokens: '${max}' },
      'BedrockAgent max_tokens must be an integer, got "${max}"',
    ],
    ['max_tokens', { maxTokens: 10.5 }, 'BedrockAgent max_tokens must be an integer, got 10.5'],
    ['max_tokens', { maxTokens: loose({}) }, 'BedrockAgent max_tokens must be an integer, got {}'],
  ])('throws for a %s the schema rejects: %j', (_name, config, message) => {
    expect(() => new BedrockAgent(config)).toThrow(message);
  });

  it('converts and checks setInferenceParams values', () => {
    const agent = agentWith();
    agent.setInferenceParams('0.2', '${top_p}', '2048');
    expect(promptOf(agent)).toMatchObject({
      temperature: 0.2,
      top_p: '${top_p}',
      max_tokens: 2048,
    });
  });

  it('leaves every setting unchanged when setInferenceParams refuses one', () => {
    const agent = agentWith({ temperature: 0.7, topP: 0.9, maxTokens: 1024 });
    expect(() => agent.setInferenceParams(0.1, 0.2, loose('lots'))).toThrow(
      'BedrockAgent max_tokens must be an integer, got "lots"',
    );
    expect(promptOf(agent)).toMatchObject({ temperature: 0.7, top_p: 0.9, max_tokens: 1024 });
  });

  it('checks setLlmTemperature', () => {
    const agent = agentWith();
    expect(() => agent.setLlmTemperature(loose('warm'))).toThrow(
      'BedrockAgent temperature must be a number, got "warm"',
    );
    agent.setLlmTemperature('0.3');
    expect(promptOf(agent)['temperature']).toBe(0.3);
  });
});

describe('BedrockAgent.setPromptLlmParams inference values', () => {
  it('converts numeric strings', () => {
    const agent = agentWith();
    agent.setPromptLlmParams({ temperature: '0.2', top_p: 0.5, max_tokens: '300' });
    expect(promptOf(agent)).toMatchObject({ temperature: 0.2, top_p: 0.5, max_tokens: 300 });
  });

  it('throws for a value that is not a number, and changes nothing', () => {
    const agent = agentWith({ temperature: 0.7, topP: 0.9, maxTokens: 1024 });
    expect(() =>
      agent.setPromptLlmParams({ temperature: 0.2, top_p: 'high', confidence: 0.4 }),
    ).toThrow('BedrockAgent top_p must be a number, got "high"');
    const prompt = promptOf(agent);
    expect(prompt).toMatchObject({ temperature: 0.7, top_p: 0.9, max_tokens: 1024 });
    expect(prompt).not.toHaveProperty('confidence');
  });

  it('treats null as not given', () => {
    const agent = agentWith({ topP: 0.9 });
    agent.setPromptLlmParams({ temperature: 0.2, top_p: null });
    expect(promptOf(agent)).toMatchObject({ temperature: 0.2, top_p: 0.9 });
  });
});
