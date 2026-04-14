import { describe, it, expect, beforeEach } from 'vitest';
import { VerbHandlerRegistry } from '../src/VerbHandlerRegistry.js';
import { SWMLVerbHandler } from '../src/SWMLVerbHandler.js';
import { AIVerbHandler } from '../src/AIVerbHandler.js';

/** Minimal custom handler for testing registry operations. */
class CustomVerbHandler extends SWMLVerbHandler {
  private name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  getVerbName(): string {
    return this.name;
  }

  validateConfig(config: Record<string, unknown>): [boolean, string[]] {
    return [true, []];
  }

  buildConfig(opts: Record<string, unknown>): Record<string, unknown> {
    return opts;
  }
}

describe('VerbHandlerRegistry', () => {
  let registry: VerbHandlerRegistry;

  beforeEach(() => {
    registry = new VerbHandlerRegistry();
  });

  describe('default registration', () => {
    it('registers AIVerbHandler on construction', () => {
      expect(registry.hasHandler('ai')).toBe(true);
    });

    it('returns an AIVerbHandler instance for "ai"', () => {
      const handler = registry.getHandler('ai');
      expect(handler).toBeDefined();
      expect(handler).toBeInstanceOf(AIVerbHandler);
    });

    it('reports the correct verb name from default handler', () => {
      const handler = registry.getHandler('ai');
      expect(handler!.getVerbName()).toBe('ai');
    });
  });

  describe('registerHandler', () => {
    it('registers a custom handler', () => {
      const custom = new CustomVerbHandler('play');
      registry.registerHandler(custom);

      expect(registry.hasHandler('play')).toBe(true);
      expect(registry.getHandler('play')).toBe(custom);
    });

    it('replaces an existing handler for the same verb', () => {
      const first = new CustomVerbHandler('ai');
      const second = new CustomVerbHandler('ai');

      registry.registerHandler(first);
      expect(registry.getHandler('ai')).toBe(first);

      registry.registerHandler(second);
      expect(registry.getHandler('ai')).toBe(second);
    });

    it('supports multiple handlers for different verbs', () => {
      const play = new CustomVerbHandler('play');
      const record = new CustomVerbHandler('record');

      registry.registerHandler(play);
      registry.registerHandler(record);

      expect(registry.hasHandler('play')).toBe(true);
      expect(registry.hasHandler('record')).toBe(true);
      expect(registry.getHandler('play')).toBe(play);
      expect(registry.getHandler('record')).toBe(record);
    });
  });

  describe('getHandler', () => {
    it('returns undefined for an unregistered verb', () => {
      expect(registry.getHandler('nonexistent')).toBeUndefined();
    });

    it('returns the registered handler', () => {
      const handler = new CustomVerbHandler('tap');
      registry.registerHandler(handler);
      expect(registry.getHandler('tap')).toBe(handler);
    });
  });

  describe('hasHandler', () => {
    it('returns false for an unregistered verb', () => {
      expect(registry.hasHandler('nonexistent')).toBe(false);
    });

    it('returns true for a registered verb', () => {
      expect(registry.hasHandler('ai')).toBe(true);
    });

    it('returns true after registering a custom handler', () => {
      registry.registerHandler(new CustomVerbHandler('connect'));
      expect(registry.hasHandler('connect')).toBe(true);
    });
  });

  describe('integration with SWMLVerbHandler', () => {
    it('can validate config through a registered handler', () => {
      const handler = registry.getHandler('ai')!;
      const [valid, errors] = handler.validateConfig({
        prompt: { text: 'Hello' },
      });
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('can build config through a registered handler', () => {
      const handler = registry.getHandler('ai')!;
      const config = handler.buildConfig({ promptText: 'Hello there' });
      expect(config).toHaveProperty('prompt');
      expect((config['prompt'] as Record<string, unknown>)['text']).toBe('Hello there');
    });
  });
});
