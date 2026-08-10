import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryCreateRequestDto {
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  readonly parentId!: string | null;
  @ApiProperty({ maxLength: 100, minLength: 1, type: String }) readonly name!: string;
  @ApiProperty({ enum: [1, 2, 3], type: Number }) readonly level!: 1 | 2 | 3;
  @ApiProperty({ type: Number }) readonly sortWeight!: number;
}

export class CategoryPatchRequestDto {
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  readonly parentId?: string | null;
  @ApiPropertyOptional({ maxLength: 100, minLength: 1, type: String })
  readonly name?: string;
  @ApiPropertyOptional({ type: Number }) readonly sortWeight?: number;
  @ApiPropertyOptional({ enum: ['ENABLED', 'DISABLED'], type: String })
  readonly status?: 'ENABLED' | 'DISABLED';
}

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  readonly parentId!: string | null;
  @ApiProperty({ type: String }) readonly name!: string;
  @ApiProperty({ enum: [1, 2, 3], type: Number }) readonly level!: 1 | 2 | 3;
  @ApiProperty({ type: Number }) readonly sortWeight!: number;
  @ApiProperty({ enum: ['ENABLED', 'DISABLED'], type: String })
  readonly status!: 'ENABLED' | 'DISABLED';
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
}

export class CategoryTreeNodeDto extends CategoryResponseDto {
  @ApiProperty({ isArray: true, type: () => CategoryTreeNodeDto })
  readonly children!: readonly CategoryTreeNodeDto[];
}

export class CategoryTreeResponseDto {
  @ApiProperty({ isArray: true, type: () => CategoryTreeNodeDto })
  readonly items!: readonly CategoryTreeNodeDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}

export class CategoryDeleteResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ enum: [true], type: Boolean }) readonly deleted!: true;
  @ApiProperty({ minimum: 1, type: Number }) readonly version!: number;
}

