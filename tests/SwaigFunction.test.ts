/**
 * SwaigFunction dispatch: soft argument validation, as the Python SDK's
 * tool_mixin does (warn, then run the handler).
 */
import { SwaigFunction } from '../src/SwaigFunction.js';
import { FunctionResult } from '../src/FunctionResult.js';

describe('argument validation on dispatch (found in the documentation pass)', () => {
  it("warns when arguments don't match the schema, and still runs the handler, as the reference does", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      let ran = false;
      const fn = new SwaigFunction({
        name: 'count',
        description: 'Count',
        parameters: { n: { type: 'integer', description: 'How many' } },
        handler: () => {
          ran = true;
          return new FunctionResult('ok');
        },
      });
      await fn.execute({ n: 'lots' });
      expect(ran).toBe(true);
      const lines = warn.mock.calls.map((c) => String(c[0]));
      expect(lines.some((l) => l.includes("Argument validation failed for function 'count'"))).toBe(
        true,
      );
    } finally {
      warn.mockRestore();
    }
  });
});

describe('argument validation reuses compiled validators (found in review)', () => {
  it('compiles a tool schema once across repeated calls', async () => {
    const mod = await import('../src/SwaigFunction.js');
    const fn = new mod.SwaigFunction({
      name: 'count2',
      description: 'Count',
      parameters: { n: { type: 'integer', description: 'How many' } },
      handler: () => new FunctionResult('ok'),
    });
    const before = mod._compiledValidatorCount();
    for (let i = 0; i < 50; i++) await fn.execute({ n: i });
    expect(mod._compiledValidatorCount() - before).toBeLessThanOrEqual(1);
  });
});

describe('argument validation really runs (Python 3.15.2)', () => {
  const tool = (parameters: Record<string, unknown>) =>
    new SwaigFunction({
      name: 'check',
      description: 'Check',
      parameters,
      handler: () => new FunctionResult('ok'),
    });

  it.each([
    [{ email: { type: 'string', format: 'email' } }, { email: 5 }, "'email' must be string"],
    [{ at: { type: 'string', format: 'date-time' } }, { at: 5 }, "'at' must be string"],
    [{ x: { type: 'string', 'x-custom': 1, examples: ['a'] } }, { x: 5 }, "'x' must be string"],
  ])('checks a schema with %j instead of skipping it', (parameters, args, error) => {
    expect(tool(parameters).validateArgs(args)).toEqual([false, [error]]);
  });

  it.each([
    [{ type: 'string', format: 'email' }, 'not-an-email', 'email'],
    [{ type: 'string', format: 'date-time' }, 'yesterday', 'date-time'],
    [{ type: 'string', format: 'uri' }, 'not a uri', 'uri'],
  ])("asserts %j, as Python's jsonschema-rs does", (schema, bad, format) => {
    const fn = tool({ v: schema });
    expect(fn.validateArgs({ v: bad })).toEqual([false, [`'v' must match format "${format}"`]]);
  });

  it('accepts a value that matches its format', () => {
    const fn = tool({
      email: { type: 'string', format: 'email' },
      at: { type: 'string', format: 'date-time' },
      site: { type: 'string', format: 'uri' },
    });
    expect(
      fn.validateArgs({
        email: 'a@example.com',
        at: '2026-11-23T10:00:00Z',
        site: 'https://example.com/x',
      }),
    ).toEqual([true, []]);
  });

  it('ignores a format it has no check for, without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(tool({ v: { type: 'string', format: 'x-account' } }).validateArgs({ v: 'x' })).toEqual(
        [true, []],
      );
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it.each([
    ['uuid', 'x'],
    ['int32', 2147483648],
    ['duration', 'x'],
  ])("doesn't assert %s, which Draft-7 doesn't define (found in review)", (format, value) => {
    expect(tool({ v: { format } }).validateArgs({ v: value })).toEqual([true, []]);
  });

  it('ignores formatMinimum and checks the rest, as Python does (found in review)', () => {
    expect(tool({ v: { type: 'string', formatMinimum: 'a' } }).validateArgs({ v: 3 })).toEqual([
      false,
      ["'v' must be string"],
    ]);
    expect(
      tool({ v: { type: 'string', format: 'date', formatMinimum: '2026-01-01' } }).validateArgs({
        v: '2025-01-01',
      }),
    ).toEqual([true, []]);
  });

  it('warns on dispatch for a schema with a format', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await tool({ email: { type: 'string', format: 'email' } }).execute({ email: 5 });
      const lines = warn.mock.calls.map((c) => String(c[0]));
      expect(lines.some((l) => l.includes("Argument validation failed for function 'check'"))).toBe(
        true,
      );
    } finally {
      warn.mockRestore();
    }
  });
});
