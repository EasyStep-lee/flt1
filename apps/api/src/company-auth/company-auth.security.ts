import { Injectable } from '@nestjs/common';

export interface CompanyCredentialVerificationInput {
  readonly loginAccount: string;
  readonly password: string;
  readonly userId: string | null;
  readonly verificationCode?: string;
}

export interface CompanyCredentialVerificationResult {
  readonly secondVerificationRequired: boolean;
  readonly valid: boolean;
}

export interface CompanyCredentialVerifier {
  verify(
    input: CompanyCredentialVerificationInput,
  ): Promise<CompanyCredentialVerificationResult>;
}

export interface CompanySecondVerificationInput {
  readonly code?: string;
  readonly userId: string;
}

export interface CompanySecondVerifier {
  verify(input: CompanySecondVerificationInput): Promise<boolean>;
}

@Injectable()
export class UnavailableCompanyCredentialVerifier implements CompanyCredentialVerifier {
  verify(): Promise<CompanyCredentialVerificationResult> {
    return Promise.resolve({ secondVerificationRequired: false, valid: false });
  }
}

@Injectable()
export class UnavailableCompanySecondVerifier implements CompanySecondVerifier {
  verify(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

export const COMPANY_CREDENTIAL_VERIFIER = Symbol('COMPANY_CREDENTIAL_VERIFIER');
export const COMPANY_SECOND_VERIFIER = Symbol('COMPANY_SECOND_VERIFIER');
