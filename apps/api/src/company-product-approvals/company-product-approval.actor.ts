import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';

export const COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER = Symbol(
  'COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER',
);

export type CompanyProductApprovalRole =
  | 'COMPANY_PRODUCT_OPS'
  | 'COMPANY_PRICE_REVIEW';

export interface CompanyProductApprovalActor {
  readonly accountTypeCode: CompanyProductApprovalRole;
  readonly companyId: string;
  readonly functionalAccountId: string;
  readonly identityId: string;
  readonly workspaceRoute:
    | '/company-admin/workspaces/product-ops'
    | '/company-admin/workspaces/price-review';
}

export interface CompanyProductApprovalActorResolver {
  resolve(
    request: Request,
    requiredRole: CompanyProductApprovalRole,
  ): Promise<CompanyProductApprovalActor>;
}

@Injectable()
export class DenyCompanyProductApprovalActorResolver
  implements CompanyProductApprovalActorResolver
{
  resolve(): Promise<CompanyProductApprovalActor> {
    return Promise.reject(
      new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'A fixed company product approval session is required',
      ),
    );
  }
}
