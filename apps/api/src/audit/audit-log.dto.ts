import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditQueryDto {
  @ApiPropertyOptional({ maxLength: 128, type: String })
  readonly action?: string;

  @ApiPropertyOptional({ maxLength: 128, type: String })
  readonly objectType?: string;

  @ApiPropertyOptional({ maxLength: 64, type: String })
  readonly objectId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, type: Number })
  readonly page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1, type: Number })
  readonly pageSize?: number;
}

export class AuditEventResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ enum: ['COMPANY_USER', 'SUPPLIER_USER', 'SYSTEM'], type: String })
  readonly actorType!: string;
  @ApiProperty({ format: 'uuid', type: String }) readonly actorId!: string;
  @ApiProperty({ type: String }) readonly action!: string;
  @ApiProperty({ type: String }) readonly objectType!: string;
  @ApiProperty({ type: String }) readonly objectId!: string;
  @ApiProperty({ type: Object }) readonly beforeSnapshot!: unknown;
  @ApiProperty({ type: Object }) readonly afterSnapshot!: unknown;
  @ApiProperty({ format: 'uuid', type: String }) readonly requestId!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly occurredAt!: string;
}

export class AuditEventPageResponseDto {
  @ApiProperty({ isArray: true, type: () => AuditEventResponseDto })
  readonly items!: readonly AuditEventResponseDto[];
  @ApiProperty({ minimum: 1, type: Number }) readonly page!: number;
  @ApiProperty({ maximum: 100, minimum: 1, type: Number }) readonly pageSize!: number;
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}
