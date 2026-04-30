/**
 * Tests for the top-level convenience entry points exported from
 * ``src/index.ts``. These mirror Python's package-level
 * ``signalwire/__init__.py`` (``RestClient``, ``addSkillDirectory``,
 * ``registerSkill``, ``listSkillsWithParams``).
 *
 * The audit projects ``signalwire.RestClient`` (a factory function) onto
 * the source-side ``restClient(...)`` export. The TS class is also
 * exported under ``RestClient`` from ``./rest/index.js``; the function
 * coexists under a different (camelCase) source name.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  restClient,
  RestClient,
  addSkillDirectory,
  registerSkill,
  listSkillsWithParams,
} from '../src/index.js';
import { SkillRegistry } from '../src/skills/SkillRegistry.js';
import { SkillBase } from '../src/skills/SkillBase.js';
import { registerBuiltinSkills } from '../src/skills/builtin/index.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Ensure built-in skills are registered (mirrors normal process startup).
beforeAll(() => {
  registerBuiltinSkills();
});

describe('top-level index helpers', () => {
  describe('restClient', () => {
    it('returns a RestClient instance with explicit credentials', () => {
      const client = restClient({
        project: 'p-123',
        token: 't-456',
        host: 'demo.signalwire.com',
      });
      expect(client).toBeInstanceOf(RestClient);
      // Namespaces are wired up: every required accessor is present.
      expect(client.fabric).toBeDefined();
      expect(client.calling).toBeDefined();
      expect(client.compat).toBeDefined();
      expect(client.phoneNumbers).toBeDefined();
    });

    it('produces equivalent shape when called with no args (env-driven)', () => {
      // Without env vars, RestClient throws — verify the env-driven path.
      const env = { ...process.env };
      try {
        process.env.SIGNALWIRE_PROJECT_ID = 'envproj';
        process.env.SIGNALWIRE_API_TOKEN = 'envtok';
        process.env.SIGNALWIRE_SPACE = 'env.signalwire.com';
        const client = restClient();
        expect(client).toBeInstanceOf(RestClient);
      } finally {
        process.env = env;
      }
    });

    it('throws when no credentials are available', () => {
      const env = { ...process.env };
      try {
        delete process.env.SIGNALWIRE_PROJECT_ID;
        delete process.env.SIGNALWIRE_API_TOKEN;
        delete process.env.SIGNALWIRE_SPACE;
        expect(() => restClient()).toThrow(/required/);
      } finally {
        process.env = env;
      }
    });
  });

  describe('addSkillDirectory', () => {
    it('records the directory on the singleton registry', () => {
      const tmp = mkdtempSync(join(tmpdir(), 'sw-skill-dir-'));
      try {
        addSkillDirectory(tmp);
        const paths = SkillRegistry.getInstance().getSearchPaths();
        expect(paths).toContain(tmp);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe('listSkillsWithParams', () => {
    it('returns a non-empty schema map keyed by skill name', () => {
      const schema = listSkillsWithParams();
      expect(typeof schema).toBe('object');
      // Built-in skills register on first registry access; at minimum the
      // datetime / math skills are present after registerBuiltinSkills.
      const keys = Object.keys(schema);
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) {
        expect(schema[k]).toHaveProperty('name');
      }
    });
  });

  describe('registerSkill', () => {
    it('registers a custom skill class via the singleton registry', () => {
      // Define a minimal valid SkillBase subclass with the required statics.
      class TopLevelDummySkill extends SkillBase {
        static override SKILL_NAME = 'top_level_dummy_skill_index';
        static override SKILL_DESCRIPTION = 'Dummy skill for parity test';
        static override SKILL_VERSION = '0.0.1';
        static override REQUIRED_PACKAGES: string[] = [];
        static override REQUIRED_ENV_VARS: string[] = [];
        static override SKILL_PARAMETERS = {
          enabled: {
            type: 'boolean' as const,
            default: true,
            description: 'Enable / disable',
          },
        };
        registerTools(): void {
          // No-op for parity test
        }
      }
      registerSkill(TopLevelDummySkill as never);
      const schema = listSkillsWithParams();
      expect(schema['top_level_dummy_skill_index']).toBeDefined();
      expect(schema['top_level_dummy_skill_index'].name).toBe('top_level_dummy_skill_index');
    });
  });
});
