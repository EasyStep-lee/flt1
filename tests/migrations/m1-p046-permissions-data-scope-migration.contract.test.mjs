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
  '20260806033000_permissions_data_scope',
  'migration.sql',
);

test('M1-P046 schema implements the four frozen permission and scope models', async () => {
  const schema = await readFile(schemaPath, 'utf8');
  for (const model of [
    'Permission',
    'FunctionalAccountPermission',
    'DataScopePolicy',
    'FieldAccessPolicy',
  ]) {
    assert.match(schema, new RegExp(`model ${model}\\b`, 'u'));
  }
  assert.match(schema, /enum FieldAccessMode[\s\S]*HIDDEN[\s\S]*MASKED[\s\S]*VISIBLE_WITH_AUDIT[\s\S]*APPROVED_EXPORT_ONLY/u);
  assert.match(schema, /model FieldAccessPolicy[\s\S]*accessMode[\s\S]*@default\(HIDDEN\)/u);
});

test('MIG-003 creates constrained field and data-scope policy tables', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const table of [
    'permission',
    'functional_account_permission',
    'data_scope_policy',
    'field_access_policy',
  ]) {
    assert.match(sql, new RegExp('CREATE TABLE `' + table + '`', 'u'));
  }
  assert.match(sql, /field_access_policy_account_resource_group_key/u);
  assert.match(sql, /DEFAULT 'HIDDEN'/u);
  assert.match(sql, /FOREIGN KEY \(`functional_account_id`\)[\s\S]*REFERENCES `functional_account`\(`id`\)/u);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/iu);
});

test('the real MySQL rehearsal probes default deny and supplier scope constraints', async () => {
  const rehearsal = await readFile(
    path.join(repositoryRoot, 'scripts', 'prisma-migration-rehearsal.mjs'),
    'utf8',
  );
  assert.match(rehearsal, /permissionPolicyTableCount === 4/u);
  assert.match(rehearsal, /fieldAccessDefaultMode === 'HIDDEN'/u);
  assert.match(rehearsal, /FIELD_ACCESS_DUPLICATE_ACCEPTED/u);
  assert.match(rehearsal, /CROSS_SUPPLIER_SCOPE_ACCEPTED/u);
  assert.match(rehearsal, /taskId: 'M1-P046'/u);
});
