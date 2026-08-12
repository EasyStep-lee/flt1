import { Inject, Injectable } from '@nestjs/common';
import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

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
  readonly media: readonly { readonly url: string; readonly alt: string }[];
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

export interface EnterpriseCatalogProductResponse {
  readonly productId: string;
  readonly supplierId: string;
  readonly categoryId: string;
  readonly templateVersion: number;
  readonly name: string;
  readonly media: readonly { readonly url: string; readonly alt: string }[];
  readonly skuIds: readonly string[];
  readonly enterpriseSalePrice: number;
  readonly activeSkuCount: number;
}

export interface EnterpriseCatalogPageResponse {
  readonly sellerName: typeof COMPANY_LEGAL_NAME;
  readonly checkoutMode: 'COMPANY_UNIFIED';
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly items: readonly EnterpriseCatalogProductResponse[];
}

const allowedListQueryKeys = new Set(['page', 'pageSize']);

const integerQuery = (
  value: unknown,
  field: string,
  fallback: number,
  maximum: number,
): number => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/u.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} is outside the supported range`);
  }
  return parsed;
};

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

  async listProducts(
    queryValue: unknown,
    cookieHeader: string | undefined,
  ): Promise<EnterpriseCatalogPageResponse> {
    const viewer = await this.viewerResolver.resolve(cookieHeader);
    if (!viewer || viewer.status !== 'ACTIVE') {
      throw new SafeApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Enterprise authentication is required',
      );
    }
    const query =
      queryValue && typeof queryValue === 'object' && !Array.isArray(queryValue)
        ? (queryValue as Record<string, unknown>)
        : {};
    if (Object.keys(query).some((key) => !allowedListQueryKeys.has(key))) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Unsupported enterprise catalog query field');
    }
    const page = integerQuery(query.page, 'page', 1, 10_000);
    const pageSize = integerQuery(query.pageSize, 'pageSize', 20, 50);
    const repositoryPage = await this.repository.findSellableEnterpriseProducts({ page, pageSize });
    const items = repositoryPage.items.map((source) => {
      if (
        source.saleStatus !== 'ACTIVE' ||
        !source.isEnterpriseProcurementEnabled ||
        source.skus.every(({ status }) => status !== 'ACTIVE')
      ) {
        throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Catalog candidate is not saleable');
      }
      const detail = renameEnterprisePrices(
        this.publicCatalogService.buildProductDetail(enterpriseSource(source)),
      );
      return {
        productId: detail.productId,
        supplierId: detail.supplierId,
        categoryId: detail.categoryId,
        templateVersion: detail.templateVersion,
        name: detail.name,
        media: detail.media,
        skuIds: detail.skus.map(({ skuId }) => skuId),
        enterpriseSalePrice: detail.enterpriseSalePrice,
        activeSkuCount: detail.skus.length,
      };
    });
    const response: EnterpriseCatalogPageResponse = {
      sellerName: COMPANY_LEGAL_NAME,
      checkoutMode: 'COMPANY_UNIFIED',
      page,
      pageSize,
      total: repositoryPage.total,
      items,
    };
    assertCustomerCatalogPayloadAllowed(response);
    assertCatalogPricePayloadAllowed(response, 'ENTERPRISE');
    return response;
  }

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
