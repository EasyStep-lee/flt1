import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

test('M1-P066 closes local evidence and leaves M1-P067 blocked at READY', async () => {
  const [contract, evidence, state, tasks, p0, pages, migrations, apis, evidenceLedger] =
    await Promise.all([
      readFile(
        path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P066-company-auth.md'),
        'utf8',
      ),
      readFile(
        path.join(
          repositoryRoot,
          'artifacts',
          'verification',
          'M1-P066',
          'company-auth.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(path.join(packRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
      readFile(path.join(packRoot, '03-任务台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
      readFile(path.join(packRoot, '08-页面路由接口P0映射.csv'), 'utf8'),
      readFile(path.join(packRoot, '11-数据库迁移台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '10-测试证据登记.csv'), 'utf8'),
    ]);

  for (const marker of [
    'NEG-M1-066-01',
    'NEG-M1-066-02',
    'NEG-M1-066-03',
    'NEG-M1-066-04',
    '__Host-fulishe-company-admin',
    'M1-P067',
  ]) {
    assert.match(contract, new RegExp(marker, 'u'));
  }

  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.implementationCommit, '01eedbde3fbe6b99bb727dc581bc84330ec93dc2');
  assert.equal(evidence.fullVerification.status, 'PASS_17_OF_17');
  assert.equal(evidence.migration.rehearsal, 'PASS_EMPTY_2_UPGRADE_2_RESTORE_2_PRODUCT_7_CLEANUP_PASS');
  assert.equal(evidence.negativeTests.length, 4);
  assert.ok(evidence.negativeTests.every(({ status }) => status === 'PASS'));

  assert.equal(state.execution.lastCompletedTask, 'M1-P066');
  assert.equal(state.execution.currentTask, 'M1-P067');
  assert.equal(state.execution.nextAllowedTask, 'M1-P067');
  assert.equal(state.execution.activeTaskCount, 0);
  assert.equal(state.execution.prohibitedUntilGate.length, 1);
  assert.equal(state.github.pullRequest, 22);
  assert.equal(state.github.pullRequestState, 'DRAFT');
  assert.equal(state.github.currentTaskDelivery.status, 'DONE_LOCAL_PASS');
  assert.equal(state.github.currentTaskDelivery.localVerify, 'PASS_17_OF_17');
  assert.equal(state.github.currentTaskDelivery.exactHeadCi, 'NOT_EXECUTED');

  assert.match(tasks, /M1-P066[^\r\n]*DONE[^\r\n]*LOCAL_PASS/u);
  assert.match(tasks, /M1-P067[^\r\n]*READY[^\r\n]*NOT_EXECUTED/u);
  assert.match(p0, /P0-066[^\r\n]*LOCAL_PASS/u);
  assert.match(pages, /PAGE-001[^\r\n]*IMPLEMENTED[^\r\n]*LOCAL_PASS/u);
  assert.match(pages, /PAGE-002[^\r\n]*IMPLEMENTED[^\r\n]*LOCAL_PASS/u);
  assert.match(migrations, /MIG-002[^\r\n]*APPLIED_LOCAL/u);
  assert.match(apis, /API-003[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
  assert.match(apis, /API-004[^\r\n]*WORKSPACE_SESSION_CONFLICT[^\r\n]*GENERATED/u);
  assert.match(evidenceLedger, /EVD-066[^\r\n]*LOCAL_PASS/u);
});
