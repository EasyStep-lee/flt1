import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../../packages/db/prisma/migrations/20260814092000_m3_company_unified_checkout/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-012B persists versioned enterprise remittance submission and immutable company review', () => {
  assert.match(sql, /CREATE TABLE `enterprise_remittance_submission`/u);
  assert.match(sql, /UNIQUE INDEX `enterprise_remittance_order_version_key`/u);
  assert.match(sql, /UNIQUE INDEX `enterprise_remittance_order_idempotency_key`/u);
  assert.match(sql, /CREATE TABLE `enterprise_remittance_review`/u);
  assert.match(sql, /`actor_type` ENUM\('CONSUMER','ENTERPRISE','COMPANY'\)/u);
  assert.match(sql, /REMITTANCE_SUBMITTED/u);
  assert.match(sql, /REMITTANCE_CONFIRMED/u);
  assert.match(sql, /REMITTANCE_REJECTED/u);
  assert.match(sql, /enterprise_remittance_review_update_guard/u);
  assert.match(sql, /enterprise_remittance_review_delete_guard/u);
  assert.doesNotMatch(sql, /ALIPAY|PERSONAL_RECHARGE/iu);
  assert.doesNotMatch(sql, /CREATE TABLE `(?:delivery_task|enterprise_delivery_order|supplier_wallet)`/iu);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/iu);
});
