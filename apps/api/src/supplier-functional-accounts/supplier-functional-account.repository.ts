import type {
  FunctionalAccountStatus,
  SupplierFunctionalAccountTypeCode,
} from './supplier-functional-account.policy.js';

export const FUNCTIONAL_ACCOUNT_REPOSITORY = Symbol('FUNCTIONAL_ACCOUNT_REPOSITORY');

export interface SupplierFunctionalAccountRecord {
  readonly accountTypeCode: SupplierFunctionalAccountTypeCode;
  readonly displayName: string;
  readonly email: string | null;
  readonly expiresAt: string | null;
  readonly id: string;
  readonly identityId: string;
  readonly lastLoginAt: string | null;
  readonly mobile: string;
  readonly status: FunctionalAccountStatus;
  readonly supplierId: string;
  readonly version: number;
}

export interface FunctionalAccountListQuery {
  readonly accountTypeCode?: SupplierFunctionalAccountTypeCode;
  readonly keyword?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: FunctionalAccountStatus;
  readonly supplierId: string;
}

export interface CreateSupplierFunctionalAccountCommand {
  readonly actorIdentityId: string;
  readonly ip: string | null;
  readonly accountTypeCode: SupplierFunctionalAccountTypeCode;
  readonly displayName: string;
  readonly email: string | null;
  readonly expiresAt: string | null;
  readonly idempotencyKey: string;
  readonly identityId: string;
  readonly mobile: string;
  readonly requestHash: string;
  readonly requestId: string;
  readonly supplierId: string;
}

export type FunctionalAccountCreateResult =
  | {
      readonly kind: 'OK';
      readonly replayed: boolean;
      readonly value: SupplierFunctionalAccountRecord;
    }
  | { readonly kind: 'DUPLICATE' }
  | { readonly kind: 'IDEMPOTENCY_CONFLICT' }
  | { readonly kind: 'AUDIT_REQUIRED' };

export interface SupplierFunctionalAccountRepository {
  createAccount(
    command: CreateSupplierFunctionalAccountCommand,
  ): Promise<FunctionalAccountCreateResult>;
  findAccount(
    supplierId: string,
    functionalAccountId: string,
  ): Promise<SupplierFunctionalAccountRecord | null>;
  findAccountByMobile(
    supplierId: string,
    mobile: string,
  ): Promise<SupplierFunctionalAccountRecord | null>;
  isSupplierActive(supplierId: string): Promise<boolean>;
  listAccounts(query: FunctionalAccountListQuery): Promise<{
    readonly items: readonly SupplierFunctionalAccountRecord[];
    readonly total: number;
  }>;
}
