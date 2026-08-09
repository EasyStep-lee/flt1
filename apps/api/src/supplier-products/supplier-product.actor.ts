import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';

export const SUPPLIER_PRODUCT_ACTOR_RESOLVER = Symbol(
  'SUPPLIER_PRODUCT_ACTOR_RESOLVER',
);

export interface SupplierProductActor {
  readonly role: 'SUPPLIER_PRODUCT';
  readonly supplierId: string;
  readonly identityId: string;
  readonly functionalAccountId: string;
}

export interface SupplierProductActorResolver {
  resolve(request: Request): Promise<SupplierProductActor>;
}

@Injectable()
export class DenySupplierProductActorResolver
  implements SupplierProductActorResolver
{
  resolve(): Promise<SupplierProductActor> {
    return Promise.reject(
      new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'A fixed supplier product session is required',
      ),
    );
  }
}
