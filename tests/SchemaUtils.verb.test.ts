import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaUtils } from '../src/SchemaUtils.js';

describe('SchemaUtils — verb extraction and validation', () => {
  let schema: SchemaUtils;

  beforeEach(() => {
    schema = new SchemaUtils();
  });

  describe('schema loading', () => {
    it('loads the schema and extracts verbs', () => {
      const names = schema.getVerbNames();
      expect(names.length).toBeGreaterThanOrEqual(30);
    });

    // A frozen headcount has to be edited by every PR that adds a verb upstream
    // (ai_sidecar took it 38 -> 39) and never caught a real defect -- the python
    // reference has no equivalent assertion, it only logs the count. Assert the
    // schema loaded and is not truncated instead.
    it('extracts verbs from the schema', () => {
      const names = schema.getVerbNames();
      expect(names.length).toBeGreaterThanOrEqual(38);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('getVerbNames()', () => {
    it('includes well-known verbs', () => {
      const names = schema.getVerbNames();
      expect(names).toContain('answer');
      expect(names).toContain('hangup');
      expect(names).toContain('play');
      expect(names).toContain('ai');
      expect(names).toContain('sleep');
      expect(names).toContain('connect');
      expect(names).toContain('tap');
      expect(names).toContain('record');
      expect(names).toContain('transfer');
      expect(names).toContain('label');
      expect(names).toContain('goto');
      expect(names).toContain('execute');
      expect(names).toContain('switch');
      expect(names).toContain('cond');
    });

    it('includes snake_case verb names', () => {
      const names = schema.getVerbNames();
      expect(names).toContain('send_digits');
      expect(names).toContain('send_fax');
      expect(names).toContain('send_sms');
      expect(names).toContain('record_call');
      expect(names).toContain('stop_record_call');
      expect(names).toContain('stop_tap');
      expect(names).toContain('stop_denoise');
      expect(names).toContain('sip_refer');
      expect(names).toContain('enter_queue');
      expect(names).toContain('join_room');
      expect(names).toContain('join_conference');
    });
  });

  describe('getVerbProperties()', () => {
    it('returns inner schema for a known verb', () => {
      const props = schema.getVerbProperties('hangup');
      expect(props).toHaveProperty('type', 'object');
      expect(props).toHaveProperty('properties');
    });

    it('returns empty object for unknown verb', () => {
      const props = schema.getVerbProperties('nonexistent');
      expect(props).toEqual({});
    });

    it('returns correct structure for tap', () => {
      const props = schema.getVerbProperties('tap');
      expect(props).toHaveProperty('type', 'object');
      const innerProps = (props as Record<string, unknown>)['properties'] as Record<
        string,
        unknown
      >;
      expect(innerProps).toHaveProperty('uri');
      expect(innerProps).toHaveProperty('direction');
      expect(innerProps).toHaveProperty('codec');
    });
  });

  describe('getVerbRequiredProperties()', () => {
    it('returns required fields for tap', () => {
      const required = schema.getVerbRequiredProperties('tap');
      expect(required).toContain('uri');
    });

    it('returns required fields for goto', () => {
      const required = schema.getVerbRequiredProperties('goto');
      expect(required).toContain('label');
    });

    it('returns empty array for verb with no required inner props', () => {
      const required = schema.getVerbRequiredProperties('hangup');
      expect(required).toEqual([]);
    });

    it('returns empty array for unknown verb', () => {
      const required = schema.getVerbRequiredProperties('nonexistent');
      expect(required).toEqual([]);
    });
  });

  describe('getVerbDescription()', () => {
    it('returns description for hangup', () => {
      const desc = schema.getVerbDescription('hangup');
      expect(desc).toContain('End the call');
    });

    it('returns description for tap', () => {
      const desc = schema.getVerbDescription('tap');
      expect(desc.length).toBeGreaterThan(0);
    });

    it('returns empty string for unknown verb', () => {
      const desc = schema.getVerbDescription('nonexistent');
      expect(desc).toBe('');
    });
  });

  describe('hasVerb()', () => {
    it('returns true for known verbs', () => {
      expect(schema.hasVerb('answer')).toBe(true);
      expect(schema.hasVerb('hangup')).toBe(true);
      expect(schema.hasVerb('sleep')).toBe(true);
    });

    it('returns false for unknown verbs', () => {
      expect(schema.hasVerb('nonexistent')).toBe(false);
      expect(schema.hasVerb('Answer')).toBe(false); // PascalCase shouldn't match
    });
  });

  describe('validateVerb()', () => {
    it('passes for valid hangup config', () => {
      const result = schema.validateVerb('hangup', { reason: 'busy' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes for empty hangup config (no required props)', () => {
      const result = schema.validateVerb('hangup', {});
      expect(result.valid).toBe(true);
    });

    it('passes for valid tap config with required uri', () => {
      const result = schema.validateVerb('tap', { uri: 'wss://example.com' });
      expect(result.valid).toBe(true);
    });

    it('fails for tap missing required uri', () => {
      const result = schema.validateVerb('tap', { direction: 'both' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("'uri'");
    });

    it('fails for unknown verb', () => {
      const result = schema.validateVerb('nonexistent', {});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unknown verb');
    });

    it('passes for goto with required label', () => {
      const result = schema.validateVerb('goto', { label: 'start' });
      expect(result.valid).toBe(true);
    });

    it('fails for goto missing required label', () => {
      const result = schema.validateVerb('goto', { when: 'true' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("'label'");
    });

    it('passes for label (string-typed verb)', () => {
      const result = schema.validateVerb('label', 'start');
      expect(result.valid).toBe(true);
    });

    it('passes for sleep (anyOf typed verb)', () => {
      const result = schema.validateVerb('sleep', 5000);
      expect(result.valid).toBe(true);
    });
  });

  describe('SWML_SKIP_SCHEMA_VALIDATION', () => {
    it('skips validation when skipValidation is true', () => {
      const skipped = new SchemaUtils({ skipValidation: true });
      const result = skipped.validateVerb('nonexistent', {});
      expect(result.valid).toBe(true);
    });

    it('skips validation via env var', () => {
      const origEnv = process.env['SWML_SKIP_SCHEMA_VALIDATION'];
      try {
        process.env['SWML_SKIP_SCHEMA_VALIDATION'] = 'true';
        const envSchema = new SchemaUtils();
        const result = envSchema.validateVerb('nonexistent', {});
        expect(result.valid).toBe(true);
      } finally {
        if (origEnv === undefined) {
          delete process.env['SWML_SKIP_SCHEMA_VALIDATION'];
        } else {
          process.env['SWML_SKIP_SCHEMA_VALIDATION'] = origEnv;
        }
      }
    });
  });
});

// ── x-sdk-widen: a const-union that is a HINT, not a closed set ──────────────
//
// Some SWML schema fields carry an enum/const union that documents the COMMON
// values while the platform actually accepts any value of the base type. Those
// carry `x-sdk-widen: true`, and the marker means: do not treat this union as
// closed.
//
// The SDK honours it in TWO places, and they are easy to get half-right:
//
//   1. the TYPE generator (scripts/_gen-common.ts tsType) widens the emitted TS
//      type to the base scalar — otherwise `swml_verbs_generated.ts` would
//      declare `reason?: 'hangup' | 'busy' | 'decline'` and refuse to COMPILE a
//      valid document;
//   2. the VALIDATOR, here — otherwise Ajv, which has never heard of
//      `x-sdk-widen`, enforces the raw `anyOf` const-union at RUNTIME and
//      rejects documents the platform accepts.
//
// This port shipped (1) and not (2): `validateVerb('hangup', {reason:'user_hangup'})`
// returned invalid with "must be equal to constant … must match a schema in
// anyOf". A validator being too STRICT is the failure direction nobody probes,
// because every test anyone writes uses a value from the union and passes.
//
// java and ruby both had this identical hole, in both cases becoming live the
// moment emissions were routed through their validators.
describe('SchemaUtils — x-sdk-widen widens the validator, not just the types', () => {
  const su = new SchemaUtils();

  // $defs/Hangup.properties.hangup.properties.reason is the one field carrying
  // the marker today. Guard that fact: if the vendored schema moves it, this
  // suite would otherwise keep passing while testing nothing.
  it('the vendored schema still marks Hangup.reason as widened', () => {
    const schema = su.loadSchema() as Record<string, unknown>;
    const defs = schema['$defs'] as Record<string, Record<string, unknown>>;
    const hangup = defs['Hangup']!['properties'] as Record<string, Record<string, unknown>>;
    const reason = (hangup['hangup']!['properties'] as Record<string, Record<string, unknown>>)[
      'reason'
    ]!;
    expect(reason['x-sdk-widen']).toBe(true);
    // ...and that it IS a const-union, i.e. there is something to widen.
    expect(Array.isArray(reason['anyOf'])).toBe(true);
  });

  it('accepts a value INSIDE the documented union', () => {
    // The direction every existing test already covers — kept as the control,
    // so a fix that simply disabled validation for this verb is caught by the
    // wrong-TYPE case below rather than sailing through.
    expect(su.validateVerb('hangup', { reason: 'busy' }).valid).toBe(true);
  });

  it('accepts a value OUTSIDE the union — the union is a hint', () => {
    for (const reason of ['user_hangup', 'no_answer', 'anything-at-all']) {
      const result = su.validateVerb('hangup', { reason });
      expect(result.valid, `reason=${reason} errors=${JSON.stringify(result.errors)}`).toBe(true);
    }
  });

  it('still rejects the wrong TYPE — widening relaxes the VALUE set, not the type', () => {
    // The bound that makes widening safe. `x-sdk-widen` says "any value OF THE
    // BASE TYPE", so a number or an object is still a schema violation. Without
    // this row, "widening" could be implemented by deleting the constraint
    // outright and nothing would notice.
    for (const reason of [42, true, { nested: 'object' }, ['array']]) {
      const result = su.validateVerb('hangup', { reason });
      expect(result.valid, `reason=${JSON.stringify(reason)} unexpectedly accepted`).toBe(false);
    }
  });

  it('leaves NON-widened closed enums alone', () => {
    // The blast-radius check. Widening must apply ONLY where the marker is —
    // a relaxation that leaked into every union would silently turn the whole
    // validator into a rubber stamp, which is a far worse defect than the one
    // being fixed here. `play`'s config is a well-populated verb with typed
    // fields; a garbage-typed value there must still fail.
    const result = su.validateVerb('play', { url: 12345 });
    expect(result.valid).toBe(false);
  });
});
