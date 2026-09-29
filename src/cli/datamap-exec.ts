/**
 * DataMap execution for swaig-test: runs a DataMap function locally the way
 * the platform runs it, so `swaig-test --exec` can test one without a call.
 *
 * The pipeline, as the platform processes a data_map:
 *
 * 1. Expressions: the first whose `string` (expanded) matches its `pattern`
 *    (case-insensitively, as the platform matches)
 *    produces `output`; one that doesn't match produces `nomatch-output` (the
 *    key `DataMap.expression()` writes and the platform reads), if it has one.
 * 2. Webhooks, in order (`webhooks` is a list, or one webhook object; see
 *    below). A webhook is skipped, and the next one tried, when
 *    none of its `require_args` is among the arguments, or it has neither
 *    `output` nor `expressions`. The first webhook that is requested ends the
 *    webhook stage, whether it succeeds or fails: the next one isn't tried.
 *    It fails on a body that isn't JSON, a request that doesn't complete, or
 *    a JSON object with one of its `error_keys` present (whatever the key's
 *    value: `"errors": []` fails it). A status outside 200-299 doesn't fail
 *    it by itself; the status is then in the response as `http_code`.
 * 3. The successful webhook's `foreach`, then its `expressions` (read
 *    against the response, the first match or `nomatch-output` wins), then
 *    its `output`.
 * 4. The data_map's own `output` when the webhook failed, when no webhook was
 *    requested, or when the one that succeeded has expressions that didn't
 *    match and no `output`.
 *
 * `expressions` (the data_map's or a webhook's) can be one expression object
 * instead of a list, and runs as a one-element list. `webhooks` can be one
 * webhook object, which the platform runs differently from a list: it
 * doesn't check the webhook's `require_args` or `error_keys`, and a body that
 * isn't JSON or a request that doesn't complete doesn't fail it, so its
 * `foreach`, `expressions` and `output` read the error response
 * (`${parse_error}`, `${raw_response}`, `${http_code}`). It still needs
 * `output` or `expressions`, and a `url`, to be requested.
 *
 * The request is a POST when the webhook has `params` (its JSON body, with
 * the arguments merged in by `input_args_as_params`) or its method is POST,
 * and a GET otherwise, whatever the method says. A `body` key isn't sent.
 * An `error_keys` on the data_map itself is ignored, as on the platform: only
 * a webhook's own `error_keys` fail it.
 *
 * A `foreach` needs `input_key` (a path in the webhook's template data, such
 * as `data.items`), `output_key` and `append`; without all three it is
 * skipped. `max` limits the elements when it is above 0. Each element is
 * `this`: an object's fields are `${this.name}`, and a string or number is
 * `${this}` itself.
 *
 * Template data, per stage, as the platform builds it:
 *
 * - The call data: `args` (the function's arguments), `function`, and an
 *   empty `input`. A webhook's `url` and `params`, the top-level
 *   `expressions` and the data_map's own `output` read it, so they write an
 *   argument as `${args.city}`.
 * - A webhook's `foreach`, `expressions` and `output` read the webhook's
 *   response instead: a JSON object's fields at the root (`${current.temp_f}`),
 *   a JSON array under `array` (`${array[0].joke}`), and the call data under
 *   `input`. The arguments are `${input.args.city}` there; `${args.city}`
 *   doesn't resolve.
 * - A webhook's `headers` are sent as written: the platform expands no
 *   templates in them.
 *
 * Templates: `${path}` and `%{path}` read a dotted path (with `[n]` indexes,
 * negative ones from the end) from the template data. The platform has three
 * prefix helpers, each a name and a colon at the start of the template (the
 * name in any case): `lc:` lowercases, `enc:` URL-encodes and `fmt_ph:`
 * formats a phone number. It applies them in that fixed order, `fmt_ph`, then
 * `lc`, then `enc`, whatever order they are written in, so
 * `${lc:enc:args.city}` and `${enc:lc:args.city}` both lowercase the city,
 * then encode it. Any other name before a colon is part of the path:
 * `${enc:url:args.city}` reads the path `url:args.city`, which doesn't
 * resolve, and the simulator says so on stderr. Nested templates expand from
 * the inside out.
 *
 * Where the simulator differs from the platform, on purpose:
 *
 * - An unresolved path becomes `<MISSING:path>`, where the platform writes
 *   nothing.
 * - The call data has no `global_data`, `meta_data`, prompt variables or
 *   call details, so templates that read them show as missing.
 * - `@{...}` functions are left as they are.
 * - `fmt_ph:` isn't applied: the value is left as it is, and the simulator
 *   says so on stderr.
 * - Keys match exactly; the platform matches them case-insensitively.
 * - An expression's `expr` (a FreeSWITCH `expr` evaluation) isn't evaluated:
 *   only its `pattern` is tried.
 * - When nothing produces a result and there is no fallback output, the
 *   result is an `{ error, status: 'failed' }` object (so swaig-test can exit
 *   1), where the platform answers "There was an error processing this
 *   request."
 *
 * Mirrors signalwire-python's `signalwire.cli.execution.datamap_exec`, with
 * the platform's (mod_openai's) stage template data.
 */

import { _publicFetch } from '../PublicFetch.js';

/** Seconds to wait for a webhook. */
const HTTP_REQUEST_TIMEOUT = 30;

/** A `${...}` or `%{...}` with no braces inside it, so nested templates expand inside out. */
const TEMPLATE = /[$%]\{([^{}]*)\}/g;

/** The characters FreeSWITCH's `SWITCH_URL_UNSAFE` lists, which `enc:` encodes. */
const URL_UNSAFE = '\r\n #%&+:;<=>?@[\\]^`{|}"';
const HEX = '0123456789ABCDEF';

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

/**
 * The prefix helpers the platform recognizes (mod_openai swaig.c
 * `_expand_jsonvars`): each is its name and a colon at the start of the
 * template, the name matched case-insensitively. Anything else is part of the
 * path, so `${enc:url:args.city}` reads the path `url:args.city`.
 */
const HELPER_PREFIX = /^(lc|fmt_ph|enc):/i;

type Data = Record<string, unknown>;

function isPlainObject(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether any of `keys` (a key name or a list of them) is present in `obj`,
 * as the platform's `args_present()` checks `error_keys` and `require_args`:
 * by presence, whatever the value.
 */
function anyKeyPresent(keys: unknown, obj: unknown): boolean {
  if (!isPlainObject(obj)) return false;
  const list = Array.isArray(keys) ? keys : [keys];
  return list.some((k) => typeof k === 'string' && Object.hasOwn(obj, k));
}

/** The value at a dotted path with `[n]` (or `[-n]`) indexes, or a `<MISSING:path>` marker. */
function lookup(data: Data, path: string): unknown {
  let value: unknown = data;
  for (const part of path.match(/[^.[\]]+|\[-?\d+\]/g) ?? []) {
    if (part.startsWith('[')) {
      if (!Array.isArray(value)) return `<MISSING:${path}>`;
      let index = Number(part.slice(1, -1));
      // As on the platform, a negative index counts from the end.
      if (index < 0) index += value.length;
      if (index < 0 || index >= value.length) return `<MISSING:${path}>`;
      value = value[index];
    } else if (isPlainObject(value) && part in value) {
      value = value[part];
    } else {
      return `<MISSING:${path}>`;
    }
  }
  return value;
}

/** A value as template text: strings as they are, other values as JSON. */
function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * One template's value: its helpers applied to the value at its path. As on
 * the platform, the helpers are collected and applied in a fixed order,
 * whatever order they are written in: `fmt_ph` (which the simulator doesn't
 * apply), then `lc`, then `enc`.
 */
function expandOne(body: string, data: Data): string {
  const helpers = new Set<string>();
  let path = body;
  for (let m = HELPER_PREFIX.exec(path); m; m = HELPER_PREFIX.exec(path)) {
    helpers.add(m[1]!.toLowerCase());
    path = path.slice(m[0].length);
  }
  const value = lookup(data, path);
  let out = text(value);
  if (typeof value === 'string' && value.startsWith('<MISSING:')) return out;
  if (!out) return out;
  if (helpers.has('lc')) out = out.toLowerCase();
  if (helpers.has('enc')) out = urlEncode(out);
  return out;
}

/**
 * Expand DataMap templates in a string as the platform does.
 *
 * @param template - Text with `${...}` or `%{...}` templates.
 * @param data - The template data.
 * @returns The expanded text.
 */
export function expandTemplate(template: string, data: Data): string {
  if (!template) return '';
  let result = template;
  // Each pass expands the innermost templates; nesting is never deep.
  for (let i = 0; i < 20; i++) {
    const expanded = result.replace(TEMPLATE, (_m, body: string) => expandOne(body, data));
    if (expanded === result) break;
    result = expanded;
  }
  return result;
}

/** Expand every string inside a value (an output object, say), leaving its shape. */
export function expandValue(value: unknown, data: Data): unknown {
  if (typeof value === 'string') return expandTemplate(value, data);
  if (Array.isArray(value)) return value.map((v) => expandValue(v, data));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expandValue(v, data)]));
  }
  return value;
}

/**
 * A pattern as the platform compiles it: wrapped as `/pattern/i`, so it is
 * case-insensitive, unless it starts with `/`, when it is `/pattern/flags`
 * and only its own `i` and `s` flags apply. A leading PCRE flag group such as
 * `(?i)`, which JavaScript doesn't accept, becomes the same flags.
 */
function platformRegExp(pattern: string): RegExp {
  let source = pattern;
  let flags = 'i';
  if (pattern.startsWith('/')) {
    const end = pattern.lastIndexOf('/');
    if (end === 0) throw new Error(`missing ending '/' delimiter`);
    source = pattern.slice(1, end);
    const opts = pattern.slice(end + 1);
    flags = (opts.includes('i') ? 'i' : '') + (opts.includes('s') ? 's' : '');
  }
  const inline = /^\(\?([is]+)\)/.exec(source);
  if (inline) {
    source = source.slice(inline[0].length);
    for (const flag of inline[1]!) if (!flags.includes(flag)) flags += flag;
  }
  return new RegExp(source, flags);
}

/**
 * Run a list of expressions as the platform does: the first one with an
 * `output` whose expanded `string` matches its `pattern` produces that
 * output, and one that doesn't match produces its `nomatch-output`, if it has
 * one. An expression with no `output` is skipped, as on the platform.
 */
function runExpressions(
  expressions: unknown,
  data: Data,
  say: (line: string) => void,
): { matched: true; output: unknown } | { matched: false } {
  // As on the platform, a single expression object runs as a one-element list.
  for (const expr of Array.isArray(expressions) ? expressions : [expressions]) {
    // As on the platform, an expression needs `output` and a `string` (or
    // `expr`) to test; without a `pattern` it doesn't match.
    if (!isPlainObject(expr) || !('output' in expr)) continue;
    const source = expr['string'] ?? expr['expr'];
    if (typeof source !== 'string') continue;
    if ('expr' in expr) say("An expression's expr isn't evaluated by the simulator");
    const subject = expandTemplate(source, data);
    let matched = false;
    if (typeof expr['pattern'] === 'string') {
      try {
        matched = platformRegExp(expr['pattern']).test(subject);
      } catch {
        say(`Expression pattern isn't a valid regular expression: ${expr['pattern']}`);
        continue;
      }
    }
    if (matched) {
      say(`Expression matched: ${expr['pattern']} on "${subject}"`);
      return { matched: true, output: expandValue(expr['output'], data) };
    }
    if ('nomatch-output' in expr) {
      say(`Expression didn't match: ${expr['pattern']} on "${subject}"`);
      return { matched: true, output: expandValue(expr['nomatch-output'], data) };
    }
  }
  return { matched: false };
}

/** Options for {@link executeDataMap}. */
export interface DataMapExecOptions {
  /** Print each step to `log`. */
  verbose?: boolean;
  /** Seconds to wait for each webhook, body included (default 30). */
  timeoutSeconds?: number;
  /** Where verbose output and hints go (default: stderr). */
  log?: (line: string) => void;
  /**
   * Fetch implementation; defaults to the SDK's SSRF-guarded fetch, which
   * follows redirects as the platform's curl does and checks every hop.
   */
  fetchImpl?: (
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
  ) => Promise<Response>;
}

/**
 * Run a DataMap function locally.
 *
 * @param fn - The function's SWAIG entry (`{ function, data_map, ... }`) or
 *   its `data_map` alone.
 * @param args - The function's arguments.
 * @param opts - Verbose output, and the fetch to use.
 * @returns The function's result: the expanded output (an object or a
 *   string), or an `{ error, status: 'failed' }` object when nothing
 *   produced a result and there is no fallback output.
 */
export async function executeDataMap(
  fn: Data,
  args: Data,
  opts: DataMapExecOptions = {},
): Promise<unknown> {
  const log = opts.log ?? ((line: string) => void process.stderr.write(`${line}\n`));
  const say = (line: string) => {
    if (opts.verbose) log(line);
  };
  const fetchImpl =
    opts.fetchImpl ??
    ((url, init) =>
      _publicFetch(url, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        signal: init.signal,
        // The platform's curl settings: up to 15 redirects, a POST sent again
        // with its body after any of them. Every hop is still checked.
        redirectMode: 'curl',
      }));
  const dataMap = (isPlainObject(fn['data_map']) ? fn['data_map'] : fn) as Data;

  // The call data, as the platform has it for a data_map (mod_openai
  // actions.c): the arguments under `args`, and an empty `input`. The url,
  // params, top-level expressions and fallback output read it.
  const callData: Data = {
    ...(typeof fn['function'] === 'string' ? { function: fn['function'] } : {}),
    args,
    input: {},
  };
  say('=== DataMap Function Execution ===');
  say(`Args: ${JSON.stringify(args)}`);

  // Notes for the two templates that resolve against the wrong stage's data.
  const hint = (result: unknown) => {
    const shown = JSON.stringify(result ?? '');
    if (shown.includes('<MISSING:response.')) {
      log(
        "Note: ${response.<field>} didn't resolve. The platform reads a webhook's JSON " +
          'response from the root: write ${<field>}, not ${response.<field>}.',
      );
    }
    if (shown.includes('<MISSING:args.')) {
      log(
        "Note: ${args.<name>} didn't resolve. In a webhook's output, expressions and " +
          'foreach the platform reads the response, with the arguments under input: ' +
          'write ${input.args.<name>}.',
      );
    }
  };

  // Notes for helpers the simulator reads as the platform does, which can
  // surprise: a name before a colon that isn't a helper is part of the path
  // (so `${enc:url:args.city}` reads `url:args.city`), and fmt_ph isn't applied.
  const noted = new Set<string>();
  const noteHelpers = (value: unknown) => {
    const shown = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    for (const [, name, rest] of shown.matchAll(/<MISSING:([A-Za-z_]\w*):([^<>]*)>/g)) {
      const line =
        `Note: "${name}:" is not a template helper. The platform's helpers are lc:, enc: ` +
        `and fmt_ph:, so it reads "${name}:${rest}" as a path, which doesn't resolve, and ` +
        'writes nothing there.' +
        (name!.toLowerCase() === 'url' ? ` To URL-encode, write \${enc:${rest}}.` : '');
      if (!noted.has(line)) log(line);
      noted.add(line);
    }
  };
  if (/[$%]\{(?:(?:lc|enc):)*fmt_ph:/i.test(JSON.stringify(dataMap))) {
    log(
      "Note: the simulator doesn't apply fmt_ph:, and leaves the value as it is. The " +
        'platform formats it as a national phone number (a number without a country code ' +
        'is read as a US number), or writes INVALID NUMBER when it is not a valid number.',
    );
  }

  const done = (result: unknown) => {
    noteHelpers(result);
    return result;
  };

  // 1. Expressions
  const exprResult = runExpressions(dataMap['expressions'], callData, say);
  if (exprResult.matched) return done(exprResult.output);

  // 2. Webhooks, in order. The first one requested ends the webhook stage.
  // As on the platform, `webhooks` is a list or a single webhook object. A
  // single one's require_args and error_keys aren't checked, and a failed
  // request doesn't fail it: its foreach, expressions and output read the
  // error response.
  const single = isPlainObject(dataMap['webhooks']);
  const webhooks = Array.isArray(dataMap['webhooks'])
    ? dataMap['webhooks']
    : single
      ? [dataMap['webhooks']]
      : [];
  for (const [i, webhook] of webhooks.entries()) {
    if (!isPlainObject(webhook)) continue;
    say(`\n=== Webhook ${i + 1}/${webhooks.length} ===`);
    if (single && 'require_args' in webhook) {
      say("The platform doesn't check a single webhook object's require_args");
    } else if ('require_args' in webhook && !anyKeyPresent(webhook['require_args'], args)) {
      say('None of its require_args is set; trying the next webhook');
      continue;
    }
    if (!('output' in webhook) && !('expressions' in webhook)) {
      say('It has neither output nor expressions; trying the next webhook');
      continue;
    }
    if (typeof webhook['url'] !== 'string' || !webhook['url']) {
      say('It has no url; trying the next webhook');
      continue;
    }
    const url = expandTemplate(webhook['url'], callData);
    // As on the platform, the request is a POST when the method is POST or
    // there are params, and a GET otherwise.
    let method = text(webhook['method'] ?? '').toUpperCase() === 'POST' ? 'POST' : 'GET';
    if (webhook['method'] !== undefined && text(webhook['method']).toUpperCase() !== method) {
      say(`The platform sends ${method}, not ${text(webhook['method'])}`);
    }
    // The platform sends header values as written: it expands no templates in them.
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(
      isPlainObject(webhook['headers']) ? webhook['headers'] : {},
    )) {
      if (typeof v === 'string') headers[k] = v;
    }

    // `params` (with the arguments merged in by `input_args_as_params`) is
    // the request body whenever it is set, and makes the request a POST.
    let params = isPlainObject(webhook['params']) ? webhook['params'] : undefined;
    const argsAsParams = webhook['input_args_as_params'];
    if (argsAsParams === true || argsAsParams === 'true') params = { ...params, ...args };
    let body: string | undefined;
    let contentType = 'application/json';
    if (params) {
      method = 'POST';
      body = JSON.stringify(expandValue(params, callData));
      noteHelpers(body);
      const formParam = webhook['form_param'];
      if (typeof formParam === 'string' && formParam) {
        body = `${formParam}=${urlEncode(body)}`;
        contentType = 'application/x-www-form-urlencoded';
      }
    }
    if ('body' in webhook) say('The platform does not send a webhook body; params is the body');
    if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = contentType;
    }
    say(`${method} ${url}`);
    if (body) say(`Request body: ${body}`);
    noteHelpers(url);

    let responseData: unknown;
    let failed = false;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      (opts.timeoutSeconds ?? HTTP_REQUEST_TIMEOUT) * 1000,
    );
    try {
      // The timeout covers the body too: headers can arrive and the body stall.
      const response = await fetchImpl(url, { method, headers, body, signal: controller.signal });
      const raw = await Promise.race([
        response.text(),
        new Promise<never>((_resolve, reject) => {
          if (controller.signal.aborted) reject(new Error('webhook timed out'));
          controller.signal.addEventListener(
            'abort',
            () => reject(new Error('webhook timed out')),
            {
              once: true,
            },
          );
        }),
      ]);
      say(`Response status: ${response.status}`);
      const ok = response.status >= 200 && response.status <= 299;
      try {
        responseData = JSON.parse(raw);
      } catch {
        responseData = { parse_error: true, raw_response: raw, http_code: response.status };
      }
      // As on the platform, a status outside 200-299 doesn't fail the webhook
      // by itself: it is added to the response as http_code.
      if (!ok && isPlainObject(responseData)) responseData['http_code'] = response.status;
    } catch (err) {
      // As on the platform, a request that doesn't complete has no body to
      // parse and no status: a single webhook object's output reads these.
      responseData = {
        parse_error: true,
        raw_response: '',
        protocol_error: true,
        http_code: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }

    // As on the platform, a key fails the webhook by being present, whatever
    // its value. An array response has no keys.
    const configured = webhook['error_keys'];
    const errorKeys = [
      'protocol_error',
      'parse_error',
      ...(Array.isArray(configured) ? configured : configured !== undefined ? [configured] : []),
    ];
    const hit = errorKeys.find((k) => anyKeyPresent(k, responseData));
    if (hit && single) {
      say(
        `The response has the key '${hit}', but the platform doesn't fail a single ` +
          'webhook object: its output reads the response',
      );
    } else if (hit) {
      failed = true;
      say(`Webhook failed: the response has the key '${hit}'`);
    }

    if (failed) {
      say('The platform tries no other webhook after one is requested');
      break;
    }

    // The webhook's template data: an object response's fields at the root,
    // an array response under `array`, and the call data under `input`. The
    // arguments are `${input.args.x}` here, not `${args.x}`.
    const webhookContext: Data = {
      input: callData,
      ...(Array.isArray(responseData)
        ? { array: responseData }
        : isPlainObject(responseData)
          ? responseData
          : {}),
    };

    // 3. foreach, which needs input_key, output_key and append
    const foreach = webhook['foreach'];
    if (isPlainObject(foreach)) {
      const { input_key: inputKey, output_key: outputKey, append } = foreach;
      if (
        typeof inputKey !== 'string' ||
        typeof outputKey !== 'string' ||
        typeof append !== 'string'
      ) {
        say('foreach needs input_key, output_key and append; skipped');
      } else {
        const items = lookup(webhookContext, inputKey);
        const rawMax = foreach['max'];
        const max = Math.trunc(
          typeof rawMax === 'string' ? Number.parseInt(rawMax, 10) || 0 : Number(rawMax ?? 0) || 0,
        );
        if (Array.isArray(items)) {
          const used = max > 0 ? items.slice(0, max) : items;
          webhookContext[outputKey] = used
            // As on the platform, append reads the webhook's template data
            // (the response, `input`) as well as the element as `this`.
            .map((item) => expandTemplate(append, { ...webhookContext, this: item }))
            .join('');
          say(`foreach: ${used.length} item(s) into ${outputKey}`);
        } else {
          say(`foreach: no array at ${inputKey}`);
        }
      }
    }

    // 4. The webhook's expressions, read against the response
    if ('expressions' in webhook) {
      const matched = runExpressions(webhook['expressions'], webhookContext, say);
      if (matched.matched) {
        hint(matched.output);
        return done(matched.output);
      }
      say('No webhook expression matched');
    }

    // 5. The webhook's output
    if ('output' in webhook) {
      const result = expandValue(webhook['output'], webhookContext);
      hint(result);
      return done(result);
    }
    break;
  }

  // 6. The webhook failed, none was requested, or the one that succeeded
  // produced nothing: the data_map's own output
  if ('output' in dataMap) {
    say('No webhook produced a result; using the data_map output');
    return done(expandValue(dataMap['output'], callData));
  }
  return { error: 'All webhooks failed and no fallback output defined', status: 'failed' };
}
