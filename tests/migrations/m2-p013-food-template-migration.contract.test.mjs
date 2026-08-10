import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL(
    '../../packages/db/prisma/migrations/20260810110000_m2_food_template_profile/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const schema = await readFile(
  new URL('../../packages/db/prisma/schema.prisma', import.meta.url),
  'utf8',
);

test('M2-P013 migrates existing templates to GENERIC and restricts the profile to this slice', () => {
  assert.match(schema, /profile\s+String\s+@default\("GENERIC"\)\s+@db\.VarChar\(32\)/u);
  assert.match(migration, /ADD COLUMN `profile` VARCHAR\(32\) NOT NULL DEFAULT 'GENERIC'/u);
  assert.match(migration, /CHECK \(`profile` IN \('GENERIC', 'FOOD'\)\)/u);
  assert.doesNotMatch(migration, /FRESH|APPAREL|DIGITAL|GIFT_BOX/iu);
});

test('M2-P013 keeps a published template profile immutable with its JSON definition', () => {
  assert.match(migration, /DROP TRIGGER `category_template_update_guard`/u);
  assert.match(migration, /CREATE TRIGGER `category_template_update_guard`/u);
  assert.match(migration, /NEW\.`profile` <> OLD\.`profile`/u);
  assert.match(migration, /NEW\.`field_schema` <=> OLD\.`field_schema`/u);
  assert.match(migration, /SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_TEMPLATE_IMMUTABLE'/u);
});
