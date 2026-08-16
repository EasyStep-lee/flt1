import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../../packages/db/prisma/migrations/20260816090000_m3_welfare_card_binding/migration.sql', import.meta.url), 'utf8');

test('M3-P052 migration binds one card code to one account with an immutable CLAIM ledger', () => {
  assert.match(migration, /CREATE TABLE `welfare_card_code`/iu);
  assert.match(migration, /CREATE TABLE `welfare_card_account`/iu);
  assert.match(migration, /CREATE TABLE `welfare_card_ledger`/iu);
  assert.match(migration, /CREATE TABLE `welfare_card_binding_command`/iu);
  assert.match(migration, /UNIQUE INDEX.*`card_no`/isu);
  assert.match(migration, /UNIQUE INDEX.*`card_code_id`/isu);
  assert.match(migration, /BEFORE UPDATE ON `welfare_card_ledger`/iu);
  assert.match(migration, /BEFORE DELETE ON `welfare_card_ledger`/iu);
  assert.match(migration, /BEFORE UPDATE ON `welfare_card_binding_command`/iu);
  assert.match(migration, /business_type.*CLAIM/isu);
  assert.match(migration, /direction.*CREDIT/isu);
  assert.doesNotMatch(migration, /PERSONAL_RECHARGE|recharge|FLOAT|DOUBLE|DECIMAL/iu);
});
