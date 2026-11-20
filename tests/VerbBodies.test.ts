/**
 * A verb's body as SWML has it, from signalwire-python 3.11.0: an object for
 * most verbs, and a string, number or array for those that take one, through
 * addVerb, addVerbToSection, the builder's verb methods, and the agent's
 * call-flow hooks; a body that isn't a JSON value is refused; sleep's duration
 * is checked (#149); a bad schemaPath fails at construction (#146); and the
 * fallback validator finds required fields behind $refs and unions (#150).
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { AgentBase } from '../src/AgentBase.js';
import { SWMLService } from '../src/SWMLService.js';
import { SchemaUtils, SchemaValidationError } from '../src/SchemaUtils.js';

const SCALAR_BODIES: Array<[string, unknown]> = [
  ['cond', [{ when: 'vars.a == 1', then: [{ hangup: {} }] }]],
  ['label', 'start'],
  ['unset', ['a', 'b']],
  ['unset', 'a'],
  ['sleep', '%{vars.delay}'],
  ['return', 'done'],
];

const service = (schemaValidation = true) =>
  new SWMLService({ name: 'example', route: '/', basicAuth: ['u', 'p'], schemaValidation });
const sections = (s: SWMLService) =>
  (s.getDocument() as { sections: Record<string, unknown[]> }).sections;

describe('verb bodies', () => {
  it.each(
    SCALAR_BODIES.flatMap(([verb, body]) => [
      [verb, body, true],
      [verb, body, false],
    ]) as Array<[string, unknown, boolean]>,
  )('keeps a %s body %j (validation %s) in any section', (verb, body, validation) => {
    const s = service(validation);
    s.addVerb(verb, body);
    s.addVerbToSection('other', verb, body);
    expect(sections(s)['main']).toEqual([{ [verb]: body }]);
    expect(sections(s)['other']).toEqual([{ [verb]: body }]);
  });

  it('refuses a body the schema refuses, in any section', () => {
    const s = service();
    expect(() => s.addVerb('label', ['not', 'a', 'name'])).toThrow(SchemaValidationError);
    expect(() => s.addVerbToSection('other', 'label', 42)).toThrow(SchemaValidationError);
    expect(sections(s)['main']).toEqual([]);
    expect('other' in sections(s)).toBe(false);
  });

  it.each([undefined, null, () => 1, Symbol('x'), 1n, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses a body that is not a JSON value (%s), with validation off too',
    (body) => {
      for (const s of [service(), service(false)]) {
        expect(() => s.addVerb('return', body)).toThrow(TypeError);
        expect(() => s.addVerbToSection('other', 'return', body)).toThrow(TypeError);
      }
    },
  );
});

describe('sleep (#149)', () => {
  it.each([true, false, -2, 0])('refuses %s, as a duration or in an object', (value) => {
    const s = service();
    expect(() => s.addVerb('sleep', value)).toThrow(/sleep/);
    expect(() => s.addVerbToSection('other', 'sleep', value)).toThrow(SchemaValidationError);
    expect(() => s.addVerb('sleep', { duration: value })).toThrow(/sleep/);
    expect(() => s.getBuilder().sleep(value as number)).toThrow(SchemaValidationError);
  });

  it.each([-1, 1, 5000])('takes %s', (value) => {
    const s = service();
    s.addVerb('sleep', value);
    expect(sections(s)['main']).toEqual([{ sleep: value }]);
  });

  it('keeps any value with validation off', () => {
    const s = service(false);
    s.addVerb('sleep', -2);
    expect(sections(s)['main']).toEqual([{ sleep: -2 }]);
  });
});

describe("the builder's verb methods (#142)", () => {
  it('take the body positionally', () => {
    const s = service();
    s.getBuilder()
      .label('start')
      .cond([{ when: 'vars.a == 1', then: [{ hangup: {} }] }])
      .unset('x')
      .connect({ to: '+15551234567' })
      .return('done');
    expect(sections(s)['main']).toEqual([
      { label: 'start' },
      { cond: [{ when: 'vars.a == 1', then: [{ hangup: {} }] }] },
      { unset: 'x' },
      { connect: { to: '+15551234567' } },
      { return: 'done' },
    ]);
  });

  it('take SIP credentials for answer and a status URL for play (#144, #145)', () => {
    const s = service();
    s.getBuilder()
      .answer({ max_duration: 60, username: 'u', password: 'p' })
      .play({ url: 'say:Hello', status_url: 'https://example.com/status' });
    expect(sections(s)['main']).toEqual([
      { answer: { max_duration: 60, username: 'u', password: 'p' } },
      { play: { url: 'say:Hello', status_url: 'https://example.com/status' } },
    ]);
  });
});

describe("the agent's call-flow hooks check a verb when it's added (#148)", () => {
  const agent = () => {
    const a = new AgentBase({ name: 'example', route: '/', basicAuth: ['u', 'p'] });
    a.setPromptText('x');
    return a;
  };

  it.each(['addPreAnswerVerb', 'addPostAnswerVerb', 'addPostAiVerb'] as const)('%s', (hook) => {
    const a = agent();
    expect(() => a[hook]('request', {})).toThrow(/request/);
    a[hook]('request', { url: 'https://example.com/hook', method: 'POST' });
    a[hook]('sleep', 500);
    expect(a.renderSwml()).toContain('"sleep":500');
  });

  it('checks the answer config', () => {
    const a = agent();
    expect(() => a.addAnswerVerb({ max_duration: 'an hour' })).toThrow(SchemaValidationError);
    a.addAnswerVerb({ max_duration: 3600 });
  });
});

describe('an explicit schemaPath that cannot be loaded (#146)', () => {
  it('throws at construction, naming the path and the cause', () => {
    const dir = mkdtempSync(join(tmpdir(), 'schema-'));
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{ not json');
    const missing = join(dir, 'missing.json');
    expect(() => new SWMLService({ name: 's', route: '/', schemaPath: missing })).toThrow(
      new RegExp(
        `schemaPath '${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}' couldn't be loaded: no such file`,
      ),
    );
    expect(() => new AgentBase({ name: 'a', route: '/', schemaPath: bad })).toThrow(
      /couldn't be loaded: .*JSON/,
    );
    expect(new SchemaUtils({ schemaPath: missing }).loadError).toBe('no such file');
    expect(new SchemaUtils().loadError).toBeNull();
  });
});

describe('the fallback validator (#150)', () => {
  it('finds required fields behind $refs and union branches', () => {
    const schema = new SchemaUtils();
    // No full validator: every verb takes the lightweight path
    const fallback = (verb: string, body: unknown) => {
      (schema as unknown as { verbValidators: Map<string, null> }).verbValidators.set(verb, null);
      return schema.validateVerb(verb, body);
    };
    const sms = fallback('send_sms', {});
    expect(sms.valid).toBe(false);
    expect(sms.errors.some((e) => /to_number|from_number/.test(e))).toBe(true);
    expect(fallback('request', {}).valid).toBe(false);
    expect(fallback('request', { url: 'https://x', method: 'GET' })).toEqual({
      valid: true,
      errors: [],
    });
    expect(fallback('sleep', {}).valid).toBe(false);
    expect(fallback('sleep', 5000)).toEqual({ valid: true, errors: [] });
    expect(fallback('label', 'start')).toEqual({ valid: true, errors: [] });
  });
});

describe('the review of the 3.11.0 port (found in review)', () => {
  it.each([new Map([['x', 1]]), new Set([1]), new Date(0), new (class Thing {})()])(
    'refuses a body that is not a JSON object or array (%s)',
    (body) => {
      const a = new AgentBase({ name: 'example', route: '/', basicAuth: ['u', 'p'] });
      for (const s of [service(), service(false)]) {
        expect(() => s.addVerb('return', body)).toThrow(TypeError);
        expect(() => s.addVerbToSection('other', 'return', body)).toThrow(TypeError);
      }
      expect(() => a.addPostAiVerb('return', body as never)).toThrow(TypeError);
    },
  );

  it('loads a custom schema once and shares it with per-request copies, whatever the cwd', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'schema-'));
    const custom = join(dir, 'custom.json');
    writeFileSync(custom, JSON.stringify(new SchemaUtils().loadSchema()));
    // A relative path, which the copies made after a chdir must still find
    const relativePath = relative(process.cwd(), custom);
    const a = new AgentBase({
      name: 'c',
      route: '/',
      basicAuth: ['u', 'p'],
      schemaPath: relativePath,
    });
    a.setPromptText('x');
    a.addPostAiVerb('request', { url: 'https://example.com/hook', method: 'POST' });
    a.setDynamicConfigCallback(() => {});
    const parse = vi.spyOn(JSON, 'parse');
    const cwd = process.cwd();
    try {
      process.chdir(tmpdir());
      for (let i = 0; i < 3; i++) {
        const res = await a
          .getApp()
          .request('/', { headers: { Authorization: 'Basic ' + btoa('u:p') } });
        expect(res.status).toBe(200);
      }
      // The schema file isn't read again for each request
      expect(parse.mock.calls.filter(([text]) => String(text).includes('"$defs"'))).toEqual([]);
    } finally {
      process.chdir(cwd);
      parse.mockRestore();
    }
  });
});
