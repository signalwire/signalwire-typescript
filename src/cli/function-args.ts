/**
 * Function arguments for `swaig-test --exec`: everything after the function
 * name, `--name value` pairs typed by the function's schema, as the
 * reference parses them. `--arg name=value` (JSON or a string) is also
 * accepted there.
 *
 * Mirrors signalwire-python's `signalwire.cli.core.argparse_helpers`
 * (parse_function_arguments, undeclared_argument_warnings).
 */

type Schema = Record<string, unknown>;

/** swaig-test options that a user may put after --exec by mistake. */
const MISPLACED_FLAGS = new Set([
  'verbose',
  'raw',
  'help',
  'list-tools',
  'list-agents',
  'dump-swml',
  'minimal',
  'fake-full-data',
  'simulate-serverless',
  'agent-class',
  'route',
  'format-json',
]);

/** A function's parameter definitions, by name, from its `parameters` schema. */
export function schemaProperties(parameters: unknown): Record<string, Schema> {
  if (!parameters || typeof parameters !== 'object') return {};
  const params = parameters as Schema;
  const props = (params['properties'] ?? params) as Record<string, unknown>;
  const out: Record<string, Schema> = {};
  for (const [name, def] of Object.entries(props)) {
    if (def && typeof def === 'object' && !Array.isArray(def)) out[name] = def as Schema;
  }
  return out;
}

/**
 * Parse the tokens after `--exec <function>` into arguments.
 *
 * `--name value` becomes `name` (dashes to underscores), coerced by the
 * parameter's type: an integer or number is parsed (and rejected if it isn't
 * one), an array is split on commas, a boolean takes an optional
 * `true`/`false` and is otherwise a flag. `--arg name=value` sets `name` to
 * the value parsed as JSON, or the string.
 *
 * @param tokens - The tokens after the function name.
 * @param parameters - The function's `parameters` schema.
 * @returns The arguments.
 * @throws {Error} A token isn't `--name`, a value is missing, or a value
 *   doesn't fit its type.
 */
export function parseFunctionArguments(
  tokens: string[],
  parameters: unknown,
): Record<string, unknown> {
  const props = schemaProperties(parameters);
  const out: Record<string, unknown> = {};
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) {
      throw new Error(`Expected parameter name starting with --, got: ${token}`);
    }
    const name = token.slice(2);
    if (name === 'arg') {
      const kv = tokens[i + 1];
      const eq = kv?.indexOf('=') ?? -1;
      if (!kv || eq <= 0) throw new Error('--arg requires name=value');
      const value = kv.slice(eq + 1);
      try {
        out[kv.slice(0, eq)] = JSON.parse(value);
      } catch {
        out[kv.slice(0, eq)] = value;
      }
      i += 2;
      continue;
    }
    const key = name.replace(/-/g, '_');
    const type =
      typeof props[key]?.['type'] === 'string' ? (props[key]!['type'] as string) : 'string';
    if (type === 'boolean') {
      const next = tokens[i + 1]?.toLowerCase();
      if (next === 'true' || next === 'false') {
        out[key] = next === 'true';
        i += 2;
      } else {
        out[key] = true;
        i += 1;
      }
      continue;
    }
    if (i + 1 >= tokens.length) {
      if (MISPLACED_FLAGS.has(name)) {
        throw new Error(
          `CLI flag --${name} must come BEFORE --exec, not after.\n` +
            `Example: swaig-test file.ts --${name} --exec function_name`,
        );
      }
      throw new Error(`Parameter --${name} requires a value`);
    }
    const value = tokens[i + 1]!;
    if (type === 'integer') {
      if (!/^[-+]?\d+$/.test(value.trim())) {
        throw new Error(`Parameter --${name} must be an integer, got: ${value}`);
      }
      out[key] = parseInt(value, 10);
    } else if (type === 'number') {
      const n = Number(value);
      if (value.trim() === '' || Number.isNaN(n)) {
        throw new Error(`Parameter --${name} must be a number, got: ${value}`);
      }
      out[key] = n;
    } else if (type === 'array') {
      out[key] = value.split(',').map((item) => item.trim());
    } else {
      out[key] = value;
    }
    i += 2;
  }
  return out;
}

/**
 * Warnings for arguments the function doesn't declare. Everything after
 * `--exec <function>` goes to the function, since a parameter can share a
 * swaig-test option's name; this names the likely mistake instead of
 * refusing the argument.
 *
 * @param args - The parsed arguments.
 * @param parameters - The function's `parameters` schema.
 * @param cliOptions - swaig-test's own option strings, e.g. `--verbose`.
 */
export function undeclaredArgumentWarnings(
  args: Record<string, unknown>,
  parameters: unknown,
  cliOptions: ReadonlySet<string>,
): string[] {
  const declared = schemaProperties(parameters);
  const warnings: string[] = [];
  for (const key of Object.keys(args)) {
    if (key in declared) continue;
    const option = `--${key.replace(/_/g, '-')}`;
    warnings.push(
      cliOptions.has(option)
        ? `Warning: ${option} isn't a parameter of this function, so it was passed to the ` +
            `function. To use swaig-test's ${option} option, put it before --exec.`
        : `Warning: ${option} isn't a parameter of this function; it was passed to the function anyway.`,
    );
  }
  return warnings;
}
