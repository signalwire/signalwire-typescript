/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_compat_conferences.py.
 *
 * Covers all 12 CompatConferences symbols: list/get/update on the
 * conference itself, plus the participant, recording, and stream
 * sub-resources.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';

const BASE = '/api/laml/2010-04-01/Accounts/test_proj/Conferences';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- Conference itself -------------------------------------------------

describe('CompatConferences.list', () => {
  it('returns_paginated_list', async () => {
    const result = await client.compat.conferences.list();
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('conferences' in result).toBe(true);
    expect(Array.isArray(result.conferences)).toBe(true);
    expect(typeof result.page).toBe('number');
  });

  it('journal_records_get_to_conferences', async () => {
    await client.compat.conferences.list();
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe(BASE);
    expect(j.matched_route).not.toBeNull();
  });
});

describe('CompatConferences.get', () => {
  it('returns_conference_resource', async () => {
    const result = await client.compat.conferences.get('CF_TEST');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('friendly_name' in result || 'status' in result).toBe(true);
  });

  it('journal_records_get_with_sid', async () => {
    await client.compat.conferences.get('CF_GETSID');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe(`${BASE}/CF_GETSID`);
  });
});

describe('CompatConferences.update', () => {
  it('returns_updated_conference', async () => {
    const result = await client.compat.conferences.update('CF_X', { Status: 'completed' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('friendly_name' in result || 'status' in result).toBe(true);
  });

  it('journal_records_post_with_status', async () => {
    await client.compat.conferences.update('CF_UPD', {
      Status: 'completed',
      AnnounceUrl: 'https://a.b',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe(`${BASE}/CF_UPD`);
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Status).toBe('completed');
    expect(j.body.AnnounceUrl).toBe('https://a.b');
  });
});

// ---- Participants ------------------------------------------------------

describe('CompatConferences.getParticipant', () => {
  it('returns_participant', async () => {
    const result = await client.compat.conferences.getParticipant('CF_P', 'CA_P');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('call_sid' in result || 'conference_sid' in result).toBe(true);
  });

  it('journal_records_get_to_participant', async () => {
    await client.compat.conferences.getParticipant('CF_GP', 'CA_GP');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe(`${BASE}/CF_GP/Participants/CA_GP`);
  });
});

describe('CompatConferences.updateParticipant', () => {
  it('returns_participant_resource', async () => {
    const result = await client.compat.conferences.updateParticipant('CF_UP', 'CA_UP', {
      Muted: true,
    });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('call_sid' in result || 'conference_sid' in result).toBe(true);
  });

  it('journal_records_post_with_mute_flag', async () => {
    await client.compat.conferences.updateParticipant('CF_M', 'CA_M', {
      Muted: true,
      Hold: false,
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe(`${BASE}/CF_M/Participants/CA_M`);
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Muted).toBe(true);
    expect(j.body.Hold).toBe(false);
  });
});

describe('CompatConferences.removeParticipant', () => {
  it('returns_empty_or_object', async () => {
    const result = await client.compat.conferences.removeParticipant('CF_R', 'CA_R');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('journal_records_delete_call', async () => {
    await client.compat.conferences.removeParticipant('CF_RM', 'CA_RM');
    const j = await mock.last();
    expect(j.method).toBe('DELETE');
    expect(j.path).toBe(`${BASE}/CF_RM/Participants/CA_RM`);
  });
});

// ---- Recordings --------------------------------------------------------

describe('CompatConferences.listRecordings', () => {
  it('returns_paginated_recordings', async () => {
    const result = await client.compat.conferences.listRecordings('CF_LR');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('recordings' in result).toBe(true);
    expect(Array.isArray(result.recordings)).toBe(true);
  });

  it('journal_records_get_recordings', async () => {
    await client.compat.conferences.listRecordings('CF_LRX');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe(`${BASE}/CF_LRX/Recordings`);
  });
});

describe('CompatConferences.getRecording', () => {
  it('returns_recording_resource', async () => {
    const result = await client.compat.conferences.getRecording('CF_GR', 'RE_GR');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('sid' in result || 'call_sid' in result).toBe(true);
  });

  it('journal_records_get_recording', async () => {
    await client.compat.conferences.getRecording('CF_GRX', 'RE_GRX');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe(`${BASE}/CF_GRX/Recordings/RE_GRX`);
  });
});

describe('CompatConferences.updateRecording', () => {
  it('returns_recording_resource', async () => {
    const result = await client.compat.conferences.updateRecording('CF_URC', 'RE_URC', {
      Status: 'paused',
    });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('sid' in result || 'status' in result).toBe(true);
  });

  it('journal_records_post_with_status', async () => {
    await client.compat.conferences.updateRecording('CF_UR', 'RE_UR', {
      Status: 'paused',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe(`${BASE}/CF_UR/Recordings/RE_UR`);
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Status).toBe('paused');
  });
});

describe('CompatConferences.deleteRecording', () => {
  it('no_exception_on_delete', async () => {
    const result = await client.compat.conferences.deleteRecording('CF_DR', 'RE_DR');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('journal_records_delete', async () => {
    await client.compat.conferences.deleteRecording('CF_DRX', 'RE_DRX');
    const j = await mock.last();
    expect(j.method).toBe('DELETE');
    expect(j.path).toBe(`${BASE}/CF_DRX/Recordings/RE_DRX`);
  });
});

// ---- Streams -----------------------------------------------------------

describe('CompatConferences.startStream', () => {
  it('returns_stream_resource', async () => {
    const result = await client.compat.conferences.startStream('CF_SS', { Url: 'wss://a.b/s' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('sid' in result || 'name' in result).toBe(true);
  });

  it('journal_records_post_to_streams', async () => {
    await client.compat.conferences.startStream('CF_SSX', {
      Url: 'wss://a.b/s',
      Name: 'strm',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe(`${BASE}/CF_SSX/Streams`);
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Url).toBe('wss://a.b/s');
  });
});

describe('CompatConferences.stopStream', () => {
  it('returns_stream_resource', async () => {
    const result = await client.compat.conferences.stopStream('CF_TS', 'ST_TS', {
      Status: 'stopped',
    });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('sid' in result || 'status' in result).toBe(true);
  });

  it('journal_records_post_to_specific_stream', async () => {
    await client.compat.conferences.stopStream('CF_TSX', 'ST_TSX', {
      Status: 'stopped',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe(`${BASE}/CF_TSX/Streams/ST_TSX`);
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Status).toBe('stopped');
  });
});
