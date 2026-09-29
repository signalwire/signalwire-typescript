#!/usr/bin/env node
/**
 * swaig-test - test a SignalWire AI agent file locally.
 *
 *   swaig-test <agent-file> --list-tools
 *   swaig-test <agent-file> --dump-swml
 *   swaig-test <agent-file> --exec <function> [--param value ...]
 *
 * Requests go through the agent's own HTTP app, as SignalWire's would: the
 * SWML is fetched with a simulated call, a dynamic config callback runs once
 * per request on a copy of the agent, and a function is called at the
 * web_hook_url the SWML gives it, token and all. A DataMap function runs in
 * the local DataMap simulator. With --simulate-serverless the agent runs with
 * a serverless platform's environment, so its webhook URLs are the
 * platform's.
 *
 * Mirrors signalwire-python's `swaig-test` (signalwire/cli/test_swaig.py).
 */

import { createHmac } from 'node:crypto';
import { describeAgents, loadAgent } from './agent-loader.js';
import { executeDataMap, PLATFORM_ERROR_RESPONSE } from './datamap-exec.js';
import { parseFunctionArguments, undeclaredArgumentWarnings } from './function-args.js';
import {
  SIMULATED_PLATFORMS,
  ServerlessSimulator,
  applyConvenienceMappings,
  applyOverrides,
  comprehensivePostData,
  fakeSwmlPostData,
  loadEnvFile,
  minimalPostData,
} from './simulation.js';
import type { Hono } from 'hono';
import type { SwaigFunction } from '../SwaigFunction.js';
import { setGlobalLogLevel, suppressAllLogs } from '../Logger.js';

type Data = Record<string, unknown>;

// ── Options ──────────────────────────────────────────────────────────────

interface CliOptions {
  agentPath: string;
  action: 'list-tools' | 'list-agents' | 'dump-swml' | 'exec' | null;
  execName?: string;
  /** Everything after `--exec <function>`: the function's arguments. */
  functionTokens: string[];
  verbose: boolean;
  raw: boolean;
  formatJson: boolean;
  agentClass?: string;
  route?: string;
  customData?: string;
  minimal: boolean;
  fakeFullData: boolean;
  callType: string;
  callDirection: string;
  callState: string;
  fromNumber?: string;
  toExtension?: string;
  userVars?: string;
  queryParams?: string;
  overrides: string[];
  overrideJson: string[];
  headers: string[];
  simulateServerless?: string;
  envVars: string[];
  envFile?: string;
  callId?: string;
  projectId?: string;
  spaceId?: string;
  method: string;
  body?: string;
  awsFunctionName?: string;
  awsFunctionUrl?: string;
  awsRegion?: string;
  awsApiGatewayId?: string;
  awsStage?: string;
  cgiHost?: string;
  cgiScriptName?: string;
  cgiHttps: boolean;
  cgiPathInfo?: string;
  gcpProject?: string;
  gcpFunctionUrl?: string;
  gcpRegion?: string;
  gcpService?: string;
  azureEnv?: string;
  azureFunctionUrl?: string;
}

type ValueKey = {
  [K in keyof CliOptions]: CliOptions[K] extends string | undefined ? K : never;
}[keyof CliOptions];
type ListKey = 'overrides' | 'overrideJson' | 'headers' | 'envVars';
type FlagKey = 'verbose' | 'raw' | 'formatJson' | 'minimal' | 'fakeFullData' | 'cgiHttps';

const VALUE_OPTIONS: Record<string, ValueKey> = {
  '--agent-class': 'agentClass',
  '--route': 'route',
  '--custom-data': 'customData',
  '--call-type': 'callType',
  '--call-direction': 'callDirection',
  '--call-state': 'callState',
  '--from-number': 'fromNumber',
  '--to-extension': 'toExtension',
  '--user-vars': 'userVars',
  '--query-params': 'queryParams',
  '--simulate-serverless': 'simulateServerless',
  '--env-file': 'envFile',
  '--call-id': 'callId',
  '--project-id': 'projectId',
  '--space-id': 'spaceId',
  '--method': 'method',
  '--body': 'body',
  '--aws-function-name': 'awsFunctionName',
  '--aws-function-url': 'awsFunctionUrl',
  '--aws-region': 'awsRegion',
  '--aws-api-gateway-id': 'awsApiGatewayId',
  '--aws-stage': 'awsStage',
  '--cgi-host': 'cgiHost',
  '--cgi-script-name': 'cgiScriptName',
  '--cgi-path-info': 'cgiPathInfo',
  '--gcp-project': 'gcpProject',
  '--gcp-function-url': 'gcpFunctionUrl',
  '--gcp-region': 'gcpRegion',
  '--gcp-service': 'gcpService',
  '--azure-env': 'azureEnv',
  '--azure-function-url': 'azureFunctionUrl',
};
const LIST_OPTIONS: Record<string, ListKey> = {
  '--override': 'overrides',
  '--override-json': 'overrideJson',
  '--header': 'headers',
  '--env': 'envVars',
};
const FLAG_OPTIONS: Record<string, FlagKey> = {
  '--verbose': 'verbose',
  '-v': 'verbose',
  '--raw': 'raw',
  '--format-json': 'formatJson',
  '--minimal': 'minimal',
  '--fake-full-data': 'fakeFullData',
  '--cgi-https': 'cgiHttps',
};
const ACTION_OPTIONS: Record<string, CliOptions['action']> = {
  '--list-tools': 'list-tools',
  '--list-agents': 'list-agents',
  '--dump-swml': 'dump-swml',
};

/** Every option swaig-test takes, for the undeclared-argument warning. */
const CLI_OPTIONS: ReadonlySet<string> = new Set([
  ...Object.keys(VALUE_OPTIONS),
  ...Object.keys(LIST_OPTIONS),
  ...Object.keys(FLAG_OPTIONS),
  ...Object.keys(ACTION_OPTIONS),
  '--exec',
  '--help',
  '--help-platforms',
  '--help-examples',
  '--parse-only',
  '--dry-run',
]);

/** A usage error (printed with a hint, exit 2): an Error tagged `usage`. */
const usageError = (message: string): Error => Object.assign(new Error(message), { usage: true });
const isUsageError = (err: unknown): err is Error =>
  err instanceof Error && (err as { usage?: boolean }).usage === true;

const AGENT_FILE = /\.(ts|js|mjs|mts)$/i;

function parseArgs(argv: string[]): CliOptions {
  // Everything after `--exec <function>` is the function's.
  let cli = argv;
  let execName: string | undefined;
  let functionTokens: string[] = [];
  const execAt = argv.indexOf('--exec');
  if (execAt >= 0) {
    execName = argv[execAt + 1];
    if (!execName || execName.startsWith('--')) throw usageError('--exec requires a function name');
    cli = argv.slice(0, execAt);
    functionTokens = argv.slice(execAt + 2);
  }

  const opts: CliOptions = {
    agentPath: '',
    action: execName ? 'exec' : null,
    execName,
    functionTokens,
    verbose: false,
    raw: false,
    formatJson: false,
    minimal: false,
    fakeFullData: false,
    callType: 'webrtc',
    callDirection: 'inbound',
    callState: 'created',
    overrides: [],
    overrideJson: [],
    headers: [],
    envVars: [],
    method: 'POST',
    cgiHttps: false,
  };

  for (let i = 0; i < cli.length; i++) {
    let token = cli[i]!;
    let inlineValue: string | undefined;
    const eq = token.indexOf('=');
    if (token.startsWith('--') && eq > 2) {
      inlineValue = token.slice(eq + 1);
      token = token.slice(0, eq);
    }
    const value = (): string => {
      if (inlineValue !== undefined) return inlineValue;
      const next = cli[++i];
      if (next === undefined) throw usageError(`${token} requires a value`);
      return next;
    };
    if (token in FLAG_OPTIONS) opts[FLAG_OPTIONS[token]!] = true;
    else if (token in ACTION_OPTIONS) {
      if (opts.action && opts.action !== ACTION_OPTIONS[token]) {
        throw usageError('choose one action: --list-agents, --list-tools, --dump-swml or --exec');
      }
      opts.action = ACTION_OPTIONS[token]!;
    } else if (token in VALUE_OPTIONS) (opts[VALUE_OPTIONS[token]!] as string) = value();
    else if (token in LIST_OPTIONS) opts[LIST_OPTIONS[token]!].push(value());
    else if (token === '--arg') {
      // --arg name=value before --exec: a function argument all the same.
      opts.functionTokens.push('--arg', value());
    } else if (!token.startsWith('-') && !opts.agentPath) opts.agentPath = token;
    else throw usageError(`unknown option: ${cli[i]}`);
  }

  // The agent file may trail the function's arguments; take it from there.
  if (!opts.agentPath) {
    const tokens = opts.functionTokens;
    for (let k = tokens.length - 1; k >= 0; k--) {
      const t = tokens[k]!;
      if (
        AGENT_FILE.test(t) &&
        !t.startsWith('-') &&
        (k === 0 || !tokens[k - 1]!.startsWith('--'))
      ) {
        opts.agentPath = tokens.splice(k, 1)[0]!;
        break;
      }
    }
  }

  if (!opts.agentPath) throw usageError('missing the agent file');
  if (!['sip', 'webrtc'].includes(opts.callType)) {
    throw usageError(`--call-type must be sip or webrtc, not ${opts.callType}`);
  }
  if (!['inbound', 'outbound'].includes(opts.callDirection)) {
    throw usageError(`--call-direction must be inbound or outbound, not ${opts.callDirection}`);
  }
  if (opts.route && opts.agentClass) {
    throw usageError('Cannot specify both --route and --agent-class. Choose one.');
  }
  if (opts.simulateServerless !== undefined) {
    if (!(opts.simulateServerless in SIMULATED_PLATFORMS)) {
      throw usageError(
        `--simulate-serverless ${opts.simulateServerless}: unknown platform. ` +
          `This TypeScript port supports: ${Object.keys(SIMULATED_PLATFORMS).join(', ')}. ` +
          '(No silent fallback to the server path.)',
      );
    }
    if (SIMULATED_PLATFORMS[opts.simulateServerless] === 'cgi' && !opts.cgiHost) {
      throw usageError('--cgi-host is required with --simulate-serverless cgi');
    }
  }
  return opts;
}

// ── Help ─────────────────────────────────────────────────────────────────

const USAGE = 'Usage: swaig-test <agent-file> [options]';

function printHelp(): void {
  console.log(`swaig-test - test a SignalWire AI agent file locally

${USAGE}

Actions (choose one):
  --list-agents          List the agents and services in the file
  --list-tools           List the agent's SWAIG functions
  --dump-swml            Print the SWML document the agent serves
  --exec <function> [--param value ...]
                         Call a function. Everything after the function name is
                         an argument for it (--name value, typed by the
                         function's parameters; --arg name=value also works),
                         so put swaig-test's own options before --exec.

Common options:
  -v, --verbose          Verbose output
  --raw                  Output raw JSON only (for piping to jq)
  --format-json          Print the result as indented JSON
  --agent-class NAME     Use this exported agent class or instance
  --route ROUTE          Use the service with this route (e.g. /healthcare)

Function execution:
  --minimal              Send the smallest request (call_id and arguments)
  --fake-full-data       Send a request with every key SignalWire may send (the default)
  --custom-data JSON     Values to merge into the request; a DataMap function's call data

SWML and call data (each applies to --dump-swml, --list-tools and --exec):
  --call-type sip|webrtc         Call type (default: webrtc)
  --call-direction inbound|outbound
                                 Call direction (default: inbound)
  --call-state STATE             Call state, set as call.state (default: created)
  --call-id ID                   call_id the simulated request carries
  --project-id ID                call.project_id
  --space-id ID                  call.space_id
  --from-number NUMBER           call.from
  --to-extension EXT             call.to
  --user-vars JSON               vars.userVariables
  --query-params JSON            Query parameters for the request (also in userVariables)
  --header NAME=VALUE            Request header (repeatable)
  --override PATH=VALUE          Set a value in the request, e.g. call.state=answered (repeatable)
  --override-json PATH=JSON      Set a JSON value in the request (repeatable)
  --method POST|GET              Method of the SWML request (default: POST)
  --body JSON                    Extra fields for the SWML request body

Environment and serverless:
  --env KEY=VALUE        Set an environment variable (repeatable)
  --env-file FILE        Load environment variables from a file
  --simulate-serverless lambda|cgi|gcf|azure
                         Run with a serverless platform's environment
                         (cloud_function and azure_function also accepted);
                         see --help-platforms

  --parse-only, --dry-run  Validate the arguments and exit without loading the agent
  --help-platforms       Serverless platform options
  --help-examples        Usage examples
  -h, --help             This help

The SDK's documentation for the installed version: sw-tsdocs (npx sw-tsdocs).`);
}

function printHelpPlatforms(): void {
  console.log(`Serverless platform options

AWS Lambda (--simulate-serverless lambda):
  --aws-function-name NAME     Function name (AWS_LAMBDA_FUNCTION_NAME)
  --aws-function-url URL       Function URL (AWS_LAMBDA_FUNCTION_URL)
  --aws-region REGION          Region (AWS_REGION)
  --aws-api-gateway-id ID      Serve at an API Gateway URL,
                               https://ID.execute-api.REGION.amazonaws.com/STAGE
  --aws-stage STAGE            API Gateway stage (default: prod)

CGI (--simulate-serverless cgi):
  --cgi-host HOST              Server host name (required)
  --cgi-script-name NAME       Script path (SCRIPT_NAME)
  --cgi-https                  Serve over HTTPS
  --cgi-path-info PATH         PATH_INFO

Google Cloud Functions (--simulate-serverless gcf):
  --gcp-project ID             Project (GOOGLE_CLOUD_PROJECT)
  --gcp-function-url URL       Function URL (FUNCTION_URL)
  --gcp-region REGION          Region (GOOGLE_CLOUD_REGION)
  --gcp-service NAME           Service name (K_SERVICE)

Azure Functions (--simulate-serverless azure):
  --azure-env ENV              Environment (AZURE_FUNCTIONS_ENVIRONMENT)
  --azure-function-url URL     Function URL (AZURE_FUNCTION_URL)

Example:
  swaig-test agent.ts --simulate-serverless lambda --aws-region us-west-2 --dump-swml`);
}

function printHelpExamples(): void {
  console.log(`Examples

  # List the functions, then call one
  swaig-test agent.ts --list-tools
  swaig-test agent.ts --exec get_weather --city "San Francisco"
  swaig-test agent.ts --verbose --exec search --query test --limit 5

  # The SWML document, for jq
  swaig-test agent.ts --dump-swml --raw | jq '.sections.main'

  # A dynamic agent, with the request it would get
  swaig-test agent.ts --dump-swml --query-params '{"tier":"premium"}' --header "X-Customer-ID=12345"

  # Call data
  swaig-test agent.ts --call-type sip --call-state answered --exec transfer --dest sales
  swaig-test agent.ts --override call.project_id=my-project --dump-swml

  # A file with several agents
  swaig-test server.ts --list-agents
  swaig-test server.ts --route /sales --list-tools

  # Serverless
  swaig-test agent.ts --simulate-serverless lambda --dump-swml
  swaig-test agent.ts --simulate-serverless cgi --cgi-host example.com --cgi-https --exec my_function`);
}

// ── The loaded target ────────────────────────────────────────────────────

/** An AgentBase or a plain SWMLService, as the CLI uses it. */
interface LoadedTarget {
  name?: string;
  route?: string;
  getApp(): Hono;
  getBasicAuthCredentials?(): [string, string];
  signingKey?: string | null;
  getFullUrl?(includeAuth?: boolean): string;
  getPrompt?(): unknown;
  getRegisteredTools?(): {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }[];
  getTool?(name: string): SwaigFunction | undefined;
}

const isAgent = (t: LoadedTarget) => typeof t.getPrompt === 'function';

/** Output for the user, and for warnings (stderr). */
interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  verbose: (line: string) => void;
}

/** The target's HTTP app, called as SignalWire would call it. */
class Client {
  constructor(
    private readonly target: LoadedTarget,
    private readonly headers: Record<string, string>,
  ) {}

  /** The route prefix of the target's app ('' for '/'). */
  get prefix(): string {
    const route = this.target.route ?? '/';
    return route === '/' ? '' : route.replace(/\/+$/, '');
  }

  async send(method: string, pathAndQuery: string, body?: string): Promise<Response> {
    const headers: Record<string, string> = { ...this.headers };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const creds = this.target.getBasicAuthCredentials?.();
    if (creds?.[0] && creds[1]) {
      headers['Authorization'] =
        'Basic ' + Buffer.from(`${creds[0]}:${creds[1]}`).toString('base64');
    }
    // Signed as SignalWire signs it, when the agent checks signatures.
    // Over the public URL the agent reconstructs: SWML_PROXY_URL_BASE and
    // the path, or the URL as received.
    const key = this.target.signingKey;
    if (key) {
      const proxyBase = process.env['SWML_PROXY_URL_BASE']?.replace(/\/+$/, '');
      const signed = `${proxyBase ?? 'http://localhost'}${pathAndQuery}${body ?? ''}`;
      headers['X-SignalWire-Signature'] = createHmac('sha1', key).update(signed).digest('hex');
      headers['X-SignalWire-Sha256-Signature'] = createHmac('sha256', key)
        .update(signed)
        .digest('hex');
    }
    return this.target.getApp().request(pathAndQuery, { method, headers, body });
  }
}

function queryString(params: Data): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    search.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

function parseJsonOption(name: string, text: string | undefined, io: Io): Data {
  if (!text) return {};
  try {
    const value = JSON.parse(text) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Data;
    io.err(`Warning: ${name} must be a JSON object; ignored`);
  } catch (err) {
    io.err(`Warning: Invalid JSON in ${name}: ${err instanceof Error ? err.message : err}`);
  }
  return {};
}

/** Fetch the SWML the target serves for a simulated call. */
async function fetchSwml(client: Client, opts: CliOptions, postData: Data, io: Io): Promise<Data> {
  const query = parseJsonOption('--query-params', opts.queryParams, io);
  const extraBody = parseJsonOption('--body', opts.body, io);
  const method = opts.method.toUpperCase();
  let path = client.prefix || '/';
  let body: string | undefined;
  if (method === 'GET') {
    const callId = (postData['call'] as Data | undefined)?.['call_id'] ?? postData['call_id'];
    path += queryString({ ...(callId ? { call_id: callId } : {}), ...query });
  } else {
    path += queryString(query);
    body = JSON.stringify({ ...postData, ...extraBody });
  }
  io.verbose(`${method} ${path}`);
  if (body) io.verbose(`Request body: ${body}`);
  const res = await client.send(method, path, body);
  const text = await res.text();
  if (!res.ok) throw new Error(`The agent answered the SWML request with ${res.status}: ${text}`);
  try {
    return JSON.parse(text) as Data;
  } catch {
    throw new Error(`The agent's SWML isn't JSON: ${text.slice(0, 200)}`);
  }
}

interface SwaigEntry extends Data {
  function: string;
  description?: string;
  parameters?: Data;
  web_hook_url?: string;
  data_map?: Data;
}

/** The AI verb's SWAIG block: its functions, and the default web_hook_url. */
function swaigOf(doc: Data): { functions: SwaigEntry[]; defaultUrl?: string } {
  const main = ((doc['sections'] as Data | undefined)?.['main'] ?? []) as Data[];
  for (const verb of main) {
    const ai = (verb?.['ai'] ?? verb?.['amazon_bedrock']) as Data | undefined;
    if (!ai) continue;
    const swaig = (ai['SWAIG'] ?? {}) as Data;
    const functions = (Array.isArray(swaig['functions']) ? swaig['functions'] : []) as SwaigEntry[];
    const defaults = (swaig['defaults'] ?? {}) as Data;
    return {
      functions,
      defaultUrl:
        typeof defaults['web_hook_url'] === 'string' ? defaults['web_hook_url'] : undefined,
    };
  }
  return { functions: [] };
}

/**
 * The path in the target's own app a web_hook_url names, or null when it
 * points somewhere else (an external webhook).
 */
function localPath(target: LoadedTarget, client: Client, url: string): string | null {
  if (!target.getFullUrl) return null;
  try {
    const hook = new URL(url);
    const base = new URL(target.getFullUrl(false));
    const hookPath = `${hook.origin}${hook.pathname}`;
    const basePath = `${base.origin}${base.pathname}`.replace(/\/+$/, '');
    if (hookPath !== basePath && !hookPath.startsWith(`${basePath}/`)) return null;
    return `${client.prefix}${hookPath.slice(basePath.length)}${hook.search}` || '/';
  } catch {
    return null;
  }
}

type FunctionKind = 'datamap' | 'local' | 'external';

function kindOf(
  target: LoadedTarget,
  client: Client,
  entry: SwaigEntry,
  defaultUrl?: string,
): FunctionKind {
  if (entry.data_map) return 'datamap';
  const url = entry.web_hook_url ?? defaultUrl;
  return url && localPath(target, client, url) === null ? 'external' : 'local';
}

// ── Output ───────────────────────────────────────────────────────────────

function describeParameter(name: string, def: Data, required: boolean): string {
  const type = typeof def['type'] === 'string' ? (def['type'] as string) : 'unknown';
  const constraints: string[] = [];
  if (Array.isArray(def['enum'])) constraints.push(`options: ${def['enum'].join(', ')}`);
  const numeric: [string, string][] = [
    ['minimum', 'min'],
    ['maximum', 'max'],
    ['exclusiveMinimum', 'min (exclusive)'],
    ['exclusiveMaximum', 'max (exclusive)'],
    ['multipleOf', 'multiple of'],
    ['minLength', 'min length'],
    ['maxLength', 'max length'],
    ['pattern', 'pattern'],
    ['format', 'format'],
  ];
  for (const [key, label] of numeric)
    if (key in def) constraints.push(`${label}: ${String(def[key])}`);
  if (type === 'array') {
    if ('minItems' in def) constraints.push(`min items: ${String(def['minItems'])}`);
    if ('maxItems' in def) constraints.push(`max items: ${String(def['maxItems'])}`);
    if (def['uniqueItems']) constraints.push('unique items');
    const items = def['items'] as Data | undefined;
    if (items?.['type']) constraints.push(`item type: ${String(items['type'])}`);
  }
  if ('default' in def) constraints.push(`default: ${JSON.stringify(def['default'])}`);
  const typeText = constraints.length ? `${type} [${constraints.join(', ')}]` : type;
  const description =
    typeof def['description'] === 'string' ? def['description'] : 'No description';
  return `      ${name} (${typeText})${required ? ' (required)' : ''}: ${description}`;
}

function printParameters(io: Io, parameters: unknown): void {
  const params = (parameters ?? {}) as Data;
  const props = (params['properties'] ?? params) as Record<string, Data>;
  const required = Array.isArray(params['required']) ? (params['required'] as string[]) : [];
  const names = Object.keys(props).filter((k) => props[k] && typeof props[k] === 'object');
  if (names.length === 0) {
    io.out('    Parameters: None');
    return;
  }
  io.out('    Parameters:');
  for (const name of names) io.out(describeParameter(name, props[name]!, required.includes(name)));
}

function formatResult(result: unknown): string {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const r = result as Data;
    if ('response' in r) {
      const lines = [
        `Response: ${typeof r['response'] === 'string' ? r['response'] : JSON.stringify(r['response'])}`,
      ];
      if (Array.isArray(r['action']) && r['action'].length) {
        lines.push('\nActions:', ...r['action'].map((a) => JSON.stringify(a, null, 2)));
      }
      if (r['post_process']) lines.push(`\nPost-process: ${String(r['post_process'])}`);
      return lines.join('\n');
    }
    return `Dict: ${JSON.stringify(result, null, 2)}`;
  }
  if (typeof result === 'string') return `String: ${result}`;
  return `Other: ${JSON.stringify(result)}`;
}

// ── Main ─────────────────────────────────────────────────────────────────

function applyEnvironment(opts: CliOptions, io: Io): ServerlessSimulator | null {
  const env: Record<string, string> = {};
  if (opts.envFile) {
    Object.assign(env, loadEnvFile(opts.envFile));
    io.verbose(`Loaded ${Object.keys(env).length} environment variables from ${opts.envFile}`);
  }
  for (const entry of opts.envVars) {
    const eq = entry.indexOf('=');
    if (eq <= 0) throw usageError(`--env requires KEY=VALUE, got ${entry}`);
    env[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  if (!opts.simulateServerless) {
    Object.assign(process.env, env);
    return null;
  }

  const platform = SIMULATED_PLATFORMS[opts.simulateServerless]!;
  const set = (key: string, value: string | undefined) => {
    if (value) env[key] = value;
  };
  // The preset's function URL would win over the parts the user gave, so an
  // empty override leaves it out and the SDK builds the URL from them.
  if (platform === 'lambda') {
    if ((opts.awsFunctionName || opts.awsRegion) && !opts.awsFunctionUrl) {
      env['AWS_LAMBDA_FUNCTION_URL'] ??= '';
    }
    set('AWS_LAMBDA_FUNCTION_NAME', opts.awsFunctionName);
    set('AWS_LAMBDA_FUNCTION_URL', opts.awsFunctionUrl);
    set('AWS_REGION', opts.awsRegion);
    // Behind API Gateway, the agent's URL is the gateway's.
    if (opts.awsApiGatewayId && opts.awsFunctionUrl) {
      io.err('Warning: --aws-api-gateway-id is ignored when --aws-function-url is set');
    } else if (opts.awsApiGatewayId) {
      env['AWS_LAMBDA_FUNCTION_URL'] =
        `https://${opts.awsApiGatewayId}.execute-api.${opts.awsRegion || 'us-east-1'}` +
        `.amazonaws.com/${opts.awsStage || 'prod'}`;
    } else if (opts.awsStage) {
      io.err('Warning: --aws-stage only applies with --aws-api-gateway-id');
    }
  } else if (platform === 'cgi') {
    set('HTTP_HOST', opts.cgiHost);
    set('SERVER_NAME', opts.cgiHost);
    set('SCRIPT_NAME', opts.cgiScriptName);
    if (opts.cgiHttps) env['HTTPS'] = 'on';
    set('PATH_INFO', opts.cgiPathInfo);
  } else if (platform === 'cloud_function') {
    if ((opts.gcpProject || opts.gcpRegion || opts.gcpService) && !opts.gcpFunctionUrl) {
      env['FUNCTION_URL'] ??= '';
    }
    set('GOOGLE_CLOUD_PROJECT', opts.gcpProject);
    set('FUNCTION_URL', opts.gcpFunctionUrl);
    set('GOOGLE_CLOUD_REGION', opts.gcpRegion);
    set('K_SERVICE', opts.gcpService);
  } else if (platform === 'azure_function') {
    set('AZURE_FUNCTIONS_ENVIRONMENT', opts.azureEnv);
    set('AZURE_FUNCTION_URL', opts.azureFunctionUrl);
  }
  const simulator = new ServerlessSimulator(platform, env);
  simulator.activate();
  io.verbose(`Simulating ${platform}: ${JSON.stringify(simulator.environment)}`);
  return simulator;
}

async function run(opts: CliOptions, io: Io): Promise<number> {
  if (opts.action === 'list-agents') {
    const agents = await describeAgents(opts.agentPath);
    if (opts.raw || opts.formatJson) {
      io.out(JSON.stringify(agents, null, 2));
      return 0;
    }
    if (agents.length === 0) {
      io.out(`No agents found in ${opts.agentPath}`);
      return 1;
    }
    io.out(`\nAgents found in ${opts.agentPath}:`);
    for (const a of agents) {
      io.out(`  ${a.name} (${a.kind})`);
      if (a.kind === 'instance') {
        io.out(`    Name: ${a.agentName}`);
        io.out(`    Route: ${a.route}`);
      }
    }
    return 0;
  }

  const target = (await loadAgent(opts.agentPath, opts.agentClass, {
    route: opts.route,
  })) as LoadedTarget;

  const headers: Record<string, string> = {};
  for (const entry of opts.headers) {
    const eq = entry.indexOf('=');
    if (eq <= 0) throw usageError(`--header requires NAME=VALUE, got ${entry}`);
    headers[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  const client = new Client(target, headers);
  const flags = {
    callId: opts.callId,
    projectId: opts.projectId,
    spaceId: opts.spaceId,
    callState: opts.callState,
    callDirection: opts.callDirection,
    callType: opts.callType,
    fromNumber: opts.fromNumber,
    toExtension: opts.toExtension,
    userVars: parseJsonOption('--user-vars', opts.userVars, io),
    queryParams: parseJsonOption('--query-params', opts.queryParams, io),
  };
  const swmlPostData = () =>
    applyOverrides(
      applyConvenienceMappings(
        fakeSwmlPostData(opts.callType, opts.callDirection, opts.callState),
        flags,
      ),
      opts.overrides,
      opts.overrideJson,
      io.err,
    );

  if (opts.action === 'dump-swml') {
    const doc = await fetchSwml(client, opts, swmlPostData(), io);
    io.out(opts.raw ? JSON.stringify(doc) : JSON.stringify(doc, null, 2));
    return 0;
  }

  // A plain SWMLService has no SWAIG block to read; use its registry.
  if (!isAgent(target)) {
    const tools = target.getRegisteredTools?.() ?? [];
    if (opts.action === 'list-tools') {
      if (opts.raw || opts.formatJson) io.out(JSON.stringify(tools, null, 2));
      else {
        io.out('\nAvailable SWAIG functions:');
        if (tools.length === 0) io.out('  No SWAIG functions registered');
        for (const t of tools) {
          io.out(`  ${t.name} - ${t.description} (LOCAL webhook)`);
          printParameters(io, t.parameters);
        }
      }
      return 0;
    }
    const tool = tools.find((t) => t.name === opts.execName);
    if (!tool) {
      io.out(`Error: Function '${opts.execName}' not found.`);
      return 1;
    }
    let args: Data;
    try {
      args = parseFunctionArguments(opts.functionTokens, tool.parameters);
    } catch (err) {
      io.out(`Error parsing arguments: ${err instanceof Error ? err.message : err}`);
      return 1;
    }
    for (const w of undeclaredArgumentWarnings(args, tool.parameters, CLI_OPTIONS)) io.err(w);
    // Through the service's own /swaig route, as a call would reach it.
    const request = functionRequestData(opts, flags, io);
    const body = JSON.stringify({
      ...request,
      params: args,
      function: tool.name,
      argument: { parsed: [args], raw: JSON.stringify(args) },
    });
    return printCallResult(await client.send('POST', `${client.prefix}/swaig`, body), opts, io);
  }

  if (opts.action === 'list-tools') {
    const doc = await fetchSwml(client, opts, swmlPostData(), io);
    const { functions, defaultUrl } = swaigOf(doc);
    if (opts.raw || opts.formatJson) {
      const list = functions.map((f) => {
        const kind = kindOf(target, client, f, defaultUrl);
        return {
          name: f.function,
          description: f.description ?? '',
          parameters: f.parameters ?? {},
          type: kind,
          ...(kind === 'external' ? { web_hook_url: f.web_hook_url ?? defaultUrl } : {}),
        };
      });
      io.out(JSON.stringify(list, null, 2));
      return 0;
    }
    io.out('\nAvailable SWAIG functions:');
    if (functions.length === 0) io.out('  No SWAIG functions registered');
    for (const f of functions) {
      const kind = kindOf(target, client, f, defaultUrl);
      const suffix =
        kind === 'local' ? ' (LOCAL webhook)' : kind === 'external' ? ' (EXTERNAL webhook)' : '';
      const description =
        f.description ?? (kind === 'datamap' ? 'DataMap function (serverless)' : '');
      io.out(`  ${f.function} - ${description}${suffix}`);
      if (kind === 'external') io.out(`    External URL: ${f.web_hook_url ?? defaultUrl}`);
      printParameters(io, f.parameters);
      if (opts.verbose)
        io.out(`    Config: ${JSON.stringify(f, null, 2).replace(/\n/g, '\n    ')}`);
    }
    return 0;
  }

  // --exec: the SWML for the call names the function and where to call it.
  // The SWML request and the function request describe the same call.
  const name = opts.execName!;
  const callData = functionRequestData(opts, flags, io, name);
  const callId = String(
    callData['call_id'] ?? (callData['call'] as Data | undefined)?.['call_id'] ?? '',
  );
  const swmlData = applyOverrides(
    applyConvenienceMappings(fakeSwmlPostData(opts.callType, opts.callDirection, opts.callState), {
      ...flags,
      callId,
    }),
    opts.overrides,
    opts.overrideJson,
    () => undefined,
  );
  const doc = await fetchSwml(client, opts, swmlData, io);
  const { functions, defaultUrl } = swaigOf(doc);
  const entry = functions.find((f) => f.function === name);
  if (!entry) {
    io.out(`Error: Function '${name}' not found.`);
    io.out(`Available functions: ${functions.map((f) => f.function).join(', ') || '(none)'}`);
    return 1;
  }

  let args: Data;
  try {
    args = parseFunctionArguments(opts.functionTokens, entry.parameters);
  } catch (err) {
    io.out(`Error parsing arguments: ${err instanceof Error ? err.message : err}`);
    return 1;
  }
  for (const w of undeclaredArgumentWarnings(args, entry.parameters, CLI_OPTIONS)) io.err(w);

  const kind = kindOf(target, client, entry, defaultUrl);
  io.verbose(
    `\nCalling ${kind === 'datamap' ? 'DataMap' : kind === 'external' ? 'EXTERNAL webhook' : 'LOCAL webhook'} function: ${name}`,
  );
  io.verbose(`Arguments: ${JSON.stringify(args, null, 2)}`);

  let result: unknown;
  if (kind === 'datamap') {
    // --custom-data is the call data the platform adds, such as global_data.
    // It was parsed, and any warning given, for the function request above.
    const custom = parseJsonOption('--custom-data', opts.customData, {
      ...io,
      err: () => undefined,
    });
    result = await executeDataMap(entry, args, {
      verbose: opts.verbose && !opts.raw,
      ...(opts.customData ? { callData: custom } : {}),
    });
  } else {
    const payload = {
      ...callData,
      params: args,
      call_id: callId,
      function: name,
      argument: { parsed: [args], raw: JSON.stringify(args) },
    };
    const body = JSON.stringify(payload);
    io.verbose(`Request: ${body}`);
    const url = entry.web_hook_url ?? defaultUrl ?? '';
    if (kind === 'local') {
      return printCallResult(
        await client.send('POST', localPath(target, client, url)!, body),
        opts,
        io,
      );
    }
    io.verbose(`External URL: ${url}`);
    return printCallResult(await postExternal(url, body), opts, io);
  }

  if (opts.raw || opts.formatJson) io.out(JSON.stringify(result, null, 2));
  else io.out(`RESULT:\n${formatResult(result)}`);
  // Nothing produced a result, so the platform answers with its generic
  // error, or the expanded output isn't JSON, so the platform gets none.
  const r = (result ?? {}) as Data;
  const keys = Object.keys(r);
  const failed =
    keys.length === 1 &&
    (r['response'] === PLATFORM_ERROR_RESPONSE || typeof r['error'] === 'string');
  if (failed && r['response'] === PLATFORM_ERROR_RESPONSE) {
    io.err(
      'Nothing produced a result: no expression matched, no webhook succeeded with an ' +
        'output, and there is no data_map output. The platform answers with its generic error.',
    );
  }
  return failed ? 1 : 0;
}

/** The function request for --exec: minimal or full, with the call flags and overrides. */
function functionRequestData(
  opts: CliOptions,
  flags: Parameters<typeof applyConvenienceMappings>[1],
  io: Io,
  name = opts.execName ?? '',
): Data {
  const custom = parseJsonOption('--custom-data', opts.customData, io);
  const skeleton = opts.minimal
    ? { ...minimalPostData({}), ...custom }
    : comprehensivePostData(name, {}, custom);
  return applyOverrides(
    applyConvenienceMappings(skeleton, flags),
    opts.overrides,
    opts.overrideJson,
    io.err,
  );
}

/** Seconds to wait for an external webhook. */
const EXTERNAL_TIMEOUT = 30;

/** POST to an external webhook; credentials in its URL become basic auth. */
async function postExternal(url: string, body: string): Promise<Response> {
  const target = new URL(url);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'SignalWire-SWAIG-Test/1.0',
  };
  if (target.username || target.password) {
    const creds = `${decodeURIComponent(target.username)}:${decodeURIComponent(target.password)}`;
    headers['Authorization'] = 'Basic ' + Buffer.from(creds).toString('base64');
    target.username = '';
    target.password = '';
  }
  return fetch(target, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT * 1000),
  });
}

/** Print the SWAIG response of a function call; exit status 1 unless it's 2xx. */
async function printCallResult(res: Response, opts: CliOptions, io: Io): Promise<number> {
  const text = await res.text();
  if (!res.ok) {
    io.out(`Error calling function: HTTP ${res.status}: ${text}`);
    return 1;
  }
  let result: unknown;
  try {
    result = JSON.parse(text) as unknown;
  } catch {
    result = { response: text };
  }
  if (opts.raw || opts.formatJson) io.out(JSON.stringify(result, null, 2));
  else io.out(`RESULT:\n${formatResult(result)}`);
  return 0;
}

async function main(): Promise<number> {
  let argv = process.argv.slice(2);
  // --parse-only / --dry-run: stripped first, so it works wherever it is,
  // even after --exec's arguments.
  const parseOnly = argv.includes('--parse-only') || argv.includes('--dry-run');
  argv = argv.filter((a) => a !== '--parse-only' && a !== '--dry-run');

  if (argv.includes('--help-platforms')) {
    printHelpPlatforms();
    return 0;
  }
  if (argv.includes('--help-examples')) {
    printHelpExamples();
    return 0;
  }
  const beforeExec = argv.includes('--exec') ? argv.slice(0, argv.indexOf('--exec')) : argv;
  if (
    beforeExec.includes('--help') ||
    beforeExec.includes('-h') ||
    (argv.length === 0 && !parseOnly)
  ) {
    printHelp();
    return 0;
  }

  let opts: CliOptions;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    if (!isUsageError(err)) throw err;
    console.error(`Error: ${err.message}\n\n${USAGE}\nFor full help: swaig-test --help`);
    return 2;
  }
  if (parseOnly) {
    console.log('parse OK');
    return 0;
  }
  if (!opts.action) {
    if (!opts.simulateServerless) {
      console.error('Error: one of --dump-swml, --list-tools, or --exec is required');
      return 2;
    }
    opts.action = 'dump-swml';
  }
  const quiet = opts.raw || (opts.action === 'dump-swml' && !opts.verbose);
  if (quiet) suppressAllLogs(true);
  else setGlobalLogLevel(opts.verbose ? 'debug' : 'error');

  const io: Io = {
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    verbose: (line) => {
      if (opts.verbose && !opts.raw) console.log(line);
    },
  };

  let simulator: ServerlessSimulator | null = null;
  try {
    simulator = applyEnvironment(opts, io);
    return await run(opts, io);
  } catch (err) {
    if (isUsageError(err)) {
      console.error(`Error: ${err.message}`);
      return 2;
    }
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    if (opts.verbose && err instanceof Error && err.stack) console.error(err.stack);
    return 1;
  } finally {
    simulator?.deactivate();
  }
}

// exitCode rather than exit(), so piped output is flushed first.
main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  },
);
