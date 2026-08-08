import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSensitiveApprovalRequestDto {
  @ApiProperty({ enum: ['AUDIT_EVENTS'], type: String })
  readonly resource!: 'AUDIT_EVENTS';

  @ApiProperty({ maxLength: 500, minLength: 2, type: String })
  readonly reason!: string;
}

export class ClaimSensitiveApprovalRequestDto {
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
}

export class DecideSensitiveApprovalRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], type: String })
  readonly decision!: 'APPROVE' | 'REJECT';

  @ApiProperty({ maxLength: 1000, minLength: 2, type: String })
  readonly opinion!: string;

  @ApiProperty({ maxLength: 64, minLength: 4, type: String })
  readonly secondVerificationCode!: string;

  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
}

export class SensitiveApprovalTaskResponseDto {
  @ApiProperty({ format: 'uuid', type: String }) readonly id!: string;
  @ApiProperty({ enum: ['SENSITIVE_EXPORT'], type: String })
  readonly approvalType!: 'SENSITIVE_EXPORT';
  @ApiProperty({ enum: ['AUDIT_EVENTS'], type: String })
  readonly resource!: 'AUDIT_EVENTS';
  @ApiProperty({ enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'], type: String })
  readonly status!: string;
  @ApiProperty({ minimum: 0, type: Number }) readonly version!: number;
  @ApiPropertyOptional({ maxLength: 1000, nullable: true, type: String })
  readonly reviewOpinion!: string | null;
  @ApiProperty({ format: 'date-time', type: String }) readonly createdAt!: string;
  @ApiProperty({ format: 'date-time', type: String }) readonly updatedAt!: string;
}

export class SensitiveApprovalPageResponseDto {
  @ApiProperty({ isArray: true, type: () => SensitiveApprovalTaskResponseDto })
  readonly items!: readonly SensitiveApprovalTaskResponseDto[];
  @ApiProperty({ minimum: 0, type: Number }) readonly total!: number;
}
