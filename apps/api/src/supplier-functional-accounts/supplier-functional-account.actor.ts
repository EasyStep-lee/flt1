import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SafeApiError } from '../http/api-error.js';
import type { SupplierFunctionalAccountTypeCode } from './supplier-functional-account.policy.js';

export const FUNCTIONAL_ACCOUNT_ACTOR_RESOLVER = Symbol(
  'FUNCTIONAL_ACCOUNT_ACTOR_RESOLVER',
);

export interface SupplierFunctionalAccountActor {
  readonly accountTypeCode: SupplierFunctionalAccountTypeCode;
  readonly functionalAccountId: string;
  readonly identityId: string;
  readonly supplierId: string;
  readonly workspaceRoute: string;
}

export interface FunctionalAccountActorResolver {
  resolve(request: Request): Promise<SupplierFunctionalAccountActor>;
}

@Injectable()
export class DenyFunctionalAccountActorResolver
  implements FunctionalAccountActorResolver
{
  resolve(): Promise<SupplierFunctionalAccountActor> {
    return Promise.reject(
      new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'A fixed functional session is required',
      ),
    );
  }
}

