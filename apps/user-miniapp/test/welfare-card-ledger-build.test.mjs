import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

const loadLedgerPage = ({ statusCode = 200, failMessage } = {}) => {
  let definition;
  const requests = [];
  const context = vm.createContext({
    console,
    getApp: () => ({ globalData: { apiBaseUrl: 'https://api.example.test' } }),
    Page: (value) => { definition = value; },
    Promise,
    wx: {
      getStorageSync: () => 'consumer-session-token',
      request: (options) => {
        requests.push({
          data: options.data,
          header: structuredClone(options.header),
          method: options.method,
          url: options.url,
        });
        if (failMessage) return options.fail({ errMsg: failMessage });
        return options.success({
          data: statusCode === 200 ? {
            account: {
              id: '30000000-0000-4000-8000-000000000001',
              programName: '2026 员工福利', maskedCardNo: '****0001',
              balanceAmount: 8800, frozenAmount: 800, availableAmount: 8000,
              status: 'ACTIVE', version: 3,
            },
            items: [{
              sequence: 1, businessType: 'GRANT', direction: 'CREDIT', amount: 8800,
              beforeBalance: 0, afterBalance: 8800, beforeFrozen: 0, afterFrozen: 0,
              occurredAt: '2026-08-20T00:00:00.000Z',
            }],
          } : { code: 'WELFARE_LEDGER_SCOPE_FORBIDDEN', message: 'scope forbidden' },
          statusCode,
        });
      },
    },
  });
  vm.runInContext(readFileSync(path.join(packageRoot, 'dist', 'pages', 'welfare-card-detail', 'index.js'), 'utf8'), context);
  definition.setData = (patch) => Object.assign(definition.data, patch);
  return { definition, requests };
};

test('P0-059 PAGE-063 reads the selected account through the sole generated miniapp adapter', async () => {
  const runtime = loadLedgerPage();
  runtime.definition.onLoad.call(runtime.definition, { accountId: '30000000-0000-4000-8000-000000000001' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(runtime.definition.data.state, 'success');
  assert.equal(runtime.definition.data.availableLabel, '¥80.00');
  assert.equal(runtime.definition.data.items[0].businessType, '企业福利发放');
  assert.deepEqual(runtime.requests.map(({ method, url }) => ({ method, url })), [{
    method: 'GET',
    url: 'https://api.example.test/v1/consumer/welfare-card-accounts/30000000-0000-4000-8000-000000000001/ledger',
  }]);
  assert.equal(runtime.requests[0].data, undefined);
  assert.doesNotMatch(JSON.stringify(runtime.requests), /buyerId|consumerUserId|companyId|supplierId|functionalAccountId/iu);
});

test('P0-059 PAGE-063 fails closed for another account and exposes offline recovery', async () => {
  const forbidden = loadLedgerPage({ statusCode: 404 });
  forbidden.definition.onLoad.call(forbidden.definition, { accountId: '30000000-0000-4000-8000-000000000002' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(forbidden.definition.data.state, 'permission');

  const offline = loadLedgerPage({ failMessage: 'request:fail timeout' });
  offline.definition.onLoad.call(offline.definition, { accountId: '30000000-0000-4000-8000-000000000001' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(offline.definition.data.state, 'offline');
});

test('P0-059 PAGE-063 renders account and append-only ledger states without recharge or sensitive fields', () => {
  const appJson = JSON.parse(readFileSync(path.join(packageRoot, 'dist', 'app.json'), 'utf8'));
  const markup = readFileSync(path.join(packageRoot, 'dist', 'pages', 'welfare-card-detail', 'index.wxml'), 'utf8');
  const script = readFileSync(path.join(packageRoot, 'dist', 'pages', 'welfare-card-detail', 'index.js'), 'utf8');
  assert.ok(appJson.pages.includes('pages/welfare-card-detail/index'));
  assert.match(markup, /PAGE-063|福利卡详情|资金流水|loading|permission|offline|empty/iu);
  assert.match(script, /consumerWelfareCard\.getLedger/iu);
  assert.doesNotMatch(`${markup}${script}`, /PERSONAL_RECHARGE|recharge|withdraw|transfer|supplyPrice|identityId|ownerConsumerUserId/iu);
});
