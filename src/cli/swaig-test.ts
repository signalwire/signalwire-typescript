#!/usr/bin/env node
/**
 * swaig-test - CLI tool for testing SignalWire AI agents locally.
 *
 * Usage:
 *   swaig-test <agent-path> [options]
 *
 * Actions:
 *   --list-tools       List all SWAIG functions with parameters
 *   --dump-swml        Generate and output SWML document
 *   --exec <name>      Execute a function (use --arg key=value for args)
 *
 * Options:
 *   --raw              Raw JSON output (suppresses logs)
 *   --verbose          Verbose output
 *   --call-type        sip|webrtc (default: webrtc)
 *   --call-direction   inbound|outbound (default: inbound)
 *   --from-number      Override from number
 *   --to-extension     Override to extension
 *   --arg key=value    Function argument (repeatable)
 */

import { loadAgent } from './agent-loader.js';
import { generateFakePostData, generateMinimalPostData } from './mock-data.js';
import { suppressAllLogs, setGlobalLogLevel } from '../Logger.js';

interface CliOptions {
  agentPath: string;
  action: 'list-tools' | 'dump-swml' | 'exec';
  execName?: string;
  raw: boolean;
  verbose: boolean;
  callType: 'sip' | 'webrtc';
  callDirection: 'inbound' | 'outbound';
  fromNumber?: string;
  toExtension?: string;
  args: Record<string, unknown>;
}

function printUsage(): void {
  console.log(`
swaig-test - CLI tool for testing SignalWire AI agents locally

Usage:
  swaig-test <agent-path> [options]

Actions:
  --list-tools       List all SWAIG functions with parameters
  --dump-swml        Generate and output SWML document
  --exec <name>      Execute a function (use --arg key=value for args)

Options:
  --raw              Raw JSON output (suppresses logs)
  --verbose          Verbose output
  --call-type        sip|webrtc (default: webrtc)
  --call-direction   inbound|outbound (default: inbound)
  --from-number      Override from number
  --to-extension     Override to extension
  --arg key=value    Function argument (repeatable)
  --help             Show this help message
`);
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2); // skip node + script
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const opts: CliOptions = {
    agentPath: '',
    action: 'dump-swml',
    raw: false,
    verbose: false,
    callType: 'webrtc',
    callDirection: 'inbound',
    args: {},
  };

  let i = 0;

  // First positional arg is the agent path
  if (!args[0].startsWith('--')) {
    opts.agentPath = args[0];
    i = 1;
  }

  for (; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--list-tools':
        opts.action = 'list-tools';
        break;
      case '--dump-swml':
        opts.action = 'dump-swml';
        break;
      case '--exec':
        opts.action = 'exec';
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
      case '--call-type':
        opts.callType = args[++i] as 'sip' | 'webrtc';
        break;
      case '--call-direction':
        opts.callDirection = args[++i] as 'inbound' | 'outbound';
        break;
      case '--from-number':
        opts.fromNumber = args[++i];
        break;
      case '--to-extension':
        opts.toExtension = args[++i];
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

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (opts.raw) {
    suppressAllLogs(true);
  } else if (opts.verbose) {
    setGlobalLogLevel('debug');
  }

  // Load agent
  const agent = await loadAgent(opts.agentPath) as any;

  switch (opts.action) {
    case 'list-tools': {
      const tools = agent.getRegisteredTools();
      if (opts.raw) {
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
              console.log(`    Parameters: ${JSON.stringify(tool.parameters, null, 6).replace(/\n/g, '\n    ')}`);
            }
            console.log();
          }
        }
      }
      break;
    }

    case 'dump-swml': {
      const postData = generateFakePostData({
        callType: opts.callType,
        callDirection: opts.callDirection,
        fromNumber: opts.fromNumber,
        toExtension: opts.toExtension,
      });
      const swml = agent.renderSwml(postData['call_id'] as string);
      if (opts.raw) {
        console.log(swml);
      } else {
        console.log('\n--- SWML Document ---\n');
        console.log(JSON.stringify(JSON.parse(swml), null, 2));
        console.log();
      }
      break;
    }

    case 'exec': {
      if (!opts.execName) {
        console.error('Error: --exec requires a function name');
        process.exit(1);
      }

      const tool = agent.getTool(opts.execName);
      if (!tool) {
        console.error(`Error: function '${opts.execName}' not found`);
        const available = agent.getRegisteredTools().map((t: any) => t.name);
        if (available.length) {
          console.error(`Available functions: ${available.join(', ')}`);
        }
        process.exit(1);
      }

      const postData = generateMinimalPostData(opts.execName, opts.args);

      if (!opts.raw) {
        console.log(`\nExecuting: ${opts.execName}`);
        if (Object.keys(opts.args).length) {
          console.log(`Arguments: ${JSON.stringify(opts.args)}`);
        }
        console.log();
      }

      const result = await tool.execute(opts.args, postData);

      if (opts.raw) {
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
