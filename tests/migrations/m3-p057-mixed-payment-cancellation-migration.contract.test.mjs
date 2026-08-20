import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../../packages/db/prisma/migrations/20260817090000_m3_mixed_payment_cancellation/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-012C appends constrained unknown and cancelled payment audit events without replacing history', () => {
  assert.match(sql, /PAYMENT_UNKNOWN/u);
  assert.match(sql, /PAYMENT_CANCELLED/u);
  assert.match(sql, /`PAYMENT_UNKNOWN`|PAYMENT_UNKNOWN/u);
  assert.match(sql, /to_status` = 'PENDING_PAYMENT'/u);
  assert.match(sql, /to_status` = 'CANCELLED'/u);
  assert.match(sql, /version` > 0/u);
  assert.doesNotMatch(sql, /DELETE FROM|UPDATE `buyer_order_event`|TRUNCATE|DROP TABLE/iu);
  assert.doesNotMatch(sql, /ALIPAY|PERSONAL_RECHARGE|supplier_wallet|delivery_task/iu);
});
