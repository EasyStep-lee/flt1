import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.join(packageRoot, 'src');
const outputRoot = path.join(packageRoot, 'dist');

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });
const apiBaseUrl = process.env.USER_MINIAPP_API_BASE_URL ?? 'http://127.0.0.1:3000';
const parsedApiBaseUrl = new URL(apiBaseUrl);
if (!['http:', 'https:'].includes(parsedApiBaseUrl.protocol)) {
  throw new Error('USER_MINIAPP_API_BASE_URL_PROTOCOL_INVALID');
}

await build({
  bundle: true,
  define: {
    __FULISHE_API_BASE_URL__: JSON.stringify(apiBaseUrl),
  },
  entryNames: '[dir]/[name]',
  entryPoints: [
    path.join(sourceRoot, 'app.ts'),
    path.join(sourceRoot, 'pages/home/index.ts'),
    path.join(sourceRoot, 'pages/category/index.ts'),
    path.join(sourceRoot, 'pages/cart/index.ts'),
    path.join(sourceRoot, 'pages/profile/index.ts'),
    path.join(sourceRoot, 'pages/shell/index.ts'),
    path.join(sourceRoot, 'pages/product-detail/index.ts'),
    path.join(sourceRoot, 'pages/supplier-products/index.ts'),
  ],
  format: 'iife',
  logLevel: 'info',
  outbase: sourceRoot,
  outdir: outputRoot,
  platform: 'browser',
  target: 'es2020',
});

for (const relativePath of [
  'app.json',
  'app.wxss',
  'sitemap.json',
  'pages/home/index.json',
  'pages/home/index.wxml',
  'pages/home/index.wxss',
  'pages/category/index.json',
  'pages/category/index.wxml',
  'pages/category/index.wxss',
  'pages/cart/index.json',
  'pages/cart/index.wxml',
  'pages/cart/index.wxss',
  'pages/profile/index.json',
  'pages/profile/index.wxml',
  'pages/profile/index.wxss',
  'pages/shell/index.json',
  'pages/shell/index.wxml',
  'pages/shell/index.wxss',
  'pages/product-detail/index.json',
  'pages/product-detail/index.wxml',
  'pages/product-detail/index.wxss',
  'pages/supplier-products/index.json',
  'pages/supplier-products/index.wxml',
  'pages/supplier-products/index.wxss',
]) {
  const destination = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(sourceRoot, relativePath), destination);
}
