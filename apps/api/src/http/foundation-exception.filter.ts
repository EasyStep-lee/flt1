import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { RequestWithId } from './request-id.middleware.js';
import { createApiErrorResponse } from './api-error.js';

@Catch()
export class FoundationExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & RequestWithId>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    response
      .status(statusCode)
      .json(createApiErrorResponse(statusCode, request.requestId, request.originalUrl));
  }
}
