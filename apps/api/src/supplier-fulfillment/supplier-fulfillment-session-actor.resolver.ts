import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';
import { SupplierAuthService } from '../supplier-auth/supplier-auth.service.js';
import type { SupplierFulfillmentActor, SupplierFulfillmentActorResolver } from './supplier-fulfillment.actor.js';

@Injectable()
export class SupplierFulfillmentSessionActorResolver implements SupplierFulfillmentActorResolver {
  constructor(@Inject(SupplierAuthService) private readonly authService: SupplierAuthService) {}

  async resolve(request: Request): Promise<SupplierFulfillmentActor> {
    const session = await this.authService.resolveActiveSession(request.headers.cookie);
    if (
      session.accountTypeCode !== 'SUPPLIER_FULFILLMENT' ||
      session.workspaceRoute !== '/supplier/workspaces/fulfillment'
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '供应商履约职能页面会话无效');
    }
    return {
      role: 'SUPPLIER_FULFILLMENT',
      supplierId: session.supplierId,
      identityId: session.userId,
      functionalAccountId: session.functionalAccountId,
    };
  }
}
