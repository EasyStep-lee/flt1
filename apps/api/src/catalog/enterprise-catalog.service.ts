import { Inject, Injectable } from '@nestjs/common';

import { assertCustomerCatalogPayloadAllowed } from '../governance/no-supplier-storefront.policy.js';
import { SafeApiError } from '../http/api-error.js';
import { assertCatalogPricePayloadAllowed } from './catalog-price-isolation.policy.js';
import {
  ENTERPRISE_CATALOG_VIEWER_RESOLVER,
  type EnterpriseCatalogViewerResolver,
} from './enterprise-catalog-viewer.resolver.js';
import {
  PUBLIC_CATALOG_REPOSITORY,
  type PublicCatalogProductDetailRecord,
  type PublicCatalogRepository,
} from './public-catalog.repository.js';
import {
  PublicCatalogService,
  type PublicProductDetailResponse,
} from './public-catalog.service.js';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface EnterpriseProductDetailResponse {
  readonly productId: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly templateProfile: 'FOOD' | 'FRESH' | 'APPAREL' | 'DIGITAL' | 'GIFT_BOX';
  readonly name: string;
  readonly brand: string | null;
  readonly sellerName: string;
  readonly checkoutMode: 'COMPANY_UNIFIED';
  readonly enterpriseSalePrice: number;
  readonly skus: readonly {
    readonly skuId: string;
    readonly enterpriseSalePrice: number;
    readonly specifications: readonly {
      readonly key: string;
      readonly label: string;
      readonly value: string;
    }[];
  }[];
  readonly detailModules: readonly unknown[];
  readonly bundleItems?: readonly unknown[];
}

const enterpriseSource = (
  source: PublicCatalogProductDetailRecord,
): PublicCatalogProductDetailRecord => ({
  ...source,
  isRetailEnabled: source.isEnterpriseProcurementEnabled,
  skus: source.skus.map((sku) => ({
    ...sku,
    retailSalePrice: sku.enterpriseSalePrice,
  })),
});

const renameEnterprisePrices = (
  response: PublicProductDetailResponse,
): EnterpriseProductDetailResponse => {
  const { retailSalePrice, skus, ...detail } = response;
  return {
    ...detail,
    enterpriseSalePrice: retailSalePrice,
    skus: skus.map(({ retailSalePrice: skuPrice, ...sku }) => ({
      ...sku,
      enterpriseSalePrice: skuPrice,
    })),
  } as EnterpriseProductDetailResponse;
};

@Injectable()
export class EnterpriseCatalogService {
  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY)
    private readonly repository: PublicCatalogRepository,
    @Inject(ENTERPRISE_CATALOG_VIEWER_RESOLVER)
    private readonly viewerResolver: EnterpriseCatalogViewerResolver,
    @Inject(PublicCatalogService)
    private readonly publicCatalogService: PublicCatalogService,
  ) {}

  async getProductDetail(
    productIdValue: unknown,
    cookieHeader: string | undefined,
  ): Promise<EnterpriseProductDetailResponse> {
    const viewer = await this.viewerResolver.resolve(cookieHeader);
    if (!viewer || viewer.status !== 'ACTIVE') {
      throw new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Enterprise authentication is required',
      );
    }
    if (typeof productIdValue !== 'string' || !uuidPattern.test(productIdValue)) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'productId must be a UUID');
    }

    const source = await this.repository.findSellableProductDetail(productIdValue);
    if (!source) {
      throw new SafeApiError(404, 'PRODUCT_NOT_FOUND', 'Product was not found');
    }
    if (!source.isEnterpriseProcurementEnabled) {
      throw new SafeApiError(
        409,
        'PRODUCT_NOT_SALEABLE',
        'Product is not enabled for enterprise procurement',
      );
    }

    const response = renameEnterprisePrices(
      this.publicCatalogService.buildProductDetail(enterpriseSource(source)),
    );
    assertCustomerCatalogPayloadAllowed(response);
    assertCatalogPricePayloadAllowed(response, 'ENTERPRISE');
    return response;
  }
}
