import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { expect, test } from '@playwright/test';

interface BuiltCartPage {
  data: Record<string, unknown>;
  setData(patch: Record<string, unknown>): void;
  onLoad(): void;
  submitOrder(): Promise<void>;
}

interface MiniappRequestOptions {
  readonly data: unknown;
  readonly header: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
  readonly success: (response: { readonly statusCode: number; readonly data: unknown }) => void;
}

test('P0-022 built cart submits three supplier groups as one company order command', async () => {
  let definition: BuiltCartPage | undefined;
  let captured: MiniappRequestOptions | undefined;
  const storage = new Map<string, unknown>([
    ['fulishe.pendingCartItems', [
      { skuId: '30000000-0000-4000-8000-000000000001', supplierId: '20000000-0000-4000-8000-000000000001', supplierLabel: '供应来源甲', productName: '商品甲', quantity: 1, retailSalePrice: 1200 },
      { skuId: '30000000-0000-4000-8000-000000000002', supplierId: '20000000-0000-4000-8000-000000000002', supplierLabel: '供应来源乙', productName: '商品乙', quantity: 2, retailSalePrice: 2300 },
      { skuId: '30000000-0000-4000-8000-000000000003', supplierId: '20000000-0000-4000-8000-000000000003', supplierLabel: '供应来源丙', productName: '商品丙', quantity: 3, retailSalePrice: 3400 },
    ]],
  ]);
  const context = vm.createContext({
    console,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value: Record<string, unknown>) => { definition = value as unknown as BuiltCartPage; },
    Promise,
    wx: {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
      removeStorageSync: (key: string) => storage.delete(key),
      request: (options: MiniappRequestOptions) => {
        captured = options;
        options.success({
          statusCode: 201,
          data: {
            orderId: '60000000-0000-4000-8000-000000000001', orderNo: 'FS202608140000000001',
            orderType: 'CONSUMER', sellerName: '江苏福礼团供应链科技有限公司', checkoutMode: 'COMPANY_UNIFIED',
            goodsAmount: 16000, deliveryFee: 0, discountAmount: 0, totalAmount: 16000,
            paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT', items: [], supplierFulfillments: [],
          },
        });
      },
    },
  });
  vm.runInContext(
    readFileSync(path.resolve('apps/user-miniapp/dist/pages/cart/index.js'), 'utf8'),
    context,
  );
  expect(definition).toBeTruthy();
  const page = definition as BuiltCartPage;
  page.setData = (patch: Record<string, unknown>) => Object.assign(page.data, patch);
  page.onLoad.call(page);
  expect(page.data).toMatchObject({ state: 'ready', totalAmountLabel: '¥160.00' });
  expect(page.data.groups).toHaveLength(3);

  await page.submitOrder.call(page);

  expect(captured).toBeTruthy();
  expect(captured?.url).toBe('https://api.example.test/v1/consumer/orders');
  expect(captured?.method).toBe('POST');
  expect(captured?.header['Idempotency-Key']).toMatch(/^consumer-order-/u);
  expect(captured?.data).toEqual({
    items: [
      { skuId: '30000000-0000-4000-8000-000000000001', quantity: 1 },
      { skuId: '30000000-0000-4000-8000-000000000002', quantity: 2 },
      { skuId: '30000000-0000-4000-8000-000000000003', quantity: 3 },
    ],
  });
  expect(JSON.stringify(captured?.data)).not.toMatch(/supplierId|companyId|price|amount|buyerId/iu);
  expect(page.data).toMatchObject({ state: 'success', orderNo: 'FS202608140000000001' });
});
