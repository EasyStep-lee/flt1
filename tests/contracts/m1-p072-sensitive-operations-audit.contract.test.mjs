import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

test('M1-P072 records natural-person separation and remains closed after the M1 gate', async () => {
  const [contract, evidence, rehearsal, state, tasks, p0, pages, apis, migrations, manifest] =
    await Promise.all([
      readFile(path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P072-sensitive-operations-audit.md'), 'utf8'),
      readFile(path.join(repositoryRoot, 'artifacts', 'verification', 'M1-P072', 'sensitive-operations-audit.json'), 'utf8').then(JSON.parse),
      readFile(path.join(repositoryRoot, 'artifacts', 'verification', 'M1-P072', 'prisma-migration-rehearsal.json'), 'utf8').then(JSON.parse),
      readFile(path.join(packRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
      readFile(path.join(packRoot, '03-任务台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
      readFile(path.join(packRoot, '08-页面路由接口P0映射.csv'), 'utf8'),
      readFile(path.join(packRoot, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '11-数据库迁移台账.csv'), 'utf8'),
      readFile(path.join(packRoot, 'manifest.json'), 'utf8').then(JSON.parse),
    ]);

  for (const marker of [
    'NEG-M1-072-01',
    'NEG-M1-072-02',
    'NEG-M1-072-03',
    'NEG-M1-072-04',
    'NEG-M1-072-05',
    'identityType + identityId',
    'API-086',
    'API-089',
    'PAGE-012',
    'PAGE-023',
  ]) {
    assert.match(contract, new RegExp(marker.replaceAll('+', '\\+'), 'u'));
  }
  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.contract.naturalPersonKey, 'identityType+identityId');
  assert.equal(evidence.contract.superAdminBypass, 'FORBIDDEN');
  assert.equal(evidence.scope.actualExportImplemented, false);
  assert.equal(evidence.permissionCodes.length, 9);
  assert.equal(evidence.negativeTests.length, 5);
  assert.ok(evidence.negativeTests.every(({ status }) => status === 'PASS'));
  assert.ok(['NOT_EXECUTED', 'PASS_17_OF_17'].includes(evidence.fullVerification.status));

  assert.equal(rehearsal.status, 'LOCAL_PASS');
  assert.equal(rehearsal.taskId, 'M1-P072');
  assert.equal(rehearsal.productRehearsal.migrationCount, 11);
  assert.equal(rehearsal.productRehearsal.previouslyVerifiedSlices[0]?.taskId, 'M1-P070');
  assert.equal(rehearsal.productRehearsal.sensitiveApproval.tableCount, 2);
  assert.equal(rehearsal.productRehearsal.sensitiveApproval.historyTriggerCount, 2);
  assert.equal(rehearsal.productRehearsal.sensitiveApproval.frozenPermissionCount, 9);
  assert.equal(rehearsal.cleanup.errors.length, 0);

  assert.equal(state.execution.status, 'M3_IN_PROGRESS');
  assert.equal(state.execution.currentTask, 'M3-P025');
  assert.equal(state.execution.nextAllowedTask, 'M3-P025');
  assert.equal(state.execution.lastCompletedTask, 'M3-P024');
  assert.equal(state.execution.lastPassedGate, 'M2-GATE');
  assert.equal(state.github.currentTaskDelivery.taskId, 'M3-P025');
  assert.equal(state.github.currentTaskDelivery.issue, 85);
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P025.*M3-P026/u);
  assert.match(tasks, /M1-P070[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(tasks, /M1-P072[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0, /P0-072[^\r\n]*CI_PASS/u);
  assert.match(pages, /PAGE-012[^\r\n]*P0-072_LOCAL_PASS/u);
  assert.match(pages, /PAGE-023[^\r\n]*P0-072_LOCAL_PASS/u);
  assert.equal(manifest.counts.apiContracts, 100);
  for (const apiId of ['API-086', 'API-087', 'API-088', 'API-089']) {
    assert.match(
      apis,
      new RegExp(
        `${apiId}[^\\r\\n]*GENERATED[^\\r\\n]*IMPLEMENTED[^\\r\\n]*任务内契约细化`,
        'u',
      ),
    );
  }
  assert.match(migrations, /MIG-004[^\r\n]*ApprovalTaskHistory[^\r\n]*APPLIED_LOCAL/u);
});
