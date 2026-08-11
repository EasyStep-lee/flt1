import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import {
  COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER,
  type CompanyProductApprovalActorResolver,
} from '../company-product-approvals/company-product-approval.actor.js';
import { ApiErrorResponseDto } from '../http/api-error.dto.js';
import type { RequestWithId } from '../http/request-id.middleware.js';
import {
  RegulatedCategoryControlPageDto,
  RegulatedCategoryControlResponseDto,
  RegulatedCategoryDisableRequestDto,
  RegulatedCategoryEnableRequestDto,
} from './regulated-category.dto.js';
import { RegulatedCategoryService } from './regulated-category.service.js';

@ApiExtraModels(
  ApiErrorResponseDto,
  RegulatedCategoryControlPageDto,
  RegulatedCategoryControlResponseDto,
  RegulatedCategoryDisableRequestDto,
  RegulatedCategoryEnableRequestDto,
)
@ApiTags('company-regulated-category-controls')
@Controller('v1/company/regulated-category-controls')
export class RegulatedCategoryController {
  constructor(
    @Inject(RegulatedCategoryService) private readonly service: RegulatedCategoryService,
    @Inject(COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER)
    private readonly actorResolver: CompanyProductApprovalActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'regulatedCategoryControls.list', summary: 'List company-scoped high-risk controls' })
  @ApiOkResponse({ type: RegulatedCategoryControlPageDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(@Req() request: RequestWithId): Promise<RegulatedCategoryControlPageDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    return this.service.list(actor) as Promise<RegulatedCategoryControlPageDto>;
  }

  @Post(':categoryId/enable')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'regulatedCategoryControls.enable', summary: 'Enable a high-risk category after second verification' })
  @ApiParam({ format: 'uuid', name: 'categoryId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: RegulatedCategoryEnableRequestDto })
  @ApiOkResponse({ type: RegulatedCategoryControlResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 428, type: ApiErrorResponseDto })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async enable(
    @Req() request: RequestWithId,
    @Param('categoryId') categoryId: string,
    @Body() body: RegulatedCategoryEnableRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegulatedCategoryControlResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    const result = await this.service.enable(
      actor,
      categoryId,
      body,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    return result.body;
  }

  @Post(':categoryId/disable')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'regulatedCategoryControls.disable', summary: 'Disable a high-risk category after second verification' })
  @ApiParam({ format: 'uuid', name: 'categoryId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: RegulatedCategoryDisableRequestDto })
  @ApiOkResponse({ type: RegulatedCategoryControlResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 428, type: ApiErrorResponseDto })
  @ApiResponse({ status: 503, type: ApiErrorResponseDto })
  async disable(
    @Req() request: RequestWithId,
    @Param('categoryId') categoryId: string,
    @Body() body: RegulatedCategoryDisableRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegulatedCategoryControlResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    const result = await this.service.disable(
      actor,
      categoryId,
      body,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    return result.body;
  }
}
