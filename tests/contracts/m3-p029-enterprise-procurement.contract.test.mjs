import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('M3-P029 freezes the enterprise procurement DTO, ownership and payment-route boundary', () => {
  const contract = read('docs/contracts/m3/M3-P029-unified-enterprise-procurement.md');
  const repository = read('apps/api/src/orders/order.repository.ts');
  const service = read('apps/api/src/orders/order.service.ts');
  const payment = read('apps/api/src/payments/prisma-payment.repository.ts');
  const remittance = read('apps/api/src/enterprise-remittances/prisma-enterprise-remittance.repository.ts');

  assert.match(contract, /P0-029/u);
  assert.match(contract, /WECHAT_PAY.*BANK_TRANSFER/su);
  assert.match(repository, /enterpriseAddressId/u);
  assert.match(repository, /invoiceProfileId/u);
  assert.match(service, /ENTERPRISE_SCOPE_FORBIDDEN/u);
  assert.match(service, /maskMobile/u);
  assert.match(service, /maskTaxNumber/u);
  assert.match(payment, /enterpriseProcurementOrder.*WECHAT_PAY/su);
  assert.match(remittance, /enterpriseProcurementOrder.*BANK_TRANSFER/su);
  assert.doesNotMatch(service, /ALIPAY|PERSONAL_RECHARGE/u);
});
