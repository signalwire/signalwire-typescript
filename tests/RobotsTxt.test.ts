/**
 * _RobotsRules against Python's urllib.robotparser. The spider skill in each
 * SDK must allow and refuse the same pages for the same robots.txt; the
 * fixture's answers were produced by `RobotFileParser.can_fetch` (regenerate
 * with the script in the commit that added it).
 */

import { readFileSync } from 'node:fs';
import { _RobotsRules } from '../src/RobotsTxt.js';

const oracle = JSON.parse(
  readFileSync(new URL('./fixtures/robots_oracle.json', import.meta.url), 'utf8'),
) as { robots: Record<string, string>; cases: [string, string, string, boolean][] };

describe('_RobotsRules', () => {
  it.each(oracle.cases)('%s: %s fetching %s -> %s', (name, userAgent, url, expected) => {
    expect(new _RobotsRules(oracle.robots[name]!).canFetch(userAgent, url)).toBe(expected);
  });

  it('allows and refuses everything with the fixed rule sets', () => {
    expect(_RobotsRules.allowAll().canFetch('Spider/1.0', 'http://h/anything')).toBe(true);
    expect(_RobotsRules.disallowAll().canFetch('Spider/1.0', 'http://h/')).toBe(false);
  });
});
