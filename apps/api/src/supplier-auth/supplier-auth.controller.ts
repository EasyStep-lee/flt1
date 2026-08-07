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
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
  SupplierLoginRequestDto,
  SupplierSelectWorkspaceRequestDto,
  SupplierSessionResponseDto,
  SupplierWorkspacePageResponseDto,
  type SupplierWorkspacePageQueryDto,
  SupplierWorkspaceChoiceResponseDto,
  SupplierWorkspaceResponseDto,
} from './supplier-auth.dto.js';
import { SupplierAuthService } from './supplier-auth.service.js';

export const SUPPLIER_SESSION_COOKIE_NAME = '__Host-fulishe-supplier-portal';

const contextFrom = (request: Request, userAgent?: string) => ({
  deviceInfo: { userAgent: userAgent?.slice(0, 512) ?? 'unknown' },
  ip: request.ip || request.socket.remoteAddress || '0.0.0.0',
});

const setSessionCookie = (response: Response, token?: string): void => {
  if (!token) return;
  response.cookie(SUPPLIER_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
    sameSite: 'strict',
    secure: true,
  });
};

@ApiTags('supplier-auth')
@Controller('v1/supplier-auth')
export class SupplierAuthController {
  constructor(
    @Inject(SupplierAuthService) private readonly service: SupplierAuthService,
  ) {}

  @Get('workspace/page')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ summary: '读取当前供应商职能页面的隔离模块目录' })
  @ApiQuery({ maxLength: 255, name: 'route', required: true, type: String })
  @ApiQuery({ maxLength: 64, name: 'keyword', required: false, type: String })
  @ApiQuery({
    enum: ['ALL', 'AVAILABLE', 'DEFERRED'],
    name: 'availability',
    required: false,
    type: String,
  })
  @ApiQuery({ maxLength: 64, name: 'moduleKey', required: false, type: String })
  @ApiOkResponse({ type: SupplierWorkspacePageResponseDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  @ApiUnprocessableEntityResponse()
  workspacePage(
    @Headers('cookie') cookieHeader: string | undefined,
    @Query() query: SupplierWorkspacePageQueryDto & Record<string, unknown>,
  ): Promise<SupplierWorkspacePageResponseDto> {
    return this.service.workspacePage(cookieHeader, query);
  }

  @Get('workspace/current')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ summary: '读取当前固定供应商职能工作区白名单' })
  @ApiQuery({ maxLength: 255, name: 'route', required: true, type: String })
  @ApiOkResponse({ type: SupplierWorkspaceResponseDto })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  @ApiUnprocessableEntityResponse()
  currentWorkspace(
    @Headers('cookie') cookieHeader: string | undefined,
    @Query() query: Record<string, unknown>,
  ): Promise<SupplierWorkspaceResponseDto> {
    return this.service.currentWorkspace(cookieHeader, query);
  }

  @Post('login')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @HttpCode(200)
  @ApiOperation({ summary: '供应商独立登录并解析本方职能账号' })
  @ApiBody({ type: SupplierLoginRequestDto })
  @ApiOkResponse({ type: SupplierWorkspaceChoiceResponseDto })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  @ApiUnprocessableEntityResponse()
  async login(
    @Body() body: SupplierLoginRequestDto & Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent?: string,
  ): Promise<SupplierWorkspaceChoiceResponseDto> {
    const result = await this.service.login(body, contextFrom(request, userAgent));
    setSessionCookie(response, result.sessionToken);
    return result.body;
  }

  @Post('workspaces/:accountId/select')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @HttpCode(200)
  @ApiOperation({ summary: '选择一个供应商职能账号并签发单工作区会话' })
  @ApiParam({ format: 'uuid', name: 'accountId', type: String })
  @ApiBody({ type: SupplierSelectWorkspaceRequestDto })
  @ApiOkResponse({ type: SupplierSessionResponseDto })
  @ApiForbiddenResponse()
  @ApiUnprocessableEntityResponse()
  async selectWorkspace(
    @Param('accountId') accountId: string,
    @Body() body: SupplierSelectWorkspaceRequestDto & Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent?: string,
  ): Promise<SupplierSessionResponseDto> {
    const result = await this.service.selectWorkspace(
      accountId,
      body,
      contextFrom(request, userAgent),
    );
    setSessionCookie(response, result.sessionToken);
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    return result.body;
  }
}
