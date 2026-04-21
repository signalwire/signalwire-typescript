/**
 * InfoGathererAgent - Prefab agent for collecting answers to a series of
 * questions.
 *
 * Ported from the Python SDK `signalwire.prefabs.info_gatherer.InfoGathererAgent`.
 * Supports both static (questions provided at init) and dynamic (questions
 * determined by a callback function per request) configuration modes.
 */

import { AgentBase } from '../AgentBase.js';
import { FunctionResult } from '../FunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

/** A single question in the information-gathering flow. */
export interface InfoGathererQuestion {
  /** Identifier used as the key when storing the caller's answer. */
  key_name: string;
  /** The question text to ask the caller. */
  question_text: string;
  /** When true, the agent insists the caller confirms before submitting. */
  confirm?: boolean;
}

/**
 * Callback invoked on each incoming SWML request to produce the list of
 * questions for that request. Mirrors Python's `set_question_callback`.
 * @returns a list of questions (may be async).
 */
export type InfoGathererQuestionCallback = (
  queryParams: Record<string, string>,
  bodyParams: Record<string, unknown>,
  headers: Record<string, string>,
) => InfoGathererQuestion[] | Promise<InfoGathererQuestion[]>;

/** Configuration for the InfoGathererAgent. */
export interface InfoGathererConfig {
  /**
   * Optional list of questions to ask. When omitted, the agent runs in
   * dynamic mode and resolves questions via the callback registered with
   * `setQuestionCallback()` (or via `questionCallback` below).
   */
  questions?: InfoGathererQuestion[];
  /**
   * Convenience alternative to calling `setQuestionCallback()` after
   * construction. Only consulted when `questions` is not provided.
   */
  questionCallback?: InfoGathererQuestionCallback;
  /** Agent display name (defaults to `"info_gatherer"`). */
  name?: string;
  /** HTTP route for this agent (defaults to `"/info_gatherer"`). */
  route?: string;
  /** Additional AgentBase options forwarded to super(). */
  agentOptions?: Partial<AgentOptions>;
}

// ── Agent ───────────────────────────────────────────────────────────────────

/** Fallback questions used in dynamic mode when no callback is registered or the callback throws. */
const FALLBACK_QUESTIONS: InfoGathererQuestion[] = [
  { key_name: 'name', question_text: 'What is your name?' },
  { key_name: 'message', question_text: 'How can I help you today?' },
];

/** Prefab agent that gathers caller information one question at a time. */
export class InfoGathererAgent extends AgentBase {
  private staticQuestions: InfoGathererQuestion[] | null;
  private questionCallback: InfoGathererQuestionCallback | null = null;

  /**
   * Create an InfoGathererAgent.
   * @param config - Either `questions` (static mode) or leave omitted and use
   *                 `questionCallback` / `setQuestionCallback()` (dynamic mode).
   */
  constructor(config: InfoGathererConfig = {}) {
    const agentName = config.name ?? 'info_gatherer';
    super({
      name: agentName,
      route: config.route ?? '/info_gatherer',
      usePom: true,
      ...config.agentOptions,
    });

    if (config.questions !== undefined) {
      InfoGathererAgent.validateQuestions(config.questions);
      this.staticQuestions = config.questions;
      this.setGlobalData({
        questions: config.questions,
        question_index: 0,
        answers: [],
      });
      this.buildPrompt('static');
    } else {
      this.staticQuestions = null;
      this.buildPrompt('dynamic');
    }

    if (config.questionCallback) {
      this.questionCallback = config.questionCallback;
    }

    // AI behavior parameters (mirrors Python _configure_agent_settings)
    this.setParams({
      end_of_speech_timeout: 800,
      speech_event_timeout: 1000,
    });

    // Register tools after all fields are initialized
    this.defineTools();
  }

  /**
   * Register a callback for dynamic question configuration. The callback is
   * invoked on each incoming SWML request with the query params, body, and
   * headers, and must return the list of questions to ask on that call.
   * Mirrors Python `set_question_callback`.
   */
  setQuestionCallback(callback: InfoGathererQuestionCallback): this {
    this.questionCallback = callback;
    return this;
  }

  private static validateQuestions(questions: unknown): asserts questions is InfoGathererQuestion[] {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('At least one question is required');
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i] as Record<string, unknown>;
      if (!q || typeof q !== 'object') {
        throw new Error(`Question ${i + 1} must be an object`);
      }
      if (typeof q['key_name'] !== 'string' || !q['key_name']) {
        throw new Error(`Question ${i + 1} is missing 'key_name' field`);
      }
      if (typeof q['question_text'] !== 'string' || !q['question_text']) {
        throw new Error(`Question ${i + 1} is missing 'question_text' field`);
      }
    }
  }

  private buildPrompt(mode: 'static' | 'dynamic'): void {
    const body =
      mode === 'dynamic'
        ? 'Your role is to gather information by asking questions. Begin by asking the user if they are ready to answer some questions. If they confirm they are ready, call the start_questions function to begin the process.'
        : 'Your role is to get answers to a series of questions. Begin by asking the user if they are ready to answer some questions. If they confirm they are ready, call the start_questions function to begin the process.';
    this.promptAddSection('Objective', { body });
  }

  /**
   * Generate the instruction text for asking a question. Mirrors Python's
   * `_generate_question_instruction`.
   */
  private generateQuestionInstruction(
    questionText: string,
    needsConfirmation: boolean,
    isFirstQuestion = false,
  ): string {
    let instruction = isFirstQuestion
      ? `Ask the user to answer the following question: ${questionText}\n\n`
      : `Previous Answer recorded. Now ask the user to answer the following question: ${questionText}\n\n`;

    instruction +=
      'Make sure the answer fits the scope and context of the question before submitting it. ';

    if (needsConfirmation) {
      instruction +=
        'Insist that the user confirms the answer as many times as needed until they say it is correct.';
    } else {
      instruction += "You don't need the user to confirm the answer to this question.";
    }

    return instruction;
  }

  // ── Lifecycle: onSwmlRequest (dynamic mode hook) ──────────────────────

  /**
   * Handle dynamic configuration using the registered callback. Returns the
   * per-request global_data payload which AgentBase merges into the SWML
   * response. Mirrors Python's `on_swml_request` return-dict contract.
   */
  override async onSwmlRequest(
    rawData: Record<string, unknown>,
  ): Promise<Record<string, unknown> | void> {
    // Static mode: nothing to do.
    if (this.staticQuestions !== null) return;

    // Dynamic mode with no callback: return fallback questions as global_data.
    if (!this.questionCallback) {
      return {
        global_data: {
          questions: FALLBACK_QUESTIONS,
          question_index: 0,
          answers: [],
        },
      };
    }

    // Build callback inputs from the incoming raw data.
    const queryParams = this.extractRecord(rawData['query_params']);
    const headers = this.extractRecord(rawData['headers']);
    const bodyParams = rawData;

    try {
      const questions = await this.questionCallback(queryParams, bodyParams, headers);
      InfoGathererAgent.validateQuestions(questions);
      return {
        global_data: {
          questions,
          question_index: 0,
          answers: [],
        },
      };
    } catch (err) {
      this.log.error(`Error in question callback: ${String(err)}`);
      return {
        global_data: {
          questions: FALLBACK_QUESTIONS,
          question_index: 0,
          answers: [],
        },
      };
    }
  }

  private extractRecord(value: unknown): Record<string, string> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === 'string') result[k] = v;
        else if (v !== null && v !== undefined) result[k] = String(v);
      }
      return result;
    }
    return {};
  }

  // ── Tool registration ─────────────────────────────────────────────────

  /** Register the `start_questions` and `submit_answer` SWAIG tools. */
  protected override defineTools(): void {
    // Tool: start_questions
    this.defineTool({
      name: 'start_questions',
      description: 'Start the question sequence with the first question',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: (_args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const globalData = (rawData['global_data'] as Record<string, unknown>) ?? {};
        const questions = (globalData['questions'] as InfoGathererQuestion[]) ?? [];
        const questionIndex = (globalData['question_index'] as number) ?? 0;

        if (!questions || questionIndex >= questions.length) {
          return new FunctionResult("I don't have any questions to ask.");
        }

        const current = questions[questionIndex];
        const instruction = this.generateQuestionInstruction(
          current.question_text ?? '',
          current.confirm === true,
          true,
        );

        const result = new FunctionResult(instruction);
        result.replaceInHistory('Welcome! Let me ask you a few questions.');
        return result;
      },
    });

    // Tool: submit_answer
    this.defineTool({
      name: 'submit_answer',
      description: 'Submit an answer to the current question and move to the next one',
      parameters: {
        type: 'object',
        properties: {
          answer: {
            type: 'string',
            description: "The user's answer to the current question",
          },
        },
      },
      handler: (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const answer = (args['answer'] as string) ?? '';

        const globalData = (rawData['global_data'] as Record<string, unknown>) ?? {};
        const questions = (globalData['questions'] as InfoGathererQuestion[]) ?? [];
        const questionIndex = (globalData['question_index'] as number) ?? 0;
        const priorAnswers =
          (globalData['answers'] as Array<{ key_name: string; answer: string }>) ?? [];

        if (questionIndex >= questions.length) {
          return new FunctionResult('All questions have already been answered.');
        }

        const current = questions[questionIndex];
        const keyName = current.key_name ?? '';
        const newAnswers = [...priorAnswers, { key_name: keyName, answer }];
        const newIndex = questionIndex + 1;

        if (newIndex < questions.length) {
          const next = questions[newIndex];
          const instruction = this.generateQuestionInstruction(
            next.question_text ?? '',
            next.confirm === true,
            false,
          );
          const result = new FunctionResult(instruction);
          result.replaceInHistory();
          result.updateGlobalData({ answers: newAnswers, question_index: newIndex });
          return result;
        }

        const result = new FunctionResult(
          "Thank you! All questions have been answered. You can now summarize the information collected or ask if there's anything else the user would like to discuss.",
        );
        result.replaceInHistory();
        result.updateGlobalData({ answers: newAnswers, question_index: newIndex });
        return result;
      },
    });
  }
}

// ── Factory function ────────────────────────────────────────────────────────

/**
 * Factory function that creates and returns a new InfoGathererAgent.
 * @param config - Configuration for the info gatherer agent.
 * @returns A configured InfoGathererAgent instance.
 */
export function createInfoGathererAgent(config: InfoGathererConfig = {}): InfoGathererAgent {
  return new InfoGathererAgent(config);
}

export default InfoGathererAgent;
