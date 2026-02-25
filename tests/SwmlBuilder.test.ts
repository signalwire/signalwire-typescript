import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SwmlBuilder } from '../src/SwmlBuilder.js';

describe('SwmlBuilder — verb auto-vivification', () => {
  let builder: SwmlBuilder;

  beforeEach(() => {
    builder = new SwmlBuilder();
  });

  describe('verb method existence', () => {
    it('has all ~38 verb methods', () => {
      const schemaUtils = SwmlBuilder.getSchemaUtils();
      const verbNames = schemaUtils.getVerbNames();
      expect(verbNames.length).toBe(38);
      for (const name of verbNames) {
        expect(typeof (builder as Record<string, unknown>)[name]).toBe('function');
      }
    });

    it('has answer method', () => {
      expect(typeof builder.answer).toBe('function');
    });

    it('has hangup method', () => {
      expect(typeof builder.hangup).toBe('function');
    });

    it('has play method', () => {
      expect(typeof builder.play).toBe('function');
    });

    it('has sleep method', () => {
      expect(typeof builder.sleep).toBe('function');
    });
  });

  describe('verb method invocation', () => {
    it('answer() adds answer verb to document', () => {
      builder.answer();
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(1);
      expect(doc.sections.main[0]).toEqual({ answer: {} });
    });

    it('answer() with config adds config', () => {
      builder.answer({ max_duration: 3600 });
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ answer: { max_duration: 3600 } });
    });

    it('hangup() with reason', () => {
      builder.hangup({ reason: 'busy' });
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ hangup: { reason: 'busy' } });
    });

    it('hangup() without args adds empty config', () => {
      builder.hangup();
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ hangup: {} });
    });

    it('play() with config', () => {
      builder.play({ url: 'https://example.com/audio.mp3' });
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ play: { url: 'https://example.com/audio.mp3' } });
    });

    it('tap() with required uri', () => {
      builder.tap({ uri: 'wss://example.com/tap' });
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ tap: { uri: 'wss://example.com/tap' } });
    });

    it('goto() with required label', () => {
      builder.goto({ label: 'start' });
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ goto: { label: 'start' } });
    });

    it('label() with string', () => {
      (builder as Record<string, Function>)['label']('greeting');
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ label: 'greeting' });
    });
  });

  describe('sleep special handling', () => {
    it('sleep() with number adds integer directly', () => {
      builder.sleep(5000);
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ sleep: 5000 });
    });

    it('sleep() with config object', () => {
      builder.sleep({ duration: 3000 });
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ sleep: { duration: 3000 } });
    });
  });

  describe('fluent chaining', () => {
    it('returns this for chaining', () => {
      const result = builder.answer();
      expect(result).toBe(builder);
    });

    it('chains multiple verb calls', () => {
      builder.answer().hangup();
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(2);
      expect(doc.sections.main[0]).toEqual({ answer: {} });
      expect(doc.sections.main[1]).toEqual({ hangup: {} });
    });

    it('full call flow: answer → play → hangup', () => {
      builder
        .answer({ max_duration: 3600 })
        .play({ url: 'https://example.com/greeting.mp3' })
        .hangup({ reason: 'hangup' });

      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(3);
      expect(doc.sections.main[0]).toEqual({ answer: { max_duration: 3600 } });
      expect(doc.sections.main[1]).toEqual({ play: { url: 'https://example.com/greeting.mp3' } });
      expect(doc.sections.main[2]).toEqual({ hangup: { reason: 'hangup' } });
    });

    it('sleep chains correctly', () => {
      const result = builder.sleep(1000);
      expect(result).toBe(builder);
    });
  });

  describe('mixing verb methods with addVerb()', () => {
    it('verb methods and addVerb produce same output', () => {
      builder.answer();
      builder.addVerb('denoise', {});
      builder.hangup();
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(3);
      expect(doc.sections.main[0]).toEqual({ answer: {} });
      expect(doc.sections.main[1]).toEqual({ denoise: {} });
      expect(doc.sections.main[2]).toEqual({ hangup: {} });
    });
  });

  describe('reset()', () => {
    it('clears verb-method-added content', () => {
      builder.answer().hangup();
      builder.reset();
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(0);
    });
  });

  describe('validation', () => {
    it('rejects missing required properties', () => {
      expect(() => {
        builder.tap({} as any);
      }).toThrow('SWML verb validation failed');
    });

    it('rejects missing required properties with detail', () => {
      expect(() => {
        builder.tap({} as any);
      }).toThrow("'uri'");
    });

    it('passes valid configs', () => {
      expect(() => {
        builder.tap({ uri: 'wss://example.com' });
      }).not.toThrow();
    });

    it('SWML_SKIP_SCHEMA_VALIDATION disables validation', () => {
      const origEnv = process.env['SWML_SKIP_SCHEMA_VALIDATION'];
      try {
        process.env['SWML_SKIP_SCHEMA_VALIDATION'] = 'true';
        const skipBuilder = new SwmlBuilder();
        // Should not throw even though required uri is missing
        expect(() => {
          skipBuilder.tap({} as any);
        }).not.toThrow();
      } finally {
        if (origEnv === undefined) {
          delete process.env['SWML_SKIP_SCHEMA_VALIDATION'];
        } else {
          process.env['SWML_SKIP_SCHEMA_VALIDATION'] = origEnv;
        }
      }
    });
  });

  describe('addVerbToSection()', () => {
    it('still works with custom sections', () => {
      builder.addVerbToSection('greet', 'play', { url: 'https://example.com/hi.mp3' });
      const doc = builder.getDocument() as { sections: Record<string, unknown[]> };
      expect(doc.sections['greet']).toHaveLength(1);
      expect(doc.sections['greet'][0]).toEqual({ play: { url: 'https://example.com/hi.mp3' } });
    });
  });

  describe('getDocument() and renderDocument()', () => {
    it('getDocument returns correct structure', () => {
      builder.answer();
      const doc = builder.getDocument();
      expect(doc).toHaveProperty('version', '1.0.0');
      expect(doc).toHaveProperty('sections');
      const sections = doc['sections'] as Record<string, unknown[]>;
      expect(sections).toHaveProperty('main');
      expect(sections['main']).toHaveLength(1);
    });

    it('renderDocument produces valid JSON', () => {
      builder.answer().sleep(1000).hangup();
      const json = builder.renderDocument();
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.sections.main).toHaveLength(3);
    });
  });

  describe('getSchemaUtils()', () => {
    it('returns a SchemaUtils instance', () => {
      const utils = SwmlBuilder.getSchemaUtils();
      expect(utils).toBeDefined();
      expect(typeof utils.getVerbNames).toBe('function');
    });

    it('returns the same singleton', () => {
      const a = SwmlBuilder.getSchemaUtils();
      const b = SwmlBuilder.getSchemaUtils();
      expect(a).toBe(b);
    });
  });
});
