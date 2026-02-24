/**
 * SwaigFunction - Wraps a handler function with metadata for SWAIG registration.
 */

import { SwaigFunctionResult } from './SwaigFunctionResult.js';

export type SwaigHandler = (
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
) => SwaigFunctionResult | Record<string, unknown> | string | Promise<SwaigFunctionResult | Record<string, unknown> | string>;

export interface SwaigFunctionOptions {
  name: string;
  handler: SwaigHandler;
  description: string;
  parameters?: Record<string, unknown>;
  secure?: boolean;
  fillers?: Record<string, string[]>;
  waitFile?: string;
  waitFileLoops?: number;
  webhookUrl?: string;
  required?: string[];
  extraFields?: Record<string, unknown>;
}

export class SwaigFunction {
  name: string;
  handler: SwaigHandler;
  description: string;
  parameters: Record<string, unknown>;
  secure: boolean;
  fillers?: Record<string, string[]>;
  waitFile?: string;
  waitFileLoops?: number;
  webhookUrl?: string;
  required: string[];
  extraFields: Record<string, unknown>;
  isExternal: boolean;

  constructor(opts: SwaigFunctionOptions) {
    this.name = opts.name;
    this.handler = opts.handler;
    this.description = opts.description;
    this.parameters = opts.parameters ?? {};
    this.secure = opts.secure ?? false;
    this.fillers = opts.fillers;
    this.waitFile = opts.waitFile;
    this.waitFileLoops = opts.waitFileLoops;
    this.webhookUrl = opts.webhookUrl;
    this.required = opts.required ?? [];
    this.extraFields = opts.extraFields ?? {};
    this.isExternal = opts.webhookUrl !== undefined;
  }

  private ensureParameterStructure(): Record<string, unknown> {
    if (!this.parameters || Object.keys(this.parameters).length === 0) {
      return { type: 'object', properties: {} };
    }
    if ('type' in this.parameters && 'properties' in this.parameters) {
      return this.parameters;
    }
    const result: Record<string, unknown> = {
      type: 'object',
      properties: this.parameters,
    };
    if (this.required.length) result['required'] = this.required;
    return result;
  }

  async execute(
    args: Record<string, unknown>,
    rawData?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.handler(args, rawData ?? {});
      if (result instanceof SwaigFunctionResult) {
        return result.toDict();
      }
      if (typeof result === 'object' && result !== null && 'response' in result) {
        return result as Record<string, unknown>;
      }
      if (typeof result === 'object' && result !== null) {
        return new SwaigFunctionResult('Function completed successfully').toDict();
      }
      return new SwaigFunctionResult(String(result)).toDict();
    } catch (err) {
      console.error(`Error executing SWAIG function ${this.name}:`, err);
      return new SwaigFunctionResult(
        "Sorry, I couldn't complete that action. Please try again or contact support if the issue persists.",
      ).toDict();
    }
  }

  toSwaig(baseUrl: string, token?: string, callId?: string): Record<string, unknown> {
    let url = `${baseUrl}/swaig`;
    if (token && callId) {
      url = `${url}?token=${token}&call_id=${callId}`;
    }
    const def: Record<string, unknown> = {
      function: this.name,
      description: this.description,
      parameters: this.ensureParameterStructure(),
    };
    if (url) def['web_hook_url'] = url;
    if (this.fillers && Object.keys(this.fillers).length > 0) {
      def['fillers'] = this.fillers;
    }
    if (this.waitFile) def['wait_file'] = this.waitFile;
    if (this.waitFileLoops !== undefined) def['wait_file_loops'] = this.waitFileLoops;
    Object.assign(def, this.extraFields);
    return def;
  }
}
