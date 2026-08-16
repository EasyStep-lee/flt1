import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const document = JSON.parse(readFileSync(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));

test('API-038 freezes owner-derived idempotent welfare-card binding with a secret-free response whitelist', () => {
  const operation = document.paths['/v1/consumer/welfare-card-accounts/bind'].post;
  assert.equal(operation.operationId, 'consumerWelfareCard.bindAccount');
  assert.ok(operation.parameters.some((parameter) => parameter.name === 'Idempotency-Key' && parameter.required));
  const requestRef = operation.requestBody.content['application/json'].schema.$ref;
  const request = document.components.schemas[requestRef.split('/').at(-1)];
  assert.deepEqual(request.required.sort(), ['agreementAccepted', 'agreementVersion', 'cardNo', 'method', 'secret']);
  assert.deepEqual(request.properties.method.enum, ['CARD_PASSWORD', 'REDEMPTION_CODE', 'SCAN_CODE']);
  assert.equal(request.properties.secret.description.includes('never persisted'), true);

  for (const status of ['200', '201']) {
    const responseRef = operation.responses[status].content['application/json'].schema.$ref;
    const response = document.components.schemas[responseRef.split('/').at(-1)];
    assert.deepEqual(response.required.sort(), [
      'availableAmount', 'balanceAmount', 'batchNo', 'claimedAt', 'frozenAmount',
      'id', 'maskedCardNo', 'programName', 'status', 'version',
    ]);
    assert.doesNotMatch(JSON.stringify(response), /secret|companyId|consumerUserId|buyerId|programId|batchId|supplierPrice|supplierPayable/iu);
  }
  assert.equal(document.paths['/v1/consumer/welfare-card-accounts/recharge'], undefined);
});
