/**
 * A change the caller says yes to before a tool carries it out.
 *
 * This is the platform's confirm pattern. A function proposes the change: it
 * reads it back and records it in `semantic_state`, in one action object, so
 * the proposal's dialogue starts with the read-back. The confirm tool's
 * semantic gates, judged on that dialogue (`dialogue: 'proposal'`), check three
 * things: that the caller's latest turn is an answer, that the answer is a yes,
 * and that what they answered was a read-back of this change. The gates'
 * questions are the platform's, as replayed against logged calls.
 */

import { FunctionResult } from '../FunctionResult.js';
import { SemanticGate, type SemanticGateOptions } from '../SemanticGate.js';

/** Where the proposal is recorded in `semantic_state`. */
export const PROPOSAL_KEY = 'proposal';

/** Options for a {@link Proposal}. */
export interface ProposalOptions {
  /**
   * The tool the caller's no or change goes to, named in what the model is
   * told when they don't say yes.
   */
  declineTool?: string;
  /**
   * Each gate's threshold. The platform's measured value is 0.8 for yes/no
   * gates, about 0.6 with `unclear`. Default 0.8.
   */
  threshold?: number;
  /** True to let the gates answer unclear as well (OpenAI), which asks the caller again. */
  unclear?: boolean;
}

/** Options for {@link Proposal.propose}. */
export interface ProposeOptions {
  /**
   * The proposing call's request, so a proposal made again gets the next
   * revision: the platform marks a new proposal only when `semantic_state`
   * changes.
   */
  rawData?: Record<string, unknown> | null;
  /** More of what the change is, kept in the state with it. */
  details?: Record<string, unknown>;
  /** A result to add to, in place of a new one. */
  result?: FunctionResult;
}

/**
 * A read-back the caller confirms before `confirmTool` runs.
 *
 * @example
 * ```ts
 * import { AgentBase, Proposal } from '@signalwire/sdk';
 *
 * const agent = new AgentBase({ name: 'shop' });
 * const order = new Proposal('place_order', { declineTool: 'change_order' });
 *
 * agent.defineTool({
 *   name: 'review_order',
 *   description: 'Read the order back',
 *   parameters: {
 *     type: 'object',
 *     properties: { item: { type: 'string' }, time: { type: 'string' } },
 *     required: ['item', 'time'],
 *   },
 *   handler: (args, rawData) =>
 *     order.propose(`That's ${args.item} for pickup at ${args.time}. Is that right?`, {
 *       rawData,
 *       details: { item: args.item },
 *     }),
 * });
 * agent.defineTool({
 *   name: 'place_order',
 *   description: 'Place the order the caller said yes to',
 *   handler: () => order.complete('The order is placed.'),
 *   gates: order.confirmGates(),
 * });
 * ```
 */
export class Proposal {
  /** The tool that carries out the change. */
  confirmTool: string;
  /** The tool the caller's no or change goes to. */
  declineTool?: string;
  /** Each gate's threshold. */
  threshold: number;
  /** Whether the gates may answer unclear. */
  unclear: boolean;

  /**
   * @param confirmTool - The tool that carries out the change.
   * @param opts - `declineTool`, `threshold` and `unclear`.
   */
  constructor(confirmTool: string, opts: ProposalOptions = {}) {
    this.confirmTool = confirmTool;
    this.declineTool = opts.declineTool;
    this.threshold = opts.threshold ?? 0.8;
    this.unclear = opts.unclear ?? false;
  }

  /**
   * The result of the function that proposes the change.
   *
   * The agent says `readBack` word for word, and the proposal is recorded as
   * `semantic_state` `{ proposal: readBack, revision: n, ...details }`, in the
   * same action object, so the gates' proposal dialogue starts with the
   * read-back. The model then waits for the caller's answer (`wait_for_user`).
   *
   * @param readBack - The words to read back, ending with the question, such as
   *   "That's a large tea for pickup at five. Is that right?". Name everything
   *   the change covers, the way the caller would say it.
   * @param opts - `rawData`, `details` and `result`.
   * @returns The result.
   */
  propose(readBack: string, opts: ProposeOptions = {}): FunctionResult {
    const state: Record<string, unknown> = {
      ...(opts.details ?? {}),
      [PROPOSAL_KEY]: readBack,
      revision: revisionOf(opts.rawData) + 1,
    };
    const result = opts.result ?? new FunctionResult();
    result.setToolResponse(
      `Read back to the caller: ${readBack}`,
      `Wait for the caller's answer. Call ${this.confirmTool} only when ` +
        'they say yes to this read-back.' +
        (this.declineTool ? ` If they say no or want a change, call ${this.declineTool}.` : ''),
    );
    // One object: its say runs before its set_global_data, so the read-back
    // is the first turn of the proposal it records
    result.addAction('say', readBack);
    result.action[result.action.length - 1]!['set_global_data'] = { semantic_state: state };
    result.waitForUser({ enabled: true });
    return result;
  }

  /**
   * Read the current proposal back again, as a new revision, so the gates'
   * proposal dialogue starts over with it.
   *
   * @param rawData - The request of the call asking again, which carries the
   *   proposal in its `global_data`.
   * @param result - A result to add to.
   * @returns The result.
   * @throws Error when the request carries no proposal.
   */
  askAgain(rawData: Record<string, unknown>, result?: FunctionResult): FunctionResult {
    const state = current(rawData);
    if (state === null) {
      throw new Error('there is no proposal in semantic_state to ask about again');
    }
    const details = Object.fromEntries(
      Object.entries(state).filter(([k]) => k !== PROPOSAL_KEY && k !== 'revision'),
    );
    return this.propose(String(state[PROPOSAL_KEY]), { rawData, details, result });
  }

  /**
   * The confirm tool's gates: the caller answered, the answer is a yes, and it
   * was a yes to a read-back of this change. Each is judged on the proposal's
   * dialogue. When one fails, the model is told why, with the proposal quoted
   * from `semantic_state` (the platform expands `${global_data...}` in a gate's
   * output; one that doesn't sends it as written), and chaining is turned off
   * for the call (`backToBackFunctions(false)`), so the model answers in words
   * before it calls a tool again.
   *
   * @returns The gates, for the confirm tool's `gates`.
   */
  confirmGates(): SemanticGate[] {
    const tool = this.confirmTool;
    const quoted = '${global_data.semantic_state.proposal}';
    const decline = this.declineTool
      ? `, or call ${this.declineTool} if they no longer want it`
      : '';
    const blocked = (why: string, then: string): FunctionResult =>
      new FunctionResult(undefined, false, `${tool} was not run. ${why}`, then).backToBackFunctions(
        false,
      );
    const gate: SemanticGateOptions = { dialogue: 'proposal' };
    if (this.unclear) {
      gate.unclear = true;
      gate.onUnclear = blocked(
        "The caller's answer didn't settle it.",
        `Read the change back as it stands, "${quoted}", and ask for a plain yes or no.`,
      );
    }
    return [
      new SemanticGate(
        "Is the caller's latest turn in `conversation` an answer, rather than " +
          'only a sound that shows they are listening, made while the agent was ' +
          'still talking? A caller turn began while the agent was still talking ' +
          'if it is marked `while_agent_talking`, or if the agent turn just ' +
          'before it is marked `interrupted`, which means the caller cut it off. ' +
          'Any other caller turn began after the agent had finished.',
        this.threshold,
        blocked(
          'The caller was only showing they were listening.',
          'Finish reading the change back and ask for a plain yes or no.',
        ),
        {
          ...gate,
          id: 'answered',
          trueMeans:
            'Their latest turn answers, with a yes, a no, or more than a sound ' +
            'that shows they are listening, or it began after the agent had ' +
            'finished.',
          falseMeans:
            'Their latest turn is only a sound that shows they are listening, ' +
            'and it began while the agent was still talking.',
        },
      ),
      new SemanticGate(
        "Is the caller's latest answer in `conversation` to the agent's request " +
          'to confirm a yes to the change described in `semantic_state`? The ' +
          'read-back may be cut off by their answer: a yes once they have heard ' +
          'what the change is counts. A yes that comes with another request still ' +
          'counts as a yes to this change.',
        this.threshold,
        blocked(
          'The caller has not said yes to this change.',
          `Read it back, "${quoted}", and ask for a plain yes or no${decline}.`,
        ),
        {
          ...gate,
          id: 'agreed',
          trueMeans:
            'Their latest answer says yes to this change, even with another ' +
            'request or a cut-off read-back.',
          falseMeans:
            'Their latest answer says no, hesitates, or only asks a question or ' +
            'for something else.',
        },
      ),
      new SemanticGate(
        "Did the agent read back the change in `semantic_state` before the caller's " +
          'latest answer in `conversation`?',
        this.threshold,
        blocked(
          'What the caller answered was not a read-back of this change.',
          `Read the proposal back as it stands, "${quoted}", and only it, then ` +
            `ask for a yes or no${decline}.`,
        ),
        {
          ...gate,
          id: 'read_back',
          trueMeans: "The agent's read-back, even if cut off by the answer, described this change.",
          falseMeans: 'The read-back described a different change, or none was given.',
        },
      ),
    ];
  }

  /**
   * Record that the change was carried out, in place of the proposal.
   *
   * Write what was done rather than clearing the state with `{}`: a state that
   * changes starts the next proposal dialogue there, and the model and the
   * gates see what's settled.
   *
   * @param summary - What was done, such as "Order 4471 is placed".
   * @param result - The confirm tool's result, to add to.
   * @returns The result.
   */
  complete(summary: string, result?: FunctionResult): FunctionResult {
    return (result ?? new FunctionResult(undefined, false, summary)).setSemanticState({
      done: summary,
    });
  }
}

/**
 * The proposal a request's `global_data.semantic_state` holds, or null.
 * @param rawData - The SWAIG request.
 * @returns The state, as the request carries it.
 */
export function current(
  rawData: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!isRecord(rawData)) return null;
  const globalData = rawData['global_data'];
  const state = isRecord(globalData) ? globalData['semantic_state'] : undefined;
  return isRecord(state) && PROPOSAL_KEY in state ? state : null;
}

function revisionOf(rawData: Record<string, unknown> | null | undefined): number {
  const revision = current(rawData)?.['revision'];
  return typeof revision === 'number' && Number.isInteger(revision) ? revision : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
