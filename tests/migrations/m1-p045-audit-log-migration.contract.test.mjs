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
  '20260806020000_audit_log',
  'migration.sql',
);

test('M1-P045 persists the canonical append-only AuditLog fields', async () => {
  const schema = await readFile(schemaPath, 'utf8');
  assert.match(schema, /enum AuditActorType[\s\S]*COMPANY_USER[\s\S]*SUPPLIER_USER[\s\S]*SYSTEM/u);
  assert.match(schema, /model AuditLog[\s\S]*actorType[\s\S]*actorId[\s\S]*action[\s\S]*objectType[\s\S]*objectId[\s\S]*beforeSnapshot[\s\S]*afterSnapshot[\s\S]*requestId[\s\S]*ip[\s\S]*occurredAt/u);
});

test('NEG-M1-045-02 migration rejects update and delete at the database boundary', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /CREATE TABLE `audit_log`/u);
  assert.match(sql, /CREATE TRIGGER `audit_log_prevent_update`[\s\S]*BEFORE UPDATE[\s\S]*AUDIT_IMMUTABLE/u);
  assert.match(sql, /CREATE TRIGGER `audit_log_prevent_delete`[\s\S]*BEFORE DELETE[\s\S]*AUDIT_IMMUTABLE/u);
  assert.doesNotMatch(sql, /DROP TRIGGER|DROP TABLE/iu);
});

test('the real product rehearsal probes the audit table and both immutability triggers', async () => {
  const rehearsal = await readFile(
    path.join(repositoryRoot, 'scripts', 'prisma-migration-rehearsal.mjs'),
    'utf8',
  );
  assert.match(rehearsal, /auditLogTableCount === 1/u);
  assert.match(rehearsal, /auditLogTriggerCount === 2/u);
  assert.match(rehearsal, /AUDIT_IMMUTABLE/u);
  assert.match(rehearsal, /taskId: 'M1-P045'/u);
});
