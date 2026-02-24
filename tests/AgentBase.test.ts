import { describe, it, expect } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';
import { SwaigFunctionResult } from '../src/SwaigFunctionResult.js';
import { ContextBuilder } from '../src/ContextBuilder.js';
import { DataMap } from '../src/DataMap.js';

describe('AgentBase', () => {
  function createAgent(opts?: Partial<Parameters<typeof AgentBase.prototype.setPromptText>[0]>) {
    return new AgentBase({ name: 'test-agent', route: '/test', ...opts } as any);
  }

  it('renders basic SWML with prompt', () => {
    const agent = createAgent();
    agent.setPromptText('You are a helpful assistant');
    const swml = JSON.parse(agent.renderSwml());
    expect(swml.version).toBe('1.0.0');
    const main = swml.sections.main;
    // Should have answer + ai verbs
    expect(main.length).toBe(2);
    expect(main[0]).toHaveProperty('answer');
    expect(main[1]).toHaveProperty('ai');
    expect(main[1].ai.prompt.text).toBe('You are a helpful assistant');
  });

  it('renders SWML without auto-answer', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', autoAnswer: false });
    agent.setPromptText('hello');
    const swml = JSON.parse(agent.renderSwml());
    const main = swml.sections.main;
    // Should only have AI verb, no answer
    expect(main.length).toBe(1);
    expect(main[0]).toHaveProperty('ai');
  });

  it('renders SWML with recording enabled', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', recordCall: true });
    agent.setPromptText('hello');
    const swml = JSON.parse(agent.renderSwml());
    const main = swml.sections.main;
    // answer + record_call + ai
    expect(main.length).toBe(3);
    expect(main[1]).toHaveProperty('record_call');
    expect(main[1].record_call.format).toBe('mp4');
  });

  it('includes tools in SWAIG', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.defineTool({
      name: 'get_time',
      description: 'Get the current time',
      parameters: {},
      handler: () => new SwaigFunctionResult('The time is 12:00'),
    });
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.SWAIG).toBeDefined();
    expect(ai.SWAIG.functions.length).toBe(1);
    expect(ai.SWAIG.functions[0].function).toBe('get_time');
    expect(ai.SWAIG.defaults).toBeDefined();
    expect(ai.SWAIG.defaults.web_hook_url).toContain('/swaig');
  });

  it('includes DataMap tools in SWAIG', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    const dm = new DataMap('get_weather')
      .purpose('Get weather')
      .parameter('location', 'string', 'City', { required: true })
      .webhook('GET', 'https://api.weather.com?q=${location}')
      .output(new SwaigFunctionResult('Temp: ${response.temp}'));

    agent.registerSwaigFunction(dm.toSwaigFunction());
    const swml = JSON.parse(agent.renderSwml());
    const fns = swml.sections.main[1].ai.SWAIG.functions;
    expect(fns.length).toBe(1);
    expect(fns[0].function).toBe('get_weather');
    expect(fns[0].data_map).toBeDefined();
  });

  it('sets post prompt', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.setPostPrompt('Summarize the call');
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.post_prompt.text).toBe('Summarize the call');
    expect(ai.post_prompt_url).toBeDefined();
  });

  it('adds hints, languages, pronunciation', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.addHints(['Cabby', 'SignalWire']);
    agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
    agent.addPronunciation({ replace: 'SW', with: 'SignalWire' });
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.hints).toEqual(['Cabby', 'SignalWire']);
    expect(ai.languages.length).toBe(1);
    expect(ai.pronounce.length).toBe(1);
  });

  it('sets params and global data', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.setParam('temperature', 0.5);
    agent.setGlobalData({ name: 'John' });
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.params.temperature).toBe(0.5);
    expect(ai.global_data.name).toBe('John');
  });

  it('setPromptLlmParams merges into prompt', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.setPromptLlmParams({ temperature: 0.3, top_p: 0.9 });
    const swml = JSON.parse(agent.renderSwml());
    const prompt = swml.sections.main[1].ai.prompt;
    expect(prompt.temperature).toBe(0.3);
    expect(prompt.top_p).toBe(0.9);
    expect(prompt.text).toBe('hello');
  });

  it('pre-answer, post-answer, post-ai verbs', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.addPreAnswerVerb('play', { urls: ['ring:us'], auto_answer: false });
    agent.addPostAnswerVerb('play', { url: 'say:Welcome!' });
    agent.addPostAiVerb('hangup', {});
    const swml = JSON.parse(agent.renderSwml());
    const main = swml.sections.main;
    // pre-answer play + answer + post-answer play + ai + post-ai hangup
    expect(main.length).toBe(5);
    expect(main[0]).toHaveProperty('play');
    expect(main[1]).toHaveProperty('answer');
    expect(main[2]).toHaveProperty('play');
    expect(main[3]).toHaveProperty('ai');
    expect(main[4]).toHaveProperty('hangup');
  });

  it('native functions included in SWAIG', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', nativeFunctions: ['check_time'] });
    agent.setPromptText('hello');
    agent.defineTool({
      name: 'fn',
      description: 'd',
      parameters: {},
      handler: () => new SwaigFunctionResult('ok'),
    });
    const swml = JSON.parse(agent.renderSwml());
    expect(swml.sections.main[1].ai.SWAIG.native_functions).toEqual(['check_time']);
  });

  it('function includes', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.addFunctionInclude('https://example.com/fns', ['fn1']);
    agent.defineTool({
      name: 'fn',
      description: 'd',
      parameters: {},
      handler: () => new SwaigFunctionResult('ok'),
    });
    const swml = JSON.parse(agent.renderSwml());
    expect(swml.sections.main[1].ai.SWAIG.includes).toHaveLength(1);
  });

  it('contexts system', () => {
    const agent = createAgent();
    agent.setPromptText('You are a quiz master');
    const ctx = agent.defineContexts();
    const def = ctx.addContext('default');
    def.addStep('greeting', { task: 'Greet the user' })
      .setStepCriteria('User has been greeted')
      .setValidSteps(['quiz']);
    def.addStep('quiz', { task: 'Ask a quiz question' });
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.contexts).toBeDefined();
    expect(ai.contexts.default.steps.length).toBe(2);
  });

  it('getFullUrl returns correct URL', () => {
    const agent = new AgentBase({ name: 'test', route: '/myagent', port: 5000 });
    const url = agent.getFullUrl();
    expect(url).toContain('localhost:5000/myagent');
  });

  it('getFullUrl with auth', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', basicAuth: ['user', 'pass'] });
    const url = agent.getFullUrl(true);
    expect(url).toContain('user:pass@');
  });

  it('getBasicAuthCredentials', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', basicAuth: ['u', 'p'] });
    expect(agent.getBasicAuthCredentials()).toEqual(['u', 'p']);
  });

  it('promptAddSection builds POM prompt', () => {
    const agent = createAgent();
    agent.promptAddSection('Role', { body: 'You are a helper' });
    agent.promptAddSection('Rules', { bullets: ['Be nice'] });
    const prompt = agent.getPrompt();
    expect(prompt).toContain('Role');
    expect(prompt).toContain('You are a helper');
    expect(prompt).toContain('- Be nice');
  });

  it('renders multiple calls independently', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    const swml1 = agent.renderSwml();
    const swml2 = agent.renderSwml();
    // Both should be valid JSON
    expect(JSON.parse(swml1).version).toBe('1.0.0');
    expect(JSON.parse(swml2).version).toBe('1.0.0');
  });
});
