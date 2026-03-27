/**
 * Individual tests for the McpGateway skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { McpGatewaySkill, createMcpGatewaySkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('McpGatewaySkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new McpGatewaySkill()).toBeInstanceOf(SkillBase);
    expect(createMcpGatewaySkill()).toBeInstanceOf(McpGatewaySkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new McpGatewaySkill().setup()).resolves.toBeUndefined();
  });

  it('should register tools', () => {
    const tools = new McpGatewaySkill().getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should provide prompt sections', () => {
    const sections = new McpGatewaySkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new McpGatewaySkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return empty hints and global data', () => {
    const skill = new McpGatewaySkill();
    expect(skill.getHints()).toEqual([]);
    expect(skill.getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new McpGatewaySkill().getManifest();
    expect(manifest.name).toBe('mcp_gateway');
    expect(manifest.version).toBe('0.1.0');
  });

  it('should accept gateway_url config', () => {
    const skill = new McpGatewaySkill({ gateway_url: 'http://localhost:8080' });
    expect(skill.getConfig('gateway_url')).toBe('http://localhost:8080');
  });

  it('should have a parameter schema', () => {
    const schema = McpGatewaySkill.getParameterSchema();
    expect(schema['gateway_url']).toBeDefined();
    expect(schema['tool_prefix']).toBeDefined();
  });
});
