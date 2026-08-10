import { Inject, Injectable } from '@nestjs/common';
import {
  COMPANY_LEGAL_NAME,
  PLATFORM_NAME,
  type PublicMerchantProfile,
} from '@fulishe/contracts';

import { SafeApiError, type ApiErrorCode } from '../http/api-error.js';
import {
  NoSupplierStorefrontCapabilityError,
  assertCustomerCatalogPayloadAllowed,
} from '../governance/no-supplier-storefront.policy.js';
import {
  SINGLE_MERCHANT_REPOSITORY,
  type SingleMerchantRepository,
} from './single-merchant.repository.js';

export { COMPANY_LEGAL_NAME, PLATFORM_NAME } from '@fulishe/contracts';

export type SingleMerchantPolicyErrorCode = Extract<
  ApiErrorCode,
  | 'FORBIDDEN_CAPABILITY'
  | 'PAYEE_FORBIDDEN'
  | 'SELLER_IDENTITY_FORBIDDEN'
  | 'SINGLE_MERCHANT_VIOLATION'
>;

export class SingleMerchantPolicyError extends SafeApiError {
  constructor(statusCode: 400 | 409, code: SingleMerchantPolicyErrorCode, message: string) {
    super(statusCode, code, message);
    this.name = 'SingleMerchantPolicyError';
  }
}

const sellerOverrideKeys = new Set([
  'merchantId',
  'seller',
  'sellerId',
  'sellerType',
  'supplierId',
]);
const payeeOverrideKeys = new Set([
  'payee',
  'payeeId',
  'payeeType',
  'paymentAccount',
  'paymentAccountId',
]);
const allowedKeys = new Set(['context']);

const validateRequest = (input: Readonly<Record<string, unknown>>): void => {
  try {
    assertCustomerCatalogPayloadAllowed(input);
  } catch (error) {
    if (error instanceof NoSupplierStorefrontCapabilityError) {
      throw new SingleMerchantPolicyError(
        400,
        'FORBIDDEN_CAPABILITY',
        'Supplier storefront commerce is not supported',
      );
    }
    throw error;
  }
  const keys = Object.keys(input);
  if (keys.some((key) => sellerOverrideKeys.has(key))) {
    throw new SingleMerchantPolicyError(
      400,
      'SELLER_IDENTITY_FORBIDDEN',
      'Customer seller identity cannot be overridden',
    );
  }
  if (keys.some((key) => payeeOverrideKeys.has(key))) {
    throw new SingleMerchantPolicyError(
      400,
      'PAYEE_FORBIDDEN',
      'Customer payment payee cannot be overridden',
    );
  }
  if (keys.some((key) => !allowedKeys.has(key))) {
    throw new SafeApiError(400, 'REQUEST_INVALID', 'Request is invalid');
  }
  const context = input.context;
  if (
    context !== undefined &&
    !['ALL', 'PAYMENT', 'REFUND', 'SALE'].includes(String(context))
  ) {
    throw new SafeApiError(400, 'REQUEST_INVALID', 'Request is invalid');
  }
};

@Injectable()
export class SingleMerchantService {
  constructor(
    @Inject(SINGLE_MERCHANT_REPOSITORY)
    private readonly repository: SingleMerchantRepository,
  ) {}

  async getPublicMerchantProfile(
    input: Readonly<Record<string, unknown>>,
  ): Promise<PublicMerchantProfile> {
    validateRequest(input);
    const companies = await this.repository.findCustomerFacingCompanies();
    if (
      companies.length !== 1 ||
      companies[0]?.legalName !== COMPANY_LEGAL_NAME ||
      companies[0]?.platformName !== PLATFORM_NAME ||
      companies[0]?.status !== 'ACTIVE'
    ) {
      throw new SingleMerchantPolicyError(
        409,
        'SINGLE_MERCHANT_VIOLATION',
        'Single merchant invariant is not satisfied',
      );
    }

    const profile: PublicMerchantProfile = {
      platformName: PLATFORM_NAME,
      legalName: COMPANY_LEGAL_NAME,
      subjects: {
        seller: COMPANY_LEGAL_NAME,
        paymentPayee: COMPANY_LEGAL_NAME,
        refundOperator: COMPANY_LEGAL_NAME,
      },
    };
    assertCustomerCatalogPayloadAllowed(profile);
    return profile;
  }
}
