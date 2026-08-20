import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const spec = JSON.parse(await readFile(
  new URL('../../packages/contracts/openapi.json', import.meta.url),
  'utf8',
));

test('API-043 keeps split refund targets server-owned and returns only channel amounts and recovery statuses', () => {
  const operation = spec.paths['/v1/aftersales/{afterSaleId}/refund']?.post;
  assert.ok(operation);
  const requestRef = operation.requestBody.content['application/json'].schema.$ref;
  const request = spec.components.schemas[requestRef.split('/').at(-1)];
  assert.deepEqual(Object.keys(request.properties).sort(), ['authorizationVersion', 'reason']);
  const responseRef = operation.responses['201'].content['application/json'].schema.$ref;
  const response = spec.components.schemas[responseRef.split('/').at(-1)];
  assert.deepEqual(response.required.sort(), [
    'afterSaleId', 'cashRefundAmount', 'orderId', 'orderItemId', 'refundId', 'refundNo',
    'status', 'wechatChannelStatus', 'welfareCardRefundAmount', 'welfareChannelStatus',
  ].sort());
  assert.equal(response.properties.welfareCardRefundAmount.minimum, 0);
  assert.equal(response.properties.cashRefundAmount.minimum, 0);
  assert.doesNotMatch(
    JSON.stringify({ request, response }),
    /originalWelfareCardAccountId|originalPaymentTransactionId|originalWechatTransactionId|supplyPrice|supplierId/iu,
  );
});

test('API-043 execution ledger maps P0-058 and preserves the task-local contract marker', async () => {
  const ledger = await readFile(
    new URL('../../福礼社Codex5.6开发执行包V1.1/12-OpenAPI-DTO-错误码台账.csv', import.meta.url),
    'utf8',
  );
  const row = ledger.split(/\r?\n/u).find((line) => line.startsWith('API-043,'));
  assert.ok(row);
  assert.match(row, /P0-058/u);
  assert.match(row, /任务内契约细化/u);
});
