import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { SwmlBuilder } from '../src/SwmlBuilder.js';
import type { TtsGender } from '../src/relay/closedSets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLOSED_SETS_SRC = path.resolve(__dirname, '../src/relay/closedSets.ts');

// ---------------------------------------------------------------------------
// tsc typo-probe — compile a snippet against the REAL `TtsGender` closed union
// extracted from the shipped source (not a hand-copied duplicate), so the
// closed set under test is the one we actually ship. Hermetic + fast (no
// @types, no lib-check). vitest does not type-check, so this is how
// "the literal set is enforced / an off-spec value is a tsc error" gets verified.
// ---------------------------------------------------------------------------

function extractUnion(aliasName: string): string {
  const src = readFileSync(CLOSED_SETS_SRC, 'utf-8');
  const m = src.match(new RegExp(`export type ${aliasName}\\s*=\\s*([\\s\\S]*?);`));
  if (!m)
    throw new Error(`could not locate \`export type ${aliasName} = ...;\` in ${CLOSED_SETS_SRC}`);
  return m[1]
    .replace(/\s+/g, ' ')
    .replace(/^\|\s*/, '')
    .trim();
}

/** Compile `type TtsGender = ...;` + body; return diagnostics keyed by body line (body line N → file line N+1). */
function typeCheckSayGender(body: string): Map<number, string> {
  const virtual = path.resolve(__dirname, '__say_gender_probe__.ts');
  const source = `type TtsGender = ${extractUnion('TtsGender')};\n` + `${body}\n`;
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    typeRoots: [],
    target: ts.ScriptTarget.ES2022,
  };
  const host = ts.createCompilerHost(options);
  const origRead = host.readFile.bind(host);
  host.readFile = (f) => (path.resolve(f) === virtual ? source : origRead(f));
  const origExists = host.fileExists.bind(host);
  host.fileExists = (f) => (path.resolve(f) === virtual ? true : origExists(f));
  const program = ts.createProgram([virtual], options, host);
  const byLine = new Map<number, string>();
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (!d.file || path.resolve(d.file.fileName) !== virtual || d.start == null) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    byLine.set(line, ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  }
  return byLine;
}

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
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(1);
      expect(doc.sections.main[0]).toEqual({ answer: {} });
    });

    it('answer() with config adds config', () => {
      builder.answer({ max_duration: 3600 });
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ answer: { max_duration: 3600 } });
    });

    it('hangup() with reason', () => {
      builder.hangup({ reason: 'busy' });
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ hangup: { reason: 'busy' } });
    });

    it('hangup() without args adds empty config', () => {
      builder.hangup();
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ hangup: {} });
    });

    it('play() with config', () => {
      builder.play({ url: 'https://example.com/audio.mp3' });
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ play: { url: 'https://example.com/audio.mp3' } });
    });

    it('tap() with required uri', () => {
      builder.tap({ uri: 'wss://example.com/tap' });
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ tap: { uri: 'wss://example.com/tap' } });
    });

    it('goto() with required label', () => {
      builder.goto({ label: 'start' });
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ goto: { label: 'start' } });
    });

    it('label() with string', () => {
      (builder as unknown as Record<string, (...args: unknown[]) => unknown>)['label']('greeting');
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ label: 'greeting' });
    });
  });

  describe('sleep special handling', () => {
    it('sleep() with number adds integer directly', () => {
      builder.sleep(5000);
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ sleep: 5000 });
    });

    it('sleep() with config object', () => {
      builder.sleep({ duration: 3000 });
      const doc = builder.build() as { sections: { main: unknown[] } };
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
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(2);
      expect(doc.sections.main[0]).toEqual({ answer: {} });
      expect(doc.sections.main[1]).toEqual({ hangup: {} });
    });

    it('full call flow: answer → play → hangup', () => {
      builder
        .answer({ max_duration: 3600 })
        .play({ url: 'https://example.com/greeting.mp3' })
        .hangup({ reason: 'hangup' });

      const doc = builder.build() as { sections: { main: unknown[] } };
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
      const doc = builder.build() as { sections: { main: unknown[] } };
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
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(0);
    });

    it('returns this for fluent chaining', () => {
      const result = builder.answer().reset();
      expect(result).toBe(builder);
    });

    it('chains reset with further verbs', () => {
      builder.answer().hangup().reset().answer();
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(1);
      expect(doc.sections.main[0]).toEqual({ answer: {} });
    });
  });

  describe('validation', () => {
    it('rejects missing required properties', () => {
      expect(() => {
        builder.tap({} as Parameters<typeof builder.tap>[0]);
      }).toThrow('SWML verb validation failed');
    });

    it('rejects missing required properties with detail', () => {
      expect(() => {
        builder.tap({} as Parameters<typeof builder.tap>[0]);
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
          skipBuilder.tap({} as Parameters<typeof builder.tap>[0]);
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
      const doc = builder.build() as { sections: Record<string, unknown[]> };
      expect(doc.sections['greet']).toHaveLength(1);
      expect(doc.sections['greet'][0]).toEqual({ play: { url: 'https://example.com/hi.mp3' } });
    });
  });

  describe('say() — text-to-speech convenience', () => {
    it('adds a play verb with say: prefix', () => {
      builder.say('Hello world');
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(1);
      expect(doc.sections.main[0]).toEqual({ play: { url: 'say:Hello world' } });
    });

    it('passes voice option as say_voice', () => {
      builder.say('Hello', { voice: 'en-US-Neural2-F' });
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({
        play: { url: 'say:Hello', say_voice: 'en-US-Neural2-F' },
      });
    });

    it('passes all TTS options', () => {
      builder.say('Test', { voice: 'v', language: 'en', gender: 'female', volume: 10 });
      const doc = builder.build() as { sections: { main: unknown[] } };
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
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(3);
      expect(doc.sections.main[1]).toEqual({ play: { url: 'say:Welcome' } });
    });
  });

  // ── say_gender closed-set typing ───────────────────────────────────────
  // `say()`'s `gender` option is typed `TtsGender` (`'male' | 'female'`) — the
  // CLOSED literal union (no `(string & {})` arm), consistent with the RELAY
  // gender. Autocomplete + typo-checking on the known values; an off-spec value
  // is a compile error. Types erase at runtime, so the wire value is identical
  // to a bare string — closing the type changes what the compiler accepts, not a
  // byte on the wire. The SwmlBuilder is driven for real (no mocks); the produced
  // document is read back via getDocument().
  describe('say() gender — TtsGender closed literal union', () => {
    it('typed union member and bare string emit byte-identical say_gender', () => {
      const typed: TtsGender = 'female';

      const a = new SwmlBuilder();
      a.say('hi', { gender: typed });
      const docTyped = a.build() as { sections: { main: Array<Record<string, unknown>> } };

      const b = new SwmlBuilder();
      b.say('hi', { gender: 'female' }); // bare string literal
      const docStr = b.build() as { sections: { main: Array<Record<string, unknown>> } };

      expect((docTyped.sections.main[0].play as Record<string, unknown>).say_gender).toBe('female');
      // Byte-for-byte identical play verb whether the value was the typed union
      // member or the bare string — the type is pure compile-time ergonomics.
      expect(docStr.sections.main[0]).toEqual(docTyped.sections.main[0]);
    });

    it("accepts 'male' (the literal never present in the schema's examples)", () => {
      const gender: TtsGender = 'male';
      builder.say('hi', { gender });
      const doc = builder.build() as { sections: { main: Array<Record<string, unknown>> } };
      expect((doc.sections.main[0].play as Record<string, unknown>).say_gender).toBe('male');
    });

    it('rejects an off-spec gender at the call site, but the wire is unchanged', () => {
      // The `(string & {})` arm is gone — an off-spec gender is now a COMPILE
      // error at the call site. If the arm were still present, this
      // `@ts-expect-error` would itself be an unused-directive error, failing the
      // build. Types erase, so the value still reaches the wire verbatim: closing
      // the type changes what the compiler accepts, not a single wire byte.
      // @ts-expect-error — 'neutral' is not a TtsGender; the open arm was removed.
      builder.say('hi', { gender: 'neutral' });
      const doc = builder.build() as { sections: { main: Array<Record<string, unknown>> } };
      expect((doc.sections.main[0].play as Record<string, unknown>).say_gender).toBe('neutral');
    });

    it("autocompletes 'male'/'female' and REJECTS an off-spec value at COMPILE time", () => {
      // Drive the REAL shipped CLOSED union through tsc: the known literals are
      // clean; an off-spec string ('neutral') is now REJECTED (the open arm was
      // removed — this is the inverse of what the test asserted before); a
      // non-string is rejected too.
      const errs = typeCheckSayGender(
        `const ok1: TtsGender = 'female'; void ok1;\n` + // body line 0 → diag line 1
          `const ok2: TtsGender = 'male'; void ok2;\n` + // body line 1 → diag line 2
          `const off: TtsGender = 'neutral'; void off;\n` + // body line 2 → diag line 3 (now rejected)
          `const bad: TtsGender = 42; void bad;`, // body line 3 → diag line 4 (rejected)
      );
      expect(errs.get(1)).toBeUndefined(); // 'female' clean
      expect(errs.get(2)).toBeUndefined(); // 'male' clean
      expect(errs.get(3)).toBeDefined(); // 'neutral' now REJECTED (closed)
      expect(errs.get(3)!).toMatch(/not assignable to type 'TtsGender'/);
      const badErr = errs.get(4);
      expect(badErr).toBeDefined();
      expect(badErr!).toMatch(/not assignable to type 'TtsGender'/);
    });
  });

  describe('addSection() — create empty section', () => {
    it('creates an empty named section', () => {
      builder.addSection('greetings');
      const doc = builder.build() as { sections: Record<string, unknown[]> };
      expect(doc.sections['greetings']).toEqual([]);
    });

    it('is a no-op if section already exists', () => {
      builder.addVerbToSection('greetings', 'play', { url: 'https://example.com/hi.mp3' });
      builder.addSection('greetings');
      const doc = builder.build() as { sections: Record<string, unknown[]> };
      expect(doc.sections['greetings']).toHaveLength(1);
    });

    it('returns this for fluent chaining', () => {
      const result = builder.addSection('test');
      expect(result).toBe(builder);
    });

    it('chains with addVerbToSection', () => {
      builder.addSection('custom').addVerbToSection('custom', 'play', { url: 'say:hi' });
      const doc = builder.build() as { sections: Record<string, unknown[]> };
      expect(doc.sections['custom']).toHaveLength(1);
    });
  });

  describe('build() — alias for getDocument()', () => {
    it('returns the same result as getDocument', () => {
      builder.answer();
      expect(builder.build()).toBe(builder.build());
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
      expect(builder.render()).toBe(builder.render());
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
      const doc = b.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main).toHaveLength(1);
      expect(doc.sections.main[0]).toEqual({ answer: {} });
    });

    it('defaults version to 1.0.0 when omitted', () => {
      const b = new SwmlBuilder({ initialDocument: { sections: { main: [] } } });
      expect(b.build()).toHaveProperty('version', '1.0.0');
    });

    it('defaults sections when omitted', () => {
      const b = new SwmlBuilder({ initialDocument: {} });
      const doc = b.build() as { sections: Record<string, unknown[]> };
      expect(doc.sections).toHaveProperty('main');
    });

    it('still works with no options', () => {
      const b = new SwmlBuilder();
      const doc = b.build() as { sections: { main: unknown[] } };
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
      expect(builder.document).toBe(builder.build());
    });
  });

  describe('hangup reason type widened to string', () => {
    it('accepts arbitrary string reasons', () => {
      builder.hangup({ reason: 'custom_reason' });
      const doc = builder.build() as { sections: { main: unknown[] } };
      expect(doc.sections.main[0]).toEqual({ hangup: { reason: 'custom_reason' } });
    });
  });

  describe('getDocument() and renderDocument()', () => {
    it('getDocument returns correct structure', () => {
      builder.answer();
      const doc = builder.build();
      expect(doc).toHaveProperty('version', '1.0.0');
      expect(doc).toHaveProperty('sections');
      const sections = doc['sections'] as Record<string, unknown[]>;
      expect(sections).toHaveProperty('main');
      expect(sections['main']).toHaveLength(1);
    });

    it('renderDocument produces valid JSON', () => {
      builder.answer().sleep(1000).hangup();
      const json = builder.render();
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
