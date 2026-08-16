import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const artifact = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const generator = path.join(root, 'scripts', 'generate-m3-contract-freeze.mjs');
const expectedP0Ids = '020 022 023 024 025 026 027 028 029 030 031 051 052 053 054 055 056 057 058 059 062 073 074 075 076 077 078 079 080 081 083 084 085 086 087 088 089 090 091 092 093 094 096 097 098'.split(' ').map((id) => `P0-${id}`);
const sorted = (rows) => [...rows].sort();

test('M3-000 freezes the exact scope but does not claim runtime implementation', async () => {
  const freeze = JSON.parse(await readFile(artifact, 'utf8'));
  assert.equal(freeze.schemaVersion, '1.0.0');
  assert.equal(freeze.taskId, 'M3-000');
  assert.equal(freeze.stage, 'M3');
  assert.equal(freeze.status, 'CONTRACT_FROZEN');
  assert.equal(freeze.implementationStatus, 'NOT_IMPLEMENTED');
  assert.equal(freeze.baseline.schemeSha256, '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92');
  assert.equal(freeze.baseline.m2GateMergeCommit, '6cbe9460109c3b0ed5eb4ba307eec4c2cb5d23d9');
  assert.equal(freeze.baseline.m2GateMainCiRun, '31686758134');
  assert.deepEqual(sorted(freeze.scope.p0Ids), sorted(expectedP0Ids));
  assert.equal(freeze.scope.businessSliceStarted, false);
  assert.equal(freeze.scope.nextAllowedAfterMergeAndGreenCi, 'M3-P020');
  assert.deepEqual(freeze.scope.forbiddenRuntimeDomains, ['M4_DELIVERY', 'M5_SETTLEMENT', 'PRODUCTION_EXTERNALS']);
});

test('M3 money, order, inventory and privacy invariants are codeable and closed', async () => {
  const freeze = JSON.parse(await readFile(artifact, 'utf8'));
  assert.deepEqual(freeze.welfareCard.fundingSources, ['ENTERPRISE_GRANT', 'COMPANY_GIFT', 'PHYSICAL_CARD_OR_CODE']);
  assert.equal(freeze.welfareCard.personalRecharge.permanentlyForbidden, true);
  assert.equal(freeze.welfareCard.personalRecharge.apiExists, false);
  assert.equal(freeze.welfareCard.fundingSources.includes('PERSONAL_RECHARGE'), false);
  assert.deepEqual(freeze.payment.personalOnlineCashMethods, ['WECHAT_PAY']);
  assert.deepEqual(freeze.payment.enterpriseMethods, ['WECHAT_PAY', 'BANK_TRANSFER']);
  assert.equal(freeze.payment.bankTransferExposedToConsumer, false);
  assert.equal(freeze.payment.amountUnit, 'INTEGER_CENTS');
  assert.equal(freeze.payment.allocationInvariant, 'ORDER_TOTAL = WELFARE_CARD + WECHAT_PAY');
  assert.equal(freeze.refund.structure, 'ORIGINAL_PAYMENT_ALLOCATION');
  assert.equal(freeze.refund.cumulativeRefundMayExceedPaid, false);
  assert.equal(freeze.order.customerCounterparty, 'JIANGSU_FULITUAN_SUPPLY_CHAIN_TECHNOLOGY_CO_LTD');
  assert.equal(freeze.order.crossSupplierSingleBuyerOrder, true);
  assert.equal(freeze.order.supplierFulfillmentSplit, true);
  assert.equal(freeze.inventory.crossSupplierReservation, 'ATOMIC_ALL_OR_NOTHING');
  assert.deepEqual(freeze.inventory.operations, ['RESERVE', 'CONFIRM', 'RELEASE']);
  assert.equal(freeze.deliveryBoundary.createsDeliveryTask, false);
  assert.equal(freeze.deliveryBoundary.publishesOutboxContractOnly, true);
  assert.equal(freeze.dto.databaseEntityReturnedDirectly, false);
  assert.equal(freeze.dto.supplyPriceInBuyerResponses, false);
  const fields = freeze.fieldContract.entities.flatMap(({ entity, fields: rows }) => rows.map((field) => ({ entity, ...field })));
  assert.equal(fields.length, 232);
  assert.equal(fields.some((field) => /待M阶段冻结|待切片细化|String\/UUID|Enum\/String/u.test(`${field.type}|${field.format}|${field.p0Ids.join(',')}`)), false);
  const fieldByKey = new Map(fields.map((field) => [`${field.entity}.${field.name}`, field]));
  assert.equal(fieldByKey.get('ConsumerAddress.lat').type, 'Decimal(10,7)');
  assert.equal(fieldByKey.get('EnterpriseAddress.lat').type, 'Decimal(10,7)');
  assert.equal(fieldByKey.get('WelfareCardProgram.canPayDeliveryFee').type, 'Boolean');
  assert.equal(fieldByKey.get('WelfareCardProgram.fundingType').format, 'ENTERPRISE_GRANT|COMPANY_GIFT|PHYSICAL_CARD_OR_CODE');
});

test('M3 client boundaries and negative behavior plans are explicit', async () => {
  const freeze = JSON.parse(await readFile(artifact, 'utf8'));
  assert.equal(freeze.miniapp.transport, 'miniapp-kit');
  assert.equal(freeze.miniapp.nativeAdapter, 'wx.request');
  assert.equal(freeze.miniapp.directWxRequestOutsideAdapterAllowed, false);
  assert.equal(freeze.miniapp.reusesGeneratedOpenApiTypes, true);
  assert.equal(freeze.portal.publicContentRendering, 'SSG_OR_ISR');
  assert.deepEqual(freeze.portal.privateResponseHeaders, ['Cache-Control: private, no-store', 'X-Robots-Tag: noindex']);
  assert.deepEqual(freeze.portal.privateZones, ['AUTHENTICATED', 'PREVIEW', 'TRANSACTION']);
  const categories = new Set(freeze.negativeTests.map(({ category }) => category));
  for (const required of ['PERSONAL_RECHARGE', 'NON_WECHAT_CONSUMER_CASH', 'DUPLICATE_CALLBACK', 'OUT_OF_ORDER_CALLBACK', 'REFUND_OVERPAID', 'CROSS_OWNER_ACCESS', 'SUPPLY_PRICE_LEAK', 'DIRECT_WX_REQUEST', 'PRIVATE_PUBLIC_CACHE', 'M3_DELIVERY_CREATION']) {
    assert.ok(categories.has(required), `missing negative category ${required}`);
  }
  const implementedSlices = new Set(['M3-P031', 'M3-P051']);
  const currentSlice = freeze.negativeTests.filter(({ taskId }) => implementedSlices.has(taskId));
  const deferred = freeze.negativeTests.filter(({ taskId }) => !implementedSlices.has(taskId));
  assert.equal(currentSlice.every(({ executionStatus }) => ['LOCAL_PASS', 'CI_PASS'].includes(executionStatus)), true);
  assert.equal(deferred.every(({ executionStatus }) => executionStatus === 'NOT_EXECUTED'), true);
});

test('M3 frozen artifact generation is deterministic and side-effect free', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'fulishe-m3-freeze-'));
  try {
    const frozenArtifact = await readFile(artifact, 'utf8');
    const first = path.join(output, 'first.json');
    const second = path.join(output, 'second.json');
    execFileSync(process.execPath, [generator, '--output', first], { cwd: root });
    execFileSync(process.execPath, [generator, '--output', second], { cwd: root });
    assert.equal(await readFile(first, 'utf8'), await readFile(second, 'utf8'));
    assert.equal(await readFile(artifact, 'utf8'), frozenArtifact);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
