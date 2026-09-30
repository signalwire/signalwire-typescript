/**
 * The Fred tutorial's deployment files (tutorial/fred/): the management script
 * from lesson 6, and the Docker and Compose files from appendix B, checked
 * against the agent they run.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FRED_DIR = fileURLToPath(new URL('../../tutorial/fred/', import.meta.url));

let createFred: typeof import('../../tutorial/fred/fred.js').createFred;

beforeAll(async () => {
  vi.stubEnv('SIGNALWIRE_LOG_MODE', 'off');
  vi.stubEnv('SWML_BASIC_AUTH_USER', 'fred');
  vi.stubEnv('SWML_BASIC_AUTH_PASSWORD', 'fred-test-password');
  ({ createFred } = await import('../../tutorial/fred/fred.js'));
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('the deployment files (lesson 6 and appendix B)', () => {
  it('fred.sh is valid bash and lists its commands', () => {
    execFileSync('bash', ['-n', `${FRED_DIR}fred.sh`]);
    const usage = execFileSync('bash', [`${FRED_DIR}fred.sh`], { encoding: 'utf8' });
    expect(usage).toContain('Usage:');
    for (const cmd of ['start', 'stop', 'restart', 'status', 'logs']) expect(usage).toContain(cmd);
  });

  it("every health check requests Fred's health route, which answers without credentials", async () => {
    const fred = await createFred();
    for (const file of ['Dockerfile', 'Dockerfile.multi', 'docker-compose.yml']) {
      const text = readFileSync(`${FRED_DIR}${file}`, 'utf8');
      const urls = text.match(/http:\/\/localhost:3000\/[\w/]*/g) ?? [];
      expect(urls.length, file).toBeGreaterThan(0);
      for (const url of urls) {
        const path = new URL(url).pathname;
        expect(path, file).toBe('/fred/health');
        expect((await fred.getApp().request(path)).status, file).toBe(200);
      }
    }
  });

  it('Compose refuses to start without a password', () => {
    const compose = readFileSync(`${FRED_DIR}docker-compose.yml`, 'utf8');
    expect(compose).toContain('SWML_BASIC_AUTH_PASSWORD=${FRED_AUTH_PASSWORD:?');
  });
});
