/**
 * SecurityUtils - Shared security utility functions.
 *
 * Provides prototype pollution protection, SSRF guards, header filtering,
 * URL credential redaction, hostname validation, and input length limits.
 */

import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { getExecutionMode } from './Logger.js';

/** Maximum allowed input length for skill handler arguments (characters). */
export const MAX_SKILL_INPUT_LENGTH = 1000;

/** Keys that must never be copied via object spread or assign. */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Copy properties from `source` to `target`, filtering out prototype-pollution keys.
 * Drop-in replacement for `Object.assign(target, source)` where `source` is untrusted.
 * @param target - The object to assign into.
 * @param source - The object to copy properties from.
 * @returns The target object.
 */
export function safeAssign<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  for (const key of Object.keys(source)) {
    if (!DANGEROUS_KEYS.has(key)) {
      (target as Record<string, unknown>)[key] = source[key];
    }
  }
  return target;
}

/** Headers that must be stripped before passing to user callbacks. */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'proxy-authorization',
  'set-cookie',
]);

/**
 * Return a copy of `headers` with sensitive entries (authorization, cookie, etc.) removed.
 * @param headers - Original header record.
 * @returns A new record with sensitive headers removed.
 */
export function filterSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!SENSITIVE_HEADERS.has(k.toLowerCase())) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Redact credentials embedded in a URL (e.g. `https://user:secret@host` -> `https://user:****@host`).
 * Masks the password of every URL in the string, including one with an empty
 * user (`http://:secret@host`). Returns the string unchanged if no credentials
 * are present.
 * @param url - The URL string (or a message containing URLs) to redact.
 * @returns The string with each URL's password replaced by `****`.
 */
export function redactUrl(url: string): string {
  return url.replace(/:\/\/([^:@/]*):([^@/]*)@/g, '://$1:****@');
}

/**
 * Validate that a hostname string does not contain whitespace, slashes, or control characters.
 * @param host - Hostname to validate.
 * @returns True if the hostname is valid.
 */
export function isValidHostname(host: string): boolean {
  if (!host || host.length === 0) return false;
  // Reject whitespace, slashes, control chars
  // eslint-disable-next-line no-control-regex -- intentional control-char rejection in hostname validation
  return !/[\s/\\]/.test(host) && !/[\x00-\x1f\x7f]/.test(host);
}

/** Private and reserved networks a user-supplied URL must not reach. */
const BLOCKED_NETWORKS = (() => {
  const list = new BlockList();
  list.addSubnet('10.0.0.0', 8, 'ipv4');
  list.addSubnet('172.16.0.0', 12, 'ipv4');
  list.addSubnet('192.168.0.0', 16, 'ipv4');
  list.addSubnet('127.0.0.0', 8, 'ipv4');
  list.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local, including cloud metadata
  list.addSubnet('0.0.0.0', 8, 'ipv4');
  list.addAddress('::1', 'ipv6');
  list.addSubnet('fc00::', 7, 'ipv6'); // IPv6 private
  list.addSubnet('fe80::', 10, 'ipv6'); // IPv6 link-local
  return list;
})();

/**
 * Expand an IPv6 address to its eight 16-bit groups, or `null` if it isn't
 * one. Handles `::` compression and a trailing dotted IPv4 part.
 */
function ipv6Groups(addr: string): number[] | null {
  if (isIP(addr) !== 6) return null;
  // Rewrite a trailing dotted IPv4 part (::ffff:1.2.3.4) as two hex groups.
  const text = addr.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_m, a, b, c, d) => {
    const hi = ((Number(a) << 8) | Number(b)).toString(16);
    const lo = ((Number(c) << 8) | Number(d)).toString(16);
    return `${hi}:${lo}`;
  });
  const parse = (part: string) => (part ? part.split(':').map((g) => parseInt(g, 16)) : []);
  let groups: number[];
  if (text.includes('::')) {
    const [head = '', tail = ''] = text.split('::');
    const left = parse(head);
    const right = parse(tail);
    groups = [...left, ...new Array(8 - left.length - right.length).fill(0), ...right];
  } else {
    groups = parse(text);
  }
  return groups.length === 8 ? groups : null;
}

/**
 * Check whether an address is one a user-supplied URL must not reach: a
 * private, loopback, link-local or reserved address, or the unspecified
 * address (`0.0.0.0` or `::`), which connects to the local host.
 *
 * Accepts IPv6 in brackets (as `URL.hostname` gives it) and with a zone id.
 * An IPv4-mapped IPv6 address (`::ffff:169.254.169.254`, in any spelling)
 * reaches the IPv4 host, so the IPv4 address it carries is what's checked.
 * A string that isn't an IP address returns `false`.
 *
 * @param ip - The IP address string to check.
 * @returns True if the address is private, internal or unspecified.
 */
export function isPrivateIp(ip: string): boolean {
  let addr = ip.trim();
  if (addr.startsWith('[') && addr.endsWith(']')) addr = addr.slice(1, -1);
  const zone = addr.indexOf('%');
  if (zone !== -1) addr = addr.slice(0, zone);

  const family = isIP(addr);
  if (family === 4) return BLOCKED_NETWORKS.check(addr, 'ipv4');
  if (family !== 6) return false;

  const groups = ipv6Groups(addr);
  if (!groups) return false;
  if (groups.every((g) => g === 0)) return true;
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) {
    const v4 = [groups[6]! >> 8, groups[6]! & 0xff, groups[7]! >> 8, groups[7]! & 0xff].join('.');
    return BLOCKED_NETWORKS.check(v4, 'ipv4');
  }
  return BLOCKED_NETWORKS.check(addr, 'ipv6');
}

/** True when the caller or `SWML_ALLOW_PRIVATE_URLS` (1/true/yes) permits private addresses. */
export function _privateUrlsAllowed(allowPrivate = false): boolean {
  if (allowPrivate) return true;
  const env = (process.env['SWML_ALLOW_PRIVATE_URLS'] ?? '').toLowerCase();
  return env === '1' || env === 'true' || env === 'yes';
}

/** A DNS lookup returning every address for a hostname (`dns.promises.lookup` with `all`). */
export type _LookupAll = (hostname: string) => Promise<{ address: string; family: number }[]>;

const lookupAll: _LookupAll = (hostname) => lookup(hostname, { all: true });

/**
 * Check a URL a user or the model supplied before fetching it. Throws with a
 * reason when the URL isn't http(s), has no hostname, can't be resolved, or
 * resolves to any private or internal address. Shared by
 * {@link resolveAndValidateUrl} and the SDK's URL-fetching skills.
 *
 * @param url - The URL to check.
 * @param allowPrivate - Skip the address checks (so does `SWML_ALLOW_PRIVATE_URLS`).
 * @param resolve - The DNS lookup to use; tests pass their own.
 */
export async function _checkUrl(
  url: string,
  allowPrivate = false,
  resolve: _LookupAll = lookupAll,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${redactUrl(url)}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`URL rejected: invalid scheme ${parsed.protocol}`);
  }
  let hostname = parsed.hostname;
  if (hostname.startsWith('[') && hostname.endsWith(']')) hostname = hostname.slice(1, -1);
  if (!hostname) throw new Error('URL rejected: no hostname');

  if (_privateUrlsAllowed(allowPrivate)) return;

  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`URL rejected: ${hostname} is a private IP address`);
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await resolve(hostname);
  } catch {
    throw new Error(`URL rejected: could not resolve hostname ${hostname}`);
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(`URL rejected: ${hostname} resolves to private IP ${address}`);
    }
  }
}

/**
 * Check that a URL is safe to fetch, and throw if it isn't.
 *
 * The URL must be http or https, and its hostname must resolve, with every
 * address it resolves to outside the private and internal ranges (see
 * {@link isPrivateIp}). A hostname that can't be resolved is refused.
 *
 * @param url - The full URL to validate.
 * @param allowPrivate - When true, skip the private-IP check (default false).
 *   `SWML_ALLOW_PRIVATE_URLS` (1/true/yes) does the same.
 * @throws If the URL is invalid, can't be resolved, or reaches a private address.
 */
export async function resolveAndValidateUrl(url: string, allowPrivate = false): Promise<void> {
  await _checkUrl(url, allowPrivate);
}

/**
 * Validate that a URL is safe to fetch (not pointing to private/internal resources).
 *
 * Matches Python's `validate_url(url, allow_private=False) -> bool` — returns `true`
 * if the URL is safe, `false` otherwise (never throws).
 *
 * @param url - The URL to validate.
 * @param allowPrivate - When true, allow private IP ranges (default false).
 * @returns `true` if the URL is safe to fetch, `false` otherwise.
 */
export async function validateUrl(url: string, allowPrivate = false): Promise<boolean> {
  try {
    await resolveAndValidateUrl(url, allowPrivate);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the current process is running in a serverless environment
 * (anything other than a long-lived ``server`` runtime).
 *
 * Python equivalent: ``signalwire.utils.is_serverless_mode``.
 */
export function isServerlessMode(): boolean {
  const mode = getExecutionMode();
  return mode !== 'server';
}

/**
 * The CORS `origin` option from `SWML_CORS_ORIGINS`: `'*'` when it's unset or
 * lists `*` (which allows every origin, as the Python SDK reads it), else the
 * listed origins.
 * @internal
 */
export function corsOriginsFromEnv(
  value: string | undefined = process.env['SWML_CORS_ORIGINS'],
): '*' | string[] {
  if (!value) return '*';
  const list = value
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return list.length === 0 || list.includes('*') ? '*' : list;
}
