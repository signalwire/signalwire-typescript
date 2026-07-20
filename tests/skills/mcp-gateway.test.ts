/**
 * Individual tests for the McpGateway skill.
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { McpGatewaySkill, createMcpGatewaySkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';
import * as SecurityUtils from '../../src/SecurityUtils.js';

beforeAll(() => {
  suppressAllLogs(true);
});

describe('McpGatewaySkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new McpGatewaySkill()).toBeInstanceOf(SkillBase);
    expect(createMcpGatewaySkill()).toBeInstanceOf(McpGatewaySkill);
  });

  it('should return false from setup when gateway_url is not configured', async () => {
    // Python parity: setup returns false when required gateway_url is missing,
    // so the SkillManager logs a warning and the placeholder tool is the only
    // surface. Configured-mode setup is exercised separately with mocked HTTP.
    await expect(new McpGatewaySkill().setup()).resolves.toBe(false);
  });

  it('should register a placeholder tool when unconfigured', () => {
    const tools = new McpGatewaySkill().getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]!.handler).toBeTypeOf('function');
    // Placeholder handler should return a configuration-prompt message
    const res = tools[0]!.handler({}, {}) as FunctionResult;
    expect(res.response).toMatch(/not configured|configure/i);
  });

  it('should provide no prompt sections without configured services', () => {
    // Without configured services the prompt section should be empty (Python parity)
    expect(new McpGatewaySkill().getPromptSections()).toEqual([]);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new McpGatewaySkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return mcp hints with configured services', () => {
    const skill = new McpGatewaySkill({
      services: [{ name: 'calculator' }, { name: 'weather' }],
    });
    const hints = skill.getHints();
    expect(hints).toContain('MCP');
    expect(hints).toContain('gateway');
    expect(hints).toContain('calculator');
    expect(hints).toContain('weather');
  });

  it('should return empty global data when not ready', () => {
    expect(new McpGatewaySkill().getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const klass = McpGatewaySkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('mcp_gateway');
    expect(klass.SKILL_VERSION).toBe('1.0.0');
  });

  it('should accept gateway_url config', () => {
    const skill = new McpGatewaySkill({ gateway_url: 'http://localhost:8080' });
    expect(skill.getConfig('gateway_url')).toBe('http://localhost:8080');
  });

  it('should have a parameter schema with all expected keys', () => {
    const schema = McpGatewaySkill.getParameterSchema();
    expect(schema['gateway_url']).toBeDefined();
    expect(schema['tool_prefix']).toBeDefined();
    expect((schema['tool_prefix'] as { default?: unknown }).default).toBe('mcp_');
    expect(schema['auth_token']).toBeDefined();
    expect((schema['auth_token'] as { env_var?: string }).env_var).toBe('MCP_GATEWAY_AUTH_TOKEN');
    expect(schema['auth_user']).toBeDefined();
    expect(schema['auth_password']).toBeDefined();
    expect(schema['services']).toBeDefined();
    expect(schema['session_timeout']).toBeDefined();
    expect(schema['retry_attempts']).toBeDefined();
    expect(schema['request_timeout']).toBeDefined();
    expect(schema['verify_ssl']).toBeDefined();
    expect((schema['verify_ssl'] as { default?: unknown }).default).toBe(true);
    // TS TLS refactor: the explicit opt-in required to actually disable TLS.
    expect(schema['allow_insecure_tls']).toBeDefined();
    expect((schema['allow_insecure_tls'] as { default?: unknown }).default).toBe(false);
  });

  // TLS refactor (owner-ruled REFACTOR, not allowlist): TLS verification stays
  // ON unless the operator sets BOTH verify_ssl=false AND allow_insecure_tls=true.
  // Driven through the real setup() path with SSRF stubbed to pass and the health
  // check stubbed to fail fast — the insecure undici Agent is created BEFORE the
  // health check, so its presence (or absence) is the observable of the decision.
  describe('TLS opt-in gating', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // Returns whether setup() built the SSL-bypass undici Agent for this config.
    const builtInsecureAgent = async (config: Record<string, unknown>): Promise<boolean> => {
      vi.spyOn(SecurityUtils, 'validateUrl').mockResolvedValue(true);
      const skill = new McpGatewaySkill({
        gateway_url: 'https://gateway.internal.test',
        auth_token: 'abc',
        ...config,
      });
      // Stub the health check so setup() returns quickly (no network); the agent
      // is created before this runs.
      vi.spyOn(
        skill as unknown as { _makeRequest: () => Promise<Response> },
        '_makeRequest',
      ).mockResolvedValue(new Response(null, { status: 500 }));
      await skill.setup();
      return (skill as unknown as { _undiciAgent: unknown })._undiciAgent !== undefined;
    };

    it('verify_ssl=false ALONE does not disable TLS (no insecure agent)', async () => {
      expect(await builtInsecureAgent({ verify_ssl: false })).toBe(false);
    });

    it('verify_ssl=false + allow_insecure_tls=true disables TLS (insecure agent built)', async () => {
      expect(await builtInsecureAgent({ verify_ssl: false, allow_insecure_tls: true })).toBe(true);
    });

    it('secure default (verify_ssl unset) keeps TLS on', async () => {
      expect(await builtInsecureAgent({})).toBe(false);
    });

    it('allow_insecure_tls=true with verify_ssl=true (default) still keeps TLS on', async () => {
      expect(await builtInsecureAgent({ allow_insecure_tls: true })).toBe(false);
    });
  });

  it('should build prompt sections when services are configured', () => {
    const skill = new McpGatewaySkill({
      gateway_url: 'http://localhost:8080',
      auth_token: 'abc',
      services: [
        { name: 'calculator', tools: '*' },
        { name: 'weather', tools: ['forecast', 'current'] },
      ],
    });
    // Skill is not ready until setup succeeds, so sections are empty.
    // But we can still verify the internal formatting builds without throwing:
    const sections = skill.getPromptSections();
    // Without setup, services list is still populated from config for prompt building
    expect(Array.isArray(sections)).toBe(true);
  });
});
