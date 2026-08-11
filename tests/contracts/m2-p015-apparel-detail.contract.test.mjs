import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const executionPack = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-015 extends the existing public detail whitelist with APPAREL without exposing private data', () => {
  const operation = openApi.paths['/v1/catalog/products/{productId}'].get;
  assert.equal(operation.operationId, 'catalog.getProductDetail');
  assert.equal(
    operation.responses['200'].content['application/json'].schema.$ref,
    '#/components/schemas/PublicFoodProductDetailResponseDto',
  );
  const schema = openApi.components.schemas.PublicFoodProductDetailResponseDto;
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    'brand', 'bundleItems', 'categoryId', 'checkoutMode', 'detailModules', 'name', 'productId',
    'retailSalePrice', 'sellerName', 'skus', 'supplierId', 'templateProfile', 'templateVersion',
  ]);
  assert.deepEqual(schema.properties.templateProfile.enum.slice(0, 3), ['FOOD', 'FRESH', 'APPAREL']);
  assert.doesNotMatch(
    JSON.stringify({ operation, schema }),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|settlement|margin|functionalAccountId|identityId/iu,
  );
});

test('P0-015 keeps APPAREL in category-template profile contracts', () => {
  const request = openApi.components.schemas.CategoryTemplateCreateRequestDto;
  const response = openApi.components.schemas.CategoryTemplateResponseDto;
  assert.deepEqual(request.properties.profile.enum.slice(0, 3), ['FOOD', 'FRESH', 'APPAREL']);
  assert.deepEqual(response.properties.profile.enum.slice(0, 3), ['FOOD', 'FRESH', 'APPAREL']);
  assert.equal(request.properties.profile.enum.at(-1), 'GENERIC');
  assert.equal(response.properties.profile.enum.at(-1), 'GENERIC');
  assert.ok(request.properties.profile.enum.includes('GIFT_BOX'));
  assert.ok(response.properties.profile.enum.includes('GIFT_BOX'));
});

test('M2-P015 remains closed after later M2 slices advance', async () => {
  const [state, evidence, taskLedger, p0Ledger, pageLedger, apiLedger, handoff] =
    await Promise.all([
      readFile(path.join(executionPack, '16-项目状态.json'), 'utf8').then(JSON.parse),
      readFile(
        path.join(repositoryRoot, 'artifacts', 'verification', 'M2-P015', 'apparel-detail.json'),
        'utf8',
      ).then(JSON.parse),
      readFile(path.join(executionPack, '03-任务台账.csv'), 'utf8'),
      readFile(path.join(executionPack, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
      readFile(path.join(executionPack, '08-页面路由接口P0映射.csv'), 'utf8'),
      readFile(path.join(executionPack, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
      readFile(
        path.join(repositoryRoot, 'docs', 'handoffs', '2026-08-10-M2-P015-apparel-detail.md'),
        'utf8',
      ),
    ]);

  assert.equal(state.execution.currentTask, 'M2-P018');
  assert.equal(state.execution.nextAllowedTask, 'M2-P018');
  assert.equal(state.execution.lastCompletedTask, 'M2-P017');
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M2-P018.*M2-P019/u);
  assert.equal(state.github.currentTaskDelivery.taskId, 'M2-P018');
  assert.equal(state.github.currentTaskDelivery.issue, 61);
  assert.equal(state.github.previousTaskDelivery.taskId, 'M2-P017');
  assert.equal(state.github.previousTaskDelivery.pullRequest, 60);
  assert.equal(state.github.previousTaskDelivery.exactHead, '59b020e38d38dc2a8d5d1e1009a2fdc8c5558d30');
  assert.equal(state.github.previousTaskDelivery.mergeCommit, '56bd581dc4ccd88ab2620445a417beec87c5c1ad');
  assert.equal(state.github.previousTaskDelivery.mainPostMergeCiRun, 31480997963);
  assert.equal(state.github.previousTaskDelivery.status, 'CI_PASS');
  assert.equal(evidence.taskId, 'M2-P015');
  assert.equal(evidence.status, 'CI_PASS');
  assert.equal(evidence.environmentBoundary.ci, 'CI_PASS_EXACT_HEAD_7319F6F_AND_MERGED_MAIN_DFD03E1');
  assert.equal(evidence.ciVerification.runId, 31459377570);
  assert.equal(evidence.github.pullRequestState, 'MERGED');
  assert.equal(evidence.github.mainPostMergeCi, 'CI_PASS_RUN_31462310044');
  assert.equal(evidence.m2p016StartAllowed, true);
  assert.match(taskLedger, /M2-P014[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M2-P015[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M2-P015[^\r\n]*dfd03e1/u);
  assert.match(p0Ledger, /P0-015[^\r\n]*CI_PASS/u);
  assert.match(pageLedger, /P0-015_CI_PASS/u);
  assert.match(apiLedger, /API-030[^\r\n]*P0-015[^\r\n]*IMPLEMENTED/u);
  assert.match(handoff, /^# M2-P015 服饰详情交接/u);
  assert.match(handoff, /合并门禁补充/u);
});
