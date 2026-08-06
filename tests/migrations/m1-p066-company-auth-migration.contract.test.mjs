import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

test('M1-P066 persists the frozen company identity, single-account session and login audit fields', async () => {
  const schema = await readFile(
    path.join(repositoryRoot, 'packages', 'db', 'prisma', 'schema.prisma'),
    'utf8',
  );
  assert.match(schema, /model CompanyUser[\s\S]*companyId[\s\S]*lastLoginAt[\s\S]*version/u);
  assert.match(
    schema,
    /model AuthSession[\s\S]*userType[\s\S]*functionalAccountId[\s\S]*workspaceRoute[\s\S]*sessionHash[\s\S]*revokedAt/u,
  );
  assert.match(
    schema,
    /model LoginAudit[\s\S]*loginAccountHash[\s\S]*result[\s\S]*riskReason[\s\S]*occurredAt/u,
  );
  assert.match(schema, /sessionHash\s+String\s+@unique/u);
});

test('M1-P066 forward migration removes the supplier-only identity FK and never stores a raw token', async () => {
  const sql = await readFile(
    path.join(
      repositoryRoot,
      'packages',
      'db',
      'prisma',
      'migrations',
      '20260806070000_company_auth_sessions',
      'migration.sql',
    ),
    'utf8',
  );
  assert.match(sql, /DROP FOREIGN KEY `functional_account_identity_id_fkey`/u);
  assert.match(sql, /DROP INDEX `functional_account_identity_id_fkey`/u);
  assert.match(sql, /CREATE TABLE `company_user`/u);
  assert.match(sql, /CREATE TABLE `auth_session`/u);
  assert.match(sql, /CREATE TABLE `login_audit`/u);
  assert.match(sql, /`session_hash` CHAR\(64\) NOT NULL/u);
  assert.match(sql, /auth_session_hash_format_chk/u);
  assert.match(sql, /login_audit_account_hash_format_chk/u);
  assert.match(sql, /CREATE TRIGGER `login_audit_prevent_update`/u);
  assert.match(sql, /CREATE TRIGGER `login_audit_prevent_delete`/u);
  assert.doesNotMatch(sql, /raw_session|session_token|password\s+VARCHAR/iu);
});

test('the real MySQL rehearsal probes session hashes and immutable login audit rows', async () => {
  const rehearsal = await readFile(
    path.join(repositoryRoot, 'scripts', 'prisma-migration-rehearsal.mjs'),
    'utf8',
  );
  assert.match(rehearsal, /companyAuthTableCount === 4/u);
  assert.match(rehearsal, /RAW_SESSION_TOKEN_ACCEPTED/u);
  assert.match(rehearsal, /LOGIN_AUDIT_IMMUTABLE_UPDATE_NOT_ENFORCED/u);
  assert.match(rehearsal, /loginAuditTriggerCount/u);
});
