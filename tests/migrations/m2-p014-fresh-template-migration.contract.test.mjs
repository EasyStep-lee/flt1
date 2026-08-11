import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL(
    '../../packages/db/prisma/migrations/20260810213000_m2_fresh_template_profile/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const immutableProfileMigration = await readFile(
  new URL(
    '../../packages/db/prisma/migrations/20260810110000_m2_food_template_profile/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

test('M2-P014 expands the existing profile constraint only through a forward migration', () => {
  assert.match(migration, /DROP CHECK `category_template_profile_check`/u);
  assert.match(
    migration,
    /CHECK \(`profile` IN \('GENERIC', 'FOOD', 'FRESH'\)\)/u,
  );
  assert.doesNotMatch(migration, /UPDATE `category_template`|APPAREL|DIGITAL|GIFT_BOX/iu);
});

test('M2-P014 retains the published profile and JSON immutability trigger', () => {
  assert.match(immutableProfileMigration, /NEW\.`profile` <> OLD\.`profile`/u);
  assert.match(immutableProfileMigration, /NEW\.`field_schema` <=> OLD\.`field_schema`/u);
  assert.match(immutableProfileMigration, /NEW\.`after_sale_rules` <=> OLD\.`after_sale_rules`/u);
  assert.match(
    immutableProfileMigration,
    /SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_TEMPLATE_IMMUTABLE'/u,
  );
});
