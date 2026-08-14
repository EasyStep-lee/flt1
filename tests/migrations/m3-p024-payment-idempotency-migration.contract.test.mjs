import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../../packages/db/prisma/migrations/20260814053000_m3_payment_idempotency/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-012A creates unique payment identities, immutable notifications and one paid outbox version', () => {
  assert.match(sql, /CREATE TABLE `payment_transaction`/u);
  assert.match(sql, /UNIQUE INDEX `payment_transaction_order_key` \(`order_id`\)/u);
  assert.match(sql, /UNIQUE INDEX `payment_transaction_out_trade_no_key` \(`out_trade_no`\)/u);
  assert.match(sql, /UNIQUE INDEX `payment_transaction_wechat_transaction_key` \(`wechat_transaction_id`\)/u);
  assert.match(sql, /CREATE TABLE `order_payment_allocation`/u);
  assert.match(sql, /order_payment_allocation_amount_check/u);
  assert.match(sql, /CREATE TABLE `payment_notification`/u);
  assert.match(sql, /payment_notification_update_guard/u);
  assert.match(sql, /payment_notification_delete_guard/u);
  assert.match(sql, /UNIQUE INDEX `payment_outbox_order_event_version_key`/u);
  assert.match(sql, /'BUYER_ORDER_PAID_V1'|`event_type`/u);
  assert.match(sql, /PAYMENT_CONFIRMED/u);
  assert.doesNotMatch(sql, /CREATE TABLE `(?:delivery_task|enterprise_delivery_order|welfare_card_ledger)`/iu);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/iu);
});
