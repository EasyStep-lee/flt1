import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

import {
  APPAREL_PRODUCT_FIELD_KEYS,
  APPAREL_SKU_FIELD_KEYS,
  validateApparelSupplierProductTemplateContent,
} from '../category-templates/apparel-template.policy.js';
import type { CategoryTemplateDefinition } from '../category-templates/category-template.policy.js';
import { SafeApiError } from '../http/api-error.js';
import { buildCatalogMediaResponse, type CatalogMediaResponse } from './catalog-media.policy.js';

export interface ApparelProductDetailSource {
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

export interface PublicApparelProductDetailResponse {
  readonly productId: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly templateProfile: 'APPAREL';
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

export const buildApparelProductDetailResponse = (
  source: ApparelProductDetailSource,
): PublicApparelProductDetailResponse => {
  const activeSkus = source.skus.filter(({ status }) => status === 'ACTIVE');
  if (
    source.saleStatus !== 'ACTIVE' ||
    !source.isRetailEnabled ||
    activeSkus.length < 1 ||
    source.template.profile !== 'APPAREL'
  ) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product is not a sellable apparel item');
  }
  const attributes = record(source.detailSnapshot.attributes);
  if (!attributes) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product detail snapshot is invalid');
  }
  validateApparelSupplierProductTemplateContent(source.template, {
    attributes,
    skus: activeSkus.map(({ attributes: skuAttributes }) => ({ attributes: skuAttributes })),
  });

  const fieldMap = new Map(source.template.fieldSchema.fields.map((field) => [field.key, field]));
  const detailModules: PublicApparelProductDetailResponse['detailModules'][number][] =
    source.template.detailModules.modules
      .filter(({ key }) => ['size-assistant', 'materials', 'care-instructions'].includes(key))
      .sort((left, right) => left.sortWeight - right.sortWeight || left.key.localeCompare(right.key))
      .map((module) => ({
        key: module.key,
        title: module.title,
        kind: 'FIELDS' as const,
        fields: APPAREL_PRODUCT_FIELD_KEYS.filter(
          (fieldKey) => fieldMap.get(fieldKey)?.detailModuleKey === module.key,
        ).map((fieldKey) => ({
          key: fieldKey,
          label: fieldMap.get(fieldKey)!.label,
          value: snapshotText(attributes, fieldKey),
        })),
        notice: null,
      }));
  const afterSaleModule = source.template.detailModules.modules.find(
    ({ key, kind }) => key === 'apparel-after-sales' && kind === 'AFTER_SALE',
  );
  if (!afterSaleModule) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Apparel after-sales module is missing');
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
      specifications: APPAREL_SKU_FIELD_KEYS.map((fieldKey) => ({
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
    templateProfile: 'APPAREL',
    name: snapshotText(source.detailSnapshot, 'name', source.name),
    brand: source.detailSnapshot.brand === null ? null : snapshotText(source.detailSnapshot, 'brand'),
    sellerName: COMPANY_LEGAL_NAME,
    checkoutMode: 'COMPANY_UNIFIED',
    retailSalePrice: Math.min(...skus.map(({ retailSalePrice }) => retailSalePrice)),
    media: buildCatalogMediaResponse(source.detailSnapshot),
    skus,
    detailModules,
  };
};
