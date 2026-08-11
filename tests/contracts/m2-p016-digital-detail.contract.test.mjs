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
    'brand', 'categoryId', 'checkoutMode', 'detailModules', 'name', 'productId',
    'retailSalePrice', 'sellerName', 'skus', 'supplierId', 'templateProfile', 'templateVersion',
  ]);
  assert.deepEqual(schema.properties.templateProfile.enum, ['FOOD', 'FRESH', 'APPAREL', 'DIGITAL']);
  assert.doesNotMatch(
    JSON.stringify({ operation, schema }),
    /approvedSupplyPrice|supplyPrice|qualificationSnapshot|settlement|margin|functionalAccountId|identityId/iu,
  );
});

test('P0-016 adds only DIGITAL to category-template profiles and safe errors', () => {
  const request = openApi.components.schemas.CategoryTemplateCreateRequestDto;
  const response = openApi.components.schemas.CategoryTemplateResponseDto;
  assert.deepEqual(request.properties.profile.enum, ['FOOD', 'FRESH', 'APPAREL', 'DIGITAL', 'GENERIC']);
  assert.deepEqual(response.properties.profile.enum, ['FOOD', 'FRESH', 'APPAREL', 'DIGITAL', 'GENERIC']);
  assert.doesNotMatch(JSON.stringify({ request, response }), /GIFT_BOX/iu);
  assert.match(JSON.stringify(openApi.components.schemas), /DIGITAL_REQUIRED_FIELD_MISSING/u);
  assert.match(JSON.stringify(openApi.components.schemas), /DIGITAL_MODEL_DUPLICATE/u);
  assert.match(JSON.stringify(openApi.components.schemas), /DIGITAL_HISTORY_REWRITE/u);
});

test('M2-P016 records exact implementation-head CI while human merge and P017 remain locked', async () => {
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

  assert.equal(state.execution.currentTask, 'M2-P016');
  assert.equal(state.execution.nextAllowedTask, 'M2-P016');
  assert.equal(state.execution.lastCompletedTask, 'M2-P015');
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M2-P016.*M2-P017/u);
  assert.equal(state.github.currentTaskDelivery.taskId, 'M2-P016');
  assert.equal(state.github.currentTaskDelivery.issue, 57);
  assert.equal(state.github.currentTaskDelivery.branch, 'codex/m2-digital-detail');
  assert.equal(
    state.github.currentTaskDelivery.exactHeadCi,
    'CI_PASS_RUN_31468592265_JOB_93706680485',
  );
  assert.equal(state.github.currentTaskDelivery.pullRequest, 58);
  assert.equal(state.github.currentTaskDelivery.pullRequestState, 'DRAFT');
  assert.equal(state.github.currentTaskDelivery.merge, 'NOT_EXECUTED');
  assert.equal(state.github.currentTaskDelivery.mainPostMergeCi, 'NOT_EXECUTED');
  assert.equal(state.github.currentTaskDelivery.m2p017StartAllowed, false);
  assert.equal(state.github.previousTaskDelivery.taskId, 'M2-P015');
  assert.equal(state.github.previousTaskDelivery.pullRequest, 56);
  assert.equal(state.github.previousTaskDelivery.mainPostMergeCiRun, 31462310044);
  assert.equal(state.github.previousTaskDelivery.status, 'CI_PASS');
  assert.equal(evidence.taskId, 'M2-P016');
  assert.equal(evidence.status, 'CI_PASS');
  assert.equal(evidence.environmentBoundary.ci, 'CI_PASS');
  assert.equal(evidence.github.issue, 57);
  assert.equal(evidence.github.pullRequest, 58);
  assert.equal(evidence.github.pullRequestState, 'DRAFT');
  assert.equal(evidence.github.exactHead, 'f76b2c0708bba03c3ce52d72b23b12d8206ed08d');
  assert.equal(evidence.github.exactHeadCi, 'CI_PASS_RUN_31468592265_JOB_93706680485');
  assert.equal(evidence.github.merge, 'NOT_EXECUTED');
  assert.equal(evidence.github.mainPostMergeCi, 'NOT_EXECUTED');
  assert.equal(evidence.m2p017StartAllowed, false);
  assert.match(taskLedger, /M2-P015[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M2-P016[^\r\n]*IN_PROGRESS[^\r\n]*CI_PASS/u);
  assert.match(p0Ledger, /P0-016[^\r\n]*CI_PASS/u);
  assert.match(pageLedger, /P0-016_CI_PASS/u);
  assert.match(apiLedger, /API-030[^\r\n]*P0-016[^\r\n]*IMPLEMENTED/u);
  assert.match(handoff, /^# M2-P016 数码详情交接/u);
  assert.match(handoff, /M2-P017/u);
});
