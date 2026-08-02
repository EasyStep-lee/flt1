import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { RequestWithId } from './request-id.middleware.js';

const safeError = (statusCode: number): { code: string; message: string } => {
  if (statusCode === 400) {
    return { code: 'REQUEST_INVALID', message: 'Request is invalid' };
  }
  if (statusCode === 401) {
    return { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required' };
  }
  if (statusCode === 403) {
    return { code: 'ACCESS_DENIED', message: 'Access is denied' };
  }
  if (statusCode === 404) {
    return { code: 'RESOURCE_NOT_FOUND', message: 'Resource was not found' };
  }
  if (statusCode === 503) {
    return { code: 'SERVICE_UNAVAILABLE', message: 'Service is unavailable' };
  }
  return { code: 'INTERNAL_ERROR', message: 'An internal error occurred' };
};

@Catch()
export class FoundationExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & RequestWithId>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const safe = safeError(statusCode);

    response.status(statusCode).json({
      statusCode,
      code: safe.code,
      message: safe.message,
      requestId: request.requestId,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
