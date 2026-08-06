import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';

export const AUDIT_ACTOR_RESOLVER = Symbol('AUDIT_ACTOR_RESOLVER');

export interface AuditActor {
  readonly accountTypeCode: string;
  readonly companyId: string;
  readonly functionalAccountId: string;
  readonly identityId: string;
  readonly workspaceRoute: string;
}

export interface AuditActorResolver {
  resolve(request: Request): Promise<AuditActor>;
}

@Injectable()
export class DenyAuditActorResolver implements AuditActorResolver {
  resolve(): Promise<AuditActor> {
    throw new SafeApiError(
      401,
      'AUTHENTICATION_REQUIRED',
      'An authenticated company audit session is required',
    );
  }
}
