import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';

export const SUPPLIER_INVENTORY_ACTOR_RESOLVER = Symbol('SUPPLIER_INVENTORY_ACTOR_RESOLVER');

export interface SupplierInventoryActor {
  readonly role: 'SUPPLIER_INVENTORY';
  readonly supplierId: string;
  readonly identityId: string;
  readonly functionalAccountId: string;
}

export interface SupplierInventoryActorResolver {
  resolve(request: Request): Promise<SupplierInventoryActor>;
}

@Injectable()
export class DenySupplierInventoryActorResolver implements SupplierInventoryActorResolver {
  resolve(): Promise<SupplierInventoryActor> {
    return Promise.reject(
      new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'A fixed supplier inventory session is required'),
    );
  }
}
