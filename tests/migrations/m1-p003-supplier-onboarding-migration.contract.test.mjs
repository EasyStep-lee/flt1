import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const schemaPath = path.join(repositoryRoot, 'packages', 'db', 'prisma', 'schema.prisma');
const migrationPath = path.join(
  repositoryRoot,
  'packages',
  'db',
  'prisma',
  'migrations',
  '20260805090000_supplier_onboarding',
  'migration.sql',
);

test('M1-P003 persists the frozen supplier and approval fields with optimistic versions', async () => {
  const schema = await readFile(schemaPath, 'utf8');

  assert.match(schema, /enum SupplierStatus[\s\S]*DRAFT[\s\S]*CORRECTION_REQUIRED[\s\S]*ACTIVE/u);
  assert.match(schema, /model Supplier[\s\S]*creditCode\s+String\s+@unique/u);
  assert.match(schema, /pickupLat\s+Decimal\?/u);
  assert.match(schema, /pickupLng\s+Decimal\?/u);
  assert.match(schema, /qualificationSnapshot\s+Json/u);
  assert.match(schema, /version\s+Int\s+@default\(0\)/u);
  assert.match(schema, /model ApprovalTask[\s\S]*approvalType[\s\S]*applicantId[\s\S]*reviewedBy/u);
  assert.match(schema, /model SupplierStatusHistory[\s\S]*fromStatus[\s\S]*toStatus[\s\S]*event/u);
});

test('MIG-004 supplier onboarding migration enforces uniqueness, ownership and append-only evidence', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /CREATE TABLE `supplier`/u);
  assert.match(sql, /UNIQUE INDEX `supplier_credit_code_key`/u);
  assert.match(sql, /FOREIGN KEY \(`company_id`\).*REFERENCES `company`/su);
  assert.match(sql, /DECIMAL\(10, 7\)/u);
  assert.match(sql, /CREATE TABLE `approval_task`/u);
  assert.match(sql, /CREATE TABLE `supplier_status_history`/u);
  assert.doesNotMatch(sql, /franchise|storefront|payment|product|settlement_amount/iu);
});

test('the real product migration rehearsal probes supplier onboarding constraints', async () => {
  const rehearsal = await readFile(
    path.join(repositoryRoot, 'scripts', 'prisma-migration-rehearsal.mjs'),
    'utf8',
  );

  assert.match(rehearsal, /SUPPLIER_DUPLICATE_CREDIT_CODE_ACCEPTED/u);
  assert.match(rehearsal, /SUPPLIER_HISTORY_VERSION_DUPLICATE_ACCEPTED/u);
  assert.match(rehearsal, /supplierOnboarding/u);
  assert.match(rehearsal, /M1-P003/u);
});
