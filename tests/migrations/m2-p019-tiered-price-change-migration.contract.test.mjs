import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../../packages/db/prisma/migrations/20260812013000_m2_tiered_price_changes/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-013 persists reviewed supply changes, approval-free price logs and durable scheduled effects', () => {
  assert.match(sql, /CREATE TABLE `supply_price_change_request`/u);
  assert.match(sql, /CREATE TABLE `supply_price_change_history`/u);
  assert.match(sql, /CREATE TABLE `price_change_log`/u);
  assert.match(sql, /CREATE TABLE `price_effect_outbox`/u);
  assert.match(sql, /CREATE TABLE `price_change_command`/u);
  assert.match(sql, /review_status[^;]+NOT_REQUIRED/isu);
  assert.match(sql, /price_change_log_sku_type_version_key/u);
  assert.match(sql, /price_effect_outbox_business_key/u);
  assert.match(sql, /supply_price_change_history_update_guard/u);
  assert.match(sql, /price_change_log_update_guard/u);
  assert.match(sql, /supply_price_change_request_update_guard/u);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/iu);
});
