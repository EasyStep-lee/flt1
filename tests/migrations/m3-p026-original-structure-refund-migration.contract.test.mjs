import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../../packages/db/prisma/migrations/20260814123000_m3_original_structure_refund/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-013 persists approved refund authority, immutable state events and three append-only impacts', () => {
  assert.match(sql, /CREATE TABLE `refund_authorization`/u);
  assert.match(sql, /CREATE TABLE `refund_transaction`/u);
  assert.match(sql, /UNIQUE INDEX `refund_transaction_after_sale_key`/u);
  assert.match(sql, /UNIQUE INDEX `refund_transaction_order_idempotency_key`/u);
  assert.match(sql, /`welfare_card_refund_amount` INTEGER NOT NULL/u);
  assert.match(sql, /`cash_refund_amount` INTEGER NOT NULL/u);
  assert.match(sql, /`original_payment_transaction_id` CHAR\(36\) NULL/u);
  assert.match(sql, /CREATE TABLE `refund_transaction_event`/u);
  assert.match(sql, /refund_transaction_event_update_guard/u);
  assert.match(sql, /refund_transaction_event_delete_guard/u);
  assert.match(sql, /CREATE TABLE `refund_impact_record`/u);
  assert.match(sql, /ENUM\('FINANCIAL','INVENTORY','RECONCILIATION'\)/u);
  assert.match(sql, /refund_impact_record_delete_guard/u);
  assert.match(sql, /refund_impact_record_update_guard/u);
  assert.doesNotMatch(sql, /CREATE TABLE `(?:supplier_wallet|withdrawal|personal_recharge|delivery_task)`/iu);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/iu);
});
