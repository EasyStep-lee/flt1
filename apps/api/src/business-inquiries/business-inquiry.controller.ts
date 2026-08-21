import { Body, Controller, Header, Headers, Inject, Post, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import {
  BusinessInquiryRequestDto,
  BusinessInquiryResponseDto,
} from './business-inquiry.dto.js';
import { BusinessInquiryService } from './business-inquiry.service.js';

@ApiExtraModels(ApiErrorResponseDto, BusinessInquiryRequestDto, BusinessInquiryResponseDto)
@ApiTags('public-business-inquiries')
@Controller('v1/public/business-inquiries')
export class BusinessInquiryController {
  constructor(
    @Inject(BusinessInquiryService)
    private readonly service: BusinessInquiryService,
  ) {}

  @Post()
  @Header('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  @ApiOperation({
    operationId: 'publicBusinessInquiry.submit',
    summary: 'Submit a minimum enterprise welfare inquiry to the single merchant',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'Origin', required: true })
  @ApiHeader({ name: 'Sec-Fetch-Site', required: true })
  @ApiHeader({ name: 'X-Captcha-Token', required: true })
  @ApiBody({ type: BusinessInquiryRequestDto })
  @ApiCreatedResponse({ type: BusinessInquiryResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async submit(
    @Req() request: RequestWithId,
    @Body() body: BusinessInquiryRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Headers('sec-fetch-site') secFetchSite: string | undefined,
    @Headers('x-captcha-token') captchaToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BusinessInquiryResponseDto> {
    const result = await this.service.submit(body, idempotencyKey, {
      captchaToken,
      origin,
      requestId: request.requestId ?? 'request-id-unavailable',
      secFetchSite,
      sourceIp: request.ip ?? 'source-unavailable',
    });
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    return result.body;
  }
}
