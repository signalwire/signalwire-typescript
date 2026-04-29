/**
 * swmlservice_ai_sidecar.ts
 *
 * Proves that SWMLService can emit the `ai_sidecar` verb, register SWAIG
 * tools the sidecar's LLM can call, and dispatch them end-to-end — without
 * any AgentBase code path.
 *
 * The `ai_sidecar` verb runs an AI listener alongside an in-progress call
 * (real-time copilot, transcription analyzer, compliance monitor, etc.). It
 * is NOT an agent — it does not own the call. So the right host is
 * SWMLService, not AgentBase.
 *
 * Run:
 *     npx tsx examples/swmlservice_ai_sidecar.ts
 *
 * What this serves:
 *     GET  /sales-sidecar           → SWML doc with the ai_sidecar verb
 *     POST /sales-sidecar/swaig     → SWAIG tool dispatch (used by the sidecar's LLM)
 *     POST /sales-sidecar/events    → optional sidecar lifecycle event sink
 *
 * Drive the SWAIG path through the SDK CLI:
 *     npx swaig-test examples/swmlservice_ai_sidecar.ts --list-tools
 *     npx swaig-test examples/swmlservice_ai_sidecar.ts \
 *         --exec lookup_competitor --arg competitor=ACME
 */

import { SWMLService } from '../src/index.js';

/** SWMLService that emits <ai_sidecar> and hosts the tools its LLM calls. */
class SalesSidecar extends SWMLService {
  constructor(opts: { publicUrl?: string; host?: string; port?: number } = {}) {
    const publicUrl = opts.publicUrl ?? 'https://your-host.example.com/sales-sidecar';
    super({
      name: 'sales-sidecar',
      route: '/sales-sidecar',
      host: opts.host ?? '0.0.0.0',
      port: opts.port ?? 3000,
      basicAuth: [
        process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
        process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
      ],
    });

    // 1. Emit any SWML — including ai_sidecar. SWMLService's addVerb /
    //    addVerbToSection accept arbitrary verb dicts, so new platform
    //    verbs work without an SDK release.
    this.addVerb('answer', {});
    this.addVerbToSection('main', 'ai_sidecar', {
      // Required by the sidecar schema: prompt + lang.
      prompt:
        'You are a real-time sales copilot. Listen to the call and surface ' +
        'competitor pricing comparisons when relevant.',
      lang: 'en-US',
      // direction must list both legs the sidecar should listen to.
      direction: ['remote-caller', 'local-caller'],
      // Optional event sink — sidecar POSTs lifecycle/transcription here.
      url: `${publicUrl}/events`,
      // Webhook URL for SWAIG tool calls goes inside SWAIG.defaults
      // (uppercase SWAIG to match the platform verb schema).
      SWAIG: {
        defaults: { web_hook_url: `${publicUrl}/swaig` },
      },
    });
    this.addVerb('hangup', {});

    // 2. Register tools the sidecar's LLM can call. Same `defineTool` you'd
    //    use on AgentBase — it lives on SWMLService.
    this.defineTool({
      name: 'lookup_competitor',
      description:
        'Look up competitor pricing by company name. The sidecar should ' +
        'call this whenever the caller mentions a competitor.',
      parameters: {
        competitor: {
          type: 'string',
          description: "The competitor's company name, e.g. 'ACME'.",
        },
      },
      handler: (args, _raw) => {
        const competitor = (args['competitor'] as string | undefined) ?? '<unknown>';
        return {
          response:
            `Pricing for ${competitor}: $99/seat. Our equivalent plan is ` +
            '$79/seat with the same SLA.',
        };
      },
    });

    // 3. (Optional) Mount an event sink for ai_sidecar lifecycle events at
    //    POST /sales-sidecar/events. Comment out if you don't need it. The
    //    callback returns null so SWMLService skips the redirect path and
    //    just acks with the current SWML document.
    this.registerRoutingCallback((body) => {
      const eventType = (body['type'] as string | undefined) ?? '<unknown>';
      this.log.info(`[sidecar event] type=${eventType} body=${JSON.stringify(body)}`);
      return null;
    }, '/events');
  }
}

// See the standalone example for why we instantiate at module top level.
export const agent = new SalesSidecar();
agent.run();
