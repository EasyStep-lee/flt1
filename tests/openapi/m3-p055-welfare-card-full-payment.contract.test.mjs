import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const document = JSON.parse(readFileSync(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));

test('API-092 freezes one owner-derived account-only welfare full-payment command with a zero external payable response', () => {
  const operation = document.paths['/v1/consumer/orders/{orderId}/welfare-card-full-payment'].post;
  assert.equal(operation.operationId, 'consumerWelfareCard.payFullOrder');
  assert.equal(operation.parameters.find(({ in: location, name }) => location === 'header' && name === 'Idempotency-Key')?.required, true);
  assert.deepEqual(operation.parameters.filter(({ in: location }) => location === 'path').map(({ name }) => name), ['orderId']);
  const requestRef = operation.requestBody.content['application/json'].schema.$ref;
  const request = document.components.schemas[requestRef.split('/').at(-1)];
  assert.deepEqual(request.required, ['accountId']);
  assert.deepEqual(Object.keys(request.properties), ['accountId']);
  const responseRef = operation.responses['201'].content['application/json'].schema.$ref;
  const response = document.components.schemas[responseRef.split('/').at(-1)];
  assert.deepEqual(response.required.sort(), ['cashAmount', 'itemCount', 'orderId', 'orderNo', 'orderStatus', 'paidAt', 'paymentMode', 'paymentStatus', 'supplierFulfillmentCount', 'welfareCardAmount']);
  assert.deepEqual(response.properties.cashAmount.enum, [0]);
  assert.doesNotMatch(JSON.stringify({ operation, request, response }), /"(?:companyId|consumerUserId|buyerId|supplierId|supplyPrice|supplierPayable|accountBalance|secret)"\s*:/iu);
});
