/**
 * Reading what a client declares it can render, from the user variables it
 * sends at dial time. Absence means no: every path resolves malformed or
 * missing data to "not declared". Mirrors signalwire-python
 * tests/unit/core/test_capabilities.py.
 */

import { declaredCapabilities, hasCapability, userVariables } from '../src/capabilities.js';

const BODY = {
  vars: {
    userVariables: {
      capabilities: { display_content: true, transcript: true, chat_handoff: false },
      metadata: { widget: { opened_at: '2026-01-01T00:00:00Z' } },
    },
  },
};

describe('userVariables', () => {
  it('extracts them from the nested shape', () => {
    expect(userVariables(BODY)).toHaveProperty('capabilities');
  });

  it.each([
    null,
    undefined,
    {},
    'nonsense',
    42,
    { vars: null },
    { vars: {} },
    { vars: { userVariables: null } },
    { vars: { userVariables: 'not an object' } },
    { vars: { userVariables: [] } },
  ])('yields an empty object when a level is missing: %j', (junk) => {
    expect(userVariables(junk)).toEqual({});
  });
});

describe('declaredCapabilities', () => {
  it('returns only the truthy names', () => {
    expect([...declaredCapabilities(BODY)].sort()).toEqual(['display_content', 'transcript']);
  });

  it('does not treat false as a declaration', () => {
    expect(declaredCapabilities(BODY).has('chat_handoff')).toBe(false);
  });

  it('accepts already-extracted user variables', () => {
    expect([...declaredCapabilities({ capabilities: { a: true } })]).toEqual(['a']);
  });

  it('passes through a name the SDK has never heard of', () => {
    expect(hasCapability({ capabilities: { future_thing: true } }, 'future_thing')).toBe(true);
  });

  it.each([
    null,
    {},
    'nonsense',
    42,
    { vars: { userVariables: { capabilities: 'not an object' } } },
    { vars: { userVariables: { capabilities: null } } },
    { vars: { userVariables: {} } },
  ])('treats absence and malformation both as no: %j', (junk) => {
    expect(declaredCapabilities(junk).size).toBe(0);
    expect(hasCapability(junk, 'display_content')).toBe(false);
  });
});

describe('hasCapability', () => {
  it('is true for a declared capability', () => {
    expect(hasCapability(BODY, 'display_content')).toBe(true);
  });

  it('is false for one declared false', () => {
    expect(hasCapability(BODY, 'chat_handoff')).toBe(false);
  });

  it('is false for one never mentioned', () => {
    expect(hasCapability(BODY, 'telepathy')).toBe(false);
  });
});
