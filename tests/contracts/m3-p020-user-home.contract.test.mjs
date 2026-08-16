import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('M3-P020 ledgers and generated contract preserve the personal-only home boundary', () => {
  const state = JSON.parse(read('福礼社Codex5.6开发执行包V1.1/16-项目状态.json'));
  const openapi = JSON.parse(read('packages/contracts/openapi.json'));
  const app = JSON.parse(read('apps/user-miniapp/src/app.json'));
  const taskLedger = read('福礼社Codex5.6开发执行包V1.1/03-任务台账.csv');
  const p0Ledger = read('福礼社Codex5.6开发执行包V1.1/04-P0-1至P0-119验收矩阵.csv');
  const apiLedger = read('福礼社Codex5.6开发执行包V1.1/12-OpenAPI-DTO-错误码台账.csv');

  assert.equal(state.execution.currentTask, 'M3-P052');
  assert.equal(state.execution.nextAllowedTask, 'M3-P052');
  assert.match(taskLedger, /M3-P020[^\r\n]+DONE,CI_PASS/u);
  assert.match(taskLedger, /M3-P022[^\r\n]+DONE,CI_PASS/u);
  assert.match(taskLedger, /M3-P023[^\r\n]+DONE,CI_PASS/u);
  assert.match(taskLedger, /M3-P025[^\r\n]+DONE,CI_PASS/u);
  assert.match(taskLedger, /M3-P026[^\r\n]+DONE,CI_PASS/u);
  assert.match(taskLedger, /M3-P028[^\r\n]+DONE,CI_PASS/u);
  assert.match(taskLedger, /M3-P031[^\r\n]+DONE,CI_PASS/u);
  assert.match(taskLedger, /M3-P051[^\r\n]+DONE,CI_PASS/u);
  assert.match(taskLedger, /M3-P052[^\r\n]+IN_PROGRESS,(?:LOCAL_PASS|CI_PASS)/u);
  assert.match(p0Ledger, /P0-020[^\r\n]+CI_PASS/u);
  assert.match(apiLedger, /API-029[^\r\n]+GENERATED,IMPLEMENTED,IMPLEMENTED/u);

  const responseSchema = openapi.paths['/v1/catalog/products'].get.responses['200'].content['application/json'].schema;
  const serializedSchema = JSON.stringify(responseSchema);
  assert.doesNotMatch(serializedSchema, /supplyPrice|enterpriseSalePrice|supplierPayable|inventoryBalance/iu);
  assert.equal(openapi.paths['/v1/catalog/products'].get.operationId, 'catalog.listProducts');
  assert.equal(app.pages[0], 'pages/home/index');
  assert.deepEqual(app.tabBar.list.map(({ pagePath }) => pagePath), [
    'pages/home/index',
    'pages/category/index',
    'pages/cart/index',
    'pages/profile/index',
  ]);
});
