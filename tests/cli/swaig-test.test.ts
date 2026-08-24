import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentBase } from '../../src/AgentBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';

const CLI = fileURLToPath(new URL('../../src/cli/swaig-test.ts', import.meta.url));

/**
 * Run the swaig-test CLI via tsx as a subprocess; resolves with code+output.
 *
 * Invokes the current `node` binary with tsx's loader (`--import tsx`) rather
 * than `npx tsx`. `execFile` runs WITHOUT a shell, so a bare `'npx'` cannot be
 * spawned on Windows (the launcher there is `npx.cmd`, not `npx`) — the spawn
 * fails, stdout comes back empty, and the error maps to a spurious exit code.
 * Going through `process.execPath` sidesteps `.cmd` resolution entirely and is
 * robust on Linux, macOS, and Windows alike.
 */
function runCli(args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', CLI, ...args],
      { timeout: 60_000, env: { ...process.env, SIGNALWIRE_LOG_MODE: 'off' } },
      (err, stdout, stderr) => {
        const code =
          err && typeof (err as NodeJS.ErrnoException & { code?: number }).code === 'number'
            ? ((err as unknown as { code: number }).code ?? 1)
            : err
              ? 1
              : 0;
        resolve({ code, out: `${stdout}\n${stderr}` });
      },
    );
  });
}

/** Write a throwaway agent .ts file exporting a default AgentBase. */
function writeAgentFile(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'swaig-cli-'));
  const path = join(dir, 'agent.ts');
  // Embed the AgentBase import as a `file://` URL, NOT a filesystem path. On
  // Windows `fileURLToPath` yields backslashes (`C:\...\src\AgentBase.ts`);
  // baked into a single-quoted TS string literal, `\a`/`\s`/`\A`... collapse as
  // escape sequences and the specifier is corrupted, so the generated agent
  // fails to import AgentBase. An ESM `file:///...` URL uses forward slashes and
  // imports correctly on every platform.
  const agentBaseUrl = new URL('../../src/AgentBase.ts', import.meta.url).href;
  writeFileSync(
    path,
    [
      "import { AgentBase } from '" + agentBaseUrl + "';",
      "const agent = new AgentBase({ name: 'probe', route: '/' });",
      "agent.setPromptText('hi');",
      'export default agent;',
    ].join('\n'),
  );
  return { path, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('swaig-test CLI contract (subprocess)', () => {
  it('rejects an unknown --simulate-serverless platform with a descriptive error', async () => {
    const { path, cleanup } = writeAgentFile();
    try {
      const { code, out } = await runCli([path, '--simulate-serverless', 'bogus-platform-xyz']);
      expect(code).not.toBe(0);
      expect(out).toContain('bogus-platform-xyz');
      expect(out.toLowerCase()).toContain('unknown platform');
      // Must NOT silently fall through to a serverless simulation render.
      expect(out).not.toContain('Serverless Simulation');
    } finally {
      cleanup();
    }
  }, 70_000);

  it('accepts a real platform (gcf) — proves the validator is not over-strict', async () => {
    const { path, cleanup } = writeAgentFile();
    try {
      const { code, out } = await runCli([path, '--simulate-serverless', 'gcf', '--raw']);
      // gcf is implemented; it must NOT be rejected as unknown.
      expect(out).not.toContain('unknown platform');
      expect(code).toBe(0);
    } finally {
      cleanup();
    }
  }, 70_000);

  it('--parse-only validates args, prints "parse OK", loads no agent, hits no network', async () => {
    // A bogus, unreachable --url would hang/fail if the agent were loaded or a
    // request were made; parse-only must return instantly with just "parse OK".
    const { code, out } = await runCli([
      'examples/does-not-exist.ts',
      '--list-tools',
      '--parse-only',
    ]);
    expect(code).toBe(0);
    expect(out).toContain('parse OK');
    // Never touches the world: no agent load, no SWML, no tool listing.
    expect(out).not.toContain('SWML Document');
    expect(out).not.toContain('Registered tools');
  }, 70_000);

  it('--dry-run is an exact alias for --parse-only', async () => {
    const { code, out } = await runCli(['examples/does-not-exist.ts', '--dump-swml', '--dry-run']);
    expect(code).toBe(0);
    expect(out).toContain('parse OK');
    expect(out).not.toContain('SWML Document');
  }, 70_000);

  it('--parse-only is position-independent, honored even trailing an --exec', async () => {
    // --exec consumes the following token as the function name; a trailing
    // --parse-only must still be recognized (stripped before the exec parser).
    const { code, out } = await runCli([
      '--parse-only',
      '--exec',
      'foo',
      '--arg',
      'bar=1',
      'examples/does-not-exist.ts',
    ]);
    expect(code).toBe(0);
    expect(out).toContain('parse OK');
  }, 70_000);

  it('--parse-only rejects an invalid invocation (exit non-zero, no "parse OK")', async () => {
    // Unknown flag is a genuine argument error; parse-only must NOT paper over it.
    const { code, out } = await runCli([
      'examples/does-not-exist.ts',
      '--parse-only',
      '--no-such-flag',
    ]);
    expect(code).not.toBe(0);
    expect(out).not.toContain('parse OK');
  }, 70_000);

  it('errors when a target is given but no action flag (no silent dump-swml)', async () => {
    const { path, cleanup } = writeAgentFile();
    try {
      const { code, out } = await runCli([path]);
      expect(code).not.toBe(0);
      expect(out).toContain('--dump-swml');
      expect(out).toContain('--list-tools');
      expect(out).toContain('--exec');
      // The old behavior dumped a SWML document; ensure it no longer does.
      expect(out).not.toContain('SWML Document');
    } finally {
      cleanup();
    }
  }, 70_000);
});

describe('agent introspection', () => {
  function createAgent() {
    const agent = new AgentBase({ name: 'test-agent', route: '/test' });
    agent.setPromptText('Hello from test agent');
    agent.defineTool({
      name: 'greet',
      description: 'Say hello',
      parameters: { name: { type: 'string', description: 'Name' } },
      handler: (args) => new FunctionResult('Hello ' + (args['name'] || 'world')),
    });
    agent.defineTool({
      name: 'get_time',
      description: 'Get current time',
      parameters: {},
      handler: () => new FunctionResult('12:00 PM'),
    });
    return agent;
  }

  it('getRegisteredTools returns all tool info', () => {
    const agent = createAgent();
    const tools = agent.getRegisteredTools();
    expect(tools).toHaveLength(2);
    expect(tools[0]!.name).toBe('greet');
    expect(tools[0]!.description).toBe('Say hello');
    expect(tools[0]!.parameters).toHaveProperty('name');
    expect(tools[1]!.name).toBe('get_time');
  });

  it('getRegisteredTools returns empty for no tools', () => {
    const agent = new AgentBase({ name: 'empty', route: '/test' });
    expect(agent.getRegisteredTools()).toHaveLength(0);
  });

  it('getTool returns a specific SwaigFunction', () => {
    const agent = createAgent();
    const tool = agent.getTool('greet');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('greet');
    expect(tool!.description).toBe('Say hello');
  });

  it('getTool returns undefined for missing tool', () => {
    const agent = createAgent();
    expect(agent.getTool('nonexistent')).toBeUndefined();
  });

  it('can execute tool via getTool', async () => {
    const agent = createAgent();
    const tool = agent.getTool('greet')!;
    const result = await tool.execute({ name: 'Alice' }, {});
    expect(result.response).toBe('Hello Alice');
  });

  it('can execute tool with no args', async () => {
    const agent = createAgent();
    const tool = agent.getTool('get_time')!;
    const result = await tool.execute({}, {});
    expect(result.response).toBe('12:00 PM');
  });

  it('renderSwml produces valid SWML with tools', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call-id');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
    const ai = parsed.sections.main[1].ai;
    expect(ai.SWAIG.functions).toHaveLength(2);
  });
});

describe('agent-loader file extension validation', () => {
  it('rejects unsupported file extensions', async () => {
    const { loadAgent } = await import('../../src/cli/agent-loader.js');
    await expect(loadAgent('/tmp/agent.txt')).rejects.toThrow('Unsupported file extension');
  });

  it('rejects .json files', async () => {
    const { loadAgent } = await import('../../src/cli/agent-loader.js');
    await expect(loadAgent('/tmp/agent.json')).rejects.toThrow('Unsupported file extension');
  });
});

describe('agent-loader duck typing', () => {
  it('AgentBase instances pass duck-type check', () => {
    const agent = new AgentBase({ name: 'test', route: '/test' });
    // The duck-type check used by agent-loader
    expect(typeof agent.renderSwml).toBe('function');
    expect(typeof agent.defineTool).toBe('function');
    expect(typeof agent.getPrompt).toBe('function');
  });

  it('plain objects do not pass duck-type check', () => {
    const obj = { renderSwml: 'not a function' };
    expect(typeof obj.renderSwml).not.toBe('function');
  });

  it('AgentBase class prototype has required methods', () => {
    expect(typeof AgentBase.prototype.renderSwml).toBe('function');
    expect(typeof AgentBase.prototype.defineTool).toBe('function');
    expect(typeof AgentBase.prototype.getPrompt).toBe('function');
  });
});
