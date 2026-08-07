import type { OpenAPIObject } from '@nestjs/swagger';

type JsonObject = Record<string, unknown>;

interface M1OpenApiOperationContract {
  readonly actor: string;
  readonly contractId: string;
  readonly errorCodes: readonly string[];
  readonly idempotency: 'Idempotency-Key' | 'NONE' | 'requestId' | 'selectionNonce';
  readonly method: 'get' | 'patch' | 'post';
  readonly path: string;
  readonly requestDto: string;
  readonly responseDto: string;
}

const contract = (
  value: M1OpenApiOperationContract,
): M1OpenApiOperationContract => Object.freeze(value);

export const M1_OPENAPI_OPERATION_CONTRACTS = Object.freeze([
  contract({
    actor: 'COMPANY_USER',
    contractId: 'API-003',
    errorCodes: ['AUTH_INVALID', 'ACCOUNT_SUSPENDED', 'RATE_LIMITED'],
    idempotency: 'requestId',
    method: 'post',
    path: '/v1/company-auth/login',
    requestDto: 'CompanyLoginRequestDto',
    responseDto: 'WorkspaceChoiceResponseDto',
  }),
  contract({
    actor: 'COMPANY_USER',
    contractId: 'API-004',
    errorCodes: ['WORKSPACE_FORBIDDEN', 'SECOND_VERIFICATION_REQUIRED'],
    idempotency: 'selectionNonce',
    method: 'post',
    path: '/v1/company-auth/workspaces/{accountId}/select',
    requestDto: 'SelectWorkspaceRequestDto',
    responseDto: 'SessionResponseDto',
  }),
  contract({
    actor: 'SUPPLIER_USER',
    contractId: 'API-006',
    errorCodes: [
      'AUTH_INVALID',
      'SUPPLIER_NOT_ACTIVE',
      'ACCOUNT_SUSPENDED',
      'RATE_LIMITED',
    ],
    idempotency: 'requestId',
    method: 'post',
    path: '/v1/supplier-auth/login',
    requestDto: 'SupplierLoginRequestDto',
    responseDto: 'SupplierWorkspaceChoiceResponseDto',
  }),
  contract({
    actor: 'SUPPLIER_USER',
    contractId: 'API-007',
    errorCodes: [
      'WORKSPACE_FORBIDDEN',
      'SECOND_VERIFICATION_REQUIRED',
      'WORKSPACE_SESSION_CONFLICT',
    ],
    idempotency: 'selectionNonce',
    method: 'post',
    path: '/v1/supplier-auth/workspaces/{accountId}/select',
    requestDto: 'SupplierSelectWorkspaceRequestDto',
    responseDto: 'SupplierSessionResponseDto',
  }),
  contract({
    actor: 'COMPANY_FUNCTIONAL_ACCOUNT',
    contractId: 'API-082',
    errorCodes: [
      'AUTHENTICATION_REQUIRED',
      'AUTH_SESSION_REVOKED',
      'WORKSPACE_FORBIDDEN',
      'VALIDATION_FAILED',
    ],
    idempotency: 'NONE',
    method: 'get',
    path: '/v1/company-auth/workspace/current',
    requestDto: 'CompanyWorkspaceQueryDto',
    responseDto: 'CompanyWorkspaceResponseDto',
  }),
  contract({
    actor: 'COMPANY_FUNCTIONAL_ACCOUNT',
    contractId: 'API-083',
    errorCodes: [
      'AUTHENTICATION_REQUIRED',
      'AUTH_SESSION_REVOKED',
      'WORKSPACE_FORBIDDEN',
      'DATA_SCOPE_FORBIDDEN',
      'WORKSPACE_MODULE_NOT_FOUND',
      'VALIDATION_FAILED',
    ],
    idempotency: 'NONE',
    method: 'get',
    path: '/v1/company-auth/workspace/page',
    requestDto: 'CompanyWorkspacePageQueryDto',
    responseDto: 'CompanyWorkspacePageResponseDto',
  }),
  contract({
    actor: 'PUBLIC',
    contractId: 'API-005',
    errorCodes: [
      'SUPPLIER_DUPLICATE',
      'VALIDATION_FAILED',
      'FIELD_FORBIDDEN',
      'SINGLE_MERCHANT_VIOLATION',
      'IDEMPOTENCY_CONFLICT',
      'SERVICE_UNAVAILABLE',
    ],
    idempotency: 'Idempotency-Key',
    method: 'post',
    path: '/v1/suppliers/registrations',
    requestDto: 'SupplierRegistrationRequestDto',
    responseDto: 'SupplierRegistrationResponseDto',
  }),
  contract({
    actor: 'SUPPLIER_ACCOUNT_ADMIN',
    contractId: 'API-008',
    errorCodes: ['SUPPLIER_SCOPE_FORBIDDEN', 'AUTHENTICATION_REQUIRED'],
    idempotency: 'NONE',
    method: 'get',
    path: '/v1/supplier/me',
    requestDto: 'None',
    responseDto: 'SupplierProfileResponseDto',
  }),
  contract({
    actor: 'SUPPLIER_ACCOUNT_ADMIN',
    contractId: 'API-009',
    errorCodes: [
      'AUTHENTICATION_REQUIRED',
      'ACCESS_DENIED',
      'SUPPLIER_SCOPE_FORBIDDEN',
      'FIELD_FORBIDDEN',
      'STATE_TRANSITION_INVALID',
      'VERSION_CONFLICT',
      'RESOURCE_NOT_FOUND',
      'VALIDATION_FAILED',
      'IDEMPOTENCY_CONFLICT',
      'SECOND_VERIFICATION_REQUIRED',
    ],
    idempotency: 'Idempotency-Key',
    method: 'patch',
    path: '/v1/supplier/me',
    requestDto: 'SupplierProfilePatchRequestDto',
    responseDto: 'SupplierProfileResponseDto',
  }),
  contract({
    actor: 'SUPPLIER_ACCOUNT_ADMIN',
    contractId: 'API-010',
    errorCodes: [
      'AUTHENTICATION_REQUIRED',
      'ACCESS_DENIED',
      'SUPPLIER_SCOPE_FORBIDDEN',
      'VALIDATION_FAILED',
      'STATE_TRANSITION_INVALID',
      'VERSION_CONFLICT',
      'IDEMPOTENCY_CONFLICT',
    ],
    idempotency: 'Idempotency-Key',
    method: 'post',
    path: '/v1/supplier/me/submit-review',
    requestDto: 'SubmitReviewRequestDto',
    responseDto: 'ApprovalTaskResponseDto',
  }),
  contract({
    actor: 'COMPANY_SUPPLIER_OPS',
    contractId: 'API-011',
    errorCodes: [
      'AUTHENTICATION_REQUIRED',
      'ACCESS_DENIED',
      'VALIDATION_FAILED',
    ],
    idempotency: 'NONE',
    method: 'get',
    path: '/v1/company/suppliers',
    requestDto: 'SupplierQueryDto',
    responseDto: 'SupplierPageResponseDto',
  }),
  contract({
    actor: 'COMPANY_SUPPLIER_OPS',
    contractId: 'API-012',
    errorCodes: [
      'AUTHENTICATION_REQUIRED',
      'ACCESS_DENIED',
      'VALIDATION_FAILED',
      'STATE_TRANSITION_INVALID',
      'APPROVAL_VERSION_CONFLICT',
      'SECOND_VERIFICATION_REQUIRED',
      'IDEMPOTENCY_CONFLICT',
    ],
    idempotency: 'Idempotency-Key',
    method: 'post',
    path: '/v1/company/suppliers/{supplierId}/review',
    requestDto: 'SupplierReviewRequestDto',
    responseDto: 'SupplierResponseDto',
  }),
  contract({
    actor: 'OWNER_ACCOUNT_ADMIN',
    contractId: 'API-013',
    errorCodes: ['DATA_SCOPE_FORBIDDEN', 'WORKSPACE_FORBIDDEN'],
    idempotency: 'NONE',
    method: 'get',
    path: '/v1/{ownerType}/functional-accounts',
    requestDto: 'FunctionalAccountQueryDto',
    responseDto: 'FunctionalAccountPageResponseDto',
  }),
  contract({
    actor: 'OWNER_ACCOUNT_ADMIN',
    contractId: 'API-014',
    errorCodes: [
      'ACCOUNT_TYPE_INVALID',
      'SECOND_VERIFICATION_REQUIRED',
      'DATA_SCOPE_FORBIDDEN',
      'WORKSPACE_FORBIDDEN',
      'STATE_TRANSITION_INVALID',
      'IDEMPOTENCY_CONFLICT',
      'VALIDATION_FAILED',
    ],
    idempotency: 'Idempotency-Key',
    method: 'post',
    path: '/v1/{ownerType}/functional-accounts',
    requestDto: 'CreateFunctionalAccountRequestDto',
    responseDto: 'FunctionalAccountResponseDto',
  }),
  contract({
    actor: 'AUTHORIZED_AUDITOR',
    contractId: 'API-015',
    errorCodes: ['FIELD_FORBIDDEN', 'EXPORT_APPROVAL_REQUIRED'],
    idempotency: 'NONE',
    method: 'get',
    path: '/v1/audit/events',
    requestDto: 'AuditQueryDto',
    responseDto: 'AuditEventPageResponseDto',
  }),
]);

const forbiddenResponseFields = new Set([
  'approvedSupplyPrice',
  'grossMargin',
  'grossMarginRate',
  'supplierPayable',
  'supplierPayableAmount',
  'supplyPrice',
  'supplyPriceSnapshot',
]);

const asObject = (value: unknown, errorCode: string): JsonObject => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value as JsonObject;
};

const operationFor = (
  document: JsonObject,
  operationContract: M1OpenApiOperationContract,
): JsonObject => {
  const paths = asObject(document.paths, 'OPENAPI_PATHS_MISSING');
  const pathItem = asObject(
    paths[operationContract.path],
    `OPENAPI_OPERATION_MISSING:${operationContract.contractId}`,
  );
  return asObject(
    pathItem[operationContract.method],
    `OPENAPI_OPERATION_MISSING:${operationContract.contractId}`,
  );
};

const resolveSchema = (document: JsonObject, schema: unknown): JsonObject => {
  const value = asObject(schema, 'OPENAPI_RESPONSE_SCHEMA_MISSING');
  const reference = value.$ref;
  if (typeof reference !== 'string') return value;
  const prefix = '#/components/schemas/';
  if (!reference.startsWith(prefix)) {
    throw new Error(`OPENAPI_SCHEMA_REFERENCE_UNSUPPORTED:${reference}`);
  }
  const components = asObject(document.components, 'OPENAPI_COMPONENTS_MISSING');
  const schemas = asObject(components.schemas, 'OPENAPI_SCHEMAS_MISSING');
  return asObject(
    schemas[reference.slice(prefix.length)],
    `OPENAPI_SCHEMA_REFERENCE_MISSING:${reference}`,
  );
};

const collectForbiddenResponseFields = (
  document: JsonObject,
  schema: unknown,
  location: string,
  references = new Set<string>(),
): readonly string[] => {
  const value = asObject(schema, 'OPENAPI_RESPONSE_SCHEMA_MISSING');
  if (typeof value.$ref === 'string') {
    if (references.has(value.$ref)) return [];
    const nextReferences = new Set(references).add(value.$ref);
    return collectForbiddenResponseFields(
      document,
      resolveSchema(document, value),
      `${location}->${value.$ref}`,
      nextReferences,
    );
  }

  const findings = [];
  if (value.properties !== undefined) {
    const properties = asObject(value.properties, 'OPENAPI_PROPERTIES_INVALID');
    for (const [name, child] of Object.entries(properties)) {
      const childLocation = `${location}.properties.${name}`;
      if (forbiddenResponseFields.has(name)) findings.push(childLocation);
      findings.push(
        ...collectForbiddenResponseFields(document, child, childLocation, references),
      );
    }
  }
  if (value.items !== undefined) {
    findings.push(
      ...collectForbiddenResponseFields(
        document,
        value.items,
        `${location}.items`,
        references,
      ),
    );
  }
  for (const keyword of ['allOf', 'anyOf', 'oneOf']) {
    const members = value[keyword];
    if (!Array.isArray(members)) continue;
    for (const [index, member] of members.entries()) {
      findings.push(
        ...collectForbiddenResponseFields(
          document,
          member,
          `${location}.${keyword}[${index}]`,
          references,
        ),
      );
    }
  }
  return findings;
};

const successResponseSchemas = (operation: JsonObject): readonly unknown[] => {
  const responses = asObject(operation.responses, 'OPENAPI_RESPONSES_MISSING');
  return Object.entries(responses)
    .filter(([status]) => /^2\d\d$/u.test(status))
    .map(([, response]) => {
      const responseObject = asObject(response, 'OPENAPI_RESPONSE_INVALID');
      const content = asObject(responseObject.content, 'OPENAPI_RESPONSE_CONTENT_MISSING');
      const json = asObject(
        content['application/json'],
        'OPENAPI_JSON_RESPONSE_MISSING',
      );
      return json.schema;
    });
};

export const applyM1OpenApiContracts = (document: OpenAPIObject): OpenAPIObject => {
  const jsonDocument = document as unknown as JsonObject;
  const components = asObject(jsonDocument.components, 'OPENAPI_COMPONENTS_MISSING');
  const securitySchemes =
    components.securitySchemes === undefined
      ? {}
      : asObject(components.securitySchemes, 'OPENAPI_SECURITY_SCHEMES_INVALID');
  securitySchemes.functionalSession = {
    description:
      'Server-bound functional account session; clients cannot select owner scope',
    in: 'cookie',
    name: 'fulishe_session',
    type: 'apiKey',
  };
  securitySchemes.companyFunctionalSession = {
    description: 'Secure HttpOnly company functional account session',
    in: 'cookie',
    name: '__Host-fulishe-company-admin',
    type: 'apiKey',
  };
  components.securitySchemes = securitySchemes;

  for (const operationContract of M1_OPENAPI_OPERATION_CONTRACTS) {
    const operation = operationFor(jsonDocument, operationContract);
    operation.security =
      operationContract.actor === 'PUBLIC' ||
      operationContract.contractId === 'API-003' ||
      operationContract.contractId === 'API-004' ||
      operationContract.contractId === 'API-006' ||
      operationContract.contractId === 'API-007'
        ? []
        : [{ functionalSession: [] }];
    operation['x-fulishe-actor'] = operationContract.actor;
    operation['x-fulishe-contract-id'] = operationContract.contractId;
    operation['x-fulishe-error-codes'] = [...operationContract.errorCodes];
    operation['x-fulishe-idempotency'] = operationContract.idempotency;
    operation['x-fulishe-request-dto'] = operationContract.requestDto;
    operation['x-fulishe-response-dto'] = operationContract.responseDto;
    operation['x-fulishe-response-policy'] = 'NEVER_RETURN_INTERNAL_PRICING';
    if (
      operationContract.contractId === 'API-082' ||
      operationContract.contractId === 'API-083'
    ) {
      operation.security = [{ companyFunctionalSession: [] }];
    }
  }
  return document;
};

export const assertM1OpenApiContracts = (document: OpenAPIObject): void => {
  const jsonDocument = document as unknown as JsonObject;
  const components = asObject(jsonDocument.components, 'OPENAPI_COMPONENTS_MISSING');
  const schemas = asObject(components.schemas, 'OPENAPI_SCHEMAS_MISSING');
  const errorDto = asObject(schemas.ApiErrorResponseDto, 'OPENAPI_ERROR_DTO_MISSING');
  const errorProperties = asObject(
    errorDto.properties,
    'OPENAPI_ERROR_DTO_PROPERTIES_MISSING',
  );
  const errorCode = asObject(
    errorProperties.code,
    'OPENAPI_ERROR_CODE_SCHEMA_MISSING',
  );
  if (!Array.isArray(errorCode.enum)) throw new Error('OPENAPI_ERROR_CODE_ENUM_MISSING');

  for (const operationContract of M1_OPENAPI_OPERATION_CONTRACTS) {
    const operation = operationFor(jsonDocument, operationContract);
    for (const code of operationContract.errorCodes) {
      if (!errorCode.enum.includes(code)) {
        throw new Error(`OPENAPI_ERROR_CODE_UNKNOWN:${operationContract.contractId}:${code}`);
      }
    }

    const successSchemas = successResponseSchemas(operation);
    if (successSchemas.length !== 1) {
      throw new Error(
        `OPENAPI_SUCCESS_RESPONSE_INVALID:${operationContract.contractId}`,
      );
    }
    const findings = collectForbiddenResponseFields(
      jsonDocument,
      successSchemas[0],
      `${operationContract.contractId}.response`,
    );
    if (findings.length > 0) {
      throw new Error(
        `PUBLIC_RESPONSE_FIELD_FORBIDDEN:${operationContract.contractId}:${findings.join(',')}`,
      );
    }
  }
};
