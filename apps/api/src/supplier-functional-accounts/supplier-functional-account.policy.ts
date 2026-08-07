export const SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES = Object.freeze([
  {
    code: 'SUPPLIER_ACCOUNT_ADMIN',
    name: '主体管理',
    menuLabel: '主体管理',
    pageId: 'PAGE-016',
    workspaceRoute: '/supplier/workspaces/account-admin',
    internalMenuSchema: { version: '1.0', items: ['profile', 'accounts'] },
  },
  {
    code: 'SUPPLIER_PRODUCT',
    name: '商品运营',
    menuLabel: '商品管理',
    pageId: 'PAGE-017',
    workspaceRoute: '/supplier/workspaces/products',
    internalMenuSchema: { version: '1.0', items: [] },
  },
  {
    code: 'SUPPLIER_PRICING',
    name: '价格管理',
    menuLabel: '价格管理',
    pageId: 'PAGE-018',
    workspaceRoute: '/supplier/workspaces/pricing',
    internalMenuSchema: { version: '1.0', items: [] },
  },
  {
    code: 'SUPPLIER_INVENTORY',
    name: '库存/仓库',
    menuLabel: '库存管理',
    pageId: 'PAGE-019',
    workspaceRoute: '/supplier/workspaces/inventory',
    internalMenuSchema: { version: '1.0', items: [] },
  },
  {
    code: 'SUPPLIER_FULFILLMENT',
    name: '订单履约',
    menuLabel: '履约管理',
    pageId: 'PAGE-020',
    workspaceRoute: '/supplier/workspaces/fulfillment',
    internalMenuSchema: { version: '1.0', items: [] },
  },
  {
    code: 'SUPPLIER_AFTERSALES',
    name: '售后',
    menuLabel: '售后协同',
    pageId: 'PAGE-021',
    workspaceRoute: '/supplier/workspaces/aftersales',
    internalMenuSchema: { version: '1.0', items: [] },
  },
  {
    code: 'SUPPLIER_FINANCE',
    name: '财务对账',
    menuLabel: '财务对账',
    pageId: 'PAGE-022',
    workspaceRoute: '/supplier/workspaces/finance',
    internalMenuSchema: { version: '1.0', items: [] },
  },
  {
    code: 'SUPPLIER_AUDIT',
    name: '只读审计',
    menuLabel: '审计记录',
    pageId: 'PAGE-023',
    workspaceRoute: '/supplier/workspaces/audit',
    internalMenuSchema: { version: '1.0', items: [] },
  },
] as const);

export type SupplierFunctionalAccountTypeCode =
  (typeof SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES)[number]['code'];
export type FunctionalAccountStatus =
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REVOKED';
export type FunctionalAccountEvent = 'ACTIVATE' | 'SUSPEND' | 'RESTORE' | 'REVOKE';
export type FunctionalAccountPolicyErrorCode =
  | 'ACCOUNT_TYPE_INVALID'
  | 'SECOND_VERIFICATION_REQUIRED'
  | 'STATE_TRANSITION_INVALID'
  | 'WORKSPACE_FORBIDDEN';

export class FunctionalAccountPolicyError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: FunctionalAccountPolicyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FunctionalAccountPolicyError';
  }
}

export const resolveSupplierAccountType = (code: string) => {
  const accountType = SUPPLIER_FUNCTIONAL_ACCOUNT_TYPES.find(
    (candidate) => candidate.code === code,
  );
  if (!accountType) {
    throw new FunctionalAccountPolicyError(
      422,
      'ACCOUNT_TYPE_INVALID',
      'Supplier functional account type is invalid',
    );
  }
  return accountType;
};

export const assertAccountWorkspace = (
  accountTypeCode: string,
  workspaceRoute?: string,
): void => {
  const accountType = resolveSupplierAccountType(accountTypeCode);
  if (
    accountType.code !== 'SUPPLIER_ACCOUNT_ADMIN' ||
    (workspaceRoute !== undefined && workspaceRoute !== accountType.workspaceRoute)
  ) {
    throw new FunctionalAccountPolicyError(
      403,
      'WORKSPACE_FORBIDDEN',
      'The fixed workspace cannot administer functional accounts',
    );
  }
};

export const assertSecondVerification = (verified: boolean): void => {
  if (!verified) {
    throw new FunctionalAccountPolicyError(
      428,
      'SECOND_VERIFICATION_REQUIRED',
      'Second verification is required for this account change',
    );
  }
};

export const assertAccountAssignment = (input: {
  readonly actorAccountTypeCode: string;
  readonly actorIdentityId: string;
  readonly targetAccountTypeCode: string;
  readonly targetIdentityId: string;
}): void => {
  resolveSupplierAccountType(input.targetAccountTypeCode);
  if (
    input.actorIdentityId === input.targetIdentityId &&
    input.targetAccountTypeCode === 'SUPPLIER_ACCOUNT_ADMIN'
  ) {
    throw new FunctionalAccountPolicyError(
      422,
      'ACCOUNT_TYPE_INVALID',
      'A natural person cannot grant itself owner administration authority',
    );
  }
};

const TRANSITIONS: Readonly<
  Record<FunctionalAccountStatus, Partial<Record<FunctionalAccountEvent, FunctionalAccountStatus>>>
> = Object.freeze({
  PENDING_ACTIVATION: { ACTIVATE: 'ACTIVE' },
  ACTIVE: { REVOKE: 'REVOKED', SUSPEND: 'SUSPENDED' },
  SUSPENDED: { RESTORE: 'ACTIVE' },
  REVOKED: {},
});

export const resolveFunctionalAccountTransition = (
  current: FunctionalAccountStatus,
  event: FunctionalAccountEvent,
  context: {
    readonly activeOwnerAdminCount?: number;
    readonly secondVerified?: boolean;
    readonly targetAccountTypeCode: SupplierFunctionalAccountTypeCode;
  },
): FunctionalAccountStatus => {
  const next = TRANSITIONS[current][event];
  if (!next) {
    throw new FunctionalAccountPolicyError(
      409,
      'STATE_TRANSITION_INVALID',
      'Functional account state transition is not allowed',
    );
  }
  if (
    event === 'SUSPEND' &&
    context.targetAccountTypeCode === 'SUPPLIER_ACCOUNT_ADMIN' &&
    context.activeOwnerAdminCount === 1
  ) {
    throw new FunctionalAccountPolicyError(
      409,
      'STATE_TRANSITION_INVALID',
      'The final active owner administrator cannot be suspended',
    );
  }
  if (event === 'ACTIVATE' || event === 'RESTORE') {
    assertSecondVerification(context.secondVerified === true);
  }
  return next;
};
