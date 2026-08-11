import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

import {
  FRESH_PRODUCT_FIELD_KEYS,
  FRESH_SKU_FIELD_KEYS,
  validateFreshSupplierProductTemplateContent,
} from '../category-templates/fresh-template.policy.js';
import type { CategoryTemplateDefinition } from '../category-templates/category-template.policy.js';
import { SafeApiError } from '../http/api-error.js';

export interface FreshProductDetailSource {
  readonly productId: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly name: string;
  readonly saleStatus: 'ACTIVE' | 'ARCHIVED' | 'OFF_SHELF';
  readonly isRetailEnabled: boolean;
  readonly detailSnapshot: Readonly<Record<string, unknown>>;
  readonly template: CategoryTemplateDefinition;
  readonly skus: readonly {
    readonly skuId: string;
    readonly status: 'ACTIVE' | 'ARCHIVED' | 'INACTIVE';
    readonly retailSalePrice: number;
    readonly attributes: Readonly<Record<string, unknown>>;
  }[];
}

export interface PublicFreshProductDetailResponse {
  readonly productId: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly templateProfile: 'FRESH';
  readonly name: string;
  readonly brand: string | null;
  readonly sellerName: typeof COMPANY_LEGAL_NAME;
  readonly checkoutMode: 'COMPANY_UNIFIED';
  readonly retailSalePrice: number;
  readonly skus: readonly {
    readonly skuId: string;
    readonly retailSalePrice: number;
    readonly specifications: readonly {
      readonly key: string;
      readonly label: string;
      readonly value: string;
    }[];
  }[];
  readonly detailModules: readonly {
    readonly key: string;
    readonly title: string;
    readonly kind: 'AFTER_SALE' | 'FIELDS';
    readonly fields: readonly {
      readonly key: string;
      readonly label: string;
      readonly value: string;
    }[];
    readonly notice: string | null;
  }[];
}

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;

const snapshotText = (
  snapshot: Readonly<Record<string, unknown>>,
  key: string,
  fallback?: string,
): string => {
  const value = snapshot[key] ?? fallback;
  if (typeof value !== 'string' || !value.trim()) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product detail snapshot is invalid');
  }
  return value;
};

const displayValue = (key: string, value: string): string => {
  const labels: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    'temperature-zone': { AMBIENT: '常温', CHILLED: '冷藏', FROZEN: '冷冻' },
    'weighing-rule': { FIXED_WEIGHT: '定重计价', ACTUAL_WEIGHT: '按实际称重计价' },
  };
  return labels[key]?.[value] ?? value;
};

export const buildFreshProductDetailResponse = (
  source: FreshProductDetailSource,
): PublicFreshProductDetailResponse => {
  const activeSkus = source.skus.filter(({ status }) => status === 'ACTIVE');
  if (
    source.saleStatus !== 'ACTIVE' ||
    !source.isRetailEnabled ||
    activeSkus.length < 1 ||
    source.template.profile !== 'FRESH'
  ) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product is not a sellable fresh item');
  }
  const attributes = record(source.detailSnapshot.attributes);
  if (!attributes) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product detail snapshot is invalid');
  }
  validateFreshSupplierProductTemplateContent(source.template, {
    attributes,
    skus: activeSkus.map(({ attributes: skuAttributes }) => ({ attributes: skuAttributes })),
  });

  const fieldMap = new Map(source.template.fieldSchema.fields.map((field) => [field.key, field]));
  const detailModules: PublicFreshProductDetailResponse['detailModules'][number][] = source.template.detailModules.modules
    .filter(({ key }) =>
      ['origin-traceability', 'freshness-storage', 'weighing-difference'].includes(key),
    )
    .sort((left, right) => left.sortWeight - right.sortWeight || left.key.localeCompare(right.key))
    .map((module) => ({
      key: module.key,
      title: module.title,
      kind: 'FIELDS' as const,
      fields: FRESH_PRODUCT_FIELD_KEYS.filter(
        (fieldKey) => fieldMap.get(fieldKey)?.detailModuleKey === module.key,
      ).map((fieldKey) => ({
        key: fieldKey,
        label: fieldMap.get(fieldKey)!.label,
        value: displayValue(fieldKey, snapshotText(attributes, fieldKey)),
      })),
      notice: null,
    }));
  const afterSaleModule = source.template.detailModules.modules.find(
    ({ key, kind }) => key === 'fresh-after-sales' && kind === 'AFTER_SALE',
  );
  if (!afterSaleModule) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Fresh after-sales module is missing');
  }
  detailModules.push({
    key: afterSaleModule.key,
    title: afterSaleModule.title,
    kind: 'AFTER_SALE',
    fields: [],
    notice: source.template.afterSaleRules.notice,
  });

  const skus = activeSkus.map((sku) => {
    if (!Number.isSafeInteger(sku.retailSalePrice) || sku.retailSalePrice < 0) {
      throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'SKU retail price is invalid');
    }
    return {
      skuId: sku.skuId,
      retailSalePrice: sku.retailSalePrice,
      specifications: FRESH_SKU_FIELD_KEYS.map((fieldKey) => ({
        key: fieldKey,
        label: fieldMap.get(fieldKey)!.label,
        value: snapshotText(sku.attributes, fieldKey),
      })),
    };
  });

  return {
    productId: source.productId,
    supplierId: source.supplierId,
    categoryId: source.categoryId,
    templateVersion: source.templateVersion,
    templateProfile: 'FRESH',
    name: snapshotText(source.detailSnapshot, 'name', source.name),
    brand: source.detailSnapshot.brand === null ? null : snapshotText(source.detailSnapshot, 'brand'),
    sellerName: COMPANY_LEGAL_NAME,
    checkoutMode: 'COMPANY_UNIFIED',
    retailSalePrice: Math.min(...skus.map(({ retailSalePrice }) => retailSalePrice)),
    skus,
    detailModules,
  };
};
