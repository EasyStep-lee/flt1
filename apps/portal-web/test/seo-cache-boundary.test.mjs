import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = require.resolve('next/dist/bin/next');

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
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('PORTAL_START_TIMEOUT');
}

test('built portal keeps public ISR separate from private no-store/noindex routes', async (t) => {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: packageRoot,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: 'ignore',
    },
  );
  t.after(() => server.kill());
  await waitUntilReady(origin, server);

  const publicResponse = await fetch(origin);
  const publicHtml = await publicResponse.text();
  assert.equal(publicResponse.status, 200);
  assert.match(publicHtml, /portal-public-shell/u);
  assert.doesNotMatch(publicResponse.headers.get('cache-control') ?? '', /private|no-store/u);
  assert.doesNotMatch(publicResponse.headers.get('x-robots-tag') ?? '', /noindex/u);

  for (const [route, marker] of [
    ['/enterprise/login', 'portal-auth-shell'],
    ['/enterprise/workspace', 'portal-private-shell'],
  ]) {
    const response = await fetch(`${origin}${route}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, new RegExp(marker, 'u'));
    assert.match(response.headers.get('cache-control') ?? '', /private/u);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/u);
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/u);
  }

  const robotsText = await (await fetch(`${origin}/robots.txt`)).text();
  assert.match(robotsText, /Disallow: \/enterprise\//u);
  const sitemapText = await (await fetch(`${origin}/sitemap.xml`)).text();
  assert.match(sitemapText, /fulishe\.example\.invalid/u);
  assert.doesNotMatch(sitemapText, /enterprise\/workspace/u);
});
