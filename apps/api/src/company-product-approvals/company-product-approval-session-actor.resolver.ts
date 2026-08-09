import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { CompanyAuthService } from '../company-auth/company-auth.service.js';
import { SafeApiError } from '../http/api-error.js';
import type {
  CompanyProductApprovalActor,
  CompanyProductApprovalActorResolver,
  CompanyProductApprovalRole,
} from './company-product-approval.actor.js';

const routeByRole = {
  COMPANY_PRODUCT_OPS: '/company-admin/workspaces/product-ops',
  COMPANY_PRICE_REVIEW: '/company-admin/workspaces/price-review',
} as const;

@Injectable()
export class CompanyProductApprovalSessionActorResolver
  implements CompanyProductApprovalActorResolver
{
  constructor(
    @Inject(CompanyAuthService) private readonly authService: CompanyAuthService,
  ) {}

  async resolve(
    request: Request,
    requiredRole: CompanyProductApprovalRole,
  ): Promise<CompanyProductApprovalActor> {
    const session = await this.authService.resolveActiveSession(request.headers.cookie);
    if (
      session.accountTypeCode !== requiredRole ||
      session.workspaceRoute !== routeByRole[requiredRole]
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '当前职能无权调用该审核接口');
    }
    return {
      accountTypeCode: requiredRole,
      companyId: session.companyId,
      functionalAccountId: session.functionalAccountId,
      identityId: session.userId,
      workspaceRoute: routeByRole[requiredRole],
    };
  }
}
