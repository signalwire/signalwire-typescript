import { describe, it, expect } from 'vitest';
import { normalizeParameters, isFullParameterSchema } from '../src/SwaigFunction.js';

/**
 * Issue #19373: the `'type' in p && 'properties' in p` sniff (reimplemented in
 * 3 places) misclassified a tool whose parameters are literally NAMED `type`
 * and `properties`. The unified normalizeParameters() uses a robust
 * discriminator: full schema ONLY when type === 'object' (string) AND
 * properties is an object.
 */
describe('normalizeParameters', () => {
  it('empty / undefined -> empty object schema', () => {
    expect(normalizeParameters(undefined)).toEqual({ type: 'object', properties: {} });
    expect(normalizeParameters({})).toEqual({ type: 'object', properties: {} });
  });

  it('a full JSON Schema is returned unchanged', () => {
    const schema = {
      type: 'object',
      properties: { location: { type: 'string' } },
      required: ['location'],
    };
    expect(normalizeParameters(schema)).toBe(schema);
  });

  it('a bare properties map is wrapped, applying required', () => {
    const bare = { location: { type: 'string', description: 'City' } };
    expect(normalizeParameters(bare, ['location'])).toEqual({
      type: 'object',
      properties: bare,
      required: ['location'],
    });
  });

  it('a bare map without required omits the required key', () => {
    const bare = { location: { type: 'string' } };
    expect(normalizeParameters(bare)).toEqual({
      type: 'object',
      properties: bare,
    });
  });

  it('params literally NAMED type/properties are treated as a bare map (the bug)', () => {
    // Here `type` and `properties` are PROPERTY NAMES; their values are
    // property-definition objects, not the string 'object'. The old sniff would
    // have wrongly treated this as a full schema.
    const bare = {
      type: { type: 'string', description: 'the kind of widget' },
      properties: { type: 'string', description: 'comma-separated props' },
    };
    expect(isFullParameterSchema(bare)).toBe(false);
    expect(normalizeParameters(bare, ['type'])).toEqual({
      type: 'object',
      properties: bare,
      required: ['type'],
    });
  });

  it('a schema with type: object but non-object properties is NOT a full schema', () => {
    // Defensive: type is the string 'object' but `properties` is a string ->
    // not a real schema, so wrap it.
    const weird = { type: 'object', properties: 'oops' };
    expect(isFullParameterSchema(weird)).toBe(false);
  });
});
