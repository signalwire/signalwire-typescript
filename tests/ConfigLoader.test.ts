import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConfigLoader } from '../src/ConfigLoader.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(process.cwd(), '__config_test_tmp__');

describe('ConfigLoader', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'test.json'),
      JSON.stringify({
        server: { host: '0.0.0.0', port: 3000 },
        name: 'test-agent',
        nested: { deep: { value: 42 } },
      }),
    );
    writeFileSync(
      join(TEST_DIR, 'env-test.json'),
      JSON.stringify({
        host: '${TEST_CONFIG_HOST|localhost}',
        port: '${TEST_CONFIG_PORT|8080}',
        secret: '${TEST_CONFIG_SECRET}',
      }),
    );
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('loads a JSON config file', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.get('name')).toBe('test-agent');
  });

  it('dot-notation access for nested values', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.get('server.host')).toBe('0.0.0.0');
    expect(config.get('server.port')).toBe(3000);
    expect(config.get('nested.deep.value')).toBe(42);
  });

  it('returns default value for missing path', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.get('missing', 'fallback')).toBe('fallback');
    expect(config.get('server.missing', 99)).toBe(99);
  });

  it('has() checks path existence', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.has('name')).toBe(true);
    expect(config.has('server.host')).toBe(true);
    expect(config.has('nope')).toBe(false);
    expect(config.has('server.nope')).toBe(false);
  });

  it('set() sets values with dot-notation', () => {
    const config = new ConfigLoader();
    config.loadFromObject({});
    config.set('server.port', 5000);
    config.set('name', 'new-agent');
    expect(config.get('server.port')).toBe(5000);
    expect(config.get('name')).toBe('new-agent');
  });

  it('getAll() returns all config data', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    const all = config.getConfig();
    expect(all.name).toBe('test-agent');
    expect(all.server).toBeDefined();
  });

  it('interpolates env vars with defaults', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'env-test.json'));
    expect(config.get('host')).toBe('localhost');
    // NUMBER, not the string '8080': substituteVars re-types an all-digit result,
    // exactly as the reference does (`if result.isdigit(): return int(result)` in
    // config_loader.substitute_vars). Verified against the reference:
    // ConfigLoader.get('port') on this same fixture returns int 8080.
    expect(config.get('port')).toBe(8080);
    // secret has no default and no env var, so empty string
    expect(config.get('secret')).toBe('');
  });

  it('interpolates env vars from environment', () => {
    process.env['TEST_CONFIG_HOST'] = 'myhost.com';
    try {
      const config = new ConfigLoader(join(TEST_DIR, 'env-test.json'));
      expect(config.get('host')).toBe('myhost.com');
    } finally {
      delete process.env['TEST_CONFIG_HOST'];
    }
  });

  // Regression guard for the windows-latest nightly failure. A `${VAR}` whose value
  // contains backslashes (i.e. EVERY Windows absolute path) used to break the load
  // outright, because interpolation ran on the raw JSON TEXT before JSON.parse: the
  // spliced-in `D:\a\...` produced `\a` / `\_`, which are not legal JSON escapes, so
  // JSON.parse threw "Bad escaped character in JSON" and the whole config silently
  // failed to load (in SecurityConfig that meant TLS quietly staying OFF). Expanding
  // on the PARSED VALUE instead — what the reference does — is escape-proof.
  //
  // The literal below is a WINDOWS path on purpose and the assertion is
  // platform-independent, so this test covers the Windows failure from any host.
  it('interpolates a value containing backslashes (Windows path) without breaking the parse', () => {
    const winPath = 'D:\\a\\signalwire-typescript\\tmp\\cert.pem';
    const file = join(TEST_DIR, 'winpath.json');
    writeFileSync(file, JSON.stringify({ tls: { cert: '${TEST_WIN_CERT}' } }));
    process.env['TEST_WIN_CERT'] = winPath;
    try {
      const config = new ConfigLoader(file);
      expect(config.get('tls.cert')).toBe(winPath);
      expect(config.getSection('tls')).toEqual({ cert: winPath });
    } finally {
      delete process.env['TEST_WIN_CERT'];
    }
  });

  it('throws for missing file', () => {
    expect(() => new ConfigLoader('/nonexistent/path.json')).toThrow('Config file not found');
  });

  it('loadFromObject works', () => {
    const config = new ConfigLoader();
    config.loadFromObject({ key: 'value', nested: { a: 1 } });
    expect(config.get('key')).toBe('value');
    expect(config.get('nested.a')).toBe(1);
    expect(config.getConfigFile()).toBeNull();
  });

  it('getFilePath returns the loaded file path', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.getConfigFile()).toContain('test.json');
  });

  it('load returns this for chaining', () => {
    const config = new ConfigLoader();
    const result = config.load(join(TEST_DIR, 'test.json'));
    expect(result).toBe(config);
  });

  it('set creates intermediate objects', () => {
    const config = new ConfigLoader();
    config.loadFromObject({});
    config.set('a.b.c', 'deep');
    expect(config.get('a.b.c')).toBe('deep');
  });

  it('search returns null when file not found', () => {
    const result = ConfigLoader.search('nonexistent-file-12345.json');
    expect(result).toBeNull();
  });

  // ── Prototype pollution protection ──────────────────────────────
  it('set() with __proto__ key does NOT pollute Object prototype', () => {
    const config = new ConfigLoader();
    config.loadFromObject({});
    config.set('__proto__.polluted', true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('set() with constructor key is silently ignored', () => {
    const config = new ConfigLoader();
    config.loadFromObject({});
    config.set('constructor.polluted', true);
    expect(config.get('constructor.polluted')).toBeUndefined();
  });

  it('set() with prototype key is silently ignored', () => {
    const config = new ConfigLoader();
    config.loadFromObject({});
    config.set('prototype.polluted', true);
    expect(config.get('prototype.polluted')).toBeUndefined();
  });

  it('get() with __proto__ returns defaultValue', () => {
    const config = new ConfigLoader();
    config.loadFromObject({ safe: 'yes' });
    expect(config.get('__proto__', 'default')).toBe('default');
    expect(config.get('__proto__.constructor', 'default')).toBe('default');
  });
});
