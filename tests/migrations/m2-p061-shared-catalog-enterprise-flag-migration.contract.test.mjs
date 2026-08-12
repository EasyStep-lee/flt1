import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../../packages/db/prisma/migrations/20260812080000_m2_shared_catalog_enterprise_flag/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-008A appends immutable Product channel visibility history without a second catalog resource', () => {
  assert.match(sql, /CREATE TABLE `product_channel_visibility_history`/u);
  assert.match(sql, /product_channel_visibility_history_product_version_key/u);
  assert.match(sql, /product_channel_visibility_history_update_guard/u);
  assert.match(sql, /product_channel_visibility_history_delete_guard/u);
  assert.match(sql, /HISTORY_IMMUTABLE/u);
  assert.doesNotMatch(sql, /CREATE TABLE `(?:enterprise|retail)_(?:product|sku|inventory)/iu);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/iu);
});
