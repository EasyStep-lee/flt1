import { Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';

export const SUPPLIER_REGISTRATION_VERIFIER = Symbol(
  'SUPPLIER_REGISTRATION_VERIFIER',
);

export interface SupplierRegistrationVerificationInput {
  readonly idempotencyKey: string;
  readonly mobile: string;
  readonly verificationCode: string;
}

export interface SupplierRegistrationVerifier {
  verify(input: SupplierRegistrationVerificationInput): Promise<void>;
}

@Injectable()
export class UnavailableSupplierRegistrationVerifier
  implements SupplierRegistrationVerifier
{
  verify(): Promise<void> {
    return Promise.reject(
      new SafeApiError(
        503,
        'SERVICE_UNAVAILABLE',
        'Supplier registration verification is unavailable',
      ),
    );
  }
}
