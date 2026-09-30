/**
 * A DataMap function's meta_data, as the platform builds it: when it loads the
 * function, mod_openai merges the function's meta_data over the AI's
 * global_data, key by key (app_config.c process_swaig_function, cJSON_Merge
 * with replace), and a call's post_data carries that merged object as
 * meta_data (actions.c). The simulator used the function's meta_data alone.
 * Mirrors signalwire-python tests/unit/cli/test_datamap_exec_platform.py
 * (71dbba8).
 */

import { executeDataMap } from '../../src/cli/datamap-exec.js';

const fn = (response: string, metaData?: Record<string, unknown>) => ({
  function: 'lookup',
  ...(metaData ? { meta_data: metaData } : {}),
  data_map: { output: { response } },
});

describe("a DataMap function's meta_data, as the platform builds it", () => {
  it('is merged key by key over the global data', async () => {
    const result = await executeDataMap(
      fn('${meta_data.tenant}|${meta_data.region}|${global_data.region}', { region: 'eu' }),
      {},
      { callData: { global_data: { tenant: 'acme', region: 'us' } }, log: () => {} },
    );
    expect(result).toEqual({ response: 'acme|eu|us' });
  });

  it('replaces a global_data key whole, not merging nested objects', async () => {
    const result = await executeDataMap(
      fn('[${meta_data.api.key}][${meta_data.api.url}]', { api: { url: 'https://eu' } }),
      {},
      {
        callData: { global_data: { api: { key: 'k1', url: 'https://us' } } },
        log: () => {},
      },
    );
    expect(result).toEqual({ response: '[][https://eu]' });
  });

  it('holds the global data when the function has no meta_data', async () => {
    const result = await executeDataMap(
      fn('${meta_data.tenant}'),
      {},
      { callData: { global_data: { tenant: 'acme' } } },
    );
    expect(result).toEqual({ response: 'acme' });
  });

  it("isn't taken from the call data, which the platform doesn't take it from", async () => {
    const result = await executeDataMap(
      fn('[${meta_data.a}][${meta_data.b}]', { a: 'fn' }),
      {},
      { callData: { meta_data: { b: 'call' } }, log: () => {} },
    );
    expect(result).toEqual({ response: '[fn][]' });
  });

  it("doesn't change the global data the templates read", async () => {
    const callData = { global_data: { tenant: 'acme' } };
    const result = await executeDataMap(
      fn('${global_data.tenant}|${global_data.region}', { region: 'eu' }),
      {},
      { callData, log: () => {} },
    );
    expect(result).toEqual({ response: 'acme|' });
    expect(callData).toEqual({ global_data: { tenant: 'acme' } });
  });
});
