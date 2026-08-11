import { Inject, Injectable } from '@nestjs/common';
import { COMPANY_LEGAL_NAME } from '@fulishe/contracts';

import {
  NoSupplierStorefrontCapabilityError,
  assertCustomerCatalogPayloadAllowed,
} from '../governance/no-supplier-storefront.policy.js';
import { SafeApiError } from '../http/api-error.js';
import {
  PUBLIC_CATALOG_REPOSITORY,
  type PublicCatalogRepository,
} from './public-catalog.repository.js';
import {
  buildApparelProductDetailResponse,
  type PublicApparelProductDetailResponse,
} from './apparel-product-detail.policy.js';
import {
  buildFoodProductDetailResponse,
  type PublicFoodProductDetailResponse,
} from './food-product-detail.policy.js';
import {
  buildFreshProductDetailResponse,
  type PublicFreshProductDetailResponse,
} from './fresh-product-detail.policy.js';
import {
  buildDigitalProductDetailResponse,
  type PublicDigitalProductDetailResponse,
} from './digital-product-detail.policy.js';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const allowedQueryKeys = new Set(['excludeProductId', 'page', 'pageSize']);

export interface PublicCatalogProductResponse {
  readonly productId: string;
  readonly name: string;
  readonly retailSalePrice: number;
  readonly activeSkuCount: number;
}
export interface PublicCatalogPageResponse {
  readonly supplierId: string;
  readonly sourceLabel: '该供应来源的更多商品';
  readonly sellerName: typeof COMPANY_LEGAL_NAME;
  readonly checkoutMode: 'COMPANY_UNIFIED';
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly items: readonly PublicCatalogProductResponse[];
}

export type PublicProductDetailResponse =
  | PublicFoodProductDetailResponse
  | PublicFreshProductDetailResponse
  | PublicApparelProductDetailResponse
  | PublicDigitalProductDetailResponse;

const requireUuid = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new SafeApiError(422, 'VALIDATION_FAILED', `${field} must be a UUID`);
  }
  return value;
};

const optionalUuid = (value: unknown, field: string): string | undefined => {
  if (value === undefined) return undefined;
  return requireUuid(value, field);
};

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

@Injectable()
export class PublicCatalogService {
  constructor(
    @Inject(PUBLIC_CATALOG_REPOSITORY)
    private readonly repository: PublicCatalogRepository,
  ) {}

  async getProductDetail(productIdValue: unknown): Promise<PublicProductDetailResponse> {
    const productId = requireUuid(productIdValue, 'productId');
    const source = await this.repository.findSellableProductDetail(productId);
    if (!source) {
      throw new SafeApiError(404, 'PRODUCT_NOT_FOUND', 'Product was not found');
    }
    const response =
      source.template.profile === 'FOOD'
        ? buildFoodProductDetailResponse(source)
        : source.template.profile === 'FRESH'
          ? buildFreshProductDetailResponse(source)
          : source.template.profile === 'APPAREL'
            ? buildApparelProductDetailResponse(source)
            : source.template.profile === 'DIGITAL'
              ? buildDigitalProductDetailResponse(source)
              : (() => {
                throw new SafeApiError(
                  409,
                  'PRODUCT_NOT_SALEABLE',
                  'Product detail template is not supported on the public shelf',
                );
                })();
    assertCustomerCatalogPayloadAllowed(response);
    return response;
  }

  async listSupplierProducts(
    supplierIdValue: unknown,
    queryValue: unknown,
  ): Promise<PublicCatalogPageResponse> {
    const supplierId = requireUuid(supplierIdValue, 'supplierId');
    const query =
      queryValue && typeof queryValue === 'object' && !Array.isArray(queryValue)
        ? (queryValue as Record<string, unknown>)
        : {};
    try {
      assertCustomerCatalogPayloadAllowed(query);
    } catch (error) {
      if (error instanceof NoSupplierStorefrontCapabilityError) {
        throw new SafeApiError(400, error.code, 'Supplier storefront capability is forbidden');
      }
      throw error;
    }
    if (Object.keys(query).some((key) => !allowedQueryKeys.has(key))) {
      throw new SafeApiError(422, 'VALIDATION_FAILED', 'Unsupported catalog query field');
    }

    const excludeProductId = optionalUuid(query.excludeProductId, 'excludeProductId');
    const page = integerQuery(query.page, 'page', 1, 10_000);
    const pageSize = integerQuery(query.pageSize, 'pageSize', 20, 50);
    if (!(await this.repository.isActiveSupplierSource(supplierId))) {
      throw new SafeApiError(404, 'SUPPLIER_NOT_ACTIVE', 'Supplier source is not active');
    }

    const repositoryPage = await this.repository.findSellableRetailProducts({
      supplierId,
      ...(excludeProductId ? { excludeProductId } : {}),
      page,
      pageSize,
    });
    for (const product of repositoryPage.items) {
      if (product.supplierId !== supplierId) {
        throw new SafeApiError(403, 'SUPPLIER_SCOPE_FORBIDDEN', 'Supplier catalog scope mismatch');
      }
      if (
        product.saleStatus !== 'ACTIVE' ||
        !product.isRetailEnabled ||
        product.activeSkuCount < 1 ||
        !Number.isSafeInteger(product.retailSalePrice) ||
        product.retailSalePrice < 0
      ) {
        throw new SafeApiError(409, 'PRODUCT_NOT_SALEABLE', 'Catalog candidate is not saleable');
      }
    }

    const response: PublicCatalogPageResponse = {
      supplierId,
      sourceLabel: '该供应来源的更多商品',
      sellerName: COMPANY_LEGAL_NAME,
      checkoutMode: 'COMPANY_UNIFIED',
      page,
      pageSize,
      total: repositoryPage.total,
      items: repositoryPage.items.map((product) => ({
        productId: product.productId,
        name: product.name,
        retailSalePrice: product.retailSalePrice,
        activeSkuCount: product.activeSkuCount,
      })),
    };
    assertCustomerCatalogPayloadAllowed(response);
    return response;
  }
}
