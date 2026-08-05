import { Injectable, Logger } from '@nestjs/common';

export const FUNCTIONAL_ACCOUNT_SECOND_VERIFIER = Symbol(
  'FUNCTIONAL_ACCOUNT_SECOND_VERIFIER',
);
export const FUNCTIONAL_ACCOUNT_AUDIT_SINK = Symbol('FUNCTIONAL_ACCOUNT_AUDIT_SINK');

export interface FunctionalAccountSecondVerificationInput {
  readonly code: string;
  readonly identityId: string;
  readonly purpose: 'CREATE_FUNCTIONAL_ACCOUNT';
  readonly supplierId: string;
}

export interface FunctionalAccountSecondVerifier {
  verify(input: FunctionalAccountSecondVerificationInput): Promise<boolean>;
}

export interface FunctionalAccountSecurityEvent {
  readonly actorIdentityId: string;
  readonly event:
    | 'FUNCTIONAL_ACCOUNT_INVITED'
    | 'SELF_PRIVILEGE_ESCALATION_REJECTED';
  readonly supplierId: string;
  readonly targetAccountTypeCode: string;
}

export interface FunctionalAccountAuditSink {
  record(event: FunctionalAccountSecurityEvent): Promise<void>;
}

@Injectable()
export class UnavailableFunctionalAccountSecondVerifier
  implements FunctionalAccountSecondVerifier
{
  verify(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

@Injectable()
export class LoggingFunctionalAccountAuditSink
  implements FunctionalAccountAuditSink
{
  private readonly logger = new Logger('FunctionalAccountSecurity');

  record(event: FunctionalAccountSecurityEvent): Promise<void> {
    this.logger.warn(JSON.stringify(event));
    return Promise.resolve();
  }
}

