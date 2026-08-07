import { Injectable } from '@nestjs/common';

export interface SupplierCredentialVerificationInput {
  readonly loginAccount: string;
  readonly password: string;
  readonly userId: string | null;
  readonly verificationCode?: string;
}

export interface SupplierCredentialVerificationResult {
  readonly secondVerificationRequired: boolean;
  readonly valid: boolean;
}

export interface SupplierCredentialVerifier {
  verify(
    input: SupplierCredentialVerificationInput,
  ): Promise<SupplierCredentialVerificationResult>;
}

export interface SupplierSecondVerificationInput {
  readonly code?: string;
  readonly userId: string;
}

export interface SupplierSecondVerifier {
  verify(input: SupplierSecondVerificationInput): Promise<boolean>;
}

@Injectable()
export class UnavailableSupplierCredentialVerifier implements SupplierCredentialVerifier {
  verify(): Promise<SupplierCredentialVerificationResult> {
    return Promise.resolve({ secondVerificationRequired: false, valid: false });
  }
}

@Injectable()
export class UnavailableSupplierSecondVerifier implements SupplierSecondVerifier {
  verify(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

export const SUPPLIER_CREDENTIAL_VERIFIER = Symbol('SUPPLIER_CREDENTIAL_VERIFIER');
export const SUPPLIER_SECOND_VERIFIER = Symbol('SUPPLIER_SECOND_VERIFIER');
