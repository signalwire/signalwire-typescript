/**
 * Info Gatherer Skill - Collects structured information from the user.
 *
 * Tier 2 built-in skill: no external dependencies required. Supports two
 * collection modes:
 *
 * 1. Sequential question flow (Python-aligned): configure `questions` and the
 *    skill registers `start_questions` / `submit_answer` tools that guide the
 *    agent one question at a time. State lives in SWAIG `global_data` under a
 *    namespaced key (e.g. `skill:info_gatherer`).
 * 2. Single-shot field collection (TS-native): configure `fields` to get a
 *    dynamic `save_info` tool plus a `get_gathered_info` retrieval tool. State
 *    lives in an in-memory map keyed by `call_id`.
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

/** Definition of a single data field to be collected from the user. */
interface FieldDefinition {
  /** Field name used as the parameter key. */
  name: string;
  /** Description of what this field collects. */
  description: string;
  /** Whether this field must be provided. */
  required?: boolean;
  /** Optional regex pattern for validating the field value. */
  validation?: string;
  /** Parameter type for the tool schema (defaults to "string"). */
  type?: string;
}

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

/** Key-value map of information gathered from a user during a call. */
interface GatheredInfo {
  [key: string]: unknown;
}

/**
 * Collects structured information from the user.
 *
 * Tier 2 built-in skill with no external dependencies. Supports the
 * Python-aligned sequential question flow (`questions` config) and the
 * TS-native single-shot field collection (`fields` config).
 */
export class InfoGathererSkill extends SkillBase {
  // Python ground truth: skills/info_gatherer/skill.py:26-31
  static override SKILL_NAME = 'info_gatherer';
  static override SKILL_DESCRIPTION = 'Gather answers to a configurable list of questions';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_PACKAGES: readonly string[] = [];
  static override REQUIRED_ENV_VARS: readonly string[] = [];
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  /** Sequential flow: list of question definitions populated in `setup()`. */
  private questions: QuestionDefinition[] = [];
  /** Sequential flow: derived tool name for the start tool (prefix-aware). */
  private startToolName: string = 'start_questions';
  /** Sequential flow: derived tool name for the submit tool (prefix-aware). */
  private submitToolName: string = 'submit_answer';
  /** Sequential flow: message returned once all questions are answered. */
  private completionMessage: string = '';

  /** Single-shot flow: in-memory storage keyed by call_id. */
  private gatheredData: Map<string, GatheredInfo> = new Map();

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
      },
      completion_message: {
        type: 'string',
        description: 'Message returned after all questions are answered',
        default:
          "Thank you! All questions have been answered. You can now summarize the information collected or ask if there's anything else the user would like to discuss.",
      },
      fields: {
        type: 'array',
        description:
          'Array of field definitions to collect: { name, description, required?, validation?, type? }.',
        items: { type: 'object' },
      },
      purpose: {
        type: 'string',
        description: 'A description of why this information is being collected.',
      },
      confirmation_message: {
        type: 'string',
        description: 'Custom message returned after successful info collection.',
        default: 'Information has been saved successfully.',
      },
      store_globally: {
        type: 'boolean',
        description: 'Whether to store gathered info in global data.',
        default: false,
      },
    };
  }

  /**
   * Instance key for the SkillManager. When `prefix` is configured, returns
   * `info_gatherer_<prefix>` to support multi-instance use. Matches Python's
   * `get_instance_key()`.
   */
  override getInstanceKey(): string {
    const prefix = this.getConfig<string>('prefix', '');
    return prefix ? `info_gatherer_${prefix}` : 'info_gatherer';
  }

  /**
   * Validate sequential question config and initialize derived state. A no-op
   * when `questions` is not configured (field-only mode).
   */
  override async setup(): Promise<boolean> {
    const questions = this.getConfig<unknown>('questions', undefined);
    const fields = this.getConfig<unknown[]>('fields', []);
    if ((questions === undefined || questions === null) && (!Array.isArray(fields) || fields.length === 0)) {
      // Python parity: `setup()` returns false when the skill has nothing to do
      // (skill.py:91-95 requires `questions`). TS additionally supports a
      // field-only mode, so we accept either — but not neither, otherwise the
      // skill would register no tools and no prompt sections silently.
      log.error('info_gatherer: at least one of "questions" or "fields" must be configured');
      return false;
    }
    if (questions === undefined || questions === null) {
      // Field-only mode — tools + prompt sections come from the fields path.
      return true;
    }

    try {
      InfoGathererSkill._validateQuestions(questions);
    } catch (err) {
      log.error(
        `info_gatherer: ${err instanceof Error ? err.message : String(err)}`,
      );
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
      "Thank you! All questions have been answered. You can now summarize the information collected or ask if there's anything else the user would like to discuss.",
    );
    return true;
  }

  /**
   * Seed SWAIG global_data with the initial sequential-question state. Returns
   * an empty object when sequential mode is not active.
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

  /** Tools for the configured collection mode. */
  getTools(): SkillToolDefinition[] {
    // Sequential question flow takes precedence when configured.
    if (this.questions.length > 0) {
      return this._getSequentialTools();
    }
    return this._getFieldTools();
  }

  private _getSequentialTools(): SkillToolDefinition[] {
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

  private _getFieldTools(): SkillToolDefinition[] {
    const fields = this.getConfig<FieldDefinition[]>('fields', []);
    const confirmationMessage = this.getConfig<string>(
      'confirmation_message',
      'Information has been saved successfully.',
    );
    const storeGlobally = this.getConfig<boolean>('store_globally', false);

    if (fields.length === 0) {
      return [];
    }

    // Build dynamic parameters from field definitions
    const parameters: Record<string, unknown> = {};
    const requiredParams: string[] = [];

    for (const field of fields) {
      parameters[field.name] = {
        type: field.type ?? 'string',
        description: field.description,
      };

      if (field.required) {
        requiredParams.push(field.name);
      }
    }

    return [
      {
        name: 'save_info',
        description:
          'Save information gathered from the user. Call this once you have collected the required fields.',
        parameters,
        required: requiredParams.length > 0 ? requiredParams : undefined,
        handler: (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
          const errors: string[] = [];
          const collected: GatheredInfo = {};

          for (const field of fields) {
            const value = args[field.name];

            if (field.required) {
              if (
                value === undefined ||
                value === null ||
                (typeof value === 'string' && value.trim().length === 0)
              ) {
                errors.push(`"${field.name}" is required but was not provided.`);
                continue;
              }
            }

            if (value === undefined || value === null) {
              continue;
            }

            if (field.validation && typeof value === 'string') {
              try {
                const regex = new RegExp(field.validation);
                if (!regex.test(value)) {
                  errors.push(
                    `"${field.name}" value "${value}" does not match the expected format.`,
                  );
                  continue;
                }
              } catch {
                // Invalid regex — skip validation
              }
            }

            collected[field.name] =
              typeof value === 'string' ? value.trim() : value;
          }

          if (errors.length > 0) {
            return new FunctionResult(
              `Could not save information due to validation errors:\n${errors.join('\n')}\nPlease correct these fields and try again.`,
            );
          }

          if (Object.keys(collected).length === 0) {
            return new FunctionResult(
              'No information was provided. Please collect at least one field before saving.',
            );
          }

          const callId = (rawData['call_id'] as string | undefined) ?? 'default';
          this.gatheredData.set(callId, {
            ...this.gatheredData.get(callId),
            ...collected,
          });

          const fieldSummary = Object.entries(collected)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');

          const result = new FunctionResult(
            `${confirmationMessage} Saved: ${fieldSummary}.`,
          );

          if (storeGlobally) {
            result.updateGlobalData({ gathered_info: collected });
          }

          return result;
        },
      },
      {
        name: 'get_gathered_info',
        description:
          'Retrieve previously gathered information for the current call. Useful to review what has already been collected.',
        parameters: {},
        handler: (_args: Record<string, unknown>, rawData: Record<string, unknown>) => {
          const callId = (rawData['call_id'] as string | undefined) ?? 'default';
          const info = this.gatheredData.get(callId);

          if (!info || Object.keys(info).length === 0) {
            return new FunctionResult(
              'No information has been gathered yet for this call.',
            );
          }

          const summary = Object.entries(info)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');

          return new FunctionResult(
            `Previously gathered information: ${summary}.`,
          );
        },
      },
    ];
  }

  /**
   * Handle the `start_questions` tool: read state from global_data and return
   * an instruction for the first question.
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
   * message (disabling both tools on completion).
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

  /** Generate the per-question instruction returned to the agent. */
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
   * `key_name` and `question_text`. Throws on invalid input.
   */
  private static _validateQuestions(questions: unknown): void {
    if (!Array.isArray(questions)) {
      throw new Error('Questions must be a list');
    }
    if (questions.length === 0) {
      throw new Error('At least one question is required');
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

  /** Prompt sections depend on the active collection mode. */
  protected override _getPromptSections(): SkillPromptSection[] {
    if (this.questions.length > 0) {
      return this._getSequentialPromptSections();
    }
    return this._getFieldPromptSections();
  }

  private _getSequentialPromptSections(): SkillPromptSection[] {
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

  private _getFieldPromptSections(): SkillPromptSection[] {
    const fields = this.getConfig<FieldDefinition[]>('fields', []);
    const purpose = this.getConfig<string | undefined>('purpose', undefined);

    if (fields.length === 0) {
      return [];
    }

    const requiredFields = fields.filter((f) => f.required);
    const optionalFields = fields.filter((f) => !f.required);

    const bullets: string[] = [];

    if (purpose) {
      bullets.push(`Purpose: ${purpose}`);
    }

    bullets.push(
      'Use the save_info tool to store information once you have collected it from the user.',
    );

    if (requiredFields.length > 0) {
      const reqNames = requiredFields.map((f) => `"${f.name}"`).join(', ');
      bullets.push(`Required fields (must be collected): ${reqNames}.`);
    }

    if (optionalFields.length > 0) {
      const optNames = optionalFields.map((f) => `"${f.name}"`).join(', ');
      bullets.push(`Optional fields (collect if available): ${optNames}.`);
    }

    for (const field of fields) {
      const reqLabel = field.required ? ' (required)' : ' (optional)';
      bullets.push(`${field.name}${reqLabel}: ${field.description}`);
    }

    bullets.push(
      'Ask for information naturally in conversation rather than as a list of questions.',
      'Use get_gathered_info to review what has already been collected.',
      'Once all required fields are gathered, call save_info to store the data.',
    );

    return [
      {
        title: 'Information Collection',
        body: 'You need to collect specific information from the user during this conversation.',
        bullets,
      },
    ];
  }

  /**
   * Get all gathered data (single-shot mode), keyed by call ID.
   * @returns A copy of the internal gathered data map.
   */
  getAllGatheredData(): Map<string, GatheredInfo> {
    return new Map(this.gatheredData);
  }

  /**
   * Clear gathered data (single-shot mode) for a specific call or all calls.
   * @param callId - If provided, clear data for this call only; otherwise clear all.
   */
  clearGatheredData(callId?: string): void {
    if (callId) {
      this.gatheredData.delete(callId);
    } else {
      this.gatheredData.clear();
    }
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
