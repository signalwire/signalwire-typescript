/**
 * Ask Claude - Provides access to Anthropic's Claude AI for sub-queries.
 *
 * Tier 3 built-in skill: requires ANTHROPIC_API_KEY environment variable.
 * Allows the agent to send prompts to Claude for complex reasoning,
 * analysis, or sub-tasks that benefit from a dedicated AI query.
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

const log = getLogger('AskClaudeSkill');

/** A single message in the Anthropic Messages API format. */
interface AnthropicMessage {
  /** Message role ("user" or "assistant"). */
  role: string;
  /** Message content as text or structured content blocks. */
  content: string | Array<{ type: string; text: string }>;
}

/** Successful response shape from the Anthropic Messages API. */
interface AnthropicResponse {
  /** Unique message ID. */
  id: string;
  /** Response type identifier. */
  type: string;
  /** Role of the responder. */
  role: string;
  /** Array of content blocks in the response. */
  content: Array<{
    type: string;
    text?: string;
  }>;
  /** Model used for the response. */
  model: string;
  /** Reason the response stopped. */
  stop_reason: string;
  /** Token usage statistics. */
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  /** Error information, if the request failed. */
  error?: {
    type: string;
    message: string;
  };
}

/** Error response shape from the Anthropic API. */
interface AnthropicErrorResponse {
  /** Always "error" for error responses. */
  type: 'error';
  /** Error details. */
  error: {
    type: string;
    message: string;
  };
}

/**
 * Provides access to Anthropic's Claude AI for sub-queries and complex reasoning.
 *
 * Tier 3 built-in skill. Requires the `ANTHROPIC_API_KEY` environment variable.
 * Supports `model` and `max_tokens` config options to control which Claude model
 * is used and the maximum response length.
 */
export class AskClaudeSkill extends SkillBase {
  // TS-only skill (no Python equivalent).
  static override SKILL_NAME = 'ask_claude';
  static override SKILL_DESCRIPTION =
    'Provides access to Anthropic Claude AI for complex reasoning, analysis, and sub-queries.';
  static override REQUIRED_ENV_VARS: readonly string[] = ['ANTHROPIC_API_KEY'];

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      api_key: {
        type: 'string',
        description: 'Anthropic API key.',
        hidden: true,
        env_var: 'ANTHROPIC_API_KEY',
        required: true,
      },
      model: {
        type: 'string',
        description: 'The Claude model to use.',
        default: 'claude-sonnet-4-5-20250929',
      },
      max_tokens: {
        type: 'number',
        description: 'Maximum tokens in the response.',
        default: 1024,
      },
    };
  }

  /** @returns A single `ask_claude` tool that sends prompts to the Claude API. */
  getTools(): SkillToolDefinition[] {
    const model = this.getConfig<string>('model', 'claude-sonnet-4-5-20250929');
    const maxTokens = this.getConfig<number>('max_tokens', 1024);

    return [
      {
        name: 'ask_claude',
        description:
          'Send a prompt to Claude AI for complex reasoning, analysis, summarization, or any task that benefits from dedicated AI processing. Returns Claude\'s response.',
        parameters: {
          prompt: {
            type: 'string',
            description: 'The prompt or question to send to Claude.',
          },
          system_prompt: {
            type: 'string',
            description:
              'Optional system prompt to set context or instructions for Claude.',
          },
        },
        required: ['prompt'],
        handler: async (args: Record<string, unknown>) => {
          const prompt = args.prompt as string | undefined;
          const systemPrompt = args.system_prompt as string | undefined;

          if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return new FunctionResult('Please provide a prompt for Claude.');
          }

          const apiKey = process.env['ANTHROPIC_API_KEY'];
          if (!apiKey) {
            return new FunctionResult(
              'Claude AI is not configured. The ANTHROPIC_API_KEY environment variable is required.',
            );
          }

          try {
            const messages: AnthropicMessage[] = [
              { role: 'user', content: prompt.trim() },
            ];

            const requestBody: Record<string, unknown> = {
              model,
              max_tokens: maxTokens,
              messages,
            };

            if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
              requestBody['system'] = systemPrompt.trim();
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);
            let response: Response;
            try {
              response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeout);
            }

            if (!response.ok) {
              log.error('claude_api_error', { status: response.status });
              return new FunctionResult(
                'The AI service encountered an error. Please try again later.',
              );
            }

            const data = (await response.json()) as AnthropicResponse;

            if (data.error) {
              log.error('claude_response_error', { type: data.error.type });
              return new FunctionResult(
                'The AI service returned an error. Please try again later.',
              );
            }

            // Extract text content from the response
            const textParts = data.content
              .filter((block) => block.type === 'text' && block.text)
              .map((block) => block.text!);

            if (textParts.length === 0) {
              return new FunctionResult(
                'Claude returned an empty response. Try rephrasing your prompt.',
              );
            }

            const responseText = textParts.join('\n\n');
            return new FunctionResult(responseText);
          } catch (err) {
            log.error('ask_claude_failed', { error: err instanceof Error ? err.message : String(err) });
            return new FunctionResult(
              'The request could not be completed. Please try again.',
            );
          }
        },
      },
    ];
  }

  /** @returns Prompt section describing Claude AI delegation capabilities. */
  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Claude AI Assistant',
        body: 'You can delegate complex reasoning or analysis tasks to Claude AI.',
        bullets: [
          'Use the ask_claude tool for tasks requiring detailed analysis, summarization, or complex reasoning.',
          'You can provide an optional system prompt to set specific instructions or context.',
          'This is useful for tasks like: detailed explanations, code analysis, text summarization, creative writing, or multi-step reasoning.',
          'Do not use this tool for simple factual questions you already know the answer to.',
          'Summarize or relay Claude\'s response naturally to the user.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating AskClaudeSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new AskClaudeSkill instance.
 */
export function createSkill(config?: SkillConfig): AskClaudeSkill {
  return new AskClaudeSkill(config);
}
