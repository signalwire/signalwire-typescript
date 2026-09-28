/**
 * PGI reference implementation: serve the agent from support-agent.ts.
 *
 * It refuses to start unless CASE_TENANT_ID, SWML_BASIC_AUTH_USER,
 * SWML_BASIC_AUTH_PASSWORD, SIGNALWIRE_SIGNING_KEY and SIGNALWIRE_SWAIG_SECRET
 * are set. docs/pgi_agent_guide.md section 6 shows how to run and inspect it.
 *
 * Run: npx tsx examples/pgi/serve.ts
 */

// region: serve
import { createSupportAgent, supportConfigFromEnv } from './support-agent.js';

export const agent = createSupportAgent(supportConfigFromEnv());
await agent.run();
// endregion: serve
