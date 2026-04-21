/**
 * Custom Skills - A meta-skill that registers user-defined tools from configuration.
 *
 * Tier 2 built-in skill: no external dependencies required.
 * Allows users to define arbitrary tools via config without writing skill classes.
 * Each tool definition in the config specifies its name, description, parameters,
 * and a handler function body (executed via Function constructor).
 *
 * This is useful for rapid prototyping, simple integrations, and cases where
 * creating a full skill class would be overkill.
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

const log = getLogger('CustomSkillsSkill');

/** Parameter definition for a custom tool. */
interface CustomToolParameter {
  /** Parameter name. */
  name: string;
  /** Parameter type (e.g., "string", "number"). */
  type: string;
  /** Description of the parameter. */
  description: string;
  /** Whether this parameter is required. */
  required?: boolean;
}

/** Full definition of a user-defined custom tool provided via configuration. */
interface CustomToolDefinition {
  /** Unique tool name. */
  name: string;
  /** Tool description shown to the AI. */
  description: string;
  /** Optional array of parameter definitions. */
  parameters?: CustomToolParameter[];
  /** JavaScript function body executed when the tool is invoked. */
  handler_code: string;
  /** Names of required parameters. */
  required?: string[];
  /** Optional description used in the prompt section instead of the tool description. */
  prompt_description?: string;
  /** Whether to mark the tool as secure. */
  secure?: boolean;
  /** Filler phrases spoken while the tool executes. */
  fillers?: Record<string, string[]>;
}

/** Typed shape of the custom skills configuration object. */
interface CustomSkillsConfigData {
  /** Array of custom tool definitions. */
  tools?: CustomToolDefinition[];
  /** Custom title for the prompt section. */
  prompt_title?: string;
  /** Custom body text for the prompt section. */
  prompt_body?: string;
}

/**
 * A meta-skill that registers user-defined tools from configuration.
 *
 * Tier 2 built-in skill with no external dependencies. Allows users to define
 * arbitrary tools via config without writing skill classes. Each tool definition
 * specifies a name, description, parameters, and a JavaScript handler function
 * body that is compiled via the Function constructor at instantiation time.
 *
 * **Security warning:** This skill uses `new Function()` to compile user-provided
 * code at runtime. It is gated behind the `SWML_ALLOW_CUSTOM_HANDLER_CODE=true`
 * environment variable to prevent unintended code execution.
 *
 * @example
 * ```ts
 * // Requires SWML_ALLOW_CUSTOM_HANDLER_CODE=true
 * agent.addSkill('custom_skills', {
 *   tools: [
 *     {
 *       name: 'echo',
 *       description: 'Echo back the caller-supplied message.',
 *       parameters: { type: 'object', properties: { msg: { type: 'string' } } },
 *       handlerBody: 'return new FunctionResult(args.msg);',
 *     },
 *   ],
 * });
 * ```
 */
export class CustomSkillsSkill extends SkillBase {
  // TS-only skill (no Python equivalent).
  static override SKILL_NAME = 'custom_skills';
  static override SKILL_DESCRIPTION =
    'Register one-off SWAIG tools from a user-supplied config (name + description + handler body).';

  private _compiledHandlers: Map<string, Function> = new Map();
  private _compilationErrors: Map<string, string> = new Map();

  /**
   * @param config - Configuration object containing a `tools` array of custom tool definitions.
   */
  constructor(config?: SkillConfig) {
    super(config);
    this._compileHandlers();
  }

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tools: {
        type: 'array',
        description: 'Array of custom tool definitions: { name, description, handler_code, parameters?, required?, prompt_description?, secure?, fillers? }.',
        items: { type: 'object' },
      },
      prompt_title: {
        type: 'string',
        description: 'Custom title for the prompt section.',
        default: 'Custom Tools',
      },
      prompt_body: {
        type: 'string',
        description: 'Custom body text for the prompt section.',
      },
    };
  }


  /**
   * Pre-compile handler code into functions during construction.
   * This catches syntax errors early and avoids re-compilation on each call.
   */
  private _compileHandlers(): void {
    const toolDefs = this._getToolDefs();
    const codeAllowed = process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] === 'true';

    for (const toolDef of toolDefs) {
      if (!codeAllowed) {
        this._compilationErrors.set(
          toolDef.name,
          'Custom handler code is disabled. Set SWML_ALLOW_CUSTOM_HANDLER_CODE=true to enable.',
        );
        continue;
      }

      try {
        log.warn(`Compiling custom handler code for tool '${toolDef.name}'`);
        // The handler code receives: args, rawData, FunctionResult
        // It should return a FunctionResult, string, or plain object
        const handler = new Function(
          'args',
          'rawData',
          'FunctionResult',
          toolDef.handler_code,
        ) as (
          args: Record<string, unknown>,
          rawData: Record<string, unknown>,
          resultClass: typeof FunctionResult,
        ) => unknown;

        this._compiledHandlers.set(toolDef.name, handler);
      } catch (err) {
        log.error('custom_handler_compile_error', { tool: toolDef.name, error: err instanceof Error ? err.message : String(err) });
        this._compilationErrors.set(toolDef.name, 'Handler compilation failed.');
      }
    }
  }

  /**
   * Get the raw tool definitions from config.
   */
  private _getToolDefs(): CustomToolDefinition[] {
    const configData = this.config as unknown as CustomSkillsConfigData;
    return configData.tools ?? [];
  }

  /** @returns Array of dynamically generated tools from the configuration, with compiled handlers. */
  getTools(): SkillToolDefinition[] {
    const toolDefs = this._getToolDefs();
    const tools: SkillToolDefinition[] = [];

    for (const toolDef of toolDefs) {
      // Check for compilation errors
      const compError = this._compilationErrors.get(toolDef.name);
      if (compError) {
        // Still register the tool but with an error handler
        tools.push({
          name: toolDef.name,
          description: toolDef.description,
          parameters: this._buildParameters(toolDef),
          required: toolDef.required,
          secure: toolDef.secure,
          fillers: toolDef.fillers,
          handler: () => {
            return new FunctionResult(
              `Custom tool "${toolDef.name}" is not available due to a configuration error. Please contact your administrator.`,
            );
          },
        });
        continue;
      }

      const compiledHandler = this._compiledHandlers.get(toolDef.name);
      if (!compiledHandler) {
        continue;
      }

      tools.push({
        name: toolDef.name,
        description: toolDef.description,
        parameters: this._buildParameters(toolDef),
        required: toolDef.required,
        secure: toolDef.secure,
        fillers: toolDef.fillers,
        handler: async (
          args: Record<string, unknown>,
          rawData: Record<string, unknown>,
        ) => {
          try {
            const result = await compiledHandler(args, rawData, FunctionResult);

            // Normalize the result
            if (result instanceof FunctionResult) {
              return result;
            }

            if (typeof result === 'string') {
              return new FunctionResult(result);
            }

            if (result && typeof result === 'object') {
              return result as Record<string, unknown>;
            }

            return new FunctionResult('Action completed.');
          } catch (err) {
            log.error('custom_tool_runtime_error', { tool: toolDef.name, error: err instanceof Error ? err.message : String(err) });
            return new FunctionResult(
              `Custom tool "${toolDef.name}" encountered an error. Please try again.`,
            );
          }
        },
      });
    }

    return tools;
  }

  /** @returns Prompt section listing all custom tools and their descriptions. */
  protected override _getPromptSections(): SkillPromptSection[] {
    const toolDefs = this._getToolDefs();
    const configData = this.config as unknown as CustomSkillsConfigData;

    if (toolDefs.length === 0) {
      return [];
    }

    const title = configData.prompt_title ?? 'Custom Tools';
    const body =
      configData.prompt_body ??
      'The following custom tools are available for use.';

    const bullets: string[] = [];

    for (const toolDef of toolDefs) {
      const compError = this._compilationErrors.get(toolDef.name);

      if (compError) {
        bullets.push(
          `${toolDef.name}: [ERROR - handler compilation failed] ${toolDef.description}`,
        );
      } else if (toolDef.prompt_description) {
        bullets.push(`${toolDef.name}: ${toolDef.prompt_description}`);
      } else {
        bullets.push(`${toolDef.name}: ${toolDef.description}`);
      }
    }

    return [
      {
        title,
        body,
        bullets,
      },
    ];
  }

  /**
   * Build tool parameters from the custom tool definition.
   */
  private _buildParameters(
    toolDef: CustomToolDefinition,
  ): Record<string, unknown> {
    if (!toolDef.parameters || toolDef.parameters.length === 0) {
      return {};
    }

    const params: Record<string, unknown> = {};
    for (const param of toolDef.parameters) {
      params[param.name] = {
        type: param.type,
        description: param.description,
      };
    }
    return params;
  }

  /**
   * Get handler compilation errors for diagnostic purposes.
   * @returns A copy of the map from tool name to error message.
   */
  getCompilationErrors(): Map<string, string> {
    return new Map(this._compilationErrors);
  }
}

/**
 * Factory function for creating CustomSkillsSkill instances.
 * @param config - Configuration containing a `tools` array of custom tool definitions.
 * @returns A new CustomSkillsSkill instance.
 */
export function createSkill(config?: SkillConfig): CustomSkillsSkill {
  return new CustomSkillsSkill(config);
}
