/**
 * Post-prompt normalization across the voice and chat engines. The two
 * engines deliver the same result in different shapes: `post_prompt_data`
 * arrives three ways, and the chat engine appends its own summary to the
 * call log as a bare assistant turn. Mirrors signalwire-python
 * tests/unit/core/test_post_prompt_normalize.py.
 */

import {
  NormalizedPostPrompt,
  dialogueTurns,
  normalizePostPrompt,
  parsePostPromptData,
  stripJsonFence,
} from '../src/PostPrompt.js';

const FENCED = '```json\n{"summary": "s", "already_answered": ["pricing"]}\n```';

describe('parsePostPromptData', () => {
  it('returns flat keys from the voice engine as they are', () => {
    expect(parsePostPromptData({ summary: 's', user_goal: 'g' })).toEqual({
      summary: 's',
      user_goal: 'g',
    });
  });

  it('parses fenced raw text from the chat engine', () => {
    expect(parsePostPromptData({ raw: FENCED })).toEqual({
      summary: 's',
      already_answered: ['pricing'],
    });
  });

  it('unwraps an object wrapped in a list under parsed', () => {
    expect(parsePostPromptData({ parsed: [{ summary: 's3' }], raw: '...' })).toEqual({
      summary: 's3',
    });
  });

  it('unwraps parsed before sweeping flat keys', () => {
    expect(parsePostPromptData({ parsed: [{ summary: 's' }] })).not.toHaveProperty('parsed');
  });

  it('accepts parsed as a bare object', () => {
    expect(parsePostPromptData({ parsed: { summary: 's' } })).toEqual({ summary: 's' });
  });

  it('keeps prose instead of JSON as the summary', () => {
    expect(parsePostPromptData({ raw: 'They asked about pricing.' })).toEqual({
      summary: 'They asked about pricing.',
    });
  });

  it('keeps a JSON list as its JSON text', () => {
    expect(parsePostPromptData({ raw: '[{"answer":42}]' })).toEqual({
      summary: '[{"answer":42}]',
    });
  });

  it('wraps JSON that is not an object', () => {
    expect(parsePostPromptData({ raw: '"just a string"' })).toEqual({ summary: 'just a string' });
  });

  it.each([null, undefined, {}, 'text', 42, [], { raw: '' }, { raw: '   ' }, { raw: null }])(
    'degrades junk to an empty object rather than throwing: %j',
    (junk) => {
      expect(parsePostPromptData(junk)).toEqual({});
    },
  );
});

describe('stripJsonFence', () => {
  it.each([
    ['```json\n{"a":1}\n```', '{"a":1}'],
    ['```\nplain\n```', 'plain'],
    ['no fence at all', 'no fence at all'],
    ['', ''],
  ])('unwraps %j', (raw, expected) => {
    expect(stripJsonFence(raw)).toBe(expected);
  });
});

describe('dialogueTurns', () => {
  // Deliberately mixed: the last entry is not an object at all.
  const LOG: unknown[] = [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello' },
    { role: 'system', content: 'the prompt' },
    { role: 'system-log', content: 'step trace' },
    { role: 'tool', content: 'tool output' },
    { role: 'assistant', content: '', tool_calls: [{ id: 1 }] },
    { role: 'assistant', content: 'calling', tool_calls: [{ id: 2 }] },
    { role: 'assistant-manual', content: 'let me look that up' },
    { role: 'assistant', content: '   ' },
    'not even an object',
  ];

  it('keeps only the real dialogue', () => {
    expect(dialogueTurns(LOG)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
  });

  it('drops the chat summary echo when asked', () => {
    const log = [...LOG, { role: 'assistant', content: FENCED }];
    expect(dialogueTurns(log, { dropEcho: FENCED })).not.toContainEqual({
      role: 'assistant',
      content: FENCED,
    });
  });

  it('keeps the echo when not asked to drop it', () => {
    // The voice engine delivers it as a tool call instead, so a blanket rule would eat real speech.
    const log = [...LOG, { role: 'assistant', content: FENCED }];
    expect(dialogueTurns(log)).toHaveLength(3);
  });

  it('keeps a turn whose tool_calls is empty', () => {
    expect(dialogueTurns([{ role: 'assistant', content: 'said', tool_calls: [] }])).toHaveLength(1);
  });

  it('honours a custom roles list', () => {
    expect(dialogueTurns(LOG, { roles: ['user'] })).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it.each([null, [], 'nonsense', 42])('yields nothing for a junk log: %j', (junk) => {
    expect(dialogueTurns(junk)).toEqual([]);
  });
});

describe('normalizePostPrompt', () => {
  it('normalizes a voice body', () => {
    const result = normalizePostPrompt({
      conversation_type: 'voice',
      call_id: 'c-1',
      post_prompt_data: { parsed: [{ summary: 'v' }] },
      raw_call_log: [{ role: 'user', content: 'hi' }],
    });
    expect(result.medium).toBe('voice');
    expect(result.conversationId).toBeNull(); // voice doesn't send one
    expect(result.summary).toEqual({ summary: 'v' });
    expect(result.callId).toBe('c-1');
    expect(result.dialogue).toHaveLength(1);
  });

  it('normalizes a chat body and drops the summary echo', () => {
    const result = normalizePostPrompt({
      conversation_type: 'chat',
      conversation_id: 'conv-9',
      post_prompt_data: { raw: FENCED },
      raw_messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: FENCED },
      ],
    });
    expect(result.medium).toBe('chat');
    expect(result.conversationId).toBe('conv-9');
    expect(result.summary['already_answered']).toEqual(['pricing']);
    expect(result.dialogue).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('accepts the call_log key too', () => {
    expect(
      normalizePostPrompt({ call_log: [{ role: 'user', content: 'hi' }] }).dialogue,
    ).toHaveLength(1);
  });

  it('treats an empty call_log as absent and reads raw_call_log', () => {
    const result = normalizePostPrompt({
      call_log: [],
      raw_call_log: [{ role: 'user', content: 'hi' }],
    });
    expect(result.dialogue).toHaveLength(1);
  });

  it.each([null, 'text', 42, []])('yields empty fields for a junk body: %j', (junk) => {
    const result = normalizePostPrompt(junk);
    expect(result.medium).toBe('');
    expect(result.summary).toEqual({});
    expect(result.dialogue).toEqual([]);
  });

  it('preserves the raw body by identity', () => {
    const body = { conversation_type: 'voice', extra: 'kept' };
    expect(normalizePostPrompt(body).raw).toBe(body);
  });

  it('returns a frozen result', () => {
    expect(Object.isFrozen(normalizePostPrompt({ conversation_type: 'voice' }))).toBe(true);
  });

  it('constructs with defaults for the fields left out', () => {
    const leg = new NormalizedPostPrompt({ medium: 'chat', conversationId: 'conv-1' });
    expect(leg.medium).toBe('chat');
    expect(leg.conversationId).toBe('conv-1');
    expect(leg.summary).toEqual({});
    expect(leg.dialogue).toEqual([]);
    expect(leg.callId).toBeNull();
  });
});
