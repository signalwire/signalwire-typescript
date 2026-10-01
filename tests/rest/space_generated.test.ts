/**
 * AUTO-GENERATED REST wire tests for the `space` namespace — DO NOT EDIT.
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

describe('space wire (generated)', () => {
  it('balance_createTopUp success', async () => {
    await client.space.balance.createTopUp('x', 1, 'x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('space.create_top_up');
  });

  it('balance_createTopUp error', async () => {
    await mock.pushScenario('space.create_top_up', 500, { error: 'x' });
    await expect(client.space.balance.createTopUp('x', 1, 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('balance_get success', async () => {
    await client.space.balance.get();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_balance');
  });

  it('balance_get error', async () => {
    await mock.pushScenario('space.get_balance', 500, { error: 'x' });
    await expect(client.space.balance.get()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('billingProfile_get success', async () => {
    await client.space.billingProfile.get();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_billing_profile');
  });

  it('billingProfile_get error', async () => {
    await mock.pushScenario('space.get_billing_profile', 500, { error: 'x' });
    await expect(client.space.billingProfile.get()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('billingProfile_update success', async () => {
    await client.space.billingProfile.update('x', 'x', 'x', 'x', 'AD', 'x', 'x', [], 'x');
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('space.update_billing_profile');
  });

  it('billingProfile_update error', async () => {
    await mock.pushScenario('space.update_billing_profile', 500, { error: 'x' });
    await expect(
      client.space.billingProfile.update('x', 'x', 'x', 'x', 'AD', 'x', 'x', [], 'x'),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('billingStatements_getCsv success', async () => {
    await client.space.billingStatements.getCsv();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_billing_statement_csv');
  });

  it('billingStatements_getCsv error', async () => {
    await mock.pushScenario('space.get_billing_statement_csv', 500, { error: 'x' });
    await expect(client.space.billingStatements.getCsv()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('billingStatements_get success', async () => {
    await client.space.billingStatements.get();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_billing_statement');
  });

  it('billingStatements_get error', async () => {
    await mock.pushScenario('space.get_billing_statement', 500, { error: 'x' });
    await expect(client.space.billingStatements.get()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('billingStatements_getPdf success', async () => {
    await client.space.billingStatements.getPdf();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_billing_statement_pdf');
  });

  it('billingStatements_getPdf error', async () => {
    await mock.pushScenario('space.get_billing_statement_pdf', 500, { error: 'x' });
    await expect(client.space.billingStatements.getPdf()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('billingStatements_list success', async () => {
    await client.space.billingStatements.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.list_billing_statement_periods');
  });

  it('billingStatements_list error', async () => {
    await mock.pushScenario('space.list_billing_statement_periods', 500, { error: 'x' });
    await expect(client.space.billingStatements.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('geographicPermissions_get success', async () => {
    await client.space.geographicPermissions.get();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_geographic_permissions');
  });

  it('geographicPermissions_get error', async () => {
    await mock.pushScenario('space.get_geographic_permissions', 500, { error: 'x' });
    await expect(client.space.geographicPermissions.get()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('geographicPermissions_update success', async () => {
    await client.space.geographicPermissions.update([]);
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('space.update_geographic_permissions');
  });

  it('geographicPermissions_update error', async () => {
    await mock.pushScenario('space.update_geographic_permissions', 500, { error: 'x' });
    await expect(client.space.geographicPermissions.update([])).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('lowBalanceSetting_get success', async () => {
    await client.space.lowBalanceSetting.get();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_low_balance_setting');
  });

  it('lowBalanceSetting_get error', async () => {
    await mock.pushScenario('space.get_low_balance_setting', 500, { error: 'x' });
    await expect(client.space.lowBalanceSetting.get()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('lowBalanceSetting_update success', async () => {
    await client.space.lowBalanceSetting.update();
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('space.update_low_balance_setting');
  });

  it('lowBalanceSetting_update error', async () => {
    await mock.pushScenario('space.update_low_balance_setting', 500, { error: 'x' });
    await expect(client.space.lowBalanceSetting.update()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('members_create success', async () => {
    await client.space.members.create({ email: 'x', role: 'admin' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('space.create_member');
  });

  it('members_create error', async () => {
    await mock.pushScenario('space.create_member', 500, { error: 'x' });
    await expect(client.space.members.create({ email: 'x', role: 'admin' })).rejects.toThrow(
      RestError,
    );
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('members_delete success', async () => {
    await client.space.members.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('space.delete_member');
  });

  it('members_delete error', async () => {
    await mock.pushScenario('space.delete_member', 500, { error: 'x' });
    await expect(client.space.members.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('members_disableProject success', async () => {
    await client.space.members.disableProject('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('space.disable_member_project');
  });

  it('members_disableProject error', async () => {
    await mock.pushScenario('space.disable_member_project', 500, { error: 'x' });
    await expect(client.space.members.disableProject('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('members_enableProject success', async () => {
    await client.space.members.enableProject('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('space.enable_member_project');
  });

  it('members_enableProject error', async () => {
    await mock.pushScenario('space.enable_member_project', 500, { error: 'x' });
    await expect(client.space.members.enableProject('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('members_get success', async () => {
    await client.space.members.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_member');
  });

  it('members_get error', async () => {
    await mock.pushScenario('space.get_member', 500, { error: 'x' });
    await expect(client.space.members.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('members_list success', async () => {
    await client.space.members.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.list_members');
  });

  it('members_list error', async () => {
    await mock.pushScenario('space.list_members', 500, { error: 'x' });
    await expect(client.space.members.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('members_listProjects success', async () => {
    await client.space.members.listProjects('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.list_member_projects');
  });

  it('members_listProjects error', async () => {
    await mock.pushScenario('space.list_member_projects', 500, { error: 'x' });
    await expect(client.space.members.listProjects('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('members_update success', async () => {
    await client.space.members.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('space.update_member');
  });

  it('members_update error', async () => {
    await mock.pushScenario('space.update_member', 500, { error: 'x' });
    await expect(client.space.members.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('paymentHistory_list success', async () => {
    await client.space.paymentHistory.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.list_payment_history');
  });

  it('paymentHistory_list error', async () => {
    await mock.pushScenario('space.list_payment_history', 500, { error: 'x' });
    await expect(client.space.paymentHistory.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('paymentMethods_delete success', async () => {
    await client.space.paymentMethods.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('space.delete_payment_method');
  });

  it('paymentMethods_delete error', async () => {
    await mock.pushScenario('space.delete_payment_method', 500, { error: 'x' });
    await expect(client.space.paymentMethods.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('paymentMethods_list success', async () => {
    await client.space.paymentMethods.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.list_payment_methods');
  });

  it('paymentMethods_list error', async () => {
    await mock.pushScenario('space.list_payment_methods', 500, { error: 'x' });
    await expect(client.space.paymentMethods.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('settings_get success', async () => {
    await client.space.settings.get();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_space');
  });

  it('settings_get error', async () => {
    await mock.pushScenario('space.get_space', 500, { error: 'x' });
    await expect(client.space.settings.get()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('settings_update success', async () => {
    await client.space.settings.update();
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('space.update_space');
  });

  it('settings_update error', async () => {
    await mock.pushScenario('space.update_space', 500, { error: 'x' });
    await expect(client.space.settings.update()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('usage_get success', async () => {
    await client.space.usage.get();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('space.get_usage');
  });

  it('usage_get error', async () => {
    await mock.pushScenario('space.get_usage', 500, { error: 'x' });
    await expect(client.space.usage.get()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
