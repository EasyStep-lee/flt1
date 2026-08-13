import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';
import { SupplierAuthService } from '../supplier-auth/supplier-auth.service.js';
import type { SupplierInventoryActor, SupplierInventoryActorResolver } from './inventory.actor.js';

@Injectable()
export class SupplierInventorySessionActorResolver implements SupplierInventoryActorResolver {
  constructor(@Inject(SupplierAuthService) private readonly authService: SupplierAuthService) {}

  async resolve(request: Request): Promise<SupplierInventoryActor> {
    const session = await this.authService.resolveActiveSession(request.headers.cookie);
    if (
      session.accountTypeCode !== 'SUPPLIER_INVENTORY' ||
      session.workspaceRoute !== '/supplier/workspaces/inventory'
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '供应商库存职能页面会话无效');
    }
    return {
      role: 'SUPPLIER_INVENTORY',
      supplierId: session.supplierId,
      identityId: session.userId,
      functionalAccountId: session.functionalAccountId,
    };
  }
}
