/**
 * pay() and joinConference() send what the platform accepts.
 *
 * pay() sends timeout, max_attempts, min_postal_code_length, security_code
 * and postal_code as strings, whatever the bundled schema's types say: the
 * platform's SWML validator requires strings for security_code and
 * postal_code (mod_infrastructure swml_schema.c:2015-2016), and the pay
 * request reads all five as strings (relay.c generate_pay_request,
 * 9199-9203). It checks each input first: an integer, a boolean, or a SWML
 * variable reference. joinConference() refused max_participants above 250
 * and left out an explicit 250. The platform refuses fewer than 2 members
 * (mod_infrastructure new_conference_controller.c) and has no upper limit, so
 * any integer of 2 or more is accepted, as the Python SDK does.
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

describe('pay() sends strings, as the platform reads them', () => {
  it('sends the defaults as strings', () => {
    const pay = rawVerb(new FunctionResult().pay({ paymentConnectorUrl: URL }), 'pay') as Record<
      string,
      unknown
    >;
    expect(pay['timeout']).toBe('5');
    expect(pay['max_attempts']).toBe('1');
    expect(pay['min_postal_code_length']).toBe('0');
    expect(pay['security_code']).toBe('true');
    expect(pay['postal_code']).toBe('true');
  });

  it('sends given numbers and booleans as strings', () => {
    const pay = rawVerb(
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
    expect(pay['timeout']).toBe('10');
    expect(pay['max_attempts']).toBe('3');
    expect(pay['security_code']).toBe('false');
    expect(pay['postal_code']).toBe('false');
    expect(pay['min_postal_code_length']).toBe('5');
  });

  it('a string postal code is the code itself', () => {
    const pay = rawVerb(
      new FunctionResult().pay({ paymentConnectorUrl: URL, postalCode: '90210' }),
      'pay',
    ) as Record<string, unknown>;
    expect(pay['postal_code']).toBe('90210');
  });

  it('normalizes numeric strings and "true"/"false"', () => {
    const pay = rawVerb(
      new FunctionResult().pay({
        paymentConnectorUrl: URL,
        timeout: '7',
        maxAttempts: ' 2 ',
        minPostalCodeLength: '5',
        securityCode: 'False',
      }),
      'pay',
    ) as Record<string, unknown>;
    expect(pay['timeout']).toBe('7');
    expect(pay['max_attempts']).toBe('2');
    expect(pay['min_postal_code_length']).toBe('5');
    expect(pay['security_code']).toBe('false');
  });

  it('passes a SWML variable reference through', () => {
    const pay = rawVerb(
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

  it('accepts more than the schema cap of 100000, which the platform does not enforce', () => {
    const conf = rawVerb(
      new FunctionResult().joinConference('room', { maxParticipants: 250000 }),
      'join_conference',
    ) as Record<string, unknown>;
    expect(conf['max_participants']).toBe(250000);
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
    [2.5, '2.5'],
    ['many', '"many"'],
  ] as [number | string, string][])('refuses %j', (value, shown) => {
    expect(() => new FunctionResult().joinConference('room', { maxParticipants: value })).toThrow(
      `max_participants must be an integer of at least 2, got ${shown}`,
    );
  });
});
