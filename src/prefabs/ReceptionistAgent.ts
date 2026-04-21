/**
 * ReceptionistAgent - Prefab agent that greets callers, collects basic info,
 * and transfers them to the appropriate department.
 *
 * Ported from the Python SDK `signalwire.prefabs.receptionist.ReceptionistAgent`.
 * Preserves TS-specific enhancements (`companyName`, visitor check-in) as
 * additive features.
 */

import { AgentBase } from '../AgentBase.js';
import { FunctionResult } from '../FunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

export interface ReceptionistDepartment {
  /** Department identifier (e.g. `"sales"`, `"support"`). */
  name: string;
  /** Description of the department's purpose (shown to the AI). */
  description: string;
  /** Phone number (or SIP address) used by `transfer_call`. */
  number: string;
}

export interface ReceptionistConfig {
  /** Departments the agent can transfer callers to. */
  departments: ReceptionistDepartment[];
  /** Agent display name (defaults to `"receptionist"`). */
  name?: string;
  /** HTTP route for this agent (defaults to `"/receptionist"`). */
  route?: string;
  /** Initial greeting message. Defaults to the Python receptionist greeting. */
  greeting?: string;
  /** Voice identifier passed to `addLanguage`. Defaults to `"rime.spore"`. */
  voice?: string;
  /** Optional company name. Appended to the greeting when provided. */
  companyName?: string;
  /** Whether visitor check-in functionality is enabled. Default `false`. */
  checkInEnabled?: boolean;
  /** Callback fired when a visitor checks in. */
  onVisitorCheckIn?: (visitor: Record<string, string>) => void | Promise<void>;
  /** Additional AgentBase options forwarded to super(). */
  agentOptions?: Partial<AgentOptions>;
}

// ── Per-call state for check-ins ────────────────────────────────────────────

interface CheckInSession {
  visitors: Record<string, string>[];
}

// ── Agent ───────────────────────────────────────────────────────────────────

/** Prefab agent that greets callers, collects basic information, and transfers them to the correct department. */
export class ReceptionistAgent extends AgentBase {
  private readonly greeting: string;
  private readonly departments: ReceptionistDepartment[];
  private readonly companyName: string | undefined;
  private readonly checkInEnabled: boolean;
  private readonly onVisitorCheckInCallback?: (visitor: Record<string, string>) => void | Promise<void>;
  private readonly sessions: Map<string, CheckInSession> = new Map();

  /**
   * Create a ReceptionistAgent with the specified departments.
   * @param config - Configuration including departments (name/description/number), greeting, and voice.
   */
  constructor(config: ReceptionistConfig) {
    const agentName = config.name ?? 'receptionist';
    super({
      name: agentName,
      route: config.route ?? '/receptionist',
      usePom: true,
      ...config.agentOptions,
    });

    // Validate departments (Python _validate_departments parity)
    ReceptionistAgent.validateDepartments(config.departments);

    this.greeting = config.greeting ?? 'Thank you for calling. How can I help you today?';
    this.departments = config.departments;
    this.companyName = config.companyName;
    this.checkInEnabled = config.checkInEnabled ?? false;
    this.onVisitorCheckInCallback = config.onVisitorCheckIn;

    // Initial global data: departments + empty caller_info bucket
    this.setGlobalData({
      departments: this.departments,
      caller_info: {},
    });

    this.buildPrompt();
    this.configureAgentSettings(config.voice ?? 'rime.spore');

    // Register tools after all fields are initialized
    this.defineTools();
  }

  private static validateDepartments(departments: unknown): asserts departments is ReceptionistDepartment[] {
    if (!Array.isArray(departments) || departments.length === 0) {
      throw new Error('At least one department is required');
    }
    for (let i = 0; i < departments.length; i++) {
      const d = departments[i] as Record<string, unknown>;
      if (!d || typeof d !== 'object') {
        throw new Error(`Department ${i + 1} must be an object`);
      }
      if (typeof d['name'] !== 'string' || !d['name']) {
        throw new Error(`Department ${i + 1} is missing 'name' field`);
      }
      if (typeof d['description'] !== 'string' || !d['description']) {
        throw new Error(`Department ${i + 1} is missing 'description' field`);
      }
      if (typeof d['number'] !== 'string' || !d['number']) {
        throw new Error(`Department ${i + 1} is missing 'number' field`);
      }
    }
  }

  private buildPrompt(): void {
    // Personality
    this.promptAddSection('Personality', {
      body: 'You are a friendly and professional receptionist. You speak clearly and efficiently while maintaining a warm, helpful tone.',
    });

    // Goal
    this.promptAddSection('Goal', {
      body: 'Your goal is to greet callers, collect their basic information, and transfer them to the appropriate department.',
    });

    // Greeting instruction honors optional companyName branding
    const branded = this.companyName
      ? `${this.greeting.trimEnd()} Welcome to ${this.companyName}.`
      : this.greeting;

    // Instructions
    const instructions = [
      `Begin by greeting the caller with: '${branded}'`,
      'Collect their name and a brief description of their needs.',
      'Based on their needs, determine which department would be most appropriate.',
      'Use the collect_caller_info function when you have their name and reason for calling.',
      'Use the transfer_call function to transfer them to the appropriate department.',
      "Before transferring, always confirm with the caller that they're being transferred to the right department.",
      'If a caller\'s request does not clearly match a department, ask follow-up questions to clarify.',
    ];
    if (this.checkInEnabled) {
      instructions.push(
        'If a caller wants to check in as a visitor, collect their full name, purpose of visit, and who they are visiting, then use the check_in_visitor tool.',
      );
    }
    this.promptAddSection('Instructions', { bullets: instructions });

    // Departments list as a bulleted section
    const deptBullets = this.departments.map(
      (dept) => `${dept.name}: ${dept.description}`,
    );
    this.promptAddSection('Available Departments', { bullets: deptBullets });

    // Post-prompt JSON summary template (Python parity)
    this.setPostPrompt(`
        Return a JSON summary of the conversation:
        {
            "caller_name": "CALLER'S NAME",
            "reason": "REASON FOR CALLING",
            "department": "DEPARTMENT TRANSFERRED TO",
            "satisfaction": "high/medium/low (estimated caller satisfaction)"
        }
        `);
  }

  private configureAgentSettings(voice: string): void {
    this.setParams({
      end_of_speech_timeout: 700,
      speech_event_timeout: 1000,
      transfer_summary: true,
    });

    this.addLanguage({ name: 'English', code: 'en-US', voice });

    // Speech recognition hints derived from company + department names
    const hints: string[] = [];
    if (this.companyName) hints.push(this.companyName);
    hints.push(...this.departments.map((d) => d.name));
    if (hints.length) this.addHints(hints);
  }

  // ── Session helpers ───────────────────────────────────────────────────

  private getSession(rawData: Record<string, unknown>): CheckInSession {
    const callId = (rawData['call_id'] as string) ?? 'default';
    let session = this.sessions.get(callId);
    if (!session) {
      session = { visitors: [] };
      this.sessions.set(callId, session);
    }
    return session;
  }

  // ── Tool registration ─────────────────────────────────────────────────

  /**
   * Register the `collect_caller_info` and `transfer_call` SWAIG tools
   * (Python parity). When `checkInEnabled` is `true`, also registers the
   * TS-specific `check_in_visitor` tool.
   */
  protected override defineTools(): void {
    // Tool: collect_caller_info (Python parity)
    this.defineTool({
      name: 'collect_caller_info',
      description: "Collect the caller's information for routing",
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: "The caller's name",
          },
          reason: {
            type: 'string',
            description: 'The reason for the call',
          },
        },
      },
      handler: (args: Record<string, unknown>) => {
        const name = (args['name'] as string) ?? '';
        const reason = (args['reason'] as string) ?? '';
        const result = new FunctionResult(
          `Thank you, ${name}. I've noted that you're calling about ${reason}.`,
        );
        result.addActions([
          {
            set_global_data: {
              caller_info: { name, reason },
            },
          },
        ]);
        return result;
      },
    });

    // Tool: transfer_call (Python parity with enum on department)
    const departmentNames = this.departments.map((d) => d.name);
    this.defineTool({
      name: 'transfer_call',
      description: 'Transfer the caller to the appropriate department',
      parameters: {
        type: 'object',
        properties: {
          department: {
            type: 'string',
            description: 'The department to transfer to',
            enum: departmentNames,
          },
        },
      },
      handler: (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const departmentName = ((args['department'] as string) ?? '').trim();
        const globalData = (rawData['global_data'] as Record<string, unknown>) ?? {};
        const callerInfo = (globalData['caller_info'] as Record<string, unknown>) ?? {};
        const name = (callerInfo['name'] as string) ?? 'the caller';

        const dept = this.departments.find((d) => d.name === departmentName);
        if (!dept) {
          return new FunctionResult(
            `Sorry, I couldn't find the ${departmentName} department.`,
          );
        }

        // Python uses post_process=True and final=True so the AI speaks
        // before executing the transfer.
        const result = new FunctionResult(
          `I'll transfer you to our ${departmentName} department now. Thank you for calling, ${name}!`,
          true,
        );
        result.connect(dept.number, true);
        return result;
      },
    });

    // Tool: check_in_visitor (TS-specific; only if checkInEnabled)
    if (this.checkInEnabled) {
      this.defineTool({
        name: 'check_in_visitor',
        description: 'Check in a visitor by recording their name, purpose of visit, and who they are visiting.',
        parameters: {
          type: 'object',
          properties: {
            visitor_name: {
              type: 'string',
              description: 'Full name of the visitor.',
            },
            purpose: {
              type: 'string',
              description: 'Purpose of the visit.',
            },
            visiting: {
              type: 'string',
              description: 'Name of the person or department the visitor is here to see.',
            },
          },
          required: ['visitor_name', 'purpose', 'visiting'],
        },
        handler: async (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
          const visitorName = args['visitor_name'] as string;
          const purpose = args['purpose'] as string;
          const visiting = args['visiting'] as string;

          if (!visitorName || !purpose || !visiting) {
            return new FunctionResult(
              "Please provide the visitor's name, purpose of visit, and who they are visiting.",
            );
          }

          const visitorRecord: Record<string, string> = {
            visitor_name: visitorName,
            purpose,
            visiting,
            checked_in_at: new Date().toISOString(),
          };

          const session = this.getSession(rawData);
          session.visitors.push(visitorRecord);

          if (this.onVisitorCheckInCallback) {
            try {
              await this.onVisitorCheckInCallback(visitorRecord);
            } catch (err) {
              this.log.error(`onVisitorCheckIn callback error: ${err}`);
            }
          }

          const companyPart = this.companyName ? ` Welcome to ${this.companyName}!` : '';
          return new FunctionResult(
            `Visitor checked in successfully! Name: ${visitorName}, Purpose: ${purpose}, Visiting: ${visiting}.${companyPart}`,
          );
        },
      });
    }
  }

  // ── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Python-style receptionist summary hook. Default is a no-op; subclasses
   * may override to persist the summary. Mirrors Python `on_summary`
   * (receptionist.py lines 278–287).
   */
  override onSummary(
    _summary: Record<string, unknown> | null,
    _rawData: Record<string, unknown>,
  ): void | Promise<void> {
    // Intentional no-op pass-through; subclasses override to handle the summary.
  }
}

// ── Factory function ────────────────────────────────────────────────────────

/**
 * Factory function that creates and returns a new ReceptionistAgent.
 * @param config - Configuration for the receptionist agent.
 * @returns A configured ReceptionistAgent instance.
 */
export function createReceptionistAgent(config: ReceptionistConfig): ReceptionistAgent {
  return new ReceptionistAgent(config);
}

export default ReceptionistAgent;
