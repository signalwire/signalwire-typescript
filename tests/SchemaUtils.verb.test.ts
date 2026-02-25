import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

    it('extracts the expected verb count (~38)', () => {
      const names = schema.getVerbNames();
      expect(names.length).toBe(38);
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
      const innerProps = (props as Record<string, unknown>)['properties'] as Record<string, unknown>;
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
