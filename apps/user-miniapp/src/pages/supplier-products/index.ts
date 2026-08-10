import { requestAdapter } from '../../request-adapter.js';

type PageState = 'loading' | 'success' | 'empty' | 'error';

interface DisplayProduct {
  readonly productId: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly activeSkuCount: number;
}

interface SupplierProductsPageData {
  state: PageState;
  sourceLabel: string;
  sellerName: string;
  checkoutMode: string;
  items: readonly DisplayProduct[];
  errorMessage: string;
  supplierId: string;
  excludeProductId: string;
}

interface SupplierProductsPageInstance {
  data: SupplierProductsPageData;
  setData(patch: Partial<SupplierProductsPageData>): void;
  loadProducts(): Promise<void>;
}

interface UserMiniappApplication {
  readonly globalData: {
    readonly apiBaseUrl: string;
  };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const priceLabel = (integerCents: number): string =>
  `¥${(integerCents / 100).toFixed(2)}`;

const pageDefinition = {
  data: {
    state: 'loading' as PageState,
    sourceLabel: '该供应来源的更多商品',
    sellerName: '江苏福礼团供应链科技有限公司',
    checkoutMode: 'COMPANY_UNIFIED',
    items: [] as readonly DisplayProduct[],
    errorMessage: '',
    supplierId: '',
    excludeProductId: '',
  },

  async onLoad(
    this: SupplierProductsPageInstance,
    options: { readonly supplierId?: string; readonly excludeProductId?: string },
  ): Promise<void> {
    const supplierId = options.supplierId ?? '';
    const excludeProductId = options.excludeProductId ?? '';
    if (
      !uuidPattern.test(supplierId) ||
      (excludeProductId !== '' && !uuidPattern.test(excludeProductId))
    ) {
      this.setData({ state: 'error', errorMessage: '供应来源参数无效' });
      return;
    }
    this.setData({ supplierId, excludeProductId });
    await this.loadProducts();
  },

  async loadProducts(this: SupplierProductsPageInstance): Promise<void> {
    this.setData({ state: 'loading', errorMessage: '' });
    try {
      const application = getApp<UserMiniappApplication>();
      const baseUrl = application.globalData.apiBaseUrl.replace(/\/$/u, '');
      if (!/^https?:\/\//u.test(baseUrl)) throw new Error('API_BASE_URL_INVALID');
      const excludeQuery = this.data.excludeProductId
        ? `?excludeProductId=${encodeURIComponent(this.data.excludeProductId)}`
        : '';
      const response = await requestAdapter.execute(
        'catalog.listSupplierProducts',
        {
          url: `${baseUrl}/v1/catalog/suppliers/${encodeURIComponent(
            this.data.supplierId,
          )}/products${excludeQuery}`,
        },
      );
      const items = response.items.map((product) => ({
        productId: product.productId,
        name: product.name,
        priceLabel: priceLabel(product.retailSalePrice),
        activeSkuCount: product.activeSkuCount,
      }));
      this.setData({
        state: items.length === 0 ? 'empty' : 'success',
        sourceLabel: response.sourceLabel,
        sellerName: response.sellerName,
        checkoutMode: response.checkoutMode,
        items,
      });
    } catch {
      this.setData({
        state: 'error',
        items: [],
        errorMessage: '加载失败，请检查网络后重试',
      });
    }
  },

  async retry(this: SupplierProductsPageInstance): Promise<void> {
    await this.loadProducts();
  },
};

Page(pageDefinition);
