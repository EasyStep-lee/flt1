import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');

const read = (...parts) => readFile(path.join(root, ...parts), 'utf8');

test('M2-P007 adds only the two independent approval enums through a forward migration', async () => {
  const [schema, migration] = await Promise.all([
    read('packages', 'db', 'prisma', 'schema.prisma'),
    read(
      'packages',
      'db',
      'prisma',
      'migrations',
      '20260809100000_m2_company_product_approval',
      'migration.sql',
    ),
  ]);
  assert.match(schema, /enum ApprovalType \{[\s\S]*PRODUCT_INITIAL_PRICE/u);
  assert.match(schema, /enum ApprovalAccountTypeCode \{[\s\S]*COMPANY_PRICE_REVIEW/u);
  assert.match(migration, /PRODUCT_INITIAL_PRICE/u);
  assert.match(migration, /COMPANY_PRICE_REVIEW/u);
  assert.doesNotMatch(migration, /wallet|withdraw|payment|inventory/iu);
});

test('M2-P007 OpenAPI keeps material and initial-price review DTOs and roles separate', async () => {
  const openapi = JSON.parse(await read('packages', 'contracts', 'openapi.json'));
  assert.ok(openapi.paths['/v1/company/product-material-reviews']?.get);
  assert.ok(openapi.paths['/v1/company/product-material-reviews/{taskId}/decision']?.post);
  assert.ok(openapi.paths['/v1/company/price-reviews']?.get);
  assert.ok(openapi.paths['/v1/company/price-reviews/{taskId}/decision']?.post);
  const material = JSON.stringify(openapi.components.schemas.ProductMaterialReviewDto);
  assert.doesNotMatch(
    material,
    /requestedSupplyPrice|requestedRetailSalePrice|requestedEnterpriseSalePrice|approvedSupplyPrice/iu,
  );
  const price = JSON.stringify(openapi.components.schemas.InitialPriceReviewSkuDto);
  assert.match(price, /requestedSupplyPrice/u);
  assert.match(price, /requestedRetailSalePrice/u);
  assert.match(price, /requestedEnterpriseSalePrice/u);
  assert.match(
    JSON.stringify(openapi.components.schemas.ProductApprovalDecisionRequestDto),
    /decision[\s\S]*opinion[\s\S]*version/u,
  );
});

test('M2-P007 retains evidence while M2-P012 advances locally', async () => {
  const [state, taskLedger, p0Ledger, apiLedger, pageLedger, evidence, handoff] =
    await Promise.all([
      readFile(path.join(pack, '16-项目状态.json'), 'utf8').then(JSON.parse),
      readFile(path.join(pack, '03-任务台账.csv'), 'utf8'),
      readFile(path.join(pack, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
      readFile(path.join(pack, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
      readFile(path.join(pack, '08-页面路由接口P0映射.csv'), 'utf8'),
      read('artifacts', 'verification', 'M2-P007', 'company-product-approvals.json').then(JSON.parse),
      read('docs', 'handoffs', '2026-08-09-M2-P007-company-product-approvals.md'),
    ]);

  assert.equal(state.execution.currentTask, 'M2-P012');
  assert.equal(state.execution.nextAllowedTask, 'M2-P012');
  assert.equal(state.execution.lastCompletedTask, 'M2-P012');
  assert.ok([0, 1].includes(state.execution.activeTaskCount));
  assert.equal(state.github.currentTaskDelivery.pullRequest, 50);
  assert.equal(state.github.currentTaskDelivery.pullRequestState, 'DRAFT');
  assert.equal(state.github.currentTaskDelivery.exactHeadCi, 'NOT_EXECUTED_FINAL_HEAD');
  assert.equal(state.github.currentTaskDelivery.merge, 'NOT_EXECUTED');
  assert.equal(state.github.currentTaskDelivery.m2p013StartAllowed, false);
  assert.match(state.evidence.local, /^(?:NOT_EXECUTED|LOCAL_PASS)$/u);
  assert.equal(state.evidence.ci, 'NOT_EXECUTED');
  assert.match(taskLedger, /M2-P007[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M2-P008[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M2-P009[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(
    taskLedger,
    /M2-P012[^\r\n]*DONE[^\r\n]*LOCAL_PASS/u,
  );
  assert.match(p0Ledger, /P0-007[^\r\n]*CI_PASS/u);
  assert.match(apiLedger, /API-025[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
  assert.match(apiLedger, /API-026[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
  assert.match(pageLedger, /PAGE-005[^\r\n]*P0-007_CI_PASS/u);
  assert.match(pageLedger, /PAGE-006[^\r\n]*P0-007_LOCAL_PASS/u);
  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.environment.ci, 'NOT_EXECUTED');
  assert.match(handoff, /M2-P008.*锁定/u);
  assert.match(handoff, /CI_PASS.*未执行/u);
});
