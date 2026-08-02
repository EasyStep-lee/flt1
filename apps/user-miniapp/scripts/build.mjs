import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.join(packageRoot, 'src');
const outputRoot = path.join(packageRoot, 'dist');

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });
await build({
  bundle: true,
  entryNames: '[dir]/[name]',
  entryPoints: [path.join(sourceRoot, 'app.ts'), path.join(sourceRoot, 'pages/shell/index.ts')],
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
  'pages/shell/index.json',
  'pages/shell/index.wxml',
  'pages/shell/index.wxss',
]) {
  const destination = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(sourceRoot, relativePath), destination);
}
