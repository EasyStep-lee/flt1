import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { RequestWithId } from './request-id.middleware.js';
import { createApiErrorResponse, SafeApiError } from './api-error.js';

@Catch()
export class FoundationExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & RequestWithId>();
    const statusCode =
      exception instanceof SafeApiError
        ? exception.statusCode
        : exception instanceof HttpException
          ? exception.getStatus()
          : 500;
    const override =
      exception instanceof SafeApiError
        ? { code: exception.code, message: exception.message }
        : undefined;
    response
      .status(statusCode)
      .json(
        createApiErrorResponse(
          statusCode,
          request.requestId,
          request.path,
          new Date().toISOString(),
          override,
        ),
      );
  }
}
