import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fromRoot = (...segments) => path.join(repoRoot, ...segments);
const readText = (...segments) => readFileSync(fromRoot(...segments), 'utf8');
const readJson = (...segments) => JSON.parse(readText(...segments));

const shells = [
  ['apps/company-admin', '@fulishe/company-admin'],
  ['apps/supplier-portal', '@fulishe/supplier-portal'],
  ['apps/portal-web', '@fulishe/portal-web'],
  ['apps/user-miniapp', '@fulishe/user-miniapp'],
  ['apps/runner-miniapp', '@fulishe/runner-miniapp'],
];

test('M0-006 creates five independent application entry packages', () => {
  for (const [directory, packageName] of shells) {
    const manifestPath = fromRoot(directory, 'package.json');
    assert.ok(existsSync(manifestPath), `MISSING_SHELL_MANIFEST:${directory}`);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.name, packageName);
    assert.equal(manifest.private, true);
    for (const script of ['build', 'lint', 'typecheck', 'test']) {
      assert.equal(typeof manifest.scripts?.[script], 'string', `${packageName}:${script}`);
    }
  }
});

test('web shells use the frozen frameworks and shared presentation-only package', () => {
  const company = readJson('apps', 'company-admin', 'package.json');
  const supplier = readJson('apps', 'supplier-portal', 'package.json');
  const portal = readJson('apps', 'portal-web', 'package.json');

  for (const manifest of [company, supplier, portal]) {
    assert.ok(manifest.dependencies?.react);
    assert.ok(manifest.dependencies?.antd);
    assert.ok(manifest.dependencies?.['@tanstack/react-query']);
    assert.equal(manifest.dependencies?.['@fulishe/ui'], 'workspace:*');
  }
  for (const manifest of [company, supplier]) {
    assert.ok(manifest.devDependencies?.vite);
    assert.ok(manifest.devDependencies?.['@vitejs/plugin-react']);
  }
  assert.ok(portal.dependencies?.next);
  assert.equal(readJson('packages', 'ui', 'package.json').name, '@fulishe/ui');
});

test('company, supplier, and enterprise portal sessions cannot share an entry namespace', () => {
  const boundaries = [
    readText('apps', 'company-admin', 'src', 'session-boundary.ts'),
    readText('apps', 'supplier-portal', 'src', 'session-boundary.ts'),
    readText('apps', 'portal-web', 'src', 'session-boundary.ts'),
  ];
  const namespaces = boundaries.map((source) => {
    const match = source.match(/SESSION_NAMESPACE\s*=\s*'([^']+)'/u);
    assert.ok(match, 'SESSION_NAMESPACE_MISSING');
    return match[1];
  });
  assert.equal(new Set(namespaces).size, namespaces.length, 'SESSION_NAMESPACE_COLLISION');
  assert.match(boundaries[0], /\/company-admin\/login/u);
  assert.match(boundaries[1], /\/supplier\/login/u);
  assert.match(boundaries[2], /\/enterprise\/login/u);
});

test('portal route groups freeze public ISR and private no-store/noindex boundaries', () => {
  const publicPage = readText('apps', 'portal-web', 'src', 'app', '(public)', 'page.tsx');
  const authLayout = readText('apps', 'portal-web', 'src', 'app', '(auth)', 'layout.tsx');
  const authPage = readText(
    'apps',
    'portal-web',
    'src',
    'app',
    '(auth)',
    'enterprise',
    'login',
    'page.tsx',
  );
  const privateLayout = readText('apps', 'portal-web', 'src', 'app', '(private)', 'layout.tsx');
  const privatePage = readText(
    'apps',
    'portal-web',
    'src',
    'app',
    '(private)',
    'enterprise',
    'workspace',
    'page.tsx',
  );
  const nextConfig = readText('apps', 'portal-web', 'next.config.mjs');
  const robots = readText('apps', 'portal-web', 'src', 'app', 'robots.ts');
  const sitemap = readText('apps', 'portal-web', 'src', 'app', 'sitemap.ts');

  assert.match(publicPage, /revalidate\s*=\s*300/u);
  for (const source of [authPage, privatePage]) {
    assert.match(source, /dynamic\s*=\s*'force-dynamic'/u);
    assert.match(source, /fetchCache\s*=\s*'force-no-store'/u);
  }
  for (const source of [authLayout, privateLayout]) {
    assert.match(source, /index:\s*false/u);
    assert.match(source, /follow:\s*false/u);
  }
  assert.match(nextConfig, /private, no-store, max-age=0/u);
  assert.match(nextConfig, /X-Robots-Tag/u);
  assert.match(robots, /\/enterprise\//u);
  assert.doesNotMatch(sitemap, /\/enterprise\/workspace/u);
});

test('native mini-programs keep separate roots and independent phase-appropriate entries', () => {
  for (const appName of ['user-miniapp', 'runner-miniapp']) {
    const project = readJson('apps', appName, 'project.config.json');
    const app = readJson('apps', appName, 'src', 'app.json');
    assert.equal(project.miniprogramRoot, 'dist/');
    assert.equal(project.appid, 'touristappid');
    for (const extension of ['ts', 'json', 'wxml', 'wxss']) {
      assert.ok(
        existsSync(fromRoot('apps', appName, 'src', 'pages', 'shell', `index.${extension}`)),
        `${appName}:SHELL_PAGE_${extension.toUpperCase()}`,
      );
    }
  }
  const userApp = readJson('apps', 'user-miniapp', 'src', 'app.json');
  const runnerApp = readJson('apps', 'runner-miniapp', 'src', 'app.json');
  assert.equal(userApp.pages[0], 'pages/home/index');
  assert.equal(runnerApp.pages[0], 'pages/shell/index');
  assert.deepEqual(userApp.pages, [
    'pages/home/index',
    'pages/category/index',
    'pages/cart/index',
    'pages/checkout/index',
    'pages/profile/index',
    'pages/shell/index',
    'pages/product-detail/index',
    'pages/supplier-products/index',
    'pages/welfare-card/index',
    'pages/welfare-card-bind/index',
    'pages/welfare-card-detail/index',
  ]);
  assert.deepEqual(runnerApp.pages, ['pages/shell/index']);
  for (const extension of ['ts', 'json', 'wxml', 'wxss']) {
    assert.ok(
      existsSync(
        fromRoot(
          'apps',
          'user-miniapp',
          'src',
          'pages',
          'supplier-products',
          `index.${extension}`,
        ),
      ),
      `user-miniapp:PAGE_054_${extension.toUpperCase()}`,
    );
  }
});

test('application sources do not import another application package', () => {
  const forbidden = shells.map(([, packageName]) => packageName);
  for (const [directory, ownPackage] of shells) {
    const manifest = readText(directory, 'package.json');
    for (const packageName of forbidden) {
      if (packageName !== ownPackage) {
        assert.doesNotMatch(manifest, new RegExp(packageName.replace('/', '\\/'), 'u'));
      }
    }
  }
});
