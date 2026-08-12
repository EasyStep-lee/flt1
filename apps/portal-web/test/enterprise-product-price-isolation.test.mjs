import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createRequire } from 'node:module';
import { createServer as createTcpServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = require.resolve('next/dist/bin/next');
const productId = '21111111-1111-4111-8111-111111111111';

async function reservePort() {
  return await new Promise((resolve, reject) => {
    const probe = createTcpServer();
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

test('P0-021 private enterprise page forwards only the session and renders only enterprise prices', async (t) => {
  const [apiPort, portalPort] = await Promise.all([reservePort(), reservePort()]);
  let observedRequest;
  const api = createHttpServer((request, response) => {
    observedRequest = { cookie: request.headers.cookie, url: request.url };
    response.writeHead(200, {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(
      JSON.stringify({
        productId,
        supplierId: '2aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        categoryId: '22222222-2222-4222-8222-222222222222',
        templateVersion: 1,
        templateProfile: 'FOOD',
        name: '企业采购测试商品',
        brand: '福礼团',
        sellerName: '江苏福礼团供应链科技有限公司',
        checkoutMode: 'COMPANY_UNIFIED',
        enterpriseSalePrice: 6190,
        retailSalePrice: 6990,
        supplyPrice: 5000,
        grossMargin: 1190,
        skus: [
          {
            skuId: '23333333-3333-4333-8333-333333333333',
            enterpriseSalePrice: 6190,
            retailSalePrice: 6990,
            supplyPrice: 5000,
            specifications: [{ key: 'flavor', label: '口味', value: '原味' }],
          },
        ],
        detailModules: [],
      }),
    );
  });
  await new Promise((resolve, reject) => {
    api.once('error', reject);
    api.listen(apiPort, '127.0.0.1', resolve);
  });
  t.after(() => api.close());

  const portalOrigin = `http://127.0.0.1:${portalPort}`;
  const portal = spawn(
    process.execPath,
    [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(portalPort)],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
        PORTAL_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
      },
      stdio: 'ignore',
    },
  );
  t.after(() => portal.kill());
  await waitUntilReady(portalOrigin, portal);

  const response = await fetch(`${portalOrigin}/enterprise/procurement/products/${productId}`, {
    headers: { Cookie: '__Host-fulishe-enterprise-portal=verified-session' },
  });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /private/iu);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/iu);
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/iu);
  assert.match(html, /enterprise-product-detail/u);
  assert.match(html, /集采价/u);
  assert.match(html, /¥61\.90/u);
  assert.doesNotMatch(
    html,
    /retailSalePrice|supplyPrice|grossMargin|¥69\.90|¥50\.00/iu,
  );
  assert.deepEqual(observedRequest, {
    cookie: '__Host-fulishe-enterprise-portal=verified-session',
    url: `/v1/enterprise/catalog/products/${productId}`,
  });
});
