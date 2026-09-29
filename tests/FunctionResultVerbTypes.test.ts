/**
 * pay() and joinConference() send the types and ranges the SWML schema defines.
 *
 * pay() sent timeout, max_attempts, min_postal_code_length and security_code
 * (and a boolean postal_code) as strings, which the schema's integer and
 * boolean types reject. joinConference() refused max_participants above 250
 * and left out an explicit 250, so the platform's default of 100000 applied;
 * the schema allows 2 to 100000.
 */
import { FunctionResult } from '../src/FunctionResult.js';
import { SchemaUtils } from '../src/SchemaUtils.js';

const schema = new SchemaUtils({ skipValidation: false });

/** The verb's config from a result's inline SWML. */
function rawVerb(result: FunctionResult, name: string): unknown {
  const action = (result.toDict()['action'] as Record<string, unknown>[])[0]!;
  const main = (action['SWML'] as { sections: { main: Record<string, unknown>[] } }).sections.main;
  return main.find((v) => name in v)![name];
}

/** The verb's config from a result's inline SWML, after checking it against the schema. */
function verb(result: FunctionResult, name: string): unknown {
  const config = rawVerb(result, name);
  const check = schema.validateVerb(name, config);
  expect(check.errors).toEqual([]);
  expect(check.valid).toBe(true);
  return config;
}

const URL = 'https://pay.example.com/c';

describe('pay() sends schema types', () => {
  it('sends the defaults as integers and booleans', () => {
    const pay = verb(new FunctionResult().pay({ paymentConnectorUrl: URL }), 'pay') as Record<
      string,
      unknown
    >;
    expect(pay['timeout']).toBe(5);
    expect(pay['max_attempts']).toBe(1);
    expect(pay['min_postal_code_length']).toBe(0);
    expect(pay['security_code']).toBe(true);
    expect(pay['postal_code']).toBe(true);
  });

  it('sends given numbers and booleans as they are', () => {
    const pay = verb(
      new FunctionResult().pay({
        paymentConnectorUrl: URL,
        timeout: 10,
        maxAttempts: 3,
        securityCode: false,
        postalCode: false,
        minPostalCodeLength: 5,
      }),
      'pay',
    ) as Record<string, unknown>;
    expect(pay['timeout']).toBe(10);
    expect(pay['max_attempts']).toBe(3);
    expect(pay['security_code']).toBe(false);
    expect(pay['postal_code']).toBe(false);
    expect(pay['min_postal_code_length']).toBe(5);
  });

  it('a string postal code is the code itself', () => {
    const pay = verb(
      new FunctionResult().pay({ paymentConnectorUrl: URL, postalCode: '90210' }),
      'pay',
    ) as Record<string, unknown>;
    expect(pay['postal_code']).toBe('90210');
  });

  it('converts numeric strings and "true"/"false"', () => {
    const pay = verb(
      new FunctionResult().pay({
        paymentConnectorUrl: URL,
        timeout: '7',
        maxAttempts: ' 2 ',
        minPostalCodeLength: '5',
        securityCode: 'False',
      }),
      'pay',
    ) as Record<string, unknown>;
    expect(pay['timeout']).toBe(7);
    expect(pay['max_attempts']).toBe(2);
    expect(pay['min_postal_code_length']).toBe(5);
    expect(pay['security_code']).toBe(false);
  });

  it('passes a SWML variable reference through', () => {
    const pay = verb(
      new FunctionResult().pay({
        paymentConnectorUrl: URL,
        timeout: '${pay_timeout}',
        maxAttempts: '%{tries}',
        securityCode: '%{needs_cvv}',
      }),
      'pay',
    ) as Record<string, unknown>;
    expect(pay['timeout']).toBe('${pay_timeout}');
    expect(pay['max_attempts']).toBe('%{tries}');
    expect(pay['security_code']).toBe('%{needs_cvv}');
  });

  it.each([
    [{ timeout: 'soon' }, 'timeout must be an integer, got "soon"'],
    [{ maxAttempts: 1.5 }, 'max_attempts must be an integer, got 1.5'],
    [{ maxAttempts: Number.NaN }, 'max_attempts must be an integer, got NaN'],
    [{ minPostalCodeLength: '' }, 'min_postal_code_length must be an integer, got ""'],
    [{ securityCode: 'yes' }, 'security_code must be a boolean, got "yes"'],
  ] as [Record<string, unknown>, string][])('refuses %j', (opts, message) => {
    expect(() => new FunctionResult().pay({ paymentConnectorUrl: URL, ...opts })).toThrow(message);
  });

  it('refuses values the types rule out, from untyped callers', () => {
    const untyped = (opts: Record<string, unknown>) =>
      new FunctionResult().pay({ paymentConnectorUrl: URL, ...opts } as never);
    expect(() => untyped({ maxAttempts: true })).toThrow(
      'max_attempts must be an integer, got true',
    );
    expect(() => untyped({ securityCode: 1 })).toThrow('security_code must be a boolean, got 1');
  });
});

describe('joinConference() maxParticipants follows the schema', () => {
  it('sends an explicit 250', () => {
    expect(
      verb(
        new FunctionResult().joinConference('room', { maxParticipants: 250 }),
        'join_conference',
      ),
    ).toEqual({ name: 'room', max_participants: 250 });
  });

  it.each([2, 251, 1000, 100000])('accepts %d', (value) => {
    const conf = verb(
      new FunctionResult().joinConference('room', { maxParticipants: value }),
      'join_conference',
    ) as Record<string, unknown>;
    expect(conf['max_participants']).toBe(value);
  });

  it('leaves it out by default', () => {
    expect(
      verb(new FunctionResult().joinConference('room', { muted: true }), 'join_conference'),
    ).toEqual({ name: 'room', muted: true });
  });

  it('keeps the simple form when only a name is given', () => {
    // The name-only string form, as Python renders it; the bundled schema's
    // JoinConferenceObject defines only the object form, so it isn't validated here.
    expect(rawVerb(new FunctionResult().joinConference('room'), 'join_conference')).toBe('room');
    expect(rawVerb(new FunctionResult().joinConference('room', {}), 'join_conference')).toBe(
      'room',
    );
  });

  it('passes a SWML variable reference through, and converts a numeric string', () => {
    const conf = verb(
      new FunctionResult().joinConference('room', { maxParticipants: '${room_size}' }),
      'join_conference',
    ) as Record<string, unknown>;
    expect(conf['max_participants']).toBe('${room_size}');
    const conf2 = verb(
      new FunctionResult().joinConference('room', { maxParticipants: '500' }),
      'join_conference',
    ) as Record<string, unknown>;
    expect(conf2['max_participants']).toBe(500);
  });

  it.each([
    [1, '1'],
    [0, '0'],
    [-5, '-5'],
    [100001, '100001'],
    [2.5, '2.5'],
    ['many', '"many"'],
  ] as [number | string, string][])('refuses %j', (value, shown) => {
    expect(() => new FunctionResult().joinConference('room', { maxParticipants: value })).toThrow(
      `max_participants must be an integer from 2 to 100000, got ${shown}`,
    );
  });
});
