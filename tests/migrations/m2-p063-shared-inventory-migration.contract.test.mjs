import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../../packages/db/prisma/migrations/20260812100000_m2_shared_inventory_balance/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-009 creates one non-negative versioned balance per platform SKU and immutable arithmetic history', () => {
  assert.match(sql, /CREATE TABLE `inventory_balance`/u);
  assert.match(sql, /UNIQUE INDEX `inventory_balance_sku_key` \(`sku_id`\)/u);
  assert.match(sql, /inventory_balance_non_negative_check/u);
  assert.match(sql, /inventory_change_log_arithmetic_check/u);
  assert.match(sql, /inventory_change_log_balance_version_key/u);
  assert.match(sql, /inventory_change_log_update_guard/u);
  assert.match(sql, /inventory_change_log_delete_guard/u);
  assert.match(sql, /JOIN `supplier_product_sku`/u);
  assert.doesNotMatch(sql, /CREATE TABLE `(?:retail|enterprise|supplier_product)_inventory/iu);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/iu);
});
