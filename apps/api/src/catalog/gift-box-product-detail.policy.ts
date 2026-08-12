import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

import {
  GIFT_BOX_PRODUCT_FIELD_KEYS,
  GIFT_BOX_SKU_FIELD_KEYS,
  readGiftBoxBundleItemSnapshots,
  validateGiftBoxSupplierProductTemplateContent,
} from '../category-templates/gift-box-template.policy.js';
import { SafeApiError } from '../http/api-error.js';
import { buildCatalogMediaResponse, type CatalogMediaResponse } from './catalog-media.policy.js';
import type { PublicCatalogProductDetailRecord } from './public-catalog.repository.js';

export type GiftBoxProductDetailSource = PublicCatalogProductDetailRecord;

export interface PublicGiftBoxProductDetailResponse {
  readonly productId: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly templateProfile: 'GIFT_BOX';
  readonly name: string;
  readonly brand: string | null;
  readonly sellerName: typeof COMPANY_LEGAL_NAME;
  readonly checkoutMode: 'COMPANY_UNIFIED';
  readonly retailSalePrice: number;
  readonly media: readonly CatalogMediaResponse[];
  readonly bundleItems: readonly {
    readonly name: string;
    readonly quantity: number;
    readonly specification: string;
    readonly minimumExpiryDays: number;
  }[];
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

export const buildGiftBoxProductDetailResponse = (
  source: GiftBoxProductDetailSource,
): PublicGiftBoxProductDetailResponse => {
  const activeSkus = source.skus.filter(({ status }) => status === 'ACTIVE');
  if (
    source.saleStatus !== 'ACTIVE' ||
    !source.isRetailEnabled ||
    activeSkus.length < 1 ||
    source.template.profile !== 'GIFT_BOX'
  ) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product is not a sellable gift box');
  }
  const attributes = record(source.detailSnapshot.attributes);
  if (!attributes) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Product detail snapshot is invalid');
  }
  validateGiftBoxSupplierProductTemplateContent(source.template, {
    attributes,
    skus: activeSkus.map(({ attributes: skuAttributes }) => ({ attributes: skuAttributes })),
  });

  const fieldMap = new Map(source.template.fieldSchema.fields.map((field) => [field.key, field]));
  const detailModules: PublicGiftBoxProductDetailResponse['detailModules'][number][] =
    source.template.detailModules.modules
      .filter(({ key }) => ['welfare-scenario', 'customization'].includes(key))
      .sort((left, right) => left.sortWeight - right.sortWeight || left.key.localeCompare(right.key))
      .map((module) => ({
        key: module.key,
        title: module.title,
        kind: 'FIELDS' as const,
        fields: GIFT_BOX_PRODUCT_FIELD_KEYS.filter(
          (fieldKey) => fieldMap.get(fieldKey)?.detailModuleKey === module.key,
        ).map((fieldKey) => ({
          key: fieldKey,
          label: fieldMap.get(fieldKey)!.label,
          value: snapshotText(attributes, fieldKey),
        })),
        notice: null,
      }));
  const afterSaleModule = source.template.detailModules.modules.find(
    ({ key, kind }) => key === 'gift-box-after-sales' && kind === 'AFTER_SALE',
  );
  if (!afterSaleModule) {
    throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Gift-box after-sales module is missing');
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
      specifications: GIFT_BOX_SKU_FIELD_KEYS.map((fieldKey) => ({
        key: fieldKey,
        label: fieldMap.get(fieldKey)!.label,
        value: snapshotText(sku.attributes, fieldKey),
      })),
    };
  });

  const bundleItems = readGiftBoxBundleItemSnapshots(attributes['bundle-items']).map(
    ({ name, quantity, specification, minimumExpiryDays }) => ({
      name,
      quantity,
      specification,
      minimumExpiryDays,
    }),
  );

  return {
    productId: source.productId,
    supplierId: source.supplierId,
    categoryId: source.categoryId,
    templateVersion: source.templateVersion,
    templateProfile: 'GIFT_BOX',
    name: snapshotText(source.detailSnapshot, 'name', source.name),
    brand: source.detailSnapshot.brand === null ? null : snapshotText(source.detailSnapshot, 'brand'),
    sellerName: COMPANY_LEGAL_NAME,
    checkoutMode: 'COMPANY_UNIFIED',
    retailSalePrice: Math.min(...skus.map(({ retailSalePrice }) => retailSalePrice)),
    media: buildCatalogMediaResponse(source.detailSnapshot),
    bundleItems,
    skus,
    detailModules,
  };
};
