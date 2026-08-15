import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';

export const ENTERPRISE_ONBOARDING_ACTOR_RESOLVER = Symbol(
  'ENTERPRISE_ONBOARDING_ACTOR_RESOLVER',
);

export interface CompanyEnterpriseReviewerActor {
  readonly role: 'COMPANY_SUPPLIER_OPS';
  readonly companyId: string;
  readonly identityId: string;
}

export interface EnterpriseOnboardingActorResolver {
  resolve(request: Request): Promise<CompanyEnterpriseReviewerActor>;
}

@Injectable()
export class DenyEnterpriseOnboardingActorResolver
  implements EnterpriseOnboardingActorResolver
{
  resolve(): Promise<CompanyEnterpriseReviewerActor> {
    return Promise.reject(
      new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'A fixed company functional session is required',
      ),
    );
  }
}
