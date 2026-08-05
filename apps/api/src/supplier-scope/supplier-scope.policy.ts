import { SafeApiError } from '../http/api-error.js';

export const SUPPLIER_SCOPED_RESOURCES = Object.freeze([
  'SUPPLIER_PROFILE',
  'PRODUCT',
  'ORDER',
  'INVENTORY',
  'STATEMENT',
  'ACCOUNT',
] as const);

export type SupplierScopedResource = (typeof SUPPLIER_SCOPED_RESOURCES)[number];

const scopeDenied = (): never => {
  throw new SafeApiError(
    403,
    'SUPPLIER_SCOPE_FORBIDDEN',
    'Supplier scope does not allow this operation',
  );
};

export const assertSupplierResourceScope = (
  sessionSupplierId: string,
  resourceSupplierId: string,
  resource: SupplierScopedResource,
): string => {
  if (!SUPPLIER_SCOPED_RESOURCES.includes(resource)) return scopeDenied();
  if (resourceSupplierId !== sessionSupplierId) return scopeDenied();
  return sessionSupplierId;
};

export const assertSupplierExportScope = <
  T extends Readonly<{ readonly supplierId: string }>,
>(
  sessionSupplierId: string,
  rows: readonly T[],
): readonly T[] => {
  if (rows.some((row) => row.supplierId !== sessionSupplierId)) {
    throw new SafeApiError(
      403,
      'DATA_SCOPE_FORBIDDEN',
      'Export data scope does not allow this operation',
    );
  }
  return rows;
};
