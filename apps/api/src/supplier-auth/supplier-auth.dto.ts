import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES } from '../supplier-functional-accounts/supplier-functional-account.policy.js';

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

export class SupplierWorkspaceMenuItemDto {
  @ApiProperty({ enum: ['workspace'], type: String })
  readonly key!: 'workspace';

  @ApiProperty({ type: String })
  readonly label!: string;

  @ApiProperty({ type: String })
  readonly route!: string;
}

export class SupplierWorkspaceResponseDto {
  @ApiProperty({
    enum: SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.map(({ code }) => code),
    type: String,
  })
  readonly accountTypeCode!: string;

  @ApiProperty({ type: String })
  readonly accountTypeName!: string;

  @ApiProperty({
    enum: SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.map(({ pageId }) => pageId),
    type: String,
  })
  readonly pageId!: string;

  @ApiProperty({ type: String })
  readonly workspaceRoute!: string;

  @ApiProperty({ isArray: true, type: () => SupplierWorkspaceMenuItemDto })
  readonly menuItems!: readonly SupplierWorkspaceMenuItemDto[];
}

export class SupplierWorkspacePageQueryDto {
  @ApiProperty({ maxLength: 255, type: String })
  readonly route!: string;

  @ApiPropertyOptional({ maxLength: 64, type: String })
  readonly keyword?: string;

  @ApiPropertyOptional({
    enum: ['ALL', 'AVAILABLE', 'DEFERRED'],
    type: String,
  })
  readonly availability?: 'ALL' | 'AVAILABLE' | 'DEFERRED';

  @ApiPropertyOptional({
    maxLength: 64,
    pattern: '^[a-z][a-z0-9-]{1,63}$',
    type: String,
  })
  readonly moduleKey?: string;
}

export class SupplierWorkspacePageSummaryDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly catalogTotal!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly availableTotal!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly deferredTotal!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly filteredTotal!: number;
}

export class SupplierWorkspacePageFiltersDto {
  @ApiProperty({ maxLength: 64, type: String })
  readonly keyword!: string;

  @ApiProperty({ enum: ['ALL', 'AVAILABLE', 'DEFERRED'], type: String })
  readonly availability!: 'ALL' | 'AVAILABLE' | 'DEFERRED';
}

export class SupplierWorkspaceModuleItemDto {
  @ApiProperty({ maxLength: 64, type: String })
  readonly moduleKey!: string;

  @ApiProperty({ maxLength: 128, type: String })
  readonly label!: string;

  @ApiProperty({ maxLength: 512, type: String })
  readonly description!: string;

  @ApiProperty({ enum: ['M1', 'M2', 'M3', 'M5'], type: String })
  readonly deliveryStage!: 'M1' | 'M2' | 'M3' | 'M5';

  @ApiProperty({ enum: ['AVAILABLE', 'DEFERRED'], type: String })
  readonly availability!: 'AVAILABLE' | 'DEFERRED';

  @ApiProperty({ maxLength: 512, type: String })
  readonly dataBoundary!: string;
}

export class SupplierWorkspaceModuleTimelineEventDto {
  @ApiProperty({ maxLength: 64, type: String })
  readonly code!: string;

  @ApiProperty({ maxLength: 128, type: String })
  readonly label!: string;

  @ApiProperty({ enum: ['M1', 'M2', 'M3', 'M5'], type: String })
  readonly stage!: 'M1' | 'M2' | 'M3' | 'M5';

  @ApiProperty({ enum: ['DONE', 'DEFERRED'], type: String })
  readonly status!: 'DONE' | 'DEFERRED';
}

export class SupplierWorkspaceModuleDetailDto extends SupplierWorkspaceModuleItemDto {
  @ApiProperty({ isArray: true, maxItems: 8, type: String })
  readonly sections!: readonly string[];

  @ApiProperty({
    isArray: true,
    type: () => SupplierWorkspaceModuleTimelineEventDto,
  })
  readonly timeline!: readonly SupplierWorkspaceModuleTimelineEventDto[];
}

export class SupplierWorkspacePageResponseDto {
  @ApiProperty({
    enum: SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.map(({ code }) => code),
    type: String,
  })
  readonly accountTypeCode!: string;

  @ApiProperty({ type: String })
  readonly accountTypeName!: string;

  @ApiProperty({
    enum: SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.map(({ pageId }) => pageId),
    type: String,
  })
  readonly pageId!: string;

  @ApiProperty({ type: String })
  readonly workspaceRoute!: string;

  @ApiProperty({ type: () => SupplierWorkspacePageSummaryDto })
  readonly summary!: SupplierWorkspacePageSummaryDto;

  @ApiProperty({ type: () => SupplierWorkspacePageFiltersDto })
  readonly filters!: SupplierWorkspacePageFiltersDto;

  @ApiProperty({ isArray: true, type: () => SupplierWorkspaceModuleItemDto })
  readonly items!: readonly SupplierWorkspaceModuleItemDto[];

  @ApiProperty({
    nullable: true,
    type: () => SupplierWorkspaceModuleDetailDto,
  })
  readonly selectedModule!: SupplierWorkspaceModuleDetailDto | null;
}
