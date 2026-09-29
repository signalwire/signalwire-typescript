/**
 * DataMap execution for swaig-test: runs a DataMap function locally the way
 * the platform runs it (mod_openai's actions.c and swaig.c), so
 * `swaig-test --exec` can test one without a call.
 *
 * The pipeline, as the platform processes a data_map:
 *
 * 1. The top-level `expressions`, against the call data. The first one that
 *    produces an output ends the function.
 * 2. The first webhook it requests. A webhook in a list is skipped, without a
 *    request, when none of its `require_args` is among the arguments, when it
 *    has neither `output` nor `expressions`, or when it has no `url`. Once one
 *    is requested, no later webhook runs. It fails when the response has
 *    `parse_error` or `protocol_error` (a body that is empty or isn't JSON, a
 *    request that doesn't complete) or one of its `error_keys`, whatever the
 *    key's value. A status outside 200-299 doesn't fail it by itself; the
 *    status is then in the response as `http_code`. If it succeeds, its
 *    `foreach`, then its `expressions`, then its `output` build the result
 *    from the response. A matched webhook expression's result is expanded a
 *    second time, against the same data.
 * 3. The data_map's own `output`, when nothing above produced a result.
 * 4. Otherwise the platform's generic error,
 *    `{ response: "There was an error processing this request." }`.
 *
 * `expressions` can be one expression object instead of a list. `webhooks`
 * can be one webhook object, which the platform runs without checking its
 * `require_args` or its errors, so its `foreach`, `expressions` and `output`
 * read an error response (`${parse_error}`, `${raw_response}`,
 * `${http_code}`).
 *
 * The request is a POST when the webhook has `params` (its JSON body, with
 * the arguments merged in by `input_args_as_params`) or its method is POST,
 * and a GET otherwise. Header values are sent as written. Credentials in the
 * url become basic authentication. Redirects are followed as the platform's
 * curl follows them, and every request, redirects included, refuses private
 * and internal addresses.
 *
 * Template data, per stage:
 *
 * - The call data: the `callData` option (the platform's call details, such
 *   as `global_data` or `caller_id_num`) at the root, `meta_data` (the
 *   function's `meta_data` merged key by key over `global_data`, as the
 *   platform merges them when it loads the function), the `prompt_vars`
 *   merged into the root, `args` (the arguments) and an empty `input`. The
 *   top-level expressions, a webhook's `url` and `params`, and the data_map's
 *   own `output` read it, so they write an argument as `${args.city}`. The
 *   data_map's own `output` also has `prompt_vars`.
 * - A webhook's `foreach`, `expressions` and `output` read its response: a
 *   JSON object's fields at the root (`${current.temp_f}`), a JSON array under
 *   `array`, with `prompt_vars`, `global_data` and `input` (a copy of the call
 *   data) added. The arguments are `${input.args.city}` there.
 *
 * Templates: `${path}` and `%{path}` read a path of dotted names, matched
 * without regard to ASCII case, each with at most one `[n]` index (negative
 * from the end). The helpers `lc:`, `enc:` and `fmt_ph:` come first, in any
 * case, and apply in a fixed order: `fmt_ph`, then `lc`, then `enc`. Any other
 * name before a colon is part of the path. A template nested in the path
 * expands first, one level deep. A value that isn't a string is inserted as
 * cJSON prints it (72.5 as `72.500000`). A path that doesn't resolve expands
 * to an empty string, and the simulator says so on stderr. An output is
 * expanded as JSON text and parsed, as on the platform, so a template that
 * inserts an object into a string breaks it.
 *
 * Where the simulator can't do what the platform does:
 *
 * - Without the optional libphonenumber-js package, `fmt_ph` formats only a
 *   North American number, as `(NPA) NXX-XXXX`, and leaves any other value as
 *   it is, saying so on stderr. The platform formats any valid number, and
 *   writes `INVALID NUMBER` for one that isn't; with libphonenumber-js
 *   installed, so does the simulator.
 * - `@{...}` functions are left as they are.
 * - An expression's `expr` isn't evaluated: only its `pattern` is tried.
 * - Patterns are JavaScript regular expressions, where the platform uses PCRE.
 * - The platform follows no redirect for a request it signs; the simulator
 *   doesn't sign requests.
 *
 * Mirrors signalwire-python's `signalwire.cli.execution.datamap_exec`.
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { _publicFetch } from '../PublicFetch.js';

/** The result the platform returns when nothing produced an output. */
export const PLATFORM_ERROR_RESPONSE = 'There was an error processing this request.';

/** The platform's whole-request timeout for a webhook, in seconds (CURLOPT_TIMEOUT). */
const HTTP_REQUEST_TIMEOUT = 120;

/** The characters FreeSWITCH's `SWITCH_URL_UNSAFE` lists, which `enc:` encodes. */
const URL_UNSAFE = '\r\n #%&+:;<=>?@[\\]^`{|}"';
const HEX = '0123456789ABCDEF';

/** Template paths longer than this (in bytes), or deeper, don't resolve. */
const MAX_PATH_LENGTH = 1024;
const MAX_PATH_DEPTH = 128;
const INT_MAX = 2 ** 31 - 1;

/** The stages that read a webhook's response rather than the call data. */
const RESPONSE_STAGES = new Set(['webhook foreach', 'webhook expressions', 'webhook output']);

/** Marks a value that isn't there: a path that doesn't resolve, JSON that doesn't parse. */
const MISSING: unique symbol = Symbol('missing');

type Data = Record<string, unknown>;

function isPlainObject(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lowercase ASCII letters only, as C's tolower() does. */
function asciiLower(text: string): string {
  return text.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** Set a member as data, so a key such as `__proto__` is an ordinary key. */
function setItem(obj: Data, key: string, value: unknown): void {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
}

/**
 * A named member of an object, matched without regard to ASCII case, as
 * cJSON_GetObjectItem() finds it: the first match wins, and arrays and
 * scalars have no named members.
 */
function objectItem(container: unknown, name: string): unknown {
  if (!isPlainObject(container)) return MISSING;
  const wanted = asciiLower(name);
  for (const key of Object.keys(container)) {
    if (asciiLower(key) === wanted) return container[key];
  }
  return MISSING;
}

function hasItem(container: unknown, name: string): boolean {
  return objectItem(container, name) !== MISSING;
}

/**
 * Add a member as cJSON_AddItemToObject() does: cJSON appends a second member
 * with the same name, and lookups find the first, so an existing member keeps
 * its value.
 */
function addItem(container: Data, name: string, value: unknown): void {
  if (!hasItem(container, name)) setItem(container, name, value);
}

/** Delete the first member matching `name` without regard to ASCII case. */
function deleteItem(container: Data, name: string): void {
  const wanted = asciiLower(name);
  for (const key of Object.keys(container)) {
    if (asciiLower(key) === wanted) {
      delete container[key];
      return;
    }
  }
}

/** Replace a member, as cJSON_Merge() with replace does. */
function replaceItem(container: Data, name: string, value: unknown): void {
  deleteItem(container, name);
  setItem(container, name, value);
}

/** A member's value if it is a string, as cJSON_GetObjectCstr() returns it. */
function stringItem(container: unknown, name: string): string | null {
  const value = objectItem(container, name);
  return typeof value === 'string' ? value : null;
}

/** C's atoi(): the leading integer, or 0. */
function atoi(text: string): number {
  const match = /^[ \t\n\v\f\r]*([+-]?\d+)/.exec(text);
  return match ? Number.parseInt(match[1]!, 10) : 0;
}

/** mod_openai's cJSON_FSTrue(): JSON true, or a string FreeSWITCH's switch_true() accepts. */
function isTrue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  if (['yes', 'on', 'true', 't', 'enabled', 'active', 'allow'].includes(value.toLowerCase())) {
    return true;
  }
  return /^[+-]?\d+(\.\d+)?$/.test(value.trim()) && atoi(value) !== 0;
}

const CJSON_ESCAPES: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

/** A string as cJSON prints it. */
function cjsonString(text: string): string {
  let out = '"';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (CJSON_ESCAPES[ch]) out += CJSON_ESCAPES[ch];
    else if (code < 32) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return out + '"';
}

/**
 * A value as FreeSWITCH's cJSON_Print() formats it: a whole number without a
 * decimal point, any other number with six decimal places (72.5 is
 * `72.500000`), and an object over several lines, one tab per level.
 */
function cjsonPrint(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null';
    return Number.isInteger(value) ? BigInt(value).toString() : value.toFixed(6);
  }
  if (typeof value === 'string') return cjsonString(value);
  if (Array.isArray(value)) return `[${value.map((v) => cjsonPrint(v, depth + 1)).join(', ')}]`;
  if (isPlainObject(value)) {
    const inner = depth + 1;
    const members = Object.entries(value).map(
      ([k, v]) => `${'\t'.repeat(inner)}${cjsonString(k)}:\t${cjsonPrint(v, inner)}`,
    );
    if (members.length === 0) return `{\n${'\t'.repeat(depth)}}`;
    return `{\n${members.join(',\n')}\n${'\t'.repeat(depth)}}`;
  }
  return cjsonString(String(value));
}

/**
 * Parse JSON as cJSON_Parse() does, or return MISSING. cJSON skips a byte
 * order mark and leading whitespace, accepts control characters inside
 * strings, reads the first value and ignores anything after it, and keeps
 * the first of two members with the same name.
 */
function cjsonParse(text: string): unknown {
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  const skip = () => {
    while (i < text.length && text.charCodeAt(i) <= 32) i++;
  };
  const fail = (): never => {
    throw new SyntaxError('invalid JSON');
  };
  const parseString = (): string => {
    let out = '';
    i++; // the opening quote
    while (i < text.length && text[i] !== '"') {
      const ch = text[i]!;
      if (ch !== '\\') {
        out += ch;
        i++;
        continue;
      }
      const esc = text[i + 1];
      const simple: Record<string, string> = {
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
        '"': '"',
        '\\': '\\',
        '/': '/',
      };
      if (esc !== undefined && esc in simple) {
        out += simple[esc];
        i += 2;
      } else if (esc === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
        out += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 6), 16));
        i += 6;
      } else {
        fail();
      }
    }
    if (i >= text.length) fail();
    i++; // the closing quote
    return out;
  };
  const parseValue = (depth: number): unknown => {
    if (depth > 1000) fail();
    skip();
    const ch = text[i];
    if (ch === '"') return parseString();
    if (ch === '{') {
      i++;
      const obj: Data = {};
      skip();
      if (text[i] === '}') {
        i++;
        return obj;
      }
      for (;;) {
        skip();
        if (text[i] !== '"') fail();
        const key = parseString();
        skip();
        if (text[i] !== ':') fail();
        i++;
        const value = parseValue(depth + 1);
        if (!Object.hasOwn(obj, key)) setItem(obj, key, value);
        skip();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') {
          i++;
          return obj;
        }
        fail();
      }
    }
    if (ch === '[') {
      i++;
      const arr: unknown[] = [];
      skip();
      if (text[i] === ']') {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(parseValue(depth + 1));
        skip();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') {
          i++;
          return arr;
        }
        fail();
      }
    }
    for (const [word, value] of [
      ['null', null],
      ['false', false],
      ['true', true],
    ] as const) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return value;
      }
    }
    const number = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(text.slice(i));
    if (!number) fail();
    i += number![0].length;
    return Number(number![0]);
  };
  try {
    return parseValue(0);
  } catch {
    return MISSING;
  }
}

/**
 * URL-encodes a value, for `enc:` and `form_param`, as the platform does with
 * FreeSWITCH's `switch_url_encode`: each byte of the UTF-8 text that is a
 * control character, non-ASCII, or in `SWITCH_URL_UNSAFE` becomes `%XX`, and
 * every other printable ASCII character (`/`, `,`, `$`, `!`, `(` and so on)
 * stays. A `%` that already starts an uppercase `%XX` isn't encoded again.
 */
function urlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    const ch = String.fromCharCode(b);
    const escaped =
      ch === '%' &&
      i + 2 < bytes.length &&
      HEX.includes(String.fromCharCode(bytes[i + 1]!)) &&
      HEX.includes(String.fromCharCode(bytes[i + 2]!));
    if (!escaped && (b < 0x20 || b > 0x7e || URL_UNSAFE.includes(ch))) {
      out += `%${HEX[b >> 4]}${HEX[b & 0x0f]}`;
    } else {
      out += ch;
    }
  }
  return out;
}

/** The part of libphonenumber-js that `fmt_ph` uses. */
export interface _PhoneNumbers {
  parsePhoneNumberFromString(
    text: string,
    defaultCountry: string,
  ): { isValid(): boolean; formatNational(): string } | undefined;
}

/**
 * libphonenumber-js, when it's installed: a port of the libphonenumber the
 * platform formats `fmt_ph` with. It's optional, so it's found at run time,
 * from the SDK's own location or else from the working directory's project,
 * with its full metadata (`/max`), which validates as libphonenumber does.
 */
async function loadPhoneNumbers(): Promise<_PhoneNumbers | null> {
  const specifier = 'libphonenumber-js/max';
  const usable = (mod: unknown): _PhoneNumbers | null => {
    for (const candidate of [mod, (mod as { default?: unknown } | null)?.default]) {
      const parse = (candidate as Partial<_PhoneNumbers> | null | undefined)
        ?.parsePhoneNumberFromString;
      if (typeof parse === 'function') return { parsePhoneNumberFromString: parse };
    }
    return null;
  };
  try {
    return usable(await import(specifier));
  } catch {
    // Not next to the SDK; try the project in the working directory
  }
  try {
    const require = createRequire(join(process.cwd(), 'noop.js'));
    return usable(await import(pathToFileURL(require.resolve(specifier)).href));
  } catch {
    return null;
  }
}

let phoneNumbers: _PhoneNumbers | null = await loadPhoneNumbers();

/**
 * Replace the libphonenumber-js that `fmt_ph` uses, for tests: null simulates
 * a project without it.
 *
 * @param lib - The library, or null for none.
 * @returns The one it replaced.
 * @internal
 */
export function _setPhoneNumbers(lib: _PhoneNumbers | null): _PhoneNumbers | null {
  const previous = phoneNumbers;
  phoneNumbers = lib;
  return previous;
}

/**
 * The `fmt_ph` helper. The platform formats with libphonenumber in the
 * national format, reading a number without a country code as a US number,
 * and writes `INVALID NUMBER` for one it can't validate. With libphonenumber-js
 * installed, the simulator does the same. Without it, it formats a ten-digit
 * North American number, with or without its leading 1, as `(NPA) NXX-XXXX`,
 * and returns null for anything else.
 */
function formatPhoneNational(value: string): string | null {
  if (phoneNumbers) {
    try {
      const number = phoneNumbers.parsePhoneNumberFromString(value, 'US');
      return number?.isValid() ? number.formatNational() : 'INVALID NUMBER';
    } catch {
      return 'INVALID NUMBER';
    }
  }
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length === 10 && /[2-9]/.test(digits[0]!) && /[2-9]/.test(digits[3]!)) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return null;
}

/** The index of the `}` matching the `{` at `start`, or -1. */
function findEndBrace(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * The value at a template path, or MISSING, as the platform's
 * get_json_object() finds it. Dots separate names, matched without regard to
 * ASCII case. One `[n]` may end a name, and a negative `n` counts from the
 * end. A path ending in a dot doesn't resolve, and an empty path is the whole
 * data.
 */
function lookup(data: unknown, path: string): unknown {
  if (new TextEncoder().encode(path).length > MAX_PATH_LENGTH || path.endsWith('.')) {
    return MISSING;
  }
  let current = data;
  const tokens = path.split('.').filter(Boolean);
  for (const [n, token] of tokens.entries()) {
    if (n + 1 > MAX_PATH_DEPTH) return MISSING;
    const open = token.indexOf('[');
    if (open < 0) {
      current = objectItem(current, token);
      if (current === MISSING) return MISSING;
      continue;
    }
    const rest = token.slice(open + 1);
    const close = rest.indexOf(']');
    if (close < 0) return MISSING;
    const indexText = rest.slice(0, close);
    if (rest.slice(close + 1) || !/^[ \t\n\v\f\r]*[+-]?\d+$/.test(indexText)) return MISSING;
    let index = Number.parseInt(indexText.trim(), 10);
    if (index > INT_MAX) return MISSING;
    current = objectItem(current, token.slice(0, open));
    if (!Array.isArray(current)) return MISSING;
    if (index < 0) index += current.length;
    if (index < 0 || index >= current.length) return MISSING;
    current = current[index];
  }
  return current;
}

/**
 * A resolved value as a template inserts it: a string as it is, with `"` and
 * `\` backslash-escaped when the template is JSON text, and anything else as
 * cJSON prints it, without escaping.
 */
function valueText(value: unknown, escapeJson: boolean): string {
  if (typeof value === 'string') {
    return escapeJson ? value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : value;
  }
  return cjsonPrint(value);
}

/** A template that didn't resolve, or that the simulator couldn't expand as the platform would. */
interface TemplateNote {
  /** The template as written. */
  raw: string;
  /** Its path, after any nested template expanded. */
  path: string;
  /** Why it is noted. */
  kind: 'unresolved' | 'fmt_ph';
  /** The value fmt_ph left as it is. */
  value?: string;
}

/** Expand `${...}` and `%{...}` templates as the platform's _expand_jsonvars() does. */
function expand(
  template: string,
  data: unknown,
  escapeJson = false,
  nested = true,
  notes?: TemplateNote[],
): string {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i]!;
    if ((ch !== '$' && ch !== '%') || template[i + 1] !== '{') {
      out += ch;
      i++;
      continue;
    }
    const end = findEndBrace(template, i + 1);
    if (end < 0) {
      // No closing brace: the text stays as written
      out += ch;
      i++;
      continue;
    }
    if (end === i + 2) {
      // ${} expands to nothing
      i = end + 1;
      continue;
    }

    let body = template.slice(i + 2, end);
    let lowercase = false;
    let encode = false;
    let phone = false;
    for (;;) {
      const head = asciiLower(body.slice(0, 7));
      if (head.startsWith('lc:')) {
        body = body.slice(3);
        lowercase = true;
      } else if (head === 'fmt_ph:') {
        body = body.slice(7);
        phone = true;
      } else if (head.startsWith('enc:')) {
        body = body.slice(4);
        encode = true;
      } else {
        break;
      }
    }

    let path = body;
    if (nested && (path.includes('${') || path.includes('%{'))) {
      path = expand(path, data, escapeJson, false);
    }

    const raw = template.slice(i, end + 1);
    const value = lookup(data, path);
    if (value === MISSING) {
      notes?.push({ raw, path, kind: 'unresolved' });
    } else {
      let text = valueText(value, escapeJson);
      // The helpers apply in this order, whatever order they are written in
      if (phone && text) {
        const formatted = formatPhoneNational(text);
        if (formatted === null) notes?.push({ raw, path, kind: 'fmt_ph', value: text });
        else text = formatted;
      }
      if (lowercase && text) text = asciiLower(text);
      if (encode && text) text = urlEncode(text);
      out += text;
    }
    i = end + 1;
  }
  return out;
}

/**
 * Expand DataMap templates in a string as the platform does: `${path}` and
 * `%{path}` read a value from `data`, names matched without regard to case,
 * with the `lc:`, `enc:` and `fmt_ph:` helpers. A path that doesn't resolve
 * expands to an empty string. A template nested in a path expands first, one
 * level deep, and a value that isn't a string is inserted as cJSON prints it.
 * `@{...}` functions are left as they are.
 *
 * @param template - Text with `${...}` or `%{...}` templates.
 * @param data - The template data.
 * @returns The expanded text.
 */
export function expandTemplate(template: string, data: Data): string {
  if (!template) return '';
  return expand(template, data);
}

/**
 * Expand the templates in a value (an output object, say) as the platform
 * does: printed as JSON text, expanded with `"` and `\` in string values
 * escaped, and parsed again. A template that inserts an object or array
 * into a string breaks the JSON.
 *
 * @param value - The value to expand.
 * @param data - The template data.
 * @returns The expanded value, or undefined when the expanded text isn't JSON.
 */
export function expandValue(value: unknown, data: Data): unknown {
  const parsed = cjsonParse(expand(cjsonPrint(value), data, true));
  return parsed === MISSING ? undefined : parsed;
}

/**
 * A pattern as the platform matches it, with FreeSWITCH's
 * switch_regex_match(): one that doesn't start with `/` is wrapped as
 * `/pattern/i`, so it is searched for without regard to case; one written
 * `/pattern/flags` takes only its own `i` and `s` flags. A leading PCRE flag
 * group such as `(?i)`, which JavaScript doesn't accept, becomes the same
 * flags. Returns null for a pattern that isn't valid.
 */
function platformRegExp(pattern: string): RegExp | null {
  let source = pattern;
  let flags = 'i';
  if (pattern.startsWith('/')) {
    const end = pattern.lastIndexOf('/');
    if (end === 0) return null;
    source = pattern.slice(1, end);
    const opts = pattern.slice(end + 1);
    flags = (opts.includes('i') ? 'i' : '') + (opts.includes('s') ? 's' : '');
  }
  const inline = /^\(\?([is]+)\)/.exec(source);
  if (inline) {
    source = source.slice(inline[0].length);
    for (const flag of inline[1]!) if (!flags.includes(flag)) flags += flag;
  }
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

/** A curl result code standing in for a request that didn't complete. */
function curlErrorCode(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err);
  const code = String((err as { cause?: { code?: unknown } })?.cause?.code ?? '');
  if (/timed out|aborted/i.test(message) || (err as Error)?.name === 'AbortError') return 28;
  if (/Too many redirects/.test(message)) return 47;
  if (/CERT|TLS|SSL|SELF_SIGNED/i.test(code) || /certificate|TLS|SSL/i.test(message)) return 35;
  if (/Refused|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ENETUNREACH/.test(message + code)) {
    return 7;
  }
  return 1;
}

/** The fetch {@link executeDataMap} sends a webhook request with. */
export type DataMapFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
    /**
     * Report each response's status as it arrives, redirects included, so a
     * request that fails after a redirect reports the last status received
     * as `http_code`, as the platform's curl does.
     */
    onStatus?: (status: number) => void;
  },
) => Promise<Response>;

/** Options for {@link executeDataMap}. */
export interface DataMapExecOptions {
  /** Print each step to `log`. */
  verbose?: boolean;
  /** Seconds to wait for each webhook, body included (default 120, the platform's). */
  timeoutSeconds?: number;
  /** Where verbose output and notes go (default: stderr). */
  log?: (line: string) => void;
  /**
   * The call data the platform adds, merged into the root of the template
   * data: `global_data`, `caller_id_num`, `call_id` and so on. Its
   * `prompt_vars` are merged into the root too, and are also
   * `${prompt_vars.x}` in a webhook's stages and the data_map's own output.
   * Its `global_data` is also the base of `meta_data`, which the function's
   * `meta_data` is merged over; a `meta_data` key here isn't used, since the
   * platform doesn't take one from the call. swaig-test passes
   * `--custom-data`, with the agent's global data when it has no
   * `global_data`.
   */
  callData?: Data;
  /**
   * Fetch implementation; defaults to the SDK's SSRF-guarded fetch, which
   * follows redirects as the platform's curl does and checks every hop.
   */
  fetchImpl?: DataMapFetch;
}

/** One simulated call of a DataMap function. */
class Run {
  private readonly notes: { note: TemplateNote; stage: string }[] = [];

  constructor(
    private readonly verbose: boolean,
    private readonly out: (line: string) => void,
  ) {}

  say(line: string): void {
    if (this.verbose) this.out(line);
  }

  expand(template: string, data: unknown, stage: string, escapeJson = false): string {
    const found: TemplateNote[] = [];
    const text = expand(template, data, escapeJson, true, found);
    for (const note of found) this.notes.push({ note, stage });
    return text;
  }

  /** Expand an output or expression result as JSON text, then parse it, as the platform does. */
  expandJson(value: unknown, data: unknown, stage: string): unknown {
    return cjsonParse(this.expand(cjsonPrint(value), data, stage, true));
  }

  /** Say which templates expanded to nothing, with a hint for common mistakes. */
  report(): void {
    const seen = new Set<string>();
    for (const { note, stage } of this.notes) {
      const key = `${note.kind}\0${note.raw}\0${stage}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (note.kind === 'fmt_ph') {
        this.out(
          `Note: ${note.raw} in the ${stage}: the simulator formats only North American ` +
            `numbers, so it left "${note.value}" as it is. The platform formats a valid number ` +
            'in its national format, and writes INVALID NUMBER for one that is not valid; ' +
            'install the libphonenumber-js package to simulate that.',
        );
        continue;
      }
      let line = `Note: ${note.raw} in the ${stage} expands to an empty string on the platform.`;
      const lowered = asciiLower(note.path);
      const prefix = /^([A-Za-z_]\w*):(.*)$/.exec(note.path);
      if (lowered.startsWith('response.')) {
        line +=
          " The platform reads a webhook's JSON response from the root: " +
          'write ${<field>}, not ${response.<field>}.';
      } else if (RESPONSE_STAGES.has(stage) && lowered.startsWith('args.')) {
        line +=
          " In a webhook's foreach, expressions and output, the arguments are under " +
          `input: write \${input.${note.path}}.`;
      } else if (!RESPONSE_STAGES.has(stage) && lowered.startsWith('input.')) {
        line +=
          ' input is empty until a webhook responds; read the call data directly here, ' +
          `as \${${note.path.slice('input.'.length)}}.`;
      } else if (prefix) {
        line +=
          ` "${prefix[1]}:" is not a template helper: the platform's helpers are lc:, enc: ` +
          `and fmt_ph:, so it reads "${note.path}" as a path.` +
          (asciiLower(prefix[1]!) === 'url' ? ` To URL-encode, write \${enc:${prefix[2]}}.` : '');
      }
      this.out(line);
    }
  }
}

/** The first expression result, or MISSING, as get_input_from_expressions() finds it. */
function runExpressions(run: Run, expressions: unknown, data: unknown, stage: string): unknown {
  for (const item of Array.isArray(expressions) ? expressions : [expressions]) {
    const reply = parseExpression(run, item, data, stage);
    if (reply !== MISSING) return reply;
  }
  return MISSING;
}

/** One expression's result, or MISSING when it produces none, as parse_expression() does. */
function parseExpression(run: Run, item: unknown, data: unknown, stage: string): unknown {
  let subjectTemplate = stringItem(item, 'string');
  const pattern = stringItem(item, 'pattern');
  const expr = stringItem(item, 'expr');
  if (subjectTemplate === null) {
    // With neither string nor expr, an expression never matches
    if (expr === null) return MISSING;
    subjectTemplate = expr;
  }
  const output = objectItem(item, 'output');
  const nomatch = objectItem(item, 'nomatch-output');
  if (output === MISSING) return MISSING;

  const subject = run.expand(subjectTemplate, data, stage);
  let matched = false;
  if (expr !== null) {
    run.say(`An expression's expr isn't evaluated by the simulator: ${expr}`);
  }
  if (pattern !== null) {
    const re = platformRegExp(pattern);
    if (re) matched = re.test(subject);
    else run.say(`Expression pattern isn't a valid regular expression: ${pattern}`);
    run.say(`Expression "${subject}" against ${pattern}: ${matched ? 'match' : 'no match'}`);
  }
  if (matched) return run.expandJson(output, data, stage);
  if (nomatch !== MISSING) return run.expandJson(nomatch, data, stage);
  return MISSING;
}

/** The call data templates read before a webhook responds, as the platform builds it. */
function buildCallData(
  fn: Data,
  args: Data,
  callData: Data | undefined,
): { data: Data; promptVars: Data; globalData: unknown } {
  const extra = structuredClone(callData ?? {}) as Data;
  const rawPromptVars = extra['prompt_vars'];
  delete extra['prompt_vars'];
  const promptVars = isPlainObject(rawPromptVars) ? rawPromptVars : {};
  const data: Data = {};
  if (typeof fn['function'] === 'string') data['function'] = fn['function'];
  for (const [key, value] of Object.entries(extra)) replaceItem(data, key, value);
  // The platform merges the function's meta_data over the global data, key
  // by key, when it loads the function (app_config.c, cJSON_Merge with
  // replace); a call's meta_data is that object, not one from the call data.
  const metaData: Data = {};
  for (const source of [objectItem(data, 'global_data'), fn['meta_data']]) {
    if (!isPlainObject(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      replaceItem(metaData, key, structuredClone(value));
    }
  }
  replaceItem(data, 'meta_data', metaData);
  // As on the platform, the prompt variables are merged into the root
  for (const [key, value] of Object.entries(promptVars)) {
    replaceItem(data, key, structuredClone(value));
  }
  addItem(data, 'args', structuredClone(args));
  addItem(data, 'input', {});
  return { data, promptVars, globalData: objectItem(data, 'global_data') };
}

/**
 * Run a DataMap function locally, as the platform runs it.
 *
 * @param fn - The function's SWAIG entry (`{ function, data_map, meta_data, ... }`)
 *   or its `data_map` alone.
 * @param args - The function's arguments.
 * @param opts - Verbose output, the call data, and the fetch to use.
 * @returns The function's result: the expanded output (an object or a
 *   string), `{ response: PLATFORM_ERROR_RESPONSE }` when nothing produced a
 *   result, as on the platform, or an `{ error }` object when the expanded
 *   output isn't JSON, where the platform gets no result.
 */
export async function executeDataMap(
  fn: Data,
  args: Data,
  opts: DataMapExecOptions = {},
): Promise<unknown> {
  const log = opts.log ?? ((line: string) => void process.stderr.write(`${line}\n`));
  const run = new Run(opts.verbose === true, log);
  try {
    return await execute(run, fn, args, opts);
  } finally {
    run.report();
  }
}

async function execute(run: Run, fn: Data, args: Data, opts: DataMapExecOptions): Promise<unknown> {
  const dataMap = (isPlainObject(fn['data_map']) ? fn['data_map'] : fn) as Data;
  const { data, promptVars, globalData } = buildCallData(fn, args, opts.callData);
  run.say('=== DataMap Function Execution ===');
  run.say(`Args: ${JSON.stringify(args)}`);
  if (opts.callData) run.say(`Call data: ${JSON.stringify(data)}`);

  // 1. The top-level expressions, against the call data
  const expressions = objectItem(dataMap, 'expressions');
  if (expressions !== MISSING) {
    const reply = runExpressions(run, expressions, data, 'top-level expressions');
    if (reply !== MISSING) return reply;
  }

  // 2. The first webhook requested
  const webhooks = objectItem(dataMap, 'webhooks');
  if (webhooks !== MISSING) {
    const { reply, match } = await runWebhooks(run, webhooks, data, opts);
    if (match) {
      // The response is the root of the template data; the call data is under input
      const rdata: Data = isPlainObject(reply) ? reply : {};
      addItem(rdata, 'prompt_vars', structuredClone(promptVars));
      if (globalData !== MISSING) addItem(rdata, 'global_data', structuredClone(globalData));
      addItem(rdata, 'input', structuredClone(data));

      const foreach = objectItem(match, 'foreach');
      if (foreach !== MISSING) processForeach(run, foreach, rdata);

      let response: unknown = MISSING;
      let processed = false;
      const hookExpressions = objectItem(match, 'expressions');
      if (hookExpressions !== MISSING) {
        const result = runExpressions(run, hookExpressions, rdata, 'webhook expressions');
        if (result !== MISSING) {
          // The platform expands a matched result a second time
          response = run.expandJson(result, rdata, 'webhook expressions');
          processed = true;
        } else {
          run.say('No webhook expression matched');
        }
      }
      const output = objectItem(match, 'output');
      if (response === MISSING && output !== MISSING) {
        response = run.expandJson(output, rdata, 'webhook output');
        processed = true;
      }
      if (processed) return finish(run, response);
    }
  }

  // 3. The data_map's own output
  const output = objectItem(dataMap, 'output');
  if (output !== MISSING) {
    run.say('No webhook produced a result; using the data_map output');
    addItem(data, 'prompt_vars', structuredClone(promptVars));
    return finish(run, run.expandJson(output, data, 'top-level output'));
  }

  // 4. The platform's generic error
  run.say('Nothing produced a result; the platform returns its generic error');
  return { response: PLATFORM_ERROR_RESPONSE };
}

function finish(run: Run, response: unknown): unknown {
  if (response === MISSING) {
    run.say("The expanded output isn't valid JSON");
    return {
      error:
        "The expanded output isn't valid JSON, so the platform gets no result from this " +
        'function. A template that inserts an object or array into a string causes this.',
    };
  }
  return response;
}

/**
 * Request the first eligible webhook, as get_input_from_webhooks() does.
 * Returns the reply, with an array wrapped as `{ array: [...] }`, and the
 * webhook when its reply counts as a success.
 */
async function runWebhooks(
  run: Run,
  webhooks: unknown,
  data: Data,
  opts: DataMapExecOptions,
): Promise<{ reply: unknown; match: Data | null }> {
  let reply: unknown = MISSING;
  let match: Data | null = null;

  if (Array.isArray(webhooks)) {
    for (const [i, item] of webhooks.entries()) {
      run.say(`\n=== Webhook ${i + 1}/${webhooks.length} ===`);
      const requireArgs = objectItem(item, 'require_args');
      let eligible = true;
      if (requireArgs !== MISSING && !anyPresent(requireArgs, objectItem(data, 'args'))) {
        // Any one of the listed arguments is enough
        run.say('Skipped: none of its require_args is present');
        eligible = false;
      }
      if (!hasItem(item, 'output') && !hasItem(item, 'expressions')) {
        run.say('Skipped: a webhook must have output or expressions');
        eligible = false;
      }
      if (!eligible) continue;
      reply = await request(run, item, data, opts);
      if (reply === MISSING) {
        run.say('Skipped: the webhook has no url');
        continue;
      }
      const reason = failure(reply, objectItem(item, 'error_keys'));
      if (reason) {
        run.say(
          `Webhook ${i + 1} failed: ${reason}. The platform tries no later webhook; ` +
            'the data_map output runs instead.',
        );
      } else {
        match = item as Data;
      }
      break;
    }
  } else if (isPlainObject(webhooks)) {
    // A single webhook object is never checked for errors
    run.say('\n=== Webhook ===');
    if (hasItem(webhooks, 'output') || hasItem(webhooks, 'expressions')) {
      reply = await request(run, webhooks, data, opts);
      if (reply !== MISSING) match = webhooks;
    } else {
      run.say('Skipped: a webhook must have output or expressions');
    }
  }

  if (Array.isArray(reply)) reply = { array: reply };
  return { reply, match };
}

/** mod_openai's args_present(): whether any of the named keys is present. */
function anyPresent(keys: unknown, container: unknown): boolean {
  const list = Array.isArray(keys) ? keys : [keys];
  return list.some((k) => typeof k === 'string' && hasItem(container, k));
}

/** Why a webhook's reply counts as a failure, or an empty string. */
function failure(reply: unknown, errorKeys: unknown): string {
  for (const key of ['parse_error', 'protocol_error']) {
    if (hasItem(reply, key)) return `the response has ${key}`;
  }
  if (errorKeys === MISSING) return '';
  // A listed key fails the webhook when it is present, whatever its value
  for (const key of Array.isArray(errorKeys) ? errorKeys : [errorKeys]) {
    if (typeof key === 'string' && hasItem(reply, key)) {
      return `the response has the error key '${key}'`;
    }
  }
  return '';
}

/**
 * Send one webhook's request as parse_webhook() does, and return its reply,
 * or MISSING when the webhook has no url.
 */
async function request(
  run: Run,
  webhook: unknown,
  data: Data,
  opts: DataMapExecOptions,
): Promise<unknown> {
  let url = stringItem(webhook, 'url');
  if (url === null) return MISSING;
  const method = stringItem(webhook, 'method');
  const formParam = stringItem(webhook, 'form_param');
  let params = objectItem(webhook, 'params');
  const headers = objectItem(webhook, 'headers');

  if (isTrue(objectItem(webhook, 'input_args_as_params'))) {
    const args = objectItem(data, 'args');
    if (args !== MISSING) {
      if (isPlainObject(params) && isPlainObject(args)) {
        const merged = structuredClone(params);
        for (const [key, value] of Object.entries(args)) {
          replaceItem(merged, key, structuredClone(value));
        }
        params = merged;
      } else if (params === MISSING) {
        params = args;
      }
    }
  }

  // Credentials in the url become basic authentication, sent only to their origin
  let authorization: string | undefined;
  const credentials = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^/?#@]*)@/.exec(url);
  if (credentials) {
    const [user, ...rest] = credentials[2]!.split(':');
    const decode = (s: string) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    };
    const pair = `${decode(user!)}:${decode(rest.join(':'))}`;
    authorization = `Basic ${Buffer.from(pair).toString('base64')}`;
    url = credentials[1] + url.slice(credentials[0].length);
  }
  url = run.expand(url, data, 'webhook url');

  let post = method !== null && method.toLowerCase() === 'post';
  let body: string | undefined;
  if (params !== MISSING) {
    // params are the request body, so a webhook with params is a POST
    post = true;
    body = run.expand(cjsonPrint(params), data, 'webhook params', true);
    if (formParam !== null) body = `${formParam}=${urlEncode(body)}`;
  }
  if (hasItem(webhook, 'body')) {
    run.say("The platform doesn't send a webhook's body key; params is the request body");
  }

  const requestHeaders: Record<string, string> = {
    'Content-Type': formParam !== null ? 'application/x-www-form-urlencoded' : 'application/json',
    'User-Agent': 'SignalWire-CallFabric/1.0',
  };
  if (authorization) requestHeaders['Authorization'] = authorization;
  if (isPlainObject(headers)) {
    // Header values are sent as written; templates in them aren't expanded
    for (const [name, value] of Object.entries(headers)) {
      if (typeof value !== 'string') continue;
      for (const existing of Object.keys(requestHeaders)) {
        if (existing.toLowerCase() === name.toLowerCase()) delete requestHeaders[existing];
      }
      requestHeaders[name] = value;
    }
  }

  const httpMethod = post ? 'POST' : 'GET';
  if (method !== null && method.toUpperCase() !== httpMethod) {
    run.say(`The platform sends ${httpMethod}, not ${method}`);
  }
  run.say(`${httpMethod} ${url}`);
  if (body !== undefined) run.say(`Request body: ${body}`);

  const fetchImpl: DataMapFetch =
    opts.fetchImpl ??
    ((target, init) =>
      _publicFetch(target, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        signal: init.signal,
        // The platform's curl settings: up to 15 redirects, a POST sent again
        // with its body after any of them. Every hop is still checked.
        redirectMode: 'curl',
        onStatus: init.onStatus,
      }));

  // Each status received, redirects included
  const statuses: number[] = [];
  let status = 0;
  let text = '';
  let curlError: number | null = null;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    (opts.timeoutSeconds ?? HTTP_REQUEST_TIMEOUT) * 1000,
  );
  try {
    // The timeout covers the body too: headers can arrive and the body stall.
    const response = await fetchImpl(url, {
      method: httpMethod,
      headers: requestHeaders,
      body,
      signal: controller.signal,
      onStatus: (received) => void statuses.push(received),
    });
    status = response.status;
    text = await Promise.race([
      response.text(),
      new Promise<never>((_resolve, reject) => {
        const abort = () => reject(new Error('webhook timed out'));
        if (controller.signal.aborted) abort();
        controller.signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
    run.say(`Response status: ${status}`);
  } catch (err) {
    // As curl reports it, the status is the last one received, redirects
    // included, or 0 when none was
    status = statuses.at(-1) ?? status;
    curlError = curlErrorCode(err);
    run.say(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  let reply = text ? cjsonParse(text) : MISSING;
  const parseError = reply === MISSING;
  if (parseError || curlError !== null || status < 200 || status > 299) {
    if (reply === MISSING) reply = {};
    if (isPlainObject(reply)) {
      if (parseError) {
        setItem(reply, 'parse_error', true);
        setItem(reply, 'raw_response', text);
      }
      if (curlError !== null) {
        setItem(reply, 'protocol_error', true);
        setItem(reply, 'http_req_result', curlError);
      }
      setItem(reply, 'http_code', status);
    }
    run.say(`Response data: ${JSON.stringify(reply)}`);
  }
  return reply;
}

/** Build a foreach's text into its output_key, as process_foreach() does. */
function processForeach(run: Run, foreach: unknown, data: Data): void {
  const inputKey = stringItem(foreach, 'input_key');
  const outputKey = stringItem(foreach, 'output_key');
  const append = stringItem(foreach, 'append');
  if (inputKey === null || outputKey === null || append === null) {
    run.say('foreach needs input_key, output_key and append; skipping it');
    return;
  }
  const items = lookup(data, inputKey);
  if (!Array.isArray(items)) {
    run.say(`foreach: ${inputKey} isn't an array in the response; skipping it`);
    return;
  }
  let count = items.length;
  const limit = objectItem(foreach, 'max');
  if (limit !== MISSING) {
    const max =
      typeof limit === 'string' ? atoi(limit) : typeof limit === 'number' ? Math.trunc(limit) : 0;
    if (max > 0) count = Math.min(count, max);
  }
  const parts: string[] = [];
  for (const item of items.slice(0, count)) {
    // this is the current element, and everything else stays readable
    deleteItem(data, 'this');
    setItem(data, 'this', structuredClone(item));
    parts.push(run.expand(append, data, 'webhook foreach'));
    deleteItem(data, 'this');
  }
  addItem(data, outputKey, parts.join(''));
  run.say(`foreach: ${count} item(s) into ${outputKey}`);
}
