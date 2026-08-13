import { requestAdapter } from '../../request-adapter.js';

type PageState = 'empty' | 'error' | 'loading' | 'success';

interface HomePageData {
  state: PageState;
  regionLabel: string;
  entrances: readonly {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly route: string;
  }[];
  products: readonly {
    readonly productId: string;
    readonly name: string;
    readonly priceLabel: string;
    readonly imageUrl: string;
    readonly imageAlt: string;
  }[];
  errorMessage: string;
  emptyMessage: string;
}

interface HomePageInstance {
  data: HomePageData;
  setData(patch: Partial<HomePageData>): void;
  loadProducts(): Promise<void>;
}

interface UserMiniappApplication {
  readonly globalData: { readonly apiBaseUrl: string };
}

const priceLabel = (integerCents: number): string => `¥${(integerCents / 100).toFixed(2)}`;

const entrances = Object.freeze([
  { id: 'search', label: '搜索商品', description: '搜索商品、品牌和福利', route: '/pages/shell/index?entry=search' },
  { id: 'category', label: '全部分类', description: '按公司分类浏览', route: '/pages/category/index' },
  { id: 'campaign', label: '福利活动', description: '查看公司发布的福利说明', route: '/pages/shell/index?entry=campaign' },
  { id: 'welfare-card', label: '福利卡', description: '登录后查看本人福利卡', route: '/pages/shell/index?entry=welfare-card' },
  { id: 'delivery-region', label: '配送区域', description: '按需选择，不强制定位', route: '/pages/shell/index?entry=delivery-region' },
  { id: 'personal-orders', label: '个人订单', description: '登录后查看本人订单', route: '/pages/shell/index?entry=personal-orders' },
]);

const pageDefinition = {
  data: {
    state: 'loading' as PageState,
    regionLabel: '请选择配送区域',
    entrances,
    products: [] as HomePageData['products'],
    errorMessage: '',
    emptyMessage: '暂无可售商品，可稍后刷新或浏览分类',
  },

  async onLoad(this: HomePageInstance): Promise<void> {
    await this.loadProducts();
  },

  async loadProducts(this: HomePageInstance): Promise<void> {
    this.setData({ state: 'loading', errorMessage: '' });
    try {
      const application = getApp<UserMiniappApplication>();
      const baseUrl = application.globalData.apiBaseUrl.replace(/\/$/u, '');
      if (!/^https?:\/\//u.test(baseUrl)) throw new Error('API_BASE_URL_INVALID');
      const response = await requestAdapter.execute('catalog.listProducts', {
        url: `${baseUrl}/v1/catalog/products?page=1&pageSize=20`,
      });
      const products = response.items.map((product) => ({
        productId: product.productId,
        name: product.name,
        priceLabel: priceLabel(product.retailSalePrice),
        imageUrl: product.media[0]?.url ?? '',
        imageAlt: product.media[0]?.alt ?? product.name,
      }));
      this.setData({
        state: products.length > 0 ? 'success' : 'empty',
        regionLabel: response.region.label,
        products,
      });
    } catch {
      this.setData({
        state: 'error',
        products: [],
        errorMessage: '首页加载失败，请检查网络后重试',
      });
    }
  },

  async retry(this: HomePageInstance): Promise<void> {
    await this.loadProducts();
  },
};

Page(pageDefinition);
