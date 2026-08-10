import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { expect, test } from '@playwright/test';

const supplierId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const builtPagePath = path.resolve(
  'apps/user-miniapp/dist/pages/supplier-products/index.js',
);

interface BuiltSupplierProductsPage {
  data: Record<string, unknown>;
  setData(patch: Record<string, unknown>): void;
  onLoad(options: { readonly supplierId: string }): Promise<void>;
}

interface MiniappRequestOptions {
  readonly url: string;
  readonly success: (response: { readonly statusCode: number; readonly data: unknown }) => void;
}

test('P0-010 built user mini-program preserves same-source and unified-checkout behavior', async () => {
  let definition: BuiltSupplierProductsPage | undefined;
  let requestedUrl = '';
  const context = vm.createContext({
    console,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value: Record<string, unknown>) => {
      definition = value as unknown as BuiltSupplierProductsPage;
    },
    Promise,
    URLSearchParams,
    wx: {
      request: (options: MiniappRequestOptions) => {
        requestedUrl = options.url;
        options.success({
          statusCode: 200,
          data: {
            supplierId,
            sourceLabel: '该供应来源的更多商品',
            sellerName: '江苏福礼团供应链科技有限公司',
            checkoutMode: 'COMPANY_UNIFIED',
            page: 1,
            pageSize: 20,
            total: 1,
            items: [
              {
                productId: '11111111-1111-4111-8111-111111111111',
                name: '有机大米礼盒',
                retailSalePrice: 6990,
                activeSkuCount: 1,
              },
            ],
          },
        });
      },
    },
  });
  vm.runInContext(readFileSync(builtPagePath, 'utf8'), context);
  expect(definition).toBeTruthy();
  const runtimePage = definition as BuiltSupplierProductsPage;
  runtimePage.setData = (patch: Record<string, unknown>) =>
    Object.assign(runtimePage.data, patch);

  await runtimePage.onLoad.call(runtimePage, { supplierId });

  expect(requestedUrl).toContain(`/v1/catalog/suppliers/${supplierId}/products`);
  expect(runtimePage.data).toMatchObject({
    state: 'success',
    sourceLabel: '该供应来源的更多商品',
    sellerName: '江苏福礼团供应链科技有限公司',
    checkoutMode: 'COMPANY_UNIFIED',
    items: [{ name: '有机大米礼盒', priceLabel: '¥69.90' }],
  });
  expect(JSON.stringify(runtimePage.data)).not.toMatch(
    /supplyPrice|settlement|storefront|storeCart|storeCoupon/iu,
  );
});
