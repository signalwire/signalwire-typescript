/**
 * AUTO-GENERATED REST wire tests for the `message` namespace — DO NOT EDIT.
 * Regenerate: npx tsx scripts/generate-rest-tests.ts
 *
 * Each route the SDK implements (captured from the real client by scripts/route-registry.ts,
 * joined to the spec operationId) gets a SUCCESS test (call it, assert method + matched_route on
 * the mock journal) and an ERROR test (arm a 5xx, assert RestError). The assertion oracle is the
 * spec operationId — independent of the resource generator — so these catch SDK-vs-contract
 * drift, not a generator self-snapshot. Full-mock harness fixtures.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';
import { RestError } from '../../src/rest/RestError.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

describe('message wire (generated)', () => {
  it('messages_get success', async () => {
    await client.logs.messages.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('message.get_message_log');
  });

  it('messages_get error', async () => {
    await mock.pushScenario('message.get_message_log', 500, { error: 'x' });
    await expect(client.logs.messages.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('messages_list success', async () => {
    await client.logs.messages.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('message.list_message_logs');
  });

  it('messages_list error', async () => {
    await mock.pushScenario('message.list_message_logs', 500, { error: 'x' });
    await expect(client.logs.messages.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('businesses_list success', async () => {
    await client.whatsapp.businesses.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('message.list_whatsapp_businesses');
  });

  it('businesses_list error', async () => {
    await mock.pushScenario('message.list_whatsapp_businesses', 500, { error: 'x' });
    await expect(client.whatsapp.businesses.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numbers_get success', async () => {
    await client.whatsapp.numbers.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('message.retrieve_whatsapp_number');
  });

  it('numbers_get error', async () => {
    await mock.pushScenario('message.retrieve_whatsapp_number', 500, { error: 'x' });
    await expect(client.whatsapp.numbers.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numbers_list success', async () => {
    await client.whatsapp.numbers.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('message.list_whatsapp_numbers');
  });

  it('numbers_list error', async () => {
    await mock.pushScenario('message.list_whatsapp_numbers', 500, { error: 'x' });
    await expect(client.whatsapp.numbers.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('templates_create success', async () => {
    await client.whatsapp.templates.create({
      whatsapp_business_id: 'x',
      name: 'x',
      language: 'x',
      category: 'utility',
      parameter_format: 'named',
      components: [],
    });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('message.create_whatsapp_template');
  });

  it('templates_create error', async () => {
    await mock.pushScenario('message.create_whatsapp_template', 500, { error: 'x' });
    await expect(
      client.whatsapp.templates.create({
        whatsapp_business_id: 'x',
        name: 'x',
        language: 'x',
        category: 'utility',
        parameter_format: 'named',
        components: [],
      }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('templates_delete success', async () => {
    await client.whatsapp.templates.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('message.delete_whatsapp_template');
  });

  it('templates_delete error', async () => {
    await mock.pushScenario('message.delete_whatsapp_template', 500, { error: 'x' });
    await expect(client.whatsapp.templates.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('templates_get success', async () => {
    await client.whatsapp.templates.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('message.retrieve_whatsapp_template');
  });

  it('templates_get error', async () => {
    await mock.pushScenario('message.retrieve_whatsapp_template', 500, { error: 'x' });
    await expect(client.whatsapp.templates.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('templates_list success', async () => {
    await client.whatsapp.templates.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('message.list_whatsapp_templates');
  });

  it('templates_list error', async () => {
    await mock.pushScenario('message.list_whatsapp_templates', 500, { error: 'x' });
    await expect(client.whatsapp.templates.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('templates_update success', async () => {
    await client.whatsapp.templates.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('message.update_whatsapp_template');
  });

  it('templates_update error', async () => {
    await mock.pushScenario('message.update_whatsapp_template', 500, { error: 'x' });
    await expect(client.whatsapp.templates.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
