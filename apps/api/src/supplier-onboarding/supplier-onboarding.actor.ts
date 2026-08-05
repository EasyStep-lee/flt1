import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';

export const SUPPLIER_ONBOARDING_ACTOR_RESOLVER = Symbol(
  'SUPPLIER_ONBOARDING_ACTOR_RESOLVER',
);

export type SupplierOnboardingRequiredRole =
  | 'COMPANY_SUPPLIER_OPS'
  | 'SUPPLIER_ACCOUNT_ADMIN';

export interface CompanySupplierOpsActor {
  readonly role: 'COMPANY_SUPPLIER_OPS';
  readonly companyId: string;
  readonly identityId: string;
}

export interface SupplierAccountAdminActor {
  readonly role: 'SUPPLIER_ACCOUNT_ADMIN';
  readonly supplierId: string;
  readonly identityId: string;
}

export type SupplierOnboardingActor =
  | CompanySupplierOpsActor
  | SupplierAccountAdminActor;

export interface SupplierOnboardingActorResolver {
  resolve(
    request: Request,
    requiredRole: SupplierOnboardingRequiredRole,
  ): Promise<SupplierOnboardingActor>;
}

@Injectable()
export class DenySupplierOnboardingActorResolver
  implements SupplierOnboardingActorResolver
{
  resolve(): Promise<SupplierOnboardingActor> {
    return Promise.reject(
      new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'A fixed functional session is required',
      ),
    );
  }
}
