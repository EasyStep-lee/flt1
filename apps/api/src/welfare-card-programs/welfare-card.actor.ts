import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';

export const WELFARE_CARD_ACTOR_RESOLVER = Symbol('WELFARE_CARD_ACTOR_RESOLVER');

export interface WelfareCardActor {
  readonly role: 'COMPANY_WELFARE_CARD';
  readonly companyId: string;
  readonly identityId: string;
  readonly functionalAccountId: string;
}

export interface WelfareCardActorResolver {
  resolve(request: Request): Promise<WelfareCardActor>;
}

@Injectable()
export class DenyWelfareCardActorResolver implements WelfareCardActorResolver {
  resolve(): Promise<WelfareCardActor> {
    return Promise.reject(new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'A fixed company welfare-card session is required'));
  }
}
