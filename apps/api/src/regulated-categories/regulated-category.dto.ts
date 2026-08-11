import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegulatedCategoryEnableRequestDto {
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ items: { type: 'string' }, maxItems: 50, minItems: 1, type: [String] })
  readonly companyQualificationReferences!: readonly string[];
  @ApiProperty({ format: 'date-time', type: String }) readonly qualificationValidUntil!: string;
  @ApiProperty({ maxLength: 64, minLength: 4, type: String })
  readonly secondVerificationCode!: string;
}

export class RegulatedCategoryDisableRequestDto {
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiProperty({ maxLength: 500, minLength: 2, type: String }) readonly reason!: string;
  @ApiProperty({ maxLength: 64, minLength: 4, type: String })
  readonly secondVerificationCode!: string;
}

export class RegulatedCategoryControlResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly categoryId!: string;
  @ApiProperty({ enum: ['DISABLED', 'ENABLED'] }) readonly status!: 'DISABLED' | 'ENABLED';
  @ApiProperty({ minimum: 0, type: Number })
  readonly companyQualificationReferenceCount!: number;
  @ApiProperty({ format: 'date-time', nullable: true, required: true, type: String })
  readonly qualificationValidUntil!: string | null;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  readonly enabledAt!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  readonly disabledAt!: string | null;
}

export class RegulatedCategoryControlPageDto {
  @ApiProperty({ type: [RegulatedCategoryControlResponseDto] })
  readonly items!: readonly RegulatedCategoryControlResponseDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}
