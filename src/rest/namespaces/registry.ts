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

  /** List all 10DLC brands in the project. */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /** Register a new 10DLC brand. */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  /** Fetch a brand by ID. */
  async get(brandId: string): Promise<any> {
    return this._http.get(this._path(brandId));
  }

  /** List campaigns registered under a brand. */
  async listCampaigns(brandId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(brandId, 'campaigns'), params);
  }

  /** Register a new campaign under a brand. */
  async createCampaign(brandId: string, body: any): Promise<any> {
    return this._http.post(this._path(brandId, 'campaigns'), body);
  }
}

/** 10DLC campaign management. */
export class RegistryCampaigns extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** Fetch a campaign by ID. */
  async get(campaignId: string): Promise<any> {
    return this._http.get(this._path(campaignId));
  }

  /** Update a campaign's attributes. */
  async update(campaignId: string, body: any): Promise<any> {
    return this._http.put(this._path(campaignId), body);
  }

  /** List the phone numbers assigned to a campaign. */
  async listNumbers(campaignId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(campaignId, 'numbers'), params);
  }

  /** List number-assignment orders for a campaign. */
  async listOrders(campaignId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(campaignId, 'orders'), params);
  }

  /** Create a new number-assignment order against a campaign. */
  async createOrder(campaignId: string, body: any): Promise<any> {
    return this._http.post(this._path(campaignId, 'orders'), body);
  }
}

/** 10DLC assignment order management. */
export class RegistryOrders extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** Fetch a number-assignment order by ID. */
  async get(orderId: string): Promise<any> {
    return this._http.get(this._path(orderId));
  }
}

/** 10DLC number assignment management. */
export class RegistryNumbers extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** Remove a number from a 10DLC campaign assignment. */
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
  readonly brands: RegistryBrands;
  readonly campaigns: RegistryCampaigns;
  readonly orders: RegistryOrders;
  readonly numbers: RegistryNumbers;

  constructor(http: HttpClient) {
    const base = '/api/relay/rest/registry/beta';
    this.brands = new RegistryBrands(http, `${base}/brands`);
    this.campaigns = new RegistryCampaigns(http, `${base}/campaigns`);
    this.orders = new RegistryOrders(http, `${base}/orders`);
    this.numbers = new RegistryNumbers(http, `${base}/numbers`);
  }
}
