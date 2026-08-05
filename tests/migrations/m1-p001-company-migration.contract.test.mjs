import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const schemaPath = path.join(
  repositoryRoot,
  'packages',
  'db',
  'prisma',
  'schema.prisma',
);
const baselineMigrationPath = path.join(
  repositoryRoot,
  'packages',
  'db',
  'prisma',
  'migrations',
  '20260804065500_engineering_baseline',
  'migration.sql',
);
const companyMigrationPath = path.join(
  repositoryRoot,
  'packages',
  'db',
  'prisma',
  'migrations',
  '20260804065600_company_single_merchant',
  'migration.sql',
);

test('M1-P001 adds the frozen Company model without a credential default', async () => {
  const schema = await readFile(schemaPath, 'utf8');

  assert.match(schema, /enum CompanyStatus[\s\S]*ACTIVE[\s\S]*SUSPENDED/u);
  assert.match(schema, /model Company[\s\S]*legalName[\s\S]*platformName/u);
  assert.match(schema, /wechatPayConfigRef\s+String/u);
  assert.match(schema, /legalName\s+String\s+@unique/u);
  assert.match(schema, /platformName\s+String\s+@unique/u);
  assert.doesNotMatch(schema, /wechatPayConfigRef[^\n]*@default/iu);
});

test('MIG-001 freezes database encoding and MIG-002 enforces one fixed merchant', async () => {
  const [baselineSql, companySql] = await Promise.all([
    readFile(baselineMigrationPath, 'utf8'),
    readFile(companyMigrationPath, 'utf8'),
  ]);

  assert.match(baselineSql, /ALTER DATABASE[\s\S]*utf8mb4_0900_ai_ci/iu);
  assert.match(companySql, /CREATE TABLE `company`/u);
  assert.match(companySql, /UNIQUE INDEX `company_legal_name_key`/u);
  assert.match(companySql, /UNIQUE INDEX `company_platform_name_key`/u);
  assert.match(
    companySql,
    /CONSTRAINT `chk_company_legal_name`[\s\S]*?CHECK/u,
  );
  assert.match(companySql, /江苏福礼团供应链科技有限公司/u);
  assert.match(
    companySql,
    /CONSTRAINT `chk_company_platform_name`[\s\S]*?CHECK/u,
  );
  assert.match(companySql, /福礼社/u);
  assert.doesNotMatch(companySql, /INSERT|secret|password|placeholder/iu);
});

test('the migration dry-run deploys and probes the real product chain', async () => {
  const rehearsal = await readFile(
    path.join(repositoryRoot, 'scripts', 'prisma-migration-rehearsal.mjs'),
    'utf8',
  );

  assert.match(rehearsal, /product database full-chain deploy/u);
  assert.match(rehearsal, /SINGLE_MERCHANT_SECOND_ROW_ACCEPTED/u);
  assert.match(rehearsal, /SINGLE_MERCHANT_FIXED_NAME_NOT_ENFORCED/u);
  assert.match(rehearsal, /productRehearsal/u);
});
