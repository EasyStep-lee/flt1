import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../../packages/db/prisma/migrations/20260817030000_m3_welfare_card_full_payment/migration.sql', import.meta.url), 'utf8');

test('M3-P055 migration permits only CLAIM/FREEZE/CAPTURE ledger shapes and freezes one immutable payment command per order', () => {
  assert.match(migration, /DROP CHECK `welfare_card_ledger_claim_check`/iu);
  assert.match(migration, /business_type` = 'FREEZE'.*after_frozen` = `before_frozen` \+ `amount`/isu);
  assert.match(migration, /business_type` = 'CAPTURE'.*after_balance` = `before_balance` - `amount`.*after_frozen` = `before_frozen` - `amount`/isu);
  assert.match(migration, /CREATE TABLE `welfare_card_payment_command`/iu);
  assert.match(migration, /UNIQUE INDEX `welfare_card_payment_command_order_key` \(`order_id`\)/iu);
  assert.match(migration, /UNIQUE INDEX `welfare_card_payment_command_owner_key` \(`company_id`, `consumer_user_id`, `idempotency_key`\)/iu);
  assert.match(migration, /BEFORE UPDATE ON `welfare_card_payment_command`/iu);
  assert.match(migration, /BEFORE DELETE ON `welfare_card_payment_command`/iu);
  assert.doesNotMatch(migration, /payment_transaction|wechat|PERSONAL_RECHARGE|recharge|FLOAT|DOUBLE|DECIMAL/iu);
});
