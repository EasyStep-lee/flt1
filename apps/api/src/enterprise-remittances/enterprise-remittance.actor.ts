import { Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';

export const COMPANY_FINANCE_ACTOR_RESOLVER = Symbol('COMPANY_FINANCE_ACTOR_RESOLVER');

export interface CompanyFinanceActor {
  readonly accountTypeCode: 'COMPANY_FINANCE';
  readonly companyId: string;
  readonly functionalAccountId: string;
  readonly identityId: string;
  readonly workspaceRoute: '/company-admin/workspaces/finance';
}

export interface CompanyFinanceActorResolver {
  resolve(cookieHeader: string | undefined): Promise<CompanyFinanceActor | null>;
}

@Injectable()
export class DenyCompanyFinanceActorResolver implements CompanyFinanceActorResolver {
  async resolve(): Promise<null> {
    return null;
  }
}

export const assertCompanyFinanceActor = (actor: CompanyFinanceActor | null): CompanyFinanceActor => {
  if (!actor) {
    throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'A company finance session is required');
  }
  if (
    actor.accountTypeCode !== 'COMPANY_FINANCE' ||
    actor.workspaceRoute !== '/company-admin/workspaces/finance'
  ) {
    throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', 'Only the company finance workspace may review remittance');
  }
  return actor;
};
