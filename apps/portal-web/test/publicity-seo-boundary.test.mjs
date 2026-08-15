import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = require.resolve('next/dist/bin/next');
const canonicalOrigin = 'https://fulishe.example.invalid';

const publicPages = [
  ['/about', '关于福礼团'],
  ['/', '福礼社企业福利与供应链服务平台'],
  ['/capabilities', '一站式供应链服务能力'],
  ['/cases', '服务场景'],
  ['/cases/enterprise-welfare-service', '企业福利采购服务路径'],
  ['/supplier-cooperation', '成为福礼团合作供应商'],
  ['/news', '新闻与公告'],
  ['/news/community-procurement-boundary', '社区集采服务边界说明'],
  ['/contact', '联系我们'],
];

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('PORT_RESERVATION_FAILED'));
        return;
      }
      probe.close(() => resolve(address.port));
    });
  });
}

async function waitUntilReady(origin, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`PORTAL_EXITED:${child.exitCode}`);
    try {
      if ((await fetch(origin)).ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('PORTAL_START_TIMEOUT');
}

test('P0-027 built public pages expose complete crawlable publicity without sensitive fields', async (t) => {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        NEXT_PUBLIC_PORTAL_ORIGIN: canonicalOrigin,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: 'ignore',
    },
  );
  t.after(() => server.kill());
  await waitUntilReady(origin, server);

  const observedTitles = new Set();
  for (const [route, heading] of publicPages) {
    const response = await fetch(`${origin}${route}`);
    const html = await response.text();
    assert.equal(response.status, 200, `${route}:STATUS`);
    assert.match(html, /data-p0-id="P0-027"/u, `${route}:P0_MARKER`);
    assert.match(html, new RegExp(heading, 'u'), `${route}:HEADING`);
    assert.match(html, /福礼团/u, `${route}:APPROVED_PUBLIC_NAME`);
    assert.match(html, /189\*{4}9999/u, `${route}:MASKED_CUSTOMER_SERVICE`);
    assert.doesNotMatch(
      response.headers.get('cache-control') ?? '',
      /private|no-store/iu,
      `${route}:PUBLIC_CACHE`,
    );
    assert.doesNotMatch(
      response.headers.get('x-robots-tag') ?? '',
      /noindex/iu,
      `${route}:PUBLIC_INDEX`,
    );
    const canonicalHref = html.match(
      /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/u,
    )?.[1];
    assert.ok(canonicalHref, `${route}:CANONICAL_MISSING`);
    const canonicalUrl = new URL(canonicalHref);
    assert.equal(canonicalUrl.origin, canonicalOrigin, `${route}:CANONICAL_ORIGIN`);
    assert.equal(canonicalUrl.pathname, route, `${route}:CANONICAL_PATH`);
    assert.match(html, /property="og:title"/u, `${route}:OPEN_GRAPH`);
    assert.match(html, /application\/ld\+json/u, `${route}:JSON_LD`);
    const title = html.match(/<title>([^<]+)<\/title>/u)?.[1];
    assert.ok(title, `${route}:TITLE_MISSING`);
    assert.equal(observedTitles.has(title), false, `${route}:TITLE_NOT_UNIQUE`);
    observedTitles.add(title);
    assert.doesNotMatch(
      html,
      /supplyPrice|approvedSupplyPrice|supplyAmount|grossMargin|18936579999/iu,
      `${route}:SENSITIVE_FIELD`,
    );
  }

  const scenarioHtml = await (
    await fetch(`${origin}/cases/enterprise-welfare-service`)
  ).text();
  assert.match(scenarioHtml, /不代表特定客户案例或客户背书/u);

  for (const route of ['/cases/not-authorized', '/news/not-published']) {
    assert.equal((await fetch(`${origin}${route}`)).status, 404, `${route}:NOT_FOUND`);
  }

  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  for (const [route] of publicPages) {
    assert.match(
      sitemap,
      new RegExp(`${canonicalOrigin.replaceAll('.', '\\.')}.*${route === '/' ? '<' : route}`, 'u'),
      `${route}:SITEMAP`,
    );
  }
  assert.doesNotMatch(sitemap, /\/enterprise\//u);

  const robots = await (await fetch(`${origin}/robots.txt`)).text();
  for (const path of ['/enterprise/', '/company-admin/', '/supplier/']) {
    assert.match(robots, new RegExp(`Disallow: ${path.replaceAll('/', '\\/')}`, 'u'));
  }
});
