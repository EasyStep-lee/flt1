import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';

export const SUPPLIER_FULFILLMENT_ACTOR_RESOLVER = Symbol('SUPPLIER_FULFILLMENT_ACTOR_RESOLVER');

export interface SupplierFulfillmentActor {
  readonly role: 'SUPPLIER_FULFILLMENT';
  readonly supplierId: string;
  readonly identityId: string;
  readonly functionalAccountId: string;
}
export interface SupplierFulfillmentActorResolver {
  resolve(request: Request): Promise<SupplierFulfillmentActor>;
}

@Injectable()
export class DenySupplierFulfillmentActorResolver implements SupplierFulfillmentActorResolver {
  resolve(): Promise<SupplierFulfillmentActor> {
    return Promise.reject(new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'A fixed supplier fulfillment session is required'));
  }
}
