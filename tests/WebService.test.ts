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
  root = mkdtempSync(join(tmpdir(), 'webservice-test-'));
  mount = join(root, 'mount');
  outside = join(root, 'outside');
  mkdirSync(mount);
  mkdirSync(outside);
  writeFileSync(join(mount, 'inside.txt'), 'inside');
  writeFileSync(join(outside, 'secret.txt'), 'outside-secret');
});

afterEach(() => {
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
