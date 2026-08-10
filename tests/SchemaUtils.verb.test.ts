import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { SchemaUtils } from '../src/SchemaUtils.js';

/**
 * The verb used to stand in for "docs chose not to enrich this one". Any verb
 * works -- `hangup` is picked because it has no required inner properties, so
 * the un-enriched copy still validates against an empty config and the test can
 * show that dropping the prose degrades nothing else.
 */
const UNENRICHED_VERB = 'hangup';

/**
 * Find the PascalCase `$defs` key that declares `verbName`, by walking
 * `SWMLMethod.anyOf` the way SchemaUtils' own loader does. Derived rather than
 * hardcoded so the helper does not pin a second fixture spelling.
 */
function schemaDefKeyForVerb(schemaDoc: Record<string, unknown>, verbName: string): string {
  const defs = schemaDoc['$defs'] as Record<string, Record<string, unknown>>;
  const anyOf = (defs['SWMLMethod'] as Record<string, unknown>)['anyOf'] as Record<
    string,
    unknown
  >[];
  for (const ref of anyOf) {
    const key = (ref['$ref'] as string).split('/').pop()!;
    const props = defs[key]?.['properties'] as Record<string, unknown> | undefined;
    if (props && Object.keys(props)[0] === verbName) return key;
  }
  throw new Error(`no $defs entry declares verb '${verbName}'`);
}

/** Ajv's ESM/CJS interop default, as SchemaUtils itself resolves it. */
const AjvCtor = ((Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ??
  Ajv2020) as unknown as new (o: object) => object;

/** A minimal VALID config for each verb that reaches the unbundled external $ref. */
const legitConfigs: Record<string, unknown> = {
  ai: { prompt: { text: 'hello' } },
  ai_sidecar: { prompt: { text: 'hello' }, lang: 'en' },
  amazon_bedrock: { prompt: { text: 'hello' } },
  cond: [{ when: 'x == 1', then: [{ hangup: {} }] }],
  connect: { to: 'sip:alice@example.com' },
  execute: { dest: 'main' },
  join_conference: { name: 'room1' },
  switch: { variable: 'x', case: { a: [{ hangup: {} }] } },
};

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

  // getVerbDescription is an ACCESSOR over whatever prose the schema happens to
  // carry -- it is not a wire fact. Descriptions are editorial: the docs pipeline
  // may reword a verb's text, or legitimately decline to enrich a verb at all (a
  // deprecated or internal one), and neither is a defect in this SDK. So these
  // tests assert ACCESSOR properties, driven from the fixture rather than from
  // prose spelled out here: surfaces exactly the schema's text when present,
  // returns '' when absent, never throws, never returns undefined. Pinning the
  // literal English (previously `toContain('End the call')` for hangup) turned a
  // copy edit in another repo into a red port, and requiring a specific verb to be
  // enriched (previously `length > 0` for tap) turned an editorial decision into
  // a failing build.
  describe('getVerbDescription()', () => {
    /** The description the schema itself records for a verb, or '' when unenriched. */
    const fixtureDescription = (verbName: string): string => {
      const inner = schema.getVerbProperties(verbName) as Record<string, unknown>;
      const d = inner['description'];
      return typeof d === 'string' ? d : '';
    };

    it('surfaces exactly the schema description for every enriched verb', () => {
      const enriched = schema.getVerbNames().filter((v) => fixtureDescription(v) !== '');
      // Guard against a vacuous pass: if the schema carried no prose at all this
      // assertion loop would be empty and prove nothing. It is not a claim that
      // any PARTICULAR verb is enriched -- only that when some are, we check them.
      expect(enriched.length).toBeGreaterThan(0);
      for (const verbName of enriched) {
        expect(schema.getVerbDescription(verbName)).toBe(fixtureDescription(verbName));
      }
    });

    it('returns empty string for every verb the schema does not enrich', () => {
      const unenriched = schema.getVerbNames().filter((v) => fixtureDescription(v) === '');
      for (const verbName of unenriched) {
        expect(schema.getVerbDescription(verbName)).toBe('');
      }
    });

    it('returns a string -- never undefined -- for every verb in the schema', () => {
      for (const verbName of schema.getVerbNames()) {
        expect(typeof schema.getVerbDescription(verbName)).toBe('string');
      }
    });

    it('returns empty string for unknown verb', () => {
      const desc = schema.getVerbDescription('nonexistent');
      expect(desc).toBe('');
    });

    it('does not throw for an unknown verb or an empty name', () => {
      expect(() => schema.getVerbDescription('nonexistent')).not.toThrow();
      expect(() => schema.getVerbDescription('')).not.toThrow();
      expect(schema.getVerbDescription('')).toBe('');
    });

    // The scenario the accessor exists to tolerate: the verb IS in the schema, but
    // the docs pipeline chose not to enrich it (deprecated / internal / unwritten).
    // The bundled schema currently enriches all of its verbs, so the only way to
    // exercise this branch is against a schema that deliberately omits the prose.
    describe('a verb that exists but is deliberately not enriched', () => {
      let tmpRoot: string;
      let deprosedPath: string;
      let deprosed: SchemaUtils;

      beforeEach(() => {
        // Repo-local scratch (gitignored .sw-tmp/), derived from this test file's
        // own location so it is CWD-independent -- not a machine-wide temp dir.
        const repoRoot = fileURLToPath(new URL('..', import.meta.url));
        const scratch = join(repoRoot, '.sw-tmp');
        mkdirSync(scratch, { recursive: true });
        tmpRoot = mkdtempSync(join(scratch, 'swts_deprosed_'));
        deprosedPath = join(tmpRoot, 'schema.json');

        // Start from the real bundled schema and strip the description from ONE
        // verb, so the file differs from the shipped one in exactly that respect.
        const bundled = JSON.parse(
          readFileSync(fileURLToPath(new URL('../src/schema.json', import.meta.url)), 'utf8'),
        ) as Record<string, unknown>;
        const defs = bundled['$defs'] as Record<string, Record<string, unknown>>;
        const target = defs[schemaDefKeyForVerb(bundled, UNENRICHED_VERB)]!;
        const outer = target['properties'] as Record<string, Record<string, unknown>>;
        delete outer[UNENRICHED_VERB]!['description'];

        writeFileSync(deprosedPath, JSON.stringify(bundled));
        deprosed = new SchemaUtils({ schemaPath: deprosedPath });
      });

      afterEach(() => {
        rmSync(tmpRoot, { recursive: true, force: true });
      });

      it('loaded the de-prosed schema, not the bundled one', () => {
        // Load-failure is SILENT: loadSchema() falls back to the bundled schema
        // while `schemaPath` still reads back whatever was passed in (verified:
        // a bogus path yields schemaPath='/nonexistent/xyz.json' AND the full
        // 39-verb bundled schema). So the readback proves nothing on its own --
        // assert against the CONTENT that was actually loaded, otherwise this
        // whole block could pass while testing the bundled schema.
        const loaded = deprosed.loadSchema()!;
        const defs = loaded['$defs'] as Record<string, Record<string, unknown>>;
        const inner = defs[schemaDefKeyForVerb(loaded, UNENRICHED_VERB)]!['properties'] as Record<
          string,
          Record<string, unknown>
        >;
        expect(inner[UNENRICHED_VERB]).not.toHaveProperty('description');
        // ...and the bundled schema DOES enrich it, so the absence above is the
        // de-prosed copy and not a property the schema never had.
        expect(schema.getVerbDescription(UNENRICHED_VERB)).not.toBe('');
        expect(deprosed.hasVerb(UNENRICHED_VERB)).toBe(true);
      });

      it('returns empty string and does not throw', () => {
        expect(() => deprosed.getVerbDescription(UNENRICHED_VERB)).not.toThrow();
        expect(deprosed.getVerbDescription(UNENRICHED_VERB)).toBe('');
      });

      it('still exposes the verb and validates it normally', () => {
        // Declining to document a verb must not degrade any other behaviour.
        expect(deprosed.getVerbNames()).toContain(UNENRICHED_VERB);
        expect(deprosed.getVerbProperties(UNENRICHED_VERB)).toHaveProperty('type', 'object');
        expect(deprosed.validateVerb(UNENRICHED_VERB, {}).valid).toBe(true);
      });

      it('leaves other verbs unaffected', () => {
        const other = schema.getVerbNames().find((v) => v !== UNENRICHED_VERB)!;
        expect(deprosed.getVerbDescription(other)).toBe(schema.getVerbDescription(other));
      });
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

  // A verb whose $defs subtree transitively reaches `SWMLAction` hits the
  // schema's one unbundled external `$ref` (`SWMLObject.json`). Ajv resolves
  // refs EAGERLY, so compiling those verbs used to THROW; `getVerbValidator`'s
  // bare catch swallowed it and `validateVerb` fell through to the permissive
  // lightweight check — so a config nobody validated came back
  // `{valid: true, errors: []}`. Measured on main @6a2aa09:
  //   validateVerb('connect', {to, zzz_not_a_real_key}) -> {"valid":true,"errors":[]}
  // 8 of 39 verbs degraded this way, all via
  // `… -> Action -> SWMLAction -> SWMLObject.json`.
  describe('unbundled external $ref must not silently disable validation', () => {
    // Every verb that reached SWMLAction, i.e. the full blast radius.
    const previouslyDegraded = [
      'ai',
      'ai_sidecar',
      'amazon_bedrock',
      'cond',
      'connect',
      'execute',
      'join_conference',
      'switch',
    ];

    // Compiling all 39 verbs eagerly is a test-only sweep and costs ~2.5s: the 7
    // verbs that recurse through `SWMLMethod` are ~200-400ms each (they were
    // "free" before only because they threw immediately). Real callers compile
    // lazily and cache — one cold verb is ~330ms, warm is ~0.02ms.
    it('compiles a validator for EVERY verb in the schema', () => {
      expect(schema.precompileVerbValidators()).toEqual({});
    }, 30_000);

    it('rejects an unknown key on connect (the reported case)', () => {
      const result = schema.validateVerb('connect', {
        to: 'sip:alice@example.com',
        zzz_not_a_real_key: 1,
      });
      expect(result.valid).toBe(false);
    });

    it('still accepts a legitimate connect config', () => {
      expect(schema.validateVerb('connect', { to: 'sip:alice@example.com' }).valid).toBe(true);
    });

    it.each(previouslyDegraded)('rejects an unknown key on %s', (verb) => {
      // `cond` takes an ARRAY of CondParams; inject the bogus key into an element.
      const config: Record<string, unknown> | unknown[] =
        verb === 'cond'
          ? [{ when: 'x == 1', then: [{ hangup: {} }], zzz_not_a_real_key: 1 }]
          : { ...(legitConfigs[verb] as object), zzz_not_a_real_key: 1 };
      expect(schema.validateVerb(verb, config).valid).toBe(false);
    });

    it.each(previouslyDegraded)('still accepts a legitimate %s config', (verb) => {
      expect(schema.validateVerb(verb, legitConfigs[verb]).valid).toBe(true);
    });

    // The ref policy is the root fix; THIS is the backstop. Even if a verb's
    // schema someday fails to compile for an unrelated reason, the caller must
    // be told validation did not happen rather than handed a false pass.
    it('reports a refusal, never `valid: true`, when a verb fails to compile', () => {
      const su = new SchemaUtils();
      su.getVerbNames();
      // Reinstate the pre-fix condition: an Ajv instance with no placeholder
      // registered for the unbundled external ref.
      const internals = su as unknown as {
        ajv: unknown;
        verbValidators: Map<string, unknown>;
        compileFailures: Map<string, string>;
      };
      internals.verbValidators.clear();
      internals.compileFailures.clear();
      internals.ajv = new AjvCtor({ allErrors: true, strict: false, logger: false });

      const result = su.validateVerb('connect', {
        to: 'sip:alice@example.com',
        zzz_not_a_real_key: 1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('failed to compile');
      expect(result.errors[0]).toContain('NOT validated');
      expect(Object.keys(su.compileFailedVerbs)).toContain('connect');
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
