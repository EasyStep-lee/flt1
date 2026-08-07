import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const migrationPath = path.join(
  repositoryRoot,
  'packages',
  'db',
  'prisma',
  'migrations',
  '20260806090000_company_fixed_workspaces',
  'migration.sql',
);

const expected = [
  ['COMPANY_SUPER_ADMIN', '/company-admin/workspaces/system'],
  ['COMPANY_SUPPLIER_OPS', '/company-admin/workspaces/supplier-ops'],
  ['COMPANY_PRODUCT_OPS', '/company-admin/workspaces/product-ops'],
  ['COMPANY_PRICE_REVIEW', '/company-admin/workspaces/price-review'],
  ['COMPANY_ORDER_SERVICE', '/company-admin/workspaces/order-service'],
  ['COMPANY_WELFARE_CARD', '/company-admin/workspaces/welfare-card'],
  ['COMPANY_FINANCE', '/company-admin/workspaces/finance'],
  ['COMPANY_LOGISTICS', '/company-admin/workspaces/logistics'],
  ['COMPANY_CONTENT', '/company-admin/workspaces/content'],
  ['COMPANY_AUDIT', '/company-admin/workspaces/audit'],
];

test('M1-P067 seeds ten immutable company workspace allowlist entries', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const [code, route] of expected) {
    assert.match(sql, new RegExp(`'${code}'[\\s\\S]*?'${route}'`, 'u'));
  }
  assert.equal((sql.match(/'COMPANY'/gu) ?? []).length, 10);
  assert.match(sql, /internal_menu_schema/iu);
  assert.doesNotMatch(sql, /supplier_store|franchise|personal_recharge/iu);
});
