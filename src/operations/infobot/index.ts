/**
 * InfoBot: what an agent can answer, beside what `Operations` can change.
 *
 * Where `Operations` is what an agent can *change* for a caller,
 * `InfoBotKnowledge` is what it can *answer* from a corpus. It installs on any
 * agent and composes beside `Operations` on one agent, in either order: the
 * `main` step offers `search_knowledge` alongside the operation tools.
 */

export {
  Continuity,
  buildSeed,
  defaultConversationId,
  defaultSwitchNote,
  defaultSwitchTurn,
  mediumOf,
  pairTools,
  type BuildSeedOptions,
  type ContinuityOptions,
  type Turn,
} from './continuity.js';
export {
  CONTACT_FIELDS,
  InfoBotKnowledge,
  KNOWLEDGE_WORDING,
  type InfoBotKnowledgeOptions,
  type Result,
  type RuleWhen,
  type SearchFunction,
  type SearchServiceOptions,
} from './knowledge.js';
export { type Leg, type LegPersistence, LegStore, type LegStoreOptions } from './legs.js';
export { type AiMessageClient, sayIntoCall, type SayIntoCallOptions } from './livecall.js';
