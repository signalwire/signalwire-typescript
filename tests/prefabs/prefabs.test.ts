import { describe, it, expect, vi, beforeAll } from 'vitest';
import { suppressAllLogs } from '../../src/Logger.js';
import { InfoGathererAgent, createInfoGathererAgent } from '../../src/prefabs/InfoGathererAgent.js';
import { SurveyAgent, createSurveyAgent } from '../../src/prefabs/SurveyAgent.js';
import { FAQBotAgent, createFAQBotAgent } from '../../src/prefabs/FAQBotAgent.js';
import { ConciergeAgent, createConciergeAgent } from '../../src/prefabs/ConciergeAgent.js';
import { ReceptionistAgent, createReceptionistAgent } from '../../src/prefabs/ReceptionistAgent.js';

beforeAll(() => {
  suppressAllLogs(true);
});

// ============================================================================
// InfoGathererAgent
// ============================================================================

describe('InfoGathererAgent', () => {
  const baseQuestions = [
    { key_name: 'full_name', question_text: 'What is your full name?' },
    { key_name: 'email', question_text: 'What is your email address?', confirm: true },
    { key_name: 'reason', question_text: 'How can I help you today?' },
  ];

  function createAgent(overrides?: Record<string, unknown>) {
    return new InfoGathererAgent({
      questions: baseQuestions,
      ...overrides,
    });
  }

  it('creates with questions config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(InfoGathererAgent);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('registers start_questions and submit_answer tools', () => {
    const agent = createAgent();
    expect(agent.getTool('start_questions')).toBeDefined();
    expect(agent.getTool('submit_answer')).toBeDefined();
  });

  it('static mode populates global_data with questions at construction', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    // questions should appear in the SWML global_data surface
    expect(swml).toContain('full_name');
    expect(swml).toContain('What is your full name');
  });

  it('start_questions returns the first question instruction', async () => {
    const agent = createAgent();
    const tool = agent.getTool('start_questions')!;
    const rawData = {
      global_data: {
        questions: baseQuestions,
        question_index: 0,
        answers: [],
      },
    };
    const result = await tool.execute({}, rawData);
    expect(result.response).toContain('What is your full name?');
    expect(result.response).toContain('Make sure the answer fits');
  });

  it('start_questions uses confirmation instruction when confirm flag is true', async () => {
    const agent = new InfoGathererAgent({
      questions: [
        { key_name: 'email', question_text: 'Email?', confirm: true },
      ],
    });
    const tool = agent.getTool('start_questions')!;
    const rawData = {
      global_data: {
        questions: [{ key_name: 'email', question_text: 'Email?', confirm: true }],
        question_index: 0,
        answers: [],
      },
    };
    const result = await tool.execute({}, rawData);
    expect(result.response).toContain('Insist that the user confirms');
  });

  it('submit_answer advances to next question and updates global data', async () => {
    const agent = createAgent();
    const tool = agent.getTool('submit_answer')!;
    const rawData = {
      global_data: {
        questions: baseQuestions,
        question_index: 0,
        answers: [],
      },
    };
    const result = await tool.execute({ answer: 'Jane Doe' }, rawData);
    expect(result.response).toContain('What is your email address?');
    // Check global data update action is present
    const actions = result.action as Array<Record<string, unknown>>;
    const updateAction = actions.find(
      (a) => a['set_global_data'] !== undefined || a['update_global_data'] !== undefined,
    );
    expect(updateAction).toBeDefined();
  });

  it('submit_answer completes the flow after the last question', async () => {
    const agent = createAgent();
    const tool = agent.getTool('submit_answer')!;
    const rawData = {
      global_data: {
        questions: baseQuestions,
        question_index: 2,
        answers: [
          { key_name: 'full_name', answer: 'Jane Doe' },
          { key_name: 'email', answer: 'jane@example.com' },
        ],
      },
    };
    const result = await tool.execute({ answer: 'Billing issue' }, rawData);
    expect(result.response).toContain('All questions have been answered');
  });

  it('submit_answer handles out-of-bounds index', async () => {
    const agent = createAgent();
    const tool = agent.getTool('submit_answer')!;
    const rawData = {
      global_data: {
        questions: baseQuestions,
        question_index: 99,
        answers: [],
      },
    };
    const result = await tool.execute({ answer: 'late answer' }, rawData);
    expect(result.response).toContain('All questions have already been answered');
  });

  it('setQuestionCallback is callable and stored', () => {
    const agent = new InfoGathererAgent();
    const cb = vi.fn(() => []);
    agent.setQuestionCallback(cb);
    // Confirm the method returned `this` for chaining
    const result = agent.setQuestionCallback(cb);
    expect(result).toBe(agent);
  });

  it('dynamic mode: onSwmlRequest invokes the callback and sets global data', async () => {
    const agent = new InfoGathererAgent();
    const cb = vi.fn((queryParams: Record<string, string>) => {
      if (queryParams.mode === 'support') {
        return [
          { key_name: 'name', question_text: 'Your name?' },
          { key_name: 'issue', question_text: "What's the issue?" },
        ];
      }
      return [{ key_name: 'name', question_text: 'What is your name?' }];
    });
    agent.setQuestionCallback(cb);

    await agent.onSwmlRequest({ query_params: { mode: 'support' } });
    expect(cb).toHaveBeenCalledTimes(1);

    const swml = agent.renderSwml('test-call');
    expect(swml).toContain("What's the issue?");
    expect(swml).toContain('issue');
  });

  it('dynamic mode: falls back to default questions when no callback is registered', async () => {
    const agent = new InfoGathererAgent();
    await agent.onSwmlRequest({});
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('What is your name?');
    expect(swml).toContain('How can I help you today?');
  });

  it('dynamic mode: falls back when the callback throws', async () => {
    const agent = new InfoGathererAgent();
    agent.setQuestionCallback(() => {
      throw new Error('boom');
    });
    await agent.onSwmlRequest({});
    const swml = agent.renderSwml('test-call');
    // Fallback questions should be injected
    expect(swml).toContain('What is your name?');
  });

  it('questionCallback can be passed via config', async () => {
    const cb = vi.fn(() => [
      { key_name: 'company', question_text: 'What company?' },
    ]);
    const agent = new InfoGathererAgent({ questionCallback: cb });
    await agent.onSwmlRequest({});
    expect(cb).toHaveBeenCalled();
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('What company?');
  });

  it('throws on missing key_name in a question', () => {
    expect(
      () =>
        new InfoGathererAgent({
          // @ts-expect-error intentionally invalid
          questions: [{ question_text: 'Something?' }],
        }),
    ).toThrow(/key_name/);
  });

  it('throws on missing question_text in a question', () => {
    expect(
      () =>
        new InfoGathererAgent({
          // @ts-expect-error intentionally invalid
          questions: [{ key_name: 'x' }],
        }),
    ).toThrow(/question_text/);
  });

  it('factory function creates agent', () => {
    const agent = createInfoGathererAgent({ questions: baseQuestions });
    expect(agent).toBeInstanceOf(InfoGathererAgent);
    expect(agent.getTool('start_questions')).toBeDefined();
  });
});

// ============================================================================
// SurveyAgent
// ============================================================================

describe('SurveyAgent', () => {
  const baseQuestions = [
    {
      id: 'q1',
      text: 'How satisfied are you with our service?',
      type: 'rating' as const,
      scale: 10,
      points: 1,
    },
    {
      id: 'q2',
      text: 'Would you recommend us?',
      type: 'yes_no' as const,
      points: { yes: 10, no: 0 },
    },
    {
      id: 'q3',
      text: 'Which feature do you like most?',
      type: 'multiple_choice' as const,
      options: ['Speed', 'Price', 'Support'],
    },
    {
      id: 'q4',
      text: 'Any additional comments?',
      type: 'open_ended' as const,
    },
  ];

  function createAgent(overrides?: Record<string, unknown>) {
    return new SurveyAgent({
      surveyName: 'Customer Satisfaction Survey',
      questions: baseQuestions,
      ...overrides,
    });
  }

  it('creates with questions config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(SurveyAgent);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('has answer_question, get_current_question, and get_survey_progress tools', () => {
    const agent = createAgent();
    expect(agent.getTool('answer_question')).toBeDefined();
    expect(agent.getTool('get_current_question')).toBeDefined();
    expect(agent.getTool('get_survey_progress')).toBeDefined();
  });

  it('get_current_question returns first question initially', async () => {
    const agent = createAgent();
    const tool = agent.getTool('get_current_question')!;
    const result = await tool.execute({}, { call_id: 'survey-1' });
    expect(result.response).toContain('q1');
    expect(result.response).toContain('How satisfied');
  });

  it('answer_question stores response and advances', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'survey-2' };

    const result = await tool.execute({ question_id: 'q1', answer: '8' }, callData);
    expect(result.response).toContain('Answer recorded');
    expect(result.response).toContain('q2');

    // Verify progress
    const progressTool = agent.getTool('get_survey_progress')!;
    const progress = await progressTool.execute({}, callData);
    expect(progress.response).toContain('1/4');
    expect(progress.response).toContain('q1: 8');
  });

  it('branching: conditional nextQuestion works', async () => {
    const branchQuestions = [
      {
        id: 'start',
        text: 'Do you like it?',
        type: 'yes_no' as const,
        nextQuestion: { yes: 'positive', no: 'negative' },
      },
      {
        id: 'positive',
        text: 'What do you love?',
        type: 'open_ended' as const,
      },
      {
        id: 'negative',
        text: 'What can we improve?',
        type: 'open_ended' as const,
      },
    ];

    const agent = new SurveyAgent({ surveyName: 'Branching Survey', questions: branchQuestions });
    const tool = agent.getTool('answer_question')!;

    // Answer "yes" should branch to "positive"
    const result = await tool.execute(
      { question_id: 'start', answer: 'yes' },
      { call_id: 'branch-1' },
    );
    expect(result.response).toContain('positive');
    expect(result.response).toContain('What do you love');

    // A separate call answering "no" should branch to "negative"
    const agent2 = new SurveyAgent({ surveyName: 'Branching Survey', questions: branchQuestions });
    const tool2 = agent2.getTool('answer_question')!;
    const result2 = await tool2.execute(
      { question_id: 'start', answer: 'no' },
      { call_id: 'branch-2' },
    );
    expect(result2.response).toContain('negative');
    expect(result2.response).toContain('What can we improve');
  });

  it('scoring: points accumulate', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'score-1' };

    // q1 has fixed points=1
    await tool.execute({ question_id: 'q1', answer: '7' }, callData);
    // q2 has per-answer: yes=10
    await tool.execute({ question_id: 'q2', answer: 'yes' }, callData);

    const progressTool = agent.getTool('get_survey_progress')!;
    const progress = await progressTool.execute({}, callData);
    expect(progress.response).toContain('Current score: 11');
  });

  it('get_survey_progress shows progress percentage', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'prog-1' };

    await tool.execute({ question_id: 'q1', answer: '5' }, callData);
    await tool.execute({ question_id: 'q2', answer: 'yes' }, callData);

    const progressTool = agent.getTool('get_survey_progress')!;
    const progress = await progressTool.execute({}, callData);
    expect(progress.response).toContain('2/4');
    expect(progress.response).toContain('50%');
  });

  it('survey completion triggers onComplete', async () => {
    const onComplete = vi.fn();
    const simpleQuestions = [
      { id: 'only', text: 'Rate us', type: 'rating' as const, scale: 10, points: 5 },
    ];
    const agent = new SurveyAgent({ surveyName: 'Tiny', questions: simpleQuestions, onComplete });

    const tool = agent.getTool('answer_question')!;
    await tool.execute({ question_id: 'only', answer: '9' }, { call_id: 'done-1' });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ only: '9' }, 5);
  });

  it('rating type validates range', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;

    // Out of range
    const result = await tool.execute(
      { question_id: 'q1', answer: '15' },
      { call_id: 'val-1' },
    );
    expect(result.response).toContain('between 1 and 10');

    // Not a number
    const result2 = await tool.execute(
      { question_id: 'q1', answer: 'abc' },
      { call_id: 'val-2' },
    );
    expect(result2.response).toContain('between 1 and 10');
  });

  it('yes/no type normalizes answers', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'norm-1' };

    // Answer q1 first (rating)
    await tool.execute({ question_id: 'q1', answer: '7' }, callData);

    // "yeah" should be normalized to "yes"
    await tool.execute({ question_id: 'q2', answer: 'yeah' }, callData);

    const progressTool = agent.getTool('get_survey_progress')!;
    const progress = await progressTool.execute({}, callData);
    expect(progress.response).toContain('q2: yes');
  });

  it('multiple choice validates options', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'mc-1' };

    // Skip to q3 by answering q1 and q2 first
    await tool.execute({ question_id: 'q1', answer: '5' }, callData);
    await tool.execute({ question_id: 'q2', answer: 'yes' }, callData);

    // Invalid option
    const result = await tool.execute(
      { question_id: 'q3', answer: 'InvalidOption' },
      callData,
    );
    expect(result.response).toContain('Invalid choice');
    expect(result.response).toContain('Speed');
    expect(result.response).toContain('Price');
    expect(result.response).toContain('Support');
  });

  it('factory function creates agent', () => {
    const agent = createSurveyAgent({
      surveyName: 'Factory Survey',
      questions: baseQuestions,
    });
    expect(agent).toBeInstanceOf(SurveyAgent);
    expect(agent.getTool('answer_question')).toBeDefined();
  });

  it('exposes Python-parity public properties', () => {
    const agent = createAgent({
      brandName: 'Acme',
      maxRetries: 4,
      introduction: 'Welcome!',
      conclusion: 'Goodbye!',
    });
    expect(agent.surveyName).toBe('Customer Satisfaction Survey');
    expect(agent.brandName).toBe('Acme');
    expect(agent.maxRetries).toBe(4);
    expect(agent.introduction).toBe('Welcome!');
    expect(agent.conclusion).toBe('Goodbye!');
    expect(agent.questions).toBe(baseQuestions);
  });

  it('brandName defaults to "Our Company"', () => {
    const agent = createAgent();
    expect(agent.brandName).toBe('Our Company');
  });

  it('maxRetries defaults to 2 and appears in instructions', () => {
    const agent = createAgent();
    expect(agent.maxRetries).toBe(2);
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('retry up to 2');
  });

  it('has validate_response and log_response tools (Python parity)', () => {
    const agent = createAgent();
    expect(agent.getTool('validate_response')).toBeDefined();
    expect(agent.getTool('log_response')).toBeDefined();
  });

  it('validate_response flags rating out of configured scale', async () => {
    const agent = createAgent();
    const tool = agent.getTool('validate_response')!;
    // q1 has scale: 10 — 11 should be rejected
    const bad = await tool.execute({ question_id: 'q1', response: '11' }, {});
    expect(bad.response).toContain('between 1 and 10');
    // And valid
    const ok = await tool.execute({ question_id: 'q1', response: '7' }, {});
    expect(ok.response).toContain('is valid');
  });

  it('validate_response uses scale default of 5 for rating questions', async () => {
    const agent = new SurveyAgent({
      surveyName: 'Five Point',
      questions: [{ id: 'q', text: 'Rate', type: 'rating' }],
    });
    const tool = agent.getTool('validate_response')!;
    const bad = await tool.execute({ question_id: 'q', response: '6' }, {});
    expect(bad.response).toContain('between 1 and 5');
  });

  it('validate_response checks required=true for open_ended', async () => {
    const agent = new SurveyAgent({
      surveyName: 'Required Survey',
      questions: [
        { id: 'optional_q', text: 'Optional?', type: 'open_ended', required: false },
        { id: 'required_q', text: 'Required', type: 'open_ended', required: true },
      ],
    });
    const tool = agent.getTool('validate_response')!;
    // empty answer to required → error
    const requiredErr = await tool.execute({ question_id: 'required_q', response: '' }, {});
    expect(requiredErr.response).toContain('required');
    // empty answer to optional → valid
    const optionalOk = await tool.execute({ question_id: 'optional_q', response: '' }, {});
    expect(optionalOk.response).toContain('is valid');
  });

  it('log_response acknowledges recording a response', async () => {
    const agent = createAgent();
    const tool = agent.getTool('log_response')!;
    const result = await tool.execute(
      { question_id: 'q1', response: '7' },
      { call_id: 'log-1' },
    );
    expect(result.response).toContain('recorded');
    expect(result.response).toContain('satisfied');
  });

  it('prompt mentions surveyName, brandName, and introduction/conclusion', () => {
    const agent = createAgent({
      brandName: 'Acme Corp',
      introduction: 'Welcome to the Acme feedback line!',
      conclusion: 'Thanks for your time.',
    });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('Customer Satisfaction Survey');
    expect(swml).toContain('Acme Corp');
    expect(swml).toContain('Welcome to the Acme feedback line!');
    expect(swml).toContain('Thanks for your time.');
  });

  it('onSummary override is callable without throwing', async () => {
    const agent = createAgent();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await agent.onSummary({ survey_name: 'Customer Satisfaction Survey' }, {});
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

// ============================================================================
// FAQBotAgent
// ============================================================================

describe('FAQBotAgent', () => {
  const baseFaqs = [
    {
      question: 'What are your business hours?',
      answer: 'We are open Monday through Friday, 9am to 5pm EST.',
      keywords: ['hours', 'open', 'schedule', 'time'],
    },
    {
      question: 'How do I reset my password?',
      answer: 'Go to the login page, click "Forgot Password", and follow the instructions.',
      keywords: ['password', 'reset', 'login', 'forgot'],
    },
    {
      question: 'What is the return policy?',
      answer: 'You can return any item within 30 days of purchase for a full refund.',
      keywords: ['return', 'refund', 'policy'],
    },
  ];

  function createAgent(overrides?: Record<string, unknown>) {
    return new FAQBotAgent({
      faqs: baseFaqs,
      ...overrides,
    });
  }

  it('creates with FAQs config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(FAQBotAgent);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('has search_faqs tool and no escalate when not configured', () => {
    const agent = createAgent();
    expect(agent.getTool('search_faqs')).toBeDefined();
    expect(agent.getTool('escalate')).toBeUndefined();
  });

  it('search_faqs returns matching FAQ', async () => {
    const agent = createAgent();
    const tool = agent.getTool('search_faqs')!;
    const result = await tool.execute({ query: 'What are your business hours?' }, {});
    expect(result.response).toContain('Monday through Friday');
    expect(result.response).toContain('9am to 5pm');
  });

  it('returns no-match for unrelated query', async () => {
    const agent = createAgent({ threshold: 0.5 });
    const tool = agent.getTool('search_faqs')!;
    const result = await tool.execute({ query: 'quantum physics dark matter' }, {});
    expect(result.response).toContain('No FAQ matched');
  });

  it('threshold filtering works', async () => {
    // High threshold makes it hard to match
    const agent = createAgent({ threshold: 0.99 });
    const tool = agent.getTool('search_faqs')!;
    const result = await tool.execute({ query: 'hours open' }, {});
    expect(result.response).toContain('No FAQ matched');

    // Low threshold makes it easy to match
    const agent2 = createAgent({ threshold: 0.01 });
    const tool2 = agent2.getTool('search_faqs')!;
    const result2 = await tool2.execute({ query: 'hours open' }, {});
    expect(result2.response).toContain('FAQ Match');
  });

  it('category filter narrows the FAQ pool', async () => {
    const categorizedFaqs = [
      {
        question: 'What are your business hours?',
        answer: 'Mon-Fri, 9-5.',
        categories: ['general'],
      },
      {
        question: 'How do I reset my password?',
        answer: 'Click "Forgot Password" on the login page.',
        categories: ['account'],
      },
    ];
    const agent = new FAQBotAgent({ faqs: categorizedFaqs, threshold: 0.01 });
    const tool = agent.getTool('search_faqs')!;
    const result = await tool.execute(
      { query: 'password reset', category: 'general' },
      {},
    );
    // Filtered to only the "general" FAQ, so no relevant password match
    expect(result.response).not.toContain('Forgot Password');
  });

  it('suggestRelated=false suppresses runner-up suggestions', async () => {
    const agent = createAgent({ threshold: 0.01, suggestRelated: false });
    const tool = agent.getTool('search_faqs')!;
    const result = await tool.execute({ query: 'password hours open' }, {});
    expect(result.response).not.toContain('Also related:');
  });

  it('persona overrides the default Personality section', () => {
    const agent = createAgent({ persona: 'You are a terse and factual help desk.' });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('terse and factual help desk');
  });

  it('exposes public faqs, suggestRelated, and persona properties', () => {
    const agent = createAgent({ persona: 'custom persona text' });
    expect(agent.faqs).toEqual(baseFaqs);
    expect(agent.suggestRelated).toBe(true);
    expect(agent.persona).toBe('custom persona text');
  });

  it('onSummary override is callable without throwing', async () => {
    const agent = createAgent();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await agent.onSummary({ question: 'hours' }, {});
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('escalate tool is not registered without escalation number', () => {
    const agent = createAgent();
    expect(agent.getTool('escalate')).toBeUndefined();
  });

  it('escalate tool is registered when escalation number is set', () => {
    const agent = createAgent({ escalationNumber: '+15551234567' });
    expect(agent.getTool('escalate')).toBeDefined();
  });

  it('escalate tool transfers caller', async () => {
    const agent = createAgent({ escalationNumber: '+15551234567' });
    const tool = agent.getTool('escalate')!;
    const result = await tool.execute({ reason: 'Cannot find answer' }, {});
    expect(result.response).toContain('Transferring');
    expect(result.response).toContain('Cannot find answer');
    const actions = result.action as Record<string, unknown>[];
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('search_faqs includes escalation message when no match', async () => {
    const agent = createAgent({ escalationMessage: 'Please hold for an agent.' });
    const tool = agent.getTool('search_faqs')!;
    const result = await tool.execute({ query: 'completely unrelated topic xyz' }, {});
    // The escalation message is included in the no-match response
    expect(result.response).toContain('No FAQ matched');
  });

  it('keywords improve matching', async () => {
    const agent = createAgent({ threshold: 0.3 });
    const tool = agent.getTool('search_faqs')!;

    // Query using keywords that match the password FAQ
    const result = await tool.execute({ query: 'forgot password reset' }, {});
    expect(result.response).toContain('FAQ Match');
    expect(result.response).toContain('Forgot Password');
  });

  it('prompt mentions FAQ topics', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('business hours');
    expect(swml).toContain('password');
    expect(swml).toContain('return policy');
  });

  it('factory function creates agent', () => {
    const agent = createFAQBotAgent({ faqs: baseFaqs });
    expect(agent).toBeInstanceOf(FAQBotAgent);
    expect(agent.getTool('search_faqs')).toBeDefined();
  });
});

// ============================================================================
// ConciergeAgent
// ============================================================================

describe('ConciergeAgent', () => {
  const baseAmenities = {
    pool: { hours: '7 AM - 10 PM', location: '2nd Floor' },
    gym: { hours: '24 hours', location: '3rd Floor' },
  };
  const baseServices = ['room service', 'spa bookings', 'restaurant reservations'];

  function createAgent(overrides?: Record<string, unknown>) {
    return new ConciergeAgent({
      venueName: 'Grand Hotel',
      services: baseServices,
      amenities: baseAmenities,
      ...overrides,
    });
  }

  it('creates with venue config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(ConciergeAgent);
  });

  it('exposes public venue properties', () => {
    const agent = createAgent();
    expect(agent.venueName).toBe('Grand Hotel');
    expect(agent.services).toEqual(baseServices);
    expect(agent.amenities).toEqual(baseAmenities);
    expect(agent.hoursOfOperation).toEqual({ default: '9 AM - 5 PM' });
    expect(agent.specialInstructions).toEqual([]);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('has check_availability and get_directions tools', () => {
    const agent = createAgent();
    expect(agent.getTool('check_availability')).toBeDefined();
    expect(agent.getTool('get_directions')).toBeDefined();
  });

  it('check_availability confirms an offered service', async () => {
    const agent = createAgent();
    const tool = agent.getTool('check_availability')!;
    const result = await tool.execute(
      { service: 'spa bookings', date: '2026-01-01', time: '10:00' },
      {},
    );
    expect(result.response).toContain('spa bookings');
    expect(result.response).toContain('2026-01-01');
    expect(result.response).toContain('10:00');
    expect(result.response).toContain('reservation');
  });

  it('check_availability rejects an unknown service', async () => {
    const agent = createAgent();
    const tool = agent.getTool('check_availability')!;
    const result = await tool.execute(
      { service: 'skydiving', date: '2026-01-01', time: '10:00' },
      {},
    );
    expect(result.response).toContain("don't offer");
    expect(result.response).toContain('Grand Hotel');
    // Should list available services
    expect(result.response).toContain('spa bookings');
  });

  it('get_directions looks up an amenity by name', async () => {
    const agent = createAgent();
    const tool = agent.getTool('get_directions')!;
    const result = await tool.execute({ location: 'pool' }, {});
    expect(result.response).toContain('pool');
    expect(result.response).toContain('2nd Floor');
  });

  it('get_directions falls back for unknown locations', async () => {
    const agent = createAgent();
    const tool = agent.getTool('get_directions')!;
    const result = await tool.execute({ location: 'helipad' }, {});
    expect(result.response).toContain("don't have specific directions");
    expect(result.response).toContain('front desk');
  });

  it('prompt mentions the venue name and services', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('Grand Hotel');
    expect(swml).toContain('spa bookings');
  });

  it('renders amenities as subsections', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    // Python titles the amenity names; our titleCase mirrors Python str.title()
    expect(swml).toContain('Pool');
    expect(swml).toContain('Gym');
    expect(swml).toContain('2nd Floor');
  });

  it('renders hours of operation from default or custom map', () => {
    const agent = createAgent({
      hoursOfOperation: { weekday: '9 AM - 9 PM', weekend: '10 AM - 6 PM' },
    });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('Weekday');
    expect(swml).toContain('9 AM - 9 PM');
    expect(swml).toContain('Weekend');
  });

  it('appends special instructions to the Instructions section', () => {
    const agent = createAgent({
      specialInstructions: ['Always mention the weekly wine tasting.'],
    });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('wine tasting');
  });

  it('welcomeMessage sets a non-bargeable static greeting', () => {
    const agent = createAgent({
      welcomeMessage: 'Welcome to the Grand Hotel!',
    });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('Welcome to the Grand Hotel!');
    expect(swml).toContain('static_greeting_no_barge');
  });

  it('onSummary override is callable without throwing', async () => {
    const agent = createAgent();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await agent.onSummary({ topic: 'pool hours' }, {});
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('factory function creates agent', () => {
    const agent = createConciergeAgent({
      venueName: 'Seaside Inn',
      services: ['dining'],
      amenities: { patio: { location: 'Ground Floor' } },
    });
    expect(agent).toBeInstanceOf(ConciergeAgent);
    expect(agent.getTool('check_availability')).toBeDefined();
    expect(agent.getTool('get_directions')).toBeDefined();
  });
});

// ============================================================================
// ReceptionistAgent
// ============================================================================

describe('ReceptionistAgent', () => {
  const baseDepartments = [
    { name: 'sales', description: 'Product inquiries and pricing', number: '+15551001001' },
    { name: 'support', description: 'Technical help and troubleshooting', number: '+15551002002' },
    { name: 'billing', description: 'Invoices and payments', number: '+15551003003' },
  ];

  function createAgent(overrides?: Record<string, unknown>) {
    return new ReceptionistAgent({
      departments: baseDepartments,
      ...overrides,
    });
  }

  it('creates with departments config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(ReceptionistAgent);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('registers collect_caller_info and transfer_call (Python parity)', () => {
    const agent = createAgent();
    expect(agent.getTool('collect_caller_info')).toBeDefined();
    expect(agent.getTool('transfer_call')).toBeDefined();
  });

  it('collect_caller_info stores caller info via set_global_data', async () => {
    const agent = createAgent();
    const tool = agent.getTool('collect_caller_info')!;
    const result = await tool.execute({ name: 'Alice', reason: 'billing question' }, {});
    expect(result.response).toContain('Thank you, Alice');
    expect(result.response).toContain('billing question');
    const actions = result.action as Array<Record<string, unknown>>;
    const setGlobalData = actions.find((a) => a['set_global_data'] !== undefined);
    expect(setGlobalData).toBeDefined();
    const payload = (setGlobalData?.['set_global_data'] as Record<string, unknown>)['caller_info'];
    expect(payload).toEqual({ name: 'Alice', reason: 'billing question' });
  });

  it('transfer_call connects to the department phone number with final+post_process', async () => {
    const agent = createAgent();
    const tool = agent.getTool('transfer_call')!;
    const rawData = { global_data: { caller_info: { name: 'Bob' } } };
    const result = await tool.execute({ department: 'sales' }, rawData);
    expect(result.response).toContain('sales department');
    expect(result.response).toContain('Bob');
    const actions = result.action as Array<Record<string, unknown>>;
    const connectAction = actions.find((a) => a['SWML'] !== undefined);
    expect(connectAction).toBeDefined();
    // final=true manifests as transfer: "true"
    expect(connectAction?.['transfer']).toBe('true');
    // post_process flag is serialized when post_process was enabled
    expect(result['post_process']).toBe(true);
  });

  it('transfer_call returns an error for an unknown department', async () => {
    const agent = createAgent();
    const tool = agent.getTool('transfer_call')!;
    const result = await tool.execute({ department: 'nonexistent' }, {});
    expect(result.response).toContain("couldn't find");
  });

  it('departments enum is passed to the transfer_call parameter schema', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    const swmlStr = JSON.stringify(parsed);
    expect(swmlStr).toContain('"enum"');
    expect(swmlStr).toContain('"sales"');
    expect(swmlStr).toContain('"support"');
  });

  it('default name is lowercase "receptionist"', () => {
    const agent = createAgent();
    // name shows up in the SWML agent name/route surface
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('receptionist');
  });

  it('default greeting matches Python copy', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('Thank you for calling. How can I help you today?');
  });

  it('custom greeting appears in the prompt', () => {
    const agent = createAgent({ greeting: 'Welcome to Acme!' });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('Welcome to Acme!');
  });

  it('voice defaults to rime.spore via addLanguage', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('rime.spore');
  });

  it('custom voice is forwarded to addLanguage', () => {
    const agent = createAgent({ voice: 'elevenlabs.rachel' });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('elevenlabs.rachel');
  });

  it('route defaults to /receptionist and is forwarded to super()', () => {
    const agent = createAgent();
    expect(agent.route).toBe('/receptionist');
  });

  it('custom route overrides the default', () => {
    const agent = createAgent({ route: '/front-desk' });
    expect(agent.route).toBe('/front-desk');
  });

  it('check_in_visitor is not registered by default', () => {
    const agent = createAgent();
    expect(agent.getTool('check_in_visitor')).toBeUndefined();
  });

  it('check_in_visitor is registered when checkInEnabled=true', () => {
    const agent = createAgent({ checkInEnabled: true });
    expect(agent.getTool('check_in_visitor')).toBeDefined();
  });

  it('check_in_visitor records visitor data and fires the callback', async () => {
    const onVisitorCheckIn = vi.fn();
    const agent = createAgent({
      companyName: 'TechCo',
      checkInEnabled: true,
      onVisitorCheckIn,
    });
    const tool = agent.getTool('check_in_visitor')!;
    const result = await tool.execute(
      { visitor_name: 'Alice Smith', purpose: 'Interview', visiting: 'Engineering' },
      { call_id: 'check-1' },
    );
    expect(result.response).toContain('Alice Smith');
    expect(result.response).toContain('Interview');
    expect(result.response).toContain('TechCo');
    expect(onVisitorCheckIn).toHaveBeenCalledTimes(1);
    expect(onVisitorCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        visitor_name: 'Alice Smith',
        purpose: 'Interview',
        visiting: 'Engineering',
      }),
    );
  });

  it('optional companyName appears in the greeting when provided', () => {
    const agent = createAgent({ companyName: 'TechCo' });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('TechCo');
  });

  it('throws on missing department fields', () => {
    // @ts-expect-error intentionally invalid (missing number)
    expect(() => new ReceptionistAgent({ departments: [{ name: 'x', description: 'y' }] })).toThrow(/number/);
    // @ts-expect-error intentionally invalid (missing description)
    expect(() => new ReceptionistAgent({ departments: [{ name: 'x', number: '1' }] })).toThrow(/description/);
  });

  it('factory function creates agent', () => {
    const agent = createReceptionistAgent({ departments: baseDepartments });
    expect(agent).toBeInstanceOf(ReceptionistAgent);
    expect(agent.getTool('transfer_call')).toBeDefined();
  });
});
