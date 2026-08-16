import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { CompanyAuthService } from '../company-auth/company-auth.service.js';
import { SafeApiError } from '../http/api-error.js';
import type { WelfareCardActor, WelfareCardActorResolver } from './welfare-card.actor.js';

@Injectable()
export class CompanyWelfareCardSessionActorResolver implements WelfareCardActorResolver {
  constructor(@Inject(CompanyAuthService) private readonly authService: CompanyAuthService) {}

  async resolve(request: Request): Promise<WelfareCardActor> {
    const session = await this.authService.resolveActiveSession(request.headers.cookie);
    if (
      session.accountTypeCode !== 'COMPANY_WELFARE_CARD' ||
      session.workspaceRoute !== '/company-admin/workspaces/welfare-card'
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '仅公司福利卡运营职能可访问福利卡计划与批次');
    }
    return {
      role: 'COMPANY_WELFARE_CARD',
      companyId: session.companyId,
      identityId: session.userId,
      functionalAccountId: session.functionalAccountId,
    };
  }
}
