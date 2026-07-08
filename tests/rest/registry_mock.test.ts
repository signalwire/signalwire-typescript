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
    // `usecase` is not a typed spec field (the spec field is sms_use_case), so
    // like the campaigns.update test below, the arbitrary fields this wire test
    // forwards travel through the `extras` escape hatch. The body arg is the
    // required union; we send an empty typed body and let extras carry the wire.
    const body = await client.registry.brands.createCampaign(
      'brand-2',
      {} as CreateManagedCampaignRequest,
      { usecase: 'LOW_VOLUME', description: 'MFA' },
    );
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(`${REG_BASE}/brands/brand-2/campaigns`);
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect((last.body as WireBody).usecase).toBe('LOW_VOLUME');
    expect((last.body as WireBody).description).toBe('MFA');
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
    // Generated update is update(id, options?: { name?; extras? }). `description`
    // is not a typed spec field, so it travels via the extras escape hatch.
    const body = await client.registry.campaigns.update('camp-2', {
      extras: { description: 'Updated' },
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.path).toBe(`${REG_BASE}/campaigns/camp-2`);
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect((last.body as WireBody).description).toBe('Updated');
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
