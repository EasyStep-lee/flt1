import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

const loadBindPage = ({ failFirst = false } = {}) => {
  let definition;
  let attempts = 0;
  const requests = [];
  const storage = new Map();
  const context = vm.createContext({
    console,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value) => { definition = value; },
    Promise,
    wx: {
      getStorageSync: (key) => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
      removeStorageSync: (key) => storage.delete(key),
      scanCode: (options) => options.success({ result: 'FULISHE:CARD-SCAN:scan-0003' }),
      request: (options) => {
        attempts += 1;
        requests.push({ data: structuredClone(options.data), header: structuredClone(options.header), method: options.method, url: options.url });
        if (failFirst && attempts === 1) return options.fail({ errMsg: 'request:fail timeout' });
        return options.success({
          data: {
            id: '30000000-0000-4000-8000-000000000001', programName: '2026 员工福利',
            batchNo: 'WCB-2026-ACTIVE', maskedCardNo: '****SCAN', balanceAmount: 10000,
            frozenAmount: 0, availableAmount: 10000, status: 'ACTIVE', version: 0,
            claimedAt: new Date(0).toISOString(),
          },
          statusCode: attempts === 1 ? 201 : 200,
        });
      },
    },
  });
  vm.runInContext(readFileSync(path.join(packageRoot, 'dist', 'pages', 'welfare-card-bind', 'index.js'), 'utf8'), context);
  definition.setData = (patch) => Object.assign(definition.data, patch);
  return { definition, requests, storage };
};

test('P0-052 scan binding uses the generated miniapp request adapter and sends no owner field', async () => {
  const runtime = loadBindPage();
  runtime.definition.setData({ agreementAccepted: true });
  await runtime.definition.scanAndBind.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.requests.length, 1);
  assert.equal(runtime.requests[0].method, 'POST');
  assert.match(runtime.requests[0].url, /\/v1\/consumer\/welfare-card-accounts\/bind$/u);
  const scanCredential = 'scan-0003';
  assert.deepEqual({ ...runtime.requests[0].data }, {
    agreementAccepted: true, agreementVersion: 1,
    method: 'SCAN_CODE', cardNo: 'CARD-SCAN', secret: scanCredential,
  });
  assert.doesNotMatch(JSON.stringify(runtime.requests[0].data), /companyId|consumerUserId|buyerId|supplierId/iu);
});

test('P0-052 unknown result keeps and reuses the exact idempotency key', async () => {
  const runtime = loadBindPage({ failFirst: true });
  const cardCredential = 'pw-0001';
  runtime.definition.setData({
    agreementAccepted: true, cardNo: 'CARD-PASSWORD', method: 'CARD_PASSWORD', credential: cardCredential,
  });
  await runtime.definition.submitBinding.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'unknown');
  const firstKey = runtime.requests[0].header['Idempotency-Key'];
  runtime.definition.setData({ credential: cardCredential });
  await runtime.definition.submitBinding.call(runtime.definition);
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.requests[1].header['Idempotency-Key'], firstKey);
  assert.equal(runtime.storage.has('fulishe.pendingWelfareCardBinding'), false);
});

test('PAGE-062 and PAGE-064 expose binding states without recharge, transfer or withdrawal capability', () => {
  const appJson = JSON.parse(readFileSync(path.join(packageRoot, 'dist', 'app.json'), 'utf8'));
  assert.ok(appJson.pages.includes('pages/welfare-card/index'));
  assert.ok(appJson.pages.includes('pages/welfare-card-bind/index'));
  const home = readFileSync(path.join(packageRoot, 'dist', 'pages', 'welfare-card', 'index.wxml'), 'utf8');
  const binding = readFileSync(path.join(packageRoot, 'dist', 'pages', 'welfare-card-bind', 'index.wxml'), 'utf8');
  assert.match(`${home}${binding}`, /loading|empty|error|permission|offline|success|unknown/iu);
  assert.doesNotMatch(`${home}${binding}`, /PERSONAL_RECHARGE|url=["'][^"']*(?:recharge|withdraw|transfer)|bindtap=["'][^"']*(?:recharge|withdraw|transfer)/iu);
});
