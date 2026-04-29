import { describe, it, expect } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

describe('MCP Integration', () => {
  function createAgentWithTool() {
    const agent = new AgentBase({ name: 'test-mcp', route: '/test', basicAuth: ['u', 'p'] });
    agent.enableMcpServer();
    agent.defineTool({
      name: 'get_weather',
      description: 'Get the weather for a location',
      parameters: { location: { type: 'string', description: 'City name' } },
      handler: (args: Record<string, unknown>) => {
        const location = (args['location'] as string) || 'unknown';
        return new FunctionResult(`72F sunny in ${location}`);
      },
    });
    return agent;
  }

  // ── MCP Tool List ──────────────────────────────────────────

  it('buildMcpToolList via tools/list returns tools in MCP format', async () => {
    const agent = createAgentWithTool();
    const resp = await agent.handleMcpRequest({
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {},
    });
    expect(resp['id']).toBe(1);
    const result = resp['result'] as Record<string, unknown>;
    const tools = result['tools'] as Record<string, unknown>[];
    expect(tools).toHaveLength(1);
    expect(tools[0]['name']).toBe('get_weather');
    expect(tools[0]['description']).toBe('Get the weather for a location');
    expect(tools[0]['inputSchema']).toBeDefined();
  });

  // ── Initialize Handshake ───────────────────────────────────

  it('initialize returns protocol version and capabilities', async () => {
    const agent = createAgentWithTool();
    const resp = await agent.handleMcpRequest({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    });
    expect(resp['jsonrpc']).toBe('2.0');
    expect(resp['id']).toBe(1);
    const result = resp['result'] as Record<string, unknown>;
    expect(result['protocolVersion']).toBe('2025-06-18');
    expect(result['capabilities']).toBeDefined();
  });

  // ── Initialized Notification ───────────────────────────────

  it('notifications/initialized returns empty result', async () => {
    const agent = createAgentWithTool();
    const resp = await agent.handleMcpRequest({
      jsonrpc: '2.0', method: 'notifications/initialized',
    });
    // The notification ack must echo JSON-RPC 2.0 framing AND carry an
    // EMPTY result object. Anything else (a stub returning null, or a
    // canned error) would not be a valid MCP-spec ack.
    expect(resp['jsonrpc']).toBe('2.0');
    expect(resp['error']).toBeUndefined();
    expect(resp['result']).toEqual({});
  });

  // ── Tools Call ─────────────────────────────────────────────

  it('tools/call invokes the handler and returns content', async () => {
    const agent = createAgentWithTool();
    const resp = await agent.handleMcpRequest({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'get_weather', arguments: { location: 'Orlando' } },
    });
    expect(resp['id']).toBe(3);
    const result = resp['result'] as Record<string, unknown>;
    expect(result['isError']).toBe(false);
    const content = result['content'] as Record<string, unknown>[];
    expect(content).toHaveLength(1);
    expect(content[0]['type']).toBe('text');
    expect((content[0]['text'] as string)).toContain('Orlando');
  });

  // ── Tools Call Unknown ─────────────────────────────────────

  it('tools/call with unknown tool returns error', async () => {
    const agent = createAgentWithTool();
    const resp = await agent.handleMcpRequest({
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'nonexistent', arguments: {} },
    });
    const error = resp['error'] as Record<string, unknown>;
    expect(error).toBeDefined();
    expect(error['code']).toBe(-32602);
    expect((error['message'] as string)).toContain('nonexistent');
  });

  // ── Unknown Method ─────────────────────────────────────────

  it('unknown method returns method not found error', async () => {
    const agent = createAgentWithTool();
    const resp = await agent.handleMcpRequest({
      jsonrpc: '2.0', id: 5, method: 'resources/list', params: {},
    });
    const error = resp['error'] as Record<string, unknown>;
    expect(error).toBeDefined();
    expect(error['code']).toBe(-32601);
  });

  // ── Ping ───────────────────────────────────────────────────

  it('ping returns empty result', async () => {
    const agent = createAgentWithTool();
    const resp = await agent.handleMcpRequest({
      jsonrpc: '2.0', id: 6, method: 'ping',
    });
    // MCP ping MUST round-trip the request id, return an empty
    // `result: {}`, and NOT carry an error field. Asserting all three
    // catches any stub that returns canned content or swallows the id.
    expect(resp['jsonrpc']).toBe('2.0');
    expect(resp['id']).toBe(6);
    expect(resp['error']).toBeUndefined();
    expect(resp['result']).toEqual({});
  });

  // ── Invalid JSON-RPC Version ───────────────────────────────

  it('non-2.0 version returns error', async () => {
    const agent = createAgentWithTool();
    const resp = await agent.handleMcpRequest({
      jsonrpc: '1.0', id: 7, method: 'initialize',
    });
    const error = resp['error'] as Record<string, unknown>;
    expect(error).toBeDefined();
    expect(error['code']).toBe(-32600);
  });

  // ── addMcpServer Tests ─────────────────────────────────────

  it('addMcpServer basic URL', () => {
    const agent = new AgentBase({ name: 'test', route: '/test' });
    agent.addMcpServer('https://mcp.example.com/tools');
    expect(agent.getMcpServers()).toHaveLength(1);
    expect(agent.getMcpServers()[0]['url']).toBe('https://mcp.example.com/tools');
  });

  it('addMcpServer with headers', () => {
    const agent = new AgentBase({ name: 'test', route: '/test' });
    agent.addMcpServer('https://mcp.example.com/tools', {
      headers: { Authorization: 'Bearer sk-xxx' },
    });
    const headers = agent.getMcpServers()[0]['headers'] as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-xxx');
  });

  it('addMcpServer with resources', () => {
    const agent = new AgentBase({ name: 'test', route: '/test' });
    agent.addMcpServer('https://mcp.example.com/crm', {
      resources: true,
      resourceVars: { caller_id: '${caller_id_number}' },
    });
    expect(agent.getMcpServers()[0]['resources']).toBe(true);
    const vars = agent.getMcpServers()[0]['resource_vars'] as Record<string, string>;
    expect(vars['caller_id']).toBe('${caller_id_number}');
  });

  it('addMcpServer multiple servers', () => {
    const agent = new AgentBase({ name: 'test', route: '/test' });
    agent.addMcpServer('https://mcp1.example.com');
    agent.addMcpServer('https://mcp2.example.com');
    expect(agent.getMcpServers()).toHaveLength(2);
  });

  it('addMcpServer returns this for chaining', () => {
    const agent = new AgentBase({ name: 'test', route: '/test' });
    const result = agent.addMcpServer('https://mcp.example.com');
    expect(result).toBe(agent);
  });

  it('enableMcpServer sets the flag', () => {
    const agent = new AgentBase({ name: 'test', route: '/test' });
    expect(agent.isMcpServerEnabled()).toBe(false);
    const result = agent.enableMcpServer();
    expect(agent.isMcpServerEnabled()).toBe(true);
    expect(result).toBe(agent);
  });

  // ── MCP Servers in SWML ────────────────────────────────────

  it('mcp_servers rendered in SWML SWAIG section', () => {
    const agent = new AgentBase({ name: 'test', route: '/test' });
    agent.setPromptText('hello');
    agent.addMcpServer('https://mcp.example.com/tools', {
      headers: { Authorization: 'Bearer sk-xxx' },
    });
    // Need at least one tool for SWAIG section
    agent.defineTool({
      name: 'fn',
      description: 'Test',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main.find((v: any) => v.ai)?.ai;
    expect(ai?.SWAIG?.mcp_servers).toBeDefined();
    expect(ai.SWAIG.mcp_servers).toHaveLength(1);
    expect(ai.SWAIG.mcp_servers[0].url).toBe('https://mcp.example.com/tools');
  });

  // ── MCP HTTP Endpoint ──────────────────────────────────────

  it('/mcp endpoint responds to POST', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.enableMcpServer();
    agent.defineTool({
      name: 'test_fn',
      description: 'Test',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });
    const app = agent.getApp();
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jsonrpc).toBe('2.0');
    expect(body.result).toBeDefined();
  });
});
