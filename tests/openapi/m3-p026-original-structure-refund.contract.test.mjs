import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const spec = JSON.parse(await readFile(
  new URL('../../packages/contracts/openapi.json', import.meta.url),
  'utf8',
));

test('API-043 exposes only an approved authorization version and reason while allocation remains server-owned', () => {
  const operation = spec.paths['/v1/aftersales/{afterSaleId}/refund']?.post;
  assert.ok(operation);
  assert.equal(operation.operationId, 'refunds.createOriginalStructureRefund');
  assert.equal(operation.parameters.some((item) => item.in === 'path' && item.name === 'afterSaleId' && item.required), true);
  assert.equal(operation.parameters.some((item) => item.name === 'Idempotency-Key' && item.required), true);
  const requestSchema = operation.requestBody.content['application/json'].schema;
  const request = requestSchema.$ref
    ? spec.components.schemas[requestSchema.$ref.split('/').at(-1)]
    : requestSchema;
  assert.deepEqual(Object.keys(request.properties).sort(), ['authorizationVersion', 'reason']);
  assert.deepEqual(request.required.sort(), ['authorizationVersion', 'reason']);
  assert.equal(JSON.stringify(request).match(/amount|accountId|paymentTransactionId|supplierId|companyId/giu), null);
  const responseRef = operation.responses['201'].content['application/json'].schema.$ref;
  const response = spec.components.schemas[responseRef.split('/').at(-1)];
  assert.equal(JSON.stringify(response).match(/originalWelfare|originalPayment|wechatTransaction|supplyPrice/giu), null);
});
