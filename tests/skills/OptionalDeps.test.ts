/**
 * The SDK must import with only its `dependencies` installed.
 *
 * `npm install --omit=optional` leaves out cheerio, and undici with it, so a
 * static import of either anywhere `src/index.ts` reaches breaks importing the
 * whole SDK. Optional packages load with `import()` where they're used.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
  dependencies?: Record<string, string>;
};
const deps = new Set(Object.keys(pkg.dependencies ?? {}));
const builtins = new Set(builtinModules);

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...tsFiles(path));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

/** The package a bare module specifier names (`@scope/name` or `name`). */
function packageOf(spec: string): string {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
}

describe('optional dependencies', () => {
  it('no source file statically imports a package outside dependencies', () => {
    const offenders: string[] = [];
    for (const file of tsFiles(SRC)) {
      const sf = ts.createSourceFile(file, readFileSync(file, 'utf-8'), ts.ScriptTarget.ES2022);
      for (const statement of sf.statements) {
        if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
        const spec = (statement.moduleSpecifier as ts.StringLiteral).text;
        if (spec.startsWith('.') || spec.startsWith('node:') || builtins.has(spec)) continue;
        // The package's own name, used only by doc templates under src/cli.
        if (spec.startsWith('@signalwire/sdk')) continue;
        if (!deps.has(packageOf(spec)))
          offenders.push(`${file.slice(ROOT.length)} imports ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  describe('mcp_gateway without undici', () => {
    afterEach(() => {
      vi.doUnmock('undici');
      vi.resetModules();
      vi.restoreAllMocks();
    });

    /** Load mcp_gateway with `import('undici')` failing, as with optional packages omitted. */
    async function loadWithoutUndici() {
      vi.resetModules();
      vi.doMock('undici', () => {
        throw new Error("Cannot find package 'undici'");
      });
      const SecurityUtils = await import('../../src/SecurityUtils.js');
      vi.spyOn(SecurityUtils, 'validateUrl').mockResolvedValue(true);
      const { McpGatewaySkill } = await import('../../src/skills/builtin/mcp_gateway.js');
      return (config: Record<string, unknown>) => {
        const skill = new McpGatewaySkill({
          gateway_url: 'https://gateway.example.com',
          auth_token: 'abc',
          services: [{ name: 'svc' }],
          ...config,
        });
        // A healthy gateway with no tools, without the network.
        vi.spyOn(
          skill as unknown as { _makeRequest: () => Promise<Response> },
          '_makeRequest',
        ).mockImplementation(async () => new Response('{"tools":[]}', { status: 200 }));
        return skill;
      };
    }

    it('loads, and sets up with TLS verification on', async () => {
      const make = await loadWithoutUndici();
      const skill = make({});
      expect(await skill.validatePackages()).toEqual([]);
      expect(await skill.setup()).toBe(true);
    });

    it('fails setup, instead of crashing, when allow_insecure_tls needs undici', async () => {
      const make = await loadWithoutUndici();
      const skill = make({ verify_ssl: false, allow_insecure_tls: true });
      expect(await skill.setup()).toBe(false);
    });
  });
});
