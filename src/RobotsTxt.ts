/**
 * RobotsTxt - robots.txt rules, read the way Python's `urllib.robotparser`
 * reads them, so the spider skill allows and refuses the same pages in both
 * SDKs.
 *
 * The rules, as in `urllib.robotparser`:
 * - A group is one or more `User-agent` lines followed by `Allow`/`Disallow`
 *   lines. A blank line ends a group; `User-agent` lines followed by a blank
 *   line and no rules are dropped.
 * - A group applies to a user agent when one of its names is `*` or appears
 *   in the user agent's product name (the part before the first `/`),
 *   compared without case. The first group that applies is used; the `*`
 *   group is used only when no other applies.
 * - Within a group, the first rule whose path starts the URL's path decides.
 *   An empty `Disallow` allows everything. There are no wildcards except a
 *   path of exactly `*`.
 * - Paths and URLs are compared percent-encoded, as `urllib.parse.quote`
 *   encodes them.
 *
 * Internal to the SDK.
 */

/** Percent-encode as Python's `urllib.parse.quote(s)` does, keeping `/`. */
function quote(s: string): string {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, '/');
}

const UTF8 = new TextDecoder('utf-8');

/**
 * Decode percent-escapes as Python's `urllib.parse.unquote` does: each run
 * of escapes is UTF-8, and bytes that aren't valid UTF-8 become U+FFFD.
 */
function unquote(s: string): string {
  return s.replace(/(%[0-9A-Fa-f]{2})+/g, (run) => {
    const bytes = new Uint8Array(run.length / 3);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(run.slice(i * 3 + 1, i * 3 + 3), 16);
    return UTF8.decode(bytes);
  });
}

interface RuleLine {
  path: string;
  allowance: boolean;
}

interface Group {
  userAgents: string[];
  rules: RuleLine[];
}

function groupAppliesTo(group: Group, userAgent: string): boolean {
  const product = (userAgent.split('/')[0] ?? '').toLowerCase();
  return group.userAgents.some((agent) => agent === '*' || product.includes(agent.toLowerCase()));
}

function groupAllows(group: Group, path: string): boolean {
  for (const rule of group.rules) {
    if (rule.path === '*' || path.startsWith(rule.path)) return rule.allowance;
  }
  return true;
}

/** Parsed robots.txt rules for one site. */
export class _RobotsRules {
  private readonly groups: Group[] = [];
  private defaultGroup: Group | null = null;

  /**
   * @param text - The robots.txt body; empty allows everything.
   */
  constructor(text: string) {
    let group: Group = { userAgents: [], rules: [] };
    // 0: nothing yet; 1: saw User-agent lines; 2: saw rules
    let state = 0;
    const finish = () => {
      if (group.userAgents.includes('*')) {
        if (this.defaultGroup === null) this.defaultGroup = group;
      } else {
        this.groups.push(group);
      }
    };

    for (const rawLine of text.split(/\r\n|\r|\n/)) {
      if (!rawLine) {
        if (state === 1) {
          group = { userAgents: [], rules: [] };
          state = 0;
        } else if (state === 2) {
          finish();
          group = { userAgents: [], rules: [] };
          state = 0;
        }
        continue;
      }
      const hash = rawLine.indexOf('#');
      const line = (hash >= 0 ? rawLine.slice(0, hash) : rawLine).trim();
      if (!line) continue;
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = unquote(line.slice(colon + 1).trim());

      if (key === 'user-agent') {
        if (state === 2) {
          finish();
          group = { userAgents: [], rules: [] };
        }
        group.userAgents.push(value);
        state = 1;
      } else if (key === 'disallow' || key === 'allow') {
        if (state !== 0) {
          const allowance = key === 'allow' || value === '';
          group.rules.push({ path: quote(value), allowance });
          state = 2;
        }
      } else if (key === 'crawl-delay' || key === 'request-rate') {
        // Not used here, but they count as rules when a group ends.
        if (state !== 0) state = 2;
      }
    }
    if (state === 2) finish();
  }

  /** Rules that allow every page. */
  static allowAll(): _RobotsRules {
    return new _RobotsRules('');
  }

  /** Rules that refuse every page. */
  static disallowAll(): _RobotsRules {
    return new _RobotsRules('User-agent: *\nDisallow: /');
  }

  /**
   * Whether `userAgent` may fetch `url`.
   * @param userAgent - The user agent the fetch sends.
   * @param url - The page's URL.
   * @returns True when the rules allow it.
   */
  canFetch(userAgent: string, url: string): boolean {
    // Split as urllib.parse does, without re-encoding: drop the scheme and
    // host, and an empty query or fragment.
    let rest = unquote(url).replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]*/, '');
    const hash = rest.indexOf('#');
    const fragment = hash >= 0 ? rest.slice(hash + 1) : '';
    if (hash >= 0) rest = rest.slice(0, hash);
    const mark = rest.indexOf('?');
    const query = mark >= 0 ? rest.slice(mark + 1) : '';
    if (mark >= 0) rest = rest.slice(0, mark);
    const path =
      quote(`${rest}${query ? `?${query}` : ''}${fragment ? `#${fragment}` : ''}`) || '/';
    for (const group of this.groups) {
      if (groupAppliesTo(group, userAgent)) return groupAllows(group, path);
    }
    return this.defaultGroup ? groupAllows(this.defaultGroup, path) : true;
  }
}
