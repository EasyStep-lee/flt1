import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { expect, test } from '@playwright/test';

interface BuiltHomePage {
  data: Record<string, unknown>;
  setData(patch: Record<string, unknown>): void;
  onLoad(): Promise<void>;
}

interface MiniappRequestOptions {
  readonly url: string;
  readonly success: (response: { readonly statusCode: number; readonly data: unknown }) => void;
}

test('P0-020 built user mini-program loads the guest retail home through the generated request contract', async () => {
  let definition: BuiltHomePage | undefined;
  let requestedUrl = '';
  const context = vm.createContext({
    console,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value: Record<string, unknown>) => {
      definition = value as unknown as BuiltHomePage;
    },
    Promise,
    URLSearchParams,
    wx: {
      request: (options: MiniappRequestOptions) => {
        requestedUrl = options.url;
        options.success({
          statusCode: 200,
          data: {
            sellerName: '江苏福礼团供应链科技有限公司',
            checkoutMode: 'COMPANY_UNIFIED',
            region: { code: null, label: '请选择配送区域', status: 'UNSELECTED' },
            page: 1,
            pageSize: 20,
            total: 1,
            items: [
              {
                productId: '11111111-1111-4111-8111-111111111111',
                supplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                categoryId: '22222222-2222-4222-8222-222222222222',
                name: '员工关怀礼盒',
                retailSalePrice: 12800,
                activeSkuCount: 2,
                media: [],
              },
            ],
          },
        });
      },
    },
  });
  vm.runInContext(
    readFileSync(path.resolve('apps/user-miniapp/dist/pages/home/index.js'), 'utf8'),
    context,
  );
  expect(definition).toBeTruthy();
  const runtimePage = definition as BuiltHomePage;
  runtimePage.setData = (patch: Record<string, unknown>) =>
    Object.assign(runtimePage.data, patch);

  await runtimePage.onLoad.call(runtimePage);

  expect(requestedUrl).toBe('https://api.example.test/v1/catalog/products?page=1&pageSize=20');
  expect(runtimePage.data).toMatchObject({
    state: 'success',
    regionLabel: '请选择配送区域',
    products: [{ name: '员工关怀礼盒', priceLabel: '¥128.00' }],
  });
  expect((runtimePage.data.entrances as { id: string }[]).map(({ id }) => id)).toEqual([
    'search',
    'category',
    'campaign',
    'welfare-card',
    'delivery-region',
    'personal-orders',
  ]);
  expect(JSON.stringify(runtimePage.data)).not.toMatch(
    /enterpriseSalePrice|supplyPrice|approvedSupplyPrice|supplierPayable|enterpriseId/iu,
  );

  const appConfig = JSON.parse(
    readFileSync(path.resolve('apps/user-miniapp/dist/app.json'), 'utf8'),
  ) as { pages: string[]; tabBar: { list: { pagePath: string }[] } };
  expect(appConfig.pages[0]).toBe('pages/home/index');
  expect(appConfig.tabBar.list.map(({ pagePath }) => pagePath)).toEqual([
    'pages/home/index',
    'pages/category/index',
    'pages/cart/index',
    'pages/profile/index',
  ]);
});
