/**
 * The signature snapshot (port_signatures.json) the surface gates diff against
 * the reference. scripts/enumerate-signatures.ts writes it; these check what it
 * records, since the script itself isn't importable.
 */
import { readFileSync } from 'node:fs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the snapshot is loose JSON
type Json = Record<string, any>;

const snapshot = JSON.parse(readFileSync('port_signatures.json', 'utf8')) as Json;
const classOf = (module: string, name: string): Json =>
  snapshot['modules'][module]['classes'][name]['methods'];

describe('port_signatures.json', () => {
  it('records an optional property readback as optional: `x?: T` reads as T | undefined', () => {
    const gate = classOf('signalwire.core.semantic_gate', 'SemanticGate');
    expect(gate['visual_input']['returns']).toBe('optional<union<float,bool,bool>>');
    expect(gate['id']['returns']).toBe('optional<string>');
  });
});
