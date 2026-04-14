/**
 * Individual tests for the SwmlTransfer skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SwmlTransferSkill, createSwmlTransferSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

describe('SwmlTransferSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new SwmlTransferSkill()).toBeInstanceOf(SkillBase);
    expect(createSwmlTransferSkill()).toBeInstanceOf(SwmlTransferSkill);
  });

  it('should complete setup without errors', async () => {
    await expect(new SwmlTransferSkill().setup()).resolves.toBe(true);
  });

  it('should register transfer_call tool by default', async () => {
    const skill = new SwmlTransferSkill();
    await skill.setup();
    const tools = skill.getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].name).toBe('transfer_call');
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should use custom tool_name if provided', async () => {
    const skill = new SwmlTransferSkill({ tool_name: 'my_transfer' });
    await skill.setup();
    expect(skill.getTools()[0].name).toBe('my_transfer');
  });

  it('should register list_transfer_destinations when patterns configured', async () => {
    const skill = new SwmlTransferSkill({
      patterns: [{ name: 'sales', destination: '+15551112222' }],
    });
    await skill.setup();
    const names = skill.getTools().map((t) => t.name);
    expect(names).toContain('list_transfer_destinations');
  });

  it('should provide prompt sections', () => {
    const sections = new SwmlTransferSkill().getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(new SwmlTransferSkill({ skip_prompt: true }).getPromptSections()).toHaveLength(0);
  });

  it('should return transfer hints', () => {
    const hints = new SwmlTransferSkill().getHints();
    expect(hints).toContain('transfer');
    expect(hints).toContain('connect');
    expect(hints).toContain('speak to');
    expect(hints).toContain('talk to');
  });

  it('should extract hints from transfer patterns', async () => {
    const skill = new SwmlTransferSkill({
      transfers: {
        sales: { address: '+15551112222' },
        'billing|accounts': { address: '+15552223333' },
      },
    });
    await skill.setup();
    const hints = skill.getHints();
    expect(hints).toContain('sales');
    expect(hints).toContain('billing');
    expect(hints).toContain('accounts');
  });

  it('should return empty global data', () => {
    expect(new SwmlTransferSkill().getGlobalData()).toEqual({});
  });

  it('should return correct manifest', () => {
    const manifest = new SwmlTransferSkill().getManifest();
    expect(manifest.name).toBe('swml_transfer');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should support multiple instances', () => {
    expect(SwmlTransferSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
    const a = new SwmlTransferSkill({ tool_name: 'a' });
    const b = new SwmlTransferSkill({ tool_name: 'b' });
    expect(a.getInstanceKey()).not.toBe(b.getInstanceKey());
  });

  it('should have a full parameter schema', () => {
    const schema = SwmlTransferSkill.getParameterSchema();
    expect(schema['transfers']).toBeDefined();
    expect(schema['tool_name']).toBeDefined();
    expect(schema['description']).toBeDefined();
    expect(schema['parameter_name']).toBeDefined();
    expect(schema['parameter_description']).toBeDefined();
    expect(schema['default_message']).toBeDefined();
    expect(schema['no_match_message']).toBeDefined();
    expect(schema['default_post_process']).toBeDefined();
    expect(schema['required_fields']).toBeDefined();
    expect(schema['patterns']).toBeDefined();
    expect(schema['allow_arbitrary']).toBeDefined();
  });

  it('should transfer to a named pattern destination', async () => {
    const skill = new SwmlTransferSkill({
      patterns: [{ name: 'sales', destination: '+15551112222' }],
    });
    await skill.setup();
    const handler = skill.getTools()[0].handler;
    const res = (await handler({ destination: 'sales' }, {})) as FunctionResult;
    expect(res.action.length).toBeGreaterThan(0);
  });

  it('should use no_match_message when destination is unknown and arbitrary disallowed', async () => {
    const skill = new SwmlTransferSkill({
      patterns: [{ name: 'sales', destination: '+15551112222' }],
      allow_arbitrary: false,
      no_match_message: 'I cannot transfer there.',
    });
    await skill.setup();
    const handler = skill.getTools()[0].handler;
    const res = (await handler({ destination: 'unknown' }, {})) as FunctionResult;
    expect(res.response).toContain('cannot transfer');
  });

  it('should support Python-style transfers config with regex keys', async () => {
    const skill = new SwmlTransferSkill({
      transfers: {
        sales: { address: '+15551112222', message: 'Connecting to sales.' },
      },
    });
    await skill.setup();
    const handler = skill.getTools()[0].handler;
    const res = (await handler({ destination: 'sales' }, {})) as FunctionResult;
    expect(res.action.length).toBeGreaterThan(0);
  });

  it('should save required fields to call_data under global_data', async () => {
    const skill = new SwmlTransferSkill({
      patterns: [{ name: 'support', destination: '+15551234567' }],
      required_fields: { name: 'Caller name', reason: 'Reason for calling' },
    });
    await skill.setup();
    const handler = skill.getTools()[0].handler;
    const res = (await handler(
      { destination: 'support', name: 'Alice', reason: 'Billing issue' },
      {},
    )) as FunctionResult;
    // Look for updateGlobalData action with call_data
    const updateAction = res.action.find(
      (a) => typeof a === 'object' && a !== null && 'set_global_data' in a,
    );
    expect(updateAction).toBeDefined();
  });
});
