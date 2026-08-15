import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  ENTERPRISE_CORRECTION_FIELDS,
  ENTERPRISE_CUSTOMER_STATUSES,
  ENTERPRISE_REVIEW_DECISIONS,
  type EnterpriseCorrectionField,
  type EnterpriseCustomerStatus,
  type EnterpriseReviewDecision,
} from './enterprise-onboarding.policy.js';

export class EnterpriseAddressInputDto {
  @ApiProperty({ maxLength: 128, type: String })
  readonly consignee!: string;

  @ApiProperty({ maxLength: 16, type: String })
  readonly mobile!: string;

  @ApiProperty({ maxLength: 64, type: String })
  readonly region!: string;

  @ApiProperty({ maxLength: 500, type: String })
  readonly fullAddress!: string;

  @ApiPropertyOptional({ maxLength: 500, type: String })
  readonly deliveryNote?: string;

  @ApiProperty({ type: Boolean })
  readonly isDefault!: boolean;
}

export class EnterpriseInvoiceProfileInputDto {
  @ApiProperty({ maxLength: 191, type: String })
  readonly title!: string;

  @ApiProperty({ maxLength: 32, type: String })
  readonly taxNumber!: string;

  @ApiPropertyOptional({ maxLength: 500, type: String })
  readonly registeredAddress?: string;

  @ApiPropertyOptional({ maxLength: 32, type: String })
  readonly registeredPhone?: string;

  @ApiPropertyOptional({ maxLength: 191, type: String })
  readonly bankName?: string;

  @ApiPropertyOptional({ maxLength: 64, type: String, writeOnly: true })
  readonly bankAccount?: string;
}

export class EnterpriseRegistrationRequestDto {
  @ApiProperty({ maxLength: 191, type: String })
  readonly legalName!: string;

  @ApiProperty({ maxLength: 18, minLength: 18, type: String })
  readonly creditCode!: string;

  @ApiProperty({ maxLength: 128, type: String })
  readonly administratorName!: string;

  @ApiProperty({ maxLength: 16, type: String })
  readonly administratorMobile!: string;

  @ApiPropertyOptional({ maxLength: 254, type: String })
  readonly administratorEmail?: string;

  @ApiPropertyOptional({ maxLength: 128, type: String })
  readonly administratorTitle?: string;

  @ApiProperty({ maxLength: 8, minLength: 4, type: String, writeOnly: true })
  readonly verificationCode!: string;

  @ApiProperty({ maxLength: 64, type: String })
  readonly agreementVersion!: string;

  @ApiPropertyOptional({ maxLength: 500, type: String })
  readonly registeredAddress?: string;

  @ApiPropertyOptional({ maxLength: 64, type: String })
  readonly enterpriseType?: string;

  @ApiPropertyOptional({ maxLength: 255, type: String, writeOnly: true })
  readonly licenseObjectKey?: string;

  @ApiPropertyOptional({ format: 'date', nullable: true, type: String })
  readonly licenseValidUntil?: string | null;

  @ApiPropertyOptional({ isArray: true, type: () => EnterpriseAddressInputDto })
  readonly addresses?: readonly EnterpriseAddressInputDto[];

  @ApiPropertyOptional({ type: () => EnterpriseInvoiceProfileInputDto })
  readonly invoiceProfile?: EnterpriseInvoiceProfileInputDto;
}

export class EnterpriseRegistrationPatchRequestDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiPropertyOptional({ maxLength: 191, type: String })
  readonly legalName?: string;

  @ApiPropertyOptional({ maxLength: 18, minLength: 18, type: String })
  readonly creditCode?: string;

  @ApiPropertyOptional({ maxLength: 500, type: String })
  readonly registeredAddress?: string;

  @ApiPropertyOptional({ maxLength: 64, type: String })
  readonly enterpriseType?: string;

  @ApiPropertyOptional({ maxLength: 255, type: String, writeOnly: true })
  readonly licenseObjectKey?: string;

  @ApiPropertyOptional({ format: 'date', nullable: true, type: String })
  readonly licenseValidUntil?: string | null;

  @ApiPropertyOptional({ maxLength: 128, type: String })
  readonly administratorName?: string;

  @ApiPropertyOptional({ maxLength: 254, type: String })
  readonly administratorEmail?: string;

  @ApiPropertyOptional({ maxLength: 128, type: String })
  readonly administratorTitle?: string;

  @ApiPropertyOptional({ isArray: true, type: () => EnterpriseAddressInputDto })
  readonly addresses?: readonly EnterpriseAddressInputDto[];

  @ApiPropertyOptional({ type: () => EnterpriseInvoiceProfileInputDto })
  readonly invoiceProfile?: EnterpriseInvoiceProfileInputDto;
}

export class EnterpriseSubmitReviewRequestDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;
}

export class EnterpriseReviewRequestDto {
  @ApiProperty({ enum: ENTERPRISE_REVIEW_DECISIONS, type: String })
  readonly decision!: EnterpriseReviewDecision;

  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiProperty({ maxLength: 1000, minLength: 1, type: String })
  readonly opinion!: string;

  @ApiPropertyOptional({ enum: ENTERPRISE_CORRECTION_FIELDS, isArray: true, type: String })
  readonly correctionFields?: readonly EnterpriseCorrectionField[];
}

export class EnterpriseSuspendRequestDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiProperty({ maxLength: 1000, minLength: 1, type: String })
  readonly reason!: string;
}

export class EnterpriseRegistrationCreatedResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly registrationId!: string;

  @ApiProperty({ enum: ENTERPRISE_CUSTOMER_STATUSES, type: String })
  readonly status!: EnterpriseCustomerStatus;

  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiProperty({
    description: 'Short-lived registration credential returned only to the creating client',
    type: String,
  })
  readonly registrationAccessToken!: string;

  @ApiProperty({ format: 'date-time', type: String })
  readonly registrationAccessExpiresAt!: string;

  @ApiProperty({ enum: ['COMPLETE_PROFILE'], type: String })
  readonly nextAction!: 'COMPLETE_PROFILE';
}

export class EnterpriseAddressResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly id!: string;
  @ApiProperty({ maxLength: 128, type: String })
  readonly consignee!: string;
  @ApiProperty({ type: String })
  readonly mobileMasked!: string;
  @ApiProperty({ maxLength: 64, type: String })
  readonly region!: string;
  @ApiProperty({ maxLength: 500, type: String })
  readonly fullAddress!: string;
  @ApiPropertyOptional({ maxLength: 500, type: String })
  readonly deliveryNote?: string;
  @ApiProperty({ type: Boolean })
  readonly isDefault!: boolean;
}

export class EnterpriseInvoiceProfileResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly id!: string;
  @ApiProperty({ maxLength: 191, type: String })
  readonly title!: string;
  @ApiProperty({ type: String })
  readonly taxNumberMasked!: string;
  @ApiPropertyOptional({ maxLength: 500, type: String })
  readonly registeredAddress?: string;
  @ApiPropertyOptional({ type: String })
  readonly registeredPhoneMasked?: string;
  @ApiPropertyOptional({ maxLength: 191, type: String })
  readonly bankName?: string;
  @ApiPropertyOptional({ type: String })
  readonly bankAccountMasked?: string;
}

export class EnterpriseRegistrationResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly id!: string;
  @ApiProperty({ maxLength: 191, type: String })
  readonly legalName!: string;
  @ApiProperty({ type: String })
  readonly creditCodeMasked!: string;
  @ApiProperty({ enum: ENTERPRISE_CUSTOMER_STATUSES, type: String })
  readonly status!: EnterpriseCustomerStatus;
  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;
  @ApiProperty({ type: String })
  readonly administratorName!: string;
  @ApiProperty({ type: String })
  readonly administratorMobileMasked!: string;
  @ApiPropertyOptional({ type: String })
  readonly administratorEmailMasked?: string;
  @ApiPropertyOptional({ type: String })
  readonly registeredAddress?: string;
  @ApiPropertyOptional({ type: String })
  readonly enterpriseType?: string;
  @ApiProperty({ type: Boolean })
  readonly businessLicenseProvided!: boolean;
  @ApiPropertyOptional({ maxLength: 255, type: String })
  readonly businessLicenseReference?: string;
  @ApiPropertyOptional({ format: 'date', type: String })
  readonly licenseValidUntil?: string;
  @ApiProperty({ isArray: true, type: () => EnterpriseAddressResponseDto })
  readonly addresses!: readonly EnterpriseAddressResponseDto[];
  @ApiPropertyOptional({ type: () => EnterpriseInvoiceProfileResponseDto })
  readonly invoiceProfile?: EnterpriseInvoiceProfileResponseDto;
  @ApiProperty({ enum: ENTERPRISE_CORRECTION_FIELDS, isArray: true, type: String })
  readonly correctionFields!: readonly EnterpriseCorrectionField[];
  @ApiPropertyOptional({ maxLength: 1000, type: String })
  readonly reviewOpinion?: string;
  @ApiProperty({ type: String })
  readonly nextAction!:
    | 'COMPLETE_PROFILE'
    | 'CORRECT_AND_RESUBMIT'
    | 'REVIEW_IN_PROGRESS'
    | 'ENTER_WORKSPACE'
    | 'CONTACT_SUPPORT';
}

export class EnterpriseRegistrationPageResponseDto {
  @ApiProperty({ isArray: true, type: () => EnterpriseRegistrationResponseDto })
  readonly items!: readonly EnterpriseRegistrationResponseDto[];
  @ApiProperty({ minimum: 1, type: Number })
  readonly page!: number;
  @ApiProperty({ minimum: 1, type: Number })
  readonly pageSize!: number;
  @ApiProperty({ minimum: 0, type: Number })
  readonly total!: number;
}
