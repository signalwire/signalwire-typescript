import { describe, it, expect } from 'vitest';
import { BedrockAgent } from '../src/agents/BedrockAgent.js';
import { SchemaUtils } from '../src/SchemaUtils.js';

/**
 * `BedrockAgent.renderSwml` is a FOURTH SWML emission path in this port: it
 * re-parses the document its superclass already rendered and rewrites the `ai`
 * verb into an `amazon_bedrock` verb, touching neither `SwmlBuilder.addVerb`
 * nor the schema. Nothing validated its output, and the class had no tests at
 * all — which is how the `params` regression below shipped unnoticed.
 */
describe('BedrockAgent', () => {
  function bedrockVerb(agent: BedrockAgent): Record<string, unknown> {
    const swml = JSON.parse(agent.renderSwml()) as {
      sections: { main: Array<Record<string, unknown>> };
    };
    const verb = swml.sections.main.find((v) => 'amazon_bedrock' in v);
    expect(verb, 'renderSwml must emit an amazon_bedrock verb').toBeDefined();
    return verb!['amazon_bedrock'] as Record<string, unknown>;
  }

  function agent(): BedrockAgent {
    const a = new BedrockAgent({ name: 'b', route: '/b', agentOptions: { basicAuth: ['u', 'p'] } });
    a.setPromptText('hello');
    return a;
  }

  it('replaces the ai verb with amazon_bedrock', () => {
    const swml = JSON.parse(agent().renderSwml()) as {
      sections: { main: Array<Record<string, unknown>> };
    };
    expect(swml.sections.main.some((v) => 'ai' in v)).toBe(false);
    expect(swml.sections.main.some((v) => 'amazon_bedrock' in v)).toBe(true);
  });

  it('emits a schema-valid amazon_bedrock verb', () => {
    // Assert THROUGH the validator rather than against a literal blob, so a
    // future key added to the rewrite is checked rather than merely recorded.
    // `$defs/AmazonBedrockObject` is closed (`unevaluatedProperties: {"not":{}}`)
    // over exactly the six keys this rewrite emits.
    expect(new SchemaUtils().validateVerb('amazon_bedrock', bedrockVerb(agent()))).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('carries debug webhook config through into params', () => {
    // REGRESSION. The rewrite rebuilds the verb from a fixed six-key allowlist
    // (prompt/SWAIG/params/global_data/post_prompt/post_prompt_url), so any key
    // outside that list is silently DROPPED. While `AgentBase` emitted
    // `debug_webhook_url`/`_level` as ai TOP-LEVEL keys, they matched none of
    // the six and vanished here — debug events were unreachable on every
    // Bedrock agent, with no error. Now that they are correctly emitted inside
    // `params` they survive the rewrite. Verified against 5d3135d: `params`
    // came out `{}` there and carries both keys here.
    const a = agent();
    a.enableDebugEvents(2);
    const params = bedrockVerb(a)['params'] as Record<string, unknown>;

    expect(params['debug_webhook_url']).toBeDefined();
    expect(params['debug_webhook_url']).toContain('/debug_events');
    expect(params['debug_webhook_level']).toBe(2);
  });

  it('carries contexts through inside the prompt object', () => {
    // Same allowlist hazard: `contexts` is only reachable because it nests
    // inside `prompt`, which IS one of the six forwarded keys. Emitted at the
    // ai top level it would be dropped exactly like the debug keys were.
    const a = agent();
    const ctx = a.defineContexts();
    ctx.addContext('default').addStep('s1', { task: 'do the thing' });

    const prompt = bedrockVerb(a)['prompt'] as Record<string, unknown>;
    const contexts = prompt['contexts'] as Record<string, Record<string, unknown>>;
    expect(contexts).toBeDefined();
    expect(contexts['default']!['steps']).toHaveLength(1);
  });

  it('moves voice and inference params into the prompt object', () => {
    const a = new BedrockAgent({
      name: 'b',
      route: '/b',
      voiceId: 'joanna',
      temperature: 0.5,
      topP: 0.95,
      maxTokens: 2048,
      agentOptions: { basicAuth: ['u', 'p'] },
    });
    a.setPromptText('hello');

    const prompt = bedrockVerb(a)['prompt'] as Record<string, unknown>;
    expect(prompt['voice_id']).toBe('joanna');
    expect(prompt['temperature']).toBe(0.5);
    expect(prompt['top_p']).toBe(0.95);

    // `maxTokens` is accepted by the constructor and by `setInferenceParams`
    // but is NOT emitted — `_add_voice_to_prompt` writes only voice_id,
    // temperature and top_p. This matches the reference exactly
    // (`agents/bedrock.py:173-175`), so it is pinned as parity, not fixed here:
    // changing it would diverge from the oracle. It is a reference-side gap.
    expect(prompt['max_tokens']).toBeUndefined();
  });

  it('drops text-model-only prompt params that Bedrock cannot use', () => {
    const a = agent();
    a.setPromptLlmParams({
      temperature: 0.1,
      barge_confidence: 0.4,
      presence_penalty: 0.2,
      frequency_penalty: 0.3,
    });

    const prompt = bedrockVerb(a)['prompt'] as Record<string, unknown>;
    expect(prompt['barge_confidence']).toBeUndefined();
    expect(prompt['presence_penalty']).toBeUndefined();
    expect(prompt['frequency_penalty']).toBeUndefined();
    // The agent's own inference temperature overrides any prompt-level one.
    expect(prompt['temperature']).toBe(0.7);
  });
});
