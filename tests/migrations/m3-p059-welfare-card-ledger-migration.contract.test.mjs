import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schemaPath = new URL('../../packages/db/prisma/schema.prisma', import.meta.url);
const migrationPath = new URL('../../packages/db/prisma/migrations/20260820090000_m3_welfare_card_ledger/migration.sql', import.meta.url);
const bindingMigrationPath = new URL('../../packages/db/prisma/migrations/20260816090000_m3_welfare_card_binding/migration.sql', import.meta.url);

test('M3-P059 migration adds continuous account sequence and complete append-only ledger semantics', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  for (const required of [
    'welfare_card_account_ledger_sequence_check',
    'welfare_card_ledger_account_sequence_key',
    "'CLAIM', 'GRANT', 'GIFT'",
    "`business_type` = 'FREEZE'",
    "`business_type` = 'RELEASE'",
    "`business_type` = 'CAPTURE'",
    "`business_type` = 'REFUND'",
    "'ADJUSTMENT', 'REVERSAL'",
    'WELFARE_CARD_LEDGER_SEQUENCE_INVALID',
    'WELFARE_CARD_LEDGER_BALANCE_INVALID',
  ]) assert.match(migration, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.doesNotMatch(migration, /DROP TRIGGER `welfare_card_ledger_no_(?:update|delete)`/u);
  const bindingMigration = await readFile(bindingMigrationPath, 'utf8');
  assert.match(bindingMigration, /welfare_card_ledger_no_update/u);
  assert.match(bindingMigration, /welfare_card_ledger_no_delete/u);
});

test('M3-P059 adjustment approval history and commands are immutable and natural-person identities are persisted separately', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  for (const required of [
    'applicant_identity_id', 'reviewer_identity_id', 'applicant_functional_account_id',
    'reviewer_functional_account_id', 'welfare_card_adjustment_history_no_update',
    'welfare_card_adjustment_history_no_delete', 'welfare_card_adjustment_command_no_update',
    'welfare_card_adjustment_command_no_delete', 'welfare_card_adjustment_reversal_ledger_key',
  ]) assert.match(migration, new RegExp(required, 'u'));
});

test('M3-P059 Prisma schema exposes no personal recharge resource and models only ledger adjustments', async () => {
  const schema = await readFile(schemaPath, 'utf8');
  assert.match(schema, /model WelfareCardAdjustment \{/u);
  assert.match(schema, /model WelfareCardAdjustmentHistory \{/u);
  assert.match(schema, /model WelfareCardAdjustmentCommand \{/u);
  assert.match(schema, /ledgerSequence\s+Int\s+@default\(0\)/u);
  assert.doesNotMatch(schema, /PERSONAL_RECHARGE|PersonalRecharge|personalRecharge|cashRecharge/u);
});
