/**
 * Video API namespace — rooms, sessions, recordings, conferences, tokens, streams.
 *
 * The resource classes are generated from the video OpenAPI spec
 * (`video.resources.generated.ts`); the `VideoNamespace` container is generated
 * into the client tree (`_client_tree_generated.ts`). This module re-exports
 * both so existing imports keep working.
 *
 * @example
 * ```ts
 * const room = await client.video.rooms.create({ name: 'standup' });
 * const token = await client.video.roomTokens.create({ room_name: 'standup', user_name: 'Alice' });
 * ```
 */

export {
  VideoConferences,
  VideoConferenceTokens,
  VideoRoomRecordings,
  VideoRooms,
  VideoRoomSessions,
  VideoRoomTokens,
  VideoStreams,
} from './video.resources.generated.js';
export { VideoNamespace } from './_client_tree_generated.js';
