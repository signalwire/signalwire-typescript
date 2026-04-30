/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_compat_calls_streams.py.
 *
 * Each TS test mirrors one Python test and asserts on both the SDK
 * response shape and the wire request the mock journaled.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

describe('CompatCalls.startStream -> POST /Calls/{sid}/Streams', () => {
  it('returns_stream_resource', async () => {
    const result = await client.compat.calls.startStream('CA_TEST', {
      Url: 'wss://example.com/stream',
      Name: 'my-stream',
    });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Stream resources carry a 'sid' or 'name' identifier.
    expect('sid' in result || 'name' in result).toBe(true);
  });

  it('journal_records_post_to_streams_collection', async () => {
    await client.compat.calls.startStream('CA_JX1', {
      Url: 'wss://a.b/s',
      Name: 'strm-x',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    // The path is /api/laml/.../Calls/{sid}/Streams (no specific stream sid).
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Calls/CA_JX1/Streams');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Url).toBe('wss://a.b/s');
    expect(j.body.Name).toBe('strm-x');
  });
});

describe('CompatCalls.stopStream(callSid, streamSid, body) -> POST .../Streams/{streamSid}', () => {
  it('returns_stream_resource_with_status', async () => {
    const result = await client.compat.calls.stopStream('CA_T1', 'ST_T1', { Status: 'stopped' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // The stop endpoint synthesises a stream resource (sid + status).
    expect('sid' in result || 'status' in result).toBe(true);
  });

  it('journal_records_post_to_specific_stream', async () => {
    await client.compat.calls.stopStream('CA_S1', 'ST_S1', { Status: 'stopped' });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Calls/CA_S1/Streams/ST_S1');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Status).toBe('stopped');
  });
});

describe('CompatCalls.updateRecording(callSid, recSid, body)', () => {
  it('returns_recording_resource', async () => {
    const result = await client.compat.calls.updateRecording('CA_T2', 'RE_T2', { Status: 'paused' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Recording resources carry a sid plus duration/status fields.
    expect('sid' in result || 'status' in result).toBe(true);
  });

  it('journal_records_post_to_specific_recording', async () => {
    await client.compat.calls.updateRecording('CA_R1', 'RE_R1', { Status: 'paused' });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Calls/CA_R1/Recordings/RE_R1');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Status).toBe('paused');
  });
});
