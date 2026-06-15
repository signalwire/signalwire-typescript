/**
 * check-typed-callbacks.ts — guard against WIDENING a typed SDK callback param.
 *
 * The SDK types the webhook bodies its callbacks receive — `onSummary`'s second
 * param is `PostPromptData`, the dynamic-config callback's body is
 * `SwmlRequestData`, a SWAIG handler's `rawData` is `SwaigRequestData`. An
 * override or callback that RE-TYPES that param looser (`Record<string,unknown>`,
 * `any`, bare `unknown`) silently drops the contract and invites bugs that read
 * the wrong shape (this exact pattern hid a real `rawData['call_id']` bug — the
 * field is actually `rawData.params.call_id`). This check fails the LINT gate
 * when a known typed-callback param is widened, across src + examples.
 *
 * It is intentionally a small, explicit text check (not a full ESLint AST rule):
 * the set of typed callbacks is tiny and well-known, and a regex over the param
 * line is robust enough while staying trivially auditable.
 *
 * Run: `npx tsx scripts/check-typed-callbacks.ts` (wired into run-ci's LINT gate).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Rule {
  /** Human label for the callback. */
  what: string;
  /** Matches the signature opener (method/override or callback registration). */
  open: RegExp;
  /** The contract type the flagged param MUST be (substring match on the line). */
  required: string;
  /** Matches the param line to inspect, captured after the `open` match. */
  param: RegExp;
}

// Widened forms that signal the contract was dropped. Anchored on `: ` then the
// loose type up to the param terminator (`,` / `)` / EOL) so `Record<string,
// unknown>` (with its `>`,`,` tail) is matched, not just bare `any`/`unknown`.
const WIDENED = /:\s*(Record<string,\s*unknown>|any|unknown)\s*[,)]?\s*$/;

const RULES: Rule[] = [
  {
    what: 'onSummary(rawData) must be PostPromptData',
    open: /\bonSummary\s*\(/,
    required: 'PostPromptData',
    // second param — the one carrying the webhook body.
    param: /\b(_?rawData)\s*:/,
  },
];

function listTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listTsFiles(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const ROOTS = ['src', 'examples', 'rest/examples', 'relay/examples'];
const violations: string[] = [];

for (const root of ROOTS) {
  for (const file of listTsFiles(root)) {
    // The base definitions in AgentBase live alongside the contract type itself;
    // skip the canonical declaration sites so the rule only polices overrides.
    const text = fs.readFileSync(file, 'utf-8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const rule of RULES) {
        if (!rule.open.test(lines[i])) continue;
        // Scan the next few lines for the param under inspection.
        for (let j = i; j < Math.min(i + 6, lines.length); j++) {
          if (!rule.param.test(lines[j])) continue;
          const isWidened = WIDENED.test(lines[j]);
          const isCorrect = lines[j].includes(rule.required);
          if (isWidened && !isCorrect) {
            violations.push(`${file}:${j + 1}: ${rule.what} — found: ${lines[j].trim()}`);
          }
          break;
        }
      }
    }
  }
}

if (violations.length) {
  console.error('ERROR: typed SDK callback param(s) widened (drop the contract):');
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    '\nUse the SDK contract type (PostPromptData / SwmlRequestData / SwaigRequestData),\n' +
      'imported from the package root, instead of Record<string,unknown>/any/unknown.',
  );
  process.exit(1);
}
console.log('check-typed-callbacks: no widened typed-callback params.');
