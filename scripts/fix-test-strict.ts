#!/usr/bin/env node
/**
 * fix-test-strict.ts — AST codemod that burns down the `noUncheckedIndexedAccess`
 * "possibly undefined" errors (TS2532 / TS18048) in the test suite by inserting a
 * non-null assertion (`!`) at the exact expression the compiler flagged.
 *
 * It is DIAGNOSTIC-DRIVEN (not regex): it type-checks the tests, and for every
 * TS2532/TS18048 whose error node is an ElementAccess / PropertyAccess / Identifier
 * base, it appends `!` right after that base expression. Because it edits from the
 * end of each file backwards, earlier offsets stay valid. Idempotent-ish: a base
 * already ending in `!` is skipped.
 *
 * Usage: npx tsx scripts/fix-test-strict.ts [--dry]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

// Build a program over src + tests with the strict test config's shape.
const configPath = path.join(REPO_ROOT, 'tsconfig.json');
const base = ts.readConfigFile(configPath, ts.sys.readFile).config;
const parsed = ts.parseJsonConfigFileContent(
  {
    ...base,
    compilerOptions: { ...base.compilerOptions, noEmit: true, declaration: false, rootDir: '.' },
    include: ['src/**/*', 'tests/**/*'],
    exclude: ['node_modules', 'dist'],
  },
  ts.sys,
  REPO_ROOT,
);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diags = program.getSemanticDiagnostics();

const CODES = new Set([2532, 18048]); // "possibly undefined"

// file -> sorted set of insertion offsets (end of the flagged base expression)
const inserts = new Map<string, Set<number>>();

for (const d of diags) {
  if (!CODES.has(d.code) || !d.file || d.start === undefined || d.length === undefined) continue;
  const file = d.file.fileName;
  if (!file.includes('/tests/')) continue; // only fix test files
  // The diagnostic SPAN (start..start+length) covers the possibly-undefined expression
  // itself (e.g. `tools[0]` in `tools[0].name`). Find the node whose extent matches the
  // span, then append `!` at ITS end — so `tools[0]` → `tools[0]!`, not `tools!`.
  const node = findNodeSpanning(d.file, d.start, d.start + d.length);
  if (!node) continue;
  if (!isAssertable(node)) continue;
  const end = node.getEnd();
  if (d.file.text[end] === '!') continue; // already asserted
  if (!inserts.has(file)) inserts.set(file, new Set());
  inserts.get(file)!.add(end);
}

/** The deepest node whose [start,end) exactly equals the diagnostic span. Falls back
 * to the smallest node that fully contains the span. */
function findNodeSpanning(sf: ts.SourceFile, start: number, end: number): ts.Node | undefined {
  let exact: ts.Node | undefined;
  let container: ts.Node | undefined;
  const visit = (n: ts.Node): void => {
    const ns = n.getStart(sf);
    const ne = n.getEnd();
    if (ns === start && ne === end) {
      if (!exact || n.getWidth(sf) < exact.getWidth(sf)) exact = n;
    }
    if (ns <= start && end <= ne) {
      if (!container || n.getWidth(sf) < container.getWidth(sf)) container = n;
      n.forEachChild(visit);
    }
  };
  visit(sf);
  return exact ?? container;
}

/** Only append `!` to a value expression where it's syntactically valid and meaningful. */
function isAssertable(node: ts.Node): boolean {
  return (
    ts.isElementAccessExpression(node) ||
    ts.isPropertyAccessExpression(node) ||
    ts.isIdentifier(node) ||
    ts.isCallExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isNonNullExpression(node)
  );
}

let totalEdits = 0;
for (const [file, offsets] of inserts) {
  let text = fs.readFileSync(file, 'utf-8');
  const sorted = [...offsets].sort((a, b) => b - a); // descending: edit tail-first
  for (const off of sorted) {
    text = text.slice(0, off) + '!' + text.slice(off);
    totalEdits += 1;
  }
  if (!DRY) fs.writeFileSync(file, text);
}

console.log(
  `${DRY ? '[dry] would insert' : 'inserted'} ${totalEdits} non-null assertion(s) across ${inserts.size} test file(s)`,
);
