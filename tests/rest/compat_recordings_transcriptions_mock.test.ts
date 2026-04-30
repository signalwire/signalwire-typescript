/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_compat_recordings_transcriptions.py.
 *
 * Both resources expose the same surface (list / get / delete) and use the
 * account-scoped LAML path. Six gap entries total:
 *   - CompatRecordings:    list, get, delete
 *   - CompatTranscriptions: list, get, delete
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

// ---- Recordings --------------------------------------------------------

describe('CompatRecordings.list', () => {
  it('returns_paginated_recordings', async () => {
    const result = await client.compat.recordings.list();
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('recordings' in result).toBe(true);
    expect(Array.isArray(result.recordings)).toBe(true);
  });

  it('journal_records_get', async () => {
    await client.compat.recordings.list();
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Recordings');
  });
});

describe('CompatRecordings.get', () => {
  it('returns_recording_resource', async () => {
    const result = await client.compat.recordings.get('RE_TEST');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Recording resources carry call_sid + duration + sid.
    expect('sid' in result || 'call_sid' in result).toBe(true);
  });

  it('journal_records_get_with_sid', async () => {
    await client.compat.recordings.get('RE_GET');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Recordings/RE_GET');
  });
});

describe('CompatRecordings.delete', () => {
  it('no_exception_on_delete', async () => {
    const result = await client.compat.recordings.delete('RE_D');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('journal_records_delete', async () => {
    await client.compat.recordings.delete('RE_DEL');
    const j = await mock.last();
    expect(j.method).toBe('DELETE');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Recordings/RE_DEL');
  });
});

// ---- Transcriptions ----------------------------------------------------

describe('CompatTranscriptions.list', () => {
  it('returns_paginated_transcriptions', async () => {
    const result = await client.compat.transcriptions.list();
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('transcriptions' in result).toBe(true);
    expect(Array.isArray(result.transcriptions)).toBe(true);
  });

  it('journal_records_get', async () => {
    await client.compat.transcriptions.list();
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Transcriptions');
  });
});

describe('CompatTranscriptions.get', () => {
  it('returns_transcription_resource', async () => {
    const result = await client.compat.transcriptions.get('TR_TEST');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Transcription resources carry duration + transcription_text + sid.
    expect('sid' in result || 'duration' in result).toBe(true);
  });

  it('journal_records_get_with_sid', async () => {
    await client.compat.transcriptions.get('TR_GET');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Transcriptions/TR_GET');
  });
});

describe('CompatTranscriptions.delete', () => {
  it('no_exception_on_delete', async () => {
    const result = await client.compat.transcriptions.delete('TR_D');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('journal_records_delete', async () => {
    await client.compat.transcriptions.delete('TR_DEL');
    const j = await mock.last();
    expect(j.method).toBe('DELETE');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Transcriptions/TR_DEL');
  });
});
