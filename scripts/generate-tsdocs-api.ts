/**
 * generate-tsdocs-api.ts — build the API index that `sw-tsdocs api` reads.
 *
 * `sw-tsdocs api <name>` prints a name's signature, JSDoc, source location
 * and members. An installed package has no TypeScript source and no
 * `typescript` dependency, so the answers are read ahead of time: after `tsc`
 * emits `dist/`, this script walks the public entry point's declarations
 * (`dist/index.d.ts`, the same files an editor reads) with the TypeScript
 * compiler API and writes `dist/cli/tsdocs/api-index.json`. Each location
 * points at the shipped `.d.ts`, whose JSDoc is what the entry quotes.
 *
 * Run by `npm run build` (postbuild). Usage:
 *
 *   npx tsx scripts/generate-tsdocs-api.ts            # dist/index.d.ts → dist/cli/tsdocs/api-index.json
 *   npx tsx scripts/generate-tsdocs-api.ts --check    # exit 1 if the written index is stale
 *
 * `buildApiIndex()` also runs over `src/index.ts`; the tests use that, so
 * they don't depend on a fresh build.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type {
  ApiEntry,
  ApiIndex,
  ApiKind,
  ApiMember,
  ApiMemberKind,
} from '../src/cli/tsdocs/apiTypes.js';

/** The longest signature text kept for a type alias or enum, in lines. */
const MAX_DECLARATION_LINES = 40;

function cleanJsDoc(raw: string): string {
  const body = raw
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, '').replace(/\s+$/, ''));
  if (body[0] !== undefined) body[0] = body[0].trimStart();
  while (body.length && !body[0]!.trim()) body.shift();
  while (body.length && !body[body.length - 1]!.trim()) body.pop();
  return body.join('\n');
}

/** The JSDoc written directly above `node`, cleaned of comment markers. */
function jsDocOf(node: ts.Node): string {
  // Variable declarations carry their JSDoc on the statement
  const target =
    ts.isVariableDeclaration(node) && ts.isVariableStatement(node.parent.parent)
      ? node.parent.parent
      : node;
  const docs = ts.getJSDocCommentsAndTags(target).filter(ts.isJSDoc);
  const last = docs[docs.length - 1];
  if (!last) return '';
  return cleanJsDoc(last.getSourceFile().text.slice(last.getStart(), last.end));
}

function dedent(text: string): string {
  const lines = text.split('\n');
  const indents = lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => line.length - line.trimStart().length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return [lines[0]!, ...lines.slice(1).map((line) => line.slice(Math.min(cut, line.length)))].join(
    '\n',
  );
}

const MODIFIER_NOISE = /^(?:export\s+|declare\s+|default\s+)+/;

/** A declaration's text as an editor shows it: no body, no initializer, no `export declare`. */
function declarationText(node: ts.Node): string {
  const sf = node.getSourceFile();
  const start = node.getStart(sf);
  let end = node.end;
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)) &&
    node.body
  ) {
    end = node.body.getStart(sf);
  } else if (
    (ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node)) &&
    node.initializer
  ) {
    // Source mode only: `.d.ts` files carry types, not initializers
    end = node.initializer.getFullStart();
    const eq = sf.text.lastIndexOf('=', end);
    if (eq > start) end = eq;
  } else if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
    end = sf.text.indexOf('{', node.name ? node.name.end : start);
  }
  let text = sf.text.slice(start, end).trim().replace(/;$/, '').trim();
  text = dedent(text).replace(MODIFIER_NOISE, '');
  if (ts.isVariableDeclaration(node)) {
    const list = node.parent;
    const keyword = list.flags & ts.NodeFlags.Const ? 'const' : 'let';
    text = `${keyword} ${text}`;
  }
  const lines = text.split('\n');
  if (lines.length > MAX_DECLARATION_LINES) {
    text = [...lines.slice(0, MAX_DECLARATION_LINES), '  // ...'].join('\n');
  }
  return text;
}

function lineOf(node: ts.Node): number {
  const sf = node.getSourceFile();
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
}

function memberName(node: ts.ClassElement | ts.TypeElement): string | null {
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (ts.isCallSignatureDeclaration(node)) return '(call)';
  if (ts.isConstructSignatureDeclaration(node)) return 'new';
  const name = node.name;
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null; // computed or private (#x) names
}

function memberKind(node: ts.Node): ApiMemberKind | null {
  if (ts.isConstructorDeclaration(node) || ts.isConstructSignatureDeclaration(node)) {
    return 'constructor';
  }
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) return 'method';
  if (ts.isCallSignatureDeclaration(node)) return 'method';
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) return 'property';
  if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) return 'accessor';
  return null;
}

/**
 * Read the public API reachable from `entryFiles`' exports.
 *
 * @param root - The package root; entry locations are relative to it.
 * @param entryFiles - The entry points, such as `dist/index.d.ts`.
 * @param version - The package version the index describes.
 */
export function buildApiIndex(root: string, entryFiles: string[], version: string): ApiIndex {
  const program = ts.createProgram(
    entryFiles.map((f) => resolve(root, f)),
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      resolveJsonModule: true,
      skipLibCheck: true,
      noEmit: true,
      strict: true,
      types: [],
    },
  );
  const checker = program.getTypeChecker();
  const entries: Record<string, ApiEntry> = {};
  // Declarations already recorded, so a class reached twice keeps one key
  const keyOf = new Map<ts.Symbol, string>();

  const rel = (node: ts.Node): string =>
    relative(root, node.getSourceFile().fileName).split('\\').join('/');

  const resolveAlias = (symbol: ts.Symbol): ts.Symbol =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

  const kindOf = (symbol: ts.Symbol): ApiKind | null => {
    const f = symbol.flags;
    if (f & ts.SymbolFlags.Class) return 'class';
    if (f & ts.SymbolFlags.Interface) return 'interface';
    if (f & ts.SymbolFlags.Enum) return 'enum';
    if (f & ts.SymbolFlags.Function) return 'function';
    if (f & ts.SymbolFlags.TypeAlias) return 'type';
    if (f & ts.SymbolFlags.Variable) return 'variable';
    if (f & (ts.SymbolFlags.ValueModule | ts.SymbolFlags.NamespaceModule)) return 'namespace';
    return null;
  };

  const heritageOf = (decl: ts.ClassDeclaration | ts.InterfaceDeclaration): ts.Symbol[] => {
    const bases: ts.Symbol[] = [];
    for (const clause of decl.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
      for (const type of clause.types) {
        const symbol = checker.getSymbolAtLocation(type.expression);
        if (symbol) bases.push(resolveAlias(symbol));
      }
    }
    return bases;
  };

  const membersOf = (
    decl: ts.ClassDeclaration | ts.InterfaceDeclaration,
    owner: string,
  ): ApiMember[] => {
    const found: ApiMember[] = [];
    const elements: readonly (ts.ClassElement | ts.TypeElement)[] = decl.members;
    for (const element of elements) {
      const name = memberName(element);
      const kind = memberKind(element);
      if (!name || !kind) continue;
      if (hasModifier(element, ts.SyntaxKind.PrivateKeyword)) continue;
      if (name.startsWith('_')) continue;
      const isStatic = hasModifier(element, ts.SyntaxKind.StaticKeyword);
      // In source, an overloaded method's implementation repeats its
      // overloads; keep the overloads (as a .d.ts does)
      const hasBody =
        (ts.isMethodDeclaration(element) || ts.isConstructorDeclaration(element)) &&
        element.body !== undefined;
      const id = `${isStatic ? 'static ' : ''}${name}`;
      const existing = found.find((m) => `${m.static ? 'static ' : ''}${m.name}` === id);
      if (existing) {
        if (hasBody && existing.signature.length) continue;
        existing.signature.push(declarationText(element));
        if (!existing.doc) existing.doc = jsDocOf(element);
        continue;
      }
      found.push({
        name,
        kind,
        owner,
        static: isStatic || undefined,
        protected: hasModifier(element, ts.SyntaxKind.ProtectedKeyword) || undefined,
        readonly: hasModifier(element, ts.SyntaxKind.ReadonlyKeyword) || undefined,
        signature: [declarationText(element)],
        doc: jsDocOf(element),
        file: rel(element),
        line: lineOf(element),
      });
    }
    return found;
  };

  const record = (key: string, symbol: ts.Symbol, exported: boolean): string | null => {
    const known = keyOf.get(symbol);
    if (known) {
      if (exported && entries[known]) entries[known]!.exported = true;
      return known;
    }
    const kind = kindOf(symbol);
    const decls = symbol.declarations ?? [];
    const first = decls[0];
    if (!kind || !first) return null;
    if (entries[key]) key = `${key} (${rel(first)})`;
    keyOf.set(symbol, key);

    const entry: ApiEntry = {
      name: key,
      kind,
      exported,
      signature: [],
      doc: '',
      file: rel(first),
      line: lineOf(first),
    };
    entries[key] = entry;

    if (kind === 'class' || kind === 'interface') {
      const shaped = decls.filter(
        (d): d is ts.ClassDeclaration | ts.InterfaceDeclaration =>
          ts.isClassDeclaration(d) || ts.isInterfaceDeclaration(d),
      );
      const main = shaped.find((d) => ts.isClassDeclaration(d)) ?? shaped[0];
      if (main) {
        entry.file = rel(main);
        entry.line = lineOf(main);
        entry.signature = [declarationText(main)];
        entry.doc = jsDocOf(main);
      }
      const members: ApiMember[] = [];
      const bases: string[] = [];
      for (const decl of shaped) {
        for (const member of membersOf(decl, key)) {
          if (!members.some((m) => m.name === member.name && m.static === member.static)) {
            members.push(member);
          }
        }
        for (const base of heritageOf(decl)) {
          const baseKey = record(base.getName(), base, false);
          if (baseKey && !bases.includes(baseKey)) bases.push(baseKey);
        }
        if (!entry.doc) entry.doc = jsDocOf(decl);
      }
      entry.members = members;
      if (bases.length) entry.bases = bases;
    } else if (kind === 'namespace') {
      entry.signature = [`namespace ${key}`];
      if (ts.isSourceFile(first)) {
        // `export * as name from './module.js'`: the module's header comment
        const header = (ts.getLeadingCommentRanges(first.text, 0) ?? []).find((range) =>
          first.text.startsWith('/**', range.pos),
        );
        entry.doc = header ? cleanJsDoc(first.text.slice(header.pos, header.end)) : '';
        entry.line = 1;
      }
      const contents: string[] = [];
      for (const member of checker.getExportsOfModule(symbol)) {
        const target = resolveAlias(member);
        const memberKey = record(`${key}.${member.getName()}`, target, true);
        if (memberKey) contents.push(memberKey);
      }
      entry.contents = contents;
    } else {
      entry.signature = decls
        .filter((d) => !(ts.isFunctionDeclaration(d) && d.body && decls.length > 1))
        .map(declarationText);
      entry.doc = decls.map(jsDocOf).find(Boolean) ?? '';
    }
    return key;
  };

  const exportedNames: string[] = [];
  for (const file of entryFiles) {
    const sf = program.getSourceFile(resolve(root, file));
    const moduleSymbol = sf && checker.getSymbolAtLocation(sf);
    if (!moduleSymbol) throw new Error(`Can't read the exports of ${file}`);
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      const key = record(symbol.getName(), resolveAlias(symbol), true);
      if (key && !exportedNames.includes(key)) exportedNames.push(key);
    }
  }
  const sorted: Record<string, ApiEntry> = {};
  for (const key of Object.keys(entries).sort()) sorted[key] = entries[key]!;
  return { version, exports: exportedNames.sort(), entries: sorted };
}

/** Where `npm run build` writes the index, relative to the package root. */
export const API_INDEX_PATH = 'dist/cli/tsdocs/api-index.json';

function main(): number {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const check = process.argv.includes('--check');
  const entry = 'dist/index.d.ts';
  if (!existsSync(join(root, entry))) {
    console.error(`${entry} doesn't exist; run tsc first.`);
    return 1;
  }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as { version: string };
  const index = buildApiIndex(root, [entry], pkg.version);
  const text = JSON.stringify(index) + '\n';
  const out = join(root, API_INDEX_PATH);
  if (check) {
    const current = existsSync(out) ? readFileSync(out, 'utf-8') : '';
    if (current !== text) {
      console.error(`${API_INDEX_PATH} is stale; run npm run build.`);
      return 1;
    }
    return 0;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(
    `Wrote ${API_INDEX_PATH}: ${Object.keys(index.entries).length} names, ${text.length} bytes`,
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
