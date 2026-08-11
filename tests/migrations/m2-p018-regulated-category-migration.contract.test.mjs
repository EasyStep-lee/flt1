import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(
  new URL('../../packages/db/prisma/migrations/20260811110000_m2_regulated_category_controls/migration.sql', import.meta.url),
  'utf8',
);

test('MIG-012 persists default-deny control, qualification expiry, append-only history and product category scope', () => {
  assert.match(sql, /regulatory_mode[^;]+STANDARD/isu);
  assert.match(sql, /CREATE TABLE `regulated_category_control`/u);
  assert.match(sql, /status[^;]+DISABLED/isu);
  assert.match(sql, /company_qualification_valid_until/u);
  assert.match(sql, /qualification_valid_until/u);
  assert.match(sql, /regulated_category_control_history_immutable_update/u);
  assert.match(sql, /regulated_category_control_history_immutable_delete/u);
  assert.match(sql, /regulated_category_control_command_scope_key/u);
  assert.match(sql, /product_category_fkey/u);
  assert.match(sql, /REGULATED_CATEGORY_TARGET_INVALID/u);
  assert.match(sql, /NEW\.`regulatory_mode` <> OLD\.`regulatory_mode`/u);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|TRUNCATE/iu);
});
