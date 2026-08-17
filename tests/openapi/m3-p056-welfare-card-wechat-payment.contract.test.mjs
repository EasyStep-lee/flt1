import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const document = JSON.parse(readFileSync(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));

test('API-105 exposes one account-only mixed-payment command and a private amount-conserving response whitelist', () => {
  const operation = document.paths['/v1/consumer/orders/{orderId}/welfare-card-wechat-payment'].post;
  assert.equal(operation.operationId, 'payments.createWelfareCardWechatPayment');
  assert.equal(operation.parameters.find(({ in: location, name }) => location === 'header' && name === 'Idempotency-Key')?.required, true);
  const requestRef = operation.requestBody.content['application/json'].schema.$ref;
  const request = document.components.schemas[requestRef.split('/').at(-1)];
  assert.deepEqual(request.required, ['accountId']);
  assert.deepEqual(Object.keys(request.properties), ['accountId']);
  const responseRef = operation.responses['201'].content['application/json'].schema.$ref;
  const response = document.components.schemas[responseRef.split('/').at(-1)];
  for (const field of ['paymentMode', 'welfareCardAmount', 'cashAmount', 'totalAmount', 'amount', 'clientPayment']) {
    assert.ok(response.required.includes(field), field);
  }
  assert.deepEqual(response.properties.paymentMode.enum, ['WELFARE_CARD_WECHAT']);
  assert.deepEqual(response.properties.channel.enum, ['WECHAT_PAY']);
  assert.doesNotMatch(JSON.stringify({ operation, request, response }), /"(?:companyId|consumerUserId|buyerId|supplierId|supplyPrice|balanceAmount|merchantConfigRef|secret)"\s*:/iu);
});
