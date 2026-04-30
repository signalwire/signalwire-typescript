import { describe, it, expect } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';

// ---------------------------------------------------------------------------
// onRequest / onSwmlRequest — Python parity (WebMixin hooks)
//
// Python parity:
//
//   tests/unit/core/mixins/test_web_mixin.py::
//     test_on_request_delegates_to_on_swml_request
//     test_on_swml_request_called
// ---------------------------------------------------------------------------

class CustomSwmlAgent extends AgentBase {
  public lastRequestData: Record<string, unknown> | null = null;
  public lastCallbackPath: string | undefined | null = null;
  public customReturn: Record<string, unknown> | undefined = undefined;

  override onSwmlRequest(
    rawData: Record<string, unknown>,
    callbackPath?: string,
    _context?: any,
  ): Record<string, unknown> | void {
    this.lastRequestData = rawData;
    this.lastCallbackPath = callbackPath;
    return this.customReturn;
  }
}

describe('AgentBase WebMixin hooks', () => {
  it('onRequest delegates to onSwmlRequest', async () => {
    const agent = new CustomSwmlAgent({ name: 't', route: '/r' });
    agent.customReturn = { custom: true };
    const rd = { data: 'val' };
    const result = await agent.onRequest(rd, '/cb');
    expect(agent.lastRequestData).toEqual(rd);
    expect(agent.lastCallbackPath).toBe('/cb');
    expect(result).toEqual({ custom: true });
  });

  it('onSwmlRequest default returns undefined', () => {
    const agent = new AgentBase({ name: 't', route: '/r' });
    const result = agent.onSwmlRequest({});
    expect(result).toBeUndefined();
  });

  it('onRequest default returns undefined when onSwmlRequest is not overridden', async () => {
    const agent = new AgentBase({ name: 't', route: '/r' });
    const result = await agent.onRequest(null, null);
    expect(result).toBeUndefined();
  });

  it('onRequest accepts null/undefined data gracefully', async () => {
    const agent = new CustomSwmlAgent({ name: 't', route: '/r' });
    agent.customReturn = undefined;
    const result = await agent.onRequest();
    expect(result).toBeUndefined();
    expect(agent.lastCallbackPath).toBeUndefined();
  });
});
