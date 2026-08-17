import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const executionPack = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-014 extends the existing public detail whitelist with FRESH without exposing private data', () => {
  const operation = openApi.paths['/v1/catalog/products/{productId}'].get;
  assert.equal(operation.operationId, 'catalog.getProductDetail');
  assert.equal(
    operation.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/PublicFoodProductDetailResponseDto',
  );
  const schema = openApi.components.schemas.PublicFoodProductDetailResponseDto;
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    'brand', 'bundleItems', 'categoryId', 'checkoutMode', 'detailModules', 'media', 'name', 'productId',
    'retailSalePrice', 'sellerName', 'skus', 'supplierId', 'templateProfile', 'templateVersion',
  ]);
  assert.deepEqual(schema.properties.templateProfile.enum.slice(0, 3), ['FOOD', 'FRESH', 'APPAREL']);
  assert.deepEqual(
    openApi.components.schemas.PublicFoodDetailModuleResponseDto.properties.kind.enum,
    ['AFTER_SALE', 'FIELDS', 'FIXED_NOTICE'],
  );
  assert.doesNotMatch(
    JSON.stringify({ operation, schema }),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|settlement|margin|functionalAccountId|identityId/iu,
  );
});

test('P0-014 remains in category-template profile contracts after APPAREL is added', () => {
  const request = openApi.components.schemas.CategoryTemplateCreateRequestDto;
  const response = openApi.components.schemas.CategoryTemplateResponseDto;
  assert.deepEqual(request.properties.profile.enum.slice(0, 3), ['FOOD', 'FRESH', 'APPAREL']);
  assert.deepEqual(response.properties.profile.enum.slice(0, 3), ['FOOD', 'FRESH', 'APPAREL']);
  assert.equal(request.properties.profile.enum.at(-1), 'GENERIC');
  assert.equal(response.properties.profile.enum.at(-1), 'GENERIC');
  assert.ok(request.properties.profile.enum.includes('GIFT_BOX'));
  assert.ok(response.properties.profile.enum.includes('GIFT_BOX'));
});

test('M2-P014 historical evidence remains while the current M2 slice advances', async () => {
  const [state, evidence, taskLedger, p0Ledger, pageLedger, apiLedger, handoff] =
    await Promise.all([
      readFile(path.join(executionPack, '16-项目状态.json'), 'utf8').then(JSON.parse),
      readFile(
        path.join(repositoryRoot, 'artifacts', 'verification', 'M2-P014', 'fresh-detail.json'),
        'utf8',
      ).then(JSON.parse),
      readFile(path.join(executionPack, '03-任务台账.csv'), 'utf8'),
      readFile(path.join(executionPack, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
      readFile(path.join(executionPack, '08-页面路由接口P0映射.csv'), 'utf8'),
      readFile(path.join(executionPack, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
      readFile(
        path.join(repositoryRoot, 'docs', 'handoffs', '2026-08-10-M2-P014-fresh-detail.md'),
        'utf8',
      ),
    ]);

  assert.equal(state.execution.status, 'M3_IN_PROGRESS');
  assert.equal(state.execution.currentTask, 'M3-P055');
  assert.equal(state.execution.nextAllowedTask, state.execution.currentTask);
  assert.equal(state.execution.lastCompletedTask, 'M3-P054');
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P055.*M3-P056/u);
  assert.equal(state.github.currentTaskDelivery.taskId, state.execution.currentTask);
  assert.ok(
    state.github.currentTaskDelivery.exactHeadCi === 'NOT_EXECUTED' ||
      state.github.currentTaskDelivery.exactHeadCi.startsWith('CI_PASS_RUN_'),
  );
  assert.equal(state.github.currentTaskDelivery.merge, 'NOT_EXECUTED');
  assert.equal(state.github.currentTaskDelivery.mainPostMergeCi, 'NOT_EXECUTED');
  assert.equal(
    state.github.currentTaskDelivery.blockingExternalItem,
    'REAL_WELFARE_PROGRAM_FUNDS_AND_DEVICE',
  );
  assert.equal(state.github.currentTaskDelivery.nextTaskUnlocked, false);
  assert.equal(state.github.previousTaskDelivery.status, 'CI_PASS');
  assert.equal(evidence.taskId, 'M2-P014');
  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.environmentBoundary.ci, 'NOT_EXECUTED_NO_PR');
  assert.equal(evidence.m2p015StartAllowed, false);
  assert.match(taskLedger, /M2-P013[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M2-P014[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M2-P015[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0Ledger, /P0-014[^\r\n]*CI_PASS/u);
  assert.match(pageLedger, /P0-014_CI_PASS/u);
  assert.match(apiLedger, /API-030[^\r\n]*P0-014[^\r\n]*IMPLEMENTED/u);
  assert.match(handoff, /^# M2-P014 生鲜详情交接/u);
  assert.match(handoff, /M2-P015/u);
});
