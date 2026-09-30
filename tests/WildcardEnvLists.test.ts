/**
 * "*" in SWML_ALLOWED_HOSTS and SWML_CORS_ORIGINS allows every host and every
 * origin, as the Python SDK's SecurityConfig parses it. It blocked every host
 * and allowed no origin. Found by the documentation pass.
 */
import { AgentBase } from '../src/AgentBase.js';

const AUTH = 'Basic ' + btoa('u:p');

function agent(): AgentBase {
  const a = new AgentBase({ name: 'wild', route: '/', basicAuth: ['u', 'p'] });
  a.setPromptText('hi');
  return a;
}

describe('"*" in the environment lists', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const v of ['SWML_ALLOWED_HOSTS', 'SWML_CORS_ORIGINS']) saved[v] = process.env[v];
  });
  afterEach(() => {
    for (const [v, val] of Object.entries(saved)) {
      if (val === undefined) delete process.env[v];
      else process.env[v] = val;
    }
  });

  it('SWML_ALLOWED_HOSTS="*" allows any host', async () => {
    process.env['SWML_ALLOWED_HOSTS'] = '*';
    const res = await agent()
      .getApp()
      .request('http://agent.example.com/', { headers: { Authorization: AUTH } });
    expect(res.status).toBe(200);
  });

  it("SWML_ALLOWED_HOSTS still refuses a host it doesn't list", async () => {
    process.env['SWML_ALLOWED_HOSTS'] = 'good.example.com';
    const res = await agent()
      .getApp()
      .request('http://agent.example.com/', { headers: { Authorization: AUTH } });
    expect(res.status).toBe(403);
  });

  it('SWML_CORS_ORIGINS="*" allows any origin, without credentials', async () => {
    process.env['SWML_CORS_ORIGINS'] = '*';
    const res = await agent()
      .getApp()
      .request('/', {
        method: 'OPTIONS',
        headers: { Origin: 'https://site.example.com', 'Access-Control-Request-Method': 'POST' },
      });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });
});
