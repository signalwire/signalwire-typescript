/**
 * Constructor arguments take precedence over an agent's config file, and basic
 * auth credentials resolve as: constructor, config file, environment, generated.
 *
 * Mirrors signalwire-python c0582e4 (B17: the config file's service.name
 * always replaced the constructor's name, and its route/host replaced a
 * route '/' or host '0.0.0.0' passed on purpose) and 15019c4 (B26: the
 * credential source is recorded when resolved, including 'config file').
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentBase } from '../src/AgentBase.js';

let dir: string;
const savedEnv = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sw-config-'));
  delete process.env['SWML_BASIC_AUTH_USER'];
  delete process.env['SWML_BASIC_AUTH_PASSWORD'];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k];
  Object.assign(process.env, savedEnv);
});

function configFile(data: Record<string, unknown>): string {
  const path = join(dir, 'config.json');
  writeFileSync(path, JSON.stringify(data));
  return path;
}

const SERVICE = { service: { name: 'from-config', route: '/cfg', host: '127.0.0.1' } };

describe('constructor arguments and the config file', () => {
  it("keeps the constructor's name, and a route '/' and host '0.0.0.0' passed on purpose", () => {
    const agent = new AgentBase({
      name: 'from-ctor',
      route: '/',
      host: '0.0.0.0',
      configFile: configFile(SERVICE),
      basicAuth: ['u', 'p'],
    });
    expect(agent.name).toBe('from-ctor');
    expect(agent.route).toBe('/');
    expect(agent.host).toBe('0.0.0.0');
  });

  it('fills in a route and host the caller left out', () => {
    const agent = new AgentBase({
      name: 'from-ctor',
      configFile: configFile(SERVICE),
      basicAuth: ['u', 'p'],
    });
    expect(agent.name).toBe('from-ctor');
    expect(agent.route).toBe('/cfg');
    expect(agent.host).toBe('127.0.0.1');
  });
});

describe('basic auth credential source', () => {
  const auth = (user: string, password: string) => ({
    security: { auth: { basic: { user, password } } },
  });

  it("uses the config file's security.auth.basic, reported as 'config file'", async () => {
    const agent = new AgentBase({ name: 'a', configFile: configFile(auth('cfg', 'cfgpass')) });
    expect(agent.getBasicAuthCredentials(true)).toEqual(['cfg', 'cfgpass', 'config file']);
    agent.setPromptText('x');
    const ok = await agent.getApp().request('/', {
      headers: { Authorization: 'Basic ' + Buffer.from('cfg:cfgpass').toString('base64') },
    });
    expect(ok.status).toBe(200);
  });

  it('prefers the config file to the environment', () => {
    process.env['SWML_BASIC_AUTH_USER'] = 'envuser';
    process.env['SWML_BASIC_AUTH_PASSWORD'] = 'envpass';
    const agent = new AgentBase({ name: 'a', configFile: configFile(auth('cfg', 'cfgpass')) });
    expect(agent.getBasicAuthCredentials(true)).toEqual(['cfg', 'cfgpass', 'config file']);
  });

  it('still reads the earlier security.basicAuth key', () => {
    const agent = new AgentBase({
      name: 'a',
      configFile: configFile({ security: { basicAuth: { user: 'old', password: 'oldpass' } } }),
    });
    expect(agent.getBasicAuthCredentials(true)).toEqual(['old', 'oldpass', 'config file']);
  });

  it("reports constructor credentials as 'provided', over the config file", () => {
    const agent = new AgentBase({
      name: 'a',
      basicAuth: ['ctor', 'ctorpass'],
      configFile: configFile(auth('cfg', 'cfgpass')),
    });
    expect(agent.getBasicAuthCredentials(true)).toEqual(['ctor', 'ctorpass', 'provided']);
  });

  it("reports environment credentials as 'environment'", () => {
    process.env['SWML_BASIC_AUTH_USER'] = 'envuser';
    process.env['SWML_BASIC_AUTH_PASSWORD'] = 'envpass';
    const agent = new AgentBase({ name: 'a' });
    expect(agent.getBasicAuthCredentials(true)).toEqual(['envuser', 'envpass', 'environment']);
  });

  it("reports generated credentials as 'generated'", () => {
    const agent = new AgentBase({ name: 'a' });
    expect(agent.getBasicAuthCredentials(true)[2]).toBe('generated');
  });
});
