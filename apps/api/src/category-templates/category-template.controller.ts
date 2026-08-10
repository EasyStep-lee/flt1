import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
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
  CategoryTemplateCreateRequestDto,
  CategoryTemplateDefinitionDto,
  CategoryTemplateListResponseDto,
  CategoryTemplatePatchRequestDto,
  CategoryTemplatePublishRequestDto,
  CategoryTemplateResponseDto,
  TemplateAfterSaleRulesDto,
  TemplateDetailModuleDto,
  TemplateDetailModulesDto,
  TemplateFieldDefinitionDto,
  TemplateFieldSchemaDto,
  TemplateQualificationRuleDto,
  TemplateQualificationRulesDto,
  TemplateSkuDimensionDto,
  TemplateSkuDimensionsDto,
  TemplateValidationRuleDto,
} from './category-template.dto.js';
import { CategoryTemplateService } from './category-template.service.js';

const replayHeader = (response: Response, replayed: boolean): void => {
  if (replayed) response.setHeader('Idempotency-Replayed', 'true');
};

@ApiTags('company-category-templates')
@ApiExtraModels(
  ApiErrorResponseDto,
  CategoryTemplateCreateRequestDto,
  CategoryTemplateDefinitionDto,
  CategoryTemplateListResponseDto,
  CategoryTemplatePatchRequestDto,
  CategoryTemplatePublishRequestDto,
  CategoryTemplateResponseDto,
  TemplateAfterSaleRulesDto,
  TemplateDetailModuleDto,
  TemplateDetailModulesDto,
  TemplateFieldDefinitionDto,
  TemplateFieldSchemaDto,
  TemplateQualificationRuleDto,
  TemplateQualificationRulesDto,
  TemplateSkuDimensionDto,
  TemplateSkuDimensionsDto,
  TemplateValidationRuleDto,
)
@Controller('v1/company')
export class CategoryTemplateController {
  constructor(
    @Inject(CategoryTemplateService) private readonly service: CategoryTemplateService,
    @Inject(COMPANY_PRODUCT_APPROVAL_ACTOR_RESOLVER)
    private readonly actorResolver: CompanyProductApprovalActorResolver,
  ) {}

  @Get('categories/:categoryId/template-versions')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'companyCategoryTemplates.list',
    summary: 'List immutable template versions for one company leaf category',
  })
  @ApiParam({ format: 'uuid', name: 'categoryId', type: String })
  @ApiOkResponse({ type: CategoryTemplateListResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async list(
    @Req() request: RequestWithId,
    @Param('categoryId') categoryId: string,
  ): Promise<CategoryTemplateListResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    return this.service.list(actor, categoryId);
  }

  @Post('categories/:categoryId/template-versions')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'companyCategoryTemplates.createDraft',
    summary: 'Create the next category template draft version',
  })
  @ApiParam({ format: 'uuid', name: 'categoryId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CategoryTemplateCreateRequestDto })
  @ApiCreatedResponse({ type: CategoryTemplateResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async createDraft(
    @Req() request: RequestWithId,
    @Param('categoryId') categoryId: string,
    @Body() body: CategoryTemplateCreateRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CategoryTemplateResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    const result = await this.service.createDraft(
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

  @Patch('category-template-versions/:templateId')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'companyCategoryTemplates.patchDraft',
    summary: 'Edit only a category template draft with optimistic locking',
  })
  @ApiParam({ format: 'uuid', name: 'templateId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CategoryTemplatePatchRequestDto })
  @ApiOkResponse({ type: CategoryTemplateResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async patchDraft(
    @Req() request: RequestWithId,
    @Param('templateId') templateId: string,
    @Body() body: CategoryTemplatePatchRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CategoryTemplateResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    const result = await this.service.patchDraft(
      actor,
      templateId,
      body,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }

  @Post('category-template-versions/:templateId/publish')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({
    operationId: 'companyCategoryTemplates.publish',
    summary: 'Publish a draft and atomically retire the prior active version',
  })
  @ApiParam({ format: 'uuid', name: 'templateId', type: String })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: CategoryTemplatePublishRequestDto })
  @ApiOkResponse({ type: CategoryTemplateResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async publish(
    @Req() request: RequestWithId,
    @Param('templateId') templateId: string,
    @Body() body: CategoryTemplatePublishRequestDto & Record<string, unknown>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CategoryTemplateResponseDto> {
    const actor = await this.actorResolver.resolve(request, 'COMPANY_PRODUCT_OPS');
    const result = await this.service.publish(
      actor,
      templateId,
      body,
      idempotencyKey,
      request.requestId!,
      request.ip ?? null,
    );
    replayHeader(response, result.replayed);
    return result.body;
  }
}
