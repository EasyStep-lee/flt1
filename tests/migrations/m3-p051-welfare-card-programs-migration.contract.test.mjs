import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../../packages/db/prisma/migrations/20260816040000_m3_welfare_card_programs_batches/migration.sql', import.meta.url), 'utf8');

test('M3-P051 migration creates company-owned plans, amount-conserving batches and immutable history only', () => {
  assert.match(migration, /CREATE TABLE `welfare_card_program`/iu);
  assert.match(migration, /CREATE TABLE `welfare_card_batch`/iu);
  assert.match(migration, /CREATE TABLE `welfare_card_program_history`/iu);
  assert.match(migration, /CREATE TABLE `welfare_card_batch_history`/iu);
  assert.match(migration, /CREATE TABLE `welfare_card_command`/iu);
  assert.match(migration, /ENTERPRISE_GRANT.*COMPANY_GIFT.*PHYSICAL_CARD_OR_CODE/isu);
  assert.match(migration, /unit_amount.*issue_count.*total_amount/isu);
  assert.match(migration, /BEFORE INSERT ON `welfare_card_batch`.*ENTERPRISE_GRANT.*ENTERPRISE_ASSIGNED.*COMPANY_GIFT.*COMPANY_ASSIGNED.*PHYSICAL_CARD_OR_CODE/isu);
  assert.match(migration, /BEFORE UPDATE ON `welfare_card_program_history`/iu);
  assert.match(migration, /BEFORE DELETE ON `welfare_card_batch_history`/iu);
  assert.match(migration, /UNIQUE INDEX.*company_id.*batch_no/isu);
  assert.doesNotMatch(migration, /PERSONAL_RECHARGE|CREATE TABLE `welfare_card_account`|CREATE TABLE `welfare_card_ledger`|CREATE TABLE `welfare_card_code`|recharge/iu);
});
