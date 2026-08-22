import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('M3-P074 freezes the nine-section public home and fails closed without customer authorization', async () => {
  const [home, content, contract] = await Promise.all([
    read('apps/portal-web/src/app/(public)/page.tsx'),
    read('apps/portal-web/src/public-content.ts'),
    read('docs/contracts/m3/M3-P074-portal-home.md'),
  ]);

  let previousIndex = -1;
  for (const section of [
    'hero', 'core-services', 'supply-chain-capabilities', 'community-procurement',
    'category-preview', 'authorized-cases', 'supplier-cooperation', 'news',
    'enterprise-service-cta',
  ]) {
    const index = home.indexOf(`data-home-section="${section}"`);
    assert.ok(index > previousIndex, `${section}:ORDER`);
    previousIndex = index;
  }

  for (const category of ['食品', '家居日用', '个护', '纸品', '家庭清洁', '文体办公']) {
    assert.match(content, new RegExp(`'${category}'`, 'u'));
  }
  assert.match(content, /publicAuthorizedCases = \[\]/u);
  assert.match(home, /暂无已取得公开授权的客户案例/u);
  assert.match(home, /匿名服务路径（不是客户案例）/u);
  assert.doesNotMatch(home, /data-sales-count|data-countdown|data-home-product/u);
  assert.match(contract, /migration: `NONE`|Prisma migration：`NONE`/u);
  assert.match(contract, /OpenAPI\/DTO\/error code：`NONE`/u);
});

test('M3-P074 merged-main evidence remains closed while P075 is current', async () => {
  const [stateSource, freezeSource, artifactSource] = await Promise.all([
    read('福礼社Codex5.6开发执行包V1.1/16-项目状态.json'),
    read('artifacts/verification/M3-000/m3-contract-freeze.json'),
    read('artifacts/verification/M3-P074/portal-home.json'),
  ]);
  const state = JSON.parse(stateSource);
  const freeze = JSON.parse(freezeSource);
  const artifact = JSON.parse(artifactSource);

  assert.equal(state.execution.currentTask, 'M3-P076');
  assert.equal(state.execution.nextAllowedTask, 'M3-P076');
  assert.equal(state.execution.lastCompletedTask, 'M3-P075');
  assert.equal(state.github.currentTaskDelivery.taskId, 'M3-P076');
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P076.*M3-P077/u);
  assert.equal(artifact.taskId, 'M3-P074');
  assert.equal(artifact.boundaries.migration, 'NONE');
  assert.equal(artifact.boundaries.openapi, 'NONE');
  assert.equal(artifact.boundaries.authorizedCustomerCases, 'NOT_EXECUTED');

  const p073 = freeze.negativeTests.filter(({ taskId }) => taskId === 'M3-P073');
  const p074 = freeze.negativeTests.filter(({ taskId }) => taskId === 'M3-P074');
  const p075 = freeze.negativeTests.filter(({ taskId }) => taskId === 'M3-P075');
  assert.equal(p073.every(({ executionStatus }) => executionStatus === 'CI_PASS'), true);
  assert.equal(p074.every(({ executionStatus }) => executionStatus === 'CI_PASS'), true);
  assert.equal(p075.every(({ executionStatus }) => ['LOCAL_PASS', 'CI_PASS'].includes(executionStatus)), true);
});
