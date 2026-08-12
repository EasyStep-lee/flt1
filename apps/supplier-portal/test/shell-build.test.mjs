import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

test('supplier portal produces a deployable noindex shell bundle', () => {
  const html = readFileSync(path.join(packageRoot, 'dist', 'index.html'), 'utf8');
  const assetsDir = path.join(packageRoot, 'dist', 'assets');
  const javascript = readdirSync(assetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(path.join(assetsDir, file), 'utf8'))
    .join('\n');
  assert.match(html, /\/supplier\/assets\//u);
  assert.match(html, /noindex,nofollow/u);
  assert.match(javascript, /supplier-portal-shell/u);
});

test('P0-069 bundle separates registration, login and server-bound account selection', () => {
  const assetsDir = path.join(packageRoot, 'dist', 'assets');
  const javascript = readdirSync(assetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(path.join(assetsDir, file), 'utf8'))
    .join('\n');

  assert.match(javascript, /PAGE-013/u);
  assert.match(javascript, /PAGE-014/u);
  assert.match(javascript, /PAGE-015/u);
  assert.match(javascript, /\/supplier\/register/u);
  assert.match(javascript, /\/supplier\/login/u);
  assert.match(javascript, /\/supplier\/account-select/u);
  assert.match(javascript, /选择职能账号/u);
  assert.match(javascript, /每次只激活一个固定职能页面/u);
  assert.match(javascript, /供应商不是店铺/u);
  assert.doesNotMatch(javascript, /手工输入.*supplierId|手工输入.*accountId/iu);
});

test('M2-P063 bundle provides the fixed supplier inventory workspace without price fields', () => {
  const assetsDir = path.join(packageRoot, 'dist', 'assets');
  const javascript = readdirSync(assetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(path.join(assetsDir, file), 'utf8'))
    .join('\n');

  assert.match(javascript, /M2-P063/u);
  assert.match(javascript, /\/supplier\/workspaces\/inventory/u);
  assert.match(javascript, /跨渠道共用库存/u);
  assert.match(javascript, /按原请求恢复/u);
  assert.match(javascript, /库存历史不可覆盖/u);
});
