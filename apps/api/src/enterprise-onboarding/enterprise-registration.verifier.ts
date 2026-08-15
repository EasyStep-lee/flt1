import { Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';

export const ENTERPRISE_REGISTRATION_VERIFIER = Symbol(
  'ENTERPRISE_REGISTRATION_VERIFIER',
);

export interface EnterpriseRegistrationVerificationInput {
  readonly idempotencyKey: string;
  readonly mobile: string;
  readonly verificationCode: string;
}

export interface EnterpriseRegistrationVerificationResult {
  readonly identityId: string;
}

export interface EnterpriseRegistrationVerifier {
  verify(
    input: EnterpriseRegistrationVerificationInput,
  ): Promise<EnterpriseRegistrationVerificationResult>;
}

@Injectable()
export class UnavailableEnterpriseRegistrationVerifier
  implements EnterpriseRegistrationVerifier
{
  verify(): Promise<EnterpriseRegistrationVerificationResult> {
    return Promise.reject(
      new SafeApiError(
        503,
        'SERVICE_UNAVAILABLE',
        'Enterprise registration verification is unavailable',
      ),
    );
  }
}
