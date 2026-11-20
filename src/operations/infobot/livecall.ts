/**
 * Speaking into a live call by its id.
 */

import { RestClient } from '../../rest/index.js';

/** The REST calling surface {@link sayIntoCall} needs. */
export interface AiMessageClient {
  calling: {
    aiMessage(
      callId: string,
      options: { role?: 'system' | 'user' | 'assistant'; message_text?: string },
    ): Promise<unknown>;
  };
}

/** Options for {@link sayIntoCall}. */
export interface SayIntoCallOptions {
  /** The message's role. Default `"assistant"`. */
  role?: 'system' | 'user' | 'assistant';
  /** The REST client; defaults to a `RestClient` with credentials from the usual environment variables. */
  client?: AiMessageClient | null;
}

/**
 * Speak (or inject) a message on a live call by its id.
 *
 * Defaults to the public SignalWire REST path (`new RestClient().calling.aiMessage`)
 * with credentials from the usual environment variables; pass `client` to
 * override, such as a client wired to different credentials.
 * @param callId - The call's id.
 * @param text - The message.
 * @param opts - `role` and `client`.
 * @returns The platform's response.
 */
export async function sayIntoCall(
  callId: string,
  text: string,
  opts: SayIntoCallOptions = {},
): Promise<unknown> {
  const client = opts.client ?? (new RestClient() as unknown as AiMessageClient);
  return client.calling.aiMessage(callId, { role: opts.role ?? 'assistant', message_text: text });
}
