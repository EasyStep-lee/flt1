import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { COMPANY_WORKSPACES } from './company-workspace.policy.js';

export class CompanyLoginRequestDto {
  @ApiProperty({ example: '13800138000', maxLength: 254, type: String })
  readonly loginAccount!: string;

  @ApiProperty({ maxLength: 256, minLength: 1, type: String, writeOnly: true })
  readonly password!: string;

  @ApiPropertyOptional({ maxLength: 16, type: String, writeOnly: true })
  readonly verificationCode?: string;

  @ApiProperty({ format: 'uuid', type: String })
  readonly requestId!: string;
}

export class WorkspaceChoiceDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly accountId!: string;

  @ApiProperty({ enum: ['COMPANY'], type: String })
  readonly ownerType!: 'COMPANY';

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

export class WorkspaceChoiceResponseDto {
  @ApiProperty({ type: Boolean })
  readonly selectionRequired!: boolean;

  @ApiProperty({ type: String })
  readonly selectionNonce!: string;

  @ApiProperty({ isArray: true, type: () => WorkspaceChoiceDto })
  readonly accounts!: readonly WorkspaceChoiceDto[];
}

export class SelectWorkspaceRequestDto {
  @ApiProperty({ minLength: 32, type: String, writeOnly: true })
  readonly selectionNonce!: string;

  @ApiPropertyOptional({ maxLength: 16, type: String, writeOnly: true })
  readonly secondVerificationCode?: string;
}

export class SessionResponseDto {
  @ApiProperty({ format: 'uuid', type: String })
  readonly functionalAccountId!: string;

  @ApiProperty({ enum: ['COMPANY'], type: String })
  readonly ownerType!: 'COMPANY';

  @ApiProperty({ format: 'uuid', type: String })
  readonly companyId!: string;

  @ApiProperty({ type: String })
  readonly accountTypeCode!: string;

  @ApiProperty({ type: String })
  readonly workspaceRoute!: string;

  @ApiProperty({ format: 'date-time', type: String })
  readonly expiresAt!: string;
}

export class CompanyWorkspaceMenuItemDto {
  @ApiProperty({ enum: ['workspace'], type: String })
  readonly key!: 'workspace';

  @ApiProperty({ type: String })
  readonly label!: string;

  @ApiProperty({ type: String })
  readonly route!: string;
}

export class CompanyWorkspaceResponseDto {
  @ApiProperty({
    enum: COMPANY_WORKSPACES.map(({ accountTypeCode }) => accountTypeCode),
    type: String,
  })
  readonly accountTypeCode!: string;

  @ApiProperty({ type: String })
  readonly accountTypeName!: string;

  @ApiProperty({
    enum: COMPANY_WORKSPACES.map(({ pageId }) => pageId),
    type: String,
  })
  readonly pageId!: string;

  @ApiProperty({ type: String })
  readonly workspaceRoute!: string;

  @ApiProperty({ isArray: true, type: () => CompanyWorkspaceMenuItemDto })
  readonly menuItems!: readonly CompanyWorkspaceMenuItemDto[];
}

export class CompanyWorkspacePageQueryDto {
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

export class CompanyWorkspacePageSummaryDto {
  @ApiProperty({ minimum: 0, type: Number })
  readonly catalogTotal!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly availableTotal!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly deferredTotal!: number;

  @ApiProperty({ minimum: 0, type: Number })
  readonly filteredTotal!: number;
}

export class CompanyWorkspacePageFiltersDto {
  @ApiProperty({ maxLength: 64, type: String })
  readonly keyword!: string;

  @ApiProperty({ enum: ['ALL', 'AVAILABLE', 'DEFERRED'], type: String })
  readonly availability!: 'ALL' | 'AVAILABLE' | 'DEFERRED';
}

export class CompanyWorkspaceModuleItemDto {
  @ApiProperty({ maxLength: 64, type: String })
  readonly moduleKey!: string;

  @ApiProperty({ maxLength: 128, type: String })
  readonly label!: string;

  @ApiProperty({ maxLength: 512, type: String })
  readonly description!: string;

  @ApiProperty({ enum: ['M1', 'M2', 'M3', 'M4', 'M5'], type: String })
  readonly deliveryStage!: 'M1' | 'M2' | 'M3' | 'M4' | 'M5';

  @ApiProperty({ enum: ['AVAILABLE', 'DEFERRED'], type: String })
  readonly availability!: 'AVAILABLE' | 'DEFERRED';

  @ApiProperty({ maxLength: 512, type: String })
  readonly dataBoundary!: string;
}

export class CompanyWorkspaceModuleTimelineEventDto {
  @ApiProperty({ maxLength: 64, type: String })
  readonly code!: string;

  @ApiProperty({ maxLength: 128, type: String })
  readonly label!: string;

  @ApiProperty({ enum: ['M1', 'M2', 'M3', 'M4', 'M5'], type: String })
  readonly stage!: 'M1' | 'M2' | 'M3' | 'M4' | 'M5';

  @ApiProperty({ enum: ['DONE', 'DEFERRED'], type: String })
  readonly status!: 'DONE' | 'DEFERRED';
}

export class CompanyWorkspaceModuleDetailDto extends CompanyWorkspaceModuleItemDto {
  @ApiProperty({ isArray: true, maxItems: 8, type: String })
  readonly sections!: readonly string[];

  @ApiProperty({
    isArray: true,
    type: () => CompanyWorkspaceModuleTimelineEventDto,
  })
  readonly timeline!: readonly CompanyWorkspaceModuleTimelineEventDto[];
}

export class CompanyWorkspacePageResponseDto {
  @ApiProperty({
    enum: COMPANY_WORKSPACES.map(({ accountTypeCode }) => accountTypeCode),
    type: String,
  })
  readonly accountTypeCode!: string;

  @ApiProperty({ type: String })
  readonly accountTypeName!: string;

  @ApiProperty({
    enum: COMPANY_WORKSPACES.map(({ pageId }) => pageId),
    type: String,
  })
  readonly pageId!: string;

  @ApiProperty({ type: String })
  readonly workspaceRoute!: string;

  @ApiProperty({ type: () => CompanyWorkspacePageSummaryDto })
  readonly summary!: CompanyWorkspacePageSummaryDto;

  @ApiProperty({ type: () => CompanyWorkspacePageFiltersDto })
  readonly filters!: CompanyWorkspacePageFiltersDto;

  @ApiProperty({ isArray: true, type: () => CompanyWorkspaceModuleItemDto })
  readonly items!: readonly CompanyWorkspaceModuleItemDto[];

  @ApiProperty({
    nullable: true,
    type: () => CompanyWorkspaceModuleDetailDto,
  })
  readonly selectedModule!: CompanyWorkspaceModuleDetailDto | null;
}
