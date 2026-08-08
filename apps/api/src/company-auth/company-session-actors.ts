import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import type {
  AuditActor,
  AuditActorResolver,
} from '../audit/audit-log.actor.js';
import { SafeApiError } from '../http/api-error.js';
import type {
  SupplierOnboardingActor,
  SupplierOnboardingActorResolver,
  SupplierOnboardingRequiredRole,
} from '../supplier-onboarding/supplier-onboarding.actor.js';
import type {
  CompanyFunctionalAccountActor,
  FunctionalAccountActorResolver,
} from '../supplier-functional-accounts/supplier-functional-account.actor.js';
import { CompanyAuthService } from './company-auth.service.js';
import { resolveCompanyWorkspace } from './company-workspace.policy.js';

const assertFixedRole = (
  accountTypeCode: string,
  workspaceRoute: string,
  requiredRole: string,
): void => {
  const workspace = resolveCompanyWorkspace(accountTypeCode);
  if (
    !workspace ||
    workspace.accountTypeCode !== requiredRole ||
    workspace.workspaceRoute !== workspaceRoute
  ) {
    throw new SafeApiError(
      403,
      'WORKSPACE_FORBIDDEN',
      '当前职能无权调用该接口',
    );
  }
};

@Injectable()
export class CompanySupplierOnboardingSessionActorResolver
  implements SupplierOnboardingActorResolver
{
  constructor(
    @Inject(CompanyAuthService) private readonly authService: CompanyAuthService,
  ) {}

  async resolve(
    request: Request,
    requiredRole: SupplierOnboardingRequiredRole,
  ): Promise<SupplierOnboardingActor> {
    const session = await this.authService.resolveActiveSession(
      request.headers.cookie,
    );
    assertFixedRole(
      session.accountTypeCode,
      session.workspaceRoute,
      requiredRole,
    );
    if (requiredRole !== 'COMPANY_SUPPLIER_OPS') {
      throw new SafeApiError(
        403,
        'WORKSPACE_FORBIDDEN',
        '公司会话不能访问供应商职能接口',
      );
    }
    return {
      companyId: session.companyId,
      identityId: session.userId,
      role: 'COMPANY_SUPPLIER_OPS',
    };
  }
}

@Injectable()
export class CompanyAuditSessionActorResolver implements AuditActorResolver {
  constructor(
    @Inject(CompanyAuthService) private readonly authService: CompanyAuthService,
  ) {}

  async resolve(request: Request): Promise<AuditActor> {
    const session = await this.authService.resolveActiveSession(
      request.headers.cookie,
    );
    assertFixedRole(
      session.accountTypeCode,
      session.workspaceRoute,
      'COMPANY_AUDIT',
    );
    return {
      ownerType: 'COMPANY',
      accountTypeCode: session.accountTypeCode,
      companyId: session.companyId,
      functionalAccountId: session.functionalAccountId,
      identityType: 'COMPANY_USER',
      identityId: session.userId,
      supplierId: null,
      workspaceRoute: session.workspaceRoute,
      permissionCodes: [
        'audit_event.read',
        'sensitive_export.request',
        'sensitive_export.review',
      ],
    };
  }
}

@Injectable()
export class CompanyFunctionalAccountSessionActorResolver
  implements FunctionalAccountActorResolver
{
  constructor(
    @Inject(CompanyAuthService) private readonly authService: CompanyAuthService,
  ) {}

  async resolve(request: Request): Promise<CompanyFunctionalAccountActor> {
    const session = await this.authService.resolveActiveSession(
      request.headers.cookie,
    );
    assertFixedRole(
      session.accountTypeCode,
      session.workspaceRoute,
      'COMPANY_SUPER_ADMIN',
    );
    return {
      accountTypeCode: 'COMPANY_SUPER_ADMIN',
      companyId: session.companyId,
      functionalAccountId: session.functionalAccountId,
      identityId: session.userId,
      workspaceRoute: '/company-admin/workspaces/system',
    };
  }
}
