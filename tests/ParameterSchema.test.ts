/**
 * Tests for the typed SWAIG tool-parameter builder (ParameterSchema / paramSchema).
 *
 * The contract is "byte-identical to the untyped blob, additive": every test
 * pins the builder's output against the *equivalent hand-written* JSON-Schema
 * object — including an `enum` property — and the agent-rendering tests drive a
 * REAL `AgentBase` (no mocks) through `renderSwml()` and read the parameters
 * back out of the generated SWAIG JSON, comparing builder-built vs hand-written
 * tools rendered by the same real code path.
 */
import { describe, it, expect } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';
import {
  ParameterSchema,
  paramSchema,
  RECORD_FORMATS,
  RECORD_DIRECTIONS,
  TAP_DIRECTIONS,
  TAP_CODECS,
  type ParameterSchemaObject,
} from '../src/ParameterSchema.js';

/** Pull a named function's `parameters` out of a real rendered SWML document. */
function renderedParams(agent: AgentBase, fnName: string): unknown {
  const swml = JSON.parse(agent.renderSwml());
  const ai = swml.sections.main[1].ai;
  const fn = ai.SWAIG.functions.find((f: { function: string }) => f.function === fnName);
  return fn?.parameters;
}

describe('ParameterSchema (unit: byte-identical to the untyped blob)', () => {
  it('paramSchema() returns a ParameterSchema builder', () => {
    expect(paramSchema()).toBeInstanceOf(ParameterSchema);
  });

  it('scalar properties build the exact hand-written object', () => {
    const built = paramSchema()
      .string('city', 'The city name')
      .integer('days', 'Number of days')
      .number('lat', 'Latitude')
      .boolean('verbose', 'Verbose output')
      .build();

    const handWritten = {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'The city name' },
        days: { type: 'integer', description: 'Number of days' },
        lat: { type: 'number', description: 'Latitude' },
        verbose: { type: 'boolean', description: 'Verbose output' },
      },
    };

    expect(built).toEqual(handWritten);
    // Byte-identical: same keys in the same order (serialised form matches).
    expect(JSON.stringify(built)).toBe(JSON.stringify(handWritten));
  });

  it('enum property is byte-identical to a hand-written enum entry', () => {
    const built = paramSchema()
      .string('location', 'The city or location')
      .enum('units', ['celsius', 'fahrenheit'], 'Temperature units')
      .build();

    // This is the canonical Python example shape
    // (examples/swaig_features_agent.py:189-201).
    const handWritten = {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'The city or location' },
        units: {
          type: 'string',
          description: 'Temperature units',
          enum: ['celsius', 'fahrenheit'],
        },
      },
    };

    expect(built).toEqual(handWritten);
    expect(JSON.stringify(built)).toBe(JSON.stringify(handWritten));
  });

  it('required() emits required:[...] in call order; omitted when none', () => {
    const withReq = paramSchema().string('a', 'A').string('b', 'B').required('b', 'a').build();
    expect(withReq).toEqual({
      type: 'object',
      properties: {
        a: { type: 'string', description: 'A' },
        b: { type: 'string', description: 'B' },
      },
      required: ['b', 'a'],
    });

    // No required() → no `required` key at all (matches a hand-written blob
    // that omits it; defineTool then receives no required list).
    const noReq = paramSchema().string('a', 'A').build();
    expect('required' in noReq).toBe(false);
  });

  it('required() de-duplicates and is order-independent of property order', () => {
    const built = paramSchema()
      .string('a', 'A')
      .required('a')
      .string('b', 'B')
      .required('a', 'b')
      .build();
    expect(built.required).toEqual(['a', 'b']);
  });

  it('property() merges arbitrary JSON-Schema keywords verbatim', () => {
    const built = paramSchema()
      .string('code', 'Account code', { minLength: 8, pattern: '^[0-9]+$' })
      .build();
    expect(built.properties['code']).toEqual({
      type: 'string',
      description: 'Account code',
      minLength: 8,
      pattern: '^[0-9]+$',
    });
  });

  it('array() emits items when provided', () => {
    const built = paramSchema().array('tags', { type: 'string' }, 'List of tags').build();
    expect(built.properties['tags']).toEqual({
      type: 'array',
      description: 'List of tags',
      items: { type: 'string' },
    });
  });

  it('description defaults to empty string (matches a blob that omits it)', () => {
    const built = paramSchema().string('x').build();
    expect(built.properties['x']).toEqual({ type: 'string', description: '' });
  });

  it('build() returns a fresh object that does not alias the builder', () => {
    const b = paramSchema().string('a', 'A').required('a');
    const first = b.build();
    (first.properties as Record<string, unknown>)['injected'] = { type: 'string' };
    first.required!.push('injected');
    const second = b.build();
    expect(second.properties['injected']).toBeUndefined();
    expect(second.required).toEqual(['a']);
  });
});

describe('ParameterSchema (Tier-1 closed-set convenience → enum:[...])', () => {
  it('recordFormat bakes in {wav,mp3,mp4}', () => {
    const built = paramSchema().recordFormat('fmt', 'Recording format').build();
    expect(built.properties['fmt']).toEqual({
      type: 'string',
      description: 'Recording format',
      enum: ['wav', 'mp3', 'mp4'],
    });
    expect(built.properties['fmt']!['enum']).toEqual([...RECORD_FORMATS]);
  });

  it('recordDirection bakes in {speak,listen,both} (uses listen)', () => {
    const built = paramSchema().recordDirection('dir').build();
    expect(built.properties['dir']!['enum']).toEqual(['speak', 'listen', 'both']);
    expect(built.properties['dir']!['enum']).toEqual([...RECORD_DIRECTIONS]);
  });

  it('tapDirection bakes in {speak,hear,both} (uses hear, NOT listen)', () => {
    const built = paramSchema().tapDirection('dir').build();
    expect(built.properties['dir']!['enum']).toEqual(['speak', 'hear', 'both']);
    expect(built.properties['dir']!['enum']).toEqual([...TAP_DIRECTIONS]);
  });

  it('codec bakes in the 2-value SWAIG tap codec {PCMU,PCMA}', () => {
    const built = paramSchema().codec('media_codec').build();
    expect(built.properties['media_codec']!['enum']).toEqual(['PCMU', 'PCMA']);
    expect(built.properties['media_codec']!['enum']).toEqual([...TAP_CODECS]);
  });

  it('the three direction/codec vocabularies stay distinct (never unified)', () => {
    // record uses `listen`; tap uses `hear`; they must differ.
    expect([...RECORD_DIRECTIONS]).not.toEqual([...TAP_DIRECTIONS]);
    expect(RECORD_DIRECTIONS.includes('listen' as never)).toBe(true);
    expect(TAP_DIRECTIONS.includes('hear' as never)).toBe(true);
    expect(RECORD_DIRECTIONS.includes('hear' as never)).toBe(false);
    expect(TAP_DIRECTIONS.includes('listen' as never)).toBe(false);
    // SWAIG tap codec is exactly 2 values (not the 7-value RELAY superset).
    expect(TAP_CODECS.length).toBe(2);
  });

  it('a baked enum is byte-identical to writing the same enum explicitly', () => {
    const baked = paramSchema().recordFormat('fmt', 'Recording format').build();
    const explicit = paramSchema().enum('fmt', ['wav', 'mp3', 'mp4'], 'Recording format').build();
    expect(JSON.stringify(baked)).toBe(JSON.stringify(explicit));
  });
});

describe('ParameterSchema (real agent: rendered SWAIG JSON, no mocks)', () => {
  function agentWithTool(parameters: ParameterSchemaObject | Record<string, unknown>): AgentBase {
    const agent = new AgentBase({ name: 'ps-test', route: '/ps' });
    agent.setPromptText('hello');
    agent.defineTool({
      name: 'get_forecast',
      description: 'Get a 3-day forecast',
      // ParameterSchemaObject is a closed interface (no index signature) but is
      // a structurally-valid parameters blob; widen to the Record the API takes.
      parameters: parameters as Record<string, unknown>,
      handler: (args: Record<string, unknown>) =>
        new FunctionResult(`Forecast for ${args['location']}`),
    });
    return agent;
  }

  it('builder-built params render byte-identically to the hand-written blob', () => {
    const builderParams = paramSchema()
      .string('location', 'The city or location')
      .enum('units', ['celsius', 'fahrenheit'], 'Temperature units')
      .required('location')
      .build();

    // The same parameters object written out by hand (already fully shaped,
    // exactly what the builder emits) — the thing the builder replaces.
    const handWrittenParams = {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'The city or location' },
        units: {
          type: 'string',
          description: 'Temperature units',
          enum: ['celsius', 'fahrenheit'],
        },
      },
      required: ['location'],
    };

    const fromBuilder = renderedParams(agentWithTool(builderParams), 'get_forecast');
    const fromHand = renderedParams(agentWithTool(handWrittenParams), 'get_forecast');

    // Both go through the REAL renderSwml() SWAIG path.
    expect(fromBuilder).toEqual(handWrittenParams);
    expect(JSON.stringify(fromBuilder)).toBe(JSON.stringify(fromHand));
  });

  it('rendered SWAIG carries the enum property the model reads', () => {
    const params = paramSchema()
      .string('location', 'The city or location')
      .recordFormat('fmt', 'Recording format')
      .build();
    const rendered = renderedParams(agentWithTool(params), 'get_forecast') as {
      type: string;
      properties: Record<string, { type: string; enum?: unknown[] }>;
    };
    expect(rendered.type).toBe('object');
    expect(rendered.properties['fmt']!.type).toBe('string');
    expect(rendered.properties['fmt']!.enum).toEqual(['wav', 'mp3', 'mp4']);
  });

  it('builder params also work via defineTypedTool (override inference)', () => {
    const agent = new AgentBase({ name: 'ps-typed', route: '/ps' });
    agent.setPromptText('hello');
    // The typed handler's inference would only yield untyped string params with
    // no enum; the explicit builder schema must win and carry the enum.
    agent.defineTypedTool({
      name: 'pick_format',
      description: 'Pick a recording format',
      parameters: paramSchema()
        .recordFormat('fmt', 'Recording format')
        .build() as unknown as Record<string, unknown>,
      handler: (fmt: string) => new FunctionResult(`Picked ${fmt}`),
    });
    const rendered = renderedParams(agent, 'pick_format') as {
      properties: Record<string, { enum?: unknown[] }>;
    };
    expect(rendered.properties['fmt']!.enum).toEqual(['wav', 'mp3', 'mp4']);
  });

  it('the builder-built tool actually executes and returns its result', async () => {
    const agent = agentWithTool(
      paramSchema().string('location', 'The city').required('location').build(),
    );
    const fn = agent.getTool('get_forecast');
    expect(fn).toBeDefined();
    const result = await fn!.execute({ location: 'Denver' }, {});
    expect(result['response']).toBe('Forecast for Denver');
  });
});
