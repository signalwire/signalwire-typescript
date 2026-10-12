/**
 * The datasphere_serverless skill's webhook output reads the query as
 * ${input.args.query}: in a webhook's output the platform's template data
 * is the response plus `input`, with no `args` at the root (mod_openai
 * actions.c process_data_map), so ${args.query} expanded to nothing.
 */
import { DataSphereServerlessSkill } from '../../src/skills/builtin/datasphere_serverless.js';
import { executeDataMap } from '../../src/cli/datamap-exec.js';

describe('datasphere_serverless webhook output', () => {
  it('names the query the caller asked about', async () => {
    const skill = new DataSphereServerlessSkill({
      space_name: 'example',
      project_id: 'proj',
      token: 'tok',
      document_id: 'doc',
    });
    const [fn] = skill.getDataMapTools();
    const fetchImpl = async () =>
      new Response(JSON.stringify({ chunks: [{ text: 'Refunds take 5 days.' }] }), { status: 200 });
    const result = (await executeDataMap(
      fn!,
      { query: 'refund policy' },
      { fetchImpl, log: () => {} },
    )) as {
      response?: string;
    };
    expect(result.response).toContain('I found results for "refund policy"');
    expect(result.response).not.toContain('MISSING');
  });
});
