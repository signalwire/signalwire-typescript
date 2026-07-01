import { HttpClient } from '../../src/rest/HttpClient.js';
import { RegistryNamespace } from '../../src/rest/namespaces/registry.js';
import { mockClientOptions, type MockResponse } from './helpers.js';
import type {
  CreateManagedBrandRequest,
  CreateManagedCampaignRequest,
} from '../../src/rest/namespaces/relay-rest.types.generated.js';

describe('RegistryNamespace', () => {
  function setup(responses: MockResponse[] = [{ status: 200, body: { data: [] } }]) {
    const { options, getRequests } = mockClientOptions(responses);
    const http = new HttpClient(options);
    const registry = new RegistryNamespace(http);
    return { registry, getRequests };
  }

  describe('Brands', () => {
    it('lists brands', async () => {
      const { registry, getRequests } = setup();
      await registry.brands.list();
      expect(getRequests()[0]!.url).toContain('/api/relay/rest/registry/beta/brands');
    });

    it('creates a brand', async () => {
      const { registry, getRequests } = setup([{ status: 200, body: { id: 'b1' } }]);
      await registry.brands.create({ name: 'Acme' } as unknown as CreateManagedBrandRequest);
      expect(getRequests()[0]!.method).toBe('POST');
    });

    it('gets a brand', async () => {
      const { registry, getRequests } = setup([{ status: 200, body: { id: 'b1' } }]);
      await registry.brands.get('b1');
      expect(getRequests()[0]!.url).toContain('/brands/b1');
    });

    it('lists campaigns for a brand', async () => {
      const { registry, getRequests } = setup();
      await registry.brands.listCampaigns('b1');
      expect(getRequests()[0]!.url).toContain('/brands/b1/campaigns');
    });

    it('creates a campaign for a brand', async () => {
      const { registry, getRequests } = setup([{ status: 200, body: { id: 'c1' } }]);
      // `use_case` is not a typed spec field (the spec field is sms_use_case),
      // so route it through createCampaign's `extras` escape hatch.
      await registry.brands.createCampaign('b1', {} as CreateManagedCampaignRequest, {
        use_case: 'marketing',
      });
      expect(getRequests()[0]!.method).toBe('POST');
      expect(getRequests()[0]!.url).toContain('/brands/b1/campaigns');
    });
  });

  describe('Campaigns', () => {
    it('gets a campaign', async () => {
      const { registry, getRequests } = setup([{ status: 200, body: { id: 'c1' } }]);
      await registry.campaigns.get('c1');
      expect(getRequests()[0]!.url).toContain('/campaigns/c1');
    });

    it('updates a campaign with PUT', async () => {
      const { registry, getRequests } = setup([{ status: 200, body: {} }]);
      // `description` travels via the extras escape hatch (update is
      // update(id, name?, extras?); description is not a typed positional field).
      await registry.campaigns.update('c1', undefined, { description: 'updated' });
      expect(getRequests()[0]!.method).toBe('PUT');
    });

    it('lists numbers for a campaign', async () => {
      const { registry, getRequests } = setup();
      await registry.campaigns.listNumbers('c1');
      expect(getRequests()[0]!.url).toContain('/campaigns/c1/numbers');
    });

    it('lists orders for a campaign', async () => {
      const { registry, getRequests } = setup();
      await registry.campaigns.listOrders('c1');
      expect(getRequests()[0]!.url).toContain('/campaigns/c1/orders');
    });

    it('creates an order for a campaign', async () => {
      const { registry, getRequests } = setup([{ status: 200, body: { id: 'o1' } }]);
      await registry.campaigns.createOrder('c1', ['n1']);
      expect(getRequests()[0]!.method).toBe('POST');
    });
  });

  describe('Orders', () => {
    it('gets an order', async () => {
      const { registry, getRequests } = setup([{ status: 200, body: { id: 'o1' } }]);
      await registry.orders.get('o1');
      expect(getRequests()[0]!.url).toContain('/orders/o1');
    });
  });

  describe('Numbers', () => {
    it('deletes a number assignment', async () => {
      const { registry, getRequests } = setup([{ status: 204 }]);
      await registry.numbers.delete('n1');
      expect(getRequests()[0]!.method).toBe('DELETE');
      expect(getRequests()[0]!.url).toContain('/numbers/n1');
    });
  });
});
