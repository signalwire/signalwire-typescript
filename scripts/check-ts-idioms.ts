/**
 * check-ts-idioms.ts — the TS-idiom guard run by run-ci's LINT gate.
 *
 * A small set of explicit text checks (NOT a full ESLint AST plugin) for the
 * conventions that the type system can't enforce on its own but that we've
 * decided are load-bearing. Each is grep-precise, trivially auditable, and was
 * added after a real regression slipped past:
 *
 *   1. Typed callback params must not be WIDENED in an override
 *      (onSummary's rawData must stay PostPromptData, not Record/any/unknown) —
 *      widening drops the contract and hid a real `rawData['call_id']` bug.
 *   2. Generated *.types.generated.ts may carry the open `[key:string]:unknown`
 *      tail ONLY on a top-level declared type, never on a NESTED inline object —
 *      a nested index signature silently swallows typos in known fields.
 *   3. Example DEMOS must not carry dead defensive casts
 *      (`(x as Record<string,unknown>)['k']`) — the typed APIs made them
 *      unnecessary, and examples are copied by users.
 *   4. An example `safe(...)` error-wrapper must be generic (`safe<T>`), so the
 *      wrapped call's result type survives to the call site.
 *
 * Run: `npx tsx scripts/check-ts-idioms.ts` (wired into run-ci's LINT gate).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const violations: string[] = [];

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

const SRC_AND_EXAMPLES = ['src', 'examples', 'rest/examples', 'relay/examples'];
const EXAMPLE_DIRS = ['examples', 'rest/examples', 'relay/examples'];

// ── Check 1: typed SDK callback params not widened ─────────────────────────
interface CallbackRule {
  what: string;
  open: RegExp;
  required: string;
  param: RegExp;
}
// Loose forms that signal the contract was dropped. Anchored on the param
// terminator so `Record<string, unknown>` (with its `>`,`,` tail) matches.
const WIDENED = /:\s*(Record<string,\s*unknown>|any|unknown)\s*[,)]?\s*$/;
const CALLBACK_RULES: CallbackRule[] = [
  {
    what: 'onSummary(rawData) must be PostPromptData',
    open: /\bonSummary\s*\(/,
    required: 'PostPromptData',
    param: /\b_?rawData\s*:/,
  },
];

function checkCallbackWidening(): void {
  for (const root of SRC_AND_EXAMPLES) {
    for (const file of listTsFiles(root)) {
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (const rule of CALLBACK_RULES) {
          if (!rule.open.test(lines[i])) continue;
          for (let j = i; j < Math.min(i + 6, lines.length); j++) {
            if (!rule.param.test(lines[j])) continue;
            if (WIDENED.test(lines[j]) && !lines[j].includes(rule.required)) {
              violations.push(
                `${file}:${j + 1}: typed callback widened — ${rule.what}. found: ${lines[j].trim()}\n` +
                  `      Use the SDK contract type (PostPromptData/SwmlRequestData/SwaigRequestData), not Record/any/unknown.`,
              );
            }
            break;
          }
        }
      }
    }
  }
}

// ── Check 2: generated nested objects must be closed ───────────────────────
// The open `[key: string]: unknown` tail belongs ONLY on a top-level declared
// type (forward-compat for a new server field). On a NESTED inline object it
// silently accepts typos in known fields. A generated index signature is
// "nested" when its line is indented deeper than a top-level member (the
// top-level one sits at exactly one indent inside `export interface X { … }`).
function checkGeneratedIndexSig(): void {
  for (const file of listTsFiles('src')) {
    if (!file.endsWith('.types.generated.ts') && !file.endsWith('.generated.ts')) continue;
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = /^(\s*)\[key: string\]: unknown;/.exec(lines[i]);
      if (!m) continue;
      // Top-level members of `export interface X {` are indented exactly 2
      // spaces; a deeper indent means the index sig is on a nested inline object.
      if (m[1].length > 2) {
        violations.push(
          `${file}:${i + 1}: nested open index signature — close nested generated objects ` +
            `(open \`[key: string]: unknown\` only at top level). Fix the generator (objectBody topLevel guard).`,
        );
      }
    }
  }
}

// ── Check 3: no dead defensive casts in example DEMOS ──────────────────────
// `(x as Record<string, unknown>)['k']` / `(x as Type)['k']` — a cast-then-index
// the now-correct types made unnecessary. Skipped in *_audit_harness.ts (those
// legitimately walk dynamic JSON by string path).
const DEAD_CAST = /\bas\s+(Record<string,\s*unknown>|[A-Z][\w.]*)\s*\)\s*\??\.?\[/;
function checkDeadCasts(): void {
  for (const root of EXAMPLE_DIRS) {
    for (const file of listTsFiles(root)) {
      if (file.includes('audit_harness')) continue;
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (DEAD_CAST.test(lines[i])) {
          violations.push(
            `${file}:${i + 1}: dead defensive cast — read the typed field directly (x.k), not (x as …)['k']. found: ${lines[i].trim()}`,
          );
        }
      }
    }
  }
}

// ── Check 4: example `safe()` wrappers must be generic ─────────────────────
// `async function safe(label…, fn: () => Promise<…>): Promise<…>` that is NOT
// `safe<T>` loses the wrapped call's result type at the call site.
function checkGenericSafe(): void {
  for (const root of EXAMPLE_DIRS) {
    for (const file of listTsFiles(root)) {
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        // a `safe` wrapper declaration that is not generic
        if (
          /\b(async\s+)?function safe\s*\(/.test(lines[i]) &&
          !/function safe\s*</.test(lines[i])
        ) {
          violations.push(
            `${file}:${i + 1}: non-generic safe() wrapper — make it \`safe<T>(label, fn: () => Promise<T>): Promise<T | null>\` so results keep their type. found: ${lines[i].trim()}`,
          );
        }
      }
    }
  }
}

checkCallbackWidening();
checkGeneratedIndexSig();
checkDeadCasts();
checkGenericSafe();

if (violations.length) {
  console.error(`check-ts-idioms: ${violations.length} violation(s):`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log('check-ts-idioms: all TS-idiom checks passed.');
