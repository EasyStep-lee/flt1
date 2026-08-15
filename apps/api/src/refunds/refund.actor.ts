import { Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';

export const REFUND_ACTOR_RESOLVER = Symbol('REFUND_ACTOR_RESOLVER');

export interface RefundActor {
  readonly accountTypeCode: 'COMPANY_ORDER_SERVICE';
  readonly companyId: string;
  readonly functionalAccountId: string;
  readonly identityType: 'COMPANY_USER';
  readonly identityId: string;
  readonly workspaceRoute: '/company-admin/workspaces/order-service';
}

export interface RefundActorResolver {
  resolve(cookieHeader: string | undefined): Promise<RefundActor | null>;
}

@Injectable()
export class DenyRefundActorResolver implements RefundActorResolver {
  async resolve(): Promise<null> {
    return null;
  }
}

export const assertRefundActor = (actor: RefundActor | null): RefundActor => {
  if (!actor) {
    throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'A company order-service session is required');
  }
  if (
    actor.accountTypeCode !== 'COMPANY_ORDER_SERVICE' ||
    actor.workspaceRoute !== '/company-admin/workspaces/order-service'
  ) {
    throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', 'Only the company order-service workspace may initiate refunds');
  }
  return actor;
};
