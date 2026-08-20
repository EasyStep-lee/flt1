import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../../packages/db/prisma/migrations/20260820050000_m3_mixed_payment_split_refund/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-013A binds each REFUND/CREDIT welfare ledger to one refund transaction without rewriting history', () => {
  assert.match(sql, /welfare_card_ledger_refund_fkey/u);
  assert.match(sql, /FOREIGN KEY \(`refund_id`\) REFERENCES `refund_transaction`\(`id`\)/u);
  assert.match(sql, /ON DELETE RESTRICT ON UPDATE RESTRICT/u);
  assert.match(sql, /welfare_card_ledger_refund_business_key/u);
  assert.match(sql, /UNIQUE INDEX[^;]+\(`refund_id`, `business_type`\)/u);
  assert.match(sql, /`refund_id` IS NOT NULL AND `business_type` = 'REFUND' AND `direction` = 'CREDIT'/u);
  assert.doesNotMatch(sql, /UPDATE `welfare_card_ledger`|DELETE FROM|TRUNCATE|DROP TABLE/iu);
  assert.doesNotMatch(sql, /PERSONAL_RECHARGE|supplier_wallet|withdrawal|delivery_task/iu);
});
