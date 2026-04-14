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

    it('returns this for fluent chaining', () => {
      const result = builder.answer().reset();
      expect(result).toBe(builder);
    });

    it('chains reset with further verbs', () => {
      builder.answer().hangup().reset().answer();
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(1);
      expect(doc.sections.main[0]).toEqual({ answer: {} });
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

  describe('say() — text-to-speech convenience', () => {
    it('adds a play verb with say: prefix', () => {
      builder.say('Hello world');
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(1);
      expect(doc.sections.main[0]).toEqual({ play: { url: 'say:Hello world' } });
    });

    it('passes voice option as say_voice', () => {
      builder.say('Hello', { voice: 'en-US-Neural2-F' });
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({
        play: { url: 'say:Hello', say_voice: 'en-US-Neural2-F' },
      });
    });

    it('passes all TTS options', () => {
      builder.say('Test', { voice: 'v', language: 'en', gender: 'female', volume: 10 });
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({
        play: {
          url: 'say:Test',
          say_voice: 'v',
          say_language: 'en',
          say_gender: 'female',
          volume: 10,
        },
      });
    });

    it('returns this for fluent chaining', () => {
      const result = builder.say('Hi');
      expect(result).toBe(builder);
    });

    it('chains say with other verbs', () => {
      builder.answer().say('Welcome').hangup();
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(3);
      expect(doc.sections.main[1]).toEqual({ play: { url: 'say:Welcome' } });
    });
  });

  describe('addSection() — create empty section', () => {
    it('creates an empty named section', () => {
      builder.addSection('greetings');
      const doc = builder.getDocument() as { sections: Record<string, unknown[]> };
      expect(doc.sections['greetings']).toEqual([]);
    });

    it('is a no-op if section already exists', () => {
      builder.addVerbToSection('greetings', 'play', { url: 'https://example.com/hi.mp3' });
      builder.addSection('greetings');
      const doc = builder.getDocument() as { sections: Record<string, unknown[]> };
      expect(doc.sections['greetings']).toHaveLength(1);
    });

    it('returns this for fluent chaining', () => {
      const result = builder.addSection('test');
      expect(result).toBe(builder);
    });

    it('chains with addVerbToSection', () => {
      builder.addSection('custom').addVerbToSection('custom', 'play', { url: 'say:hi' });
      const doc = builder.getDocument() as { sections: Record<string, unknown[]> };
      expect(doc.sections['custom']).toHaveLength(1);
    });
  });

  describe('build() — alias for getDocument()', () => {
    it('returns the same result as getDocument', () => {
      builder.answer();
      expect(builder.build()).toBe(builder.getDocument());
    });

    it('returns document with version and sections', () => {
      builder.answer();
      const doc = builder.build();
      expect(doc).toHaveProperty('version', '1.0.0');
      expect(doc).toHaveProperty('sections');
    });
  });

  describe('render() — alias for renderDocument()', () => {
    it('returns the same result as renderDocument', () => {
      builder.answer();
      expect(builder.render()).toBe(builder.renderDocument());
    });

    it('produces valid JSON', () => {
      builder.answer().hangup();
      const json = builder.render();
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.sections.main).toHaveLength(2);
    });
  });

  describe('constructor with initialDocument', () => {
    it('accepts an initial document', () => {
      const initial = {
        version: '1.0.0',
        sections: { main: [{ answer: {} }] },
      };
      const b = new SwmlBuilder({ initialDocument: initial });
      const doc = b.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(1);
      expect(doc.sections.main[0]).toEqual({ answer: {} });
    });

    it('defaults version to 1.0.0 when omitted', () => {
      const b = new SwmlBuilder({ initialDocument: { sections: { main: [] } } });
      expect(b.getDocument()).toHaveProperty('version', '1.0.0');
    });

    it('defaults sections when omitted', () => {
      const b = new SwmlBuilder({ initialDocument: {} });
      const doc = b.getDocument() as { sections: Record<string, unknown[]> };
      expect(doc.sections).toHaveProperty('main');
    });

    it('still works with no options', () => {
      const b = new SwmlBuilder();
      const doc = b.getDocument() as { sections: { main: unknown[] } };
      expect(doc).toHaveProperty('version', '1.0.0');
      expect(doc.sections.main).toHaveLength(0);
    });
  });

  describe('document public accessor', () => {
    it('exposes the internal document via getter', () => {
      builder.answer();
      const doc = builder.document;
      expect(doc.version).toBe('1.0.0');
      expect(doc.sections.main).toHaveLength(1);
    });

    it('returns the same reference as getDocument', () => {
      expect(builder.document).toBe(builder.getDocument());
    });
  });

  describe('hangup reason type widened to string', () => {
    it('accepts arbitrary string reasons', () => {
      builder.hangup({ reason: 'custom_reason' as any });
      const doc = builder.getDocument() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ hangup: { reason: 'custom_reason' } });
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
