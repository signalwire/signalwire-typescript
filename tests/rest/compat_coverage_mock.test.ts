/**
 * Full REST success + error coverage for the `compatibility` spec group
 * (the Twilio-compatible LaML 2010-04-01 Accounts API).
 *
 * Mirrors the proven python/java suites and the fabric coverage idiom: every
 * coverable canonical `compatibility.*` route (78 of 79) gets BOTH a success
 * (2xx) test and an error (4xx/5xx) test, asserting method, path,
 * matched_route, and (for errors) response_status against the mock journal.
 *
 * Compat paths embed the project as the AccountSid. The scoped collections
 * live under `/api/laml/2010-04-01/Accounts/<project>/...`; the top-level
 * Accounts collection (`/Accounts`, `/Accounts/{Sid}`) carries no AccountSid
 * prefix. The project is read from `mock.project` (never hard-coded).
 *
 * Gap (1, same as python/java — NOT faked):
 *   - compatibility.list_available_phone_number_resources_by_country
 *     (bare GET /AvailablePhoneNumbers/{IsoCountry}) — no SDK surface; the
 *     namespace only exposes the `/Local` and `/TollFree` searches.
 *
 * Companion to tests/rest/compat_accounts_mock.test.ts (idiom); self-contained.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { JournalEntry, MockHarness } from './mocktest.js';
import { RestError } from '../../src/rest/RestError.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- DRY helpers -------------------------------------------------------
//
// Each helper RETURNS the journal entry (and/or response) so the calling
// `it()` body holds its own real assertions — the no-cheat auditor is
// intra-function.

/**
 * Await an SDK call, then return its response body alongside the last journal
 * entry. The caller asserts on both.
 */
async function callOk<T>(fn: () => Promise<T>): Promise<{ body: T; last: JournalEntry }> {
  const body = await fn();
  const last = await mock.last();
  return { body, last };
}

/**
 * Arm a one-shot error scenario for `endpointId`, assert the SDK call rejects
 * with RestError, and return the recorded journal entry for body assertions.
 */
async function callErr(
  endpointId: string,
  status: number,
  fn: () => Promise<unknown>,
): Promise<JournalEntry> {
  await mock.pushScenario(endpointId, status, { error: 'x' });
  await expect(fn()).rejects.toThrow(RestError);
  return mock.last();
}

/** Account-scoped path prefix for this test's client (`.../Accounts/<project>`). */
function base(): string {
  return `/api/laml/2010-04-01/Accounts/${mock.project}`;
}

// ---- Accounts (top-level collection — no AccountSid prefix) -------------

describe('Compat Accounts', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.accounts.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/laml/2010-04-01/Accounts');
    expect(last.matched_route).toBe('compatibility.list_accounts');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_accounts', 500, () =>
      client.compat.accounts.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_accounts');
    expect(last.response_status).toBe(500);
  });

  it('create subproject success', async () => {
    const { last } = await callOk(() => client.compat.accounts.create({ FriendlyName: 'Sub' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/laml/2010-04-01/Accounts');
    expect(last.matched_route).toBe('compatibility.create_subprojects');
  });
  it('create subproject error 422', async () => {
    const last = await callErr('compatibility.create_subprojects', 422, () =>
      client.compat.accounts.create({ FriendlyName: 'Sub' }),
    );
    expect(last.matched_route).toBe('compatibility.create_subprojects');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.accounts.get('AC123'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/laml/2010-04-01/Accounts/AC123');
    expect(last.matched_route).toBe('compatibility.get_account');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.get_account', 404, () =>
      client.compat.accounts.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.get_account');
    expect(last.response_status).toBe(404);
  });

  it('update success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.accounts.update('AC123', { FriendlyName: 'Renamed' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/laml/2010-04-01/Accounts/AC123');
    expect(last.matched_route).toBe('compatibility.update_account');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_account', 404, () =>
      client.compat.accounts.update('missing', { FriendlyName: 'x' }),
    );
    expect(last.matched_route).toBe('compatibility.update_account');
    expect(last.response_status).toBe(404);
  });
});

// ---- Calls (with recording + stream sub-resources) ---------------------

describe('Compat Calls', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.calls.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Calls`);
    expect(last.matched_route).toBe('compatibility.list_all_calls');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_all_calls', 500, () =>
      client.compat.calls.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_all_calls');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() =>
      client.compat.calls.create({ To: '+15553334444', From: '+15551112222', Url: 'http://x' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Calls`);
    expect(last.matched_route).toBe('compatibility.create_a_call');
  });
  it('create error 422', async () => {
    const last = await callErr('compatibility.create_a_call', 422, () =>
      client.compat.calls.create({ To: '+1', From: '+1', Url: 'http://x' }),
    );
    expect(last.matched_route).toBe('compatibility.create_a_call');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.calls.get('CA1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Calls/CA1`);
    expect(last.matched_route).toBe('compatibility.retrieve_a_call');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.retrieve_a_call', 404, () =>
      client.compat.calls.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_a_call');
    expect(last.response_status).toBe(404);
  });

  it('update success (POST)', async () => {
    const { last } = await callOk(() => client.compat.calls.update('CA1', { Status: 'completed' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Calls/CA1`);
    expect(last.matched_route).toBe('compatibility.update_a_call');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_a_call', 404, () =>
      client.compat.calls.update('missing', { Status: 'completed' }),
    );
    expect(last.matched_route).toBe('compatibility.update_a_call');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.calls.delete('CA1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Calls/CA1`);
    expect(last.matched_route).toBe('compatibility.delete_a_call');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_a_call', 404, () =>
      client.compat.calls.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_a_call');
    expect(last.response_status).toBe(404);
  });

  it('start recording success', async () => {
    const { last } = await callOk(() => client.compat.calls.startRecording('CA1', {}));
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Calls/CA1/Recordings`);
    expect(last.matched_route).toBe('compatibility.create_recording');
  });
  it('start recording error 422', async () => {
    const last = await callErr('compatibility.create_recording', 422, () =>
      client.compat.calls.startRecording('CA1', {}),
    );
    expect(last.matched_route).toBe('compatibility.create_recording');
    expect(last.response_status).toBe(422);
  });

  it('update recording success', async () => {
    const { last } = await callOk(() =>
      client.compat.calls.updateRecording('CA1', 'RE1', { Status: 'stopped' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Calls/CA1/Recordings/RE1`);
    expect(last.matched_route).toBe('compatibility.update_recording');
  });
  it('update recording error 404', async () => {
    const last = await callErr('compatibility.update_recording', 404, () =>
      client.compat.calls.updateRecording('CA1', 'missing', { Status: 'stopped' }),
    );
    expect(last.matched_route).toBe('compatibility.update_recording');
    expect(last.response_status).toBe(404);
  });

  it('start stream success', async () => {
    const { last } = await callOk(() => client.compat.calls.startStream('CA1', { Url: 'wss://x' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Calls/CA1/Streams`);
    expect(last.matched_route).toBe('compatibility.create_stream');
  });
  it('start stream error 422', async () => {
    const last = await callErr('compatibility.create_stream', 422, () =>
      client.compat.calls.startStream('CA1', {}),
    );
    expect(last.matched_route).toBe('compatibility.create_stream');
    expect(last.response_status).toBe(422);
  });

  it('stop stream success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.calls.stopStream('CA1', 'MZ1', { Status: 'stopped' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Calls/CA1/Streams/MZ1`);
    expect(last.matched_route).toBe('compatibility.update_stream');
  });
  it('stop stream error 404', async () => {
    const last = await callErr('compatibility.update_stream', 404, () =>
      client.compat.calls.stopStream('CA1', 'missing', { Status: 'stopped' }),
    );
    expect(last.matched_route).toBe('compatibility.update_stream');
    expect(last.response_status).toBe(404);
  });
});

// ---- Messages (with media sub-resources) -------------------------------

describe('Compat Messages', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.messages.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Messages`);
    expect(last.matched_route).toBe('compatibility.list_messages');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_messages', 500, () =>
      client.compat.messages.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_messages');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() =>
      client.compat.messages.create({ To: '+15553334444', From: '+15551112222', Body: 'hi' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Messages`);
    expect(last.matched_route).toBe('compatibility.create_message');
  });
  it('create error 422', async () => {
    const last = await callErr('compatibility.create_message', 422, () =>
      client.compat.messages.create({ To: '+1', From: '+1', Body: 'hi' }),
    );
    expect(last.matched_route).toBe('compatibility.create_message');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.messages.get('SM1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Messages/SM1`);
    expect(last.matched_route).toBe('compatibility.retrieve_message');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.retrieve_message', 404, () =>
      client.compat.messages.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_message');
    expect(last.response_status).toBe(404);
  });

  it('update success (POST)', async () => {
    const { last } = await callOk(() => client.compat.messages.update('SM1', { Body: 'edited' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Messages/SM1`);
    expect(last.matched_route).toBe('compatibility.update_message');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_message', 404, () =>
      client.compat.messages.update('missing', { Body: 'edited' }),
    );
    expect(last.matched_route).toBe('compatibility.update_message');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.messages.delete('SM1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Messages/SM1`);
    expect(last.matched_route).toBe('compatibility.delete_message');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_message', 404, () =>
      client.compat.messages.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_message');
    expect(last.response_status).toBe(404);
  });

  it('list media success', async () => {
    const { body, last } = await callOk(() => client.compat.messages.listMedia('SM1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Messages/SM1/Media`);
    expect(last.matched_route).toBe('compatibility.list_media');
  });
  it('list media error 500', async () => {
    const last = await callErr('compatibility.list_media', 500, () =>
      client.compat.messages.listMedia('SM1'),
    );
    expect(last.matched_route).toBe('compatibility.list_media');
    expect(last.response_status).toBe(500);
  });

  it('get media success', async () => {
    const { last } = await callOk(() => client.compat.messages.getMedia('SM1', 'ME1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Messages/SM1/Media/ME1`);
    expect(last.matched_route).toBe('compatibility.retrieve_media');
  });
  it('get media error 404', async () => {
    const last = await callErr('compatibility.retrieve_media', 404, () =>
      client.compat.messages.getMedia('SM1', 'missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_media');
    expect(last.response_status).toBe(404);
  });

  it('delete media success', async () => {
    const { last } = await callOk(() => client.compat.messages.deleteMedia('SM1', 'ME1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Messages/SM1/Media/ME1`);
    expect(last.matched_route).toBe('compatibility.delete_message_media');
  });
  it('delete media error 404', async () => {
    const last = await callErr('compatibility.delete_message_media', 404, () =>
      client.compat.messages.deleteMedia('SM1', 'missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_message_media');
    expect(last.response_status).toBe(404);
  });
});

// ---- Faxes (with media sub-resources) ----------------------------------

describe('Compat Faxes', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.faxes.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Faxes`);
    expect(last.matched_route).toBe('compatibility.list_all_faxes');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_all_faxes', 500, () =>
      client.compat.faxes.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_all_faxes');
    expect(last.response_status).toBe(500);
  });

  it('send (create) success', async () => {
    const { last } = await callOk(() =>
      client.compat.faxes.create({
        To: '+15553334444',
        From: '+15551112222',
        MediaUrl: 'http://x',
      }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Faxes`);
    expect(last.matched_route).toBe('compatibility.send_fax');
  });
  it('send (create) error 422', async () => {
    const last = await callErr('compatibility.send_fax', 422, () =>
      client.compat.faxes.create({ To: '+1', From: '+1', MediaUrl: 'http://x' }),
    );
    expect(last.matched_route).toBe('compatibility.send_fax');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.faxes.get('FX1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Faxes/FX1`);
    expect(last.matched_route).toBe('compatibility.retrieve_fax');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.retrieve_fax', 404, () =>
      client.compat.faxes.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_fax');
    expect(last.response_status).toBe(404);
  });

  it('update success (POST)', async () => {
    const { last } = await callOk(() => client.compat.faxes.update('FX1', { Status: 'canceled' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Faxes/FX1`);
    expect(last.matched_route).toBe('compatibility.update_fax');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_fax', 404, () =>
      client.compat.faxes.update('missing', { Status: 'canceled' }),
    );
    expect(last.matched_route).toBe('compatibility.update_fax');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.faxes.delete('FX1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Faxes/FX1`);
    expect(last.matched_route).toBe('compatibility.delete_fax');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_fax', 404, () =>
      client.compat.faxes.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_fax');
    expect(last.response_status).toBe(404);
  });

  it('list media success', async () => {
    const { body, last } = await callOk(() => client.compat.faxes.listMedia('FX1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Faxes/FX1/Media`);
    expect(last.matched_route).toBe('compatibility.list_all_fax_media');
  });
  it('list media error 500', async () => {
    const last = await callErr('compatibility.list_all_fax_media', 500, () =>
      client.compat.faxes.listMedia('FX1'),
    );
    expect(last.matched_route).toBe('compatibility.list_all_fax_media');
    expect(last.response_status).toBe(500);
  });

  it('get media success', async () => {
    const { last } = await callOk(() => client.compat.faxes.getMedia('FX1', 'ME1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Faxes/FX1/Media/ME1`);
    expect(last.matched_route).toBe('compatibility.retrieve_medias');
  });
  it('get media error 404', async () => {
    const last = await callErr('compatibility.retrieve_medias', 404, () =>
      client.compat.faxes.getMedia('FX1', 'missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_medias');
    expect(last.response_status).toBe(404);
  });

  it('delete media success', async () => {
    const { last } = await callOk(() => client.compat.faxes.deleteMedia('FX1', 'ME1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Faxes/FX1/Media/ME1`);
    expect(last.matched_route).toBe('compatibility.delete_fax_media');
  });
  it('delete media error 404', async () => {
    const last = await callErr('compatibility.delete_fax_media', 404, () =>
      client.compat.faxes.deleteMedia('FX1', 'missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_fax_media');
    expect(last.response_status).toBe(404);
  });
});

// ---- Conferences (participants, recordings, streams) -------------------

describe('Compat Conferences', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.conferences.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Conferences`);
    expect(last.matched_route).toBe('compatibility.list_all_conferences');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_all_conferences', 500, () =>
      client.compat.conferences.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_all_conferences');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.conferences.get('CF1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Conferences/CF1`);
    expect(last.matched_route).toBe('compatibility.retrieve_conference');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.retrieve_conference', 404, () =>
      client.compat.conferences.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_conference');
    expect(last.response_status).toBe(404);
  });

  it('update success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.conferences.update('CF1', { Status: 'completed' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Conferences/CF1`);
    expect(last.matched_route).toBe('compatibility.update_conference');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_conference', 404, () =>
      client.compat.conferences.update('missing', { Status: 'completed' }),
    );
    expect(last.matched_route).toBe('compatibility.update_conference');
    expect(last.response_status).toBe(404);
  });

  it('list participants success', async () => {
    const { body, last } = await callOk(() => client.compat.conferences.listParticipants('CF1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Participants`);
    expect(last.matched_route).toBe('compatibility.list_all_participants');
  });
  it('list participants error 500', async () => {
    const last = await callErr('compatibility.list_all_participants', 500, () =>
      client.compat.conferences.listParticipants('CF1'),
    );
    expect(last.matched_route).toBe('compatibility.list_all_participants');
    expect(last.response_status).toBe(500);
  });

  it('get participant success', async () => {
    const { last } = await callOk(() => client.compat.conferences.getParticipant('CF1', 'CA1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Participants/CA1`);
    expect(last.matched_route).toBe('compatibility.retrieve_participant');
  });
  it('get participant error 404', async () => {
    const last = await callErr('compatibility.retrieve_participant', 404, () =>
      client.compat.conferences.getParticipant('CF1', 'missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_participant');
    expect(last.response_status).toBe(404);
  });

  it('update participant success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.conferences.updateParticipant('CF1', 'CA1', { Muted: 'true' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Participants/CA1`);
    expect(last.matched_route).toBe('compatibility.update_participant');
  });
  it('update participant error 404', async () => {
    const last = await callErr('compatibility.update_participant', 404, () =>
      client.compat.conferences.updateParticipant('CF1', 'missing', { Muted: 'true' }),
    );
    expect(last.matched_route).toBe('compatibility.update_participant');
    expect(last.response_status).toBe(404);
  });

  it('remove participant success', async () => {
    const { last } = await callOk(() => client.compat.conferences.removeParticipant('CF1', 'CA1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Participants/CA1`);
    expect(last.matched_route).toBe('compatibility.delete_participant');
  });
  it('remove participant error 404', async () => {
    const last = await callErr('compatibility.delete_participant', 404, () =>
      client.compat.conferences.removeParticipant('CF1', 'missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_participant');
    expect(last.response_status).toBe(404);
  });

  it('list recordings success', async () => {
    const { body, last } = await callOk(() => client.compat.conferences.listRecordings('CF1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Recordings`);
    expect(last.matched_route).toBe('compatibility.list_conference_recordings');
  });
  it('list recordings error 500', async () => {
    const last = await callErr('compatibility.list_conference_recordings', 500, () =>
      client.compat.conferences.listRecordings('CF1'),
    );
    expect(last.matched_route).toBe('compatibility.list_conference_recordings');
    expect(last.response_status).toBe(500);
  });

  it('get recording success', async () => {
    const { last } = await callOk(() => client.compat.conferences.getRecording('CF1', 'RE1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Recordings/RE1`);
    expect(last.matched_route).toBe('compatibility.get_conference_recording');
  });
  it('get recording error 404', async () => {
    const last = await callErr('compatibility.get_conference_recording', 404, () =>
      client.compat.conferences.getRecording('CF1', 'missing'),
    );
    expect(last.matched_route).toBe('compatibility.get_conference_recording');
    expect(last.response_status).toBe(404);
  });

  it('update recording success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.conferences.updateRecording('CF1', 'RE1', { Status: 'stopped' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Recordings/RE1`);
    expect(last.matched_route).toBe('compatibility.update_conference_recording');
  });
  it('update recording error 404', async () => {
    const last = await callErr('compatibility.update_conference_recording', 404, () =>
      client.compat.conferences.updateRecording('CF1', 'missing', { Status: 'stopped' }),
    );
    expect(last.matched_route).toBe('compatibility.update_conference_recording');
    expect(last.response_status).toBe(404);
  });

  it('delete recording success', async () => {
    const { last } = await callOk(() => client.compat.conferences.deleteRecording('CF1', 'RE1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Recordings/RE1`);
    expect(last.matched_route).toBe('compatibility.delete_conference_recording');
  });
  it('delete recording error 404', async () => {
    const last = await callErr('compatibility.delete_conference_recording', 404, () =>
      client.compat.conferences.deleteRecording('CF1', 'missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_conference_recording');
    expect(last.response_status).toBe(404);
  });

  it('start stream success', async () => {
    const { last } = await callOk(() =>
      client.compat.conferences.startStream('CF1', { Url: 'wss://x' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Streams`);
    expect(last.matched_route).toBe('compatibility.create_conference_stream');
  });
  it('start stream error 422', async () => {
    const last = await callErr('compatibility.create_conference_stream', 422, () =>
      client.compat.conferences.startStream('CF1', {}),
    );
    expect(last.matched_route).toBe('compatibility.create_conference_stream');
    expect(last.response_status).toBe(422);
  });

  it('stop stream success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.conferences.stopStream('CF1', 'MZ1', { Status: 'stopped' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Conferences/CF1/Streams/MZ1`);
    expect(last.matched_route).toBe('compatibility.update_conference_stream');
  });
  it('stop stream error 404', async () => {
    const last = await callErr('compatibility.update_conference_stream', 404, () =>
      client.compat.conferences.stopStream('CF1', 'missing', { Status: 'stopped' }),
    );
    expect(last.matched_route).toBe('compatibility.update_conference_stream');
    expect(last.response_status).toBe(404);
  });
});

// ---- Phone Numbers (incoming + imported + available search) ------------

describe('Compat Phone Numbers', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.phoneNumbers.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/IncomingPhoneNumbers`);
    expect(last.matched_route).toBe('compatibility.list_incoming_phone_numbers');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_incoming_phone_numbers', 500, () =>
      client.compat.phoneNumbers.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_incoming_phone_numbers');
    expect(last.response_status).toBe(500);
  });

  it('purchase success', async () => {
    const { last } = await callOk(() =>
      client.compat.phoneNumbers.purchase({ PhoneNumber: '+15551112222' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/IncomingPhoneNumbers`);
    expect(last.matched_route).toBe('compatibility.create_incoming_phone_number');
  });
  it('purchase error 422', async () => {
    const last = await callErr('compatibility.create_incoming_phone_number', 422, () =>
      client.compat.phoneNumbers.purchase({ PhoneNumber: '+1' }),
    );
    expect(last.matched_route).toBe('compatibility.create_incoming_phone_number');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.phoneNumbers.get('PN1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/IncomingPhoneNumbers/PN1`);
    expect(last.matched_route).toBe('compatibility.retrieve_incoming_phone_number');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.retrieve_incoming_phone_number', 404, () =>
      client.compat.phoneNumbers.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_incoming_phone_number');
    expect(last.response_status).toBe(404);
  });

  it('update success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.phoneNumbers.update('PN1', { FriendlyName: 'x' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/IncomingPhoneNumbers/PN1`);
    expect(last.matched_route).toBe('compatibility.update_incoming_phone_number');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_incoming_phone_number', 404, () =>
      client.compat.phoneNumbers.update('missing', { FriendlyName: 'x' }),
    );
    expect(last.matched_route).toBe('compatibility.update_incoming_phone_number');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.phoneNumbers.delete('PN1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/IncomingPhoneNumbers/PN1`);
    expect(last.matched_route).toBe('compatibility.delete_incoming_phone_number');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_incoming_phone_number', 404, () =>
      client.compat.phoneNumbers.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_incoming_phone_number');
    expect(last.response_status).toBe(404);
  });

  it('import number success', async () => {
    const { last } = await callOk(() =>
      client.compat.phoneNumbers.importNumber({
        number: '+15551112222',
        number_type: 'longcode',
      }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/ImportedPhoneNumbers`);
    expect(last.matched_route).toBe('compatibility.create_imported_phone_number');
  });
  it('import number error 422', async () => {
    const last = await callErr('compatibility.create_imported_phone_number', 422, () =>
      client.compat.phoneNumbers.importNumber({ number: '+1', number_type: 'longcode' }),
    );
    expect(last.matched_route).toBe('compatibility.create_imported_phone_number');
    expect(last.response_status).toBe(422);
  });

  it('list available countries success', async () => {
    const { body, last } = await callOk(() => client.compat.phoneNumbers.listAvailableCountries());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/AvailablePhoneNumbers`);
    expect(last.matched_route).toBe('compatibility.list_available_phone_number_resources');
  });
  it('list available countries error 500', async () => {
    const last = await callErr('compatibility.list_available_phone_number_resources', 500, () =>
      client.compat.phoneNumbers.listAvailableCountries(),
    );
    expect(last.matched_route).toBe('compatibility.list_available_phone_number_resources');
    expect(last.response_status).toBe(500);
  });

  it('search local success', async () => {
    const { body, last } = await callOk(() => client.compat.phoneNumbers.searchLocal('US'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/AvailablePhoneNumbers/US/Local`);
    expect(last.matched_route).toBe('compatibility.search_local_available_phone_numbers');
  });
  it('search local error 500', async () => {
    const last = await callErr('compatibility.search_local_available_phone_numbers', 500, () =>
      client.compat.phoneNumbers.searchLocal('US'),
    );
    expect(last.matched_route).toBe('compatibility.search_local_available_phone_numbers');
    expect(last.response_status).toBe(500);
  });

  it('search toll-free success', async () => {
    const { body, last } = await callOk(() => client.compat.phoneNumbers.searchTollFree('US'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/AvailablePhoneNumbers/US/TollFree`);
    expect(last.matched_route).toBe('compatibility.search_toll_free_available_phone_numbers');
  });
  it('search toll-free error 500', async () => {
    const last = await callErr('compatibility.search_toll_free_available_phone_numbers', 500, () =>
      client.compat.phoneNumbers.searchTollFree('US'),
    );
    expect(last.matched_route).toBe('compatibility.search_toll_free_available_phone_numbers');
    expect(last.response_status).toBe(500);
  });

  // GAP: compatibility.list_available_phone_number_resources_by_country
  // (bare GET /AvailablePhoneNumbers/{IsoCountry}) has no SDK surface — the
  // namespace exposes only the /Local and /TollFree searches. Same accepted
  // gap as python/java; not faked.
});

// ---- Applications ------------------------------------------------------

describe('Compat Applications', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.applications.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Applications`);
    expect(last.matched_route).toBe('compatibility.list_applications');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_applications', 500, () =>
      client.compat.applications.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_applications');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.compat.applications.create({ FriendlyName: 'app' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Applications`);
    expect(last.matched_route).toBe('compatibility.create_application');
  });
  it('create error 422', async () => {
    const last = await callErr('compatibility.create_application', 422, () =>
      client.compat.applications.create({ FriendlyName: 'app' }),
    );
    expect(last.matched_route).toBe('compatibility.create_application');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.applications.get('AP1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Applications/AP1`);
    expect(last.matched_route).toBe('compatibility.get_application');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.get_application', 404, () =>
      client.compat.applications.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.get_application');
    expect(last.response_status).toBe(404);
  });

  it('update success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.applications.update('AP1', { FriendlyName: 'x' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Applications/AP1`);
    expect(last.matched_route).toBe('compatibility.update_application');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_application', 404, () =>
      client.compat.applications.update('missing', { FriendlyName: 'x' }),
    );
    expect(last.matched_route).toBe('compatibility.update_application');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.applications.delete('AP1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Applications/AP1`);
    expect(last.matched_route).toBe('compatibility.delete_application');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_application', 404, () =>
      client.compat.applications.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_application');
    expect(last.response_status).toBe(404);
  });
});

// ---- LaML Bins (cXML scripts) ------------------------------------------

describe('Compat LaML Bins', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.lamlBins.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/LamlBins`);
    expect(last.matched_route).toBe('compatibility.list_cxml_scripts');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_cxml_scripts', 500, () =>
      client.compat.lamlBins.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_cxml_scripts');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() =>
      client.compat.lamlBins.create({ Name: 'bin', Contents: '<Response/>' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/LamlBins`);
    expect(last.matched_route).toBe('compatibility.create_cxml_script');
  });
  it('create error 422', async () => {
    const last = await callErr('compatibility.create_cxml_script', 422, () =>
      client.compat.lamlBins.create({ Name: 'bin', Contents: '<Response/>' }),
    );
    expect(last.matched_route).toBe('compatibility.create_cxml_script');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.lamlBins.get('LA1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/LamlBins/LA1`);
    expect(last.matched_route).toBe('compatibility.retrieve_cxml_script');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.retrieve_cxml_script', 404, () =>
      client.compat.lamlBins.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_cxml_script');
    expect(last.response_status).toBe(404);
  });

  it('update success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.lamlBins.update('LA1', { Contents: '<Response/>' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/LamlBins/LA1`);
    expect(last.matched_route).toBe('compatibility.update_cxml_script');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_cxml_script', 404, () =>
      client.compat.lamlBins.update('missing', { Contents: '<Response/>' }),
    );
    expect(last.matched_route).toBe('compatibility.update_cxml_script');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.lamlBins.delete('LA1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/LamlBins/LA1`);
    expect(last.matched_route).toBe('compatibility.delete_cxml_script');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_cxml_script', 404, () =>
      client.compat.lamlBins.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_cxml_script');
    expect(last.response_status).toBe(404);
  });
});

// ---- Queues (with member operations) -----------------------------------

describe('Compat Queues', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.queues.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Queues`);
    expect(last.matched_route).toBe('compatibility.list_queues');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_queues', 500, () => client.compat.queues.list());
    expect(last.matched_route).toBe('compatibility.list_queues');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.compat.queues.create({ FriendlyName: 'support' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Queues`);
    expect(last.matched_route).toBe('compatibility.create_queue');
  });
  it('create error 422', async () => {
    const last = await callErr('compatibility.create_queue', 422, () =>
      client.compat.queues.create({ FriendlyName: 'support' }),
    );
    expect(last.matched_route).toBe('compatibility.create_queue');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.queues.get('QU1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Queues/QU1`);
    expect(last.matched_route).toBe('compatibility.retrieve_queue');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.retrieve_queue', 404, () =>
      client.compat.queues.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_queue');
    expect(last.response_status).toBe(404);
  });

  it('update success (POST)', async () => {
    const { last } = await callOk(() => client.compat.queues.update('QU1', { FriendlyName: 'x' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Queues/QU1`);
    expect(last.matched_route).toBe('compatibility.update_queue');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_queue', 404, () =>
      client.compat.queues.update('missing', { FriendlyName: 'x' }),
    );
    expect(last.matched_route).toBe('compatibility.update_queue');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.queues.delete('QU1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Queues/QU1`);
    expect(last.matched_route).toBe('compatibility.delete_queue');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_queue', 404, () =>
      client.compat.queues.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_queue');
    expect(last.response_status).toBe(404);
  });

  it('list members success', async () => {
    const { body, last } = await callOk(() => client.compat.queues.listMembers('QU1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Queues/QU1/Members`);
    expect(last.matched_route).toBe('compatibility.list_all_queue_members');
  });
  it('list members error 500', async () => {
    const last = await callErr('compatibility.list_all_queue_members', 500, () =>
      client.compat.queues.listMembers('QU1'),
    );
    expect(last.matched_route).toBe('compatibility.list_all_queue_members');
    expect(last.response_status).toBe(500);
  });

  it('get member success', async () => {
    const { last } = await callOk(() => client.compat.queues.getMember('QU1', 'CA1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Queues/QU1/Members/CA1`);
    expect(last.matched_route).toBe('compatibility.retrieve_queue_member');
  });
  it('get member error 404', async () => {
    const last = await callErr('compatibility.retrieve_queue_member', 404, () =>
      client.compat.queues.getMember('QU1', 'missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_queue_member');
    expect(last.response_status).toBe(404);
  });

  it('dequeue member success (POST)', async () => {
    const { last } = await callOk(() =>
      client.compat.queues.dequeueMember('QU1', 'CA1', { Url: 'http://x' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/Queues/QU1/Members/CA1`);
    expect(last.matched_route).toBe('compatibility.update_queue_member');
  });
  it('dequeue member error 404', async () => {
    const last = await callErr('compatibility.update_queue_member', 404, () =>
      client.compat.queues.dequeueMember('QU1', 'missing', { Url: 'http://x' }),
    );
    expect(last.matched_route).toBe('compatibility.update_queue_member');
    expect(last.response_status).toBe(404);
  });
});

// ---- Recordings (list / get / delete) ----------------------------------

describe('Compat Recordings', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.recordings.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Recordings`);
    expect(last.matched_route).toBe('compatibility.list_recordings');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_recordings', 500, () =>
      client.compat.recordings.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_recordings');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.recordings.get('RE1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Recordings/RE1`);
    expect(last.matched_route).toBe('compatibility.retrieve_recording');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.retrieve_recording', 404, () =>
      client.compat.recordings.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_recording');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.recordings.delete('RE1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Recordings/RE1`);
    expect(last.matched_route).toBe('compatibility.delete_recording');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_recording', 404, () =>
      client.compat.recordings.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_recording');
    expect(last.response_status).toBe(404);
  });
});

// ---- Transcriptions (list / get / delete) ------------------------------

describe('Compat Transcriptions', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.compat.transcriptions.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Transcriptions`);
    expect(last.matched_route).toBe('compatibility.list_transcriptions');
  });
  it('list error 500', async () => {
    const last = await callErr('compatibility.list_transcriptions', 500, () =>
      client.compat.transcriptions.list(),
    );
    expect(last.matched_route).toBe('compatibility.list_transcriptions');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.compat.transcriptions.get('TR1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${base()}/Transcriptions/TR1`);
    expect(last.matched_route).toBe('compatibility.retrieve_transcription');
  });
  it('get error 404', async () => {
    const last = await callErr('compatibility.retrieve_transcription', 404, () =>
      client.compat.transcriptions.get('missing'),
    );
    expect(last.matched_route).toBe('compatibility.retrieve_transcription');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.transcriptions.delete('TR1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/Transcriptions/TR1`);
    expect(last.matched_route).toBe('compatibility.delete_transcription');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_transcription', 404, () =>
      client.compat.transcriptions.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_transcription');
    expect(last.response_status).toBe(404);
  });
});

// ---- Tokens (create / update PATCH / delete) ---------------------------

describe('Compat Tokens', () => {
  it('create success', async () => {
    const { last } = await callOk(() =>
      client.compat.tokens.create({ name: 'tok', permissions: ['calling'] }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${base()}/tokens`);
    expect(last.matched_route).toBe('compatibility.create_token');
  });
  it('create error 422', async () => {
    const last = await callErr('compatibility.create_token', 422, () =>
      client.compat.tokens.create({ name: 'tok', permissions: ['calling'] }),
    );
    expect(last.matched_route).toBe('compatibility.create_token');
    expect(last.response_status).toBe(422);
  });

  it('update success (PATCH)', async () => {
    const { last } = await callOk(() =>
      client.compat.tokens.update('tok-1', { FriendlyName: 'x' }),
    );
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe(`${base()}/tokens/tok-1`);
    expect(last.matched_route).toBe('compatibility.update_token');
  });
  it('update error 404', async () => {
    const last = await callErr('compatibility.update_token', 404, () =>
      client.compat.tokens.update('missing', { FriendlyName: 'x' }),
    );
    expect(last.matched_route).toBe('compatibility.update_token');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.compat.tokens.delete('tok-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${base()}/tokens/tok-1`);
    expect(last.matched_route).toBe('compatibility.delete_token');
  });
  it('delete error 404', async () => {
    const last = await callErr('compatibility.delete_token', 404, () =>
      client.compat.tokens.delete('missing'),
    );
    expect(last.matched_route).toBe('compatibility.delete_token');
    expect(last.response_status).toBe(404);
  });
});
