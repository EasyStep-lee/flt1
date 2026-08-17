import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const document = JSON.parse(readFileSync(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));

test('API-106 exposes an idempotent query-before-release cancellation command with a strict private response', () => {
  const operation = document.paths['/v1/consumer/orders/{orderId}/welfare-card-wechat-payment/cancel'].post;
  assert.equal(operation.operationId, 'payments.cancelWelfareCardWechatPayment');
  assert.equal(operation.parameters.find(({ in: location, name }) => location === 'header' && name === 'Idempotency-Key')?.required, true);
  const requestRef = operation.requestBody.content['application/json'].schema.$ref;
  const request = document.components.schemas[requestRef.split('/').at(-1)];
  assert.deepEqual(request.required, ['reason']);
  assert.deepEqual(Object.keys(request.properties), ['reason']);
  assert.deepEqual(request.properties.reason.enum, ['USER_CANCELLED', 'PAYMENT_TIMEOUT', 'PAYMENT_FAILED']);
  const responseRef = operation.responses['200'].content['application/json'].schema.$ref;
  const response = document.components.schemas[responseRef.split('/').at(-1)];
  assert.deepEqual(response.required, ['resolution', 'orderId', 'paymentStatus', 'orderStatus', 'retriable']);
  assert.deepEqual(Object.keys(response.properties), ['orderId', 'orderStatus', 'paymentStatus', 'resolution', 'retriable']);
  assert.deepEqual(response.properties.resolution.enum, ['CANCELLED', 'PAID', 'UNKNOWN']);
  assert.deepEqual(response.properties.paymentStatus.enum, ['CLOSED', 'PAID', 'UNKNOWN']);
  assert.doesNotMatch(JSON.stringify({ operation, request, response }), /"(?:accountId|companyId|consumerUserId|buyerId|supplierId|supplyPrice|balanceAmount|merchantConfigRef|secret)"\s*:/iu);
});

test('API-106 is registered in the generated-contract miniapp transport map', () => {
  const source = readFileSync(new URL('../../packages/contracts/src/miniapp-contracts.ts', import.meta.url), 'utf8');
  assert.match(source, /readonly 'payments\.cancelWelfareCardWechatPayment'/u);
  assert.match(source, /SuccessJsonResponse<OperationById<'payments\.cancelWelfareCardWechatPayment'>>/u);
});
