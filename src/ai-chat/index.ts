/**
 * The SignalWire AI Chat service: {@link AIChatClient} to call it,
 * {@link ChatGateway} to let a browser chat through your app without a token,
 * and {@link HandoffRouter} to move a conversation between voice and text.
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

export {
  ChatGateway,
  GatewayRejection,
  MAX_MESSAGE_BYTES,
  MAX_REQUEST_BODY_BYTES,
  MAX_USER_METADATA_BYTES,
} from './ChatGateway.js';
export type { ChatGatewayOptions } from './ChatGateway.js';

export { HandoffRouter, NonceEntry } from './HandoffRouter.js';
export type { HandoffRouterOptions, CaptureLeg, EndCall, SendMessage } from './HandoffRouter.js';
