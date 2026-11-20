/**
 * Outbound calls: placed only once every check passes.
 */

import {
  Callee,
  Dialer,
  NotPlaced,
  callingHours,
  consented,
} from '../../src/operations/outbound.js';

class Client {
  dialed: unknown[][] = [];
  calling = {
    dial: async (from: string, to: string, options?: Record<string, unknown>) => {
      this.dialed.push([from, to, options]);
      return { id: 'c1' };
    },
  };
}

const CONSENT: Record<string, boolean> = { '+15557654321': true, '+15550009999': false };
// A Friday: 10:00 in Los Angeles
const FRIDAY_1800_UTC = new Date(Date.UTC(2026, 10, 20, 18, 0));

function dialer(client: Client, extra: Record<string, unknown> = {}): Dialer {
  return new Dialer(client, {
    fromNumber: '+15550001111',
    url: 'https://agents.example.com/reminders',
    checks: [consented((c) => CONSENT[c.number]), callingHours('09:00', '20:00')],
    ...extra,
  });
}

describe('Dialer', () => {
  it('places a call once every check passes', async () => {
    const client = new Client();
    const out = await dialer(client, {
      timeout: 25,
      statusUrl: 'https://x/status',
      statusEvents: ['ended'],
    }).place(
      new Callee('+15557654321', 'America/Los_Angeles', { appointment: 'a1' }),
      FRIDAY_1800_UTC,
    );
    expect(out).toEqual({ id: 'c1' });
    expect(client.dialed).toEqual([
      [
        '+15550001111',
        '+15557654321',
        {
          url: 'https://agents.example.com/reminders?appointment=a1',
          status_url: 'https://x/status',
          status_events: ['ended'],
          extras: { timeout: 25 },
        },
      ],
    ]);
  });

  it.each([
    ['+15550009999', 'America/New_York', 'consent withdrawn'],
    ['+15550000000', 'America/New_York', 'no consent on record'],
    ['+15557654321', 'Asia/Tokyo', 'outside the calling hours, it is 03:00 in Asia/Tokyo'],
  ])('places nothing for %s in %s: %s', async (number, zone, reason) => {
    const client = new Client();
    const placing = dialer(client).place(new Callee(number, zone), FRIDAY_1800_UTC);
    await expect(placing).rejects.toBeInstanceOf(NotPlaced);
    await expect(placing).rejects.toMatchObject({ reason });
    expect(client.dialed).toEqual([]);
  });

  it('checks calling days and its input', () => {
    const weekdays = new Dialer(new Client(), {
      fromNumber: '+1',
      swml: { version: '1.0.0', sections: { main: [] } },
      checks: [callingHours('00:00', '23:59', { days: [0, 1, 2, 3] })],
    });
    expect(weekdays.whyNot(new Callee('+1555', 'UTC'), FRIDAY_1800_UTC)).toBe(
      'not a calling day where they are (Friday in UTC)',
    );
    expect(() => weekdays.whyNot(new Callee('+1555', 'Mars/Olympus'))).toThrow(/time zone/);
    expect(() => new Dialer(new Client(), { fromNumber: '+1' })).toThrow(/one of them/);
    expect(() => callingHours('9am', '20:00')).toThrow(/time of day/);
  });

  it('quotes the data as the reference does, and runs a document', async () => {
    const client = new Client();
    await new Dialer(client, {
      fromNumber: '+1',
      url: 'https://a.example.com/r?x=1',
      checks: [],
    }).place(
      new Callee('+2', 'UTC', { who: 'Ann Lee', note: "a~b*c's", ok: true }),
      FRIDAY_1800_UTC,
    );
    expect((client.dialed[0]![2] as Record<string, unknown>)['url']).toBe(
      'https://a.example.com/r?x=1&who=Ann+Lee&note=a~b%2Ac%27s&ok=True',
    );
    const doc = { version: '1.0.0', sections: { main: [{ hangup: {} }] } };
    await new Dialer(client, { fromNumber: '+1', swml: doc }).place(new Callee('+3', 'UTC'));
    expect(client.dialed[1]).toEqual(['+1', '+3', { swml: doc }]);
  });

  it('counts the end of the calling hours to the second', () => {
    const d = new Dialer(new Client(), {
      fromNumber: '+1',
      swml: {},
      checks: [callingHours('09:00', '20:00')],
    });
    const callee = new Callee('+1', 'UTC');
    expect(d.whyNot(callee, new Date(Date.UTC(2026, 10, 20, 20, 0, 0)))).toBeNull();
    expect(d.whyNot(callee, new Date(Date.UTC(2026, 10, 20, 20, 0, 1)))).toBe(
      'outside the calling hours, it is 20:00 in UTC',
    );
    expect(d.whyNot(callee, new Date(Date.UTC(2026, 10, 20, 9, 0, 0)))).toBeNull();
  });
});
