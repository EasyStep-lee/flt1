import type { CompanyAccountTypeCode } from '../company-auth/company-workspace.policy.js';
import type { FunctionalAccountStatus } from '../supplier-functional-accounts/supplier-functional-account.policy.js';

export const COMPANY_FUNCTIONAL_ACCOUNT_REPOSITORY = Symbol(
  'COMPANY_FUNCTIONAL_ACCOUNT_REPOSITORY',
);

export interface CompanyFunctionalAccountRecord {
  readonly accountTypeCode: CompanyAccountTypeCode;
  readonly companyId: string;
  readonly displayName: string;
  readonly email: string;
  readonly expiresAt: string | null;
  readonly id: string;
  readonly identityId: string;
  readonly lastLoginAt: string | null;
  readonly mobile: string;
  readonly status: FunctionalAccountStatus;
  readonly version: number;
}

export interface CompanyFunctionalAccountListQuery {
  readonly accountTypeCode?: CompanyAccountTypeCode;
  readonly companyId: string;
  readonly keyword?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: FunctionalAccountStatus;
}

export interface CreateCompanyFunctionalAccountCommand {
  readonly actorFunctionalAccountId: string;
  readonly accountTypeCode: CompanyAccountTypeCode;
  readonly actorIdentityId: string;
  readonly companyId: string;
  readonly displayName: string;
  readonly email: string;
  readonly expiresAt: string | null;
  readonly idempotencyKey: string;
  readonly identityId: string;
  readonly ip: string | null;
  readonly mobile: string;
  readonly requestHash: string;
  readonly requestId: string;
}

export type CompanyFunctionalAccountCreateResult =
  | {
      readonly kind: 'OK';
      readonly replayed: boolean;
      readonly value: CompanyFunctionalAccountRecord;
    }
  | { readonly kind: 'DUPLICATE' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'AUDIT_REQUIRED' };

export interface CompanyFunctionalAccountRepository {
  createCompanyAccount(
    command: CreateCompanyFunctionalAccountCommand,
  ): Promise<CompanyFunctionalAccountCreateResult>;
  findCompanyAccountByMobile(
    companyId: string,
    mobile: string,
  ): Promise<CompanyFunctionalAccountRecord | null>;
  isCompanyActive(companyId: string): Promise<boolean>;
  listCompanyAccounts(query: CompanyFunctionalAccountListQuery): Promise<{
    readonly items: readonly CompanyFunctionalAccountRecord[];
    readonly total: number;
  }>;
}
