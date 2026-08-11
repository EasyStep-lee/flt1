import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

test('M1-P070 records eight isolated supplier workspaces at the local evidence boundary', async () => {
  const [contract, evidence, rehearsal, state, tasks, p0, pages, apis, rehearsalScript] =
    await Promise.all([
      readFile(
        path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P070-supplier-workspaces.md'),
        'utf8',
      ),
      readFile(
        path.join(
          repositoryRoot,
          'artifacts',
          'verification',
          'M1-P070',
          'supplier-workspaces.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(
        path.join(
          repositoryRoot,
          'artifacts',
          'verification',
          'M1-P070',
          'prisma-migration-rehearsal.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(path.join(packRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
      readFile(path.join(packRoot, '03-任务台账.csv'), 'utf8'),
      readFile(path.join(packRoot, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
      readFile(path.join(packRoot, '08-页面路由接口P0映射.csv'), 'utf8'),
      readFile(path.join(packRoot, '12-OpenAPI-DTO-错误码台账.csv'), 'utf8'),
      readFile(path.join(repositoryRoot, 'scripts', 'prisma-migration-rehearsal.mjs'), 'utf8'),
    ]);

  for (const marker of [
    'NEG-M1-070-01',
    'NEG-M1-070-02',
    'NEG-M1-070-03',
    'NEG-M1-070-04',
    'NEG-M1-070-05',
    'PAGE-016',
    'PAGE-023',
    'P0-071',
    'P0-072',
  ]) {
    assert.match(contract, new RegExp(marker, 'u'));
  }

  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.scope.supplierWorkspaceCount, 8);
  assert.deepEqual(evidence.scope.apiContracts, ['API-084', 'API-085']);
  assert.equal(evidence.scope.laterBusinessDataImplemented, false);
  assert.equal(evidence.contract.contextSource, 'SERVER_SESSION_ONLY');
  assert.equal(evidence.contract.menuCardinality, 1);
  assert.equal(
    evidence.contract.requestOrdering,
    'LATEST_REQUEST_WINS_STALE_SUCCESS_AND_FAILURE_IGNORED',
  );
  assert.equal(evidence.negativeTests.length, 5);
  assert.ok(evidence.negativeTests.every(({ status }) => status === 'PASS'));
  assert.equal(evidence.fullVerification.status, 'PASS_17_OF_17');
  assert.equal(evidence.fullVerification.p0E2e, 'PASS_22_OF_22');
  assert.deepEqual(evidence.migration.newMigrations, []);

  assert.equal(rehearsal.status, 'LOCAL_PASS');
  assert.equal(rehearsal.taskId, 'M1-P070');
  assert.equal(rehearsal.productRehearsal.previouslyVerifiedSlices[0]?.taskId, 'M1-P069');
  assert.equal(rehearsal.productRehearsal.supplierFunctionalAccounts.activeAccountTypeCount, 8);
  assert.equal(rehearsal.cleanup.errors.length, 0);
  assert.match(rehearsalScript, /M1-P070/u);

  assert.equal(state.execution.currentTask, 'M2-P013');
  assert.equal(state.execution.nextAllowedTask, 'M2-P013');
  assert.equal(state.execution.lastCompletedTask, 'M2-P013');
  assert.equal(state.github.currentTaskDelivery.taskId, 'M2-P013');
  assert.equal(state.github.currentTaskDelivery.issue, 51);
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M2-P013.*M2-P014/u);

  assert.match(tasks, /M1-P070[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0, /P0-070[^\r\n]*CI_PASS/u);
  for (const pageId of [
    'PAGE-016',
    'PAGE-017',
    'PAGE-018',
    'PAGE-019',
    'PAGE-020',
    'PAGE-021',
    'PAGE-022',
    'PAGE-023',
  ]) {
    assert.match(pages, new RegExp(`${pageId}[^\\r\\n]*IMPLEMENTED[^\\r\\n]*LOCAL_PASS`, 'u'));
  }
  assert.match(apis, /API-084[^\r\n]*P0-070[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
  assert.match(apis, /API-085[^\r\n]*P0-070[^\r\n]*GENERATED[^\r\n]*IMPLEMENTED/u);
});
