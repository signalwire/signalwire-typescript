/**
 * FAQBotAgent - A prefab agent that answers frequently asked questions using
 * keyword/word-overlap matching with configurable similarity thresholds
 * and optional escalation to a live agent.
 *
 * Ported from the Python SDK `signalwire.prefabs.faq_bot.FAQBotAgent`. Keeps
 * TS-specific enhancements (configurable similarity threshold, word-overlap
 * matcher, escalation tool) alongside the Python prefab's public surface.
 */

import { AgentBase } from '../AgentBase.js';
import { FunctionResult } from '../FunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

export interface FAQEntry {
  /** The representative question text. */
  question: string;
  /** The answer to provide when this FAQ matches. */
  answer: string;
  /** Additional keywords to boost matching accuracy. */
  keywords?: string[];
  /** Taxonomy categories this FAQ belongs to (used for filtering and hints). */
  categories?: string[];
}

export interface FAQBotConfig {
  /** Agent display name (defaults to `"faq_bot"`). */
  name?: string;
  /** HTTP route for this agent (defaults to `"/faq"`). */
  route?: string;
  /** List of FAQ entries for the knowledge base. */
  faqs: FAQEntry[];
  /** Whether to suggest related questions alongside a match. Default `true`. */
  suggestRelated?: boolean;
  /** Custom personality description for the agent's "Personality" prompt section. */
  persona?: string;
  /** Minimum match score (0-1) for an FAQ to be considered a match. Default 0.5. */
  threshold?: number;
  /** Message spoken when no FAQ matches the query. */
  escalationMessage?: string;
  /** Phone number to transfer to on escalation. If not set, escalate tool is not registered. */
  escalationNumber?: string;
  /** Additional AgentBase options forwarded to super(). */
  agentOptions?: Partial<AgentOptions>;
}

// ── Agent ───────────────────────────────────────────────────────────────────

/** Prefab agent that answers frequently asked questions using keyword matching with optional escalation to a live agent. */
export class FAQBotAgent extends AgentBase {
  /** The configured FAQ entries. */
  public faqs: FAQEntry[];
  /** Whether runner-up FAQ suggestions are appended to matches. */
  public suggestRelated: boolean;
  /** The personality description used in the prompt. */
  public persona: string;
  private threshold: number;
  private escalationMessage: string;
  private escalationNumber: string | null;

  /**
   * Create a FAQBotAgent with the specified FAQ entries and matching threshold.
   * @param config - Configuration including FAQ entries, threshold, and escalation settings.
   */
  constructor(config: FAQBotConfig) {
    const agentName = config.name ?? 'faq_bot';
    super({
      name: agentName,
      route: config.route ?? '/faq',
      usePom: true,
      ...config.agentOptions,
    });

    this.faqs = config.faqs;
    this.suggestRelated = config.suggestRelated ?? true;
    this.persona =
      config.persona ??
      'You are a helpful FAQ bot that provides accurate answers to common questions.';
    this.threshold = config.threshold ?? 0.5;
    this.escalationMessage =
      config.escalationMessage ??
      "I'm sorry, I couldn't find an answer to your question. Let me transfer you to someone who can help.";
    this.escalationNumber = config.escalationNumber ?? null;

    this.buildPrompt();
    this.configureAgentSettings();

    // Register tools after all fields are initialized
    this.defineTools();
  }

  // ── Prompt construction (mirrors Python _build_faq_bot_prompt) ────────

  private buildPrompt(): void {
    // Personality
    this.promptAddSection('Personality', { body: this.persona });

    // Goal
    this.promptAddSection('Goal', {
      body:
        'Answer user questions by matching them to the most similar FAQ in your database.',
    });

    // Instructions
    const instructions = [
      'Compare user questions to your FAQ database and find the best match.',
      'Provide the answer from the FAQ database for the matching question.',
      'If no close match exists, politely say you don\'t have that information.',
      'Be concise and factual in your responses.',
    ];
    if (this.suggestRelated) {
      instructions.push(
        'When appropriate, suggest other related questions from the FAQ database that might be helpful.',
      );
    }
    this.promptAddSection('Instructions', { bullets: instructions });

    // FAQ Database (each FAQ as a subsection with optional categories line)
    const faqSubsections = this.faqs
      .filter((faq) => faq.question && faq.answer)
      .map((faq) => {
        let body = faq.answer;
        if (faq.categories && faq.categories.length > 0) {
          body = `${body}\n\nCategories: ${faq.categories.join(', ')}`;
        }
        return { title: faq.question, body };
      });
    this.promptAddSection('FAQ Database', {
      body: 'Here is your database of frequently asked questions and answers:',
      subsections: faqSubsections,
    });

    if (this.suggestRelated) {
      this.promptAddSection('Related Questions', {
        body:
          'When appropriate, suggest other related questions from the FAQ database that might be helpful.',
      });
    }
  }

  // ── Agent settings (mirrors Python _configure_agent_settings + _setup_post_prompt) ─

  private configureAgentSettings(): void {
    // Post-prompt summary template
    this.setPostPrompt(`
        Return a JSON summary of this interaction:
        {
            "question": "MAIN_QUESTION_ASKED",
            "matched_faq": "MATCHED_FAQ_QUESTION_OR_null",
            "answered_successfully": true/false,
            "suggested_related": []
        }
        `);

    // Hints: 4+ char question words, FAQ keywords, and categories
    const hints: string[] = [];
    for (const faq of this.faqs) {
      const question = faq.question ?? '';
      if (question) {
        const words = question
          .split(/\s+/)
          .map((w) => w.replace(/^[.,?!]+|[.,?!]+$/g, ''))
          .filter((w) => w.length >= 4);
        hints.push(...words);
      }
      if (faq.keywords) hints.push(...faq.keywords);
      if (faq.categories) hints.push(...faq.categories);
    }
    const unique = Array.from(new Set(hints));
    if (unique.length > 0) this.addHints(unique);

    // AI behavior parameters
    this.setParams({
      wait_for_user: false,
      end_of_speech_timeout: 1000,
      ai_volume: 5,
    });

    // Global data: faq count and categories
    const categories = Array.from(
      new Set(
        this.faqs.flatMap((faq) => faq.categories ?? []),
      ),
    );
    this.setGlobalData({
      faq_count: this.faqs.length,
      categories,
    });

    // Native functions
    this.setNativeFunctions(['check_time']);
  }

  // ── Matching engine ───────────────────────────────────────────────────

  /**
   * Compute a word-overlap similarity score between a query and an FAQ entry.
   * Combines question text similarity and keyword overlap.
   * Returns a value between 0 and 1.
   */
  private computeMatchScore(query: string, faq: FAQEntry): number {
    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) return 0;

    // Score against the question text
    const questionWords = this.tokenize(faq.question);
    const questionOverlap = this.wordOverlap(queryWords, questionWords);

    // Score against keywords
    let keywordScore = 0;
    if (faq.keywords && faq.keywords.length > 0) {
      const keywordTokens = faq.keywords.map((k) => k.toLowerCase().trim());
      const queryLower = query.toLowerCase();
      let keywordHits = 0;
      for (const kw of keywordTokens) {
        if (queryLower.includes(kw)) {
          keywordHits++;
        }
      }
      keywordScore = keywordTokens.length > 0 ? keywordHits / keywordTokens.length : 0;
    }

    // Weighted combination: 60% question overlap, 40% keyword score
    return faq.keywords && faq.keywords.length > 0
      ? questionOverlap * 0.6 + keywordScore * 0.4
      : questionOverlap;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  }

  private wordOverlap(queryWords: string[], targetWords: string[]): number {
    if (queryWords.length === 0 || targetWords.length === 0) return 0;
    const targetSet = new Set(targetWords);
    let matches = 0;
    for (const word of queryWords) {
      if (targetSet.has(word)) matches++;
    }
    // Normalize by the smaller set to be lenient
    const divisor = Math.min(queryWords.length, targetWords.length);
    return divisor > 0 ? matches / divisor : 0;
  }

  // ── Tool registration ─────────────────────────────────────────────────

  /** Register the search_faqs and optional escalate SWAIG tools. */
  protected override defineTools(): void {
    // Tool: search_faqs (matches Python name; supports optional category filter)
    this.defineTool({
      name: 'search_faqs',
      description: 'Search for FAQs matching a specific query or category',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The caller\'s question or search query.',
          },
          category: {
            type: 'string',
            description: 'Optional category to filter the FAQ list by.',
          },
        },
      },
      handler: (args: Record<string, unknown>) => {
        const query = (args['query'] as string) ?? '';
        const category = ((args['category'] as string) ?? '').toLowerCase().trim();
        if (!query) {
          return new FunctionResult('A query is required to search the FAQ.');
        }

        // Optionally filter by category
        const pool = category
          ? this.faqs.filter(
              (faq) =>
                (faq.categories ?? []).some((c) => c.toLowerCase().trim() === category),
            )
          : this.faqs;

        if (pool.length === 0) {
          return new FunctionResult('No matching FAQs found.');
        }

        // Score all FAQs in the (possibly filtered) pool
        const scored = pool
          .map((faq) => ({ faq, score: this.computeMatchScore(query, faq) }))
          .filter((s) => s.score >= this.threshold)
          .sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
          return new FunctionResult('No matching FAQs found.');
        }

        // Match Python's response format: a numbered list of the top matches'
        // question text. The answer text is supplied to the AI via the prompt's
        // "FAQ Database" section — the tool just indicates which FAQs matched.
        const limit = this.suggestRelated ? 3 : 1;
        const top = scored.slice(0, limit);
        const lines = top.map((s, i) => `${i + 1}. ${s.faq.question}`).join('\n');
        return new FunctionResult(`Here are the most relevant FAQs:\n\n${lines}\n`);
      },
    });

    // Tool: escalate (only if escalation number is configured)
    if (this.escalationNumber) {
      this.defineTool({
        name: 'escalate',
        description: 'Transfer the caller to a live agent when the FAQ knowledge base cannot answer their question.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'The reason for escalation.',
            },
          },
        },
        handler: (_args: Record<string, unknown>) => {
          const reason = (_args['reason'] as string) || 'Caller needs assistance beyond FAQ';
          const result = new FunctionResult(
            `${this.escalationMessage} Transferring caller to a live agent. Reason: ${reason}`,
          );
          result.connect(this.escalationNumber!);
          return result;
        },
      });
    }
  }

  // ── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Process the interaction summary returned at the end of a call.
   * Logs structured summaries as JSON. Subclasses may override to persist or process.
   */
  override onSummary(
    summary: Record<string, unknown> | null,
    _rawData: Record<string, unknown>,
  ): void | Promise<void> {
    if (summary) {
      try {
        // eslint-disable-next-line no-console
        console.log(`FAQ interaction summary: ${JSON.stringify(summary, null, 2)}`);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(`Error processing summary: ${String(err)}`);
      }
    }
  }
}

// ── Common English stop words filtered from matching ────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'to', 'in', 'of', 'and', 'or', 'for',
  'on', 'at', 'by', 'do', 'if', 'my', 'so', 'up', 'am', 'as', 'be',
  'he', 'me', 'we', 'no', 'not', 'are', 'was', 'has', 'had', 'how',
  'its', 'can', 'did', 'get', 'but', 'you', 'her', 'him', 'his', 'she',
  'our', 'who', 'this', 'that', 'what', 'with', 'have', 'from', 'will',
  'your', 'they', 'them', 'been', 'does', 'just', 'than', 'when', 'which',
  'would', 'could', 'should', 'about', 'their', 'there', 'these', 'those',
]);

// ── Factory function ────────────────────────────────────────────────────────

/**
 * Factory function that creates and returns a new FAQBotAgent.
 * @param config - Configuration for the FAQ bot agent.
 * @returns A configured FAQBotAgent instance.
 */
export function createFAQBotAgent(config: FAQBotConfig): FAQBotAgent {
  return new FAQBotAgent(config);
}

export default FAQBotAgent;
