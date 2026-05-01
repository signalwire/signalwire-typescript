/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_compat_queues.py.
 *
 * Covers CompatQueues.update, .listMembers, .getMember, and .dequeueMember.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';

const BASE = '/api/laml/2010-04-01/Accounts/test_proj/Queues';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- Update ------------------------------------------------------------

describe('CompatQueues.update', () => {
  it('returns_queue_resource', async () => {
    const result = await client.compat.queues.update('QU_U', { FriendlyName: 'updated' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('friendly_name' in result || 'sid' in result).toBe(true);
  });

  it('journal_records_post_with_friendly_name', async () => {
    await client.compat.queues.update('QU_UU', {
      FriendlyName: 'renamed',
      MaxSize: 200,
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe(`${BASE}/QU_UU`);
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.FriendlyName).toBe('renamed');
    expect(j.body.MaxSize).toBe(200);
  });
});

// ---- listMembers -------------------------------------------------------

describe('CompatQueues.listMembers', () => {
  it('returns_paginated_members', async () => {
    const result = await client.compat.queues.listMembers('QU_LM');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('queue_members' in result).toBe(true);
    expect(Array.isArray(result.queue_members)).toBe(true);
  });

  it('journal_records_get_to_members', async () => {
    await client.compat.queues.listMembers('QU_LMX');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe(`${BASE}/QU_LMX/Members`);
  });
});

// ---- getMember ---------------------------------------------------------

describe('CompatQueues.getMember', () => {
  it('returns_member_resource', async () => {
    const result = await client.compat.queues.getMember('QU_GM', 'CA_GM');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('call_sid' in result || 'queue_sid' in result).toBe(true);
  });

  it('journal_records_get_to_specific_member', async () => {
    await client.compat.queues.getMember('QU_GMX', 'CA_GMX');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe(`${BASE}/QU_GMX/Members/CA_GMX`);
  });
});

// ---- dequeueMember -----------------------------------------------------

describe('CompatQueues.dequeueMember', () => {
  it('returns_member_resource', async () => {
    const result = await client.compat.queues.dequeueMember('QU_DM', 'CA_DM', {
      Url: 'https://a.b',
    });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('call_sid' in result || 'queue_sid' in result).toBe(true);
  });

  it('journal_records_post_with_url', async () => {
    await client.compat.queues.dequeueMember('QU_DMX', 'CA_DMX', {
      Url: 'https://a.b/url',
      Method: 'POST',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe(`${BASE}/QU_DMX/Members/CA_DMX`);
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Url).toBe('https://a.b/url');
    expect(j.body.Method).toBe('POST');
  });
});
