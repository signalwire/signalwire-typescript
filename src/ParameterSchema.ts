/**
 * ParameterSchema — a typed, fluent builder for SWAIG tool parameter schemas.
 *
 * ## Why this exists (the Tier-2 flagship affordance — TS, explicit-params path)
 *
 * A SWAIG tool's parameters are a JSON-Schema `object`: `{ type: 'object',
 * properties: { <name>: { type, description, enum? }, ... }, required: [...] }`.
 * The Python reference (`define_tool(parameters=...)`) takes that as a bare
 * `Dict[str, Any]`, and the TS port mirrors it on
 * {@link ../AgentBase.AgentBase.defineTool} / `defineTypedTool` as
 * `parameters?: Record<string, unknown>` — a fully **untyped blob**. There are
 * two distinct ways a user supplies a tool's parameters in TS:
 *
 *   1. **Inference** — `defineTypedTool` reads the handler's parameter
 *      *names + default-value literals* (via {@link ../TypeInference.inferSchema})
 *      and synthesises a schema. This is the idiomatic zero-boilerplate path,
 *      but it is **lossy by construction**: `fn.toString()` has erased the
 *      TypeScript type annotations, so inference can only produce
 *      `string`/`integer`/`number`/`boolean` from a literal default — it can
 *      **never** emit an `enum`, and it hard-codes each `description` to
 *      `"The <name> parameter"` (useless to the model, which reads descriptions
 *      as prompt engineering).
 *   2. **Explicit `parameters`** — the user writes the JSON-Schema object by
 *      hand. This is the path where `enum`s and real descriptions live, and
 *      until now it was the *purely untyped* `Record<string, unknown>` blob:
 *      no autocomplete, no typo-checking, no help wiring the Tier-1 closed sets
 *      (record format/direction, tap direction, codec) in as `enum:[...]`.
 *
 * `ParameterSchema` is the **typed builder for path 2** — the idiomatic
 * replacement for the explicit untyped blob. It is **purely additive** and the
 * wire output is **byte-identical** to the equivalent hand-written object:
 * `paramSchema().string('service', 'The service').enum('fmt', RECORD_FORMATS,
 * 'format').required('service').build()` produces exactly the same
 * `{ type:'object', properties:{…}, required:[…] }` the untyped path produces,
 * key-for-key. TypeScript erases types, so the bytes placed on the wire are
 * identical either way — this is autocomplete/typo/closed-set ergonomics with
 * **zero** surface or emission effect (drift stays 0; it is a PORT_ADDITION).
 *
 * The Tier-1 closed-set unions live alongside the value arrays in this module
 * ({@link RECORD_FORMATS} / {@link RECORD_DIRECTIONS} / {@link TAP_DIRECTIONS} /
 * {@link TAP_CODECS}) and are exposed as convenience methods
 * ({@link ParameterSchema.recordFormat} etc.) that bake the closed set in as a
 * typed `enum` property — the same idiom as `SkillName`/`closedSets.ts`, now on
 * the tool-parameter side. See IDIOM_PASS_JOURNAL.md §2 / §4 "Tier 2 flagship".
 *
 * @example Builder with an enum, byte-identical to the explicit blob
 * ```ts
 * agent.defineTool({
 *   name: 'get_forecast',
 *   description: 'Get a 3-day weather forecast for a location',
 *   parameters: paramSchema()
 *     .string('location', 'The city or location')
 *     .enum('units', ['celsius', 'fahrenheit'], 'Temperature units')
 *     .build(),
 *   handler: (args) => new FunctionResult(`Forecast for ${args['location']}`),
 * });
 * // parameters is identical to writing:
 * //   { type: 'object', properties: {
 * //       location: { type: 'string', description: 'The city or location' },
 * //       units: { type: 'string', description: 'Temperature units',
 * //                enum: ['celsius', 'fahrenheit'] } } }
 * ```
 */

/**
 * Recording format for the SWAIG `record_call` verb — the strongly-grounded
 * Tier-1 closed set (`function_result.py:914` `raise ValueError`-validated;
 * SWML `$defs/RecordCall.format`). Used by {@link ParameterSchema.recordFormat}.
 */
export const RECORD_FORMATS = ['wav', 'mp3', 'mp4'] as const;
/** A single {@link RECORD_FORMATS} value. */
export type RecordFormat = (typeof RECORD_FORMATS)[number];

/**
 * Recording direction for the SWAIG `record_call` verb — Tier-1 closed set
 * (`function_result.py:918`). NOTE: distinct from {@link TAP_DIRECTIONS} —
 * record uses `listen`, tap uses `hear` (never unify; see journal §3 "three
 * direction vocabularies"). Used by {@link ParameterSchema.recordDirection}.
 */
export const RECORD_DIRECTIONS = ['speak', 'listen', 'both'] as const;
/** A single {@link RECORD_DIRECTIONS} value. */
export type RecordDirection = (typeof RECORD_DIRECTIONS)[number];

/**
 * Tap direction for the SWAIG `tap` verb — Tier-1 closed set
 * (`function_result.py:1213`). Uses `hear`, NOT record's `listen`. Used by
 * {@link ParameterSchema.tapDirection}.
 */
export const TAP_DIRECTIONS = ['speak', 'hear', 'both'] as const;
/** A single {@link TAP_DIRECTIONS} value. */
export type TapDirection = (typeof TAP_DIRECTIONS)[number];

/**
 * Tap media codec for the SWAIG `tap` verb — Tier-1 closed set
 * (`function_result.py:1218`). The 2-value SWAIG tap codec, distinct from the
 * 7-value RELAY connect/stream codec superset (never reuse). Used by
 * {@link ParameterSchema.codec}.
 */
export const TAP_CODECS = ['PCMU', 'PCMA'] as const;
/** A single {@link TAP_CODECS} value. */
export type TapCodec = (typeof TAP_CODECS)[number];

/** The JSON-Schema scalar `type` keywords a SWAIG parameter property may use. */
export type ParameterType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

/**
 * A single JSON-Schema property entry inside a tool's `parameters.properties`.
 * Mirrors the shape the model reads on every turn: `type` + LLM-facing
 * `description`, with an optional `enum` / `items` and any extra JSON-Schema
 * keywords (`minLength`, `pattern`, `format`, …) merged through verbatim.
 */
export interface ParameterProperty {
  type: ParameterType;
  description: string;
  enum?: readonly unknown[];
  items?: Record<string, unknown>;
  [extra: string]: unknown;
}

/**
 * The serialised SWAIG parameter schema: a JSON-Schema `object`. This is the
 * exact shape `defineTool({ parameters })` accepts and what the SDK renders
 * into the OpenAI tool schema's `parameters` field.
 */
export interface ParameterSchemaObject {
  type: 'object';
  properties: Record<string, ParameterProperty>;
  required?: string[];
}

// ---------------------------------------------------------------------------
// Compile-time schema → handler-args inference (used by `defineTool<P, R>`).
//
// `defineTool({ parameters })` takes the FLAT property map (`{ name: {type,…} }`,
// not the wrapped `{type:'object',properties}` form). When the caller writes that
// map inline AND `defineTool` captures it with a `const` type parameter, these
// types read the literal `type`/`enum` back out and synthesise the precise
// `args` object the handler receives — `args.phone` is `string`, an `enum` prop
// narrows to its literal union, `required` splits required vs optional keys.
// Purely compile-time: erased at runtime, where args really are
// `Record<string, unknown>` (a SWAIG handler can be handed anything the model
// extracts — typing is an authoring convenience, not a runtime guarantee).
// ---------------------------------------------------------------------------

/**
 * One property entry in a tool's flat parameter map, precise enough to read.
 * Extra JSON-Schema keywords (`minLength`, `pattern`, `format`, nested wrapped
 * forms, …) pass through via the index signature, so existing callers that
 * carry more than `{type,description}` still satisfy it.
 */
export interface PropSchema {
  type: ParameterType;
  description?: string;
  enum?: readonly unknown[];
  /** Element schema, for `type: 'array'`. */
  items?: PropSchema;
  /** Nested property map, for `type: 'object'`. */
  properties?: Record<string, PropSchema>;
  [extra: string]: unknown;
}

/** The flat `name → PropSchema` map `defineTool({ parameters })` accepts. */
export type ParametersSchema = Record<string, PropSchema>;

/**
 * Accepted `parameters` shapes for `defineTool`. The FLAT map (`{ name: {…} }`)
 * is what enables `InferArgs` inference; the WRAPPED JSON-Schema object
 * (`{ type:'object', properties }`) and a pre-built loose `Record` are also
 * accepted for backward compatibility (they don't drive arg inference).
 */
export type ToolParameters =
  | ParametersSchema
  | { type: 'object'; properties?: Record<string, unknown>; required?: readonly string[] }
  | Record<string, unknown>;

/**
 * The handler-args type for a given `parameters` (`P`) + `required` (`R`).
 * Only narrows when `P` is a clean FLAT schema map; the wrapped JSON-Schema
 * object and loose records degrade to the open `Record<string, unknown>` so
 * existing callers keep their old (untyped-args) behavior unchanged.
 */
export type ToolArgs<P, R extends readonly PropertyKey[]> = P extends { type: 'object' }
  ? Record<string, unknown> // wrapped form → not inferred
  : P extends ParametersSchema
    ? InferArgs<P, R extends readonly (keyof P)[] ? R : []>
    : Record<string, unknown>;

/** Map a single property's schema to the TS type the handler sees for it. */
export type PropToTs<P extends PropSchema> = P extends { enum: readonly (infer E)[] }
  ? E // enum wins: union of its literal members
  : P['type'] extends 'string'
    ? string
    : P['type'] extends 'number' | 'integer'
      ? number
      : P['type'] extends 'boolean'
        ? boolean
        : P['type'] extends 'array'
          ? P extends { items: infer I extends PropSchema }
            ? PropToTs<I>[]
            : unknown[]
          : P['type'] extends 'object'
            ? P extends { properties: infer Pr extends ParametersSchema }
              ? InferArgs<Pr>
              : Record<string, unknown>
            : unknown;

/**
 * Map a whole flat parameter map to the handler's `args` type, splitting
 * required keys (present) from the rest (optional) per the `required` list `R`.
 * Default `R = []` makes every prop optional (matches "no required list").
 */
export type InferArgs<P extends ParametersSchema, R extends readonly (keyof P)[] = []> = {
  [K in keyof P as K extends R[number] ? K : never]: PropToTs<P[K]>;
} & {
  [K in keyof P as K extends R[number] ? never : K]?: PropToTs<P[K]>;
};

/**
 * Fluent builder producing a {@link ParameterSchemaObject} byte-identical to
 * the equivalent hand-written `parameters` blob. Every method returns `this`
 * for chaining; call {@link build} to obtain the plain object to hand to
 * `defineTool`/`defineTypedTool`.
 *
 * Insertion order is preserved: properties appear in the order their methods
 * were called (matching a hand-written object literal), and `required` lists
 * names in the order {@link required} received them.
 */
export class ParameterSchema {
  private readonly _properties: Record<string, ParameterProperty> = {};
  private readonly _required: string[] = [];

  /**
   * Add a property with an explicit JSON-Schema `type`.
   *
   * @param name - Parameter name (the JSON key the model emits).
   * @param type - JSON-Schema scalar type keyword.
   * @param description - LLM-facing description (prompt engineering; tells the
   *   model HOW to fill this argument). Defaults to `''` to match a
   *   hand-written entry that omits a description.
   * @param extra - Additional JSON-Schema keywords merged into the property
   *   verbatim (`enum`, `minLength`, `pattern`, `format`, `items`, …).
   * @returns This builder, for chaining.
   */
  property(
    name: string,
    type: ParameterType,
    description = '',
    extra?: Record<string, unknown>,
  ): this {
    this._properties[name] = { type, description, ...(extra ?? {}) } as ParameterProperty;
    return this;
  }

  /** Add a `string` property. @see {@link property} */
  string(name: string, description = '', extra?: Record<string, unknown>): this {
    return this.property(name, 'string', description, extra);
  }

  /** Add an `integer` property. @see {@link property} */
  integer(name: string, description = '', extra?: Record<string, unknown>): this {
    return this.property(name, 'integer', description, extra);
  }

  /** Add a `number` (float) property. @see {@link property} */
  number(name: string, description = '', extra?: Record<string, unknown>): this {
    return this.property(name, 'number', description, extra);
  }

  /** Add a `boolean` property. @see {@link property} */
  boolean(name: string, description = '', extra?: Record<string, unknown>): this {
    return this.property(name, 'boolean', description, extra);
  }

  /**
   * Add an `array` property.
   *
   * @param name - Parameter name.
   * @param items - JSON-Schema for the array's element type (e.g.
   *   `{ type: 'string' }`). Omit for an untyped array.
   * @param description - LLM-facing description.
   * @returns This builder, for chaining.
   */
  array(name: string, items?: Record<string, unknown>, description = ''): this {
    const extra = items ? { items } : undefined;
    return this.property(name, 'array', description, extra);
  }

  /**
   * Add a `string` property constrained to a closed set of values, rendered as
   * `enum:[...]` — the JSON-Schema form the model and the SignalWire validator
   * both honour. This is the typed-closed-set affordance: pass one of the
   * exported Tier-1 value arrays ({@link RECORD_FORMATS} etc.) or any literal
   * list, and the values land verbatim in `enum`.
   *
   * @param name - Parameter name.
   * @param values - The allowed values (a `readonly` array — the `as const`
   *   Tier-1 arrays are accepted directly). Emitted as `enum`, in order.
   * @param description - LLM-facing description.
   * @param type - The JSON-Schema base type for the enum (default `'string'`).
   * @returns This builder, for chaining.
   */
  enum(
    name: string,
    values: readonly unknown[],
    description = '',
    type: ParameterType = 'string',
  ): this {
    // Copy into a fresh mutable array so the builder owns its data (a caller's
    // `as const` array is readonly; build() must hand back a plain array that
    // serialises identically to a hand-written `enum: [...]` literal).
    return this.property(name, type, description, { enum: [...values] });
  }

  /**
   * Add a `record_call` **format** property (`enum: ['wav','mp3','mp4']`) — the
   * Tier-1 closed set baked in. @see {@link RECORD_FORMATS}
   */
  recordFormat(name: string, description = ''): this {
    return this.enum(name, RECORD_FORMATS, description);
  }

  /**
   * Add a `record_call` **direction** property
   * (`enum: ['speak','listen','both']`). Uses record's `listen` (not tap's
   * `hear`). @see {@link RECORD_DIRECTIONS}
   */
  recordDirection(name: string, description = ''): this {
    return this.enum(name, RECORD_DIRECTIONS, description);
  }

  /**
   * Add a `tap` **direction** property (`enum: ['speak','hear','both']`). Uses
   * tap's `hear` (not record's `listen`). @see {@link TAP_DIRECTIONS}
   */
  tapDirection(name: string, description = ''): this {
    return this.enum(name, TAP_DIRECTIONS, description);
  }

  /**
   * Add a `tap` **codec** property (`enum: ['PCMU','PCMA']`) — the 2-value
   * SWAIG tap codec (NOT the 7-value RELAY superset). @see {@link TAP_CODECS}
   */
  codec(name: string, description = ''): this {
    return this.enum(name, TAP_CODECS, description);
  }

  /**
   * Mark one or more already-added properties as required. Names are appended
   * to the `required` array in the order received; duplicates are ignored.
   * Required-ness is independent of property order — call this at any point.
   *
   * @param names - Parameter names to require.
   * @returns This builder, for chaining.
   */
  required(...names: string[]): this {
    for (const n of names) {
      if (!this._required.includes(n)) this._required.push(n);
    }
    return this;
  }

  /**
   * Materialise the JSON-Schema `object`. Produces
   * `{ type: 'object', properties: {…} }`, plus `required: [...]` only when at
   * least one property was marked required — exactly matching a hand-written
   * blob (an omitted `required` is the same as `defineTool` receiving none).
   *
   * @returns A fresh {@link ParameterSchemaObject}; safe to mutate without
   *   affecting the builder.
   */
  build(): ParameterSchemaObject {
    const out: ParameterSchemaObject = {
      type: 'object',
      properties: { ...this._properties },
    };
    if (this._required.length) out.required = [...this._required];
    return out;
  }
}

/**
 * Create a new {@link ParameterSchema} builder — the idiomatic entry point.
 *
 * @returns A fresh, empty builder.
 *
 * @example
 * ```ts
 * const params = paramSchema()
 *   .string('service', 'The service to look up')
 *   .codec('media_codec', 'Audio codec for the tap')
 *   .required('service')
 *   .build();
 * ```
 */
export function paramSchema(): ParameterSchema {
  return new ParameterSchema();
}
