import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const document = JSON.parse(readFileSync(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));
const schema = (name) => document.components.schemas[name];

test('API-040 exposes an owner-derived append-only ledger whitelist without internal ownership or supply fields', () => {
  const operation = document.paths['/v1/consumer/welfare-card-accounts/{accountId}/ledger'].get;
  assert.equal(operation.operationId, 'consumerWelfareCard.getLedger');
  assert.ok(operation.parameters.some((parameter) => parameter.name === 'accountId' && parameter.in === 'path' && parameter.required));
  assert.deepEqual(schema('WelfareCardLedgerAccountResponseDto').required.sort(), [
    'availableAmount', 'balanceAmount', 'batchNo', 'frozenAmount', 'id', 'maskedCardNo',
    'programName', 'status', 'version',
  ].sort());
  assert.deepEqual(schema('WelfareCardLedgerItemResponseDto').properties.businessType.enum, [
    'CLAIM', 'GRANT', 'GIFT', 'FREEZE', 'RELEASE', 'CAPTURE', 'REFUND', 'REVERSAL', 'ADJUSTMENT',
  ]);
  assert.equal(schema('WelfareCardLedgerItemResponseDto').properties.sequence.minimum, 1);
  assert.doesNotMatch(JSON.stringify({
    account: schema('WelfareCardLedgerAccountResponseDto'),
    item: schema('WelfareCardLedgerItemResponseDto'),
  }), /consumerUserId|ownerConsumerUserId|identityId|functionalAccountId|"cardNo"|supplyPrice|supplierPayable/iu);
});

test('company welfare-card and finance operations remain separate and adjustment decisions require second verification', () => {
  assert.equal(document.paths['/v1/company/welfare-card/accounts'].get.operationId, 'companyWelfareCard.listAccounts');
  assert.equal(document.paths['/v1/company/welfare-card/accounts/{accountId}/ledger'].get.operationId, 'companyWelfareCard.getAccountLedger');
  const create = document.paths['/v1/company/welfare-card/accounts/{accountId}/adjustments'].post;
  const decide = document.paths['/v1/company/welfare-card/adjustments/{adjustmentId}/decision'].post;
  assert.equal(create.operationId, 'companyWelfareCardFinance.createAdjustment');
  assert.equal(decide.operationId, 'companyWelfareCardFinance.decideAdjustment');
  assert.ok(create.parameters.some((parameter) => parameter.name === 'Idempotency-Key' && parameter.required));
  assert.ok(decide.parameters.some((parameter) => parameter.name === 'Idempotency-Key' && parameter.required));
  assert.deepEqual(schema('CreateWelfareCardAdjustmentRequestDto').properties.businessType.enum, ['ADJUSTMENT', 'REVERSAL']);
  assert.deepEqual(schema('DecideWelfareCardAdjustmentRequestDto').required.sort(), ['decision', 'opinion', 'secondVerificationCode', 'version']);
  assert.equal(schema('DecideWelfareCardAdjustmentRequestDto').properties.secondVerificationCode.description, 'Never persisted or returned');
  assert.doesNotMatch(JSON.stringify(schema('WelfareCardAdjustmentResponseDto')), /applicant|reviewer|identityId|functionalAccountId|secondVerificationCode|finalBalance/iu);
  assert.equal(document.paths['/v1/consumer/welfare-card-accounts/recharge'], undefined);
  assert.equal(document.paths['/v1/company/welfare-card/accounts/{accountId}/recharge'], undefined);
});

test('native miniapp contract exposes the generated consumer ledger operation', () => {
  const source = readFileSync(
    new URL('../../packages/contracts/src/miniapp-contracts.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /'consumerWelfareCard\.getLedger'/u);
  assert.match(source, /SuccessJsonResponse<OperationById<'consumerWelfareCard\.getLedger'>>/u);
});
