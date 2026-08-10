import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL(
    '../../packages/db/prisma/migrations/20260810094000_m2_category_templates/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const schema = await readFile(
  new URL('../../packages/db/prisma/schema.prisma', import.meta.url),
  'utf8',
);

test('M2-P012 persists one draft and one active version with append-only history', () => {
  assert.match(schema, /model CategoryTemplate \{/u);
  assert.match(schema, /status\s+CategoryTemplateStatus/u);
  assert.match(schema, /draftSlot\s+Int\?/u);
  assert.match(schema, /activeSlot\s+Int\?/u);
  assert.match(schema, /model CategoryTemplateHistory \{/u);
  assert.match(schema, /model CategoryTemplateCommand \{/u);
  assert.match(migration, /category_template_category_draft_key/u);
  assert.match(migration, /category_template_category_active_key/u);
  assert.match(migration, /category_template_slot_check/u);
  assert.match(migration, /CREATE TRIGGER `category_template_insert_guard`/u);
  assert.match(migration, /CREATE TRIGGER `category_template_update_guard`/u);
  assert.match(migration, /CREATE TRIGGER `category_template_delete_guard`/u);
  assert.match(migration, /CREATE TRIGGER `category_template_history_immutable_update`/u);
  assert.match(migration, /CREATE TRIGGER `category_template_history_immutable_delete`/u);
});

test('SupplierProduct and Product retain the category-template version snapshot by foreign key', () => {
  assert.match(migration, /ALTER TABLE `supplier_product`[\s\S]*supplier_product_category_template_fkey/u);
  assert.match(migration, /ALTER TABLE `product`[\s\S]*product_category_template_fkey/u);
  assert.match(schema, /template\s+CategoryTemplate\s+@relation\(fields: \[categoryId, templateVersion\]/u);
});
