/**
 * DataMap execution for swaig-test: runs a DataMap function locally the way
 * the platform runs it, so `swaig-test --exec` can test one without a call.
 *
 * The pipeline, as the platform processes a data_map:
 *
 * 1. Expressions: the first whose `string` (expanded) matches its `pattern`
 *    produces `output`; one that doesn't match produces `nomatch-output` (the
 *    key `DataMap.expression()` writes and the platform reads), if it has one.
 * 2. Webhooks, in order, until one succeeds. A webhook fails on a status
 *    outside 200-299, a body that isn't JSON, or, for a JSON object, a
 *    `parse_error`/`protocol_error` key or one of its `error_keys`.
 * 3. The successful webhook's `foreach`, then its `expressions` (read
 *    against the response, the first match or `nomatch-output` wins), then
 *    its `output`.
 * 4. The data_map's own `output` when every webhook failed, or when the one
 *    that succeeded has expressions that didn't match and no `output`.
 *
 * An `error_keys` on the data_map itself is ignored, as on the platform: only
 * a webhook's own `error_keys` fail it.
 *
 * Templates: `${path}` and `%{path}` read a dotted path (with `[n]` indexes)
 * from the template data. Prefix helpers apply left to right: `lc`
 * lowercases and `enc` (or `enc:url`) URL-encodes, so `${lc:enc:args.city}`
 * is the city, lowercased and encoded. Nested templates expand from the
 * inside out. An unresolved path becomes `<MISSING:path>`; `@{...}`
 * functions are left as they are.
 *
 * A webhook's JSON object response is read from the root of the template
 * data (`${current.temp_f}`), and a JSON array response is under `array`
 * (`${array[0].joke}`), as on the platform.
 *
 * Mirrors signalwire-python's `signalwire.cli.execution.datamap_exec`.
 */

import { _publicFetch } from '../PublicFetch.js';

/** Seconds to wait for a webhook. */
const HTTP_REQUEST_TIMEOUT = 30;

/** A `${...}` or `%{...}` with no braces inside it, so nested templates expand inside out. */
const TEMPLATE = /[$%]\{([^{}]*)\}/g;

const HELPERS: Record<string, (value: string) => string> = {
  lc: (value) => value.toLowerCase(),
  enc: (value) =>
    encodeURIComponent(value).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    ),
};

type Data = Record<string, unknown>;

function isPlainObject(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Truthy as the platform (and Python) mean it: an empty list or object is false. */
function present(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return Boolean(value);
}

/** The value at a dotted path with `[n]` indexes, or a `<MISSING:path>` marker. */
function lookup(data: Data, path: string): unknown {
  let value: unknown = data;
  for (const part of path.match(/[^.[\]]+|\[\d+\]/g) ?? []) {
    if (part.startsWith('[')) {
      const index = Number(part.slice(1, -1));
      if (!Array.isArray(value) || index >= value.length) return `<MISSING:${path}>`;
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

/** One template's value: its helpers applied to the value at its path. */
function expandOne(body: string, data: Data): string {
  const parts = body.split(':');
  const helpers: ((value: string) => string)[] = [];
  while (parts.length > 1 && parts[0]! in HELPERS) {
    const name = parts.shift()!;
    helpers.push(HELPERS[name]!);
    if (name === 'enc' && parts.length > 1 && parts[0] === 'url') parts.shift();
  }
  const path = parts.join(':');
  const value = lookup(data, path);
  let out = text(value);
  if (typeof value === 'string' && value.startsWith('<MISSING:')) return out;
  for (const helper of helpers) out = helper(out);
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
  for (const expr of Array.isArray(expressions) ? expressions : []) {
    if (!isPlainObject(expr) || typeof expr['pattern'] !== 'string' || !('output' in expr)) {
      continue;
    }
    const subject = expandTemplate(text(expr['string'] ?? ''), data);
    let matched: boolean;
    try {
      matched = new RegExp(expr['pattern']).test(subject);
    } catch {
      say(`Expression pattern isn't a valid regular expression: ${expr['pattern']}`);
      continue;
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
  /** Fetch implementation; defaults to the SDK's SSRF-guarded fetch. */
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
 *   string), the raw response when a webhook has no output, or an error
 *   object when every webhook failed with no fallback output.
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
      }));
  const dataMap = (isPlainObject(fn['data_map']) ? fn['data_map'] : fn) as Data;

  // Arguments are under `args`, and also at the root for older templates.
  const context: Data = { args, ...args };
  say('=== DataMap Function Execution ===');
  say(`Args: ${JSON.stringify(args)}`);

  const hint = (result: unknown) => {
    if (JSON.stringify(result ?? '').includes('<MISSING:response.')) {
      log(
        "Note: ${response.<field>} didn't resolve. The platform reads a webhook's JSON " +
          'response from the root: write ${<field>}, not ${response.<field>}.',
      );
    }
  };

  // 1. Expressions
  const exprResult = runExpressions(dataMap['expressions'], context, say);
  if (exprResult.matched) return exprResult.output;

  // 2. Webhooks, in order, until one succeeds
  const webhooks = Array.isArray(dataMap['webhooks']) ? dataMap['webhooks'] : [];
  for (const [i, webhook] of webhooks.entries()) {
    if (!isPlainObject(webhook)) continue;
    say(`\n=== Webhook ${i + 1}/${webhooks.length} ===`);
    const url = expandTemplate(text(webhook['url'] ?? ''), context);
    const method = text(webhook['method'] ?? 'POST').toUpperCase();
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(
      isPlainObject(webhook['headers']) ? webhook['headers'] : {},
    )) {
      headers[k] = expandTemplate(text(v), context);
    }

    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const payload = webhook['params'] ?? webhook['body'] ?? webhook['data'];
      if (typeof payload === 'string') body = expandTemplate(payload, context);
      else if (payload !== undefined) body = JSON.stringify(expandValue(payload, context));
      if (
        body !== undefined &&
        !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')
      ) {
        headers['Content-Type'] = 'application/json';
      }
    }
    say(`${method} ${url}`);
    if (body) say(`Request body: ${body}`);

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
      try {
        responseData = JSON.parse(raw);
      } catch {
        responseData = {
          text: raw,
          status_code: response.status,
          parse_error: true,
          raw_response: raw,
        };
      }
      if (response.status < 200 || response.status > 299) {
        failed = true;
        say(`Webhook failed: HTTP status ${response.status}`);
      }
      // Error keys apply to a JSON object only; an array response has none.
      if (!failed && isPlainObject(responseData)) {
        const configured = webhook['error_keys'];
        const errorKeys = [
          'parse_error',
          'protocol_error',
          ...(typeof configured === 'string'
            ? [configured]
            : Array.isArray(configured)
              ? configured
              : []),
        ];
        const hit = errorKeys.find(
          (k) => typeof k === 'string' && present((responseData as Data)[k]),
        );
        if (hit) {
          failed = true;
          say(`Webhook failed: error key '${hit}' is set`);
        }
      }
    } catch (err) {
      failed = true;
      responseData = {
        protocol_error: true,
        error: err instanceof Error ? err.message : String(err),
      };
      say(`Webhook failed: ${(responseData as Data)['error']}`);
    } finally {
      clearTimeout(timer);
    }

    if (failed) {
      say(`Webhook ${i + 1} failed, trying the next one`);
      continue;
    }

    // An object response's fields are at the root of the template data; an
    // array response is under `array`.
    const webhookContext: Data = Array.isArray(responseData)
      ? { ...context, array: responseData }
      : { ...context, ...(responseData as Data) };

    // 3. foreach
    const foreach = webhook['foreach'];
    if (isPlainObject(foreach)) {
      const inputKey = text(foreach['input_key'] ?? 'data');
      const outputKey = text(foreach['output_key'] ?? 'result');
      const max = typeof foreach['max'] === 'number' ? foreach['max'] : 100;
      const append = text(foreach['append'] ?? '${this.value}');
      const items = isPlainObject(responseData) ? responseData[inputKey] : undefined;
      if (Array.isArray(items)) {
        webhookContext[outputKey] = items
          .slice(0, max)
          .map((item) =>
            expandTemplate(append, { this: isPlainObject(item) ? item : { value: item } }),
          )
          .join('');
        say(`foreach: ${Math.min(items.length, max)} item(s) into ${outputKey}`);
      } else {
        say(`foreach: no array at ${inputKey}`);
      }
    }

    // 4. The webhook's expressions, read against the response
    if ('expressions' in webhook) {
      const matched = runExpressions(webhook['expressions'], webhookContext, say);
      if (matched.matched) {
        hint(matched.output);
        return matched.output;
      }
      say('No webhook expression matched');
    }

    // 5. The webhook's output, or its response when it has neither output nor expressions
    if ('output' in webhook) {
      const result = expandValue(webhook['output'], webhookContext);
      hint(result);
      return result;
    }
    if ('expressions' in webhook) break;
    say('No output template; returning the response');
    return responseData;
  }

  // 6. Every webhook failed, or the one that succeeded produced nothing: the
  // data_map's own output
  if ('output' in dataMap) {
    say('No webhook produced a result; using the data_map output');
    return expandValue(dataMap['output'], context);
  }
  return { error: 'All webhooks failed and no fallback output defined', status: 'failed' };
}
