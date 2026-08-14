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
  'FORBIDDEN_CAPABILITY',
  'PAYEE_FORBIDDEN',
  'SELLER_IDENTITY_FORBIDDEN',
  'SINGLE_MERCHANT_VIOLATION',
] as const);

export const SUPPLIER_ONBOARDING_ERROR_CODES = Object.freeze([
  'ACTOR_SPOOFED',
  'ACCOUNT_TYPE_INVALID',
  'APPROVAL_VERSION_CONFLICT',
  'DATA_SCOPE_FORBIDDEN',
  'FIELD_FORBIDDEN',
  'IDEMPOTENCY_CONFLICT',
  'SECOND_VERIFICATION_REQUIRED',
  'STATE_TRANSITION_INVALID',
  'SUPPLIER_DUPLICATE',
  'SUPPLIER_SCOPE_FORBIDDEN',
  'VALIDATION_FAILED',
  'VERSION_CONFLICT',
  'WORKSPACE_FORBIDDEN',
] as const);

export const CUSTOMER_CATALOG_ERROR_CODES = Object.freeze([
  'REGION_UNAVAILABLE',
  'SENSITIVE_FIELD_LEAK',
] as const);

export const INVENTORY_ERROR_CODES = Object.freeze([
  'INVENTORY_INSUFFICIENT',
  'INVENTORY_NEGATIVE',
  'INVENTORY_RESERVATION_CONFLICT',
  'INVENTORY_STATE_INVALID',
  'INVENTORY_VERSION_CONFLICT',
] as const);

export const COMPANY_AUTH_ERROR_CODES = Object.freeze([
  'ACCOUNT_SUSPENDED',
  'AUTH_INVALID',
  'AUTH_SESSION_REVOKED',
  'RATE_LIMITED',
  'SUPPLIER_NOT_ACTIVE',
  'WORKSPACE_MENU_VIOLATION',
  'WORKSPACE_MODULE_NOT_FOUND',
  'WORKSPACE_SELECTION_REQUIRED',
  'WORKSPACE_SESSION_CONFLICT',
] as const);

export const AUDIT_ERROR_CODES = Object.freeze([
  'AUDIT_IMMUTABLE',
  'AUDIT_REQUIRED',
  'EXPORT_APPROVAL_REQUIRED',
  'REQUEST_ID_REQUIRED',
  'SAME_NATURAL_PERSON_REVIEW',
  'SECOND_REVIEW_REQUIRED',
  'APPROVAL_NOT_FOUND',
  'APPROVAL_STATE_INVALID',
  'IDEMPOTENCY_KEY_CONFLICT',
  'IDEMPOTENCY_KEY_REQUIRED',
] as const);

export const SUPPLIER_PRODUCT_ERROR_CODES = Object.freeze([
  'APPAREL_HISTORY_REWRITE',
  'APPAREL_REQUIRED_FIELD_MISSING',
  'BUNDLE_SCHEMA_INVALID',
  'DIGITAL_HISTORY_REWRITE',
  'DIGITAL_MODEL_DUPLICATE',
  'DIGITAL_REQUIRED_FIELD_MISSING',
  'CATEGORY_DISABLED',
  'CATEGORY_DUPLICATE',
  'CATEGORY_LEVEL_INVALID',
  'CATEGORY_NOT_FOUND',
  'CATEGORY_NOT_LEAF',
  'CATEGORY_PARENT_INVALID',
  'CATEGORY_REFERENCED',
  'CATEGORY_TEMPLATE_INVALID',
  'DUPLICATE_CATALOG_RESOURCE',
  'PRICE_FIELD_FORBIDDEN',
  'PRICE_INVALID',
  'INITIAL_PRICE_REVIEW_PENDING',
  'INITIAL_PRICE_STATE_INVALID',
  'PRICE_CHANGE_PENDING',
  'PRICE_EFFECT_SCHEDULE_FAILED',
  'SUPPLY_PRICE_REVIEW_REQUIRED',
  'PRODUCT_APPROVAL_INCOMPLETE',
  'PRODUCT_NOT_FOUND',
  'PRODUCT_NOT_SALEABLE',
  'SUPPLIER_INACTIVE',
  'SUPPLIER_PRODUCT_DUPLICATE',
  'SUPPLIER_PRODUCT_NOT_FOUND',
  'SUPPLIER_SKU_DUPLICATE',
  'SELF_APPROVAL_FORBIDDEN',
  'SKU_DIMENSION_DUPLICATE',
  'FRESH_HISTORY_REWRITE',
  'FRESH_REQUIRED_FIELD_MISSING',
  'FRESH_WEIGHT_RULE_INVALID',
  'REGULATORY_WARNING_REQUIRED',
  'REGULATED_CATEGORY_DISABLED',
  'QUALIFICATION_REQUIRED',
  'TEMPLATE_DATA_INVALID',
  'TEMPLATE_DRAFT_EXISTS',
  'TEMPLATE_IMMUTABLE',
  'TEMPLATE_NOT_FOUND',
  'TEMPLATE_SCHEMA_INVALID',
  'TEMPLATE_VERSION_INACTIVE',
  'TEMPLATE_VERSION_IMMUTABLE',
] as const);

export const API_ERROR_CODES = Object.freeze([
  ...FOUNDATION_ERROR_CODES,
  ...SINGLE_MERCHANT_ERROR_CODES,
  ...SUPPLIER_ONBOARDING_ERROR_CODES,
  ...COMPANY_AUTH_ERROR_CODES,
  ...AUDIT_ERROR_CODES,
  ...SUPPLIER_PRODUCT_ERROR_CODES,
  ...CUSTOMER_CATALOG_ERROR_CODES,
  ...INVENTORY_ERROR_CODES,
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
