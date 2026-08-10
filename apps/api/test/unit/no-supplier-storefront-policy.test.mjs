import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NO_SUPPLIER_STOREFRONT_POLICY_ID,
  NoSupplierStorefrontCapabilityError,
  assertCustomerCatalogCapabilityAllowed,
  assertCustomerCatalogPayloadAllowed,
} from '../../dist/governance/no-supplier-storefront.policy.js';

test('P0-009 allows supplier back-office product cooperation', () => {
  assert.equal(
    NO_SUPPLIER_STOREFRONT_POLICY_ID,
    'NO_SUPPLIER_STOREFRONT_CAPABILITIES',
  );
  assert.doesNotThrow(() =>
    assertCustomerCatalogCapabilityAllowed('SUPPLIER_PRODUCT_SUBMISSION'),
  );
  assert.doesNotThrow(() =>
    assertCustomerCatalogPayloadAllowed({
      legalName: '江苏福礼团供应链科技有限公司',
      platformName: '福礼社',
      subjects: {
        paymentPayee: '江苏福礼团供应链科技有限公司',
        refundOperator: '江苏福礼团供应链科技有限公司',
        seller: '江苏福礼团供应链科技有限公司',
      },
    }),
  );
});

test('NEG-M2-009-01 rejects supplier storefront and decoration capabilities', () => {
  assert.throws(
    () => assertCustomerCatalogCapabilityAllowed('SUPPLIER_STOREFRONT'),
    (error) =>
      error instanceof NoSupplierStorefrontCapabilityError &&
      error.category === 'SUPPLIER_STOREFRONT' &&
      error.code === 'FORBIDDEN_CAPABILITY',
  );
});

test('NEG-M2-009-02 rejects supplier payment data in a customer payload', () => {
  assert.throws(
    () =>
      assertCustomerCatalogPayloadAllowed({
        supplierPaymentAccountId: 'supplier-payment-account',
      }),
    (error) =>
      error instanceof NoSupplierStorefrontCapabilityError &&
      error.category === 'SUPPLIER_DIRECT_PAYMENT' &&
      error.code === 'FORBIDDEN_CAPABILITY',
  );
});

test('NEG-M2-009-03 rejects supplier-store cart or coupon ownership', () => {
  assert.throws(
    () => assertCustomerCatalogCapabilityAllowed('SUPPLIER_STORE_CART'),
    (error) =>
      error instanceof NoSupplierStorefrontCapabilityError &&
      error.category === 'SUPPLIER_STORE_CART' &&
      error.code === 'FORBIDDEN_CAPABILITY',
  );
  assert.throws(
    () => assertCustomerCatalogPayloadAllowed({ storeCouponOwnerId: 'supplier-1' }),
    (error) =>
      error instanceof NoSupplierStorefrontCapabilityError &&
      error.category === 'SUPPLIER_STORE_CART',
  );
});
