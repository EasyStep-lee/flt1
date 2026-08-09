import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';

export const SUPPLIER_PRICING_ACTOR_RESOLVER = Symbol(
  'SUPPLIER_PRICING_ACTOR_RESOLVER',
);

export interface SupplierPricingActor {
  readonly role: 'SUPPLIER_PRICING';
  readonly supplierId: string;
  readonly identityId: string;
  readonly functionalAccountId: string;
}

export interface SupplierPricingActorResolver {
  resolve(request: Request): Promise<SupplierPricingActor>;
}

@Injectable()
export class DenySupplierPricingActorResolver implements SupplierPricingActorResolver {
  resolve(): Promise<SupplierPricingActor> {
    return Promise.reject(
      new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'A fixed supplier pricing session is required',
      ),
    );
  }
}
