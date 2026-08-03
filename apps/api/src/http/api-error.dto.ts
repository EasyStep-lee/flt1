import { ApiProperty } from '@nestjs/swagger';

import { FOUNDATION_ERROR_CODES, type FoundationErrorCode } from './api-error.js';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 404, type: Number })
  readonly statusCode!: number;

  @ApiProperty({
    enum: FOUNDATION_ERROR_CODES,
    example: 'RESOURCE_NOT_FOUND',
    type: String,
  })
  readonly code!: FoundationErrorCode;

  @ApiProperty({ example: 'Resource was not found', type: String })
  readonly message!: string;

  @ApiProperty({ example: 'contract-request-0001', type: String })
  readonly requestId!: string;

  @ApiProperty({ example: '/missing', type: String })
  readonly path!: string;

  @ApiProperty({
    example: '2026-08-02T00:00:00.000Z',
    format: 'date-time',
    type: String,
  })
  readonly timestamp!: string;
}
