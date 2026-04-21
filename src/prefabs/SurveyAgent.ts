/**
 * SurveyAgent - A prefab agent that conducts surveys with branching logic,
 * scoring, and conditional question flow.
 *
 * Ported from the Python SDK `signalwire.prefabs.survey.SurveyAgent`. Keeps
 * TS-specific enhancements (per-call session state, branching via
 * `nextQuestion`, answer scoring via `points`) alongside the Python surface.
 */

import { AgentBase } from '../AgentBase.js';
import { FunctionResult } from '../FunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

export interface SurveyQuestion {
  /** Unique question identifier. */
  id: string;
  /** The question text to ask the caller. */
  text: string;
  /** Question type determines validation and display. */
  type: 'multiple_choice' | 'open_ended' | 'rating' | 'yes_no';
  /** Options for multiple_choice questions. */
  options?: string[];
  /**
   * For `rating` questions, the upper bound of the scale (1..scale).
   * Defaults to 5 (matching the Python prefab) when unspecified.
   */
  scale?: number;
  /**
   * Whether the question requires an answer. Defaults to `true`.
   * Mirrors the Python `required` flag on each question dict.
   */
  required?: boolean;
  /**
   * Next question ID after this one.
   * - string: always go to that question
   * - Record<string, string>: map from answer value to next question ID
   * - undefined: proceed to next question in array order
   */
  nextQuestion?: string | Record<string, string>;
  /**
   * Points awarded for answers.
   * - number: fixed points for any answer
   * - Record<string, number>: points per specific answer value
   */
  points?: number | Record<string, number>;
}

export interface SurveyConfig {
  /** Human-readable survey name, used in prompts and global data. */
  surveyName: string;
  /** Ordered list of survey questions. */
  questions: SurveyQuestion[];
  /** Opening message before the first question (matches Python `introduction`). */
  introduction?: string;
  /** Message after the survey is complete (matches Python `conclusion`). */
  conclusion?: string;
  /** Brand or company name the agent represents (matches Python `brand_name`). */
  brandName?: string;
  /** Maximum number of times to retry invalid answers. Defaults to 2. */
  maxRetries?: number;
  /** Agent display name (defaults to `"survey"`). */
  name?: string;
  /** HTTP route for this agent (defaults to `"/survey"`). */
  route?: string;
  /** Callback fired when the survey is finished. */
  onComplete?: (responses: Record<string, unknown>, score: number) => void | Promise<void>;
  /** Additional AgentBase options forwarded to super(). */
  agentOptions?: Partial<AgentOptions>;
}

// ── Per-call session state ──────────────────────────────────────────────────

interface SurveySession {
  currentQuestionIndex: number;
  currentQuestionId: string;
  responses: Record<string, unknown>;
  score: number;
  completed: boolean;
}

// ── Agent ───────────────────────────────────────────────────────────────────

/**
 * Prefab agent that conducts surveys with branching logic, answer scoring, and conditional question flow.
 *
 * Each survey question declares its response type (rating, yes/no, open text, etc.), an optional
 * set of conditional follow-ups, and a scoring map. The agent walks the question tree, tallies a
 * total score, and exposes the full response map at call end via `onSummary()`.
 *
 * @example Customer satisfaction survey
 * ```ts
 * import { SurveyAgent } from '@signalwire/sdk';
 *
 * const agent = new SurveyAgent({
 *   surveyName: 'CSAT',
 *   brandName: 'Acme Co',
 *   questions: [
 *     { id: 'q1', text: 'How satisfied were you with our service?', type: 'rating', scale: 5 },
 *     { id: 'q2', text: 'Would you recommend us to a friend?', type: 'yesno' },
 *     { id: 'q3', text: 'Anything else you want to share?', type: 'open' },
 *   ],
 * });
 *
 * await agent.serve({ port: 3000 });
 * ```
 */
export class SurveyAgent extends AgentBase {
  /** Human-readable survey name. */
  public surveyName: string;
  /** The configured survey questions (public, matching Python). */
  public questions: SurveyQuestion[];
  /** Brand/company name used in prompts. */
  public brandName: string;
  /** Maximum number of times to retry invalid answers. */
  public maxRetries: number;
  /** Opening message before the first question. */
  public introduction: string;
  /** Closing message shown when the survey completes. */
  public conclusion: string;

  private questionMap: Map<string, SurveyQuestion>;
  private onCompleteCallback?: (responses: Record<string, unknown>, score: number) => void | Promise<void>;
  private sessions: Map<string, SurveySession> = new Map();

  /**
   * Create a SurveyAgent with the specified questions and callbacks.
   * @param config - Configuration including questions, messages, and completion callback.
   */
  constructor(config: SurveyConfig) {
    const agentName = config.name ?? 'survey';
    super({
      name: agentName,
      route: config.route ?? '/survey',
      usePom: true,
      ...config.agentOptions,
    });

    // Store configuration (matches Python __init__)
    this.surveyName = config.surveyName;
    this.questions = config.questions;
    this.brandName = config.brandName ?? 'Our Company';
    this.maxRetries = config.maxRetries ?? 2;
    this.introduction =
      config.introduction ?? `Welcome to our ${config.surveyName}. We appreciate your participation.`;
    this.conclusion =
      config.conclusion ?? 'Thank you for completing our survey. Your feedback is valuable to us.';
    this.onCompleteCallback = config.onComplete;

    // Validate and default questions (mirrors Python _validate_questions)
    this.validateQuestions();

    this.questionMap = new Map(this.questions.map((q) => [q.id, q]));

    this.setupSurveyAgent();

    // Register tools after all fields are initialized
    this.defineTools();
  }

  // ── Question validation (mirrors Python _validate_questions) ──────────

  private validateQuestions(): void {
    const validTypes = new Set(['rating', 'multiple_choice', 'yes_no', 'open_ended']);

    for (let i = 0; i < this.questions.length; i++) {
      const q = this.questions[i];
      if (!q.id) q.id = `question_${i + 1}`;
      if (!q.text) throw new Error(`Question ${i + 1} is missing the 'text' field`);
      if (!q.type || !validTypes.has(q.type)) {
        throw new Error(
          `Question ${i + 1} has an invalid type. Must be one of: ${Array.from(validTypes).join(', ')}`,
        );
      }
      if (q.required === undefined) q.required = true;
      if (q.type === 'multiple_choice' && (!q.options || q.options.length === 0)) {
        throw new Error(`Multiple choice question '${q.id}' must have options`);
      }
      if (q.type === 'rating' && q.scale === undefined) q.scale = 5;
    }
  }

  // ── Prompt + settings (mirrors Python _setup_survey_agent) ────────────

  private setupSurveyAgent(): void {
    // Personality
    this.promptAddSection('Personality', {
      body: `You are a friendly and professional survey agent representing ${this.brandName}.`,
    });

    // Goal
    this.promptAddSection('Goal', {
      body: `Conduct the '${this.surveyName}' survey by asking questions and collecting responses.`,
    });

    // Instructions
    const instructions = [
      'Guide the user through each survey question in sequence.',
      'Ask only one question at a time and wait for a response.',
      'For rating questions, explain the scale (e.g., 1-5, where 5 is best).',
      'For multiple choice questions, list all the options.',
      `If a response is invalid, explain and retry up to ${this.maxRetries} times.`,
      'Be conversational but stay focused on collecting the survey data.',
      'After all questions are answered, thank the user for their participation.',
    ];
    this.promptAddSection('Instructions', { bullets: instructions });

    // Introduction
    this.promptAddSection('Introduction', {
      body: `Begin with this introduction: ${this.introduction}`,
    });

    // Questions subsection
    const questionsSubsections = this.questions.map((q) => {
      let description = `ID: ${q.id}\nType: ${q.type}\nRequired: ${q.required}`;
      if (q.type === 'rating') description += `\nScale: 1-${q.scale}`;
      if (q.type === 'multiple_choice' && q.options) {
        description += `\nOptions: ${q.options.join(', ')}`;
      }
      return { title: q.text, body: description };
    });
    this.promptAddSection('Survey Questions', {
      body: 'Ask these questions in order:',
      subsections: questionsSubsections,
    });

    // Conclusion
    this.promptAddSection('Conclusion', {
      body: `End with this conclusion: ${this.conclusion}`,
    });

    // Post-prompt summary template
    this.setPostPrompt(`
        Return a JSON summary of the survey responses:
        {
            "survey_name": "SURVEY_NAME",
            "responses": {
                "QUESTION_ID_1": "RESPONSE_1",
                "QUESTION_ID_2": "RESPONSE_2",
                ...
            },
            "completion_status": "complete/incomplete",
            "timestamp": "CURRENT_TIMESTAMP"
        }
        `);

    // Hints: rating numbers, MC options, yes/no, plus the names
    const typeTerms: string[] = [];
    for (const q of this.questions) {
      if (q.type === 'rating') {
        const scale = q.scale ?? 5;
        for (let i = 1; i <= scale; i++) typeTerms.push(String(i));
      } else if (q.type === 'multiple_choice' && q.options) {
        typeTerms.push(...q.options);
      } else if (q.type === 'yes_no') {
        typeTerms.push('yes', 'no');
      }
    }
    this.addHints([this.surveyName, this.brandName, ...typeTerms]);

    // AI behavior parameters (includes non-bargeable static greeting = introduction)
    this.setParams({
      wait_for_user: false,
      end_of_speech_timeout: 1500,
      ai_volume: 5,
      static_greeting: this.introduction,
      static_greeting_no_barge: true,
    });

    // Global data
    this.setGlobalData({
      survey_name: this.surveyName,
      brand_name: this.brandName,
      questions: this.questions,
      max_retries: this.maxRetries,
    });

    // Native functions
    this.setNativeFunctions(['check_time']);
  }

  // ── Session helpers ───────────────────────────────────────────────────

  private getSession(rawData: Record<string, unknown>): SurveySession {
    const callId = (rawData['call_id'] as string) ?? 'default';
    let session = this.sessions.get(callId);
    if (!session) {
      const firstQuestion = this.questions[0];
      session = {
        currentQuestionIndex: 0,
        currentQuestionId: firstQuestion ? firstQuestion.id : '',
        responses: {},
        score: 0,
        completed: false,
      };
      this.sessions.set(callId, session);
    }
    return session;
  }

  private resolveNextQuestion(question: SurveyQuestion, answer: string): string | null {
    if (!question.nextQuestion) {
      const idx = this.questions.findIndex((q) => q.id === question.id);
      if (idx >= 0 && idx < this.questions.length - 1) {
        return this.questions[idx + 1].id;
      }
      return null;
    }

    if (typeof question.nextQuestion === 'string') {
      return question.nextQuestion;
    }

    const normalizedAnswer = answer.toLowerCase().trim();
    for (const [key, nextId] of Object.entries(question.nextQuestion)) {
      if (key.toLowerCase().trim() === normalizedAnswer) {
        return nextId;
      }
    }

    if ('_default' in question.nextQuestion) {
      return question.nextQuestion['_default'];
    }

    const idx = this.questions.findIndex((q) => q.id === question.id);
    if (idx >= 0 && idx < this.questions.length - 1) {
      return this.questions[idx + 1].id;
    }
    return null;
  }

  private calculatePoints(question: SurveyQuestion, answer: string): number {
    if (question.points === undefined) return 0;
    if (typeof question.points === 'number') return question.points;

    const normalizedAnswer = answer.toLowerCase().trim();
    for (const [key, pts] of Object.entries(question.points)) {
      if (key.toLowerCase().trim() === normalizedAnswer) {
        return pts;
      }
    }
    return 0;
  }

  /**
   * Validate an answer against the question's type and constraints.
   * Mirrors the Python `validate_response` tool body.
   * @returns error message string if invalid, or `null` if valid.
   */
  private validateAnswer(question: SurveyQuestion, answer: string): string | null {
    switch (question.type) {
      case 'multiple_choice': {
        if (!question.options || question.options.length === 0) return null;
        const normalized = answer.toLowerCase().trim();
        const match = question.options.find((o) => o.toLowerCase().trim() === normalized);
        if (!match) {
          return `Invalid choice. Please select one of: ${question.options.join(', ')}.`;
        }
        return null;
      }
      case 'rating': {
        const scale = question.scale ?? 5;
        const trimmed = answer.trim();
        const num = parseInt(trimmed, 10);
        if (!/^-?\d+$/.test(trimmed) || isNaN(num) || num < 1 || num > scale) {
          return `Invalid rating. Please provide a number between 1 and ${scale}.`;
        }
        return null;
      }
      case 'yes_no': {
        const normalized = answer.toLowerCase().trim();
        // Python reference accepts only 'yes', 'no', 'y', 'n' (survey.py:260).
        if (!['yes', 'y', 'no', 'n'].includes(normalized)) {
          return "Please answer with 'yes' or 'no'.";
        }
        return null;
      }
      case 'open_ended': {
        // Python: required open_ended with empty response is invalid.
        if (!answer.trim() && question.required !== false) {
          return 'A response is required for this question.';
        }
        return null;
      }
      default:
        return null;
    }
  }

  private normalizeAnswer(question: SurveyQuestion, answer: string): string {
    if (question.type === 'yes_no') {
      const normalized = answer.toLowerCase().trim();
      // Mirrors validateAnswer's accepted set (Python: 'yes','y','no','n').
      return ['yes', 'y'].includes(normalized) ? 'yes' : 'no';
    }
    return answer;
  }

  // ── Tool registration ─────────────────────────────────────────────────

  /**
   * Register SWAIG tools:
   *   - Python-parity tools: `validate_response`, `log_response`
   *   - TS-specific session tools: `answer_question`, `get_current_question`, `get_survey_progress`
   */
  protected override defineTools(): void {
    // Tool: validate_response (Python parity)
    this.defineTool({
      name: 'validate_response',
      description: 'Validate if a response meets the requirements for a specific question',
      parameters: {
        type: 'object',
        properties: {
          question_id: {
            type: 'string',
            description: 'The ID of the question',
          },
          response: {
            type: 'string',
            description: "The user's response to validate",
          },
        },
      },
      handler: (args: Record<string, unknown>) => {
        const questionId = (args['question_id'] as string) ?? '';
        const response = (args['response'] as string) ?? '';

        const question = this.questionMap.get(questionId);
        if (!question) {
          return new FunctionResult(`Error: Question with ID '${questionId}' not found.`);
        }

        const error = this.validateAnswer(question, response);
        if (error) return new FunctionResult(error);
        return new FunctionResult(`Response to '${questionId}' is valid.`);
      },
    });

    // Tool: log_response (Python parity — acknowledge recording)
    this.defineTool({
      name: 'log_response',
      description: 'Log a validated response to a survey question',
      parameters: {
        type: 'object',
        properties: {
          question_id: {
            type: 'string',
            description: 'The ID of the question',
          },
          response: {
            type: 'string',
            description: "The user's validated response",
          },
        },
      },
      handler: (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const questionId = (args['question_id'] as string) ?? '';
        const response = (args['response'] as string) ?? '';

        const question = this.questionMap.get(questionId);
        const questionText = question ? question.text : '';

        // Record on the per-call session for observability.
        const session = this.getSession(rawData);
        if (question) {
          session.responses[questionId] = this.normalizeAnswer(question, response);
        }

        return new FunctionResult(
          `Response to '${questionText}' has been recorded.`,
        );
      },
    });

    // Tool: answer_question (TS-specific atomic validate+record+advance)
    this.defineTool({
      name: 'answer_question',
      description: "Record the caller's answer to the current survey question. Validates the answer based on question type and advances to the next question.",
      parameters: {
        type: 'object',
        properties: {
          question_id: {
            type: 'string',
            description: 'The ID of the question being answered.',
          },
          answer: {
            type: 'string',
            description: "The caller's answer to the question.",
          },
        },
        required: ['question_id', 'answer'],
      },
      handler: async (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const questionId = args['question_id'] as string;
        const answer = args['answer'] as string;

        if (!questionId || !answer) {
          return new FunctionResult('Both question_id and answer are required.');
        }

        const question = this.questionMap.get(questionId);
        if (!question) {
          return new FunctionResult(`Unknown question ID "${questionId}".`);
        }

        const session = this.getSession(rawData);

        if (session.completed) {
          return new FunctionResult('The survey has already been completed.');
        }

        const validationError = this.validateAnswer(question, answer);
        if (validationError) {
          return new FunctionResult(validationError);
        }

        const normalizedAnswer = this.normalizeAnswer(question, answer);
        session.responses[questionId] = normalizedAnswer;

        const points = this.calculatePoints(question, normalizedAnswer);
        session.score += points;

        const nextId = this.resolveNextQuestion(question, normalizedAnswer);

        if (!nextId || !this.questionMap.has(nextId)) {
          session.completed = true;
          if (this.onCompleteCallback) {
            try {
              await this.onCompleteCallback({ ...session.responses }, session.score);
            } catch (err) {
              this.log.error(`onComplete callback error: ${err}`);
            }
          }
          const answeredCount = Object.keys(session.responses).length;
          return new FunctionResult(
            `Answer recorded. The survey is now complete! ${answeredCount} questions answered, total score: ${session.score}. ${this.conclusion}`,
          );
        }

        session.currentQuestionId = nextId;
        const nextQ = this.questionMap.get(nextId)!;
        const nextIdx = this.questions.findIndex((q) => q.id === nextId);
        if (nextIdx >= 0) session.currentQuestionIndex = nextIdx;

        let nextInfo = `Answer recorded. Next question [${nextQ.id}]: "${nextQ.text}"`;
        if (nextQ.type === 'multiple_choice' && nextQ.options) {
          nextInfo += ` (Options: ${nextQ.options.join(', ')})`;
        } else if (nextQ.type === 'rating') {
          nextInfo += ` (Rating: 1-${nextQ.scale ?? 5})`;
        } else if (nextQ.type === 'yes_no') {
          nextInfo += ' (Yes/No)';
        }

        return new FunctionResult(nextInfo);
      },
    });

    // Tool: get_current_question
    this.defineTool({
      name: 'get_current_question',
      description: 'Get the current question that should be asked to the caller.',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: (_args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const session = this.getSession(rawData);

        if (session.completed) {
          return new FunctionResult('The survey has been completed. No more questions.');
        }

        const question = this.questionMap.get(session.currentQuestionId);
        if (!question) {
          return new FunctionResult('No current question available.');
        }

        let info = `Current question [${question.id}] (${question.type}): "${question.text}"`;
        if (question.type === 'multiple_choice' && question.options) {
          info += ` Options: ${question.options.join(', ')}`;
        } else if (question.type === 'rating') {
          info += ` (Caller should provide a rating from 1 to ${question.scale ?? 5})`;
        } else if (question.type === 'yes_no') {
          info += ' (Caller should answer yes or no)';
        }

        return new FunctionResult(info);
      },
    });

    // Tool: get_survey_progress
    this.defineTool({
      name: 'get_survey_progress',
      description: 'Get the current progress of the survey, including how many questions have been answered and the current score.',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: (_args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const session = this.getSession(rawData);
        const answeredCount = Object.keys(session.responses).length;
        const totalCount = this.questions.length;
        const percentage = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

        let progress = `Survey progress: ${answeredCount}/${totalCount} questions answered (${percentage}%). Current score: ${session.score}.`;

        if (session.completed) {
          progress += ' Survey is COMPLETE.';
        } else {
          progress += ` Current question: ${session.currentQuestionId}.`;
        }

        if (answeredCount > 0) {
          const answered = Object.entries(session.responses)
            .map(([qId, ans]) => `${qId}: ${ans}`)
            .join('; ');
          progress += ` Answers so far: ${answered}`;
        }

        return new FunctionResult(progress);
      },
    });
  }

  // ── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Process the survey results summary returned at the end of a call.
   * Mirrors Python `on_summary`: structured (dict-like) summaries are logged
   * as JSON; unstructured summaries are logged verbatim.
   *
   * The parameter type widens the base `AgentBase.onSummary` signature to
   * accept string payloads as well, matching Python's `isinstance(summary, dict)`
   * branch even though the current framework only surfaces object summaries.
   */
  override onSummary(
    summary: Record<string, unknown> | string | null,
    _rawData: Record<string, unknown>,
  ): void | Promise<void> {
    if (summary) {
      try {
        if (typeof summary === 'string') {
          // eslint-disable-next-line no-console
          console.log(`Survey summary (unstructured): ${summary}`);
        } else {
          // eslint-disable-next-line no-console
          console.log(`Survey completed: ${JSON.stringify(summary, null, 2)}`);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(`Error processing survey summary: ${String(err)}`);
      }
    }
  }
}

// ── Factory function ────────────────────────────────────────────────────────

/**
 * Factory function that creates and returns a new SurveyAgent.
 * @param config - Configuration for the survey agent.
 * @returns A configured SurveyAgent instance.
 */
export function createSurveyAgent(config: SurveyConfig): SurveyAgent {
  return new SurveyAgent(config);
}

export default SurveyAgent;
