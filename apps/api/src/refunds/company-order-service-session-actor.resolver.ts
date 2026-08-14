import { Inject, Injectable } from '@nestjs/common';

import { CompanyAuthService } from '../company-auth/company-auth.service.js';
import { SafeApiError } from '../http/api-error.js';
import type { RefundActor, RefundActorResolver } from './refund.actor.js';

@Injectable()
export class CompanyOrderServiceSessionActorResolver implements RefundActorResolver {
  constructor(@Inject(CompanyAuthService) private readonly authService: CompanyAuthService) {}

  async resolve(cookieHeader: string | undefined): Promise<RefundActor> {
    const session = await this.authService.resolveActiveSession(cookieHeader);
    if (
      session.accountTypeCode !== 'COMPANY_ORDER_SERVICE' ||
      session.workspaceRoute !== '/company-admin/workspaces/order-service'
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', 'Only the company order-service workspace may initiate refunds');
    }
    return {
      accountTypeCode: 'COMPANY_ORDER_SERVICE',
      companyId: session.companyId,
      functionalAccountId: session.functionalAccountId,
      identityType: 'COMPANY_USER',
      identityId: session.userId,
      workspaceRoute: '/company-admin/workspaces/order-service',
    };
  }
}
