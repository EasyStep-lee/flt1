import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES,
  type FunctionalAccountStatus,
  type SupplierFunctionalAccountTypeCode,
} from './supplier-functional-account.policy.js';

const accountTypeCodes = SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.map(({ code }) => code);
const accountStatuses = [
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
] as const;

export class FunctionalAccountQueryDto {
  @ApiPropertyOptional({ enum: accountTypeCodes, type: String })
  readonly accountTypeCode?: SupplierFunctionalAccountTypeCode;

  @ApiPropertyOptional({ enum: accountStatuses, type: String })
  readonly status?: FunctionalAccountStatus;

  @ApiPropertyOptional({ maxLength: 128, type: String })
  readonly keyword?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, type: Number })
  readonly page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1, type: Number })
  readonly pageSize?: number;
}

export class CreateFunctionalAccountRequestDto {
  @ApiProperty({ enum: accountTypeCodes, type: String })
  readonly accountTypeCode!: SupplierFunctionalAccountTypeCode;

  @ApiProperty({ maxLength: 128, minLength: 1, type: String })
  readonly inviteeName!: string;

  @ApiProperty({ example: '13900139000', maxLength: 16, type: String })
  readonly inviteeMobile!: string;

  @ApiPropertyOptional({ maxLength: 254, type: String })
  readonly inviteeEmail?: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  readonly expiresAt?: string;

  @ApiPropertyOptional({ maxLength: 8, minLength: 4, type: String, writeOnly: true })
  readonly secondVerificationCode?: string;
}

export class FunctionalAccountResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly id!: string;

  @ApiProperty({ maxLength: 128, type: String })
  readonly displayName!: string;

  @ApiProperty({ enum: accountTypeCodes, type: String })
  readonly accountTypeCode!: SupplierFunctionalAccountTypeCode;

  @ApiProperty({ maxLength: 128, type: String })
  readonly accountTypeName!: string;

  @ApiProperty({ type: String })
  readonly workspaceRoute!: string;

  @ApiProperty({ enum: accountStatuses, type: String })
  readonly status!: FunctionalAccountStatus;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  readonly expiresAt?: string;

  @ApiPropertyOptional({ format: 'date-time', type: String })
  readonly lastLoginAt?: string;
}

export class FunctionalAccountPageResponseDto {
  @ApiProperty({ isArray: true, type: () => FunctionalAccountResponseDto })
  readonly items!: readonly FunctionalAccountResponseDto[];

  @ApiProperty({ minimum: 1, type: Number })
  readonly page!: number;

  @ApiProperty({ maximum: 100, minimum: 1, type: Number })
  readonly pageSize!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly total!: number;
}

