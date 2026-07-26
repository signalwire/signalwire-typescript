import { describe, it, expect } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';
import { SWMLService } from '../src/SWMLService.js';
import { SwmlBuilder } from '../src/SwmlBuilder.js';
import { PromptManager } from '../src/PromptManager.js';
import { SchemaUtils, SchemaValidationError } from '../src/SchemaUtils.js';
import { SkillManager } from '../src/skills/SkillManager.js';
import { SkillBase, type SkillToolDefinition } from '../src/skills/SkillBase.js';
import { RelayError } from '../src/relay/RelayError.js';
import { AIChatError } from '../src/ai-chat/AIChatClient.js';
import { AuthHandler } from '../src/AuthHandler.js';

/**
 * CONSTRUCTION-READBACK — a value the caller supplies at construction must be
 * readable back (ALLOWLIST_DISCIPLINE §15 / class B2).
 *
 * The reference lets a caller PASS each of these at construction AND read it back, so
 * every port must too. A port that accepts the value but hides the reader has taken
 * the capability away from its own callers — and the failure mode the gate exists to
 * catch is "make the gate green by lowering visibility", which leaves the enumerator
 * still recording a member no caller can reach.
 *
 * These tests assert the ROUND TRIP (value in → reader out), not merely that a member
 * exists: a getter returning the wrong field, or a back-reference pointing at the
 * wrong object, would satisfy the surface gate while still being broken.
 */
/**
 * Reach the internal managers. AgentBase deliberately exposes no public
 * `getPromptManager()` / `getSkillManager()` (the reference has no such accessor
 * either), so the test reads the private fields rather than the port growing surface
 * the reference lacks just to be testable.
 */
function promptManagerOf(a: AgentBase): PromptManager {
  return (a as unknown as { _promptManager: PromptManager })._promptManager;
}
function skillManagerOf(a: AgentBase): SkillManager {
  return (a as unknown as { _skillManager: SkillManager })._skillManager;
}

describe('CONSTRUCTION-READBACK — caller-supplied values read back', () => {
  describe('manager back-references (the reference keeps each as public self.agent)', () => {
    it('PromptManager.agent is the agent that built it', () => {
      const agent = new AgentBase({ name: 'readback', route: '/rb' });
      // AgentBase constructs its PromptManager with `this`.
      expect(promptManagerOf(agent).agent).toBe(agent);
    });

    it('PromptManager.agent is undefined for a standalone manager', () => {
      expect(new PromptManager(true).agent).toBeUndefined();
    });

    it('PromptManager.agent honours an explicitly passed agent', () => {
      const agent = new AgentBase({ name: 'explicit', route: '/e' });
      expect(new PromptManager(true, agent).agent).toBe(agent);
    });

    it('SkillManager.agent is the agent that built it', () => {
      const agent = new AgentBase({ name: 'skills', route: '/s' });
      expect(skillManagerOf(agent).agent).toBe(agent);
    });

    it('SkillManager.agent is undefined for a standalone manager', () => {
      expect(new SkillManager().agent).toBeUndefined();
    });

    it('an ephemeral per-request clone re-points its managers at the CLONE', () => {
      // A clone whose manager still pointed at the original would read back the
      // wrong agent — the clone-drops-configuration defect class.
      const agent = new AgentBase({ name: 'clone', route: '/c' });
      const copy = (agent as unknown as { createEphemeralCopy(): AgentBase }).createEphemeralCopy();
      expect(copy).not.toBe(agent);
      expect(promptManagerOf(copy).agent).toBe(copy);
      expect(skillManagerOf(copy).agent).toBe(copy);
      expect(copy.getBuilder().service).toBe(copy);
      // The original is untouched.
      expect(promptManagerOf(agent).agent).toBe(agent);
    });
  });

  describe('SkillBase — the reference passes agent + params to the constructor', () => {
    class ReadbackSkill extends SkillBase {
      static override SKILL_NAME = 'readback_skill';
      static override SKILL_DESCRIPTION = 'Exercises the readback contract.';
      override async setup(): Promise<boolean> {
        return true;
      }
      override getTools(): SkillToolDefinition[] {
        return [];
      }
    }

    it('params reads back the whole config map the caller supplied', () => {
      const skill = new ReadbackSkill({ greeting: 'hi', retries: 3 });
      expect(skill.params).toEqual({ greeting: 'hi', retries: 3 });
    });

    it('params omits swaig_fields, which the constructor pops (reference parity)', () => {
      const skill = new ReadbackSkill({ keep: 1, swaig_fields: { meta_data_token: 't' } });
      expect(skill.params).toEqual({ keep: 1 });
      expect(skill.swaigFields).toEqual({ meta_data_token: 't' });
    });

    it('agent is publicly readable once the manager has bound it', () => {
      const agent = new AgentBase({ name: 'bound', route: '/b' });
      const skill = new ReadbackSkill({});
      expect(skill.agent).toBeUndefined();
      skill.setAgent(agent);
      expect(skill.agent).toBe(agent);
    });
  });

  describe('SwmlBuilder.service — the reference takes the service at construction', () => {
    it('reads back the SWMLService that owns the builder', () => {
      const svc = new SWMLService({ name: 'svc', route: '/svc' });
      expect(svc.getBuilder().service).toBe(svc);
    });

    it('is undefined for a standalone builder', () => {
      expect(new SwmlBuilder().service).toBeUndefined();
    });
  });

  describe('SchemaUtils.schema_path', () => {
    it('reads back an explicitly supplied schemaPath', () => {
      // A path that does not resolve still round-trips — loadSchema falls back to
      // the bundled schema, but the caller's choice remains readable.
      const su = new SchemaUtils({ schemaPath: '/nonexistent/custom-schema.json' });
      expect(su.schemaPath).toBe('/nonexistent/custom-schema.json');
    });

    it('is null when the bundled schema is in use', () => {
      expect(new SchemaUtils().schemaPath).toBeNull();
    });
  });

  describe('AgentBase.signing_key', () => {
    it('reads back an explicitly supplied signingKey', () => {
      const agent = new AgentBase({ name: 'signed', route: '/sg', signingKey: 'sk_readback' });
      expect(agent.signingKey).toBe('sk_readback');
    });

    it('is null when neither the option nor the env var is set', () => {
      const prev = process.env['SIGNALWIRE_SIGNING_KEY'];
      delete process.env['SIGNALWIRE_SIGNING_KEY'];
      try {
        expect(new AgentBase({ name: 'unsigned', route: '/un' }).signingKey).toBeNull();
      } finally {
        if (prev !== undefined) process.env['SIGNALWIRE_SIGNING_KEY'] = prev;
      }
    });

    it('falls back to SIGNALWIRE_SIGNING_KEY and reads that back', () => {
      const prev = process.env['SIGNALWIRE_SIGNING_KEY'];
      process.env['SIGNALWIRE_SIGNING_KEY'] = 'sk_from_env';
      try {
        expect(new AgentBase({ name: 'envsigned', route: '/es' }).signingKey).toBe('sk_from_env');
      } finally {
        if (prev === undefined) delete process.env['SIGNALWIRE_SIGNING_KEY'];
        else process.env['SIGNALWIRE_SIGNING_KEY'] = prev;
      }
    });
  });

  describe('AuthHandler.security_config', () => {
    it('reads back the auth config value object passed whole', () => {
      const cfg = { bearerToken: 'bt_readback' };
      expect(new AuthHandler(cfg).config).toBe(cfg);
    });
  });

  describe('error classes — the RAW server message is preserved undecorated', () => {
    it('RelayError keeps the server message while `message` stays decorated', () => {
      // The reference sets `self.message = message` (undecorated, relay/client.py:1332)
      // AND `super().__init__(f"RELAY error {code}: {message}")` (:1333). In JS the
      // `message` property is owned by Error and holds the decorated form, so the
      // undecorated value lives on `serverMessage`.
      const err = new RelayError(404, 'call not found');
      expect(err.serverMessage).toBe('call not found');
      expect(err.code).toBe(404);
      expect(err.message).toBe('RELAY error 404: call not found');
    });

    it('AIChatError keeps the server message while `message` stays decorated', () => {
      const err = new AIChatError(-32001, 'conversation missing');
      expect(err.serverMessage).toBe('conversation missing');
      expect(err.code).toBe(-32001);
      expect(err.message).toBe('[-32001] conversation missing');
    });
  });

  describe('SchemaValidationError — both construction params read back', () => {
    it('carries verbName and the individual errors, not just a joined string', () => {
      const err = new SchemaValidationError('answer', ['bad key', 'wrong type']);
      expect(err.verbName).toBe('answer');
      expect(err.errors).toEqual(['bad key', 'wrong type']);
      expect(err.message).toBe("Schema validation failed for 'answer': bad key; wrong type");
    });

    it('is what a failed addVerb throws, so a caller can branch on the verb', () => {
      const svc = new SWMLService({ name: 'strict', route: '/st' });
      let caught: unknown;
      try {
        svc.addVerb('answer', { wibble: 1 });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(SchemaValidationError);
      expect((caught as SchemaValidationError).verbName).toBe('answer');
      expect((caught as SchemaValidationError).errors.length).toBeGreaterThan(0);
    });
  });
});
