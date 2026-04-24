#!/usr/bin/env node
/**
 * enumerate-doc-surface.ts — emit a TS-native surface snapshot for doc auditing.
 *
 * Unlike `enumerate-surface.ts` (which translates names to Python snake_case so
 * they can be diffed against `python_surface.json`), this script preserves the
 * original TypeScript camelCase / PascalCase names. The output is consumed by
 * the porting-sdk's `audit_docs.py` to verify that every method call shown in
 * TS docs and examples actually resolves to a real symbol in `src/`.
 *
 * Usage:
 *   npx tsx scripts/enumerate-doc-surface.ts              # write docs_audit_surface.json
 *   npx tsx scripts/enumerate-doc-surface.ts --stdout     # print to stdout
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClassInfo {
  name: string;
  methods: string[];
  extendsName?: string;
}

interface FileSurface {
  classes: ClassInfo[];
  functions: string[];
}

function enumerateFile(file: string): FileSurface {
  const text = fs.readFileSync(file, 'utf-8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);

  const classes: ClassInfo[] = [];
  const functions: string[] = [];

  function collectClass(node: ts.ClassDeclaration, nameOverride?: string): void {
    if (!node.name) return;
    const rawName = nameOverride ?? node.name.text;
    const methods = new Set<string>();
    for (const member of node.members) {
      if (ts.isConstructorDeclaration(member)) continue;
      if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        const mName = member.name.text;
        if (mName.startsWith('_')) continue;
        const mods = ts.getCombinedModifierFlags(member);
        if (mods & ts.ModifierFlags.Private) continue;
        methods.add(mName);
      }
      if ((ts.isGetAccessor(member) || ts.isSetAccessor(member)) && member.name && ts.isIdentifier(member.name)) {
        const mName = member.name.text;
        if (mName.startsWith('_')) continue;
        const mods = ts.getCombinedModifierFlags(member);
        if (mods & ts.ModifierFlags.Private) continue;
        methods.add(mName);
      }
      // Public property declarations (may be called as methods if typed as functions).
      if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        const mName = member.name.text;
        if (mName.startsWith('_')) continue;
        const mods = ts.getCombinedModifierFlags(member);
        if (mods & ts.ModifierFlags.Private) continue;
        methods.add(mName);
      }
    }
    let extendsName: string | undefined;
    if (node.heritageClauses) {
      for (const hc of node.heritageClauses) {
        if (hc.token === ts.SyntaxKind.ExtendsKeyword && hc.types.length > 0) {
          const parent = hc.types[0]!.expression;
          if (ts.isIdentifier(parent)) extendsName = parent.text;
          else if (ts.isPropertyAccessExpression(parent) && ts.isIdentifier(parent.name)) {
            extendsName = parent.name.text;
          }
        }
      }
    }
    classes.push({ name: rawName, methods: Array.from(methods).sort(), extendsName });
  }

  function collectFunction(name: string): void {
    if (name.startsWith('_')) return;
    functions.push(name);
  }

  function isExported(node: ts.Node): boolean {
    const mods = ts.getCombinedModifierFlags(node as ts.Declaration);
    return (mods & ts.ModifierFlags.Export) !== 0;
  }

  function walk(container: ts.Node): void {
    ts.forEachChild(container, (node) => {
      // Include ALL classes (not just exported ones) — doc references may chain
      // through instances whose concrete class isn't exported.
      if (ts.isClassDeclaration(node) && node.name) {
        collectClass(node);
      } else if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        if (isExported(node)) collectFunction(node.name.text);
      } else if (ts.isVariableStatement(node) && isExported(node)) {
        for (const decl of node.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
            collectFunction(decl.name.text);
          }
        }
      } else if (ts.isModuleDeclaration(node) && node.body && ts.isModuleBlock(node.body)) {
        // Handles both:
        //   `export namespace X { class Y {} }` (livewire namespaces)
        //   `declare module './SwmlBuilder.js' { interface SwmlBuilder { ... } }`
        //   (module augmentation used by `SwmlVerbMethods.generated.ts` to
        //   install verb methods on `SwmlBuilder`).
        for (const stmt of node.body.statements) {
          if (ts.isClassDeclaration(stmt) && stmt.name) {
            collectClass(stmt);
          } else if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
            collectFunction(stmt.name.text);
          } else if (ts.isInterfaceDeclaration(stmt) && stmt.name) {
            const augmentedIface: ClassInfo = { name: stmt.name.text, methods: [] };
            for (const member of stmt.members) {
              if (ts.isMethodSignature(member) && member.name && ts.isIdentifier(member.name)) {
                const nm = member.name.text;
                if (!nm.startsWith('_')) augmentedIface.methods.push(nm);
              }
              if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
                const nm = member.name.text;
                if (!nm.startsWith('_')) augmentedIface.methods.push(nm);
              }
            }
            if (augmentedIface.methods.length > 0) classes.push(augmentedIface);
          }
        }
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        // Top-level interfaces contribute to the "callable method" name set.
        const iface: ClassInfo = { name: node.name.text, methods: [] };
        for (const member of node.members) {
          if (ts.isMethodSignature(member) && member.name && ts.isIdentifier(member.name)) {
            const nm = member.name.text;
            if (!nm.startsWith('_')) iface.methods.push(nm);
          }
          if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
            const nm = member.name.text;
            if (!nm.startsWith('_')) iface.methods.push(nm);
          }
        }
        if (iface.methods.length > 0) classes.push(iface);
      }
    });
  }

  walk(sf);
  return { classes, functions };
}

function findSourceFiles(root: string): string[] {
  const out: string[] = [];
  function walkDir(dir: string): void {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
        walkDir(full);
      } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
        out.push(full);
      }
    }
  }
  walkDir(root);
  return out.sort();
}

function getGitSha(repoRoot: string): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'N/A';
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const writeStdout = argv.includes('--stdout');
  const outputArgIdx = argv.indexOf('--output');
  const repoRoot = path.resolve(__dirname, '..');
  const outputPath = outputArgIdx >= 0
    ? path.resolve(argv[outputArgIdx + 1]!)
    : path.join(repoRoot, 'docs_audit_surface.json');

  const srcDir = path.join(repoRoot, 'src');
  const files = findSourceFiles(srcDir);

  interface ModuleEntry {
    classes: Record<string, string[]>;
    functions: string[];
  }
  const modules: Record<string, ModuleEntry> = { 'signalwire': { classes: {}, functions: [] } };

  // Build inheritance map.
  const classByName = new Map<string, { methods: Set<string>; extendsName?: string }>();
  const rawCollected: Array<{ file: string; classes: ClassInfo[]; functions: string[] }> = [];
  for (const abs of files) {
    const fs2 = enumerateFile(abs);
    rawCollected.push({ file: abs, classes: fs2.classes, functions: fs2.functions });
    for (const c of fs2.classes) {
      if (!classByName.has(c.name)) classByName.set(c.name, { methods: new Set() });
      const entry = classByName.get(c.name)!;
      for (const m of c.methods) entry.methods.add(m);
      if (c.extendsName) entry.extendsName = c.extendsName;
    }
  }

  function resolveInherited(name: string, seen = new Set<string>()): Set<string> {
    if (seen.has(name)) return new Set();
    seen.add(name);
    const own = classByName.get(name);
    if (!own) return new Set();
    const out = new Set(own.methods);
    if (own.extendsName) {
      for (const m of resolveInherited(own.extendsName, seen)) out.add(m);
    }
    return out;
  }

  // Emit everything under a single "signalwire" module — this surface is used
  // only for identifier-level resolution (does this method name exist anywhere
  // in the TS source?), so the module tree doesn't matter for auditing.
  const root = modules['signalwire']!;
  const allFunctions = new Set<string>();
  for (const { classes, functions } of rawCollected) {
    for (const c of classes) {
      const all = resolveInherited(c.name);
      const existing = new Set(root.classes[c.name] ?? []);
      for (const m of all) existing.add(m);
      root.classes[c.name] = Array.from(existing).sort();
    }
    for (const f of functions) allFunctions.add(f);
  }
  root.functions = Array.from(allFunctions).sort();

  const snapshot = {
    version: '1',
    generated_from: `signalwire-typescript @ ${getGitSha(repoRoot)}`,
    typescript_version: ts.version,
    note: 'TS-native camelCase surface — used by audit_docs.py to verify doc/example references. NOT a substitute for port_surface.json (which is Python-translated for Layer B diffing).',
    modules,
  };

  const rendered = JSON.stringify(snapshot, null, 2) + '\n';
  if (writeStdout) {
    process.stdout.write(rendered);
  } else {
    fs.writeFileSync(outputPath, rendered, 'utf-8');
    process.stderr.write(`wrote ${outputPath}\n`);
  }
}

main();
