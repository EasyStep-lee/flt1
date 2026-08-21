import { ApiProperty } from '@nestjs/swagger';

export class BusinessInquiryRequestDto {
  @ApiProperty({ maxLength: 64, minLength: 2, type: String })
  readonly contactName!: string;

  @ApiProperty({ maxLength: 191, minLength: 2, type: String })
  readonly enterpriseName!: string;

  @ApiProperty({ maxLength: 16, minLength: 8, type: String })
  readonly mobile!: string;

  @ApiProperty({ maxLength: 500, minLength: 10, type: String })
  readonly demandSummary!: string;

  @ApiProperty({ enum: [true], type: Boolean })
  readonly consentToUse!: true;
}

export class BusinessInquiryResponseDto {
  @ApiProperty({ pattern: '^FLX\\d{8}[A-Z0-9]{8}$', type: String })
  readonly leadNumber!: string;

  @ApiProperty({ enum: ['SUBMITTED'], type: String })
  readonly status!: 'SUBMITTED';

  @ApiProperty({ format: 'date-time', type: String })
  readonly submittedAt!: string;

  @ApiProperty({ type: String })
  readonly useNotice!: string;

  @ApiProperty({ type: String })
  readonly contactExpectation!: string;

  @ApiProperty({ type: String })
  readonly modificationOrWithdrawalChannel!: string;
}
