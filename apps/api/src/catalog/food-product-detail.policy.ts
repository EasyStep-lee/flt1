import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

import {
  FOOD_FIXED_WARNING,
  FOOD_PRODUCT_FIELD_KEYS,
  FOOD_SKU_FIELD_KEYS,
  validateSupplierProductTemplateContent,
} from '../category-templates/food-template.policy.js';
import type { CategoryTemplateDefinition } from '../category-templates/category-template.policy.js';
import { SafeApiError } from '../http/api-error.js';
import { buildCatalogMediaResponse, type CatalogMediaResponse } from './catalog-media.policy.js';

export interface FoodProductDetailSource {
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

export interface PublicFoodProductDetailResponse {
  readonly productId: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly templateProfile: 'FOOD';
  readonly name: string;
  readonly brand: string | null;
  readonly sellerName: typeof COMPANY_LEGAL_NAME;
  readonly checkoutMode: 'COMPANY_UNIFIED';
  readonly retailSalePrice: number;
  readonly media: readonly CatalogMediaResponse[];
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
    readonly kind: 'FIELDS' | 'FIXED_NOTICE';
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

export const buildFoodProductDetailResponse = (
  source: FoodProductDetailSource,
): PublicFoodProductDetailResponse => {
  const activeSkus = source.skus.filter(({ status }) => status === 'ACTIVE');
  if (
    source.saleStatus !== 'ACTIVE' ||
    !source.isRetailEnabled ||
    activeSkus.length < 1 ||
    source.template.profile !== 'FOOD'
  ) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product is not a sellable food item');
  }
  const attributes = record(source.detailSnapshot.attributes);
  if (!attributes) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product detail snapshot is invalid');
  }
  validateSupplierProductTemplateContent(source.template, {
    attributes,
    skus: activeSkus.map(({ attributes: skuAttributes }) => ({ attributes: skuAttributes })),
  });

  const fieldMap = new Map(
    source.template.fieldSchema.fields.map((field) => [field.key, field]),
  );
  const detailModules: PublicFoodProductDetailResponse['detailModules'][number][] = source.template.detailModules.modules
    .filter(({ key }) =>
      ['ingredients-nutrition', 'production-information', 'consumption-storage'].includes(key),
    )
    .sort((left, right) => left.sortWeight - right.sortWeight || left.key.localeCompare(right.key))
    .map((module) => ({
      key: module.key,
      title: module.title,
      kind: 'FIELDS' as const,
      fields: FOOD_PRODUCT_FIELD_KEYS.filter(
        (fieldKey) => fieldMap.get(fieldKey)?.detailModuleKey === module.key,
      ).map((fieldKey) => ({
        key: fieldKey,
        label: fieldMap.get(fieldKey)!.label,
        value: snapshotText(attributes, fieldKey),
      })),
      notice: null as string | null,
    }));
  const warningModule = source.template.detailModules.modules.find(
    ({ key }) => key === 'food-safety-warning',
  );
  if (!warningModule) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Food warning module is missing');
  }
  detailModules.push({
    key: warningModule.key,
    title: warningModule.title,
    kind: 'FIXED_NOTICE',
    fields: [],
    notice: FOOD_FIXED_WARNING,
  });

  const skus = activeSkus.map((sku) => {
    if (!Number.isSafeInteger(sku.retailSalePrice) || sku.retailSalePrice < 0) {
      throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'SKU retail price is invalid');
    }
    return {
      skuId: sku.skuId,
      retailSalePrice: sku.retailSalePrice,
      specifications: FOOD_SKU_FIELD_KEYS.map((fieldKey) => ({
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
    templateProfile: 'FOOD',
    name: snapshotText(source.detailSnapshot, 'name', source.name),
    brand:
      source.detailSnapshot.brand === null
        ? null
        : snapshotText(source.detailSnapshot, 'brand'),
    sellerName: COMPANY_LEGAL_NAME,
    checkoutMode: 'COMPANY_UNIFIED',
    retailSalePrice: Math.min(...skus.map(({ retailSalePrice }) => retailSalePrice)),
    media: buildCatalogMediaResponse(source.detailSnapshot),
    skus,
    detailModules,
  };
};
