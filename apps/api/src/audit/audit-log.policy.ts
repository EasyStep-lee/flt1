export const REQUIRED_SENSITIVE_AUDIT_ACTIONS = Object.freeze([
  'refund.approved',
  'product.force_unpublished',
  'supplier.bank_account.changed',
  'supplier.payment.marked',
] as const);

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const maskedKeys = /^(mobile|email|ip|bankAccount|settlementAccount|bankReference)$/iu;
const redactedKeys =
  /(secret|password|token|verification|cardCode|supplyPrice|internalMargin|supplierPayable)/iu;

export class AuditPolicyError extends Error {
  constructor(
    readonly code:
      | 'REQUEST_ID_REQUIRED'
      | 'AUDIT_IMMUTABLE'
      | 'ACTOR_SPOOFED',
    message: string,
  ) {
    super(message);
    this.name = 'AuditPolicyError';
  }
}

export const assertAuditRequestId = (value: unknown): string => {
  if (typeof value !== 'string' || !requestIdPattern.test(value)) {
    throw new AuditPolicyError(
      'REQUEST_ID_REQUIRED',
      'A server-bound UUID request id is required for audited operations',
    );
  }
  return value.toLocaleLowerCase('en-US');
};

const maskValue = (key: string, value: unknown): unknown => {
  if (redactedKeys.test(key)) return '[REDACTED]';
  if (!maskedKeys.test(key) || typeof value !== 'string') return value;
  if (key.toLocaleLowerCase('en-US') === 'email') {
    const [name, domain] = value.split('@');
    return domain ? `${name?.slice(0, 1) ?? ''}***@${domain}` : '***';
  }
  return value.length <= 4 ? '***' : `***${value.slice(-4)}`;
};

export const sanitizeAuditSnapshot = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeAuditSnapshot);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      redactedKeys.test(key) || maskedKeys.test(key)
        ? maskValue(key, child)
        : sanitizeAuditSnapshot(child),
    ]),
  );
};
