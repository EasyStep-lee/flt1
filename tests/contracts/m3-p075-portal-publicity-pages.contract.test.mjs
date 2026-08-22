import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('M3-P075 freezes complete publicity pages, authorization fail-closed rules and explicit next actions', async () => {
  const [news, newsDetail, contact, content, contract] = await Promise.all([
    read('apps/portal-web/src/app/(public)/news/page.tsx'),
    read('apps/portal-web/src/app/(public)/news/[slug]/page.tsx'),
    read('apps/portal-web/src/app/(public)/contact/page.tsx'),
    read('apps/portal-web/src/public-content.ts'),
    read('docs/contracts/m3/M3-P075-portal-publicity-pages.md'),
  ]);

  assert.match(news, /primaryLabel="了解平台能力"/u);
  assert.match(newsDetail, /primaryLabel="进入社区集采"/u);
  assert.match(contact, /primaryLabel="注册企业"/u);
  assert.match(contact, /secondaryLabel="查看供应商合作"/u);
  assert.match(content, /publicAuthorizedCases = \[\]/u);
  assert.match(content, /version: 'V1\.1'/u);
  assert.match(content, /effectiveAt: CONTENT_EFFECTIVE_DATE/u);
  assert.match(contract, /Prisma 迁移：`NONE`/u);
  assert.match(contract, /OpenAPI\/DTO：`NONE`/u);
  assert.match(contract, /M5 CMS/u);
});

test('M3-P075 evidence advances only this slice after P074 merged-main CI', async () => {
  const [stateSource, freezeSource, artifactSource] = await Promise.all([
    read('福礼社Codex5.6开发执行包V1.1/16-项目状态.json'),
    read('artifacts/verification/M3-000/m3-contract-freeze.json'),
    read('artifacts/verification/M3-P075/portal-publicity-pages.json'),
  ]);
  const state = JSON.parse(stateSource);
  const freeze = JSON.parse(freezeSource);
  const artifact = JSON.parse(artifactSource);

  assert.equal(state.execution.currentTask, 'M3-P076');
  assert.equal(state.execution.nextAllowedTask, 'M3-P076');
  assert.equal(state.execution.lastCompletedTask, 'M3-P075');
  assert.equal(state.execution.lastCompletedCommit, '3d82a41f916d9348aac9a6d490cf6702950a1fe1');
  assert.equal(state.github.latestCi.headSha, '3d82a41f916d9348aac9a6d490cf6702950a1fe1');
  assert.equal(state.github.latestCi.runId, 32482552107);
  assert.equal(state.github.currentTaskDelivery.taskId, 'M3-P076');
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P076.*M3-P077/u);
  assert.equal(artifact.taskId, 'M3-P075');
  assert.equal(artifact.boundaries.migration, 'NONE');
  assert.equal(artifact.boundaries.openapi, 'NONE');
  assert.equal(artifact.boundaries.authorizedCustomerCases, 'NOT_EXECUTED');

  const p074 = freeze.negativeTests.filter(({ taskId }) => taskId === 'M3-P074');
  const p075 = freeze.negativeTests.filter(({ taskId }) => taskId === 'M3-P075');
  const p076 = freeze.negativeTests.filter(({ taskId }) => taskId === 'M3-P076');
  assert.equal(p074.every(({ executionStatus }) => executionStatus === 'CI_PASS'), true);
  assert.equal(p075.every(({ executionStatus }) => ['LOCAL_PASS', 'CI_PASS'].includes(executionStatus)), true);
  assert.equal(p076.every(({ executionStatus }) => executionStatus === 'LOCAL_PASS'), true);
});
