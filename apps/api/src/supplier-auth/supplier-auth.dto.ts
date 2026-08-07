import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierLoginRequestDto {
  @ApiProperty({ example: '13800138000', maxLength: 254, type: String })
  readonly loginAccount!: string;

  @ApiProperty({ maxLength: 256, minLength: 1, type: String, writeOnly: true })
  readonly password!: string;

  @ApiPropertyOptional({ maxLength: 16, type: String, writeOnly: true })
  readonly verificationCode?: string;

  @ApiProperty({ format: 'uuid', type: String })
  readonly requestId!: string;
}

export class SupplierWorkspaceChoiceDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly accountId!: string;

  @ApiProperty({ enum: ['SUPPLIER'], type: String })
  readonly ownerType!: 'SUPPLIER';

  @ApiProperty({ type: String })
  readonly ownerDisplayName!: string;

  @ApiProperty({ type: String })
  readonly accountTypeCode!: string;

  @ApiProperty({ type: String })
  readonly accountTypeName!: string;

  @ApiProperty({ type: String })
  readonly workspaceRoute!: string;

  @ApiProperty({
    enum: ['ACTIVE', 'PENDING_ACTIVATION', 'REVOKED', 'SUSPENDED'],
    type: String,
  })
  readonly status!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  readonly lastUsedAt?: string | null;
}

export class SupplierWorkspaceChoiceResponseDto {
  @ApiProperty({ type: Boolean })
  readonly selectionRequired!: boolean;

  @ApiProperty({ type: String })
  readonly selectionNonce!: string;

  @ApiProperty({ isArray: true, type: () => SupplierWorkspaceChoiceDto })
  readonly accounts!: readonly SupplierWorkspaceChoiceDto[];

  @ApiProperty({ example: '/supplier/account-select', type: String })
  readonly accountSelectRoute!: '/supplier/account-select';
}

export class SupplierSelectWorkspaceRequestDto {
  @ApiProperty({ minLength: 32, type: String, writeOnly: true })
  readonly selectionNonce!: string;

  @ApiPropertyOptional({ maxLength: 16, type: String, writeOnly: true })
  readonly secondVerificationCode?: string;
}

export class SupplierSessionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly functionalAccountId!: string;

  @ApiProperty({ enum: ['SUPPLIER'], type: String })
  readonly ownerType!: 'SUPPLIER';

  @ApiProperty({ type: String })
  readonly accountTypeCode!: string;

  @ApiProperty({ type: String })
  readonly workspaceRoute!: string;

  @ApiProperty({ format: 'date-time', type: String })
  readonly expiresAt!: string;
}
