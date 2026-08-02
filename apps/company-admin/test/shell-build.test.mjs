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
