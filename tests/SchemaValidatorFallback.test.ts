/**
 * Where Ajv can't compile the schema (a runtime that blocks code generation
 * from strings, as Cloudflare Workers do), SWML validation falls back to the
 * lightweight checks: verb names and required fields. signalwire-python 3.7.2
 * logs `schema_validator_unavailable` when its validator is missing; the SDK
 * logs the same warning, once per schema, instead of falling back silently.
 */

import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Logger from '../src/Logger.js';
import { SchemaUtils } from '../src/SchemaUtils.js';

/** A fresh copy of the bundled schema, so no earlier compile is cached for it. */
function freshSchemaPath(): string {
  const path = join(mkdtempSync(join(tmpdir(), 'swml-schema-')), 'schema.json');
  copyFileSync(join(import.meta.dirname, '../src/schema.json'), path);
  return path;
}

describe('schema validation without code generation', () => {
  it('falls back to the lightweight checks and warns once', () => {
    const warnings: string[] = [];
    const spy = vi.spyOn(Logger.Logger.prototype, 'warn').mockImplementation((msg: string) => {
      warnings.push(msg);
    });
    const RealFunction = globalThis.Function;
    globalThis.Function = function () {
      throw new EvalError('Code generation from strings disallowed for this context');
    } as unknown as FunctionConstructor;
    try {
      const schema = new SchemaUtils({ schemaPath: freshSchemaPath() });
      expect(schema.validateVerb('play', { url: 'say:hi' }).valid).toBe(true);
      expect(schema.validateVerb('hangup', {}).valid).toBe(true);
      expect(schema.validateVerb('no_such_verb', {}).valid).toBe(false);
    } finally {
      globalThis.Function = RealFunction;
      spy.mockRestore();
    }
    expect(warnings.filter((w) => w === 'schema_validator_unavailable')).toHaveLength(1);
  });
});
