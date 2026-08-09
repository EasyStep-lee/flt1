import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';
import { SupplierAuthService } from '../supplier-auth/supplier-auth.service.js';
import type {
  SupplierProductActor,
  SupplierProductActorResolver,
} from './supplier-product.actor.js';

@Injectable()
export class SupplierProductSessionActorResolver implements SupplierProductActorResolver {
  constructor(
    @Inject(SupplierAuthService) private readonly authService: SupplierAuthService,
  ) {}

  async resolve(request: Request): Promise<SupplierProductActor> {
    const session = await this.authService.resolveActiveSession(request.headers.cookie);
    if (
      session.accountTypeCode !== 'SUPPLIER_PRODUCT' ||
      session.workspaceRoute !== '/supplier/workspaces/products'
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '供应商商品职能页面会话无效');
    }
    return {
      role: 'SUPPLIER_PRODUCT',
      supplierId: session.supplierId,
      identityId: session.userId,
      functionalAccountId: session.functionalAccountId,
    };
  }
}
