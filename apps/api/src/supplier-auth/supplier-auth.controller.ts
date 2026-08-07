import {
  Body,
  Controller,
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
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
  SupplierLoginRequestDto,
  SupplierSelectWorkspaceRequestDto,
  SupplierSessionResponseDto,
  SupplierWorkspaceChoiceResponseDto,
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
