/**
 * BedrockAgent leaves out of the amazon_bedrock verb everything the base ai
 * verb carries beyond prompt, SWAIG, params, global_data, post_prompt and
 * post_prompt_url, and out of the Bedrock prompt everything its schema
 * doesn't define, contexts included. It logs one warning per agent for each
 * feature it leaves out, not one on every render. Mirrors signalwire-python
 * 3c85e38.
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

const leftOut = (warn: ReturnType<typeof spyWarn>) =>
  warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('left out of the SWML'));

afterEach(() => {
  // Agents share one logger, so a spy would otherwise see later tests' calls.
  vi.restoreAllMocks();
});

describe('BedrockAgent render warnings', () => {
  it('warns once for each ai-verb feature amazon_bedrock leaves out', () => {
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
    expect(leftOut(warn).sort()).toEqual([
      "BedrockAgent: the amazon_bedrock verb has no debug_webhook_level, so it's left out of the SWML",
      "BedrockAgent: the amazon_bedrock verb has no debug_webhook_url, so it's left out of the SWML",
      "BedrockAgent: the amazon_bedrock verb has no hints, so the agent's speech hints (addHint(), addHints(), addPatternHint() and skills' hints) are left out of the SWML",
      "BedrockAgent: the amazon_bedrock verb has no languages, so the agent's languages (addLanguage()) are left out of the SWML",
      "BedrockAgent: the amazon_bedrock verb has no multilingual, so the agent's multilingual settings (setMultilingual()) are left out of the SWML",
      "BedrockAgent: the amazon_bedrock verb has no pronounce, so the agent's pronunciation rules (addPronunciation()) are left out of the SWML",
    ]);
  });

  it('warns only on the first render', () => {
    const agent = new BedrockAgent();
    agent.setPromptText('Hi.');
    agent.addHints(['SignalWire']);
    const warn = spyWarn(agent);
    agent.renderSwml();
    agent.renderSwml();
    agent.renderSwml();
    expect(leftOut(warn)).toHaveLength(1);
  });

  it('warns once across the per-request copies of served requests', async () => {
    const agent = new BedrockAgent({ agentOptions: { basicAuth: ['u', 'p'] } });
    agent.setPromptText('Hi.');
    agent.setDynamicConfigCallback((_q, _b, _h, copy) => {
      (copy as BedrockAgent).addHints(['SignalWire']);
    });
    const warn = spyWarn(agent);
    for (let i = 0; i < 3; i++) {
      const res = await agent.getApp().request('/bedrock', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      expect(res.status).toBe(200);
      expect(bedrockVerb(await res.text())).not.toHaveProperty('hints');
    }
    expect(leftOut(warn)).toEqual([
      "BedrockAgent: the amazon_bedrock verb has no hints, so the agent's speech hints (addHint(), addHints(), addPatternHint() and skills' hints) are left out of the SWML",
    ]);
  });

  it('leaves contexts out of the Bedrock prompt, with a warning', () => {
    const agent = new BedrockAgent();
    agent.setPromptText('Hi.');
    agent.defineContexts().addContext('default').addStep('greet').setText('Say hello.');
    const warn = spyWarn(agent);
    const prompt = bedrockVerb(agent.renderSwml())['prompt'] as Record<string, unknown>;
    expect(prompt).not.toHaveProperty('contexts');
    expect(leftOut(warn)).toEqual([
      "BedrockAgent: Bedrock's prompt has no contexts, so the agent's contexts and steps (defineContexts()) are left out of the SWML",
    ]);
  });

  it("doesn't warn when nothing is left out", () => {
    const agent = new BedrockAgent();
    agent.setPromptText('Hi.');
    agent.setPromptLlmParams({ confidence: 0.5 });
    const warn = spyWarn(agent);
    agent.renderSwml();
    expect(leftOut(warn)).toEqual([]);
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
});
