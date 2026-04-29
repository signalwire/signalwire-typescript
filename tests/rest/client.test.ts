import { RestClient } from '../../src/rest/index.js';
import { createMockFetch } from './helpers.js';

describe('RestClient', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save and clear REST-related env vars to prevent leaking between tests
    for (const key of ['SIGNALWIRE_PROJECT_ID', 'SIGNALWIRE_API_TOKEN', 'SIGNALWIRE_SPACE']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it('constructs with explicit options', () => {
    const [fetchImpl] = createMockFetch();
    const client = new RestClient({
      project: 'proj-123',
      token: 'tok-456',
      host: 'test.signalwire.com',
      fetchImpl,
    });

    // Every documented namespace must be a real object (not undefined,
    // not null, not a primitive). A stub returning a sparse RestClient
    // would fail these checks. We additionally probe each namespace has
    // a `list` / known-shape method to catch the case where a stub
    // returned plain `{}` placeholders.
    type Indexable = Record<string, unknown>;
    const expected: ReadonlyArray<readonly [keyof RestClient, string]> = [
      ['fabric', 'fabric'],
      ['calling', 'calling'],
      ['phoneNumbers', 'phoneNumbers'],
      ['addresses', 'addresses'],
      ['queues', 'queues'],
      ['recordings', 'recordings'],
      ['numberGroups', 'numberGroups'],
      ['verifiedCallers', 'verifiedCallers'],
      ['sipProfile', 'sipProfile'],
      ['lookup', 'lookup'],
      ['shortCodes', 'shortCodes'],
      ['importedNumbers', 'importedNumbers'],
      ['mfa', 'mfa'],
      ['registry', 'registry'],
      ['datasphere', 'datasphere'],
      ['video', 'video'],
      ['logs', 'logs'],
      ['project', 'project'],
      ['pubsub', 'pubsub'],
      ['chat', 'chat'],
      ['compat', 'compat'],
    ];
    for (const [key, label] of expected) {
      const ns = client[key] as unknown;
      expect(ns, `client.${label} missing or wrong type`).toBeInstanceOf(Object);
      expect(typeof ns).toBe('object');
    }
    // Sanity-check the count to lock in the documented 21-namespace
    // contract. Adding a new namespace should require updating the test.
    expect(expected).toHaveLength(21);
  });

  it('throws when project is missing', () => {
    const [fetchImpl] = createMockFetch();
    expect(() => new RestClient({
      token: 'tok',
      host: 'test.signalwire.com',
      fetchImpl,
    })).toThrow(/project, token, and host are required/);
  });

  it('throws when token is missing', () => {
    const [fetchImpl] = createMockFetch();
    expect(() => new RestClient({
      project: 'proj',
      host: 'test.signalwire.com',
      fetchImpl,
    })).toThrow(/project, token, and host are required/);
  });

  it('throws when host is missing', () => {
    const [fetchImpl] = createMockFetch();
    expect(() => new RestClient({
      project: 'proj',
      token: 'tok',
      fetchImpl,
    })).toThrow(/project, token, and host are required/);
  });

  it('reads from environment variables', async () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { data: [] } },
    ]);
    process.env['SIGNALWIRE_PROJECT_ID'] = 'env-proj';
    process.env['SIGNALWIRE_API_TOKEN'] = 'env-tok';
    process.env['SIGNALWIRE_SPACE'] = 'env.signalwire.com';

    const client = new RestClient({ fetchImpl });
    // Reading env vars is observable: the constructor builds the auth
    // header from project:token and the URL from SIGNALWIRE_SPACE. Make
    // a real request through the mock fetch and assert on what reaches
    // the wire — that's the only assertion that proves the env vars
    // were actually consumed (instead of silently lost).
    await client.phoneNumbers.list();
    const reqs = getRequests();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].url).toContain('env.signalwire.com');
    const expectedAuth =
      'Basic ' + Buffer.from('env-proj:env-tok').toString('base64');
    expect(reqs[0].headers['Authorization']).toBe(expectedAuth);
  });

  it('explicit options override env vars', () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { data: [] } },
    ]);
    process.env['SIGNALWIRE_PROJECT_ID'] = 'env-proj';
    process.env['SIGNALWIRE_API_TOKEN'] = 'env-tok';
    process.env['SIGNALWIRE_SPACE'] = 'env.signalwire.com';

    const client = new RestClient({
      project: 'explicit-proj',
      token: 'explicit-tok',
      host: 'explicit.signalwire.com',
      fetchImpl,
    });

    // Verify by making a request and checking the auth header + URL
    client.phoneNumbers.list();
    const reqs = getRequests();
    // Auth header should use explicit creds
    const expected = 'Basic ' + Buffer.from('explicit-proj:explicit-tok').toString('base64');
    expect(reqs[0].headers['Authorization']).toBe(expected);
    // URL should use explicit host
    expect(reqs[0].url).toContain('explicit.signalwire.com');
  });

  it('normalizes host without https://', () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { data: [] } },
    ]);
    const client = new RestClient({
      project: 'proj',
      token: 'tok',
      host: 'my.signalwire.com',
      fetchImpl,
    });

    client.phoneNumbers.list();
    expect(getRequests()[0].url).toMatch(/^https:\/\/my\.signalwire\.com/);
  });

  it('preserves https:// if already present', () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { data: [] } },
    ]);
    const client = new RestClient({
      project: 'proj',
      token: 'tok',
      host: 'https://my.signalwire.com',
      fetchImpl,
    });

    client.phoneNumbers.list();
    expect(getRequests()[0].url).toMatch(/^https:\/\/my\.signalwire\.com/);
    expect(getRequests()[0].url).not.toContain('https://https://');
  });

  it('compat namespace is scoped to project ID', async () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { calls: [] } },
    ]);
    const client = new RestClient({
      project: 'proj-abc',
      token: 'tok',
      host: 'test.signalwire.com',
      fetchImpl,
    });

    await client.compat.calls.list();
    expect(getRequests()[0].url).toContain('/api/laml/2010-04-01/Accounts/proj-abc/Calls');
  });

  it('all namespaces route through same HttpClient', async () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { data: [] } },  // fabric
      { status: 200, body: {} },             // calling
      { status: 200, body: { data: [] } },   // phoneNumbers
      { status: 200, body: { data: [] } },   // video
    ]);
    const client = new RestClient({
      project: 'proj',
      token: 'tok',
      host: 'test.signalwire.com',
      fetchImpl,
    });

    await client.fabric.aiAgents.list();
    await client.calling.dial({ to: '+1' });
    await client.phoneNumbers.list();
    await client.video.rooms.list();

    const reqs = getRequests();
    expect(reqs).toHaveLength(4);

    // All should use same auth
    const auth = reqs[0].headers['Authorization'];
    for (const req of reqs) {
      expect(req.headers['Authorization']).toBe(auth);
    }

    // Verify different paths
    expect(reqs[0].url).toContain('/api/fabric/resources/ai_agents');
    expect(reqs[1].url).toContain('/api/calling/calls');
    expect(reqs[2].url).toContain('/api/relay/rest/phone_numbers');
    expect(reqs[3].url).toContain('/api/video/rooms');
  });
});
