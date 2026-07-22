/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_registry_mock.py.
 *
 * Covers 10DLC Campaign Registry brands / campaigns / orders / numbers
 * — all under /api/relay/rest/registry/beta.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness, WireBody } from './mocktest.js';
import type { CreateManagedCampaignRequest } from '../../src/rest/namespaces/relay-rest.types.generated.js';

const REG_BASE = '/api/relay/rest/registry/beta';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- Brands ------------------------------------------------------------

describe('RegistryBrands', () => {
  it('list_returns_dict', async () => {
    const body = await client.registry.brands.list();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${REG_BASE}/brands`);
    expect(last.matched_route).not.toBeNull();
  });

  it('get_uses_id_in_path', async () => {
    const body = await client.registry.brands.get('brand-77');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${REG_BASE}/brands/brand-77`);
  });

  it('list_campaigns_uses_brand_subpath', async () => {
    const body = await client.registry.brands.listCampaigns('brand-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${REG_BASE}/brands/brand-1/campaigns`);
    expect(last.matched_route).not.toBeNull();
  });

  it('create_campaign_posts_to_brand_subpath', async () => {
    // create_campaign takes the full CreateManagedCampaignRequest body; the
    // managed-campaign schema requires every field below.
    const body = await client.registry.brands.createCampaign('brand-2', {
      name: 'My Campaign',
      brand_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      sms_use_case: 'MARKETING',
      description: 'This campaign sends appointment reminders to opted-in patients.',
      sample1: 'Hi John, your appointment is tomorrow. Reply STOP to unsubscribe.',
      sample2: 'Your prescription is ready for pickup. Reply STOP to unsubscribe.',
      message_flow: 'Users opt in via a written form and receive an opt-in message.',
      opt_out_message: 'You have successfully been opted out. Reply START to opt back in.',
      help_message: 'For help contact support@example.com. Reply STOP to unsubscribe.',
      number_pooling_required: false,
      direct_lending: false,
      embedded_link: false,
      embedded_phone: false,
      age_gated_content: false,
      lead_generation: false,
      terms_and_conditions: true,
    } as CreateManagedCampaignRequest);
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${REG_BASE}/brands/brand-2/campaigns`);
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect((last.body as WireBody).sms_use_case).toBe('MARKETING');
    expect((last.body as WireBody).name).toBe('My Campaign');
  });
});

// ---- Campaigns ---------------------------------------------------------

describe('RegistryCampaigns', () => {
  it('get_uses_id_in_path', async () => {
    const body = await client.registry.campaigns.get('camp-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${REG_BASE}/campaigns/camp-1`);
  });

  it('update_uses_put', async () => {
    // UpdateCampaignRequest exposes only `name`.
    const body = await client.registry.campaigns.update('camp-2', {
      name: 'Updated Campaign',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.path).toBe(`${REG_BASE}/campaigns/camp-2`);
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect((last.body as WireBody).name).toBe('Updated Campaign');
  });

  it('list_numbers_uses_numbers_subpath', async () => {
    const body = await client.registry.campaigns.listNumbers('camp-3');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${REG_BASE}/campaigns/camp-3/numbers`);
    expect(last.matched_route).not.toBeNull();
  });

  it('create_order_posts_to_orders_subpath', async () => {
    // Generated createOrder is createOrder(id, options?: { phone_numbers?, ... });
    // the wire field is the spec field name `phone_numbers`.
    const body = await client.registry.campaigns.createOrder('camp-4', {
      phone_numbers: ['pn-1', 'pn-2'],
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${REG_BASE}/campaigns/camp-4/orders`);
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect((last.body as WireBody).phone_numbers).toEqual(['pn-1', 'pn-2']);
  });
});

// ---- Orders ------------------------------------------------------------

describe('RegistryOrders', () => {
  it('get_uses_id_in_path', async () => {
    const body = await client.registry.orders.get('order-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe(`${REG_BASE}/orders/order-1`);
    expect(last.matched_route).not.toBeNull();
  });
});

// ---- Numbers -----------------------------------------------------------

describe('RegistryNumbers', () => {
  it('delete_uses_id_in_path', async () => {
    const body = await client.registry.numbers.delete('num-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe(`${REG_BASE}/numbers/num-1`);
    expect(last.matched_route).not.toBeNull();
  });
});
