import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

test('M1-P047 evidence remains closed after PR 20 merge and M1-P066 local completion', async () => {
  const [contract, evidence, state, taskLedger, p0Ledger, evidenceLedger] = await Promise.all([
    readFile(
      path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P047-openapi-response-whitelist.md'),
      'utf8',
    ),
    readFile(
      path.join(
        repositoryRoot,
        'artifacts',
        'verification',
        'M1-P047',
        'openapi-response-whitelist.json',
      ),
      'utf8',
    ).then(JSON.parse),
    readFile(path.join(packRoot, '16-项目状态.json'), 'utf8').then(JSON.parse),
    readFile(path.join(packRoot, '03-任务台账.csv'), 'utf8'),
    readFile(path.join(packRoot, '04-P0-1至P0-119验收矩阵.csv'), 'utf8'),
    readFile(path.join(packRoot, '10-测试证据登记.csv'), 'utf8'),
  ]);

  for (const marker of [
    'NEG-M1-047-01',
    'NEG-M1-047-02',
    'NEG-M1-047-03',
    'NEG-M1-047-04',
    'NEVER_RETURN_INTERNAL_PRICING',
  ]) {
    assert.match(contract, new RegExp(marker, 'u'));
  }

  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.fullVerification.status, 'PASS_17_OF_17');
  assert.equal(evidence.negativeTests.length, 4);
  assert.ok(evidence.negativeTests.every(({ status }) => status === 'PASS'));
  assert.equal(state.execution.lastCompletedTask, 'M1-P066');
  assert.equal(state.execution.currentTask, 'M1-P067');
  assert.equal(state.execution.nextAllowedTask, 'M1-P067');
  assert.equal(state.execution.activeTaskCount, 0);
  assert.equal(state.execution.prohibitedUntilGate.length, 1);
  assert.match(state.execution.prohibitedUntilGate[0], /M1-P066/u);
  assert.equal(state.github.pullRequest, 22);
  assert.equal(state.github.pullRequestState, 'DRAFT');
  assert.equal(state.github.pullRequestMerged, false);
  assert.equal(state.github.mergeCommitSha, 'NOT_EXECUTED_FOR_M1_P066');
  assert.equal(state.github.currentTaskDelivery.taskId, 'M1-P066');
  assert.equal(state.github.currentTaskDelivery.status, 'DONE_LOCAL_PASS');
  assert.equal(state.github.currentTaskDelivery.pullRequest, 22);
  assert.equal(state.github.currentTaskDelivery.exactHeadCi, 'NOT_EXECUTED');
  assert.equal(state.evidence.local, 'LOCAL_PASS');
  assert.equal(state.evidence.ci, 'NOT_EXECUTED');
  assert.match(taskLedger, /M1-P047[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M1-P066[^\r\n]*DONE[^\r\n]*LOCAL_PASS/u);
  assert.match(p0Ledger, /P0-047[^\r\n]*LOCAL_PASS/u);
  assert.match(evidenceLedger, /EVD-047[^\r\n]*LOCAL_PASS/u);
});
