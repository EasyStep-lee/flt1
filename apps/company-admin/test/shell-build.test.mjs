import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

test('company admin produces a deployable noindex shell bundle', () => {
  const html = readFileSync(path.join(packageRoot, 'dist', 'index.html'), 'utf8');
  const assetsDir = path.join(packageRoot, 'dist', 'assets');
  const javascript = readdirSync(assetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(path.join(assetsDir, file), 'utf8'))
    .join('\n');
  assert.match(html, /\/company-admin\/assets\//u);
  assert.match(html, /noindex,nofollow/u);
  assert.match(javascript, /company-admin-shell/u);
});

test('P0-066 bundle contains the independent login and server-bound account selection pages', () => {
  const assetsDir = path.join(packageRoot, 'dist', 'assets');
  const javascript = readdirSync(assetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(path.join(assetsDir, file), 'utf8'))
    .join('\n');

  assert.match(javascript, /\/company-admin\/login/u);
  assert.match(javascript, /\/company-admin\/account-select/u);
  assert.match(javascript, /账号或手机号/u);
  assert.match(javascript, /选择职能账号/u);
  assert.match(javascript, /每次只激活一个固定职能页面/u);
  assert.doesNotMatch(javascript, /公司注册|注册公司账号|主体名称.*上传凭证/iu);
  assert.doesNotMatch(javascript, /手工输入.*accountId|手工输入.*ownerId/iu);
});

test('P0-028 supplier-ops workspace contains the company enterprise certification review panel', () => {
  const assetsDir = path.join(packageRoot, 'dist', 'assets');
  const javascript = readdirSync(assetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(path.join(assetsDir, file), 'utf8'))
    .join('\n');

  assert.match(javascript, /企业采购认证审核/u);
  assert.match(javascript, /COMPANY_SUPPLIER_OPS/u);
  assert.match(javascript, /\/v1\/company\/enterprise-registrations/u);
  assert.match(javascript, /要求补正开票资料/u);
  assert.doesNotMatch(javascript, /supplierWallet|自动打款|供应商直接收款/iu);
});
