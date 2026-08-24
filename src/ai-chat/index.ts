/**
 * Async client for the SignalWire AI Chat service — see {@link AIChatClient}
 * for the full protocol notes. Mirrors the python reference
 * `signalwire.ai_chat` package surface.
 */

export {
  AIChatClient,
  AIChatError,
  AuthenticationError,
  ConversationNotFoundError,
  RateLimitError,
  ChatInProgressError,
  SummaryError,
} from './AIChatClient.js';

export type {
  AIChatClientOptions,
  ConversationTurnOptions,
  CreateConversationOptions,
  ChatOptions,
  SummarizeOptions,
  ConversationInfo,
  ChatResponse,
  ChatLog,
} from './AIChatClient.js';
