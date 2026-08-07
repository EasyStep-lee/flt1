import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

import { createServer as createViteServer } from 'vite';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

test('supplier portal dev server proxies same-origin /v1 requests to the API', async (t) => {
  const upstream = createHttpServer((request, response) => {
    response.writeHead(200, {
      'content-type': 'application/json',
      'set-cookie':
        '__Host-fulishe-supplier-portal=proxy-test; Path=/; HttpOnly; Secure; SameSite=Strict',
    });
    response.end(
      JSON.stringify({
        forwardedHost: request.headers.host,
        forwardedPath: request.url,
        source: 'api-upstream',
      }),
    );
  });
  await listen(upstream);
  t.after(() => new Promise((resolve) => upstream.close(resolve)));

  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress === 'object');
  const previousApiPort = process.env.API_PORT;
  process.env.API_PORT = String(upstreamAddress.port);
  t.after(() => {
    if (previousApiPort === undefined) delete process.env.API_PORT;
    else process.env.API_PORT = previousApiPort;
  });

  const vite = await createViteServer({
    configFile: path.join(packageRoot, 'vite.config.ts'),
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await vite.listen();
  t.after(() => vite.close());

  const viteAddress = vite.httpServer?.address();
  assert.ok(viteAddress && typeof viteAddress === 'object');
  const response = await fetch(
    `http://127.0.0.1:${viteAddress.port}/v1/supplier-auth/dev-proxy-probe`,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/u);
  assert.match(
    response.headers.get('set-cookie') ?? '',
    /__Host-fulishe-supplier-portal=.*HttpOnly.*Secure.*SameSite=Strict/u,
  );
  assert.deepEqual(await response.json(), {
    forwardedHost: `127.0.0.1:${upstreamAddress.port}`,
    forwardedPath: '/v1/supplier-auth/dev-proxy-probe',
    source: 'api-upstream',
  });
});
