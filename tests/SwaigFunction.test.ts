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
