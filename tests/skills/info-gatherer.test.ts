/**
 * Individual tests for the InfoGatherer skill.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { InfoGathererSkill, createInfoGathererSkill } from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => { suppressAllLogs(true); });

// ── Basic skill identity + setup contract ──────────────────────────────────

describe('InfoGathererSkill', () => {
  it('should instantiate via constructor and factory', () => {
    expect(new InfoGathererSkill()).toBeInstanceOf(SkillBase);
    expect(createInfoGathererSkill()).toBeInstanceOf(InfoGathererSkill);
  });

  it("should return false from setup when 'questions' is not configured", async () => {
    // Python parity: skill.py:91-95 — `questions` is required; setup returns
    // false (and logs an error) if it's missing.
    await expect(new InfoGathererSkill().setup()).resolves.toBe(false);
  });

  it('should return true from setup when valid questions are configured', async () => {
    await expect(
      new InfoGathererSkill({
        questions: [{ key_name: 'email', question_text: 'What is your email?' }],
      }).setup(),
    ).resolves.toBe(true);
  });

  it('should return false from setup when questions is an empty array', async () => {
    // Python parity: skill.py:301 — `At least one question is required`.
    await expect(
      new InfoGathererSkill({ questions: [] }).setup(),
    ).resolves.toBe(false);
  });

  it('should return false from setup when questions is not an array', async () => {
    await expect(
      new InfoGathererSkill({ questions: 'not-an-array' }).setup(),
    ).resolves.toBe(false);
  });

  it('should return false from setup when a question is missing key_name', async () => {
    await expect(
      new InfoGathererSkill({
        questions: [{ question_text: 'What is your name?' }],
      }).setup(),
    ).resolves.toBe(false);
  });

  it('should return false from setup when a question is missing question_text', async () => {
    await expect(
      new InfoGathererSkill({ questions: [{ key_name: 'name' }] }).setup(),
    ).resolves.toBe(false);
  });

  it('should skip prompt sections when skip_prompt is set', () => {
    expect(
      new InfoGathererSkill({ skip_prompt: true }).getPromptSections(),
    ).toHaveLength(0);
  });

  it('should return empty hints', () => {
    expect(new InfoGathererSkill().getHints()).toEqual([]);
  });

  it('should return correct manifest', () => {
    const klass = InfoGathererSkill as typeof SkillBase;
    expect(klass.SKILL_NAME).toBe('info_gatherer');
    expect(klass.SKILL_VERSION).toBe('1.0.0');
  });

  it('should have a parameter schema', () => {
    const schema = InfoGathererSkill.getParameterSchema();
    expect(schema).toBeDefined();
  });
});

// ── Sequential question flow mode ────────────────────────────────────────────

describe('InfoGathererSkill — sequential question flow', () => {
  const QUESTIONS = [
    { key_name: 'first_name', question_text: 'What is your first name?' },
    { key_name: 'last_name', question_text: 'What is your last name?', confirm: true },
    { key_name: 'city', question_text: 'What city do you live in?', prompt_add: 'City only, please.' },
  ];

  // Helper: build a rawData envelope with skill state seeded under the given namespace.
  function makeRawData(
    namespace: string,
    state: Record<string, unknown>,
  ): Record<string, unknown> {
    return { global_data: { [namespace]: state } };
  }

  // ── setup() ──────────────────────────────────────────────────────────

  it('setup() — populates instance state from valid questions config', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    // After setup, getTools() must return sequential tools (not field tools).
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('start_questions');
    expect(tools[1].name).toBe('submit_answer');
  });

  it('setup() — uses prefix to derive tool names', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS, prefix: 'survey' });
    await skill.setup();
    const tools = skill.getTools();
    expect(tools[0].name).toBe('survey_start_questions');
    expect(tools[1].name).toBe('survey_submit_answer');
  });

  it('setup() — applies custom completion_message', async () => {
    const custom = 'All done! Thank you.';
    const skill = new InfoGathererSkill({ questions: QUESTIONS, completion_message: custom });
    await skill.setup();
    // Drive all the way to completion to observe the message.
    const namespace = 'skill:info_gatherer';
    const submitTool = skill.getTools()[1];
    // Answer question 1
    let state: Record<string, unknown> = { questions: QUESTIONS, question_index: 0, answers: [] };
    let rawData = makeRawData(namespace, state);
    let result = submitTool.handler({ answer: 'Alice', confirmed_by_user: false }, rawData) as { response: string };
    // Advance state (simulate updateSkillData)
    state = { questions: QUESTIONS, question_index: 1, answers: [{ key_name: 'first_name', answer: 'Alice' }] };
    // Answer question 2 (requires confirmation)
    rawData = makeRawData(namespace, state);
    result = submitTool.handler({ answer: 'Smith', confirmed_by_user: true }, rawData) as { response: string };
    state = { questions: QUESTIONS, question_index: 2, answers: [{ key_name: 'first_name', answer: 'Alice' }, { key_name: 'last_name', answer: 'Smith' }] };
    // Answer question 3 — last question
    rawData = makeRawData(namespace, state);
    result = submitTool.handler({ answer: 'Portland', confirmed_by_user: false }, rawData) as { response: string };
    expect(result.response).toBe(custom);
  });

  it('setup() — returns false for empty questions array (Python skill.py:301)', async () => {
    const skill = new InfoGathererSkill({ questions: [] });
    await expect(skill.setup()).resolves.toBe(false);
    // Un-set-up skill reports no tools (defensive guard — Python relies on
    // the SkillManager never calling register_tools on a failed skill).
    expect(skill.getTools()).toHaveLength(0);
  });

  it('setup() — returns false for non-array questions config', async () => {
    const skill = new InfoGathererSkill({ questions: 'not-an-array' });
    await expect(skill.setup()).resolves.toBe(false);
    expect(skill.getTools()).toHaveLength(0);
  });

  it('setup() — returns false when a question is missing key_name', async () => {
    const skill = new InfoGathererSkill({
      questions: [{ question_text: 'What is your name?' }],
    });
    await expect(skill.setup()).resolves.toBe(false);
    expect(skill.getTools()).toHaveLength(0);
  });

  it('setup() — returns false when a question is missing question_text', async () => {
    const skill = new InfoGathererSkill({
      questions: [{ key_name: 'name' }],
    });
    await expect(skill.setup()).resolves.toBe(false);
    expect(skill.getTools()).toHaveLength(0);
  });

  // ── getInstanceKey() ─────────────────────────────────────────────────

  it('getInstanceKey() — returns "info_gatherer" when no prefix', () => {
    expect(new InfoGathererSkill().getInstanceKey()).toBe('info_gatherer');
  });

  it('getInstanceKey() — returns "info_gatherer_<prefix>" when prefix set', () => {
    expect(new InfoGathererSkill({ prefix: 'intake' }).getInstanceKey()).toBe('info_gatherer_intake');
  });

  // ── getGlobalData() ──────────────────────────────────────────────────

  it('getGlobalData() — returns empty object when no questions configured', () => {
    expect(new InfoGathererSkill().getGlobalData()).toEqual({});
  });

  it('getGlobalData() — seeds question state after setup() with questions', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const globalData = skill.getGlobalData();
    const namespace = skill.getSkillNamespace();
    expect(globalData).toHaveProperty(namespace);
    const state = globalData[namespace] as Record<string, unknown>;
    expect(state['question_index']).toBe(0);
    expect(state['answers']).toEqual([]);
    expect(Array.isArray(state['questions'])).toBe(true);
    expect((state['questions'] as unknown[]).length).toBe(QUESTIONS.length);
  });

  it('getGlobalData() — uses prefix in namespace key', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS, prefix: 'survey' });
    await skill.setup();
    const globalData = skill.getGlobalData();
    // With prefix, namespace is "skill:survey" (config['prefix'] takes priority in getSkillNamespace)
    expect(globalData).toHaveProperty('skill:survey');
  });

  // ── SUPPORTS_MULTIPLE_INSTANCES ──────────────────────────────────────

  it('SUPPORTS_MULTIPLE_INSTANCES is true', () => {
    expect(InfoGathererSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
  });

  // ── start_questions tool ─────────────────────────────────────────────

  it('start_questions — returns first question instruction when state is fresh', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const startTool = skill.getTools()[0];
    expect(startTool.name).toBe('start_questions');

    const namespace = skill.getSkillNamespace();
    const state = { questions: QUESTIONS, question_index: 0, answers: [] };
    const rawData = makeRawData(namespace, state);

    const result = startTool.handler({}, rawData) as { response: string };
    expect(result.response).toContain(QUESTIONS[0].question_text);
    expect(result.response).toContain('Question 1 of 3');
  });

  it('start_questions — includes submit tool name in instruction', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS, prefix: 'q' });
    await skill.setup();
    const startTool = skill.getTools()[0];
    const namespace = skill.getSkillNamespace();
    const rawData = makeRawData(namespace, { questions: QUESTIONS, question_index: 0, answers: [] });
    const result = startTool.handler({}, rawData) as { response: string };
    expect(result.response).toContain('q_submit_answer');
  });

  it('start_questions — returns no-questions message when questions array is empty in state', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const startTool = skill.getTools()[0];
    const namespace = skill.getSkillNamespace();
    // State has empty questions array
    const rawData = makeRawData(namespace, { questions: [], question_index: 0, answers: [] });
    const result = startTool.handler({}, rawData) as { response: string };
    expect(result.response).toContain("don't have any questions");
  });

  // ── submit_answer tool ───────────────────────────────────────────────

  it('submit_answer — valid answer advances to next question', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const submitTool = skill.getTools()[1];
    const namespace = skill.getSkillNamespace();

    const state = { questions: QUESTIONS, question_index: 0, answers: [] };
    const rawData = makeRawData(namespace, state);

    const result = submitTool.handler({ answer: 'Alice', confirmed_by_user: false }, rawData) as { response: string; action: Record<string, unknown>[] };
    // Should return the second question instruction
    expect(result.response).toContain(QUESTIONS[1].question_text);
    expect(result.response).toContain('Question 2 of 3');
  });

  it('submit_answer — confirm=true question is rejected without confirmed_by_user flag', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const submitTool = skill.getTools()[1];
    const namespace = skill.getSkillNamespace();

    // question_index=1 is the confirm:true question
    const state = {
      questions: QUESTIONS,
      question_index: 1,
      answers: [{ key_name: 'first_name', answer: 'Alice' }],
    };
    const rawData = makeRawData(namespace, state);

    const result = submitTool.handler({ answer: 'Smith', confirmed_by_user: false }, rawData) as { response: string };
    expect(result.response).toContain('must read the answer');
    expect(result.response).toContain('"Smith"');
  });

  it('submit_answer — confirm=true question succeeds with confirmed_by_user=true', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const submitTool = skill.getTools()[1];
    const namespace = skill.getSkillNamespace();

    const state = {
      questions: QUESTIONS,
      question_index: 1,
      answers: [{ key_name: 'first_name', answer: 'Alice' }],
    };
    const rawData = makeRawData(namespace, state);

    const result = submitTool.handler({ answer: 'Smith', confirmed_by_user: true }, rawData) as { response: string };
    // Should proceed to question 3
    expect(result.response).toContain(QUESTIONS[2].question_text);
    expect(result.response).toContain('Question 3 of 3');
  });

  it('submit_answer — prompt_add text is included in the next question instruction', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const submitTool = skill.getTools()[1];
    const namespace = skill.getSkillNamespace();

    // Advance past questions 1 and 2 (confirm) to reach question 3 (city, has prompt_add)
    const state = {
      questions: QUESTIONS,
      question_index: 1,
      answers: [{ key_name: 'first_name', answer: 'Alice' }],
    };
    const rawData = makeRawData(namespace, state);
    // Answer q2 with confirmation
    const result = submitTool.handler({ answer: 'Smith', confirmed_by_user: true }, rawData) as { response: string };
    expect(result.response).toContain('City only, please.');
  });

  it('submit_answer — last question triggers completion and disables tools', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const submitTool = skill.getTools()[1];
    const namespace = skill.getSkillNamespace();

    const state = {
      questions: QUESTIONS,
      question_index: 2,
      answers: [
        { key_name: 'first_name', answer: 'Alice' },
        { key_name: 'last_name', answer: 'Smith' },
      ],
    };
    const rawData = makeRawData(namespace, state);

    const result = submitTool.handler({ answer: 'Portland', confirmed_by_user: false }, rawData) as { response: string; action: Record<string, unknown>[] };
    // Response should be the completion message
    expect(result.response).toContain('Thank you! All questions have been answered');
    // Action should include toggle_functions to disable both tools
    const toggleAction = result.action.find((a) => 'toggle_functions' in a);
    expect(toggleAction).toBeDefined();
    const toggles = toggleAction!['toggle_functions'] as Array<{ function: string; active: boolean }>;
    const startToggle = toggles.find((t) => t.function === 'start_questions');
    const submitToggle = toggles.find((t) => t.function === 'submit_answer');
    expect(startToggle?.active).toBe(false);
    expect(submitToggle?.active).toBe(false);
  });

  it('submit_answer — last question also writes updated state via set_global_data', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const submitTool = skill.getTools()[1];
    const namespace = skill.getSkillNamespace();

    const state = {
      questions: QUESTIONS,
      question_index: 2,
      answers: [
        { key_name: 'first_name', answer: 'Alice' },
        { key_name: 'last_name', answer: 'Smith' },
      ],
    };
    const rawData = makeRawData(namespace, state);
    const result = submitTool.handler({ answer: 'Portland', confirmed_by_user: false }, rawData) as { response: string; action: Record<string, unknown>[] };

    const globalDataAction = result.action.find((a) => 'set_global_data' in a);
    expect(globalDataAction).toBeDefined();
    const updatedData = globalDataAction!['set_global_data'] as Record<string, unknown>;
    const newState = updatedData[namespace] as Record<string, unknown>;
    expect(newState['question_index']).toBe(3);
    expect((newState['answers'] as unknown[]).length).toBe(3);
  });

  it('submit_answer — returns "all answered" message when index is already at end', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const submitTool = skill.getTools()[1];
    const namespace = skill.getSkillNamespace();

    const state = {
      questions: QUESTIONS,
      question_index: 3, // past the end
      answers: [
        { key_name: 'first_name', answer: 'Alice' },
        { key_name: 'last_name', answer: 'Smith' },
        { key_name: 'city', answer: 'Portland' },
      ],
    };
    const rawData = makeRawData(namespace, state);
    const result = submitTool.handler({ answer: 'extra', confirmed_by_user: false }, rawData) as { response: string };
    expect(result.response).toBe('All questions have already been answered.');
  });

  // ── Prompt sections ──────────────────────────────────────────────────

  it('provides sequential prompt section when questions are configured', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].body).toContain('start_questions');
    expect(sections[0].body).toContain('submit_answer');
  });
});
