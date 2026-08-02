import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

test('user mini-program build produces an independent developer-tool root', () => {
  const appJavaScript = readFileSync(path.join(packageRoot, 'dist', 'app.js'), 'utf8');
  const pageJavaScript = readFileSync(
    path.join(packageRoot, 'dist', 'pages', 'shell', 'index.js'),
    'utf8',
  );
  assert.match(appJavaScript, /fulishe:user-miniapp/u);
  assert.match(pageJavaScript, /user-miniapp-shell/u);
  assert.ok(existsSync(path.join(packageRoot, 'dist', 'app.json')));
  assert.ok(existsSync(path.join(packageRoot, 'dist', 'pages', 'shell', 'index.wxml')));
});
