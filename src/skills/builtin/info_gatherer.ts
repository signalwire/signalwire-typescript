/**
 * Info Gatherer Skill - Guides an AI agent through a sequence of questions,
 * collecting and storing answers in namespaced SWAIG `global_data`.
 *
 * Tier 2 built-in skill with no external dependencies. Direct port of
 * Python's `signalwire.skills.info_gatherer.skill.InfoGathererSkill`
 * (core/skill_base.py usage; skill.py:16-312). Supports multiple instances
 * with different `prefix` values so several question sets can coexist on a
 * single agent (e.g. "intake" and "medical" questionnaires running side by
 * side).
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { getLogger } from '../../Logger.js';

const log = getLogger('InfoGathererSkill');

const DEFAULT_COMPLETION_MESSAGE =
  "Thank you! All questions have been answered. You can now summarize the " +
  "information collected or ask if there's anything else the user would like " +
  'to discuss.';

/** Definition of a single question in the sequential question flow. */
interface QuestionDefinition {
  /** Key name used to store the answer. */
  key_name: string;
  /** Question text read to the user. */
  question_text: string;
  /** When true, the agent must confirm the answer with the user before submitting. */
  confirm?: boolean;
  /** Optional extra instruction appended to the question prompt. */
  prompt_add?: string;
}

/**
 * Collects answers to a configurable list of questions, one at a time.
 *
 * Mirrors Python `InfoGathererSkill` exactly: the same required
 * `questions` config, the same `prefix` / `completion_message` options,
 * the same two tools (`start_questions`, `submit_answer`), and the same
 * state shape in `global_data`.
 *
 * @example
 * ```ts
 * agent.addSkill('info_gatherer', {
 *   questions: [
 *     { key_name: 'name', question_text: 'What is your name?' },
 *     { key_name: 'email', question_text: 'Your email?', confirm: true },
 *   ],
 * });
 * ```
 */
export class InfoGathererSkill extends SkillBase {
  // Python ground truth: skills/info_gatherer/skill.py:26-31
  static override SKILL_NAME = 'info_gatherer';
  static override SKILL_DESCRIPTION = 'Gather answers to a configurable list of questions';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_PACKAGES: readonly string[] = [];
  static override REQUIRED_ENV_VARS: readonly string[] = [];
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  /** List of question definitions populated in `setup()`. */
  private questions: QuestionDefinition[] = [];
  /** Derived tool name for the start tool (prefix-aware). */
  private startToolName: string = 'start_questions';
  /** Derived tool name for the submit tool (prefix-aware). */
  private submitToolName: string = 'submit_answer';
  /** Message returned once all questions are answered. */
  private completionMessage: string = DEFAULT_COMPLETION_MESSAGE;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      questions: {
        type: 'array',
        description:
          "List of question objects. Each must have 'key_name' (str) and 'question_text' (str). Optional 'confirm' (bool) asks the agent to confirm the answer before proceeding.",
        required: true,
        items: {
          type: 'object',
          properties: {
            key_name: { type: 'string' },
            question_text: { type: 'string' },
            confirm: { type: 'boolean' },
            prompt_add: { type: 'string' },
          },
        },
      },
      prefix: {
        type: 'string',
        description:
          "Optional prefix for tool names and namespace. When set, tools are named <prefix>_start_questions / <prefix>_submit_answer and state is stored under 'skill:<prefix>' in global_data.",
        required: false,
      },
      completion_message: {
        type: 'string',
        description: 'Message returned after all questions are answered',
        default: DEFAULT_COMPLETION_MESSAGE,
        required: false,
      },
    };
  }

  /**
   * Instance key for the SkillManager. When `prefix` is configured, returns
   * `info_gatherer_<prefix>` to support multi-instance use. Matches Python's
   * `get_instance_key()` (skill.py:81-85).
   */
  override getInstanceKey(): string {
    const prefix = this.getConfig<string>('prefix', '');
    return prefix ? `info_gatherer_${prefix}` : 'info_gatherer';
  }

  /**
   * Validate the `questions` config, derive tool names (with optional prefix),
   * and cache the completion message.
   *
   * Python parity: skill.py:91-121. Returns `false` (logging an error) when
   * `questions` is missing or fails validation; setup must produce a
   * functional skill or fail closed.
   */
  override async setup(): Promise<boolean> {
    const questions = this.getConfig<unknown>('questions', undefined);
    if (questions === undefined || questions === null) {
      log.error("'questions' parameter is required");
      return false;
    }

    try {
      InfoGathererSkill._validateQuestions(questions);
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      return false;
    }

    this.questions = questions as QuestionDefinition[];

    const prefix = this.getConfig<string>('prefix', '');
    if (prefix) {
      this.startToolName = `${prefix}_start_questions`;
      this.submitToolName = `${prefix}_submit_answer`;
    } else {
      this.startToolName = 'start_questions';
      this.submitToolName = 'submit_answer';
    }

    this.completionMessage = this.getConfig<string>(
      'completion_message',
      DEFAULT_COMPLETION_MESSAGE,
    );
    return true;
  }

  /**
   * Seed SWAIG `global_data` with the initial question state under this
   * skill's namespace. Mirrors Python `get_global_data()` (skill.py:127-135).
   *
   * Defensive no-op when the skill was not successfully set up (empty
   * `questions`). Python relies on the SkillManager to skip unloaded skills;
   * TS adds this guard so `getGlobalData()` called without a successful
   * `setup()` returns `{}` instead of a malformed state payload.
   */
  override getGlobalData(): Record<string, unknown> {
    if (this.questions.length === 0) {
      return {};
    }
    return {
      [this.getSkillNamespace()]: {
        questions: this.questions,
        question_index: 0,
        answers: [],
      },
    };
  }

  /**
   * Register the two sequential-flow tools. Mirrors Python
   * `register_tools()` (skill.py:162-184). Returns an empty array when
   * `setup()` did not complete (no questions) so the skill never exposes
   * half-initialized tools.
   */
  override getTools(): SkillToolDefinition[] {
    if (this.questions.length === 0) {
      return [];
    }
    return [
      {
        name: this.startToolName,
        description: 'Start the question sequence with the first question',
        parameters: {},
        handler: (args, rawData) => this._handleStartQuestions(args, rawData),
      },
      {
        name: this.submitToolName,
        description:
          'Submit an answer to the current question and move to the next one',
        parameters: {
          answer: {
            type: 'string',
            description: "The user's answer to the current question",
          },
          confirmed_by_user: {
            type: 'boolean',
            description:
              "Only set to true when the user has explicitly said 'yes' or confirmed the answer is correct in their own words in their most recent response. Never set this to true on your own.",
          },
        },
        handler: (args, rawData) => this._handleSubmitAnswer(args, rawData),
      },
    ];
  }

  /**
   * Handle the `start_questions` tool: read state from global_data and return
   * an instruction for the first question. Mirrors Python
   * `_handle_start_questions` (skill.py:190-208).
   */
  private _handleStartQuestions(
    _args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ): FunctionResult {
    const state = this.getSkillData(rawData);
    const questions = (state['questions'] as QuestionDefinition[] | undefined) ?? [];
    const questionIndex = (state['question_index'] as number | undefined) ?? 0;

    if (questions.length === 0 || questionIndex >= questions.length) {
      return new FunctionResult("I don't have any questions to ask.");
    }

    const current = questions[questionIndex];
    const instruction = InfoGathererSkill._generateQuestionInstruction(
      current.question_text ?? '',
      current.confirm ?? false,
      true,
      current.prompt_add ?? '',
      this.submitToolName,
      questionIndex + 1,
      questions.length,
    );
    return new FunctionResult(instruction);
  }

  /**
   * Handle the `submit_answer` tool: validate confirmation, record the answer,
   * advance the index, and either return the next question or the completion
   * message (disabling both tools on completion). Mirrors Python
   * `_handle_submit_answer` (skill.py:210-262).
   */
  private _handleSubmitAnswer(
    args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ): FunctionResult {
    const answer = (args['answer'] as string | undefined) ?? '';
    const confirmed = (args['confirmed_by_user'] as boolean | undefined) ?? false;
    const state = this.getSkillData(rawData);

    const questions = (state['questions'] as QuestionDefinition[] | undefined) ?? [];
    const questionIndex = (state['question_index'] as number | undefined) ?? 0;
    const answers = (state['answers'] as Array<{ key_name: string; answer: string }> | undefined) ?? [];

    if (questionIndex >= questions.length) {
      return new FunctionResult('All questions have already been answered.');
    }

    const current = questions[questionIndex];
    const keyName = current.key_name ?? '';

    // Enforce confirmation: reject the submission if the question requires
    // confirmation but the confirmed flag was not set to true.
    if ((current.confirm ?? false) && !confirmed) {
      return new FunctionResult(
        `Before submitting, you must read the answer "${answer}" back to the user ` +
          `and ask them to confirm it is correct. Then call this function again with ` +
          `confirmed set to true. If the user says it is wrong, ask the question again.`,
      );
    }

    const newAnswers = [...answers, { key_name: keyName, answer }];
    const newIndex = questionIndex + 1;

    let result: FunctionResult;

    if (newIndex < questions.length) {
      const nextQ = questions[newIndex];
      const instruction = InfoGathererSkill._generateQuestionInstruction(
        nextQ.question_text ?? '',
        nextQ.confirm ?? false,
        false,
        nextQ.prompt_add ?? '',
        this.submitToolName,
        newIndex + 1,
        questions.length,
      );
      result = new FunctionResult(instruction);
    } else {
      result = new FunctionResult(this.completionMessage);
      result.toggleFunctions([
        { function: this.startToolName, active: false },
        { function: this.submitToolName, active: false },
      ]);
    }

    const newState = {
      questions,
      question_index: newIndex,
      answers: newAnswers,
    };
    this.updateSkillData(result, newState);
    return result;
  }

  /**
   * Generate the per-question instruction returned to the agent. Mirrors
   * Python `_generate_question_instruction` (skill.py:268-297).
   */
  private static _generateQuestionInstruction(
    questionText: string,
    needsConfirmation: boolean,
    isFirstQuestion: boolean,
    promptAdd: string,
    submitToolName: string,
    questionNumber: number,
    totalQuestions: number,
  ): string {
    let instruction: string;
    if (isFirstQuestion) {
      instruction =
        `Ask each question one at a time, wait for the user's answer, ` +
        `then call ${submitToolName} with their answer. Do not reuse previous answers.\n\n` +
        `[Question ${questionNumber} of ${totalQuestions}]: "${questionText}"`;
    } else {
      instruction = `Previous answer saved. [Question ${questionNumber} of ${totalQuestions}]: "${questionText}"`;
    }

    if (promptAdd) {
      instruction += `\nNote: ${promptAdd}`;
    }

    if (needsConfirmation) {
      instruction +=
        `\nThis question requires confirmation. Read the answer back to the user ` +
        `and ask them to confirm it is correct before calling ${submitToolName}. ` +
        `If they say it is wrong, ask the question again.`;
    }

    return instruction;
  }

  /**
   * Validate that `questions` is a non-empty array of objects each having
   * `key_name` and `question_text`. Throws on invalid input. Mirrors Python
   * `_validate_questions` (skill.py:299-311).
   */
  private static _validateQuestions(questions: unknown): void {
    // Python order (skill.py:301-304): emptiness / falsy check BEFORE type
    // check. JS `!questions` is true for null/undefined/0/""/false but NOT
    // for `[]`, so we also handle the empty-array case explicitly.
    if (!questions || (Array.isArray(questions) && questions.length === 0)) {
      throw new Error('At least one question is required');
    }
    if (!Array.isArray(questions)) {
      throw new Error('Questions must be a list');
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || typeof q !== 'object' || Array.isArray(q)) {
        throw new Error(`Question ${i + 1} must be a dictionary`);
      }
      const obj = q as Record<string, unknown>;
      if (!('key_name' in obj)) {
        throw new Error(`Question ${i + 1} is missing 'key_name' field`);
      }
      if (!('question_text' in obj)) {
        throw new Error(`Question ${i + 1} is missing 'question_text' field`);
      }
    }
  }

  /**
   * Prompt section describing the question flow to the agent. Mirrors Python
   * `_get_prompt_sections` (skill.py:141-156).
   */
  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: `Info Gatherer (${this.getInstanceKey()})`,
        body:
          `You need to gather answers to a series of questions from the user. ` +
          `Start by introducing yourself and asking the user if they are ready ` +
          `to answer some questions. Once the user confirms they are ready, ` +
          `call the ${this.startToolName} function to get the first question. ` +
          `Ask the user that question, wait for their response, then call ` +
          `${this.submitToolName} with the answer they gave you. ` +
          `Each call to ${this.submitToolName} will return the next question ` +
          `to ask. Repeat this process until all questions are complete.`,
      },
    ];
  }
}

/**
 * Factory function for creating InfoGathererSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new InfoGathererSkill instance.
 */
export function createSkill(config?: SkillConfig): InfoGathererSkill {
  return new InfoGathererSkill(config);
}
