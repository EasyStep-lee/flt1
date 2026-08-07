import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const migrationPath = path.join(
  repositoryRoot,
  'packages',
  'db',
  'prisma',
  'migrations',
  '20260807010000_supplier_auth_sessions',
  'migration.sql',
);
const secondVerificationClaimMigrationPath = path.join(
  repositoryRoot,
  'packages',
  'db',
  'prisma',
  'migrations',
  '20260807105000_supplier_auth_second_verification_claim',
  'migration.sql',
);

test('M1-P069 adds an immutable forward supplier selection grant table', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /CREATE TABLE `supplier_auth_selection`/u);
  assert.match(migration, /supplier_auth_selection_nonce_key/u);
  assert.match(migration, /supplier_auth_selection_user_request_key/u);
  assert.match(migration, /supplier_auth_selection_nonce_hash_format_chk/u);
  assert.match(migration, /supplier_auth_selection_user_id_fkey/u);
  assert.match(migration, /REFERENCES `supplier_user`\(`id`\)/u);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/u);
});

test('M1-P069 adds a forward-only persistent second-verification claim', async () => {
  const migration = await readFile(secondVerificationClaimMigrationPath, 'utf8');
  assert.match(migration, /ADD COLUMN `second_verification_claim_id` CHAR\(36\)/u);
  assert.match(migration, /ADD COLUMN `second_verification_claimed_at` DATETIME\(3\)/u);
  assert.match(migration, /ADD COLUMN `second_verified_at` DATETIME\(3\)/u);
  assert.match(migration, /supplier_auth_selection_second_verification_claim_pair_chk/u);
  assert.match(migration, /supplier_auth_selection_second_verified_account_chk/u);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/u);
});
