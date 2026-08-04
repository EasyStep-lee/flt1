import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executionPackRoot = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
);
const outputPath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M1-000',
  'm1-contract-freeze.json',
);

const ledgerPaths = {
  tasks: '03-任务台账.csv',
  p0: '04-P0-1至P0-119验收矩阵.csv',
  fields: '05-字段字典初始版.csv',
  states: '06-状态机总表.csv',
  permissions: '07-权限与数据可见矩阵.csv',
  pages: '08-页面路由接口P0映射.csv',
  dependencies: '09-外部依赖与人工事项.csv',
  migrations: '11-数据库迁移台账.csv',
  apis: '12-OpenAPI-DTO-错误码台账.csv',
};

const m1P0Ids = [
  'P0-001',
  'P0-002',
  'P0-003',
  'P0-004',
  'P0-005',
  'P0-045',
  'P0-046',
  'P0-047',
  'P0-066',
  'P0-067',
  'P0-068',
  'P0-069',
  'P0-070',
  'P0-072',
];
const m1P0Set = new Set(m1P0Ids);

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(current);
  return values;
};

const canonicalizeRepositoryText = (value) => value.replace(/\r\n?/gu, '\n');

const readCsv = async (relativePath) => {
  const content = canonicalizeRepositoryText(
    await readFile(path.join(executionPackRoot, relativePath), 'utf8'),
  );
  const lines = content.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return {
    content,
    rows: lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      return Object.fromEntries(
        header.map((column, index) => [column, values[index] ?? '']),
      );
    }),
  };
};

const splitCodes = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const onlyM1P0 = (value) => splitCodes(value).filter((p0Id) => m1P0Set.has(p0Id));

const union = (...groups) => [...new Set(groups.flat())];

const entityP0 = {
  Company: ['P0-001', 'P0-002'],
  CompanyUser: ['P0-066', 'P0-067', 'P0-068', 'P0-072'],
  FunctionalAccountType: ['P0-005', 'P0-067', 'P0-070'],
  FunctionalAccount: ['P0-005', 'P0-066', 'P0-067', 'P0-069', 'P0-070', 'P0-072'],
  Permission: ['P0-004', 'P0-005', 'P0-046', 'P0-047', 'P0-067', 'P0-070', 'P0-072'],
  FunctionalAccountPermission: [
    'P0-004',
    'P0-005',
    'P0-046',
    'P0-047',
    'P0-067',
    'P0-070',
    'P0-072',
  ],
  DataScopePolicy: ['P0-004', 'P0-046', 'P0-067', 'P0-070'],
  FieldAccessPolicy: ['P0-046', 'P0-047', 'P0-067', 'P0-070', 'P0-072'],
  AuthSession: ['P0-004', 'P0-046', 'P0-066', 'P0-067', 'P0-069', 'P0-070', 'P0-072'],
  LoginAudit: ['P0-045', 'P0-066', 'P0-069', 'P0-072'],
  Supplier: ['P0-003', 'P0-004'],
  SupplierUser: ['P0-004', 'P0-005', 'P0-069', 'P0-070', 'P0-072'],
  ApprovalTask: ['P0-003', 'P0-045', 'P0-072'],
  AuditLog: ['P0-045', 'P0-072'],
};

const enumValues = {
  'Company.status': ['ACTIVE', 'SUSPENDED'],
  'CompanyUser.status': ['INVITED', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'REVOKED'],
  'SupplierUser.status': ['INVITED', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'REVOKED'],
  'FunctionalAccountType.ownerType': ['COMPANY', 'SUPPLIER'],
  'FunctionalAccountType.status': ['ACTIVE', 'DISABLED'],
  'FunctionalAccount.identityType': ['COMPANY_USER', 'SUPPLIER_USER'],
  'FunctionalAccount.ownerType': ['COMPANY', 'SUPPLIER'],
  'FunctionalAccount.status': [
    'PENDING_ACTIVATION',
    'ACTIVE',
    'SUSPENDED',
    'REVOKED',
  ],
  'Permission.action': [
    'READ',
    'CREATE',
    'UPDATE',
    'SUBMIT',
    'APPROVE',
    'REJECT',
    'EXPORT',
    'REVEAL',
    'MANAGE',
    'REVOKE',
  ],
  'FunctionalAccountPermission.effect': ['ALLOW', 'DENY'],
  'DataScopePolicy.scopeType': ['COMPANY', 'SUPPLIER', 'SELF', 'RESOURCE_SET'],
  'FieldAccessPolicy.accessMode': [
    'HIDDEN',
    'MASKED',
    'VISIBLE',
    'VISIBLE_WITH_AUDIT',
    'APPROVED_EXPORT_ONLY',
  ],
  'AuthSession.userType': ['COMPANY_USER', 'SUPPLIER_USER'],
  'LoginAudit.userType': ['COMPANY_USER', 'SUPPLIER_USER', 'UNKNOWN'],
  'LoginAudit.result': [
    'SUCCESS',
    'AUTH_INVALID',
    'ACCOUNT_SUSPENDED',
    'RATE_LIMITED',
    'SECOND_VERIFICATION_REQUIRED',
  ],
  'Supplier.status': [
    'DRAFT',
    'PENDING_REVIEW',
    'CORRECTION_REQUIRED',
    'ACTIVE',
    'SUSPENDED',
    'EXITING',
    'EXITED',
  ],
  'ApprovalTask.approvalType': [
    'SUPPLIER_ONBOARDING',
    'FUNCTIONAL_ACCOUNT_CHANGE',
    'SENSITIVE_EXPORT',
    'SUPPLIER_SENSITIVE_CHANGE',
  ],
  'ApprovalTask.objectType': ['SUPPLIER', 'FUNCTIONAL_ACCOUNT', 'EXPORT_JOB'],
  'ApprovalTask.applicantType': ['COMPANY_USER', 'SUPPLIER_USER'],
  'ApprovalTask.status': ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  'ApprovalTask.assignedAccountTypeCode': [
    'COMPANY_SUPPLIER_OPS',
    'COMPANY_SUPER_ADMIN',
    'COMPANY_AUDIT',
    'SUPPLIER_ACCOUNT_ADMIN',
  ],
  'AuditLog.actorType': ['COMPANY_USER', 'SUPPLIER_USER', 'SYSTEM'],
};

const typeOverrides = {
  'LoginAudit.loginAccountHash': 'String(64)',
  'Supplier.pickupLat': 'Decimal(10,7)',
  'Supplier.pickupLng': 'Decimal(10,7)',
  'Supplier.settlementAccountMasked': 'String(128)',
};

const normalizeType = (row) => {
  const key = `${row.Entity}.${row.Field}`;
  if (typeOverrides[key]) return typeOverrides[key];
  if (enumValues[key]) return `Enum<${enumValues[key].join('|')}>`;
  const mappings = {
    'String/UUID': 'UUID',
    'Enum/String': 'Enum<StringCode>',
    String: 'String',
    DateTime: 'DateTime',
    Int: 'Int',
    Json: 'Json',
    Decimal: 'Decimal',
  };
  return mappings[row.SuggestedType] ?? row.SuggestedType;
};

const fieldFormat = (row, type) => {
  const key = `${row.Entity}.${row.Field}`;
  if (enumValues[key]) return enumValues[key].join('|');
  if (
    key === 'FunctionalAccount.identityId' ||
    key === 'ApprovalTask.applicantId' ||
    key === 'ApprovalTask.reviewedBy'
  ) {
    return 'natural identity UUID; separation key is identityType+identityId';
  }
  if (key === 'Company.legalName') return 'fixed value: 江苏福礼团供应链科技有限公司';
  if (key === 'Company.platformName') return 'fixed value: 福礼社';
  if (key === 'Company.wechatPayConfigRef') {
    return 'secret-manager reference id; 1..255 chars; never a credential value';
  }
  if (key === 'Supplier.creditCode') return '18 uppercase unified-social-credit-code chars';
  if (key === 'Supplier.pickupLat') return '-90.0000000..90.0000000; scale 7';
  if (key === 'Supplier.pickupLng') return '-180.0000000..180.0000000; scale 7';
  if (key === 'Supplier.settlementAccountMasked') {
    return 'masked account label only; 4..128 chars; full account forbidden';
  }
  if (row.Field === 'mobile') return 'E.164; 8..15 digits after optional leading +';
  if (row.Field === 'email') return 'RFC 5322-compatible address; max 254 chars';
  if (row.Field === 'ip') return 'IPv4 or IPv6 text; max 45 chars';
  if (row.Field.endsWith('Hash')) return 'lowercase SHA-256 hex; 64 chars';
  if (row.Field === 'workspaceRoute') return 'absolute route from server allowlist';
  if (row.Field === 'version') return 'integer >= 0; optimistic-lock token';
  if (row.Field === 'riskLevel') return 'integer 0..3';
  if (row.Field === 'reviewOpinion') return '1..1000 UTF-8 chars when required by decision';
  if (row.Field === 'pickupAddress') return '1..500 UTF-8 chars';
  if (row.Field === 'creditCode') return '18 uppercase alphanumeric chars';
  if (row.Field.endsWith('At') || type === 'DateTime') return 'ISO-8601 UTC timestamp';
  if (type === 'UUID') return 'UUID v4 canonical lowercase text';
  if (type === 'Json') return `${row.Entity}${row.Field[0].toUpperCase()}${row.Field.slice(1)}SchemaV1`;
  if (row.Field === 'code' || row.Field.endsWith('Code')) {
    return 'uppercase stable code; ^[A-Z][A-Z0-9_]{1,63}$';
  }
  if (['resource', 'fieldGroup', 'action'].includes(row.Field)) {
    return 'stable lowercase code; ^[a-z][a-z0-9_.:-]{1,127}$';
  }
  if (type.startsWith('String')) return 'UTF-8; 1..128 chars unless a narrower rule applies';
  return 'schema-constrained scalar';
};

const fieldValidation = (row) => {
  const key = `${row.Entity}.${row.Field}`;
  const rules = {
    'Company.id': 'exactly one Company row may exist; id is server-generated',
    'Company.legalName': 'must equal the frozen legal entity name',
    'Company.platformName': 'must equal 福礼社',
    'Company.wechatPayConfigRef': 'reference existence is checked server-side; secret value never persists here',
    'CompanyUser.companyId': 'server binds the unique Company; request body cannot override it',
    'FunctionalAccount.companyId': 'required iff ownerType=COMPANY and mutually exclusive with supplierId',
    'FunctionalAccount.supplierId': 'required iff ownerType=SUPPLIER and mutually exclusive with companyId',
    'FunctionalAccount.identityId': 'server resolves natural identity; client cannot choose an arbitrary identity',
    'FunctionalAccount.accountTypeId': 'account type ownerType must match the functional account ownerType',
    'FunctionalAccount.status': 'only the frozen FunctionalAccount state machine may change it',
    'FunctionalAccountPermission.effect': 'DENY overrides ALLOW; duplicate account-permission rows are forbidden',
    'DataScopePolicy.scopeRules': 'JSON is validated by scopeType; supplier scope cannot contain another supplierId',
    'FieldAccessPolicy.accessMode': 'default is HIDDEN; visible sensitive reads require an explicit allow rule',
    'AuthSession.functionalAccountId': 'exactly one active functional account per session',
    'AuthSession.workspaceRoute': 'must equal the selected FunctionalAccountType.workspaceRoute',
    'AuthSession.sessionHash': 'only the hash is stored; raw session token is never logged or returned',
    'Supplier.companyId': 'server always binds the unique Company',
    'Supplier.creditCode': 'normalized credit code is unique across Supplier rows',
    'Supplier.status': 'only the frozen Supplier state machine may change it',
    'SupplierUser.supplierId': 'written only by approved invitation or onboarding activation; login input cannot override it',
    'ApprovalTask.applicantId': 'copied from the authenticated natural identity and cannot be supplied by the client',
    'ApprovalTask.reviewedBy': 'copied from reviewer natural identity and must differ from applicantId when dual review applies',
    'ApprovalTask.version': 'review update must affect exactly one matching version',
    'AuditLog.actorId': 'copied from authenticated natural identity or the fixed SYSTEM identity',
    'AuditLog.beforeSnapshot': 'sensitive values are masked or omitted before append-only persistence',
    'AuditLog.afterSnapshot': 'sensitive values are masked or omitted before append-only persistence',
  };
  return (
    rules[key] ??
    'server validates type, ownership, state and length; client-derived ownership and authorization are never trusted'
  );
};

const negativeCases = {
  'P0-001': [
    ['SELLER_TAMPER', 'Request or seed data names a supplier as customer seller', 'Reject or ignore the value; customer counterparty remains Company', 'SELLER_IDENTITY_FORBIDDEN'],
    ['SUPPLIER_DIRECT_PAYMENT', 'A supplier payment account is attached to customer checkout', 'Reject without creating a payment path', 'PAYEE_FORBIDDEN'],
    ['MULTI_MERCHANT_CONFIG', 'A second customer-facing merchant Company is created', 'Unique invariant rejects the write', 'SINGLE_MERCHANT_VIOLATION'],
  ],
  'P0-002': [
    ['FRANCHISEE_ROUTE', 'A franchisee registration or admin route is introduced', 'Contract scan fails', 'FORBIDDEN_CAPABILITY'],
    ['REGIONAL_REVENUE_SHARE', 'A regional split-settlement capability is introduced', 'Contract scan fails', 'FORBIDDEN_CAPABILITY'],
    ['FRANCHISEE_ENTITY', 'A Franchisee or RegionalMerchant entity is introduced', 'Schema guard fails', 'FORBIDDEN_ENTITY'],
  ],
  'P0-003': [
    ['DUPLICATE_SUBJECT', 'The same normalized credit code is submitted twice', 'Return conflict and preserve the first application', 'SUPPLIER_DUPLICATE'],
    ['INVALID_TRANSITION', 'A DRAFT supplier is approved without submission', 'Return 409 and keep DRAFT', 'STATE_TRANSITION_INVALID'],
    ['IDEMPOTENCY', 'The same registration idempotency key is replayed with the same body', 'Return the original result without a second supplier', 'IDEMPOTENCY_REPLAY'],
    ['QUALIFICATION_INCOMPLETE', 'Required qualification or pickup data is missing at submit', 'Return validation details and keep the draft editable', 'VALIDATION_FAILED'],
  ],
  'P0-004': [
    ['OBJECT_SCOPE', 'Supplier A requests Supplier B object by id', 'Return scope-forbidden without object data', 'SUPPLIER_SCOPE_FORBIDDEN'],
    ['SERVER_BOUND_SUPPLIER', 'Client supplies or alters supplierId during login or mutation', 'Ignore or reject the client value and use session-bound supplierId', 'SUPPLIER_SCOPE_FORBIDDEN'],
    ['CROSS_SUPPLIER_EXPORT', 'Supplier A requests an export containing Supplier B rows', 'Reject before export creation', 'DATA_SCOPE_FORBIDDEN'],
    ['NOT_FOUND_ORACLE', 'Cross-supplier id is probed to distinguish existing and missing objects', 'Return a non-enumerating scope-safe response', 'SUPPLIER_SCOPE_FORBIDDEN'],
  ],
  'P0-005': [
    ['CROSS_WORKSPACE', 'Account-admin session calls a pricing or inventory operation', 'Return 403 with no state change', 'WORKSPACE_FORBIDDEN'],
    ['SELF_PRIVILEGE_ESCALATION', 'A functional account grants itself a higher account type', 'Reject and append a security audit event', 'ACCOUNT_TYPE_INVALID'],
    ['LAST_ADMIN_SUSPEND', 'The final active owner account admin is suspended', 'Reject and keep the account active', 'STATE_TRANSITION_INVALID'],
    ['SECOND_VERIFICATION', 'Sensitive account change lacks second verification', 'Return precondition-required without mutation', 'SECOND_VERIFICATION_REQUIRED'],
  ],
  'P0-045': [
    ['AUDIT_OMISSION', 'A sensitive operation succeeds without an AuditLog append', 'Transaction fails or the contract test fails', 'AUDIT_REQUIRED'],
    ['SNAPSHOT_OVERWRITE', 'Existing audit before/after snapshots are updated', 'Reject the write; audit history remains append-only', 'AUDIT_IMMUTABLE'],
    ['ACTOR_SPOOF', 'Client supplies actorId or applicantId', 'Ignore or reject it and bind the authenticated identity', 'ACTOR_SPOOFED'],
    ['REQUEST_CORRELATION', 'Sensitive operation has no requestId correlation', 'Reject or fail the audit completeness assertion', 'REQUEST_ID_REQUIRED'],
  ],
  'P0-046': [
    ['FIELD_SCOPE', 'Unauthorized role requests a sensitive field group', 'Return FIELD_FORBIDDEN and omit the field', 'FIELD_FORBIDDEN'],
    ['CROSS_ROLE', 'A valid account reuses a different workspace API', 'Return WORKSPACE_FORBIDDEN before resource lookup', 'WORKSPACE_FORBIDDEN'],
    ['PUBLIC_DTO', 'A public or customer DTO includes supply-price or payable data', 'Response-whitelist test fails', 'FIELD_FORBIDDEN'],
    ['EXPORT_APPROVAL', 'High-sensitivity export is downloaded without approval', 'Return approval-required and no file', 'EXPORT_APPROVAL_REQUIRED'],
  ],
  'P0-047': [
    ['RESPONSE_WHITELIST', 'Generated or runtime public response includes a forbidden internal field', 'Contract generation or Supertest whitelist fails', 'FIELD_FORBIDDEN'],
    ['DETERMINISTIC_OPENAPI', 'Two OpenAPI generations differ byte-for-byte', 'Generation check fails', 'OPENAPI_NON_DETERMINISTIC'],
    ['OASDIFF_BREAKING', 'A breaking contract change is introduced without baseline process', 'Locked oasdiff gate fails', 'OPENAPI_BREAKING_CHANGE'],
    ['MINIAPP_TRANSPORT', 'A mini-program bypasses miniapp-kit and calls wx.request directly', 'Transport-boundary test fails', 'MINIAPP_TRANSPORT_BYPASS'],
  ],
  'P0-066': [
    ['PUBLIC_COMPANY_REGISTRATION', 'Company admin exposes public self-registration', 'Route and API contract scan fails', 'FORBIDDEN_CAPABILITY'],
    ['MULTI_ACCOUNT_AUTO_ENTRY', 'A multi-account identity is sent directly to a workspace', 'Require account selection before session issuance', 'WORKSPACE_SELECTION_REQUIRED'],
    ['MULTI_SESSION', 'One session activates two functionalAccountIds', 'Reject the second activation or revoke the old context', 'WORKSPACE_SESSION_CONFLICT'],
    ['ACCOUNT_DISABLED', 'Disabled account is selected', 'Return WORKSPACE_FORBIDDEN without a business session', 'WORKSPACE_FORBIDDEN'],
  ],
  'P0-067': [
    ['ROUTE_DEEP_LINK', 'Company account manually opens another role route', 'Return permission-denied and load no foreign data', 'WORKSPACE_FORBIDDEN'],
    ['MENU_LEAKAGE', 'A workspace menu includes another role module', 'Page contract test fails', 'WORKSPACE_MENU_VIOLATION'],
    ['API_ROLE_MISMATCH', 'A role calls an endpoint outside its permission set', 'Return 403 before object lookup', 'WORKSPACE_FORBIDDEN'],
    ['SESSION_REUSE', 'A session cookie is reused after role switching', 'Old session is revoked and the call is unauthenticated', 'AUTH_SESSION_REVOKED'],
  ],
  'P0-068': [
    ['MISSING_UI_STATE', 'A company workspace omits loading, empty, error or denied state', 'Page acceptance contract fails', 'PAGE_STATE_INCOMPLETE'],
    ['SHARED_CONTEXT', 'Two role pages share active menu or query context', 'Isolation test fails', 'WORKSPACE_CONTEXT_LEAK'],
    ['ERROR_SECRET_LEAK', 'Error state renders token, supplier price or internal stack data', 'Redaction test fails', 'SENSITIVE_FIELD_LEAK'],
  ],
  'P0-069': [
    ['SUPPLIER_ID_TAMPER', 'Login or account-selection request carries another supplierId', 'Ignore or reject the value; bind server-side ownership', 'SUPPLIER_SCOPE_FORBIDDEN'],
    ['REGISTRATION_LOGIN_CONFLATION', 'Unapproved application receives a normal supplier business session', 'Return progress-only state without workspace access', 'SUPPLIER_NOT_ACTIVE'],
    ['MULTI_ACCOUNT_AUTO_ENTRY', 'Multi-role supplier identity bypasses account selection', 'Require account selection', 'WORKSPACE_SELECTION_REQUIRED'],
    ['INACTIVE_SUPPLIER_LOGIN', 'Suspended or exited supplier attempts business login', 'Deny session issuance', 'SUPPLIER_NOT_ACTIVE'],
  ],
  'P0-070': [
    ['CROSS_WORKSPACE', 'Supplier role opens another role route or API', 'Return 403 and load no foreign module data', 'WORKSPACE_FORBIDDEN'],
    ['CROSS_SUPPLIER', 'Supplier role requests another supplier object', 'Return scope-forbidden before lookup result', 'SUPPLIER_SCOPE_FORBIDDEN'],
    ['COMBINED_ROLE_PAGE', 'Multiple supplier role menus are merged into one workspace', 'Page contract test fails', 'WORKSPACE_MENU_VIOLATION'],
    ['SESSION_REUSE', 'Old supplier role session is reused after switching roles', 'Old session is revoked', 'AUTH_SESSION_REVOKED'],
  ],
  'P0-072': [
    ['NATURAL_IDENTITY_SEPARATION', 'Same identityType+identityId applies and reviews through two accounts', 'Reject review with no state change', 'SAME_NATURAL_PERSON_REVIEW'],
    ['SUPER_ADMIN_BYPASS', 'Super admin attempts to bypass required second-person review', 'Reject exactly as for other roles', 'SECOND_REVIEW_REQUIRED'],
    ['CONCURRENT_REVIEW', 'Two reviewers approve the same version concurrently', 'Exactly one update succeeds; the other gets conflict', 'APPROVAL_VERSION_CONFLICT'],
    ['AUDIT_COMPLETENESS', 'Login, account selection, sensitive reveal, export or session revocation lacks audit', 'Contract test fails or transaction is rejected', 'AUDIT_REQUIRED'],
  ],
};

const sliceRefs = {
  'P0-001': { fields: ['Company.*'], states: [], roles: ['COMPANY_SUPER_ADMIN'], pages: [], apis: [], policies: ['SINGLE_MERCHANT'] },
  'P0-002': { fields: ['Company.*'], states: [], roles: [], pages: [], apis: [], policies: ['NO_FRANCHISEE_CAPABILITIES'] },
  'P0-003': { fields: ['Supplier.*', 'ApprovalTask.*'], states: ['Supplier'], roles: ['COMPANY_SUPPLIER_OPS', 'SUPPLIER_ACCOUNT_ADMIN'], pages: ['PAGE-004', 'PAGE-013'], apis: ['API-005', 'API-009', 'API-010', 'API-011', 'API-012'], policies: ['SUPPLIER_ONBOARDING'] },
  'P0-004': { fields: ['Supplier.*', 'SupplierUser.*', 'DataScopePolicy.*'], states: [], roles: ['SUPPLIER_ACCOUNT_ADMIN', 'SUPPLIER_AUDIT'], pages: [], apis: ['API-008', 'API-011'], policies: ['SERVER_BOUND_SUPPLIER_SCOPE'] },
  'P0-005': { fields: ['FunctionalAccountType.*', 'FunctionalAccount.*', 'SupplierUser.*'], states: ['FunctionalAccount'], roles: ['SUPPLIER_ACCOUNT_ADMIN'], pages: ['PAGE-016', 'PAGE-024'], apis: ['API-008', 'API-009', 'API-013', 'API-014'], policies: ['FIXED_FUNCTIONAL_ACCOUNT'] },
  'P0-045': { fields: ['AuditLog.*', 'ApprovalTask.*'], states: ['ApprovalTask'], roles: ['COMPANY_AUDIT'], pages: ['PAGE-012'], apis: ['API-015'], policies: ['APPEND_ONLY_AUDIT'] },
  'P0-046': { fields: ['DataScopePolicy.*', 'FieldAccessPolicy.*'], states: [], roles: ['COMPANY_AUDIT'], pages: [], apis: [], policies: ['FIELD_MINIMIZATION', 'SUPPLY_PRICE_CONFIDENTIALITY'] },
  'P0-047': { fields: ['FieldAccessPolicy.*'], states: [], roles: [], pages: [], apis: ['API-003..API-015'], policies: ['DTO_ALLOWLIST', 'DETERMINISTIC_OPENAPI', 'MINIAPP_KIT_ONLY'] },
  'P0-066': { fields: ['CompanyUser.*', 'AuthSession.*', 'FunctionalAccount.*'], states: [], roles: ['COMPANY_SUPER_ADMIN'], pages: ['PAGE-001', 'PAGE-002'], apis: ['API-003', 'API-004'], policies: ['NO_PUBLIC_COMPANY_REGISTRATION', 'SINGLE_ACTIVE_WORKSPACE'] },
  'P0-067': { fields: ['FunctionalAccountType.*', 'FunctionalAccount.*', 'AuthSession.*'], states: ['FunctionalAccount'], roles: ['COMPANY_*'], pages: ['PAGE-003..PAGE-012'], apis: ['API-004', 'API-013', 'API-014'], policies: ['COMPANY_FIXED_WORKSPACES'] },
  'P0-068': { fields: ['FunctionalAccountType.internalMenuSchema'], states: [], roles: ['COMPANY_*'], pages: ['PAGE-003..PAGE-012'], apis: [], policies: ['WORKSPACE_UI_STATE_COMPLETENESS'] },
  'P0-069': { fields: ['Supplier.*', 'SupplierUser.*', 'AuthSession.*'], states: ['Supplier'], roles: ['SUPPLIER_ACCOUNT_ADMIN'], pages: ['PAGE-013', 'PAGE-014', 'PAGE-015'], apis: ['API-005', 'API-006', 'API-007'], policies: ['SERVER_BOUND_SUPPLIER_SCOPE', 'SINGLE_ACTIVE_WORKSPACE'] },
  'P0-070': { fields: ['FunctionalAccountType.*', 'FunctionalAccount.*', 'SupplierUser.*'], states: ['FunctionalAccount'], roles: ['SUPPLIER_*'], pages: ['PAGE-016..PAGE-024'], apis: ['API-007', 'API-013', 'API-014'], policies: ['SUPPLIER_FIXED_WORKSPACES'] },
  'P0-072': { fields: ['ApprovalTask.*', 'AuditLog.*', 'FunctionalAccount.*'], states: ['ApprovalTask', 'FunctionalAccount'], roles: ['COMPANY_SUPER_ADMIN', 'COMPANY_AUDIT', 'SUPPLIER_AUDIT'], pages: ['PAGE-012', 'PAGE-023'], apis: ['API-015'], policies: ['NATURAL_IDENTITY_MAKER_CHECKER', 'NO_SUPER_ADMIN_BYPASS'] },
};

const dtoSchemas = {
  CompanyLoginRequest: {
    fields: ['loginAccount:string', 'password:string(writeOnly)', 'verificationCode?:string(writeOnly)', 'requestId:uuid'],
    ownershipInputsForbidden: ['companyId', 'functionalAccountId', 'workspaceRoute'],
  },
  SupplierLoginRequest: {
    fields: ['loginAccount:string', 'password:string(writeOnly)', 'verificationCode?:string(writeOnly)', 'requestId:uuid'],
    ownershipInputsForbidden: ['supplierId', 'functionalAccountId', 'workspaceRoute'],
  },
  WorkspaceChoiceResponse: {
    fields: ['selectionRequired:boolean', 'selectionNonce:string', 'accounts:WorkspaceChoice[]'],
    accountFields: ['accountId', 'ownerType', 'ownerDisplayName', 'accountTypeCode', 'accountTypeName', 'workspaceRoute', 'status', 'lastUsedAt?'],
  },
  SelectWorkspaceRequest: {
    fields: ['selectionNonce:string', 'secondVerificationCode?:string(writeOnly)'],
    pathBoundField: 'accountId',
  },
  SessionResponse: {
    fields: ['functionalAccountId', 'ownerType', 'companyId?', 'supplierId?', 'accountTypeCode', 'workspaceRoute', 'expiresAt'],
    tokenDelivery: 'Secure HttpOnly SameSite cookie; no raw token in JSON',
  },
  SupplierRegistrationRequest: {
    fields: ['legalName', 'creditCode', 'contactName', 'mobile', 'email?', 'verificationCode(writeOnly)', 'qualificationFiles[]', 'pickupAddress', 'pickupLat', 'pickupLng', 'agreementVersion'],
    ownershipInputsForbidden: ['companyId', 'supplierId', 'status'],
  },
  SupplierRegistrationResponse: {
    fields: ['registrationId', 'status', 'nextAction', 'submittedAt?'],
  },
  SupplierProfilePatchRequest: {
    fields: ['version', 'pickupAddress?', 'pickupLat?', 'pickupLng?', 'qualificationSnapshot?', 'settlementAccountChangeRequest?'],
    serverControlledFields: ['id', 'companyId', 'creditCode', 'status', 'settlementAccountMasked'],
  },
  SupplierProfileResponse: {
    fields: ['id', 'legalName', 'creditCodeMasked', 'status', 'pickupAddress', 'pickupLat', 'pickupLng', 'settlementAccountMasked', 'qualificationSummary', 'version'],
  },
  SubmitReviewRequest: { fields: ['version', 'requestId'] },
  SupplierReviewRequest: {
    fields: ['decision:REQUEST_CORRECTION|APPROVE', 'version', 'opinion', 'secondVerificationCode?'],
  },
  ApprovalTaskResponse: {
    fields: ['id', 'approvalType', 'objectType', 'objectId', 'status', 'assignedAccountTypeCode', 'reviewOpinion?', 'version'],
    identityFieldsReturned: false,
  },
  SupplierQuery: { fields: ['status?', 'keyword?', 'page:integer>=1', 'pageSize:integer 1..100'] },
  SupplierPageResponse: { fields: ['items:SupplierSummary[]', 'page', 'pageSize', 'total'] },
  SupplierResponse: { fields: ['id', 'legalName', 'creditCodeMasked', 'status', 'qualificationSummary', 'version'] },
  AccountQuery: { fields: ['accountTypeCode?', 'status?', 'keyword?', 'page', 'pageSize'] },
  CreateFunctionalAccountRequest: {
    fields: ['accountTypeCode', 'inviteeName', 'inviteeMobile', 'inviteeEmail?', 'expiresAt?', 'secondVerificationCode?'],
    ownershipInputsForbidden: ['identityId', 'companyId', 'supplierId', 'ownerType', 'workspaceRoute'],
  },
  FunctionalAccountResponse: {
    fields: ['id', 'displayName', 'accountTypeCode', 'accountTypeName', 'workspaceRoute', 'status', 'expiresAt?', 'lastLoginAt?'],
  },
  FunctionalAccountPageResponse: {
    fields: ['items:FunctionalAccountResponse[]', 'page', 'pageSize', 'total'],
  },
  AuditQuery: { fields: ['actorType?', 'action?', 'objectType?', 'objectId?', 'occurredFrom?', 'occurredTo?', 'page', 'pageSize'] },
  AuditEventPageResponse: {
    fields: ['items:MaskedAuditEvent[]', 'page', 'pageSize', 'total'],
    rawSensitiveSnapshotsReturned: false,
  },
};

const errorHttpStatus = {
  AUTH_INVALID: 401,
  ACCOUNT_SUSPENDED: 403,
  RATE_LIMITED: 429,
  WORKSPACE_FORBIDDEN: 403,
  SECOND_VERIFICATION_REQUIRED: 428,
  SUPPLIER_DUPLICATE: 409,
  VALIDATION_FAILED: 422,
  SUPPLIER_NOT_ACTIVE: 403,
  SUPPLIER_SCOPE_FORBIDDEN: 403,
  VERSION_CONFLICT: 409,
  STATE_TRANSITION_INVALID: 409,
  FIELD_FORBIDDEN: 403,
  APPROVAL_VERSION_CONFLICT: 409,
  DATA_SCOPE_FORBIDDEN: 403,
  ACCOUNT_TYPE_INVALID: 422,
  EXPORT_APPROVAL_REQUIRED: 428,
};

const main = async () => {
  const ledgers = Object.fromEntries(
    await Promise.all(
      Object.entries(ledgerPaths).map(async ([key, relativePath]) => [
        key,
        await readCsv(relativePath),
      ]),
    ),
  );

  const m1Fields = ledgers.fields.rows.filter(({ Stage }) => Stage === 'M1');
  const entityOrder = [...new Set(m1Fields.map(({ Entity }) => Entity))];
  const entities = entityOrder.map((entity) => ({
    entity,
    p0Ids: entityP0[entity],
    fields: m1Fields
      .filter(({ Entity }) => Entity === entity)
      .map((row) => {
        const type = normalizeType(row);
        return {
          name: row.Field,
          type,
          required: row.Required === 'YES',
          format: fieldFormat(row, type),
          sensitivity:
            `${row.Entity}.${row.Field}` === 'Company.platformName' ||
            `${row.Entity}.${row.Field}` === 'Company.legalName'
              ? 'PUBLIC'
              : row.Sensitivity,
          validation: fieldValidation(row),
          visibility: row.Visibility,
          forbiddenExposure: row.ForbiddenExposure,
          historyRule: row.HistoryRule,
          p0Ids: union(onlyM1P0(row.P0), entityP0[entity]),
          sourceStatus: row.Status,
          freezeStatus: 'FROZEN_M1_000',
        };
      }),
  }));

  const m1States = ledgers.states.rows.filter(({ Stage }) => Stage === 'M1');
  const roleRows = ledgers.permissions.rows.filter(({ P0 }) => /P0-067|P0-070/u.test(P0));
  const pageRows = ledgers.pages.rows.filter(({ P0 }) =>
    /P0-066|P0-067|P0-068|P0-069|P0-070/u.test(P0),
  );
  const m1Apis = ledgers.apis.rows.filter(({ Stage }) => Stage === 'M1');
  const m1Dependencies = ledgers.dependencies.rows.filter(
    ({ EarliestStage }) => EarliestStage === 'M1',
  );
  const m1Migrations = ledgers.migrations.rows.filter(({ Stage }) => Stage === 'M1');

  const apiErrors = union(
    ...m1Apis.map(({ ErrorCodes }) => ErrorCodes.split('|').filter(Boolean)),
  );
  const negativeTests = m1P0Ids.flatMap((p0Id) => {
    const taskId = `M1-P${p0Id.slice(3)}`;
    return negativeCases[p0Id].map(([category, scenario, expected, errorCode], index) => ({
      id: `NEG-M1-${p0Id.slice(3)}-${String(index + 1).padStart(2, '0')}`,
      taskId,
      p0Id,
      category,
      scenario,
      expected,
      errorCode,
      executionStatus: 'NOT_EXECUTED',
      evidenceRequired: 'AUTOMATED_TEST_ID_AND_COMMAND',
    }));
  });

  const contract = {
    schemaVersion: '1.0.0',
    taskId: 'M1-000',
    stage: 'M1',
    status: 'CONTRACT_FROZEN',
    implementationStatus: 'NOT_IMPLEMENTED',
    frozenAt: '2026-08-04T03:55:30Z',
    baseline: {
      schemePath: '福礼社单商户供应链平台V1.1综合方案.html',
      schemeSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
      precedence: 'V1.1_SCHEME_THEN_RED_LINES_THEN_STATE_AND_DATA_THEN_P0_THEN_UI',
    },
    scope: {
      p0Ids: m1P0Ids,
      businessTaskIds: m1P0Ids.map((p0Id) => `M1-P${p0Id.slice(3)}`),
      businessSliceStarted: false,
      nonGoals: ['PRODUCT_TRADING', 'PAYMENT', 'DELIVERY', 'SETTLEMENT'],
      nextAllowedAfterMergeAndGreenCi: 'M1-P001',
    },
    sourceLedgerHashPolicy: {
      encoding: 'UTF-8',
      lineEndings: 'LF',
    },
    sourceLedgers: Object.fromEntries(
      Object.entries(ledgerPaths).map(([key, relativePath]) => [key, {
        path: `福礼社Codex5.6开发执行包V1.1/${relativePath}`,
        sha256: createHash('sha256')
          .update(ledgers[key].content, 'utf8')
          .digest('hex')
          .toUpperCase(),
        rowCount: ledgers[key].rows.length,
      }]),
    ),
    invariants: {
      singleMerchant: {
        customerCounterparty: 'COMPANY_ONLY',
        companyLegalName: '江苏福礼团供应链科技有限公司',
        platformName: '福礼社',
        supplierIsStore: false,
        forbiddenCapabilities: [
          'FRANCHISEE_REGISTRATION',
          'REGIONAL_REVENUE_SHARE',
          'SUPPLIER_STOREFRONT',
          'SUPPLIER_DIRECT_PAYMENT',
        ],
      },
      ownership: {
        companyIdSource: 'SERVER_BOUND_UNIQUE_COMPANY',
        supplierIdSource: 'SERVER_BOUND_AUTHENTICATED_OWNER',
        clientOwnershipFieldsTrusted: false,
        objectScopeCheckedBeforeLookupResult: true,
      },
      session: {
        activeFunctionalAccountLimit: 1,
        workspaceRouteSource: 'FUNCTIONAL_ACCOUNT_TYPE_ALLOWLIST',
        switchRequiresNewSession: true,
        suspendedOrRevokedAccountInvalidatesSessions: true,
      },
      supplyPrice: {
        defaultPolicy: 'NEVER_RETURN',
        customerVisibility: [],
        authorizedCompanyRoles: ['COMPANY_PRICE_REVIEW', 'COMPANY_FINANCE'],
        authorizedSupplierRoles: ['SUPPLIER_PRICING', 'SUPPLIER_FINANCE'],
        correspondingSupplierOnly: true,
      },
      makerChecker: {
        identityKey: 'identityType+identityId',
        functionalAccountDifferenceIsInsufficient: true,
        superAdminBypass: false,
        concurrentDecisionMode: 'OPTIMISTIC_VERSION_EXACTLY_ONE_WINNER',
      },
    },
    fieldContract: {
      rowCount: m1Fields.length,
      entities,
      persistenceStatus: 'CONTRACT_ONLY_NO_PRISMA_MODEL_OR_MIGRATION_APPLIED',
    },
    stateContract: {
      transitionCount: m1States.length,
      transitions: m1States.map((row) => ({
        key: `${row.StateMachine}:${row.CurrentState}:${row.Event}:${row.NextState}`,
        stateMachine: row.StateMachine,
        currentState: row.CurrentState,
        event: row.Event,
        nextState: row.NextState,
        allowedActor: row.AllowedActor,
        guard: row.Guard,
        sideEffect: row.SideEffect,
        idempotency: row.Idempotency,
        illegalTransition: row.IllegalTransition,
        concurrencyControl: row.ConcurrencyControl,
        history: row.History,
        p0Ids: onlyM1P0(row.P0),
        freezeStatus: 'FROZEN_M1_000',
      })),
      illegalTransition: {
        httpStatus: 409,
        errorCode: 'STATE_TRANSITION_INVALID',
        stateChangeAllowed: false,
        auditRequired: true,
      },
      concurrency: {
        mode: 'OPTIMISTIC_VERSION_AND_UNIQUE_KEY',
        affectedRowCount: 1,
        historyMutationAllowed: false,
      },
    },
    permissionContract: {
      roleCodes: roleRows.map(({ RoleCode }) => RoleCode),
      roles: roleRows.map((row) => ({
        roleCode: row.RoleCode,
        ownerType: row.OwnerType,
        entryRoute: row.EntryRoute,
        readScope: row.ReadScope,
        writeScope: row.WriteScope,
        approvalAuthority: row.ApprovalAuthority,
        supplyPriceVisibility: row.SupplyPriceVisibility,
        dataScope: row.DataScope,
        forbiddenActions: row.ForbiddenActions,
        secondVerification: row.SecondVerification,
        businessContentStage: row.Stage,
      })),
      defaultDecision: 'DENY',
      routeAndApiEnforcement: 'SERVER_SIDE_REQUIRED',
      session: {
        activeFunctionalAccountLimit: 1,
        routeFixedByAccountType: true,
        switchingRevokesOldContext: true,
      },
      shellStage: 'M1',
      businessContentStageSource: 'permission ledger Stage column',
    },
    pageContract: {
      pageIds: pageRows.map(({ PageID }) => PageID),
      pages: pageRows.map((row) => ({
        pageId: row.PageID,
        platform: row.Platform,
        name: row.PageName,
        route: row.Route,
        p0Ids: splitCodes(row.P0),
        authPolicy: row.AuthPolicy,
        supplyPricePolicy: row.SupplyPricePolicy,
        requiredUiStates: row.RequiredUIStates,
        businessContentStage: row.Stage,
        implementationStatus: row.ImplementationStatus,
        acceptanceStatus: row.AcceptanceStatus,
      })),
      authRoutes: {
        companyLogin: '/company-admin/login',
        companyAccountSelection: '/company-admin/account-select',
        supplierRegistration: '/supplier/register',
        supplierLogin: '/supplier/login',
        supplierAccountSelection: '/supplier/account-select',
      },
      loginCachePolicy: 'PRIVATE_NO_STORE_NOINDEX',
      selectionCachePolicy: 'PRIVATE_NO_STORE_NOINDEX',
      workspaceUiStates: ['loading', 'empty', 'error', 'permission-denied', 'offline-or-timeout', 'success'],
      shellStage: 'M1',
      businessContentDeferredByLedgerStage: true,
    },
    apiContract: {
      contractIds: m1Apis.map(({ ContractID }) => ContractID),
      contracts: m1Apis.map((row) => ({
        contractId: row.ContractID,
        method: row.Method,
        path: row.Path,
        actor: row.Actor,
        requestDto: row.RequestDTO,
        responseDto: row.ResponseDTO,
        errorCodes: row.ErrorCodes.split('|'),
        idempotency: row.Idempotency,
        sensitiveFieldPolicy: row.SensitiveFieldPolicy,
        p0Ids: splitCodes(row.P0),
        implementationStatus: 'PLANNED_NOT_IMPLEMENTED',
      })),
      dtoSchemas,
      commonResponse: 'ApiResponse<T>',
      commonResponseShape: {
        success: '{ success: true, data: T, requestId: string }',
        failure: '{ success: false, error: { code, message, details? }, requestId: string }',
      },
      errorCatalog: apiErrors.map((code) => ({ code, httpStatus: errorHttpStatus[code] })),
      objectScopeCheckedBeforeLookupResult: true,
      databaseEntityReturnedDirectly: false,
      forbiddenPublicFields: [
        'supplyPrice',
        'approvedSupplyPrice',
        'supplyPriceSnapshot',
        'supplierPayable',
        'grossMargin',
      ],
      generatedOpenApiStatus: 'NOT_IMPLEMENTED_FOR_M1_BUSINESS_APIS',
    },
    migrationContract: {
      migrationIds: m1Migrations.map(({ MigrationID }) => MigrationID),
      migrations: m1Migrations.map((row) => ({
        migrationId: row.MigrationID,
        plannedName: row.PlannedName,
        dependsOn: row.DependsOn,
        objects: row.Objects.split('/'),
        verification: row.Verification,
        status: row.Status,
      })),
      applied: false,
      implementationRule: 'M1 business slices create forward-only Prisma migrations; M1-000 creates none',
    },
    slices: m1P0Ids.map((p0Id) => ({
      taskId: `M1-P${p0Id.slice(3)}`,
      p0Id,
      contractRefs: sliceRefs[p0Id],
      negativeTestIds: negativeTests
        .filter((negativeTest) => negativeTest.p0Id === p0Id)
        .map(({ id }) => id),
      implementationStatus: 'NOT_STARTED',
    })),
    negativeTests,
    humanDependencies: m1Dependencies.map((row) => ({
      dependencyId: row.DependencyID,
      category: row.Category,
      requiredInputOrDecision: row.RequiredInputOrDecision,
      owner: row.Owner,
      status: row.CurrentStatus,
      blockingTask: row.BlockingTask,
      blocksFormalAcceptance: row.BlocksFormalAcceptance === 'YES',
      safetyBoundary: row.SafetyBoundary,
      guessedByCode: false,
    })),
    evidenceBoundary: {
      contractReview: 'LOCAL_PASS_AFTER_TEST',
      negativeTests: 'PLANNED_NOT_EXECUTED',
      businessApis: 'NOT_IMPLEMENTED',
      prismaMigrations: 'NOT_APPLIED',
      pages: 'NOT_IMPLEMENTED',
      staging: 'NOT_EXECUTED',
      device: 'NOT_EXECUTED',
      production: 'NOT_EXECUTED',
    },
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
};

await main();
