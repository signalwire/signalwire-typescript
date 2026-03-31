/**
 * Comprehensive Dynamic Agent Example
 *
 * Tier-based dynamic config (standard/premium/enterprise) with industry-specific
 * prompts, voice selection, LLM parameter tuning, and A/B testing.
 * Run: npx tsx examples/comprehensive-dynamic.ts
 * Test: curl "http://user:pass@localhost:3000/?tier=premium&industry=healthcare"
 */

import { AgentBase, FunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'comprehensive-dynamic',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setDynamicConfigCallback((queryParams, bodyParams, headers, ephemeral) => {
  const tier = queryParams.tier ?? 'standard';
  const industry = queryParams.industry ?? 'general';
  const abGroup = Math.random() < 0.5 ? 'A' : 'B';

  // Voice and language based on tier
  const voiceMap: Record<string, string> = {
    enterprise: 'alloy',
    premium: 'nova',
    standard: 'rachel',
  };
  ephemeral.addLanguage({
    name: 'English',
    code: 'en-US',
    voice: voiceMap[tier] ?? 'rachel',
  });

  // LLM parameters by tier
  const tempMap: Record<string, number> = { enterprise: 0.2, premium: 0.4, standard: 0.6 };
  ephemeral.setParams({
    temperature: tempMap[tier] ?? 0.5,
    top_p: tier === 'enterprise' ? 0.85 : 0.95,
  });

  // Global data
  ephemeral.setGlobalData({
    tier,
    industry,
    ab_group: abGroup,
    priority_queue: tier !== 'standard',
  });

  // Industry-specific prompts
  const industryPrompts: Record<string, { title: string; body: string; bullets: string[] }> = {
    healthcare: {
      title: 'Healthcare Expertise',
      body: 'You are a healthcare support specialist.',
      bullets: [
        'Follow HIPAA guidelines for patient information',
        'Use proper medical terminology',
        'Escalate urgent medical concerns immediately',
      ],
    },
    finance: {
      title: 'Financial Services',
      body: 'You are a financial services representative.',
      bullets: [
        'Never provide specific investment advice',
        'Verify account identity before sharing details',
        'Offer to connect with a licensed advisor for complex questions',
      ],
    },
    general: {
      title: 'General Support',
      body: 'You are a versatile customer service agent.',
      bullets: [
        'Help with product questions and troubleshooting',
        'Process returns and exchanges',
        'Escalate complex issues to a specialist',
      ],
    },
  };

  const prompt = industryPrompts[industry] ?? industryPrompts.general;
  ephemeral.promptAddSection(prompt.title, prompt.body, prompt.bullets);

  // Tier-specific features
  if (tier === 'enterprise' || tier === 'premium') {
    ephemeral.defineTool({
      name: 'schedule_callback',
      description: 'Schedule a priority callback from a specialist',
      parameters: {
        time_slot: { type: 'string', description: 'Preferred callback time' },
      },
      handler: (args) => {
        return new FunctionResult(
          `Priority callback scheduled for ${args.time_slot}. A specialist will call you.`,
        );
      },
    });
  }

  // A/B test: greeting style
  if (abGroup === 'A') {
    ephemeral.promptAddSection('Greeting', 'Start with a warm, conversational greeting.');
  } else {
    ephemeral.promptAddSection('Greeting', 'Start with a brief, professional greeting.');
  }

  // Tool available to all tiers
  ephemeral.defineTool({
    name: 'check_status',
    description: 'Check the status of an order or ticket',
    parameters: {
      reference: { type: 'string', description: 'Order or ticket number' },
    },
    handler: (args) => {
      return new FunctionResult(
        `Reference ${args.reference} is being processed. Estimated completion: 2 business days.`,
      );
    },
  });
});

agent.run();
