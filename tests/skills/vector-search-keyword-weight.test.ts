/**
 * native_vector_search keyword_weight. The reference deprecated it (8607ea6,
 * B10) because its engine's scoring ignored it. This SDK's in-memory mode
 * blends TF-IDF with keyword overlap by it, so it's kept, described as
 * in-memory only, and a warning says it does nothing with remote_url.
 */

import { NativeVectorSearchSkill } from '../../src/skills/builtin/index.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { Logger } from '../../src/Logger.js';

const DOCS = [
  { id: 'repeat', text: 'alpha alpha alpha alpha alpha' },
  { id: 'overlap', text: 'alpha beta gamma delta epsilon zeta eta theta iota kappa' },
  { id: 'other', text: 'lorem ipsum dolor sit amet' },
];

async function firstHit(keywordWeight: number): Promise<string> {
  const skill = new NativeVectorSearchSkill({
    documents: DOCS,
    keyword_weight: keywordWeight,
    count: 2,
    similarity_threshold: 0,
  });
  expect(await skill.setup()).toBe(true);
  const tool = skill.getTools()[0]!;
  const text = ((await tool.handler({ query: 'alpha beta' }, {})) as FunctionResult).response;
  const repeat = text.indexOf('alpha alpha alpha');
  const overlap = text.indexOf('alpha beta gamma');
  expect(repeat).toBeGreaterThanOrEqual(0);
  expect(overlap).toBeGreaterThanOrEqual(0);
  return repeat < overlap ? 'repeat' : 'overlap';
}

describe('native_vector_search keyword_weight', () => {
  it('changes the in-memory ranking', async () => {
    expect(await firstHit(0)).toBe('repeat');
    expect(await firstHit(1)).toBe('overlap');
  });

  it('warns that it has no effect with remote_url', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    try {
      await new NativeVectorSearchSkill({
        remote_url: 'http://127.0.0.1:1',
        keyword_weight: 0.5,
      }).setup();
      expect(warn).toHaveBeenCalledWith(
        'native_vector_search: keyword_weight has no effect with remote_url; the server ranks results',
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('describes keyword_weight and model_name as what they do here', () => {
    const schema = NativeVectorSearchSkill.getParameterSchema();
    expect(schema['keyword_weight']!.description).toMatch(/^In-memory mode only/);
    expect(schema['model_name']!.description).toMatch(/has no effect here/);
  });
});
