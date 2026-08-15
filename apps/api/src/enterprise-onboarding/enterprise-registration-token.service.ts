import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { SafeApiError } from '../http/api-error.js';

export const ENTERPRISE_REGISTRATION_HMAC_PROVIDER = Symbol(
  'ENTERPRISE_REGISTRATION_HMAC_PROVIDER',
);

interface RegistrationTokenPayload {
  readonly enterpriseId: string;
  readonly identityId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

const encode = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

@Injectable()
export class EnterpriseRegistrationTokenService {
  constructor(
    @Inject(ENTERPRISE_REGISTRATION_HMAC_PROVIDER)
    private readonly signingKey: string,
  ) {}

  issue(input: {
    readonly enterpriseId: string;
    readonly identityId: string;
    readonly createdAt: string;
  }): { readonly token: string; readonly expiresAt: string } {
    const issuedAt = new Date(input.createdAt);
    const expiresAt = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const payload: RegistrationTokenPayload = {
      enterpriseId: input.enterpriseId,
      identityId: input.identityId,
      issuedAt: issuedAt.toISOString(),
      expiresAt,
    };
    const encoded = encode(JSON.stringify(payload));
    const signature = createHmac('sha256', this.signingKey)
      .update('enterprise-registration-v1.1:')
      .update(encoded)
      .digest('base64url');
    return { token: `${encoded}.${signature}`, expiresAt };
  }

  verify(authorization: string | undefined): RegistrationTokenPayload {
    if (!authorization?.startsWith('Registration ')) {
      throw new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Enterprise registration credential is required',
      );
    }
    const token = authorization.slice('Registration '.length).trim();
    const [encoded, suppliedSignature, extra] = token.split('.');
    if (!encoded || !suppliedSignature || extra) {
      throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Registration credential is invalid');
    }
    const expectedSignature = createHmac('sha256', this.signingKey)
      .update('enterprise-registration-v1.1:')
      .update(encoded)
      .digest('base64url');
    const supplied = Buffer.from(suppliedSignature, 'utf8');
    const expected = Buffer.from(expectedSignature, 'utf8');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Registration credential is invalid');
    }
    let payload: RegistrationTokenPayload;
    try {
      payload = JSON.parse(decode(encoded)) as RegistrationTokenPayload;
    } catch {
      throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Registration credential is invalid');
    }
    if (
      !payload.enterpriseId ||
      !payload.identityId ||
      !payload.expiresAt ||
      Date.parse(payload.expiresAt) <= Date.now()
    ) {
      throw new SafeApiError(401, 'AUTHENTICATION_REQUIRED', 'Registration credential expired');
    }
    return payload;
  }
}
