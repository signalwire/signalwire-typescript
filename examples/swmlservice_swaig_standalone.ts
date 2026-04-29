/**
 * swmlservice_swaig_standalone.ts
 *
 * Proves that SWMLService — by itself, with NO AgentBase — can host SWAIG
 * functions and serve them on its own /swaig endpoint.
 *
 * This is the path you take when you want a SWAIG-callable HTTP service that
 * isn't an `<ai>` agent: the SWAIG verb is a generic LLM-tool surface and
 * SWMLService is the host. AgentBase is just a SWMLService subclass that
 * *also* layers in prompts, AI config, dynamic config, and token validation.
 *
 * Run:
 *     npx tsx examples/swmlservice_swaig_standalone.ts
 *
 * Then exercise the endpoints:
 *     curl -u user:pass http://localhost:3000/standalone        # GET SWML doc
 *     curl -u user:pass http://localhost:3000/standalone/swaig \
 *         -H 'Content-Type: application/json' \
 *         -d '{"function":"lookup_competitor","argument":{"parsed":[{"competitor":"ACME"}]}}'
 *
 * Or drive it through the SDK CLI without standing up the server:
 *     npx swaig-test examples/swmlservice_swaig_standalone.ts --list-tools
 *     npx swaig-test examples/swmlservice_swaig_standalone.ts \
 *         --exec lookup_competitor --arg competitor=ACME
 */

import { SWMLService } from '../src/index.js';

/** SWMLService that registers SWAIG tools and serves them on /swaig. */
class StandaloneSwaig extends SWMLService {
  constructor(opts: { host?: string; port?: number } = {}) {
    super({
      name: 'standalone-swaig',
      route: '/standalone',
      host: opts.host ?? '0.0.0.0',
      port: opts.port ?? 3000,
      // Hard-coded creds keep the example reproducible from the CLI / curl.
      basicAuth: [
        process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
        process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
      ],
    });

    // 1. Build a minimal SWML document. Any verbs are fine — the SWAIG HTTP
    //    surface is independent of what the document contains.
    this.addVerb('answer', {});
    this.addVerb('hangup', {});

    // 2. Register a SWAIG function. `defineTool` lives on SWMLService — not
    //    just AgentBase. The handler receives parsed args plus the raw body.
    this.defineTool({
      name: 'lookup_competitor',
      description:
        "Look up competitor pricing by company name. Use this when the user " +
        "asks how a competitor's price compares to ours.",
      parameters: {
        competitor: {
          type: 'string',
          description: "The competitor's company name, e.g. 'ACME'.",
        },
      },
      handler: (args, _raw) => {
        const competitor = (args['competitor'] as string | undefined) ?? '<unknown>';
        return {
          response: `${competitor} pricing is $99/seat; we're $79/seat.`,
        };
      },
    });
  }
}

// Instantiate at module top-level so the swaig-test CLI can locate us via
// the exported `agent` symbol. `.run()` is a no-op when SWAIG_CLI_MODE=true,
// so the same file works for both `npx tsx ...` (server mode) and CLI mode.
export const agent = new StandaloneSwaig();
agent.run();
