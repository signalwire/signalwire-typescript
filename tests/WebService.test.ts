import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebService } from '../src/WebService.js';
import { suppressAllLogs } from '../src/Logger.js';

// Every WebService request needs credentials; these are the ones the
// environment sets for each test.
const AUTH = { Authorization: `Basic ${Buffer.from('test:test-pass').toString('base64')}` };

/** GET `path` from `app` with the test credentials. */
function fetchAs(app: ReturnType<WebService['getApp']>, path: string) {
  return app.request(path, { headers: AUTH });
}

let root: string;
let mount: string;
let outside: string;

beforeAll(() => {
  suppressAllLogs(true);
});

beforeEach(() => {
  // Known credentials, whatever the developer's environment holds.
  vi.stubEnv('SWML_BASIC_AUTH_USER', 'test');
  vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', 'test-pass');
  root = mkdtempSync(join(tmpdir(), 'webservice-test-'));
  mount = join(root, 'mount');
  outside = join(root, 'outside');
  mkdirSync(mount);
  mkdirSync(outside);
  writeFileSync(join(mount, 'inside.txt'), 'inside');
  writeFileSync(join(outside, 'secret.txt'), 'outside-secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe('WebService symbolic links', () => {
  it('serves a regular file inside the mount', async () => {
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await fetchAs(web.getApp(), '/docs/inside.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
  });

  it('refuses a file symlink that points outside the mount', async () => {
    symlinkSync(join(outside, 'secret.txt'), join(mount, 'link.txt'));
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await fetchAs(web.getApp(), '/docs/link.txt');
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('outside-secret');
  });

  it('refuses a directory symlink that points outside the mount', async () => {
    symlinkSync(outside, join(mount, 'escape'));
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await fetchAs(web.getApp(), '/docs/escape/secret.txt');
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('outside-secret');
  });

  it('refuses an index.html symlink that points outside the mount', async () => {
    mkdirSync(join(mount, 'sub'));
    writeFileSync(join(outside, 'index.html'), 'outside-index');
    symlinkSync(join(outside, 'index.html'), join(mount, 'sub', 'index.html'));
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await fetchAs(web.getApp(), '/docs/sub/');
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('outside-index');
  });

  it('serves a symlink whose target stays inside the mount', async () => {
    symlinkSync(join(mount, 'inside.txt'), join(mount, 'alias.txt'));
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await fetchAs(web.getApp(), '/docs/alias.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
  });

  it('serves files when the mounted directory itself is reached through a symlink', async () => {
    const linkedMount = join(root, 'linked-mount');
    symlinkSync(mount, linkedMount);
    const web = new WebService({ directories: { '/docs': linkedMount } });
    const res = await fetchAs(web.getApp(), '/docs/inside.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
  });

  it('does not list a symlink that points outside the mount', async () => {
    symlinkSync(join(outside, 'secret.txt'), join(mount, 'link.txt'));
    const web = new WebService({ directories: { '/docs': mount }, enableDirectoryBrowsing: true });
    const res = await fetchAs(web.getApp(), '/docs/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('inside.txt');
    expect(html).not.toContain('link.txt');
  });
});

// The blocklist and allowlist apply to the file actually read, not only to the
// name in the URL: a link inside the mount can't serve a blocked file under an
// allowed name.
describe('WebService blocks dot-named directories (found in review)', () => {
  it("doesn't serve files under a .git directory in a mount", async () => {
    mkdirSync(join(mount, '.git'));
    writeFileSync(join(mount, '.git', 'config'), '[remote] url = secret');
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await fetchAs(web.getApp(), '/docs/.git/config');
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('secret');
  });
});

describe('WebService blocklist through symbolic links', () => {
  beforeEach(() => {
    writeFileSync(join(mount, '.env'), 'env-secret');
    writeFileSync(join(mount, 'server.key'), 'key-secret');
    mkdirSync(join(mount, '__pycache__'));
    writeFileSync(join(mount, '__pycache__', 'data.txt'), 'cache-secret');
  });

  async function get(path: string, options: Record<string, unknown> = {}) {
    const web = new WebService({ directories: { '/docs': mount }, ...options });
    const res = await fetchAs(web.getApp(), path);
    return { status: res.status, body: await res.text() };
  }

  it('refuses a link to .env', async () => {
    symlinkSync(join(mount, '.env'), join(mount, 'alias.txt'));
    expect((await get('/docs/.env')).status).toBe(403);
    const res = await get('/docs/alias.txt');
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('env-secret');
  });

  it('refuses a relative link to a .key file', async () => {
    symlinkSync('server.key', join(mount, 'cert.txt'));
    const res = await get('/docs/cert.txt');
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('key-secret');
  });

  it('refuses a link into a blocked directory', async () => {
    symlinkSync(join(mount, '__pycache__', 'data.txt'), join(mount, 'notes.txt'));
    const res = await get('/docs/notes.txt');
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('cache-secret');
  });

  it('refuses a file under a directory link to a blocked directory', async () => {
    symlinkSync(join(mount, '__pycache__'), join(mount, 'pub'));
    const res = await get('/docs/pub/data.txt');
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('cache-secret');
  });

  it('refuses a listing through a directory link to a blocked directory', async () => {
    symlinkSync(join(mount, '__pycache__'), join(mount, 'pub'));
    const res = await get('/docs/pub/', { enableDirectoryBrowsing: true });
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('data.txt');
  });

  it('refuses an index.html that links to .env', async () => {
    mkdirSync(join(mount, 'sub'));
    symlinkSync(join(mount, '.env'), join(mount, 'sub', 'index.html'));
    const res = await get('/docs/sub/');
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('env-secret');
  });

  it('applies allowedExtensions to the link target', async () => {
    writeFileSync(join(mount, 'data.bin'), 'binary-secret');
    symlinkSync(join(mount, 'data.bin'), join(mount, 'data.txt'));
    const res = await get('/docs/data.txt', { allowedExtensions: ['.txt'] });
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('binary-secret');
  });

  it('still serves a link to an allowed file', async () => {
    symlinkSync(join(mount, 'inside.txt'), join(mount, 'alias.txt'));
    const res = await get('/docs/alias.txt');
    expect(res.status).toBe(200);
    expect(res.body).toBe('inside');
  });
});

describe('WebService runtime directory changes', () => {
  it('addDirectory() after the first request serves the new route', async () => {
    const web = new WebService();
    const app = web.getApp();
    expect((await fetchAs(app, '/health')).status).toBe(200);

    expect(() => web.addDirectory('/late', mount)).not.toThrow();
    const res = await fetchAs(app, '/late/inside.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
  });

  it('removeDirectory() stops serving the route', async () => {
    const web = new WebService({ directories: { '/docs': mount } });
    const app = web.getApp();
    expect((await fetchAs(app, '/docs/inside.txt')).status).toBe(200);

    web.removeDirectory('/docs');
    expect((await fetchAs(app, '/docs/inside.txt')).status).toBe(404);
    const health = (await (await fetchAs(app, '/health')).json()) as { directories: string[] };
    expect(health.directories).not.toContain('/docs');
  });

  it('removeDirectory() accepts a route without its leading slash', async () => {
    const web = new WebService({ directories: { '/docs': mount } });
    web.removeDirectory('docs');
    expect((await fetchAs(web.getApp(), '/docs/inside.txt')).status).toBe(404);
  });

  it('matches a prefix only at a path segment boundary', async () => {
    const web = new WebService({ directories: { '/docs': mount } });
    expect((await fetchAs(web.getApp(), '/docsx/inside.txt')).status).toBe(404);
  });

  it('serves from the longest matching prefix', async () => {
    writeFileSync(join(outside, 'inside.txt'), 'nested');
    const web = new WebService({ directories: { '/docs': mount, '/docs/nested': outside } });
    const res = await fetchAs(web.getApp(), '/docs/nested/inside.txt');
    expect(await res.text()).toBe('nested');
  });

  it("serves a directory mounted at '/' without shadowing / and /health", async () => {
    const web = new WebService({ directories: { '/': mount } });
    const app = web.getApp();
    const res = await fetchAs(app, '/inside.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
    expect((await fetchAs(app, '/health')).headers.get('content-type')).toContain(
      'application/json',
    );
    expect(await (await fetchAs(app, '/')).text()).toContain('SignalWire Web Service');
  });
});

describe('WebService removeDirectory() route spelling', () => {
  it('removes a route stored with a trailing slash', async () => {
    const web = new WebService({ directories: { '/docs/': mount } });
    expect((await fetchAs(web.getApp(), '/docs/inside.txt')).status).toBe(200);
    web.removeDirectory('/docs');
    expect(web.directories).toEqual({});
    expect((await fetchAs(web.getApp(), '/docs/inside.txt')).status).toBe(404);
  });
});

describe('WebService config file search', () => {
  it('skips an invalid web_service.json found by the search instead of throwing', () => {
    writeFileSync(join(root, 'web_service.json'), '{ not valid json');
    const cwd = process.cwd();
    process.chdir(root);
    try {
      let web: WebService | undefined;
      expect(() => {
        web = new WebService({ directories: { '/docs': mount } });
      }).not.toThrow();
      expect(web?.port).toBe(8002);
      expect(web?.directories).toEqual({ '/docs': mount });
    } finally {
      process.chdir(cwd);
    }
  });

  it('loads a valid web_service.json found by the search', () => {
    writeFileSync(join(root, 'web_service.json'), JSON.stringify({ service: { port: 9123 } }));
    const cwd = process.cwd();
    process.chdir(root);
    try {
      expect(new WebService().port).toBe(9123);
    } finally {
      process.chdir(cwd);
    }
  });
});

describe('WebService basic auth sources', () => {
  const basic = (user: string, pass: string) =>
    `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

  it('enforces SWML_BASIC_AUTH_USER / SWML_BASIC_AUTH_PASSWORD from the environment', async () => {
    vi.stubEnv('SWML_BASIC_AUTH_USER', 'envuser');
    vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', 'envpass');
    const app = new WebService({ directories: { '/docs': mount } }).getApp();

    expect((await app.request('/docs/inside.txt')).status).toBe(401);
    const ok = await app.request('/docs/inside.txt', {
      headers: { Authorization: basic('envuser', 'envpass') },
    });
    expect(ok.status).toBe(200);
    const health = await app.request('/health', {
      headers: { Authorization: basic('envuser', 'envpass') },
    });
    expect(((await health.json()) as { authRequired: boolean }).authRequired).toBe(true);
  });

  it("defaults the user to 'signalwire' when only the password is set", async () => {
    vi.stubEnv('SWML_BASIC_AUTH_USER', '');
    vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', 'envpass');
    const app = new WebService({ directories: { '/docs': mount } }).getApp();
    expect((await app.request('/docs/inside.txt')).status).toBe(401);
    const ok = await app.request('/docs/inside.txt', {
      headers: { Authorization: basic('signalwire', 'envpass') },
    });
    expect(ok.status).toBe(200);
  });

  it('prefers the basicAuth option over the environment', async () => {
    vi.stubEnv('SWML_BASIC_AUTH_USER', 'envuser');
    vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', 'envpass');
    const app = new WebService({
      directories: { '/docs': mount },
      basicAuth: ['optuser', 'optpass'],
    }).getApp();
    const envCreds = await app.request('/docs/inside.txt', {
      headers: { Authorization: basic('envuser', 'envpass') },
    });
    expect(envCreds.status).toBe(401);
    const optCreds = await app.request('/docs/inside.txt', {
      headers: { Authorization: basic('optuser', 'optpass') },
    });
    expect(optCreds.status).toBe(200);
  });

  it("reads credentials from the config file's security.auth.basic", async () => {
    const configFile = join(root, 'web.json');
    writeFileSync(
      configFile,
      JSON.stringify({ security: { auth: { basic: { user: 'fileuser', password: 'filepass' } } } }),
    );
    const app = new WebService({ configFile, directories: { '/docs': mount } }).getApp();
    expect((await app.request('/docs/inside.txt')).status).toBe(401);
    const ok = await app.request('/docs/inside.txt', {
      headers: { Authorization: basic('fileuser', 'filepass') },
    });
    expect(ok.status).toBe(200);
  });
});

describe('WebService CORS origins', () => {
  const preflight = (app: ReturnType<WebService['getApp']>, origin: string) =>
    app.request('/docs/inside.txt', {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
    });

  it("allows every origin when SWML_CORS_ORIGINS is '*'", async () => {
    vi.stubEnv('SWML_CORS_ORIGINS', '*');
    const app = new WebService({ directories: { '/docs': mount } }).getApp();
    const res = await preflight(app, 'https://anywhere.example.com');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it("allows every origin when SWML_CORS_ORIGINS lists '*' among others", async () => {
    vi.stubEnv('SWML_CORS_ORIGINS', 'https://a.example.com, *');
    const app = new WebService({ directories: { '/docs': mount } }).getApp();
    const res = await preflight(app, 'https://anywhere.example.com');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('allows only the listed origins otherwise', async () => {
    vi.stubEnv('SWML_CORS_ORIGINS', 'https://a.example.com');
    const app = new WebService({ directories: { '/docs': mount } }).getApp();
    const ok = await preflight(app, 'https://a.example.com');
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://a.example.com');
    const other = await preflight(app, 'https://b.example.com');
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});

// Any path component below the mount that starts with a dot is refused, as
// listings already hide them, except `.well-known` (ACME challenges,
// security.txt). The check covers the path requested and the file read.
describe('WebService refuses dot-named path components below the mount', () => {
  beforeEach(() => {
    writeFileSync(join(mount, '.env.production'), 'prod-secret');
    mkdirSync(join(mount, '.ssh'));
    writeFileSync(join(mount, '.ssh', 'id_rsa'), 'ssh-secret');
    mkdirSync(join(mount, '.aws'));
    writeFileSync(join(mount, '.aws', 'credentials'), 'aws-secret');
  });

  async function get(path: string, options: Record<string, unknown> = {}) {
    const web = new WebService({ directories: { '/docs': mount }, ...options });
    const res = await fetchAs(web.getApp(), path);
    return { status: res.status, body: await res.text() };
  }

  it.each([
    ['/docs/.env.production', 'prod-secret'],
    ['/docs/.ssh/id_rsa', 'ssh-secret'],
    ['/docs/.aws/credentials', 'aws-secret'],
    ['/docs/%2eenv.production', 'prod-secret'],
    ['/docs/%2essh/id_rsa', 'ssh-secret'],
  ])('refuses %s', async (path, secret) => {
    const res = await get(path);
    expect(res.status).toBe(403);
    expect(res.body).not.toContain(secret);
  });

  it('refuses a dot-named path that does not exist with 403, not 404', async () => {
    expect((await get('/docs/.npmrc')).status).toBe(403);
  });

  it('refuses a listing of a dot-named directory', async () => {
    const res = await get('/docs/.ssh/', { enableDirectoryBrowsing: true });
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('id_rsa');
  });

  it('refuses a file link to a file under a dot-named directory', async () => {
    symlinkSync(join(mount, '.aws', 'credentials'), join(mount, 'notes.txt'));
    const res = await get('/docs/notes.txt');
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('aws-secret');
  });

  it('refuses a file link to a dot-named file', async () => {
    symlinkSync(join(mount, '.env.production'), join(mount, 'config.txt'));
    const res = await get('/docs/config.txt');
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('prod-secret');
  });

  it('refuses a file under a directory link to a dot-named directory', async () => {
    symlinkSync(join(mount, '.ssh'), join(mount, 'keys'));
    const res = await get('/docs/keys/id_rsa');
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('ssh-secret');
  });

  it('refuses a listing through a directory link to a dot-named directory', async () => {
    symlinkSync(join(mount, '.ssh'), join(mount, 'keys'));
    const res = await get('/docs/keys/', { enableDirectoryBrowsing: true });
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('id_rsa');
  });

  it('refuses an index.html that links into a dot-named directory', async () => {
    writeFileSync(join(mount, '.ssh', 'page.html'), 'hidden-page');
    mkdirSync(join(mount, 'sub'));
    symlinkSync(join(mount, '.ssh', 'page.html'), join(mount, 'sub', 'index.html'));
    const res = await get('/docs/sub/');
    expect(res.status).toBe(403);
    expect(res.body).not.toContain('hidden-page');
  });

  it('serves files under .well-known', async () => {
    mkdirSync(join(mount, '.well-known', 'acme-challenge'), { recursive: true });
    writeFileSync(join(mount, '.well-known', 'acme-challenge', 'token'), 'proof');
    writeFileSync(join(mount, '.well-known', 'security.txt'), 'Contact: sec@example.com');
    const token = await get('/docs/.well-known/acme-challenge/token');
    expect(token.status).toBe(200);
    expect(token.body).toBe('proof');
    expect((await get('/docs/.well-known/security.txt')).status).toBe(200);
  });

  it('still refuses a dot-named file under .well-known', async () => {
    mkdirSync(join(mount, '.well-known'));
    writeFileSync(join(mount, '.well-known', '.secret'), 'wk-secret');
    expect((await get('/docs/.well-known/.secret')).status).toBe(403);
  });

  it('serves a mount that itself lives under a dot-named directory', async () => {
    const hiddenMount = join(root, '.site', 'public');
    mkdirSync(hiddenMount, { recursive: true });
    writeFileSync(join(hiddenMount, 'page.txt'), 'public-page');
    const web = new WebService({ directories: { '/site': hiddenMount } });
    const res = await fetchAs(web.getApp(), '/site/page.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('public-page');
  });

  it('does not list a blocked directory name', async () => {
    mkdirSync(join(mount, '__pycache__'));
    mkdirSync(join(mount, 'visible'));
    const res = await get('/docs/', { enableDirectoryBrowsing: true });
    expect(res.body).toContain('visible/');
    expect(res.body).not.toContain('__pycache__');
  });
});

// WebService refuses to run without credentials, as the Python reference does:
// with none configured it would serve every file to anyone.
describe('WebService requires credentials', () => {
  const basic = (user: string, pass: string) =>
    `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

  beforeEach(() => {
    vi.stubEnv('SWML_BASIC_AUTH_USER', '');
    vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', '');
  });

  it('start() rejects when no source sets a password, naming the ways to set one', async () => {
    const web = new WebService({ directories: { '/docs': mount } });
    await expect(web.start('127.0.0.1', 0)).rejects.toThrow(
      /SWML_BASIC_AUTH_PASSWORD.*basicAuth.*security\.auth\.basic/s,
    );
  });

  it('start() rejects a basicAuth option with an empty password', async () => {
    const web = new WebService({ directories: { '/docs': mount }, basicAuth: ['admin', ''] });
    await expect(web.start('127.0.0.1', 0)).rejects.toThrow(/credentials/);
  });

  it('start() runs with credentials from the environment', async () => {
    vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', 'envpass');
    const web = new WebService({ directories: { '/docs': mount } });
    await expect(web.start('127.0.0.1', 0)).resolves.toBeUndefined();
    web.stop();
  });

  it('start() runs with the basicAuth option', async () => {
    const web = new WebService({ directories: { '/docs': mount }, basicAuth: ['u', 'p'] });
    await expect(web.start('127.0.0.1', 0)).resolves.toBeUndefined();
    web.stop();
  });

  it('refuses every file request, rather than serving it, when no password is configured', async () => {
    const app = new WebService({ directories: { '/docs': mount } }).getApp();
    expect((await app.request('/docs/inside.txt')).status).toBe(401);
    const empty = await app.request('/docs/inside.txt', {
      headers: { Authorization: basic('signalwire', '') },
    });
    expect(empty.status).toBe(401);
    expect((await app.request('/')).status).toBe(401);
  });

  it('serves /health without credentials, reporting that auth is required', async () => {
    vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', 'envpass');
    const app = new WebService({ directories: { '/docs': mount } }).getApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { authRequired: boolean }).authRequired).toBe(true);
    expect((await app.request('/')).status).toBe(401);
    expect((await app.request('/docs/inside.txt')).status).toBe(401);
  });
});
