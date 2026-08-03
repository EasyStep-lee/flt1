import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FoundationDependencyCheckDto {
  @ApiProperty({ enum: ['UP', 'DOWN'], example: 'UP', type: String })
  readonly status!: 'UP' | 'DOWN';

  @ApiProperty({ example: 'OK', type: String })
  readonly code!: string;

  @ApiProperty({ example: 1, minimum: 0, type: Number })
  readonly latencyMs!: number;
}

export class HealthReadinessChecksDto {
  @ApiPropertyOptional({ type: () => FoundationDependencyCheckDto })
  readonly database?: FoundationDependencyCheckDto;

  @ApiPropertyOptional({ type: () => FoundationDependencyCheckDto })
  readonly redis?: FoundationDependencyCheckDto;

  @ApiPropertyOptional({ type: () => FoundationDependencyCheckDto })
  readonly queue?: FoundationDependencyCheckDto;
}

export class HealthLivenessDto {
  @ApiProperty({ enum: ['UP'], example: 'UP', type: String })
  readonly status!: 'UP';

  @ApiProperty({ enum: ['fulishe-api'], example: 'fulishe-api', type: String })
  readonly service!: 'fulishe-api';
}

export class HealthReadinessDto {
  @ApiProperty({ enum: ['UP', 'DOWN'], example: 'UP', type: String })
  readonly status!: 'UP' | 'DOWN';

  @ApiProperty({ enum: ['fulishe-api'], example: 'fulishe-api', type: String })
  readonly service!: 'fulishe-api';

  @ApiProperty({
    example: '2026-08-02T00:00:00.000Z',
    format: 'date-time',
    type: String,
  })
  readonly checkedAt!: string;

  @ApiProperty({ type: () => HealthReadinessChecksDto })
  readonly checks!: HealthReadinessChecksDto;
}
