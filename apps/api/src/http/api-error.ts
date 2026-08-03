export const FOUNDATION_ERROR_CODES = Object.freeze([
  'ACCESS_DENIED',
  'AUTHENTICATION_REQUIRED',
  'INTERNAL_ERROR',
  'REQUEST_INVALID',
  'RESOURCE_NOT_FOUND',
  'SERVICE_UNAVAILABLE',
] as const);

export type FoundationErrorCode = (typeof FOUNDATION_ERROR_CODES)[number];

interface SafeErrorDefinition {
  readonly code: FoundationErrorCode;
  readonly message: string;
}

export interface ApiErrorResponse {
  readonly statusCode: number;
  readonly code: FoundationErrorCode;
  readonly message: string;
  readonly requestId: string;
  readonly path: string;
  readonly timestamp: string;
}

export const resolveSafeError = (statusCode: number): SafeErrorDefinition => {
  if (statusCode === 400) {
    return { code: 'REQUEST_INVALID', message: 'Request is invalid' };
  }
  if (statusCode === 401) {
    return {
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication is required',
    };
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
  return {
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred',
  };
};

export const createApiErrorResponse = (
  statusCode: number,
  requestId: string | undefined,
  path: string,
  timestamp = new Date().toISOString(),
): ApiErrorResponse => {
  const safe = resolveSafeError(statusCode);
  return {
    statusCode,
    code: safe.code,
    message: safe.message,
    requestId: requestId ?? 'request-id-unavailable',
    path,
    timestamp,
  };
};
