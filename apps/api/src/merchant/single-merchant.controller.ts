import { Controller, Get, Header, Inject, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import {
  PublicMerchantProfileQuery,
  PublicMerchantProfileResponse,
  PublicMerchantSubjectsDto,
} from './single-merchant.dto.js';
import { SingleMerchantService } from './single-merchant.service.js';

@ApiExtraModels(
  ApiErrorResponseDto,
  PublicMerchantProfileQuery,
  PublicMerchantProfileResponse,
  PublicMerchantSubjectsDto,
)
@ApiTags('public-merchant')
@Controller('v1/public/merchant-profile')
export class SingleMerchantController {
  constructor(
    @Inject(SingleMerchantService)
    private readonly service: SingleMerchantService,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  @ApiOperation({
    operationId: 'publicMerchant.getProfile',
    summary: 'Get the fixed customer-facing merchant identity',
  })
  @ApiQuery({
    enum: ['ALL', 'PAYMENT', 'REFUND', 'SALE'],
    name: 'context',
    required: false,
  })
  @ApiOkResponse({ type: PublicMerchantProfileResponse })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  getProfile(
    @Query() query: PublicMerchantProfileQuery & Record<string, unknown>,
  ): Promise<PublicMerchantProfileResponse> {
    return this.service.getPublicMerchantProfile(query);
  }
}
