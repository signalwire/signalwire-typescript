#!/usr/bin/env npx tsx
/**
 * token-interop-mint — the TypeScript port's TOKEN-INTEROP mint fixture for the
 * cross-port checker (porting-sdk/scripts/diff_port_token_interop.py).
 *
 * The contract being proven is property 3 of the SWAIG tool-token contract: a token
 * this port MINTS must validate under the REFERENCE's own decoder. The other two
 * properties (that a token is minted at all; that the HMAC is keyed with the
 * secret_key STRING's bytes) already had coverage — this one did not, and a port can
 * pass both and still emit a token no other implementation accepts, in which case
 * every secure tool call fails authentication in production.
 *
 * Protocol: read the FIXED mint inputs from the environment (the checker owns them, so
 * this fixture cannot drift from the values it is verified against), construct a
 * SessionManager with that secret key, mint ONE token, and print JUST the token on
 * stdout. Anything else belongs on stderr.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   npx tsx scripts/token-interop-mint.ts
 *
 * Copyright (c) 2025 SignalWire
 * Licensed under the MIT License.
 */

import { SessionManager } from '../src/SessionManager.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — the TOKEN-INTEROP checker supplies the fixed mint inputs ` +
        `in the environment; run this via diff_port_token_interop.py --mint-cmd.`,
    );
  }
  return value;
}

const secretKey = required('SW_TOKEN_INTEROP_SECRET_KEY');
const callId = required('SW_TOKEN_INTEROP_CALL_ID');
const functionName = required('SW_TOKEN_INTEROP_FUNCTION_NAME');

// Default expiry — the token must carry a FUTURE expiry, which the checker verifies.
const manager = new SessionManager(900, secretKey);
process.stdout.write(`${manager.generateToken(functionName, callId)}\n`);
