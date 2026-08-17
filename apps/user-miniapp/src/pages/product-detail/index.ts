import { MiniappTransportError } from '@fulishe/miniapp-kit';

import { requestAdapter } from '../../request-adapter.js';

type PageState = 'error' | 'loading' | 'success';

interface ProductDetailPageData {
  state: PageState;
  productId: string;
  name: string;
  brand: string;
  profileLabel: string;
  sellerName: string;
  priceLabel: string;
  checkoutLabel: string;
  detailModules: readonly {
    readonly key: string;
    readonly title: string;
    readonly kind: 'AFTER_SALE' | 'FIELDS' | 'FIXED_NOTICE';
    readonly fields: readonly { readonly key: string; readonly label: string; readonly value: string }[];
    readonly notice: string;
  }[];
  bundleItems: readonly {
    readonly key: string;
    readonly name: string;
    readonly quantityLabel: string;
    readonly specification: string;
    readonly minimumExpiryLabel: string;
  }[];
  skus: readonly {
    readonly skuId: string;
    readonly priceLabel: string;
    readonly specificationLabel: string;
    readonly welfareEligibilityLabel: string;
  }[];
  welfareScopeSummary: string;
  errorMessage: string;
}

interface ProductDetailPageInstance {
  data: ProductDetailPageData;
  setData(patch: Partial<ProductDetailPageData>): void;
  loadProduct(): Promise<void>;
  loadWelfareEligibility(): Promise<void>;
}

interface UserMiniappApplication {
  readonly globalData: { readonly apiBaseUrl: string };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const priceLabel = (integerCents: number): string => `¥${(integerCents / 100).toFixed(2)}`;

const pageDefinition = {
  data: {
    state: 'loading' as PageState,
    productId: '',
    name: '',
    brand: '',
    profileLabel: '商品详情',
    sellerName: '江苏福礼团供应链科技有限公司',
    priceLabel: '',
    checkoutLabel: '公司统一销售、结账与售后',
    detailModules: [] as ProductDetailPageData['detailModules'],
    bundleItems: [] as ProductDetailPageData['bundleItems'],
    skus: [] as ProductDetailPageData['skus'],
    welfareScopeSummary: '登录后查看福利卡适用范围',
    errorMessage: '',
  },

  async onLoad(
    this: ProductDetailPageInstance,
    options: { readonly productId?: string },
  ): Promise<void> {
    const productId = options.productId ?? '';
    if (!uuidPattern.test(productId)) {
      this.setData({ state: 'error', errorMessage: '商品参数无效' });
      return;
    }
    this.setData({ productId });
    await this.loadProduct();
  },

  async loadProduct(this: ProductDetailPageInstance): Promise<void> {
    this.setData({ state: 'loading', errorMessage: '' });
    try {
      const application = getApp<UserMiniappApplication>();
      const baseUrl = application.globalData.apiBaseUrl.replace(/\/$/u, '');
      if (!/^https?:\/\//u.test(baseUrl)) throw new Error('API_BASE_URL_INVALID');
      const response = await requestAdapter.execute('catalog.getProductDetail', {
        url: `${baseUrl}/v1/catalog/products/${encodeURIComponent(this.data.productId)}`,
      });
      this.setData({
        state: 'success',
        name: response.name,
        brand: response.brand ?? '品牌信息以商品包装为准',
        profileLabel:
          response.templateProfile === 'FRESH'
            ? '生鲜详情'
            : response.templateProfile === 'APPAREL'
              ? '服饰详情'
              : response.templateProfile === 'DIGITAL'
                ? '数码详情'
                : response.templateProfile === 'GIFT_BOX'
                  ? '礼盒详情'
                : '食品详情',
        sellerName: response.sellerName,
        priceLabel: priceLabel(response.retailSalePrice),
        checkoutLabel:
          response.checkoutMode === 'COMPANY_UNIFIED'
            ? '公司统一销售、结账与售后'
            : '结账方式不可用',
        detailModules: response.detailModules.map((module) => ({
          key: module.key,
          title: module.title,
          kind: module.kind,
          fields: module.fields,
          notice: module.notice ?? '',
        })),
        bundleItems: (response.bundleItems ?? []).map((item, index) => ({
          key: `${index}-${item.name}-${item.specification}`,
          name: item.name,
          quantityLabel: `× ${item.quantity}`,
          specification: item.specification,
          minimumExpiryLabel: `有效期下限 ${item.minimumExpiryDays} 天`,
        })),
        skus: response.skus.map((sku) => ({
          skuId: sku.skuId,
          priceLabel: priceLabel(sku.retailSalePrice),
          specificationLabel: sku.specifications
            .map(({ label, value }) => `${label}：${value}`)
            .join(' · '),
          welfareEligibilityLabel: '正在判断福利卡适用范围…',
        })),
      });
      await this.loadWelfareEligibility();
    } catch {
      this.setData({
        state: 'error',
        detailModules: [],
        bundleItems: [],
        skus: [],
        errorMessage: '详情加载失败，请检查网络后重试',
      });
    }
  },

  async loadWelfareEligibility(this: ProductDetailPageInstance): Promise<void> {
    if (this.data.skus.length === 0) return;
    try {
      const application = getApp<UserMiniappApplication>();
      const baseUrl = application.globalData.apiBaseUrl.replace(/\/$/u, '');
      const query = this.data.skus
        .flatMap(({ skuId }) => [`skuId=${encodeURIComponent(skuId)}`, 'quantity=1'])
        .join('&');
      const response = await requestAdapter.execute('consumerWelfareCard.listEligibleAccounts', {
        method: 'GET',
        url: `${baseUrl}/v1/consumer/welfare-card-accounts/eligible?${query}`,
      });
      const eligibleSkuIds = new Set(response.accounts.flatMap((account) => account.itemApplicability)
        .filter(({ eligible }) => eligible)
        .map(({ skuId }) => skuId));
      const skus = this.data.skus.map((sku) => ({
        ...sku,
        welfareEligibilityLabel: eligibleSkuIds.has(sku.skuId) ? '福利卡可用' : '当前福利卡账户不可用',
      }));
      const eligibleCount = skus.filter(({ welfareEligibilityLabel }) => welfareEligibilityLabel === '福利卡可用').length;
      this.setData({
        skus,
        welfareScopeSummary: eligibleCount === skus.length
          ? '当前福利卡账户可用'
          : eligibleCount > 0 ? '部分规格福利卡可用' : '当前福利卡账户不可用',
      });
    } catch (error) {
      const permission = error instanceof MiniappTransportError && (error.statusCode === 401 || error.statusCode === 403);
      const label = permission ? '登录后查看福利卡适用范围' : '福利卡适用范围暂时无法判断';
      this.setData({
        welfareScopeSummary: label,
        skus: this.data.skus.map((sku) => ({ ...sku, welfareEligibilityLabel: label })),
      });
    }
  },

  async retry(this: ProductDetailPageInstance): Promise<void> {
    await this.loadProduct();
  },
};

Page(pageDefinition);
