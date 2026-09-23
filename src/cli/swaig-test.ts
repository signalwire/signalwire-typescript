#!/usr/bin/env node
/**
 * swaig-test - CLI tool for testing SignalWire AI agents locally.
 *
 * Usage:
 *   swaig-test <agent-path> [options]
 *
 * Actions:
 *   --list-tools       List all SWAIG functions with parameters
 *   --list-agents      List all exported agents in a file
 *   --dump-swml        Generate and output SWML document
 *   --exec <name>      Execute a function (use --arg key=value for args)
 *
 * Options:
 *   --raw              Raw JSON output (suppresses logs)
 *   --verbose          Verbose output
 *   --format-json      Format output as indented JSON
 *   --call-type        sip|webrtc (default: webrtc)
 *   --call-direction   inbound|outbound (default: inbound)
 *   --call-state       active|ringing|hold (default: active)
 *   --call-id          Override call ID
 *   --from-number      Override from number
 *   --to-extension     Override to extension
 *   --arg key=value    Function argument (repeatable)
 *   --override k=v     Override call data field (repeatable)
 *   --agent-class      Name of specific agent class to use
 *   --route            Route for agent (default: /)
 *   --env KEY=VALUE    Set env var (repeatable)
 *   --env-file         Load env vars from file
 *   --simulate-serverless <platform>  Simulate serverless platform
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadAgent, listAgents } from './agent-loader.js';
import type { Hono } from 'hono';
import type { SwaigFunction } from '../SwaigFunction.js';
import { generateFakePostData, generateMinimalPostData } from './mock-data.js';
import { suppressAllLogs, setGlobalLogLevel } from '../Logger.js';
import { ServerlessAdapter } from '../ServerlessAdapter.js';
import type { ServerlessPlatform } from '../ServerlessAdapter.js';

/**
 * Concrete serverless platforms the {@link ServerlessAdapter} actually implements
 * end-to-end (normalize event → route through Hono → normalize response, plus a
 * platform-specific handler factory and URL generator). `'auto'` is intentionally
 * NOT here: it is environment-based detection for production wiring and is
 * meaningless as an explicit `--simulate-serverless` target.
 *
 * This is the canonical "supported set" the CLI validates `--simulate-serverless`
 * against. Adding an entry here without a real adapter path would be a lie that
 * silently passes a bogus `--simulate-serverless <x>`.
 */
const SUPPORTED_SIMULATE_PLATFORMS: readonly Exclude<ServerlessPlatform, 'auto'>[] = [
  'lambda',
  'gcf',
  'azure',
  'cgi',
];

/**
 * Validate a user-supplied `--simulate-serverless` platform against what this
 * SDK actually implements. Returns the narrowed platform on success; throws a
 * descriptive Error (naming the supported set) otherwise — never a silent
 * fallback. The reject-don't-fallback behavior is the SWAIG-CLI contract.
 */
function validateSimulatePlatform(platform: string): ServerlessPlatform {
  if (!platform) {
    throw new Error('--simulate-serverless requires a platform name (e.g. "lambda")');
  }
  if ((SUPPORTED_SIMULATE_PLATFORMS as readonly string[]).includes(platform)) {
    return platform as ServerlessPlatform;
  }
  throw new Error(
    `--simulate-serverless ${platform}: unknown platform. ` +
      `This TypeScript port supports: ${SUPPORTED_SIMULATE_PLATFORMS.join(', ')}. ` +
      `(No silent fallback to the server path.)`,
  );
}

interface CliOptions {
  agentPath: string;
  action: 'list-tools' | 'list-agents' | 'dump-swml' | 'exec';
  /**
   * Whether an explicit action flag (--list-tools / --list-agents / --dump-swml
   * / --exec) was passed. When false AND not in --simulate-serverless mode the
   * CLI errors instead of silently defaulting — matching the cross-port
   * majority (go/java/ruby/php/perl/rust/cpp all error on no action) and the
   * SWAIG-CLI mini-contract gate. `action` still carries a default value so the
   * downstream switch stays exhaustive.
   */
  actionExplicit: boolean;
  execName?: string;
  raw: boolean;
  verbose: boolean;
  formatJson: boolean;
  callType: 'sip' | 'webrtc';
  callDirection: 'inbound' | 'outbound';
  callState: string;
  callId?: string;
  fromNumber?: string;
  toExtension?: string;
  args: Record<string, unknown>;
  overrides: Record<string, unknown>;
  agentClass?: string;
  route?: string;
  envVars: Record<string, string>;
  envFile?: string;
  simulateServerless?: string;
}

function printUsage(): void {
  console.log(`
swaig-test - CLI tool for testing SignalWire AI agents locally

Usage:
  swaig-test <agent-path> [options]

Actions:
  --list-tools       List all SWAIG functions with parameters
  --list-agents      List all exported agents in a file
  --dump-swml        Generate and output SWML document
  --exec <name>      Execute a function (use --arg key=value for args)

Options:
  --raw              Raw JSON output (suppresses logs)
  --verbose          Verbose output
  --format-json      Format output as indented JSON
  --call-type        sip|webrtc (default: webrtc)
  --call-direction   inbound|outbound (default: inbound)
  --call-state       active|ringing|hold (default: active)
  --call-id          Override call ID
  --from-number      Override from number
  --to-extension     Override to extension
  --arg key=value    Function argument (repeatable)
  --override k=v     Override call data field (repeatable)
  --agent-class      Name of specific agent class to use
  --route            Route for the agent
  --env KEY=VALUE    Set env var (repeatable)
  --env-file         Load env vars from file
  --simulate-serverless <platform>  Simulate serverless (lambda|gcf|azure|cgi)
  --help             Show this help message
`);
}

/**
 * Detect the `--parse-only` (alias `--dry-run`) flag anywhere in the arg list
 * and return a copy of `argv` with every occurrence stripped, plus whether it
 * was present.
 *
 * Stripping is done FIRST — before the regular parser sees the tokens — for two
 * reasons, mirroring the Python reference (signalwire/cli/test_swaig.py):
 *   1. Position-independence. `--exec <name>` consumes the following token as
 *      the function name, so a `--parse-only` trailing an `--exec foo` would
 *      otherwise be eaten as a function argument. Removing it up front means it
 *      is honored wherever it appears, including after `--exec`.
 *   2. It is a boolean that takes no value, so removing it cannot desync the
 *      value-consuming flags (`--arg`, `--env`, `--call-id`, …) around it.
 */
function stripParseOnly(argv: string[]): { argv: string[]; parseOnly: boolean } {
  const parseOnly = argv.includes('--parse-only') || argv.includes('--dry-run');
  if (!parseOnly) return { argv, parseOnly: false };
  return {
    argv: argv.filter((a) => a !== '--parse-only' && a !== '--dry-run'),
    parseOnly: true,
  };
}

function parseArgs(argv: string[], parseOnly = false): CliOptions {
  const args = argv.slice(2); // skip node + script
  // `--help`/`-h` prints usage and exits 0 regardless. A bare invocation with no
  // args is also usage — but NOT when it is `--parse-only` alone: that is a
  // missing-required-positional error, which must fall through to the
  // `!opts.agentPath` path and exit non-zero (matching the Python reference's
  // argparse exit 2), never print usage-and-exit-0.
  if (args.includes('--help') || args.includes('-h') || (args.length === 0 && !parseOnly)) {
    printUsage();
    process.exit(0);
  }

  const opts: CliOptions = {
    agentPath: '',
    action: 'dump-swml',
    actionExplicit: false,
    raw: false,
    verbose: false,
    formatJson: false,
    callType: 'webrtc',
    callDirection: 'inbound',
    callState: 'active',
    args: {},
    overrides: {},
    envVars: {},
  };

  let i = 0;

  // First positional arg is the agent path. `args` is normally non-empty here
  // (the args.length===0 short-circuit above), but under `--parse-only` alone it
  // can be empty (parse-only was stripped) — in which case agentPath stays unset
  // and the `!opts.agentPath` check below reports the missing-positional error.
  if (args[0] !== undefined && !args[0].startsWith('--')) {
    opts.agentPath = args[0];
    i = 1;
  }

  for (; i < args.length; i++) {
    const arg = args[i]!; // i < length
    switch (arg) {
      case '--list-tools':
        opts.action = 'list-tools';
        opts.actionExplicit = true;
        break;
      case '--list-agents':
        opts.action = 'list-agents';
        opts.actionExplicit = true;
        break;
      case '--dump-swml':
        opts.action = 'dump-swml';
        opts.actionExplicit = true;
        break;
      case '--exec':
        opts.action = 'exec';
        opts.actionExplicit = true;
        opts.execName = args[++i];
        if (!opts.execName) {
          console.error('Error: --exec requires a function name');
          process.exit(1);
        }
        break;
      case '--raw':
        opts.raw = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--format-json':
        opts.formatJson = true;
        break;
      case '--call-type':
        opts.callType = args[++i] as 'sip' | 'webrtc';
        break;
      case '--call-direction':
        opts.callDirection = args[++i] as 'inbound' | 'outbound';
        break;
      case '--call-state':
        // Matches the other flag handlers: consume the next token verbatim.
        // The `!` is type-only and does not change the runtime assignment.
        opts.callState = args[++i]!;
        break;
      case '--call-id':
        opts.callId = args[++i];
        break;
      case '--from-number':
        opts.fromNumber = args[++i];
        break;
      case '--to-extension':
        opts.toExtension = args[++i];
        break;
      case '--agent-class':
        opts.agentClass = args[++i];
        break;
      case '--route':
        opts.route = args[++i];
        break;
      case '--simulate-serverless':
        opts.simulateServerless = args[++i];
        break;
      case '--env-file':
        opts.envFile = args[++i];
        break;
      case '--arg': {
        const kv = args[++i];
        if (!kv || !kv.includes('=')) {
          console.error('Error: --arg requires key=value format');
          process.exit(1);
        }
        const eqIdx = kv.indexOf('=');
        const key = kv.slice(0, eqIdx);
        const val = kv.slice(eqIdx + 1);
        // Try to parse as JSON, fall back to string
        try {
          opts.args[key] = JSON.parse(val);
        } catch {
          opts.args[key] = val;
        }
        break;
      }
      case '--override': {
        const kv = args[++i];
        if (!kv || !kv.includes('=')) {
          console.error('Error: --override requires key=value format');
          process.exit(1);
        }
        const eqIdx = kv.indexOf('=');
        const key = kv.slice(0, eqIdx);
        const val = kv.slice(eqIdx + 1);
        try {
          opts.overrides[key] = JSON.parse(val);
        } catch {
          opts.overrides[key] = val;
        }
        break;
      }
      case '--env': {
        const kv = args[++i];
        if (!kv || !kv.includes('=')) {
          console.error('Error: --env requires KEY=VALUE format');
          process.exit(1);
        }
        const eqIdx = kv.indexOf('=');
        opts.envVars[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
        break;
      }
      default:
        if (!opts.agentPath && !arg.startsWith('--')) {
          opts.agentPath = arg;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (!opts.agentPath) {
    console.error('Error: agent path is required');
    printUsage();
    process.exit(1);
  }

  return opts;
}

function loadEnvFile(filePath: string): void {
  const content = readFileSync(resolve(filePath), 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

/**
 * Structural view of a dynamically loaded target (AgentBase or standalone
 * SWMLService). The CLI duck-types against this surface — members are probed
 * with `typeof x === 'function'` before use because the two base classes share
 * only part of it. `renderSwml` is intentionally loose: SWMLService returns an
 * object, AgentBase returns a JSON string.
 */
interface LoadedTarget {
  route?: string;
  basicAuthCreds?: [string, string];
  getApp(): Hono;
  getRegisteredTools?(): {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }[];
  getTool?(name: string): SwaigFunction | undefined;
  getPrompt?(): unknown;
  renderSwml(callId?: string): string | object;
}

async function main(): Promise<void> {
  // Detect + strip --parse-only / --dry-run FIRST, so it is position-independent
  // (honored even trailing an --exec) and cannot desync value-consuming flags.
  const { argv, parseOnly } = stripParseOnly(process.argv);
  const opts = parseArgs(argv, parseOnly);

  // --parse-only / --dry-run: the invocation's arguments parsed cleanly (a bad
  // arg would already have exited non-zero inside parseArgs). Report success and
  // exit WITHOUT loading the agent, touching the filesystem, or hitting the
  // network. This is the canonical cross-port contract mirrored by every port.
  if (parseOnly) {
    console.log('parse OK');
    return;
  }

  if (opts.raw) {
    suppressAllLogs(true);
  } else if (opts.verbose) {
    setGlobalLogLevel('debug');
  }

  // Apply env vars
  if (opts.envFile) {
    loadEnvFile(opts.envFile);
  }
  for (const [k, v] of Object.entries(opts.envVars)) {
    process.env[k] = v;
  }

  // List agents action (doesn't need a loaded agent)
  if (opts.action === 'list-agents') {
    const agents = await listAgents(opts.agentPath);
    if (opts.raw || opts.formatJson) {
      console.log(JSON.stringify(agents, null, 2));
    } else {
      console.log(`\nExported agents in ${opts.agentPath}:\n`);
      for (const name of agents) {
        console.log(`  ${name}`);
      }
      console.log();
    }
    return;
  }

  // Load agent
  const agent = (await loadAgent(opts.agentPath, opts.agentClass)) as LoadedTarget;

  // Apply --route override
  if (opts.route && typeof agent.route !== 'undefined') {
    agent.route = opts.route;
  }

  // Consistent default action: when a target is given but no action flag, error
  // rather than silently dumping SWML. --simulate-serverless without a sub-action
  // is still allowed (it runs the simulation render, mirroring the Go/Ruby
  // "render and exit" default). Matches the cross-port SWAIG-CLI mini-contract.
  if (!opts.actionExplicit && !opts.simulateServerless) {
    console.error('Error: one of --dump-swml, --list-tools, or --exec is required');
    process.exit(1);
  }

  // Handle --simulate-serverless
  if (opts.simulateServerless) {
    const platform = validateSimulatePlatform(opts.simulateServerless);
    const adapter = new ServerlessAdapter(platform);
    const app = agent.getApp();
    const postData = generateFakePostData({
      callType: opts.callType,
      callDirection: opts.callDirection,
      callState: opts.callState,
      callId: opts.callId,
      fromNumber: opts.fromNumber,
      toExtension: opts.toExtension,
      overrides: opts.overrides,
    });
    const event = {
      httpMethod: 'POST',
      path: agent.route ?? '/',
      headers: {
        'content-type': 'application/json',
        authorization:
          'Basic ' +
          Buffer.from(
            `${agent.basicAuthCreds?.[0] ?? 'user'}:${agent.basicAuthCreds?.[1] ?? 'pass'}`,
          ).toString('base64'),
      },
      body: postData,
    };
    const response = await adapter.handleRequest(app, event);
    if (opts.raw || opts.formatJson) {
      try {
        console.log(JSON.stringify(JSON.parse(response.body), null, 2));
      } catch {
        console.log(response.body);
      }
    } else {
      console.log(`\n--- Serverless Simulation (${platform}) ---`);
      console.log(`Status: ${response.statusCode}`);
      console.log(`Headers: ${JSON.stringify(response.headers, null, 2)}`);
      console.log('Body:');
      try {
        console.log(JSON.stringify(JSON.parse(response.body), null, 2));
      } catch {
        console.log(response.body);
      }
      console.log();
    }
    return;
  }

  switch (opts.action) {
    case 'list-tools': {
      // getRegisteredTools is on SWMLService now, so AgentBase and
      // standalone SWMLService instances both work here.
      if (typeof agent.getRegisteredTools !== 'function') {
        console.log('This target does not expose getRegisteredTools(); use --dump-swml.');
        break;
      }
      const tools = agent.getRegisteredTools();
      if (opts.raw || opts.formatJson) {
        console.log(JSON.stringify(tools, null, 2));
      } else {
        if (tools.length === 0) {
          console.log('No tools registered.');
        } else {
          console.log(`\nRegistered tools (${tools.length}):\n`);
          for (const tool of tools) {
            console.log(`  ${tool.name}`);
            console.log(`    Description: ${tool.description}`);
            if (tool.parameters && Object.keys(tool.parameters).length) {
              console.log(
                `    Parameters: ${JSON.stringify(tool.parameters, null, 6).replace(/\n/g, '\n    ')}`,
              );
            }
            console.log();
          }
        }
      }
      break;
    }

    case 'dump-swml': {
      // SWMLService.renderSwml() returns an object; AgentBase.renderSwml() returns a string.
      // Use `getPrompt` as the discriminator — agent-only — because
      // getRegisteredTools is now on both classes.
      let swmlJson: unknown;
      if (typeof agent.getPrompt !== 'function') {
        // SWMLService — renderSwml returns object directly
        swmlJson = agent.renderSwml();
      } else {
        // AgentBase — renderSwml(callId) returns JSON string
        const postData = generateFakePostData({
          callType: opts.callType,
          callDirection: opts.callDirection,
          callState: opts.callState,
          callId: opts.callId,
          fromNumber: opts.fromNumber,
          toExtension: opts.toExtension,
          overrides: opts.overrides,
        });
        // AgentBase.renderSwml(callId) returns a JSON string (this branch is
        // gated on getPrompt above, which only AgentBase exposes).
        swmlJson = JSON.parse(agent.renderSwml(postData['call_id'] as string) as string);
      }
      if (opts.raw || opts.formatJson) {
        console.log(JSON.stringify(swmlJson, null, 2));
      } else {
        console.log('\n--- SWML Document ---\n');
        console.log(JSON.stringify(swmlJson, null, 2));
        console.log();
      }
      break;
    }

    case 'exec': {
      if (!opts.execName) {
        console.error('Error: --exec requires a function name');
        process.exit(1);
      }

      const tool = agent.getTool?.(opts.execName);
      if (!tool) {
        console.error(`Error: function '${opts.execName}' not found`);
        const available = (agent.getRegisteredTools?.() ?? []).map((t) => t.name);
        if (available.length) {
          console.error(`Available functions: ${available.join(', ')}`);
        }
        process.exit(1);
      }

      const postData = generateMinimalPostData(opts.execName, opts.args, {
        callId: opts.callId,
        overrides: opts.overrides,
      });

      if (!opts.raw) {
        console.log(`\nExecuting: ${opts.execName}`);
        if (Object.keys(opts.args).length) {
          console.log(`Arguments: ${JSON.stringify(opts.args)}`);
        }
        console.log();
      }

      const result = await tool.execute(opts.args, postData);

      if (opts.raw || opts.formatJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('--- Result ---\n');
        console.log(JSON.stringify(result, null, 2));
        console.log();
      }
      break;
    }
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
