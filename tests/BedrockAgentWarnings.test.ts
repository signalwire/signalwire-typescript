/**
 * BedrockAgent leaves out of the amazon_bedrock verb everything the base ai
 * verb carries beyond prompt, SWAIG, params, global_data, post_prompt and
 * post_prompt_url, and setPromptLlmParams() takes only numbers for the
 * inference settings. Both now say so in the log; the SWML is unchanged.
 */

import { BedrockAgent } from '../src/agents/BedrockAgent.js';

type Doc = { sections: { main: Record<string, unknown>[] } };

function spyWarn(agent: BedrockAgent) {
  return vi.spyOn((agent as unknown as { log: { warn: (msg: string) => void } }).log, 'warn');
}

function bedrockVerb(swml: string): Record<string, unknown> {
  const doc = JSON.parse(swml) as Doc;
  return doc.sections.main.find((v) => 'amazon_bedrock' in v)!['amazon_bedrock'] as Record<
    string,
    unknown
  >;
}

afterEach(() => {
  // Agents share one logger, so a spy would otherwise see later tests' calls.
  vi.restoreAllMocks();
});

describe('BedrockAgent render warnings', () => {
  it('warns once per render about the ai-verb keys amazon_bedrock leaves out', () => {
    const agent = new BedrockAgent();
    agent.setPromptText('Hi.');
    agent.addHints(['SignalWire']);
    agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.spore' });
    agent.addPronunciation({ replace: 'SW', with: 'SignalWire' });
    agent.setMultilingual({ enabled: true });
    agent.enableDebugEvents(1);
    const warn = spyWarn(agent);
    const verb = bedrockVerb(agent.renderSwml());
    expect(Object.keys(verb).sort()).toEqual(['SWAIG', 'global_data', 'params', 'prompt']);
    const drops = warn.mock.calls.filter(([m]) => String(m).includes('amazon_bedrock'));
    expect(drops).toHaveLength(1);
    expect(drops[0]![0]).toBe(
      "BedrockAgent: the amazon_bedrock verb has no debug_webhook_level, debug_webhook_url, hints, languages, multilingual, pronounce, so they're left out of the SWML",
    );
  });

  it("doesn't warn when nothing is left out", () => {
    const agent = new BedrockAgent();
    agent.setPromptText('Hi.');
    const warn = spyWarn(agent);
    agent.renderSwml();
    expect(warn.mock.calls.filter(([m]) => String(m).includes('amazon_bedrock'))).toEqual([]);
  });

  it('keeps the rendered SWML the same', () => {
    const plain = new BedrockAgent();
    plain.setPromptText('Hi.');
    const hinted = new BedrockAgent();
    hinted.setPromptText('Hi.');
    hinted.addHints(['SignalWire']);
    expect(bedrockVerb(hinted.renderSwml())).toEqual(bedrockVerb(plain.renderSwml()));
  });

  it('uses the singular for one ignored prompt setting', () => {
    const agent = new BedrockAgent();
    const warn = spyWarn(agent);
    agent.setPromptLlmParams({ barge_confidence: 0.4 });
    expect(warn).toHaveBeenCalledWith(
      "setPromptLlmParams(): Bedrock's prompt doesn't define barge_confidence, so it's ignored",
    );
  });

  it('uses the singular for one left-out verb key', () => {
    const agent = new BedrockAgent();
    agent.setPromptText('Hi.');
    agent.addHints(['SignalWire']);
    const warn = spyWarn(agent);
    agent.renderSwml();
    expect(warn).toHaveBeenCalledWith(
      "BedrockAgent: the amazon_bedrock verb has no hints, so it's left out of the SWML",
    );
  });
});

describe('BedrockAgent.setPromptLlmParams inference values', () => {
  it('warns about a temperature, top_p or max_tokens that is not a number, and keeps the old value', () => {
    const agent = new BedrockAgent({ temperature: 0.7, topP: 0.9, maxTokens: 1024 });
    agent.setPromptText('Hi.');
    const warn = spyWarn(agent);
    agent.setPromptLlmParams({ temperature: '0.2', top_p: 0.5, max_tokens: '300' });
    expect(warn).toHaveBeenCalledWith(
      "setPromptLlmParams(): max_tokens, temperature must be numbers, so they're ignored",
    );
    expect(bedrockVerb(agent.renderSwml())['prompt']).toMatchObject({
      temperature: 0.7,
      top_p: 0.5,
      max_tokens: 1024,
    });
  });

  it('uses the singular for one value', () => {
    const agent = new BedrockAgent();
    const warn = spyWarn(agent);
    agent.setPromptLlmParams({ top_p: 'high' });
    expect(warn).toHaveBeenCalledWith(
      "setPromptLlmParams(): top_p must be a number, so it's ignored",
    );
  });

  it("doesn't warn about numbers or a null value", () => {
    const agent = new BedrockAgent();
    const warn = spyWarn(agent);
    agent.setPromptLlmParams({ temperature: 0.2, top_p: null });
    expect(warn.mock.calls.filter(([m]) => String(m).includes('must be'))).toEqual([]);
  });
});
