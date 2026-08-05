export const SINGLE_MERCHANT_REPOSITORY = Symbol('SINGLE_MERCHANT_REPOSITORY');

export interface CustomerFacingCompanyRecord {
  readonly legalName: string;
  readonly platformName: string;
  readonly status: 'ACTIVE' | 'SUSPENDED';
}

export interface SingleMerchantRepository {
  findCustomerFacingCompanies(): Promise<readonly CustomerFacingCompanyRecord[]>;
}
