/**
 * PGI reference implementation: the application's domain rules.
 *
 * Application-owned state for a low-risk support-intake example: input
 * validation, proposal revisions and idempotent submission. It doesn't import
 * the SDK, so its rules hold whatever calls it: a SWAIG handler, a web form or
 * a test. docs/pgi_agent_guide.md quotes this file (section 6).
 *
 * Run: npx tsx examples/pgi/case-domain.ts
 * It defines the store and prints nothing.
 */

// region: domain
import { randomUUID } from 'node:crypto';

export const CATEGORIES = ['repair', 'setup', 'question'] as const;
export type Category = (typeof CATEGORIES)[number];

/** One support request, keyed by tenant and call. */
export interface CaseRecord {
  tenant: string;
  callId: string;
  reference: string;
  category: Category;
  summary: string;
  revision: number;
  status: 'draft' | 'submitted';
}

/** A request the rules refuse: bad input, or an operation out of order. */
export class CaseRuleError extends Error {
  override name = 'CaseRuleError';
}

/** What the handlers need. A database-backed store implements the same interface. */
export interface CaseStore {
  get(tenant: string, callId: string): Promise<CaseRecord | null>;
  prepare(tenant: string, callId: string, category: unknown, summary: unknown): Promise<CaseRecord>;
  submit(tenant: string, callId: string, revision: unknown): Promise<CaseRecord>;
}

function checkKey(tenant: string, callId: string): string {
  if (typeof tenant !== 'string' || !tenant || tenant.length > 128) {
    throw new CaseRuleError('Invalid tenant context.');
  }
  if (typeof callId !== 'string' || !callId || callId.length > 256) {
    throw new CaseRuleError('Missing or invalid authenticated call context.');
  }
  return JSON.stringify([tenant, callId]);
}

/**
 * Keeps cases in this process's memory: they are lost on restart and not
 * shared between replicas. Each method finishes before it returns control to
 * the event loop, so a check and the write that follows it can't interleave
 * with another request. A database implementation needs a transaction for that.
 */
export class MemoryCaseStore implements CaseStore {
  private readonly cases = new Map<string, CaseRecord>();

  async get(tenant: string, callId: string): Promise<CaseRecord | null> {
    const row = this.cases.get(checkKey(tenant, callId));
    return row ? { ...row } : null;
  }

  async prepare(
    tenant: string,
    callId: string,
    category: unknown,
    summary: unknown,
  ): Promise<CaseRecord> {
    const key = checkKey(tenant, callId);
    if (!CATEGORIES.includes(category as Category)) {
      throw new CaseRuleError('Choose repair, setup, or question.');
    }
    const text = typeof summary === 'string' ? summary.trim() : '';
    if (text.length < 10 || text.length > 300) {
      throw new CaseRuleError('The summary must be between 10 and 300 characters.');
    }
    const existing = this.cases.get(key);
    if (existing?.status === 'submitted') {
      throw new CaseRuleError('This request is already submitted; check its status.');
    }
    const row: CaseRecord = {
      tenant,
      callId,
      reference: existing?.reference ?? `CASE-${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      category: category as Category,
      summary: text,
      revision: (existing?.revision ?? 0) + 1,
      status: 'draft',
    };
    this.cases.set(key, row);
    return { ...row };
  }

  async submit(tenant: string, callId: string, revision: unknown): Promise<CaseRecord> {
    const key = checkKey(tenant, callId);
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
      throw new CaseRuleError('A current proposal revision is required.');
    }
    const row = this.cases.get(key);
    if (!row) throw new CaseRuleError('Prepare a request before submitting it.');
    // Application-level idempotency: a repeated submit returns the same case.
    if (row.status === 'submitted') return { ...row };
    if (revision !== row.revision) {
      throw new CaseRuleError('The proposal changed. Review the current version first.');
    }
    const submitted: CaseRecord = { ...row, status: 'submitted' };
    this.cases.set(key, submitted);
    return { ...submitted };
  }
}
// endregion: domain
