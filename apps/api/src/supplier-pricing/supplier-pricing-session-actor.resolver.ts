import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';
import { SupplierAuthService } from '../supplier-auth/supplier-auth.service.js';
import type {
  SupplierPricingActor,
  SupplierPricingActorResolver,
} from './supplier-pricing.actor.js';

@Injectable()
export class SupplierPricingSessionActorResolver implements SupplierPricingActorResolver {
  constructor(
    @Inject(SupplierAuthService) private readonly authService: SupplierAuthService,
  ) {}

  async resolve(request: Request): Promise<SupplierPricingActor> {
    const session = await this.authService.resolveActiveSession(request.headers.cookie);
    if (
      session.accountTypeCode !== 'SUPPLIER_PRICING' ||
      session.workspaceRoute !== '/supplier/workspaces/pricing'
    ) {
      throw new SafeApiError(403, 'WORKSPACE_FORBIDDEN', '供应商价格职能页面会话无效');
    }
    return {
      role: 'SUPPLIER_PRICING',
      supplierId: session.supplierId,
      identityId: session.userId,
      functionalAccountId: session.functionalAccountId,
    };
  }
}
