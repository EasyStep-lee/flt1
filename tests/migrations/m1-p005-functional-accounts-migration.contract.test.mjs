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
  '20260805120000_supplier_functional_accounts',
  'migration.sql',
);

test('M1-P005 persists supplier users, fixed account types and functional accounts', async () => {
  const schema = await readFile(schemaPath, 'utf8');
  assert.match(schema, /model FunctionalAccountType[\s\S]*workspaceRoute[\s\S]*internalMenuSchema/u);
  assert.match(schema, /model SupplierUser[\s\S]*supplierId[\s\S]*mobile[\s\S]*lastLoginAt/u);
  assert.match(schema, /model FunctionalAccount[\s\S]*identityId[\s\S]*accountTypeId[\s\S]*version/u);
  assert.match(schema, /model FunctionalAccountStatusHistory/u);
  assert.match(schema, /model FunctionalAccountCommand/u);
});

test('MIG-002 forward migration seeds exactly eight immutable supplier workspace mappings', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const [code, route] of [
    ['SUPPLIER_ACCOUNT_ADMIN', '/supplier/workspaces/account-admin'],
    ['SUPPLIER_PRODUCT', '/supplier/workspaces/products'],
    ['SUPPLIER_PRICING', '/supplier/workspaces/pricing'],
    ['SUPPLIER_INVENTORY', '/supplier/workspaces/inventory'],
    ['SUPPLIER_FULFILLMENT', '/supplier/workspaces/fulfillment'],
    ['SUPPLIER_AFTERSALES', '/supplier/workspaces/aftersales'],
    ['SUPPLIER_FINANCE', '/supplier/workspaces/finance'],
    ['SUPPLIER_AUDIT', '/supplier/workspaces/audit'],
  ]) {
    assert.match(sql, new RegExp(`${code}[\\s\\S]*${route}`, 'u'));
  }
  assert.match(sql, /UNIQUE INDEX `functional_account_type_owner_code_key`/u);
  assert.match(sql, /UNIQUE INDEX `functional_account_supplier_identity_type_key`/u);
  assert.match(sql, /FOREIGN KEY \(`supplier_id`\).*REFERENCES `supplier`/su);
  assert.doesNotMatch(sql, /franchise|storefront|payment|product_price/iu);
});

test('the real product rehearsal verifies functional account tables, routes and ownership', async () => {
  const rehearsal = await readFile(
    path.join(repositoryRoot, 'scripts', 'prisma-migration-rehearsal.mjs'),
    'utf8',
  );
  assert.match(rehearsal, /activeSupplierAccountTypeCount === 8/u);
  assert.match(rehearsal, /uniqueSupplierWorkspaceRouteCount === 8/u);
  assert.match(rehearsal, /functionalAccountForeignKeyCount === 5/u);
  assert.match(rehearsal, /taskId: 'M1-P005'/u);
});
