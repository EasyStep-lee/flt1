import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

const requestIdPattern = /^[A-Za-z0-9_-]{8,128}$/;

export interface RequestWithId extends Request {
  requestId?: string;
}

export const requestIdMiddleware = (
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void => {
  const supplied = request.header('x-request-id')?.trim();
  const requestId = supplied && requestIdPattern.test(supplied) ? supplied : randomUUID();
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
};
