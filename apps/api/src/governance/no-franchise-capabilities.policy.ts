export const NO_FRANCHISEE_POLICY_ID = 'NO_FRANCHISEE_CAPABILITIES' as const;

export type NoFranchiseViolationCategory =
  | 'FRANCHISEE_ROUTE'
  | 'REGIONAL_REVENUE_SHARE'
  | 'FRANCHISEE_ENTITY';

export type NoFranchiseViolationCode =
  | 'FORBIDDEN_CAPABILITY'
  | 'FORBIDDEN_ENTITY';

const FORBIDDEN_CAPABILITIES: Readonly<
  Record<string, NoFranchiseViolationCategory>
> = Object.freeze({
  FRANCHISEE_ADMIN: 'FRANCHISEE_ROUTE',
  FRANCHISEE_CONTRACT_ADMIN: 'FRANCHISEE_ROUTE',
  FRANCHISEE_REGISTRATION: 'FRANCHISEE_ROUTE',
  REGIONAL_AGENT_REGISTRATION: 'FRANCHISEE_ROUTE',
  REGIONAL_REVENUE_SHARE: 'REGIONAL_REVENUE_SHARE',
  REGIONAL_SPLIT_SETTLEMENT: 'REGIONAL_REVENUE_SHARE',
});

const FORBIDDEN_ENTITY_NAMES = new Set([
  'franchisecontract',
  'franchisee',
  'regionalagent',
  'regionalmerchant',
  'regionalrevenueshare',
]);

export class NoFranchiseCapabilityError extends Error {
  readonly policyId = NO_FRANCHISEE_POLICY_ID;

  constructor(
    readonly category: NoFranchiseViolationCategory,
    readonly code: NoFranchiseViolationCode,
    readonly subject: string,
  ) {
    super(`${code}:${category}`);
    this.name = 'NoFranchiseCapabilityError';
  }
}

export const assertPlatformCapabilityAllowed = (capability: string): void => {
  const normalized = capability.trim().toUpperCase();
  const category = FORBIDDEN_CAPABILITIES[normalized];
  if (category) {
    throw new NoFranchiseCapabilityError(
      category,
      'FORBIDDEN_CAPABILITY',
      normalized,
    );
  }
};

export const assertPlatformEntityAllowed = (entityName: string): void => {
  const normalized = entityName.replaceAll(/[^a-z0-9]/giu, '').toLowerCase();
  if (FORBIDDEN_ENTITY_NAMES.has(normalized)) {
    throw new NoFranchiseCapabilityError(
      'FRANCHISEE_ENTITY',
      'FORBIDDEN_ENTITY',
      entityName,
    );
  }
};
