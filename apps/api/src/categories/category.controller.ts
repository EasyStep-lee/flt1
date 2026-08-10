import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
  CategoryCreateRequestDto,
  CategoryDeleteResponseDto,
  CategoryPatchRequestDto,
  CategoryResponseDto,
  CategoryTreeNodeDto,
  CategoryTreeResponseDto,
} from './category.dto.js';
import { CategoryService } from './category.service.js';

const replayHeader = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

@ApiTags('company-categories')
@ApiExtraModels(
  ApiErrorResponseDto,
  CategoryCreateRequestDto,
  CategoryDeleteResponseDto,
  CategoryPatchRequestDto,
  CategoryResponseDto,
  CategoryTreeNodeDto,
  CategoryTreeResponseDto,
)
@Controller('v1/company/categories')
export class CategoryController {
  constructor(
    @Inject(CategoryService) private readonly service: CategoryService,
    @Inject(COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER)
    private readonly actorResolver: CompanyProductApprovalActorResolver,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companyCategories.list', summary: 'List the role-scoped category tree' })
  @ApiQuery({ enum: ['ENABLED', 'DISABLED'], name: 'status', required: false })
  @ApiOkResponse({ type: CategoryTreeResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async list(
    @Req() request: RequestWithId,
    @Query('status') status: string | undefined,
  ): Promise<CategoryTreeResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    return this.service.list(actor, status);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companyCategories.create', summary: 'Create a category under the fixed company session' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CategoryCreateRequestDto })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async create(
    @Req() request: RequestWithId,
    @Body() body: CategoryCreateRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CategoryResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    const result = await this.service.create(
      actor,
      body,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }

  @Patch(':categoryId')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companyCategories.patch', summary: 'Move, sort, rename or enable/disable a category' })
  @ApiParam({ format: 'uuid', name: 'categoryId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CategoryPatchRequestDto })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async patch(
    @Req() request: RequestWithId,
    @Param('categoryId') categoryId: string,
    @Body() body: CategoryPatchRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CategoryResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    const result = await this.service.patch(
      actor,
      categoryId,
      body,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }

  @Delete(':categoryId')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ operationId: 'companyCategories.delete', summary: 'Delete only an unreferenced leaf category' })
  @ApiParam({ format: 'uuid', name: 'categoryId', type: String })
  @ApiQuery({ minimum: 0, name: 'version', type: Number })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOkResponse({ type: CategoryDeleteResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async delete(
    @Req() request: RequestWithId,
    @Param('categoryId') categoryId: string,
    @Query('version') version: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CategoryDeleteResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    const numericVersion =
      typeof version === 'string' && /^\d+$/u.test(version) ? Number(version) : version;
    const result = await this.service.delete(
      actor,
      categoryId,
      numericVersion,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }
}
