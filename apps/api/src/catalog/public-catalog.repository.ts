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

export interface FindPublicCatalogProductsInput {
  readonly supplierId: string;
  readonly excludeProductId?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface PublicCatalogRepository {
  isActiveSupplierSource(supplierId: string): Promise<boolean>;
  findSellableRetailProducts(
    input: FindPublicCatalogProductsInput,
  ): Promise<PublicCatalogPageRecord>;
}
