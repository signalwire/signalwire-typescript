/**
 * 10DLC Campaign Registry namespace — brands, campaigns, orders, numbers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';

/** 10DLC brand management. */
export class RegistryBrands extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List all 10DLC brands in the project.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of brands.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Register a new 10DLC brand.
   *
   * @param body - Brand registration payload (EIN, legal name, etc.).
   * @returns The newly-registered brand record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  /**
   * Fetch a brand by ID.
   *
   * @param brandId - Unique identifier of the brand.
   * @returns The brand record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(brandId: string): Promise<any> {
    return this._http.get(this._path(brandId));
  }

  /**
   * List campaigns registered under a brand.
   *
   * @param brandId - Unique identifier of the brand.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of campaigns.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listCampaigns(brandId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(brandId, 'campaigns'), params);
  }

  /**
   * Register a new campaign under a brand.
   *
   * @param brandId - Unique identifier of the brand.
   * @param body - Campaign registration payload (use case, sample messages, etc.).
   * @returns The newly-registered campaign record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createCampaign(brandId: string, body: any): Promise<any> {
    return this._http.post(this._path(brandId, 'campaigns'), body);
  }
}

/** 10DLC campaign management. */
export class RegistryCampaigns extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Fetch a campaign by ID.
   *
   * @param campaignId - Unique identifier of the campaign.
   * @returns The campaign record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(campaignId: string): Promise<any> {
    return this._http.get(this._path(campaignId));
  }

  /**
   * Update a campaign's attributes.
   *
   * @param campaignId - Unique identifier of the campaign.
   * @param body - Full updated campaign attributes (replace semantics).
   * @returns The updated campaign record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(campaignId: string, body: any): Promise<any> {
    return this._http.put(this._path(campaignId), body);
  }

  /**
   * List the phone numbers assigned to a campaign.
   *
   * @param campaignId - Unique identifier of the campaign.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of assigned numbers.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listNumbers(campaignId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(campaignId, 'numbers'), params);
  }

  /**
   * List number-assignment orders for a campaign.
   *
   * @param campaignId - Unique identifier of the campaign.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of number-assignment orders.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listOrders(campaignId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(campaignId, 'orders'), params);
  }

  /**
   * Create a new number-assignment order against a campaign.
   *
   * @param campaignId - Unique identifier of the campaign.
   * @param body - Order payload (phone number IDs, etc.).
   * @returns The newly-created order record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createOrder(campaignId: string, body: any): Promise<any> {
    return this._http.post(this._path(campaignId, 'orders'), body);
  }
}

/** 10DLC assignment order management. */
export class RegistryOrders extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Fetch a number-assignment order by ID.
   *
   * @param orderId - Unique identifier of the order.
   * @returns The order record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(orderId: string): Promise<any> {
    return this._http.get(this._path(orderId));
  }
}

/** 10DLC number assignment management. */
export class RegistryNumbers extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Remove a number from a 10DLC campaign assignment.
   *
   * @param numberId - Unique identifier of the assigned number.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(numberId: string): Promise<any> {
    return this._http.delete(this._path(numberId));
  }
}

/**
 * 10DLC Campaign Registry namespace.
 *
 * Access via `client.registry.*`. Groups brand, campaign, order, and number
 * resources for US A2P 10DLC compliance registration.
 */
export class RegistryNamespace {
  /** 10DLC brand CRUD and nested campaign operations. */
  readonly brands: RegistryBrands;
  /** 10DLC campaign CRUD, number listing, and order management. */
  readonly campaigns: RegistryCampaigns;
  /** 10DLC number-assignment order read access. */
  readonly orders: RegistryOrders;
  /** 10DLC number assignment removal. */
  readonly numbers: RegistryNumbers;

  constructor(http: HttpClient) {
    const base = '/api/relay/rest/registry/beta';
    this.brands = new RegistryBrands(http, `${base}/brands`);
    this.campaigns = new RegistryCampaigns(http, `${base}/campaigns`);
    this.orders = new RegistryOrders(http, `${base}/orders`);
    this.numbers = new RegistryNumbers(http, `${base}/numbers`);
  }
}
