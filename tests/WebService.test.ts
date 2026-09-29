import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebService } from '../src/WebService.js';
import { suppressAllLogs } from '../src/Logger.js';

let root: string;
let mount: string;
let outside: string;

beforeAll(() => {
  suppressAllLogs(true);
});

beforeEach(() => {
  // Credentials in the developer's environment would otherwise turn on auth.
  vi.stubEnv('SWML_BASIC_AUTH_USER', '');
  vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', '');
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
    const res = await web.getApp().request('/docs/inside.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
  });

  it('refuses a file symlink that points outside the mount', async () => {
    symlinkSync(join(outside, 'secret.txt'), join(mount, 'link.txt'));
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await web.getApp().request('/docs/link.txt');
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('outside-secret');
  });

  it('refuses a directory symlink that points outside the mount', async () => {
    symlinkSync(outside, join(mount, 'escape'));
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await web.getApp().request('/docs/escape/secret.txt');
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('outside-secret');
  });

  it('refuses an index.html symlink that points outside the mount', async () => {
    mkdirSync(join(mount, 'sub'));
    writeFileSync(join(outside, 'index.html'), 'outside-index');
    symlinkSync(join(outside, 'index.html'), join(mount, 'sub', 'index.html'));
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await web.getApp().request('/docs/sub/');
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('outside-index');
  });

  it('serves a symlink whose target stays inside the mount', async () => {
    symlinkSync(join(mount, 'inside.txt'), join(mount, 'alias.txt'));
    const web = new WebService({ directories: { '/docs': mount } });
    const res = await web.getApp().request('/docs/alias.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
  });

  it('serves files when the mounted directory itself is reached through a symlink', async () => {
    const linkedMount = join(root, 'linked-mount');
    symlinkSync(mount, linkedMount);
    const web = new WebService({ directories: { '/docs': linkedMount } });
    const res = await web.getApp().request('/docs/inside.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
  });

  it('does not list a symlink that points outside the mount', async () => {
    symlinkSync(join(outside, 'secret.txt'), join(mount, 'link.txt'));
    const web = new WebService({ directories: { '/docs': mount }, enableDirectoryBrowsing: true });
    const res = await web.getApp().request('/docs/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('inside.txt');
    expect(html).not.toContain('link.txt');
  });
});

describe('WebService runtime directory changes', () => {
  it('addDirectory() after the first request serves the new route', async () => {
    const web = new WebService();
    const app = web.getApp();
    expect((await app.request('/health')).status).toBe(200);

    expect(() => web.addDirectory('/late', mount)).not.toThrow();
    const res = await app.request('/late/inside.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
  });

  it('removeDirectory() stops serving the route', async () => {
    const web = new WebService({ directories: { '/docs': mount } });
    const app = web.getApp();
    expect((await app.request('/docs/inside.txt')).status).toBe(200);

    web.removeDirectory('/docs');
    expect((await app.request('/docs/inside.txt')).status).toBe(404);
    const health = (await (await app.request('/health')).json()) as { directories: string[] };
    expect(health.directories).not.toContain('/docs');
  });

  it('removeDirectory() accepts a route without its leading slash', async () => {
    const web = new WebService({ directories: { '/docs': mount } });
    web.removeDirectory('docs');
    expect((await web.getApp().request('/docs/inside.txt')).status).toBe(404);
  });

  it('matches a prefix only at a path segment boundary', async () => {
    const web = new WebService({ directories: { '/docs': mount } });
    expect((await web.getApp().request('/docsx/inside.txt')).status).toBe(404);
  });

  it('serves from the longest matching prefix', async () => {
    writeFileSync(join(outside, 'inside.txt'), 'nested');
    const web = new WebService({ directories: { '/docs': mount, '/docs/nested': outside } });
    const res = await web.getApp().request('/docs/nested/inside.txt');
    expect(await res.text()).toBe('nested');
  });

  it("serves a directory mounted at '/' without shadowing / and /health", async () => {
    const web = new WebService({ directories: { '/': mount } });
    const app = web.getApp();
    const res = await app.request('/inside.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('inside');
    expect((await app.request('/health')).headers.get('content-type')).toContain(
      'application/json',
    );
    expect(await (await app.request('/')).text()).toContain('SignalWire Web Service');
  });
});

describe('WebService removeDirectory() route spelling', () => {
  it('removes a route stored with a trailing slash', async () => {
    const web = new WebService({ directories: { '/docs/': mount } });
    expect((await web.getApp().request('/docs/inside.txt')).status).toBe(200);
    web.removeDirectory('/docs');
    expect(web.directories).toEqual({});
    expect((await web.getApp().request('/docs/inside.txt')).status).toBe(404);
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

  it('serves without authentication when no source sets a password', async () => {
    const app = new WebService({ directories: { '/docs': mount } }).getApp();
    expect((await app.request('/docs/inside.txt')).status).toBe(200);
  });
});
