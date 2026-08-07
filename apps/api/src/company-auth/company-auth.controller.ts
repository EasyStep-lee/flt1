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

import type { CompanyWorkspacePageQueryDto } from './company-auth.dto.js';
import {
  CompanyLoginRequestDto,
  CompanyWorkspacePageResponseDto,
  CompanyWorkspaceResponseDto,
  SelectWorkspaceRequestDto,
  SessionResponseDto,
  WorkspaceChoiceResponseDto,
} from './company-auth.dto.js';
import { CompanyAuthService } from './company-auth.service.js';

export const COMPANY_SESSION_COOKIE_NAME = '__Host-fulishe-company-admin';

const contextFrom = (request: Request, userAgent?: string) => ({
  deviceInfo: { userAgent: userAgent?.slice(0, 512) ?? 'unknown' },
  ip: request.ip || request.socket.remoteAddress || '0.0.0.0',
});

const setSessionCookie = (response: Response, token?: string): void => {
  if (!token) return;
  response.cookie(COMPANY_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
    sameSite: 'strict',
    secure: true,
  });
  response.setHeader('Cache-Control', 'private, no-store');
};

@ApiTags('company-auth')
@Controller('v1/company-auth')
export class CompanyAuthController {
  constructor(
    @Inject(CompanyAuthService) private readonly service: CompanyAuthService,
  ) {}

  @Get('workspace/page')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ summary: '读取当前公司职能页面的隔离模块目录' })
  @ApiQuery({ maxLength: 255, name: 'route', required: true, type: String })
  @ApiQuery({ maxLength: 64, name: 'keyword', required: false, type: String })
  @ApiQuery({
    enum: ['ALL', 'AVAILABLE', 'DEFERRED'],
    name: 'availability',
    required: false,
    type: String,
  })
  @ApiQuery({ maxLength: 64, name: 'moduleKey', required: false, type: String })
  @ApiOkResponse({ type: CompanyWorkspacePageResponseDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  @ApiUnprocessableEntityResponse()
  workspacePage(
    @Headers('cookie') cookieHeader: string | undefined,
    @Query() query: CompanyWorkspacePageQueryDto & Record<string, unknown>,
  ): Promise<CompanyWorkspacePageResponseDto> {
    return this.service.workspacePage(cookieHeader, query);
  }

  @Get('workspace/current')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @ApiOperation({ summary: '读取当前固定公司职能工作区白名单' })
  @ApiQuery({ maxLength: 255, name: 'route', required: true, type: String })
  @ApiOkResponse({ type: CompanyWorkspaceResponseDto })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  @ApiUnprocessableEntityResponse()
  currentWorkspace(
    @Headers('cookie') cookieHeader: string | undefined,
    @Query('route') route: string | undefined,
  ): Promise<CompanyWorkspaceResponseDto> {
    return this.service.currentWorkspace(cookieHeader, route);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '公司后台独立登录并解析职能账号' })
  @ApiBody({ type: CompanyLoginRequestDto })
  @ApiOkResponse({ type: WorkspaceChoiceResponseDto })
  async login(
    @Body() body: CompanyLoginRequestDto & Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent?: string,
  ): Promise<WorkspaceChoiceResponseDto> {
    const result = await this.service.login(body, contextFrom(request, userAgent));
    setSessionCookie(response, result.sessionToken);
    response.setHeader('Cache-Control', 'private, no-store');
    return result.body;
  }

  @Post('workspaces/:accountId/select')
  @HttpCode(200)
  @ApiOperation({ summary: '选择一个公司职能账号并签发单工作区会话' })
  @ApiParam({ format: 'uuid', name: 'accountId', type: String })
  @ApiBody({ type: SelectWorkspaceRequestDto })
  @ApiOkResponse({ type: SessionResponseDto })
  async selectWorkspace(
    @Param('accountId') accountId: string,
    @Body() body: SelectWorkspaceRequestDto & Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Headers('user-agent') userAgent?: string,
  ): Promise<SessionResponseDto> {
    const result = await this.service.selectWorkspace(
      accountId,
      body,
      contextFrom(request, userAgent),
    );
    setSessionCookie(response, result.sessionToken);
    if (result.replayed) response.setHeader('Idempotency-Replayed', 'true');
    response.setHeader('Cache-Control', 'private, no-store');
    return result.body;
  }
}
