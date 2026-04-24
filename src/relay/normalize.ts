/**
 * Wire-format normalizers for play items and device descriptors.
 *
 * The SDK accepts two input shapes for convenience:
 *
 *   flat   — `{ type: 'tts', text: 'hi' }`
 *   nested — `{ type: 'tts', params: { text: 'hi' } }`
 *
 * The RELAY Blade protocol only accepts the nested form. These helpers fold
 * the flat form into the nested form before the RPC goes out so both shapes
 * work at the call sites (play/playAndCollect/connect/refer/tap/dial).
 *
 * Passing through an already-nested item is idempotent.
 */

/** Normalize a single play item (tts/audio/silence/ringtone). */
export function normalizePlayItem(
  item: Record<string, unknown>,
): Record<string, unknown> {
  if ('params' in item) return item;
  const { type, ...rest } = item;
  return { type, params: rest };
}

/** Normalize an array of play items. */
export function normalizePlayItems(
  items: Record<string, unknown>[],
): Record<string, unknown>[] {
  return items.map(normalizePlayItem);
}

/**
 * Normalize a single device descriptor (phone/sip/webrtc/agora/stream/...).
 *
 * For `phone`, also renames the SDK's short `to`/`from` keys to the wire-format
 * `to_number`/`from_number` that the platform expects.
 */
export function normalizeDevice(
  device: Record<string, unknown>,
): Record<string, unknown> {
  if ('params' in device) return device;
  const { type, ...rest } = device;
  const params: Record<string, unknown> = { ...rest };
  if (type === 'phone') {
    if ('to' in params && !('to_number' in params)) {
      params.to_number = params.to;
      delete params.to;
    }
    if ('from' in params && !('from_number' in params)) {
      params.from_number = params.from;
      delete params.from;
    }
  }
  return { type, params };
}

/** Normalize a 2D dial plan (outer = serial groups, inner = parallel devices). */
export function normalizeDevicePlan(
  plan: Record<string, unknown>[][],
): Record<string, unknown>[][] {
  return plan.map((group) => group.map(normalizeDevice));
}
