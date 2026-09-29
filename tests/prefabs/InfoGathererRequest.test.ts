import { InfoGathererAgent } from '../../src/prefabs/InfoGathererAgent.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => {
  suppressAllLogs(true);
});

const AUTH = `Basic ${Buffer.from('user:pass').toString('base64')}`;

describe('InfoGathererAgent question callback request context', () => {
  it('passes the request query parameters and headers to the callback over HTTP', async () => {
    const seen: { query?: Record<string, string>; headers?: Record<string, string> } = {};
    const agent = new InfoGathererAgent({
      agentOptions: { basicAuth: ['user', 'pass'] },
      questionCallback: (query, _body, headers) => {
        seen.query = query;
        seen.headers = headers;
        return query['mode'] === 'support'
          ? [{ key_name: 'issue', question_text: 'What is the support issue?' }]
          : [{ key_name: 'name', question_text: 'What is your name?' }];
      },
    });

    const res = await agent.getApp().request('/info_gatherer?mode=support', {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json', 'X-Tenant': 'acme' },
      body: JSON.stringify({ call_id: 'c1' }),
    });
    expect(res.status).toBe(200);

    expect(seen.query).toEqual({ mode: 'support' });
    expect(seen.headers?.['x-tenant']).toBe('acme');
    // Credential-bearing headers are not handed to the callback.
    expect(seen.headers?.['authorization']).toBeUndefined();
    expect(JSON.stringify(await res.json())).toContain('What is the support issue?');
  });

  it('does not read query parameters or headers from the request body', async () => {
    const seen: { query?: Record<string, string>; headers?: Record<string, string> } = {};
    const agent = new InfoGathererAgent({
      agentOptions: { basicAuth: ['user', 'pass'] },
      questionCallback: (query, body, headers) => {
        seen.query = query;
        seen.headers = headers;
        expect(body['query_params']).toEqual({ mode: 'spoofed' });
        return [{ key_name: 'name', question_text: 'What is your name?' }];
      },
    });

    const res = await agent.getApp().request('/info_gatherer', {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_params: { mode: 'spoofed' }, headers: { 'x-tenant': 'evil' } }),
    });
    expect(res.status).toBe(200);
    expect(seen.query).toEqual({});
    expect(seen.headers?.['x-tenant']).toBeUndefined();
  });
});
