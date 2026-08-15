import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL(
    '../../packages/db/prisma/migrations/20260815020000_m3_enterprise_identity_profile/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

test('MIG-011 persists isolated enterprise certification and append-only evidence', () => {
  for (const table of [
    'enterprise_customer',
    'enterprise_user',
    'enterprise_address',
    'enterprise_invoice_profile',
    'enterprise_customer_status_history',
    'enterprise_certification_snapshot',
    'enterprise_procurement_profile',
    'enterprise_onboarding_command',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${String.fromCharCode(96)}${table}${String.fromCharCode(96)}`, 'u'));
  }
  assert.match(sql, /enterprise_customer_credit_code_key/u);
  assert.match(sql, /enterprise_status_history_enterprise_version_key/u);
  assert.match(sql, /enterprise_cert_snapshot_enterprise_version_key/u);
  assert.match(sql, /enterprise_onboarding_command_scope_key/u);
  assert.match(sql, /ENTERPRISE_STATUS_HISTORY_IMMUTABLE/u);
  assert.match(sql, /ENTERPRISE_CERTIFICATION_SNAPSHOT_IMMUTABLE/u);
  assert.match(sql, /ENTERPRISE_ONBOARDING_COMMAND_IMMUTABLE/u);
  assert.match(sql, /ON DELETE RESTRICT/u);
  assert.doesNotMatch(sql, /CREATE TABLE `(?:supplier_wallet|delivery_task)`/iu);
  assert.doesNotMatch(sql, /PERSONAL_RECHARGE|ALIPAY/iu);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/iu);
});
