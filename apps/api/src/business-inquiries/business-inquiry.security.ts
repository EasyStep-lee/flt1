import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import type { RuntimeConfig } from '../config/runtime-config.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.js';
import { SafeApiError } from '../http/api-error.js';

export interface BusinessInquiryCaptchaVerifier {
  verify(input: {
    readonly token: string;
    readonly sourceFingerprint: string;
  }): Promise<boolean>;
}

export const BUSINESS_INQUIRY_CAPTCHA_VERIFIER = Symbol(
  'BUSINESS_INQUIRY_CAPTCHA_VERIFIER',
);

export interface BusinessInquiryDataProtector {
  protectMobile(mobile: string): Promise<string>;
}

export const BUSINESS_INQUIRY_DATA_PROTECTOR = Symbol(
  'BUSINESS_INQUIRY_DATA_PROTECTOR',
);

@Injectable()
export class UnavailableBusinessInquiryDataProtector
  implements BusinessInquiryDataProtector
{
  async protectMobile(): Promise<string> {
    throw new SafeApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Business inquiry data protector is unavailable',
    );
  }
}

@Injectable()
export class UnavailableBusinessInquiryCaptchaVerifier
  implements BusinessInquiryCaptchaVerifier
{
  async verify(): Promise<boolean> {
    throw new SafeApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Business inquiry captcha verifier is unavailable',
    );
  }
}

interface SecurityContext {
  readonly captchaToken: string | undefined;
  readonly origin: string | undefined;
  readonly rateSubject: string;
  readonly secFetchSite: string | undefined;
  readonly sourceIp: string;
}

interface RateWindow {
  count: number;
  openedAt: number;
}

const WINDOW_MS = 10 * 60 * 1_000;
const MAX_REQUESTS_PER_WINDOW = 6;

@Injectable()
export class BusinessInquirySecurityService {
  private readonly windows = new Map<string, RateWindow>();

  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(BUSINESS_INQUIRY_CAPTCHA_VERIFIER)
    private readonly captchaVerifier: BusinessInquiryCaptchaVerifier,
  ) {}

  async verify(context: SecurityContext): Promise<string> {
    if (context.origin !== this.config.portalPublicOrigin) {
      throw new SafeApiError(403, 'ACCESS_DENIED', 'Portal origin is not allowed');
    }
    if (!context.secFetchSite || !['same-origin', 'same-site'].includes(context.secFetchSite)) {
      throw new SafeApiError(403, 'ACCESS_DENIED', 'Cross-site submission is not allowed');
    }
    const token = context.captchaToken?.trim();
    if (!token || token.length > 4096) {
      throw new SafeApiError(403, 'ACCESS_DENIED', 'Captcha proof is invalid');
    }
    const sourceFingerprint = createHash('sha256')
      .update(`${context.sourceIp || 'source-unavailable'}:${context.rateSubject}`)
      .digest('hex');
    if (!(await this.captchaVerifier.verify({ token, sourceFingerprint }))) {
      throw new SafeApiError(403, 'ACCESS_DENIED', 'Captcha proof is invalid');
    }
    this.consumeRateLimit(sourceFingerprint);
    return sourceFingerprint;
  }

  private consumeRateLimit(sourceFingerprint: string): void {
    const now = Date.now();
    const current = this.windows.get(sourceFingerprint);
    if (!current || now - current.openedAt >= WINDOW_MS) {
      this.windows.set(sourceFingerprint, { count: 1, openedAt: now });
      return;
    }
    if (current.count >= MAX_REQUESTS_PER_WINDOW) {
      throw new SafeApiError(429, 'RATE_LIMITED', 'Business inquiry rate limit exceeded');
    }
    current.count += 1;
  }
}
