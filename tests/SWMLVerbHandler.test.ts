import { describe, it, expect } from 'vitest';
import { SWMLVerbHandler } from '../src/SWMLVerbHandler.js';
import { AIVerbHandler } from '../src/AIVerbHandler.js';
import { VerbHandlerRegistry } from '../src/VerbHandlerRegistry.js';

// ---------- Mock handler for testing the abstract interface ----------

class MockVerbHandler extends SWMLVerbHandler {
  private verbName: string;

  constructor(verbName = 'mock_verb') {
    super();
    this.verbName = verbName;
  }

  getVerbName(): string {
    return this.verbName;
  }

  validateConfig(config: Record<string, unknown>): [boolean, string[]] {
    if (!('required_field' in config)) {
      return [false, ['Missing required_field']];
    }
    return [true, []];
  }

  buildConfig(opts: Record<string, unknown>): Record<string, unknown> {
    return { mock_config: true, ...opts };
  }
}

// ======================== SWMLVerbHandler (abstract) ========================

describe('SWMLVerbHandler', () => {
  it('cannot be instantiated directly', () => {
    // TypeScript prevents this at compile time, but verify at runtime that
    // the abstract class's concrete subclass works.
    const handler = new MockVerbHandler('test_verb');
    expect(handler.getVerbName()).toBe('test_verb');
  });

  it('mock implementation validates config correctly', () => {
    const handler = new MockVerbHandler();

    const [valid, errors] = handler.validateConfig({ required_field: 'value' });
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);

    const [invalid, errs] = handler.validateConfig({ other_field: 'value' });
    expect(invalid).toBe(false);
    expect(errs).toContain('Missing required_field');
  });

  it('mock implementation builds config', () => {
    const handler = new MockVerbHandler();
    const config = handler.buildConfig({ param1: 'value1', param2: 'value2' });
    expect(config['mock_config']).toBe(true);
    expect(config['param1']).toBe('value1');
    expect(config['param2']).toBe('value2');
  });
});

// ======================== AIVerbHandler ========================

describe('AIVerbHandler', () => {
  it('returns "ai" as verb name', () => {
    const handler = new AIVerbHandler();
    expect(handler.getVerbName()).toBe('ai');
  });

  // ---------- validateConfig ----------

  describe('validateConfig', () => {
    it('accepts valid prompt text configuration', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: { text: 'You are a helpful assistant' },
      });
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('accepts valid prompt POM configuration', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: {
          pom: [
            { title: 'Section 1', body: 'Content 1' },
            { title: 'Section 2', body: 'Content 2' },
          ],
        },
      });
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('rejects contexts-only config (needs text or pom base prompt)', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: {
          contexts: {
            context1: { steps: [{ step: 'greeting', content: 'Hello' }] },
          },
        },
      });
      expect(valid).toBe(false);
      expect(errors).toContain("'prompt' must contain either 'text' or 'pom' as base prompt");
    });

    it('accepts text combined with contexts', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: {
          text: 'You are a helpful assistant',
          contexts: {
            context1: { steps: [{ step: 'greeting', content: 'Hello' }] },
          },
        },
      });
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('rejects missing prompt', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        post_prompt: { text: 'Summary' },
      });
      expect(valid).toBe(false);
      expect(errors).toContain("Missing required field 'prompt'");
    });

    it('rejects both text and pom', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: { text: 'You are helpful', pom: [{ title: 'Section' }] },
      });
      expect(valid).toBe(false);
      expect(errors).toContain(
        "'prompt' can only contain one of: 'text' or 'pom' (mutually exclusive)",
      );
    });

    it('rejects non-object prompt', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: 'invalid_string_prompt',
      });
      expect(valid).toBe(false);
      expect(errors).toContain("'prompt' must be an object");
    });

    it('rejects prompt dict with no valid content keys', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: { other_field: 'value' },
      });
      expect(valid).toBe(false);
      expect(errors).toContain("'prompt' must contain either 'text' or 'pom' as base prompt");
    });

    it('rejects non-object contexts', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: { text: 'hi', contexts: 'invalid_string_contexts' },
      });
      expect(valid).toBe(false);
      expect(errors).toContain("'prompt.contexts' must be an object");
    });

    it('rejects non-object SWAIG', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: { text: 'hi' },
        SWAIG: 'invalid',
      });
      expect(valid).toBe(false);
      expect(errors).toContain("'SWAIG' must be an object");
    });

    it('rejects array prompt', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: ['not', 'an', 'object'],
      });
      expect(valid).toBe(false);
      expect(errors).toContain("'prompt' must be an object");
    });

    it('rejects array SWAIG', () => {
      const handler = new AIVerbHandler();
      const [valid, errors] = handler.validateConfig({
        prompt: { text: 'hi' },
        SWAIG: ['not', 'an', 'object'],
      });
      expect(valid).toBe(false);
      expect(errors).toContain("'SWAIG' must be an object");
    });
  });

  // ---------- buildConfig ----------

  describe('buildConfig', () => {
    it('builds config with prompt text', () => {
      const handler = new AIVerbHandler();
      const config = handler.buildConfig({
        promptText: 'You are a helpful assistant',
        postPrompt: 'Provide a summary',
        postPromptUrl: 'https://example.com/summary',
      });

      expect((config['prompt'] as Record<string, unknown>)['text']).toBe(
        'You are a helpful assistant',
      );
      expect((config['post_prompt'] as Record<string, unknown>)['text']).toBe(
        'Provide a summary',
      );
      expect(config['post_prompt_url']).toBe('https://example.com/summary');
    });

    it('builds config with prompt POM', () => {
      const handler = new AIVerbHandler();
      const pomData = [
        { title: 'Section 1', body: 'Content 1' },
        { title: 'Section 2', body: 'Content 2' },
      ];
      const config = handler.buildConfig({
        promptPom: pomData,
        postPrompt: 'Summary',
      });

      expect((config['prompt'] as Record<string, unknown>)['pom']).toEqual(pomData);
      expect((config['post_prompt'] as Record<string, unknown>)['text']).toBe('Summary');
    });

    it('builds config with text and contexts combined', () => {
      const handler = new AIVerbHandler();
      const contextsData = {
        context1: { steps: [{ step: 'greeting', content: 'Hello' }] },
      };
      const config = handler.buildConfig({
        promptText: 'You are a helpful assistant',
        contexts: contextsData,
        postPrompt: 'Summary',
      });

      const prompt = config['prompt'] as Record<string, unknown>;
      expect(prompt['text']).toBe('You are a helpful assistant');
      expect(prompt['contexts']).toEqual(contextsData);
      expect((config['post_prompt'] as Record<string, unknown>)['text']).toBe('Summary');
    });

    it('builds config with SWAIG', () => {
      const handler = new AIVerbHandler();
      const swaigData = {
        functions: [{ function: 'test_func', description: 'Test function' }],
      };
      const config = handler.buildConfig({
        promptText: 'You are helpful',
        swaig: swaigData,
      });

      expect((config['prompt'] as Record<string, unknown>)['text']).toBe('You are helpful');
      expect(config['SWAIG']).toEqual(swaigData);
    });

    it('builds minimal config', () => {
      const handler = new AIVerbHandler();
      const config = handler.buildConfig({ promptText: 'Hello' });

      expect((config['prompt'] as Record<string, unknown>)['text']).toBe('Hello');
      expect(config['post_prompt']).toBeUndefined();
      expect(config['post_prompt_url']).toBeUndefined();
      expect(config['SWAIG']).toBeUndefined();
    });

    it('throws when no prompt option is provided', () => {
      const handler = new AIVerbHandler();
      expect(() => handler.buildConfig({})).toThrow(
        'Either promptText or promptPom must be provided as base prompt',
      );
    });

    it('throws when both promptText and promptPom are provided', () => {
      const handler = new AIVerbHandler();
      expect(() =>
        handler.buildConfig({
          promptText: 'Text prompt',
          promptPom: [{ title: 'POM section' }],
        }),
      ).toThrow('promptText and promptPom are mutually exclusive');
    });

    it('allows combining text with contexts', () => {
      const handler = new AIVerbHandler();
      const config = handler.buildConfig({
        promptText: 'Text prompt',
        contexts: { context1: { steps: [] } },
      });

      const prompt = config['prompt'] as Record<string, unknown>;
      expect(prompt['text']).toBe('Text prompt');
      expect(prompt['contexts']).toEqual({ context1: { steps: [] } });
    });

    it('routes top-level kwargs correctly', () => {
      const handler = new AIVerbHandler();
      const config = handler.buildConfig({
        promptText: 'Hello',
        languages: ['en', 'es'],
        hints: ['hint1', 'hint2'],
        pronounce: { word: 'pronunciation' },
        global_data: { key: 'value' },
        custom_param: 'custom_value',
      });

      expect((config['prompt'] as Record<string, unknown>)['text']).toBe('Hello');
      expect(config['languages']).toEqual(['en', 'es']);
      expect(config['hints']).toEqual(['hint1', 'hint2']);
      expect(config['pronounce']).toEqual({ word: 'pronunciation' });
      expect(config['global_data']).toEqual({ key: 'value' });
      expect((config['params'] as Record<string, unknown>)['custom_param']).toBe('custom_value');
    });

    it('routes globalData (camelCase) to global_data (snake_case)', () => {
      const handler = new AIVerbHandler();
      const config = handler.buildConfig({
        promptText: 'Hello',
        globalData: { key: 'value' },
      });

      expect(config['global_data']).toEqual({ key: 'value' });
      expect(config['globalData']).toBeUndefined();
    });

    it('handles None-equivalent values gracefully', () => {
      const handler = new AIVerbHandler();
      const config = handler.buildConfig({
        promptText: 'Test',
        postPrompt: undefined,
        postPromptUrl: undefined,
        swaig: undefined,
      });

      expect((config['prompt'] as Record<string, unknown>)['text']).toBe('Test');
      expect(config['post_prompt']).toBeUndefined();
      expect(config['post_prompt_url']).toBeUndefined();
      expect(config['SWAIG']).toBeUndefined();
    });

    it('handles empty string values', () => {
      const handler = new AIVerbHandler();
      const config = handler.buildConfig({
        promptText: '',
        postPrompt: '',
        postPromptUrl: '',
      });

      expect((config['prompt'] as Record<string, unknown>)['text']).toBe('');
      expect((config['post_prompt'] as Record<string, unknown>)['text']).toBe('');
      expect(config['post_prompt_url']).toBe('');
    });

    it('always initializes params dict (matching Python behavior)', () => {
      const handler = new AIVerbHandler();
      const config = handler.buildConfig({ promptText: 'Hello' });
      expect(config['params']).toEqual({});
    });
  });

  // ---------- Integration: build then validate ----------

  describe('build + validate integration', () => {
    it('validates a fully built config', () => {
      const handler = new AIVerbHandler();
      const config = handler.buildConfig({
        promptText: 'You are a helpful assistant',
        postPrompt: 'Provide a brief summary',
        postPromptUrl: 'https://example.com/summary',
        swaig: {
          functions: [
            {
              function: 'get_weather',
              description: 'Get weather information',
              parameters: { type: 'object', properties: {} },
            },
          ],
        },
      });

      const [valid, errors] = handler.validateConfig(config);
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('validates a complex SWAIG config', () => {
      const handler = new AIVerbHandler();
      const complexSwaig = {
        defaults: { web_hook_url: 'https://example.com/webhook' },
        functions: [
          {
            function: 'search',
            description: 'Search for information',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string', description: 'Search query' } },
              required: ['query'],
            },
            fillers: { en: ['Searching...', 'Looking that up...'] },
          },
          {
            function: 'calculate',
            description: 'Perform calculations',
            parameters: {
              type: 'object',
              properties: { expression: { type: 'string', description: 'Math expression' } },
            },
          },
        ],
        includes: [{ url: 'https://api.example.com/functions', functions: ['external_func1'] }],
      };

      const config = handler.buildConfig({
        promptText: 'You are a calculator and search assistant',
        swaig: complexSwaig,
      });

      const [valid, errors] = handler.validateConfig(config);
      expect(valid).toBe(true);
      expect(errors).toHaveLength(0);
      expect(config['SWAIG']).toEqual(complexSwaig);
    });

    it('catches various invalid configurations', () => {
      const handler = new AIVerbHandler();
      const invalidConfigs: Record<string, unknown>[] = [
        {},
        { prompt: {} },
        { prompt: { invalid: 'field' } },
        { prompt: { text: 'test', pom: [] } },
      ];

      for (const config of invalidConfigs) {
        const [valid, errors] = handler.validateConfig(config);
        expect(valid).toBe(false);
        expect(errors.length).toBeGreaterThan(0);
      }
    });
  });
});

// ======================== VerbHandlerRegistry ========================

describe('VerbHandlerRegistry', () => {
  it('registers AIVerbHandler by default', () => {
    const registry = new VerbHandlerRegistry();
    expect(registry.hasHandler('ai')).toBe(true);
    const handler = registry.getHandler('ai');
    expect(handler).toBeInstanceOf(AIVerbHandler);
  });

  it('registers a custom handler', () => {
    const registry = new VerbHandlerRegistry();
    const mockHandler = new MockVerbHandler('custom_verb');
    registry.registerHandler(mockHandler);
    expect(registry.hasHandler('custom_verb')).toBe(true);
    expect(registry.getHandler('custom_verb')).toBe(mockHandler);
  });

  it('returns undefined for unregistered verb', () => {
    const registry = new VerbHandlerRegistry();
    expect(registry.getHandler('nonexistent')).toBeUndefined();
    expect(registry.hasHandler('nonexistent')).toBe(false);
  });

  it('allows overriding the default AI handler', () => {
    const registry = new VerbHandlerRegistry();
    const customAI = new MockVerbHandler('ai');
    registry.registerHandler(customAI);
    expect(registry.getHandler('ai')).toBe(customAI);
    expect(registry.getHandler('ai')).toBeInstanceOf(MockVerbHandler);
  });

  it('supports multiple handlers simultaneously', () => {
    const registry = new VerbHandlerRegistry();
    const h1 = new MockVerbHandler('verb1');
    const h2 = new MockVerbHandler('verb2');
    const h3 = new MockVerbHandler('verb3');

    registry.registerHandler(h1);
    registry.registerHandler(h2);
    registry.registerHandler(h3);

    expect(registry.hasHandler('verb1')).toBe(true);
    expect(registry.hasHandler('verb2')).toBe(true);
    expect(registry.hasHandler('verb3')).toBe(true);
    expect(registry.hasHandler('ai')).toBe(true); // default still there

    expect(registry.getHandler('verb1')).toBe(h1);
    expect(registry.getHandler('verb2')).toBe(h2);
    expect(registry.getHandler('verb3')).toBe(h3);
  });

  it('registry + handler complete workflow', () => {
    const registry = new VerbHandlerRegistry();
    const playHandler = new MockVerbHandler('play');
    registry.registerHandler(playHandler);

    for (const verbName of ['ai', 'play']) {
      expect(registry.hasHandler(verbName)).toBe(true);
      const handler = registry.getHandler(verbName)!;
      expect(handler).toBeDefined();

      if (verbName === 'ai') {
        const config = handler.buildConfig({ promptText: 'Test' });
        const [valid] = handler.validateConfig(config);
        expect(valid).toBe(true);
      } else {
        const config = handler.buildConfig({ required_field: 'test' });
        const [valid] = handler.validateConfig(config);
        expect(valid).toBe(true);
      }
    }
  });
});
