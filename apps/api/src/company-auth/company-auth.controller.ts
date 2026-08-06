import {
  Body,
  Controller,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
  CompanyLoginRequestDto,
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
