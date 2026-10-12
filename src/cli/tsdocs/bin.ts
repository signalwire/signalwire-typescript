#!/usr/bin/env node
/**
 * The `sw-tsdocs` command: the SDK's documentation for the installed
 * version. See ./index.ts.
 */

import { main } from './index.js';

// Reading a skill's or the REST client's metadata constructs SDK objects,
// which log; this command prints only its own output.
process.env['SIGNALWIRE_LOG_MODE'] ??= 'off';

// Output piped to a reader that stopped early, such as `head`: stop quietly.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

main(process.argv.slice(2)).then(
  (code) => {
    // exitCode rather than exit(), so piped output is flushed first
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`sw-tsdocs: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  },
);
