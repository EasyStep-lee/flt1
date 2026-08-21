import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaPath = new URL('../../packages/db/prisma/schema.prisma', import.meta.url);
const migrationPath = new URL(
  '../../packages/db/prisma/migrations/20260821130000_m3_public_business_inquiry/migration.sql',
  import.meta.url,
);

test('M3-P076 migration stores protected contact data and server-owned source/consent fields', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  for (const required of [
    '`contact_mobile_encrypted` VARCHAR(500) NOT NULL',
    "`inquiry_type` = 'ENTERPRISE_WELFARE'",
    "`source_page` = '/welfare-card-service'",
    '`consent_version` = 1',
    'business_inquiry_company_idempotency_key',
    'business_inquiry_company_fkey',
  ]) {
    assert.match(
      migration,
      new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
    );
  }
  assert.doesNotMatch(migration, /\n\s*`mobile`\s+VARCHAR/iu);
});

test('M3-P076 inquiry and its idempotency evidence cannot be overwritten or deleted', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /business_inquiry_no_update/u);
  assert.match(migration, /business_inquiry_no_delete/u);
  assert.match(migration, /BUSINESS_INQUIRY_IMMUTABLE/u);
});

test('M3-P076 Prisma model keeps public response fields separate from protected persistence', async () => {
  const schema = await readFile(schemaPath, 'utf8');
  assert.match(schema, /model BusinessInquiry \{/u);
  assert.match(schema, /contactMobileEncrypted\s+String\s+@map\("contact_mobile_encrypted"\)/u);
  assert.match(schema, /sourcePage\s+String\s+@map\("source_page"\)/u);
  assert.match(schema, /consentVersion\s+Int\s+@map\("consent_version"\)/u);
  assert.doesNotMatch(schema, /model BusinessInquiry \{[^}]*\n\s+mobile\s+String/su);
});
