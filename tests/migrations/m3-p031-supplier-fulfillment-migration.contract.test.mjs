import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../../packages/db/prisma/migrations/20260816010000_m3_supplier_fulfillment_preparation/migration.sql', import.meta.url), 'utf8');

test('M3-P031 migration upgrades the existing unique supplier split with versioned append-only preparation evidence', () => {
  assert.match(migration, /supplier_fulfillment_order/iu);
  assert.match(migration, /sub_order_no/iu);
  assert.match(migration, /supply_amount/iu);
  assert.match(migration, /channel_type/iu);
  assert.match(migration, /preparation_status/iu);
  assert.match(migration, /handover_status/iu);
  assert.match(migration, /settlement_status/iu);
  assert.match(migration, /supplier_fulfillment_node_log/iu);
  assert.match(migration, /supplier_fulfillment_readiness_outbox/iu);
  assert.match(migration, /UNIQUE INDEX.*sub_order_id.*idempotency_key/isu);
  assert.doesNotMatch(migration, /CREATE TABLE `delivery_task`|CREATE TABLE `enterprise_delivery_order`/iu);
});
