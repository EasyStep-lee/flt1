import { Inject, Injectable } from '@nestjs/common';

import { CompanyAuthService } from '../company-auth/company-auth.service.js';
import { SafeApiError } from '../http/api-error.js';
import type {
  CompanyFinanceActor,
  CompanyFinanceActorResolver,
} from './enterprise-remittance.actor.js';

@Injectable()
export class CompanyFinanceSessionActorResolver implements CompanyFinanceActorResolver {
  constructor(@Inject(CompanyAuthService) private readonly authService: CompanyAuthService) {}

  async resolve(cookieHeader: string | undefined): Promise<CompanyFinanceActor> {
    const session = await this.authService.resolveActiveSession(cookieHeader);
    if (
      session.accountTypeCode !== 'COMPANY_FINANCE' ||
      session.workspaceRoute !== '/company-admin/workspaces/finance'
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', 'Only the company finance workspace may review remittance');
    }
    return {
      accountTypeCode: 'COMPANY_FINANCE',
      companyId: session.companyId,
      functionalAccountId: session.functionalAccountId,
      identityId: session.userId,
      workspaceRoute: '/company-admin/workspaces/finance',
    };
  }
}
