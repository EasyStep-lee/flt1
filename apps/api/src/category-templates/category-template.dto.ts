import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateValidationRuleDto {
  @ApiProperty({ nullable: true, required: true, type: Number }) readonly min!: number | null;
  @ApiProperty({ nullable: true, required: true, type: Number }) readonly max!: number | null;
  @ApiProperty({ minimum: 0, nullable: true, required: true, type: Number })
  readonly minLength!: number | null;
  @ApiProperty({ minimum: 0, nullable: true, required: true, type: Number })
  readonly maxLength!: number | null;
  @ApiProperty({ maxLength: 128, nullable: true, required: true, type: String })
  readonly pattern!: string | null;
}

export class TemplateFieldDefinitionDto {
  @ApiProperty({ maxLength: 64, pattern: '^[a-z][a-z0-9-]{0,63}$', type: String })
  readonly key!: string;
  @ApiProperty({ maxLength: 80, type: String }) readonly label!: string;
  @ApiProperty({
    enum: ['BOOLEAN', 'DATE', 'DECIMAL', 'ENUM', 'INTEGER', 'RICH_TEXT', 'TEXT'],
  })
  readonly type!: 'BOOLEAN' | 'DATE' | 'DECIMAL' | 'ENUM' | 'INTEGER' | 'RICH_TEXT' | 'TEXT';
  @ApiProperty({ type: Boolean }) readonly required!: boolean;
  @ApiProperty({ maxLength: 32, nullable: true, required: true, type: String })
  readonly unit!: string | null;
  @ApiProperty({ items: { maxLength: 80, type: 'string' }, maxItems: 50, type: 'array' })
  readonly enumValues!: readonly string[];
  @ApiProperty({ type: TemplateValidationRuleDto })
  readonly validation!: TemplateValidationRuleDto;
  @ApiProperty({ type: Boolean }) readonly searchable!: boolean;
  @ApiProperty({ type: Boolean }) readonly specification!: boolean;
  @ApiProperty({ maxLength: 64, pattern: '^[a-z][a-z0-9-]{0,63}$', type: String })
  readonly detailModuleKey!: string;
}

export class TemplateFieldSchemaDto {
  @ApiProperty({ enum: ['1.0'] }) readonly schemaVersion!: '1.0';
  @ApiProperty({ maxItems: 100, minItems: 1, type: [TemplateFieldDefinitionDto] })
  readonly fields!: readonly TemplateFieldDefinitionDto[];
}

export class TemplateSkuDimensionDto {
  @ApiProperty({ maxLength: 64, pattern: '^[a-z][a-z0-9-]{0,63}$', type: String })
  readonly key!: string;
  @ApiProperty({ maxLength: 80, type: String }) readonly label!: string;
  @ApiProperty({ maxLength: 64, pattern: '^[a-z][a-z0-9-]{0,63}$', type: String })
  readonly fieldKey!: string;
}

export class TemplateSkuDimensionsDto {
  @ApiProperty({ maxItems: 3, type: [TemplateSkuDimensionDto] })
  readonly dimensions!: readonly TemplateSkuDimensionDto[];
}

export class TemplateQualificationRuleDto {
  @ApiProperty({ maxLength: 64, pattern: '^[a-z][a-z0-9-]{0,63}$', type: String })
  readonly key!: string;
  @ApiProperty({ maxLength: 80, type: String }) readonly label!: string;
  @ApiProperty({ type: Boolean }) readonly required!: boolean;
  @ApiProperty({ type: Boolean }) readonly expiryRequired!: boolean;
  @ApiProperty({ enum: ['IMAGE', 'PDF'], isArray: true, maxItems: 2 })
  readonly objectTypes!: readonly ('IMAGE' | 'PDF')[];
}

export class TemplateQualificationRulesDto {
  @ApiProperty({ maxItems: 20, type: [TemplateQualificationRuleDto] })
  readonly rules!: readonly TemplateQualificationRuleDto[];
}

export class TemplateDetailModuleDto {
  @ApiProperty({ maxLength: 64, pattern: '^[a-z][a-z0-9-]{0,63}$', type: String })
  readonly key!: string;
  @ApiProperty({ maxLength: 80, type: String }) readonly title!: string;
  @ApiProperty({ enum: ['AFTER_SALE', 'FIELDS', 'NOTICE', 'QUALIFICATIONS'] })
  readonly kind!: 'AFTER_SALE' | 'FIELDS' | 'NOTICE' | 'QUALIFICATIONS';
  @ApiProperty({ type: Number }) readonly sortWeight!: number;
}

export class TemplateDetailModulesDto {
  @ApiProperty({ maxItems: 20, minItems: 1, type: [TemplateDetailModuleDto] })
  readonly modules!: readonly TemplateDetailModuleDto[];
}

export class TemplateAfterSaleRulesDto {
  @ApiProperty({ enum: ['CATEGORY_RESTRICTED', 'COMPANY_STANDARD', 'NON_RETURNABLE'] })
  readonly returnPolicy!: 'CATEGORY_RESTRICTED' | 'COMPANY_STANDARD' | 'NON_RETURNABLE';
  @ApiProperty({ maxLength: 500, type: String }) readonly notice!: string;
  @ApiProperty({ items: { maxLength: 64, type: 'string' }, maxItems: 20, type: 'array' })
  readonly evidenceRequirements!: readonly string[];
}

export class CategoryTemplateDefinitionDto {
  @ApiPropertyOptional({ default: 'GENERIC', enum: ['FOOD', 'FRESH', 'APPAREL', 'DIGITAL', 'GENERIC'] })
  readonly profile?: 'FOOD' | 'FRESH' | 'APPAREL' | 'DIGITAL' | 'GENERIC';
  @ApiProperty({ type: TemplateFieldSchemaDto }) readonly fieldSchema!: TemplateFieldSchemaDto;
  @ApiProperty({ type: TemplateSkuDimensionsDto })
  readonly skuDimensions!: TemplateSkuDimensionsDto;
  @ApiProperty({ type: TemplateQualificationRulesDto })
  readonly qualificationRules!: TemplateQualificationRulesDto;
  @ApiProperty({ type: TemplateDetailModulesDto })
  readonly detailModules!: TemplateDetailModulesDto;
  @ApiProperty({ type: TemplateAfterSaleRulesDto })
  readonly afterSaleRules!: TemplateAfterSaleRulesDto;
}

export class CategoryTemplateCreateRequestDto extends CategoryTemplateDefinitionDto {}

export class CategoryTemplatePatchRequestDto extends CategoryTemplateDefinitionDto {
  @ApiProperty({ minimum: 0, type: Number }) readonly revision!: number;
}

export class CategoryTemplatePublishRequestDto {
  @ApiProperty({ minimum: 0, type: Number }) readonly revision!: number;
}

export class CategoryTemplateResponseDto extends CategoryTemplateDefinitionDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly categoryId!: string;
  @ApiProperty({ minimum: 1, type: Number }) readonly version!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly revision!: number;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'RETIRED'] })
  readonly status!: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  @ApiProperty({ format: 'date-time', type: String }) readonly createdAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true, required: true, type: String })
  readonly publishedAt!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true, required: true, type: String })
  readonly retiredAt!: string | null;
}

export class CategoryTemplateListResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly categoryId!: string;
  @ApiProperty({ minimum: 1, nullable: true, required: true, type: Number })
  readonly activeVersion!: number | null;
  @ApiProperty({ type: [CategoryTemplateResponseDto] })
  readonly items!: readonly CategoryTemplateResponseDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}
