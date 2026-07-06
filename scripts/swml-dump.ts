/**
 * swml-dump.ts — the TypeScript port's SWML dump program for the cross-port SWML
 * differ (porting-sdk/scripts/diff_port_swml.py).
 *
 * For each swml_corpus case it builds an AgentBase, applies the setter chain,
 * renders the SWML document, and extracts the observed dotted path (e.g.
 * "ai.prompt.pom") — emitting ONE JSON object mapping
 *
 *   case-id -> extracted-fragment
 *
 * to stdout. The differ canonicalizes both sides and byte-compares against the
 * python oracle. Only stdout carries JSON.
 *
 * The SDK's Logger routes info/debug to STDOUT (console.info/debug), and it
 * reads SIGNALWIRE_LOG_MODE at module-load. renderSwml() mints a session token
 * and logs a DEBUG line, which would corrupt the JSON the differ parses. So we
 * force logging off and load the SDK via a dynamic import AFTER setting the env
 * (a static ESM import hoists above any top-level statement, so it must be
 * deferred). Only JSON reaches stdout; nothing else is printed there.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   npx tsx scripts/swml-dump.ts
 */

process.env['SIGNALWIRE_LOG_MODE'] = 'off';

async function main(): Promise<void> {
  const { AgentBase } = await import('../src/AgentBase.js');

  /** newAgent constructs a demo AgentBase (name "demo", route "/demo") with POM
   *  enabled so promptAddSection renders into ai.prompt.pom, matching the oracle. */
  const newAgent = (): InstanceType<typeof AgentBase> =>
    new AgentBase({ name: 'demo', route: '/demo', usePom: true });

  /** extract walks a dotted path into a rendered SWML doc. "ai.prompt" means:
   *  find the ai verb in sections.main, then index into it — the TS mirror of
   *  diff_port_swml._extract. */
  const extract = (doc: Record<string, unknown>, path: string): unknown => {
    let ai: unknown = undefined;
    const sections = doc['sections'] as Record<string, unknown> | undefined;
    const mainSec = sections?.['main'];
    if (Array.isArray(mainSec)) {
      for (const sec of mainSec) {
        if (sec && typeof sec === 'object' && 'ai' in (sec as Record<string, unknown>)) {
          ai = (sec as Record<string, unknown>)['ai'];
          break;
        }
      }
    }
    let node: unknown = ai !== undefined ? { ai } : doc;
    for (const part of path.split('.')) {
      if (node && typeof node === 'object' && !Array.isArray(node)) {
        node = (node as Record<string, unknown>)[part];
      } else {
        return null;
      }
    }
    return node;
  };

  /** pick reduces a map fragment to the listed keys (mirrors the oracle's `pick`). */
  const pick = (frag: unknown, keys: string[]): unknown => {
    if (!frag || typeof frag !== 'object' || Array.isArray(frag)) return frag;
    const m = frag as Record<string, unknown>;
    const o: Record<string, unknown> = {};
    for (const k of keys) o[k] = m[k];
    return o;
  };

  const render = (a: InstanceType<typeof AgentBase>): Record<string, unknown> =>
    JSON.parse(a.renderSwml()) as Record<string, unknown>;

  const out: Record<string, unknown> = {};

  // swml_set_prompt_llm_params: two setPromptLlmParams calls MERGE.
  {
    const a = newAgent();
    a.setPromptLlmParams({ temperature: 0.5 });
    a.setPromptLlmParams({ top_p: 0.9 });
    out['swml_set_prompt_llm_params'] = pick(extract(render(a), 'ai.prompt'), [
      'temperature',
      'top_p',
    ]);
  }

  // swml_set_post_prompt_llm_params: establish a post-prompt, then merge params.
  {
    const a = newAgent();
    a.setPostPrompt('Summarize the call.');
    a.setPostPromptLlmParams({ temperature: 0.3 });
    a.setPostPromptLlmParams({ top_p: 0.8 });
    out['swml_set_post_prompt_llm_params'] = pick(extract(render(a), 'ai.post_prompt'), [
      'temperature',
      'top_p',
    ]);
  }

  // swml_add_language: engine/model/voice carried into ai.languages.
  {
    const a = newAgent();
    a.addLanguage({
      name: 'English',
      code: 'en-US',
      voice: 'rime.spore',
      engine: 'rime',
      model: 'mistv2',
    });
    out['swml_add_language'] = extract(render(a), 'ai.languages');
  }

  // swml_add_pattern_hint: structured hint into ai.hints.
  {
    const a = newAgent();
    a.addPatternHint({
      hint: 'SignalWire',
      pattern: 'signal wire',
      replace: 'SignalWire',
      ignoreCase: true,
    });
    out['swml_add_pattern_hint'] = extract(render(a), 'ai.hints');
  }

  // swml_add_hint: a plain string hint.
  {
    const a = newAgent();
    a.addHint('SignalWire');
    out['swml_add_hint'] = extract(render(a), 'ai.hints');
  }

  // swml_prompt_add_section: POM sections render into ai.prompt.pom.
  {
    const a = newAgent();
    a.promptAddSection('Role', { body: 'You are a helpful assistant.' });
    a.promptAddSection('Rules', { bullets: ['Be concise', 'Be accurate'] });
    out['swml_prompt_add_section'] = extract(render(a), 'ai.prompt.pom');
  }

  // swml_add_pronunciation: renders into ai.pronounce.
  {
    const a = newAgent();
    a.addPronunciation({ replace: 'SW', with: 'SignalWire', ignoreCase: true });
    out['swml_add_pronunciation'] = extract(render(a), 'ai.pronounce');
  }

  process.stdout.write(JSON.stringify(out) + '\n');
}

void main();
