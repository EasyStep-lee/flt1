import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';
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
      if (!address || typeof address === 'string') return reject(new Error('PORT_RESERVATION_FAILED'));
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
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('PORTAL_START_TIMEOUT');
}

test('P0-030 serves community procurement as an always-open ordinary enterprise entry', async (t) => {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: packageRoot,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: 'ignore',
  });
  t.after(() => server.kill());
  await waitUntilReady(origin, server);

  const response = await fetch(`${origin}/enterprise-procurement`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /data-p0-id="P0-030"/u);
  assert.match(html, /持续开放的普通企业采购入口/u);
  assert.match(html, /不限定指定社区、活动时段、成团门槛或团长角色/u);
  assert.match(html, /不提供企业内部 OA、预算或采购审批流程/u);
  assert.match(html, /href="\/enterprise\/register"/u);
  assert.match(html, /href="\/enterprise\/login"/u);
  assert.match(html, /href="\/enterprise\/procurement\/products"/u);
  assert.match(html, /<link rel="canonical" href="https:\/\/fulishe\.example\.invalid\/enterprise-procurement"/u);
  assert.doesNotMatch(response.headers.get('cache-control') ?? '', /private|no-store/u);
  assert.doesNotMatch(response.headers.get('x-robots-tag') ?? '', /noindex/u);

  assert.doesNotMatch(
    html,
    /立即开团|邀请参团|团长中心|团长佣金|成团进度|活动倒计时|活动截止|发起采购审批|提交预算审批|进入OA/iu,
  );
  assert.doesNotMatch(
    html,
    /communityId|leaderId|leaderCommission|campaignStartAt|campaignEndAt|groupThreshold|groupStatus|approvedSupplyPrice|supplyPrice|internalMargin/iu,
  );

  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  assert.match(sitemap, /https:\/\/fulishe\.example\.invalid\/enterprise-procurement/u);
  assert.doesNotMatch(sitemap, /enterprise\/procurement\/products/u);
});
