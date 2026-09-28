/**
 * The simulated platform for swaig-test: the request data SignalWire would
 * send, the overrides and convenience flags applied to it, and serverless
 * environments.
 *
 * Mirrors signalwire-python's `signalwire.cli.simulation` (data_generation,
 * data_overrides, mock_env).
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Data = Record<string, unknown>;

const hex = (n: number) =>
  randomBytes(Math.ceil(n / 2))
    .toString('hex')
    .slice(0, n);

function isPlainObject(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A 'from' address for the call type: a phone number for SIP, a WebRTC address otherwise. */
function fakeFrom(callType: string): string {
  return callType === 'sip' ? `+1555${hex(7)}` : `user-${hex(8)}@test.domain`;
}

function fakeTo(callType: string): string {
  return callType === 'sip' ? `+1444${hex(7)}` : `agent-${hex(8)}@test.domain`;
}

/**
 * The body SignalWire sends when it fetches SWML: `call`, `vars` and `envs`.
 * @param callType - `sip` or `webrtc`.
 * @param callDirection - `inbound` or `outbound`.
 * @param callState - The call state, e.g. `created`.
 */
export function fakeSwmlPostData(
  callType = 'webrtc',
  callDirection = 'inbound',
  callState = 'created',
): Data {
  const callId = randomUUID();
  const now = new Date().toISOString();
  const from = fakeFrom(callType);
  const to = fakeTo(callType);
  const call: Data = {
    call_id: callId,
    node_id: `test-node-${hex(8)}`,
    segment_id: randomUUID(),
    call_session_id: randomUUID(),
    tag: callId,
    state: callState,
    direction: callDirection,
    type: callType === 'sip' ? 'phone' : 'webrtc',
    from,
    to,
    timeout: 30,
    max_duration: 14400,
    answer_on_bridge: false,
    hangup_after_bridge: true,
    ringback: [],
    record: {},
    project_id: randomUUID(),
    space_id: randomUUID(),
    created_at: now,
    updated_at: now,
    headers:
      callType === 'sip'
        ? {
            'User-Agent': 'Test-SIP-Client/1.0.0',
            From: `<sip:${from}@test.sip.provider>`,
            To: `<sip:${to}@test.sip.provider>`,
            'Call-ID': callId,
          }
        : {
            'User-Agent': 'Test-WebRTC-Client/1.0.0',
            Origin: 'https://test.webrtc.app',
            'Sec-WebSocket-Protocol': 'sip',
          },
  };
  return { call, vars: { userVariables: {} }, envs: {} };
}

/**
 * The smallest SWAIG function request: the call id and the arguments.
 * @param args - The function's arguments.
 */
export function minimalPostData(args: Data): Data {
  return { call_id: randomUUID(), params: args };
}

/**
 * A SWAIG function request with every key SignalWire may send: call, vars,
 * global_data, call_log and the rest. `customData` merges in, one level deep.
 * @param functionName - The function being called.
 * @param args - Its arguments.
 * @param customData - Values to merge over the defaults.
 */
export function comprehensivePostData(functionName: string, args: Data, customData?: Data): Data {
  const callId = randomUUID();
  const sessionId = randomUUID();
  const projectId = randomUUID();
  const spaceId = randomUUID();
  const now = new Date().toISOString();
  const toolCall = {
    id: `call_${callId.slice(0, 8)}`,
    type: 'function',
    function: { name: functionName, arguments: JSON.stringify(args) },
  };
  const system = {
    role: 'system',
    content: 'You are a helpful AI assistant created with SignalWire AI Agents.',
  };
  const ask = { role: 'user', content: `Please call the ${functionName} function` };
  const answer = {
    role: 'assistant',
    content: `I'll call the ${functionName} function for you.`,
    tool_calls: [toolCall],
  };
  const data: Data = {
    call_id: callId,
    call: {
      call_id: callId,
      node_id: `test-node-${hex(8)}`,
      segment_id: randomUUID(),
      call_session_id: randomUUID(),
      to: '+15551234567',
      from: '+15559876543',
      direction: 'inbound',
      state: 'answered',
      tag: callId,
      project_id: projectId,
      space_id: spaceId,
      headers: { 'User-Agent': 'SignalWire/1.0' },
      type: 'phone',
      timeout: 30,
      answer_on_bridge: false,
      created_at: now,
      updated_at: now,
    },
    vars: {
      environment: 'production',
      space_id: spaceId,
      userVariables: {},
      call_data: {
        id: callId,
        state: 'answered',
        type: 'phone',
        from: '+15559876543',
        to: '+15551234567',
        project_id: projectId,
        created_at: now,
      },
    },
    params: args,
    space_id: spaceId,
    project_id: projectId,
    meta_data: {
      application: { name: 'SignalWire AI Agent', version: '1.0.0' },
      swml: { version: '1.0.0', session_id: sessionId },
      ai: { call_id: callId, session_id: sessionId, conversation_id: sessionId },
      request: { method: 'POST', source_ip: '192.168.1.1', user_agent: 'SignalWire-AI-Agent/1.0' },
      timing: { request_start: now, function_start: now },
      user: { id: `user-${hex(8)}`, session_start: now, last_updated: now },
    },
    global_data: {
      app_name: 'test_application',
      environment: 'test',
      user_preferences: { language: 'en' },
      session_data: { start_time: now },
    },
    call_log: [system, ask, answer],
    raw_call_log: [
      system,
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hello! How can I help you today?' },
      ask,
      answer,
    ],
    prompt_vars: {
      ai_instructions: 'You are a helpful assistant',
      temperature: 0.7,
      max_tokens: 1000,
      app_name: 'test_application',
      environment: 'test',
      user_preferences: { language: 'en' },
      session_data: { start_time: now },
      current_timestamp: now,
      call_duration: '00:02:15',
      caller_number: '+15551234567',
      to_number: '+15559876543',
    },
    swaig_allow_swml: true,
    swaig_post_conversation: true,
    swaig_post_swml_vars: true,
    http_method: 'POST',
    webhook_url: `https://test.example.com/webhook/${functionName}`,
    user_agent: 'SignalWire-AI-Agent/1.0',
    request_headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SignalWire-AI-Agent/1.0',
      'X-Signalwire-Call-Id': callId,
      'X-Signalwire-Session-Id': sessionId,
    },
    swml_env: {
      space_id: spaceId,
      project_id: projectId,
      environment: 'production',
      space_name: 'test-space',
      api_version: '1.0.0',
    },
  };
  for (const [key, value] of Object.entries(customData ?? {})) {
    if (isPlainObject(data[key]) && isPlainObject(value)) {
      data[key] = { ...(data[key] as Data), ...value };
    } else {
      data[key] = value;
    }
  }
  return data;
}

/** Keys a dotted path must never create or walk through. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Set a value at a dotted path (`call.state`, `vars.userVariables.vip`),
 * creating objects on the way.
 * @returns False when the path names an unsafe key and nothing was set.
 */
export function setNested(data: Data, path: string, value: unknown): boolean {
  const keys = path.split('.');
  if (keys.some((k) => UNSAFE_KEYS.has(k) || k === '')) return false;
  let current = data;
  for (const key of keys.slice(0, -1)) {
    if (!isPlainObject(current[key])) current[key] = {};
    current = current[key] as Data;
  }
  current[keys[keys.length - 1]!] = value;
  return true;
}

function hasPath(data: Data, path: string): boolean {
  let current: unknown = data;
  for (const key of path.split('.')) {
    if (!isPlainObject(current) || !(key in current)) return false;
    current = current[key];
  }
  return true;
}

/**
 * A `--override` value as its type: null, true, false, a number, JSON, or
 * the string itself, as the reference parses it.
 */
export function parseOverrideValue(text: string): unknown {
  const lower = text.toLowerCase();
  if (lower === 'null') return null;
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (/^-?\d+$/.test(text)) return parseInt(text, 10);
  if (/^-?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(text)) return parseFloat(text);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Apply `--override path=value` and `--override-json path=json` to a copy
 * of the request data.
 * @param warn - Called for each override the request data didn't have a
 *   place for, and each unparsable JSON override.
 */
export function applyOverrides(
  data: Data,
  overrides: string[],
  jsonOverrides: string[],
  warn: (message: string) => void,
): Data {
  const out = structuredClone(data);
  const apply = (entry: string, flag: string, parse: (text: string) => unknown) => {
    const eq = entry.indexOf('=');
    if (eq <= 0) {
      warn(`Warning: ${flag} ${entry} has no path=value; ignored`);
      return;
    }
    const path = entry.slice(0, eq);
    let value: unknown;
    try {
      value = parse(entry.slice(eq + 1));
    } catch (err) {
      warn(
        `Warning: invalid JSON in ${flag} ${entry}: ${err instanceof Error ? err.message : err}`,
      );
      return;
    }
    if (!hasPath(out, path)) {
      warn(
        `Warning: ${flag} ${path} adds a key the simulated request doesn't have; ` +
          'check the spelling (paths are dotted, e.g. call.state).',
      );
    }
    if (!setNested(out, path, value))
      warn(`Warning: ${flag} ${path} names a reserved key; ignored`);
  };
  for (const entry of overrides) apply(entry, '--override', parseOverrideValue);
  for (const entry of jsonOverrides) apply(entry, '--override-json', (t) => JSON.parse(t));
  return out;
}

/** The convenience flags applied to the request data (the reference's apply_convenience_mappings). */
export interface ConvenienceFlags {
  callId?: string;
  projectId?: string;
  spaceId?: string;
  callState?: string;
  callDirection?: string;
  callType?: string;
  fromNumber?: string;
  toExtension?: string;
  /** `--user-vars` JSON. */
  userVars?: Data;
  /** `--query-params` JSON, also merged into userVariables. */
  queryParams?: Data;
}

/**
 * Apply the convenience flags to a copy of the request data: `--call-id`,
 * `--project-id`, `--space-id`, `--call-state`, `--call-direction`,
 * `--from-number`, `--to-extension`, and the user variables.
 */
export function applyConvenienceMappings(data: Data, flags: ConvenienceFlags): Data {
  const out = structuredClone(data);
  if (flags.callId) {
    out['call_id'] = flags.callId;
    if (isPlainObject(out['call'])) {
      setNested(out, 'call.call_id', flags.callId);
      setNested(out, 'call.tag', flags.callId);
    }
  }
  if (flags.projectId) setNested(out, 'call.project_id', flags.projectId);
  if (flags.spaceId) setNested(out, 'call.space_id', flags.spaceId);
  if (flags.callState) setNested(out, 'call.state', flags.callState);
  if (flags.callDirection) setNested(out, 'call.direction', flags.callDirection);
  // The call type as the SWML request reports it, so the function request matches.
  if (flags.callType && isPlainObject(out['call'])) {
    setNested(out, 'call.type', flags.callType === 'sip' ? 'phone' : 'webrtc');
  }
  const address = (value: string, sipPrefix: string, callType?: string) => {
    if (value.startsWith('+') || /^\d+$/.test(value)) return value;
    return callType === 'sip' ? `${sipPrefix}${hex(7)}` : `${value}@test.domain`;
  };
  if (flags.fromNumber)
    setNested(out, 'call.from', address(flags.fromNumber, '+1555', flags.callType));
  if (flags.toExtension)
    setNested(out, 'call.to', address(flags.toExtension, '+1444', flags.callType));
  const userVars = { ...(flags.userVars ?? {}), ...(flags.queryParams ?? {}) };
  if (Object.keys(userVars).length > 0) {
    const vars = isPlainObject(out['vars']) ? (out['vars'] as Data) : (out['vars'] = {});
    const current = isPlainObject(vars['userVariables']) ? (vars['userVariables'] as Data) : {};
    vars['userVariables'] = { ...current, ...userVars };
  }
  return out;
}

/** The serverless platforms swaig-test simulates, by the names it accepts. */
export const SIMULATED_PLATFORMS: Record<string, string> = {
  lambda: 'lambda',
  cgi: 'cgi',
  gcf: 'cloud_function',
  cloud_function: 'cloud_function',
  azure: 'azure_function',
  azure_function: 'azure_function',
};

/** Each platform's environment, as the reference simulates it. */
const PLATFORM_PRESETS: Record<string, Record<string, string>> = {
  lambda: {
    AWS_LAMBDA_FUNCTION_NAME: 'test-agent-function',
    AWS_LAMBDA_FUNCTION_URL: 'https://abc123.lambda-url.us-east-1.on.aws/',
    AWS_REGION: 'us-east-1',
    _HANDLER: 'lambda_function.lambda_handler',
  },
  cgi: {
    GATEWAY_INTERFACE: 'CGI/1.1',
    HTTP_HOST: 'example.com',
    SCRIPT_NAME: '/cgi-bin/agent.cgi',
    HTTPS: 'on',
    SERVER_NAME: 'example.com',
  },
  cloud_function: {
    GOOGLE_CLOUD_PROJECT: 'test-project',
    FUNCTION_TARGET: 'agent',
    FUNCTION_URL: 'https://my-function-abc123.cloudfunctions.net',
    GOOGLE_CLOUD_REGION: 'us-central1',
    K_SERVICE: 'agent',
  },
  azure_function: {
    AZURE_FUNCTIONS_ENVIRONMENT: 'Development',
    FUNCTIONS_WORKER_RUNTIME: 'node',
    WEBSITE_SITE_NAME: 'my-function-app',
  },
};

/**
 * A serverless platform's environment, applied to `process.env` and removed
 * again: the platform's variables (the preset, then the overrides), with
 * other platforms' variables and `SWML_PROXY_URL_BASE` cleared, so the
 * agent's webhook URLs are the platform's.
 */
/** Every variable a platform is detected by or builds its URL from. */
const PLATFORM_VARIABLES = [
  'GATEWAY_INTERFACE',
  'HTTP_HOST',
  'SERVER_NAME',
  'SCRIPT_NAME',
  'HTTPS',
  'PATH_INFO',
  'AWS_LAMBDA_FUNCTION_NAME',
  'AWS_LAMBDA_FUNCTION_URL',
  'AWS_REGION',
  'LAMBDA_TASK_ROOT',
  '_HANDLER',
  'FUNCTION_TARGET',
  'FUNCTION_URL',
  'FUNCTION_REGION',
  'K_SERVICE',
  'GOOGLE_CLOUD_PROJECT',
  'GCP_PROJECT',
  'GOOGLE_CLOUD_REGION',
  'AZURE_FUNCTIONS_ENVIRONMENT',
  'FUNCTIONS_WORKER_RUNTIME',
  'WEBSITE_SITE_NAME',
  'AZURE_FUNCTIONS_APP_NAME',
  'AZURE_FUNCTION_NAME',
  'AZURE_FUNCTION_URL',
  'SWML_PROXY_URL_BASE',
];

export class ServerlessSimulator {
  private snapshot: NodeJS.ProcessEnv | null = null;

  /**
   * @param platform - `lambda`, `cgi`, `cloud_function` or `azure_function`.
   * @param overrides - Variables to set over the preset.
   */
  constructor(
    readonly platform: string,
    readonly overrides: Record<string, string> = {},
  ) {}

  /** The variables the simulation sets. */
  get environment(): Record<string, string> {
    return { ...(PLATFORM_PRESETS[this.platform] ?? {}), ...this.overrides };
  }

  /**
   * Apply the platform's environment: every platform variable not in it is
   * cleared, so an inherited one (LAMBDA_TASK_ROOT, say) can't make another
   * platform win detection.
   */
  activate(): void {
    this.snapshot = { ...process.env };
    const environment = this.environment;
    for (const key of PLATFORM_VARIABLES) {
      if (!(key in environment)) delete process.env[key];
    }
    Object.assign(process.env, environment);
    if (this.platform === 'cgi' && !('SIGNALWIRE_LOG_MODE' in this.overrides)) {
      process.env['SIGNALWIRE_LOG_MODE'] = 'off';
    }
  }

  /** Restore the environment as it was, removing what was added since. */
  deactivate(): void {
    if (!this.snapshot) return;
    for (const key of Object.keys(process.env)) {
      if (!(key in this.snapshot)) delete process.env[key];
    }
    Object.assign(process.env, this.snapshot);
    this.snapshot = null;
  }
}

/**
 * Read `KEY=VALUE` lines from an environment file; `#` lines and blank lines
 * are skipped, and matching quotes around a value removed.
 */
export function loadEnvFile(filePath: string): Record<string, string> {
  const path = resolve(filePath);
  if (!existsSync(path)) throw new Error(`Environment file not found: ${filePath}`);
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}
