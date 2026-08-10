import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL(
    '../../packages/db/prisma/migrations/20260810062000_m2_category_tree/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const schema = await readFile(
  new URL('../../packages/db/prisma/schema.prisma', import.meta.url),
  'utf8',
);

test('M2-P011 migration creates a three-level company category with append-only history and commands', () => {
  assert.match(schema, /model Category \{/u);
  assert.match(schema, /companyId\s+String/u);
  assert.match(schema, /parentId\s+String\?/u);
  assert.match(schema, /status\s+CategoryStatus/u);
  assert.match(schema, /model CategoryHistory \{/u);
  assert.match(schema, /model CategoryCommand \{/u);
  assert.match(migration, /CONSTRAINT `category_level_check` CHECK \(`level` >= 1 AND `level` <= 3\)/u);
  assert.match(migration, /CREATE TRIGGER `category_parent_insert_guard`/u);
  assert.match(migration, /CREATE TRIGGER `category_parent_update_guard`/u);
  assert.match(migration, /CREATE TRIGGER `category_reference_delete_guard`/u);
  assert.match(migration, /supplier_product/u);
  assert.match(migration, /CREATE TRIGGER `category_history_immutable_update`/u);
  assert.match(migration, /CREATE TRIGGER `category_history_immutable_delete`/u);
  assert.doesNotMatch(migration, /category_template/iu);
});
