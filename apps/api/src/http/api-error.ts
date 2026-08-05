export const FOUNDATION_ERROR_CODES = Object.freeze([
  'ACCESS_DENIED',
  'AUTHENTICATION_REQUIRED',
  'INTERNAL_ERROR',
  'REQUEST_INVALID',
  'RESOURCE_NOT_FOUND',
  'SERVICE_UNAVAILABLE',
] as const);

export type FoundationErrorCode = (typeof FOUNDATION_ERROR_CODES)[number];

export const SINGLE_MERCHANT_ERROR_CODES = Object.freeze([
  'PAYEE_FORBIDDEN',
  'SELLER_IDENTITY_FORBIDDEN',
  'SINGLE_MERCHANT_VIOLATION',
] as const);

export const SUPPLIER_ONBOARDING_ERROR_CODES = Object.freeze([
  'APPROVAL_VERSION_CONFLICT',
  'DATA_SCOPE_FORBIDDEN',
  'FIELD_FORBIDDEN',
  'SECOND_VERIFICATION_REQUIRED',
  'STATE_TRANSITION_INVALID',
  'SUPPLIER_DUPLICATE',
  'SUPPLIER_SCOPE_FORBIDDEN',
  'VALIDATION_FAILED',
  'VERSION_CONFLICT',
] as const);

export const API_ERROR_CODES = Object.freeze([
  ...FOUNDATION_ERROR_CODES,
  ...SINGLE_MERCHANT_ERROR_CODES,
  ...SUPPLIER_ONBOARDING_ERROR_CODES,
] as const);

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

interface SafeErrorDefinition {
  readonly code: ApiErrorCode;
  readonly message: string;
}

export interface ApiErrorResponse {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
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
  override?: SafeErrorDefinition,
): ApiErrorResponse => {
  const safe = override ?? resolveSafeError(statusCode);
  return {
    statusCode,
    code: safe.code,
    message: safe.message,
    requestId: requestId ?? 'request-id-unavailable',
    path,
    timestamp,
  };
};

export class SafeApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SafeApiError';
  }
}
