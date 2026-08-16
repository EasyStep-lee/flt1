import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { expect, test } from '@playwright/test';

interface BuiltBindingPage {
  data: Record<string, unknown>;
  setData(patch: Record<string, unknown>): void;
  scanAndBind(): Promise<void>;
  submitBinding(): Promise<void>;
}

test('P0-052 built user mini-program binds a scanned card through API-038 without owner or plaintext persistence', async () => {
  let definition: BuiltBindingPage | undefined;
  const requests: { data: Record<string, unknown>; header: Record<string, string>; url: string }[] = [];
  const storage = new Map<string, unknown>();
  const context = vm.createContext({
    console,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value: Record<string, unknown>) => { definition = value as unknown as BuiltBindingPage; },
    Promise,
    wx: {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
      removeStorageSync: (key: string) => storage.delete(key),
      scanCode: (options: { success: (result: { result: string }) => void }) => options.success({ result: 'FULISHE:CARD-SCAN:scan-0003' }),
      request: (options: {
        data: Record<string, unknown>;
        header: Record<string, string>;
        success: (response: { statusCode: number; data: unknown }) => void;
        url: string;
      }) => {
        requests.push({ data: structuredClone(options.data), header: structuredClone(options.header), url: options.url });
        options.success({
          statusCode: 201,
          data: {
            id: '30000000-0000-4000-8000-000000000001',
            programName: '2026 员工福利', batchNo: 'WCB-2026-ACTIVE', maskedCardNo: '****SCAN',
            balanceAmount: 10000, frozenAmount: 0, availableAmount: 10000,
            status: 'ACTIVE', version: 0, claimedAt: new Date(0).toISOString(),
          },
        });
      },
    },
  });
  vm.runInContext(
    readFileSync(path.resolve('apps/user-miniapp/dist/pages/welfare-card-bind/index.js'), 'utf8'),
    context,
  );
  expect(definition).toBeTruthy();
  const runtimePage = definition as BuiltBindingPage;
  runtimePage.setData = (patch: Record<string, unknown>) => Object.assign(runtimePage.data, patch);
  runtimePage.setData({ agreementAccepted: true });
  await runtimePage.scanAndBind.call(runtimePage);

  expect(runtimePage.data).toMatchObject({
    state: 'success', programName: '2026 员工福利', maskedCardNo: '****SCAN', availableAmountLabel: '¥100.00', secret: '',
  });
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://api.example.test/v1/consumer/welfare-card-accounts/bind');
  expect(requests[0].data).toEqual({
    agreementAccepted: true, agreementVersion: 1, method: 'SCAN_CODE', cardNo: 'CARD-SCAN', secret: 'scan-0003',
  });
  expect(JSON.stringify(requests[0].data)).not.toMatch(/companyId|consumerUserId|buyerId|supplierId/iu);
  expect(JSON.stringify([...storage.values()])).not.toContain('scan-0003');

  const appConfig = JSON.parse(readFileSync(path.resolve('apps/user-miniapp/dist/app.json'), 'utf8')) as { pages: string[] };
  expect(appConfig.pages).toEqual(expect.arrayContaining(['pages/welfare-card/index', 'pages/welfare-card-bind/index']));
});
