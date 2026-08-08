import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

test('M1-P072 migration persists immutable approval history, audit scope and idempotent commands', async () => {
  const schema = await readFile(
    path.join(repositoryRoot, 'packages', 'db', 'prisma', 'schema.prisma'),
    'utf8',
  );
  const migrationsRoot = path.join(repositoryRoot, 'packages', 'db', 'prisma', 'migrations');
  const migration = await readFile(
    path.join(migrationsRoot, '20260808013000_sensitive_approval_audit_scope', 'migration.sql'),
    'utf8',
  );
  assert.match(schema, /model ApprovalTaskHistory/u);
  assert.match(schema, /model ApprovalTaskCommand/u);
  assert.match(schema, /supplierId\s+String\?/u);
  assert.match(schema, /functionalAccountId\s+String\?/u);
  assert.match(migration, /CREATE TABLE `approval_task_history`/u);
  assert.match(migration, /CREATE TABLE `approval_task_command`/u);
  assert.match(migration, /approval_task_history_immutable_update/u);
  assert.match(migration, /approval_task_history_immutable_delete/u);
  assert.match(migration, /ADD COLUMN `supplier_id`/u);
  assert.match(migration, /ADD COLUMN `functional_account_id`/u);
  for (const permission of [
    'supply_price.reveal',
    'supply_price.approve',
    'refund.review',
    'welfare_card.adjust',
    'offline_payment.record',
    'bank_account.review',
    'sensitive_export.request',
    'sensitive_export.review',
    'audit_event.read',
  ]) {
    assert.match(migration, new RegExp(permission.replace('.', '\\.'), 'u'));
  }
});
