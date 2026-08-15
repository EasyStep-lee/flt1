import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  new URL('../../packages/db/prisma/migrations/20260815030000_m3_enterprise_procurement_order/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-015 persists immutable enterprise checkout snapshots and one frozen payment route', () => {
  assert.match(sql, /CREATE TABLE `enterprise_procurement_order`/u);
  assert.match(sql, /UNIQUE INDEX `enterprise_procurement_order_buyer_order_id_key` \(`buyer_order_id`\)/u);
  assert.match(sql, /`payment_method` ENUM\('WECHAT_PAY','BANK_TRANSFER'\) NOT NULL/u);
  assert.match(sql, /`invoice_profile_snapshot` JSON NOT NULL/u);
  assert.match(sql, /`enterprise_address_snapshot` JSON NOT NULL/u);
  assert.match(sql, /enterprise_procurement_order_snapshot_immutable_update/u);
  assert.match(sql, /enterprise_procurement_order_immutable_delete/u);
  assert.match(sql, /ENTERPRISE_PROCUREMENT_SNAPSHOT_IMMUTABLE/u);
  assert.doesNotMatch(sql, /ALIPAY|PERSONAL_RECHARGE|delivery_task|supplier_wallet|withdraw/iu);
});
