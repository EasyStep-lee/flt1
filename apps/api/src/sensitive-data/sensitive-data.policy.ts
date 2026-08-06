import { SafeApiError } from '../http/api-error.js';

export type SensitiveFieldGroup =
  | 'SUPPLY_PRICE'
  | 'SUPPLIER_SETTLEMENT'
  | 'DELIVERY_ADDRESS';

export type SensitiveFieldAccessMode = 'MASKED' | 'VISIBLE_WITH_AUDIT';

export interface SensitiveDataActor {
  readonly ownerType: 'COMPANY' | 'SUPPLIER' | 'CONSUMER' | 'ENTERPRISE' | 'RUNNER';
  readonly accountTypeCode: string;
  readonly workspaceRoute: string;
  readonly supplierId?: string;
  readonly runnerId?: string;
}

export interface SensitiveDataResource {
  readonly fieldGroup: SensitiveFieldGroup;
  readonly supplierId?: string;
  readonly delivery?: {
    readonly channel: 'CONSUMER' | 'ENTERPRISE';
    readonly assignedRunnerId: string;
    readonly stage: string;
  };
}

export class SensitiveDataPolicyError extends SafeApiError {
  constructor(
    code: 'FIELD_FORBIDDEN' | 'WORKSPACE_FORBIDDEN' | 'EXPORT_APPROVAL_REQUIRED',
    message: string,
  ) {
    super(403, code, message);
    this.name = 'SensitiveDataPolicyError';
  }
}

const expectedWorkspaceByAccountType = new Map<string, string>([
  ['COMPANY_PRODUCT_OPS', '/company-admin/workspaces/product-ops'],
  ['COMPANY_PRICE_REVIEW', '/company-admin/workspaces/price-review'],
  ['COMPANY_FINANCE', '/company-admin/workspaces/finance'],
  ['COMPANY_AUDIT', '/company-admin/workspaces/audit'],
  ['SUPPLIER_PRICING', '/supplier/workspaces/pricing'],
  ['SUPPLIER_FINANCE', '/supplier/workspaces/finance'],
  ['CONSUMER_USER', '/pages/home/index'],
  ['ENTERPRISE_BUYER', '/enterprise/workspaces/procurement'],
  ['RUNNER', '/pages/home/index'],
]);

const activeRunnerStages = new Set([
  'CLAIMED',
  'PICKUP_PENDING',
  'PICKED_UP',
  'DELIVERING',
]);

const restrictedKey = new Set([
  'supplyprice',
  'approvedsupplyprice',
  'supplypricesnapshot',
  'supplierpayable',
  'supplierpayableamount',
  'grossmargin',
  'grossmarginrate',
]);

const normalizedKey = (value: string): string =>
  value.replaceAll(/[^a-z0-9]/giu, '').toLocaleLowerCase('en-US');

const assertWorkspace = (actor: SensitiveDataActor): void => {
  const expectedWorkspace = expectedWorkspaceByAccountType.get(actor.accountTypeCode);
  if (expectedWorkspace && actor.workspaceRoute !== expectedWorkspace) {
    throw new SensitiveDataPolicyError(
      'WORKSPACE_FORBIDDEN',
      'The functional account workspace does not match the server-bound role',
    );
  }
};

const isOwnSupplierResource = (
  actor: SensitiveDataActor,
  resource: SensitiveDataResource,
): boolean =>
  typeof actor.supplierId === 'string' &&
  actor.supplierId.length > 0 &&
  actor.supplierId === resource.supplierId;

export const authorizeSensitiveFieldRead = (
  actor: SensitiveDataActor,
  resource: SensitiveDataResource,
): SensitiveFieldAccessMode => {
  assertWorkspace(actor);

  if (resource.fieldGroup === 'SUPPLY_PRICE') {
    if (
      actor.ownerType === 'COMPANY' &&
      ['COMPANY_PRICE_REVIEW', 'COMPANY_FINANCE'].includes(actor.accountTypeCode)
    ) {
      return 'VISIBLE_WITH_AUDIT';
    }
    if (
      actor.ownerType === 'SUPPLIER' &&
      ['SUPPLIER_PRICING', 'SUPPLIER_FINANCE'].includes(actor.accountTypeCode) &&
      isOwnSupplierResource(actor, resource)
    ) {
      return 'VISIBLE_WITH_AUDIT';
    }
  }

  if (resource.fieldGroup === 'SUPPLIER_SETTLEMENT') {
    if (actor.ownerType === 'COMPANY' && actor.accountTypeCode === 'COMPANY_FINANCE') {
      return 'VISIBLE_WITH_AUDIT';
    }
    if (
      actor.ownerType === 'SUPPLIER' &&
      actor.accountTypeCode === 'SUPPLIER_FINANCE' &&
      isOwnSupplierResource(actor, resource)
    ) {
      return 'VISIBLE_WITH_AUDIT';
    }
  }

  if (
    resource.fieldGroup === 'DELIVERY_ADDRESS' &&
    actor.ownerType === 'RUNNER' &&
    actor.accountTypeCode === 'RUNNER' &&
    typeof actor.runnerId === 'string' &&
    resource.delivery?.channel === 'CONSUMER' &&
    resource.delivery.assignedRunnerId === actor.runnerId &&
    activeRunnerStages.has(resource.delivery.stage)
  ) {
    return 'MASKED';
  }

  throw new SensitiveDataPolicyError(
    'FIELD_FORBIDDEN',
    'The sensitive field group is not available to this functional account',
  );
};

export const omitRestrictedFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(omitRestrictedFields);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !restrictedKey.has(normalizedKey(key)))
      .map(([key, child]) => [key, omitRestrictedFields(child)]),
  );
};

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const assertHighSensitivityExport = (
  actor: SensitiveDataActor,
  evidence: { readonly approvalStatus?: string; readonly approvalId?: string },
): void => {
  assertWorkspace(actor);
  if (
    actor.ownerType !== 'COMPANY' ||
    actor.accountTypeCode !== 'COMPANY_AUDIT' ||
    actor.workspaceRoute !== '/company-admin/workspaces/audit'
  ) {
    throw new SensitiveDataPolicyError(
      'WORKSPACE_FORBIDDEN',
      'The company audit workspace is required for an approved export',
    );
  }
  if (
    evidence.approvalStatus !== 'APPROVED' ||
    typeof evidence.approvalId !== 'string' ||
    !canonicalUuidPattern.test(evidence.approvalId)
  ) {
    throw new SensitiveDataPolicyError(
      'EXPORT_APPROVAL_REQUIRED',
      'An approved high-sensitivity export record is required',
    );
  }
};

export const assertAuditQueryIsolation = (
  query: Readonly<Record<string, unknown>>,
): void => {
  if (query.fieldGroup !== undefined) {
    throw new SensitiveDataPolicyError(
      'FIELD_FORBIDDEN',
      'Sensitive field expansion is not supported by the audit list endpoint',
    );
  }
  if (query.export !== undefined || query.download !== undefined) {
    throw new SensitiveDataPolicyError(
      'EXPORT_APPROVAL_REQUIRED',
      'Audit export requires a separate approved export workflow',
    );
  }
};
