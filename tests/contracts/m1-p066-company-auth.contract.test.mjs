import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

test('M1-P066 remains bound to its merged exact-head and post-merge CI evidence', async () => {
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

  assert.equal(evidence.status, 'CI_PASS');
  assert.equal(evidence.implementationCommit, '4c3e07a359ae2d99f47ed9265730a1d9dd27531c');
  assert.equal(evidence.fullVerification.status, 'PASS_17_OF_17');
  assert.equal(evidence.migration.rehearsal, 'PASS_EMPTY_2_UPGRADE_2_RESTORE_2_PRODUCT_7_CLEANUP_PASS');
  assert.equal(evidence.negativeTests.length, 4);
  assert.ok(evidence.negativeTests.every(({ status }) => status === 'PASS'));

  assert.equal(state.execution.currentTask, 'M2-P009');
  assert.equal(state.execution.nextAllowedTask, 'M2-P009');
  assert.equal(state.execution.lastPassedGate, 'M1-GATE');
  assert.equal(
    state.execution.prohibitedUntilGate.some((item) => item.includes('M1-P066')),
    false,
  );
  assert.match(evidence.externalEvidence.pullRequestCi, /31084427860/u);
  assert.match(evidence.externalEvidence.merge, /1254f710/u);
  assert.match(evidence.externalEvidence.mainPostMergeCi, /31089444537/u);

  assert.match(tasks, /M1-P066[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P067[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P068[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P069[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P070[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P072[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0, /P0-066[^\r\n]*CI_PASS/u);
  assert.match(pages, /PAGE-001[^\r\n]*IMPLEMENTED[^\r\n]*LOCAL_PASS/u);
  assert.match(pages, /PAGE-002[^\r\n]*IMPLEMENTED[^\r\n]*LOCAL_PASS/u);
  assert.match(migrations, /MIG-002[^\r\n]*APPLIED_LOCAL/u);
  assert.match(apis, /API-003[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
  assert.match(apis, /API-004[^\r\n]*WORKSPACE_SESSION_CONFLICT[^\r\n]*GENERATED/u);
  assert.match(evidenceLedger, /EVD-066[^\r\n]*CI_PASS/u);
});
