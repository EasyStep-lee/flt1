import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SUPPLIER_STATUSES, type SupplierStatus } from './supplier-onboarding.policy.js';

export class SupplierRegistrationRequestDto {
  @ApiProperty({ example: '南京示例供应链有限公司', maxLength: 128, type: String })
  readonly legalName!: string;

  @ApiProperty({ example: '91320100MA1ABC2D3X', maxLength: 18, minLength: 18, type: String })
  readonly creditCode!: string;

  @ApiProperty({ example: '张经理', maxLength: 128, type: String })
  readonly contactName!: string;

  @ApiProperty({ example: '13800138000', maxLength: 16, type: String })
  readonly mobile!: string;

  @ApiPropertyOptional({ example: 'supplier@example.test', maxLength: 254, type: String })
  readonly email?: string;

  @ApiProperty({ example: '123456', maxLength: 8, minLength: 4, type: String, writeOnly: true })
  readonly verificationCode!: string;

  @ApiProperty({
    example: ['object://supplier-qualification/business-license-001'],
    items: { type: 'string' },
    maxItems: 50,
    type: [String],
  })
  readonly qualificationFiles!: readonly string[];

  @ApiProperty({ example: '南京市建邺区江东中路 100 号', maxLength: 500, nullable: true, type: String })
  readonly pickupAddress!: string | null;

  @ApiProperty({ example: 32.0415447, maximum: 90, minimum: -90, nullable: true, type: Number })
  readonly pickupLat!: number | null;

  @ApiProperty({ example: 118.7699941, maximum: 180, minimum: -180, nullable: true, type: Number })
  readonly pickupLng!: number | null;

  @ApiProperty({ example: 'supplier-agreement-v1.1', maxLength: 64, type: String })
  readonly agreementVersion!: string;
}

export class SupplierRegistrationResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly registrationId!: string;

  @ApiProperty({ enum: SUPPLIER_STATUSES, type: String })
  readonly status!: SupplierStatus;

  @ApiProperty({
    enum: [
      'COMPLETE_PROFILE',
      'CORRECT_AND_RESUBMIT',
      'LOGIN_AFTER_ACTIVATION',
      'REVIEW_IN_PROGRESS',
    ],
    type: String,
  })
  readonly nextAction!:
    | 'COMPLETE_PROFILE'
    | 'CORRECT_AND_RESUBMIT'
    | 'LOGIN_AFTER_ACTIVATION'
    | 'REVIEW_IN_PROGRESS';

  @ApiPropertyOptional({ format: 'date-time', type: String })
  readonly submittedAt?: string;
}

export class SupplierQualificationSnapshotDto {
  @ApiProperty({ enum: ['1.0'], example: '1.0', type: String })
  readonly schemaVersion!: '1.0';

  @ApiProperty({ items: { type: 'string' }, maxItems: 50, type: [String] })
  readonly files!: readonly string[];
}

export class SupplierProfilePatchRequestDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiPropertyOptional({ maxLength: 500, nullable: true, type: String })
  readonly pickupAddress?: string | null;

  @ApiPropertyOptional({ maximum: 90, minimum: -90, nullable: true, type: Number })
  readonly pickupLat?: number | null;

  @ApiPropertyOptional({ maximum: 180, minimum: -180, nullable: true, type: Number })
  readonly pickupLng?: number | null;

  @ApiPropertyOptional({ type: () => SupplierQualificationSnapshotDto })
  readonly qualificationSnapshot?: SupplierQualificationSnapshotDto;

  @ApiPropertyOptional({
    description: 'Reserved for a separately verified high-risk workflow',
    writeOnly: true,
    type: Object,
  })
  readonly settlementAccountChangeRequest?: unknown;
}

export class SupplierQualificationSummaryDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly fileCount!: number;

  @ApiProperty({ type: Boolean })
  readonly complete!: boolean;
}

export class SupplierResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly id!: string;

  @ApiProperty({ maxLength: 128, type: String })
  readonly legalName!: string;

  @ApiProperty({ example: '9132**********2D3X', type: String })
  readonly creditCodeMasked!: string;

  @ApiProperty({ enum: SUPPLIER_STATUSES, type: String })
  readonly status!: SupplierStatus;

  @ApiProperty({ type: () => SupplierQualificationSummaryDto })
  readonly qualificationSummary!: SupplierQualificationSummaryDto;

  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;
}

export class SupplierProfileResponseDto extends SupplierResponseDto {
  @ApiProperty({ maxLength: 500, nullable: true, type: String })
  readonly pickupAddress!: string | null;

  @ApiProperty({ maximum: 90, minimum: -90, nullable: true, type: Number })
  readonly pickupLat!: number | null;

  @ApiProperty({ maximum: 180, minimum: -180, nullable: true, type: Number })
  readonly pickupLng!: number | null;

  @ApiProperty({ maxLength: 128, nullable: true, type: String })
  readonly settlementAccountMasked!: string | null;
}

export class SubmitReviewRequestDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiProperty({ format: 'uuid', type: String })
  readonly requestId!: string;
}

export class ApprovalTaskResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly id!: string;

  @ApiProperty({ enum: ['SUPPLIER_ONBOARDING'], type: String })
  readonly approvalType!: 'SUPPLIER_ONBOARDING';

  @ApiProperty({ enum: ['SUPPLIER'], type: String })
  readonly objectType!: 'SUPPLIER';

  @ApiProperty({ format: 'uuid', type: String })
  readonly objectId!: string;

  @ApiProperty({ enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'], type: String })
  readonly status!: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @ApiProperty({ enum: ['COMPANY_SUPPLIER_OPS'], type: String })
  readonly assignedAccountTypeCode!: 'COMPANY_SUPPLIER_OPS';

  @ApiPropertyOptional({ maxLength: 1000, type: String })
  readonly reviewOpinion?: string;

  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;
}

export class SupplierQueryDto {
  @ApiPropertyOptional({ enum: SUPPLIER_STATUSES, type: String })
  readonly status?: SupplierStatus;

  @ApiPropertyOptional({ maxLength: 128, type: String })
  readonly keyword?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, type: Number })
  readonly page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1, type: Number })
  readonly pageSize?: number;
}

export class SupplierPageResponseDto {
  @ApiProperty({ isArray: true, type: () => SupplierResponseDto })
  readonly items!: readonly SupplierResponseDto[];

  @ApiProperty({ minimum: 1, type: Number })
  readonly page!: number;

  @ApiProperty({ maximum: 100, minimum: 1, type: Number })
  readonly pageSize!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly total!: number;
}

export class SupplierReviewRequestDto {
  @ApiProperty({ enum: ['REQUEST_CORRECTION', 'APPROVE'], type: String })
  readonly decision!: 'REQUEST_CORRECTION' | 'APPROVE';

  @ApiProperty({ minimum: 0, type: Number })
  readonly version!: number;

  @ApiProperty({ maxLength: 1000, minLength: 1, type: String })
  readonly opinion!: string;

  @ApiPropertyOptional({ type: String, writeOnly: true })
  readonly secondVerificationCode?: string;
}
