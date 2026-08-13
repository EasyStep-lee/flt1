import type { CategoryTemplateDefinition } from '../category-templates/category-template.policy.js';

export const PUBLIC_CATALOG_REPOSITORY = Symbol('PUBLIC_CATALOG_REPOSITORY');

export interface PublicCatalogProductRecord {
  readonly productId: string;
  readonly supplierId: string;
  readonly name: string;
  readonly saleStatus: 'ACTIVE' | 'OFF_SHELF' | 'ARCHIVED';
  readonly isRetailEnabled: boolean;
  readonly retailSalePrice: number;
  readonly activeSkuCount: number;
}
export interface PublicCatalogPageRecord {
  readonly total: number;
  readonly items: readonly PublicCatalogProductRecord[];
}

export interface PublicRetailCatalogProductRecord extends PublicCatalogProductRecord {
  readonly categoryId: string;
  readonly media: readonly { readonly url: string; readonly alt: string }[];
}

export interface PublicRetailCatalogPageRecord {
  readonly total: number;
  readonly items: readonly PublicRetailCatalogProductRecord[];
}

export interface PublicCatalogProductDetailRecord {
  readonly productId: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly name: string;
  readonly saleStatus: 'ACTIVE' | 'OFF_SHELF' | 'ARCHIVED';
  readonly isRetailEnabled: boolean;
  readonly isEnterpriseProcurementEnabled: boolean;
  readonly detailSnapshot: Readonly<Record<string, unknown>>;
  readonly template: CategoryTemplateDefinition;
  readonly skus: readonly {
    readonly skuId: string;
    readonly status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
    readonly retailSalePrice: number;
    readonly enterpriseSalePrice: number;
    readonly attributes: Readonly<Record<string, unknown>>;
  }[];
}

export interface FindPublicCatalogProductsInput {
  readonly supplierId: string;
  readonly excludeProductId?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface FindEnterpriseCatalogProductsInput {
  readonly page: number;
  readonly pageSize: number;
}

export interface EnterpriseCatalogPageRecord {
  readonly total: number;
  readonly items: readonly PublicCatalogProductDetailRecord[];
}

export interface PublicCatalogRepository {
  isActiveSupplierSource(supplierId: string): Promise<boolean>;
  findSellableProductDetail(productId: string): Promise<PublicCatalogProductDetailRecord | null>;
  findSellableRetailProducts(
    input: FindPublicCatalogProductsInput,
  ): Promise<PublicCatalogPageRecord>;
  findSellableRetailCatalogProducts(
    input: Omit<FindPublicCatalogProductsInput, 'excludeProductId' | 'supplierId'>,
  ): Promise<PublicRetailCatalogPageRecord>;
  findSellableEnterpriseProducts(
    input: FindEnterpriseCatalogProductsInput,
  ): Promise<EnterpriseCatalogPageRecord>;
}
