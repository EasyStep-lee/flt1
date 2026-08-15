import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { CompanyAuthService } from '../company-auth/company-auth.service.js';
import { resolveCompanyWorkspace } from '../company-auth/company-workspace.policy.js';
import { SafeApiError } from '../http/api-error.js';
import type {
  CompanyEnterpriseReviewerActor,
  EnterpriseOnboardingActorResolver,
} from './enterprise-onboarding.actor.js';

@Injectable()
export class CompanyEnterpriseOnboardingSessionActorResolver
  implements EnterpriseOnboardingActorResolver
{
  constructor(
    @Inject(CompanyAuthService) private readonly authService: CompanyAuthService,
  ) {}

  async resolve(request: Request): Promise<CompanyEnterpriseReviewerActor> {
    const session = await this.authService.resolveActiveSession(request.headers.cookie);
    const workspace = resolveCompanyWorkspace(session.accountTypeCode);
    if (
      !workspace ||
      workspace.accountTypeCode !== 'COMPANY_SUPPLIER_OPS' ||
      workspace.workspaceRoute !== '/company-admin/workspaces/supplier-ops' ||
      session.workspaceRoute !== workspace.workspaceRoute
    ) {
      throw new SafeApiError(
        403,
        'WORKSPACE_FORBIDDEN',
        '当前职能无权审核企业认证',
      );
    }
    return {
      role: 'COMPANY_SUPPLIER_OPS',
      companyId: session.companyId,
      identityId: session.userId,
    };
  }
}
