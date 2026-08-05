import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPANY_LEGAL_NAME,
  PLATFORM_NAME,
  SingleMerchantPolicyError,
  SingleMerchantService,
} from '../../dist/merchant/single-merchant.service.js';

const activeCompany = {
  legalName: COMPANY_LEGAL_NAME,
  platformName: PLATFORM_NAME,
  status: 'ACTIVE',
};

const repositoryWith = (...companies) => ({
  findCustomerFacingCompanies: async () => companies,
});

test('P0-001 resolves sale, payment and refund to the one company', async () => {
  const service = new SingleMerchantService(repositoryWith(activeCompany));

  const profile = await service.getPublicMerchantProfile({});

  assert.deepEqual(profile, {
    platformName: '福礼社',
    legalName: '江苏福礼团供应链科技有限公司',
    subjects: {
      seller: '江苏福礼团供应链科技有限公司',
      paymentPayee: '江苏福礼团供应链科技有限公司',
      refundOperator: '江苏福礼团供应链科技有限公司',
    },
  });
  assert.doesNotMatch(JSON.stringify(profile), /id|status|wechatPayConfigRef|supplier/iu);
});

test('NEG-M1-001-01 rejects a supplier seller override', async () => {
  const service = new SingleMerchantService(repositoryWith(activeCompany));

  await assert.rejects(
    service.getPublicMerchantProfile({ sellerId: 'supplier-controlled' }),
    (error) =>
      error instanceof SingleMerchantPolicyError &&
      error.code === 'SELLER_IDENTITY_FORBIDDEN',
  );
});

test('NEG-M1-001-02 rejects a supplier payment account', async () => {
  const service = new SingleMerchantService(repositoryWith(activeCompany));

  await assert.rejects(
    service.getPublicMerchantProfile({ payeeId: 'supplier-payment-account' }),
    (error) =>
      error instanceof SingleMerchantPolicyError && error.code === 'PAYEE_FORBIDDEN',
  );
});

test('NEG-M1-001-03 rejects a second customer-facing company', async () => {
  const service = new SingleMerchantService(
    repositoryWith(activeCompany, { ...activeCompany }),
  );

  await assert.rejects(
    service.getPublicMerchantProfile({}),
    (error) =>
      error instanceof SingleMerchantPolicyError &&
      error.code === 'SINGLE_MERCHANT_VIOLATION',
  );
});
