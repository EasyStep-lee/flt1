import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const executionPack = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');
const openApi = JSON.parse(
  await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'),
);

test('P0-016 extends the public detail whitelist with DIGITAL without exposing private data', () => {
  const operation = openApi.paths['/v1/catalog/products/{productId}'].get;
  assert.equal(operation.operationId, 'catalog.getProductDetail');
  const schema = openApi.components.schemas.PublicFoodProductDetailResponseDto;
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    'brand', 'bundleItems', 'categoryId', 'checkoutMode', 'detailModules', 'media', 'name', 'productId',
    'retailSalePrice', 'sellerName', 'skus', 'supplierId', 'templateProfile', 'templateVersion',
  ]);
  assert.deepEqual(schema.properties.templateProfile.enum, [
    'FOOD', 'FRESH', 'APPAREL', 'DIGITAL', 'GIFT_BOX',
  ]);
  assert.doesNotMatch(
    JSON.stringify({ operation, schema }),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|settlement|margin|functionalAccountId|identityId/iu,
  );
});

test('P0-016 retains DIGITAL in category-template profiles and safe errors', () => {
  const request = openApi.components.schemas.CategoryTemplateCreateRequestDto;
  const response = openApi.components.schemas.CategoryTemplateResponseDto;
  assert.deepEqual(request.properties.profile.enum, [
    'FOOD', 'FRESH', 'APPAREL', 'DIGITAL', 'GIFT_BOX', 'GENERIC',
  ]);
  assert.deepEqual(response.properties.profile.enum, request.properties.profile.enum);
  assert.match(JSON.stringify(openApi.components.schemas), /DIGITAL_REQUIRED_FIELD_MISSING/u);
  assert.match(JSON.stringify(openApi.components.schemas), /DIGITAL_MODEL_DUPLICATE/u);
  assert.match(JSON.stringify(openApi.components.schemas), /DIGITAL_HISTORY_REWRITE/u);
});

test('M2-P016 records its merged-main gate while M2 formal acceptance remains blocked', async () => {
  const [state, evidence, taskLedger, p0Ledger, pageLedger, apiLedger, handoff] =
    await Promise.all([
      readFile(path.join(executionPack, '16-项目状态.json'), 'utf8').then(JSON.parse),
      readFile(
        path.join(repositoryRoot, 'artifacts', 'verification', 'M2-P016', 'digital-detail.json'),
        'utf8',
      ).then(JSON.parse),
      readFile(path.join(executionPack, '03-任务台账.csv'), 'utf8'),
      readFile(path.join(executionPack, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
      readFile(path.join(executionPack, '08-页面路由接口P0映射.csv'), 'utf8'),
      readFile(path.join(executionPack, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
      readFile(
        path.join(repositoryRoot, 'docs', 'handoffs', '2026-08-11-M2-P016-digital-detail.md'),
        'utf8',
      ),
    ]);

  assert.equal(state.execution.status, 'M2_BLOCKED_EXTERNAL');
  assert.equal(state.execution.currentTask, 'M2-GATE');
  assert.equal(state.execution.nextAllowedTask, 'M2-GATE');
  assert.equal(state.execution.lastCompletedTask, 'M2-P071');
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /EXT-007.*M3/u);
  assert.equal(state.github.currentTaskDelivery.taskId, 'M2-GATE');
  assert.equal(state.github.currentTaskDelivery.issue, 73);
  assert.equal(state.github.currentTaskDelivery.branch, 'codex/m2-gate');
  assert.equal(
    state.github.currentTaskDelivery.exactHeadCi,
    'NOT_EXECUTED',
  );
  assert.equal(state.github.currentTaskDelivery.pullRequest, null);
  assert.equal(state.github.currentTaskDelivery.pullRequestState, 'NOT_CREATED');
  assert.equal(state.github.currentTaskDelivery.merge, 'NOT_EXECUTED');
  assert.equal(state.github.currentTaskDelivery.mainPostMergeCi, 'NOT_EXECUTED');
  assert.equal(state.github.currentTaskDelivery.blockingExternalItem, 'EXT-007');
  assert.equal(state.github.currentTaskDelivery.m3Unlocked, false);
  assert.equal(state.github.previousTaskDelivery.taskId, 'M2-P071');
  assert.equal(state.github.previousTaskDelivery.pullRequest, 72);
  assert.equal(state.github.previousTaskDelivery.mainPostMergeCiRun, 31663228561);
  assert.equal(state.github.previousTaskDelivery.status, 'CI_PASS');
  assert.equal(evidence.taskId, 'M2-P016');
  assert.equal(evidence.status, 'CI_PASS');
  assert.equal(evidence.environmentBoundary.ci, 'CI_PASS');
  assert.equal(evidence.github.issue, 57);
  assert.equal(evidence.github.pullRequest, 58);
  assert.equal(evidence.github.pullRequestState, 'MERGED');
  assert.equal(evidence.github.exactHead, '6ec6e8f3193c0cfdb19ebc481bbbd77f7201df4f');
  assert.equal(evidence.github.exactHeadCi, 'CI_PASS_RUN_31471253414_JOB_93714854651');
  assert.equal(evidence.github.merge, 'MERGED_AS_371d99dc668cf021583fb43f86750cb4630573b7');
  assert.equal(evidence.github.mainPostMergeCi, 'CI_PASS_RUN_31472192291_JOB_93717760889');
  assert.equal(evidence.m2p017StartAllowed, true);
  assert.match(taskLedger, /M2-P015[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M2-P016[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0Ledger, /P0-016[^\r\n]*CI_PASS/u);
  assert.match(pageLedger, /P0-016_CI_PASS/u);
  assert.match(apiLedger, /API-030[^\r\n]*P0-016[^\r\n]*IMPLEMENTED/u);
  assert.match(handoff, /^# M2-P016 数码详情交接/u);
  assert.match(handoff, /M2-P017/u);
});
