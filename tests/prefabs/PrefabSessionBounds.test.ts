import { SurveyAgent } from '../../src/prefabs/SurveyAgent.js';
import { ReceptionistAgent } from '../../src/prefabs/ReceptionistAgent.js';
import type { SessionManager } from '../../src/SessionManager.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => {
  suppressAllLogs(true);
});

afterEach(() => {
  vi.useRealTimers();
});

const AUTH = `Basic ${Buffer.from('u:p').toString('base64')}`;
const HOUR = 60 * 60 * 1000;

/** The number of calls a prefab holds per-call state for. */
function sessionCount(agent: object): number {
  return (agent as { sessions: { size: number } }).sessions.size;
}

/** Deliver a call's summary to the agent over HTTP, as SignalWire does at call end. */
async function postSummary(agent: SurveyAgent | ReceptionistAgent, route: string, callId: string) {
  const sm = (agent as unknown as { sessionManager: SessionManager }).sessionManager;
  const token = encodeURIComponent(sm.createToolToken('post_prompt', callId));
  const res = await agent.getApp().request(`${route}/post_prompt?__token=${token}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id: callId, post_prompt_data: { raw: 'done' } }),
  });
  expect(res.status).toBe(200);
}

function surveyAgent(): SurveyAgent {
  return new SurveyAgent({
    surveyName: 'CSAT',
    questions: [
      { id: 'q1', text: 'Rate us', type: 'rating', scale: 5 },
      { id: 'q2', text: 'Recommend us?', type: 'yes_no' },
    ],
    agentOptions: { basicAuth: ['u', 'p'] },
  });
}

function receptionistAgent(): ReceptionistAgent {
  return new ReceptionistAgent({
    departments: [{ name: 'sales', description: 'Sales', number: '+15551112222' }],
    checkInEnabled: true,
    agentOptions: { basicAuth: ['u', 'p'] },
  });
}

describe('SurveyAgent per-call state is bounded', () => {
  it("drops a call's state when its summary arrives", async () => {
    const agent = surveyAgent();
    await agent.getTool('answer_question')!.execute(
      { question_id: 'q1', answer: '4' },
      {
        call_id: 'call-a',
      },
    );
    expect(sessionCount(agent)).toBe(1);

    await postSummary(agent, '/survey', 'call-a');
    expect(sessionCount(agent)).toBe(0);
  });

  it('drops state for a call idle longer than the age limit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const agent = surveyAgent();
    await agent.getTool('answer_question')!.execute(
      { question_id: 'q1', answer: '4' },
      {
        call_id: 'call-old',
      },
    );

    vi.setSystemTime(Date.now() + 2 * HOUR);
    await agent.getTool('get_current_question')!.execute({}, { call_id: 'call-new' });
    expect(sessionCount(agent)).toBe(1);
  });

  it('keeps state for a call that is still active', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const agent = surveyAgent();
    const answer = agent.getTool('answer_question')!;
    await answer.execute({ question_id: 'q1', answer: '4' }, { call_id: 'call-live' });

    vi.setSystemTime(Date.now() + 30 * 60 * 1000);
    await agent.getTool('get_current_question')!.execute({}, { call_id: 'call-live' });
    vi.setSystemTime(Date.now() + 45 * 60 * 1000);
    const progress = await agent.getTool('get_survey_progress')!.execute(
      {},
      {
        call_id: 'call-live',
      },
    );
    expect(progress.response).toContain('q1: 4');
  });

  it('holds at most the entry limit however many calls arrive', async () => {
    const agent = surveyAgent();
    const tool = agent.getTool('get_current_question')!;
    for (let i = 0; i < 10_050; i++) {
      await tool.execute({}, { call_id: `call-${i}` });
    }
    expect(sessionCount(agent)).toBe(10_000);
  });
});

describe('ReceptionistAgent per-call state is bounded', () => {
  const visitor = { visitor_name: 'Ann', purpose: 'Meeting', visiting: 'Bob' };

  it("drops a call's state when its summary arrives", async () => {
    const agent = receptionistAgent();
    await agent.getTool('check_in_visitor')!.execute(visitor, { call_id: 'call-a' });
    expect(sessionCount(agent)).toBe(1);

    await postSummary(agent, '/receptionist', 'call-a');
    expect(sessionCount(agent)).toBe(0);
  });

  it('drops state for a call idle longer than the age limit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const agent = receptionistAgent();
    await agent.getTool('check_in_visitor')!.execute(visitor, { call_id: 'call-old' });

    vi.setSystemTime(Date.now() + 2 * HOUR);
    await agent.getTool('check_in_visitor')!.execute(visitor, { call_id: 'call-new' });
    expect(sessionCount(agent)).toBe(1);
  });
});
