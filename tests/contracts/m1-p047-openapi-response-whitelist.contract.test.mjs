import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const packRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');

test('M1-P047 evidence remains closed after PR 20 merge as the project advances', async () => {
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
  assert.equal(state.execution.lastCompletedTask, 'M3-P030');
  assert.equal(state.execution.status, 'M3_IN_PROGRESS');
  assert.equal(state.execution.currentTask, 'M3-P031');
  assert.equal(state.execution.nextAllowedTask, state.execution.currentTask);
  assert.equal(state.execution.activeTaskCount, 1);
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M3-P031.*M3-P051/u);
  assert.ok(state.github.pullRequest === null || Number.isInteger(state.github.pullRequest));
  assert.ok(['NOT_CREATED', 'DRAFT'].includes(state.github.pullRequestState));
  assert.equal(state.github.pullRequestMerged, false);
  assert.equal(state.github.mergeCommitSha, null);
  assert.equal(state.github.currentTaskDelivery.taskId, state.execution.currentTask);
  assert.match(
    state.github.currentTaskDelivery.status,
    /^(?:LOCAL_PASS_PENDING_DRAFT_PR|CI_PASS_PENDING_HUMAN_MERGE)$/u,
  );
  assert.equal(
    state.github.currentTaskDelivery.blockingExternalItem,
    'M4_DELIVERY_STAGING_DEVICE_PRODUCTION',
  );
  assert.equal(state.github.currentTaskDelivery.nextTaskUnlocked, false);
  assert.ok(
    state.github.currentTaskDelivery.exactHeadCi === 'NOT_EXECUTED' ||
      state.github.currentTaskDelivery.exactHeadCi.startsWith('CI_PASS_RUN_'),
  );
  assert.equal(state.github.currentTaskDelivery.merge, 'NOT_EXECUTED');
  assert.equal(state.github.currentTaskDelivery.mainPostMergeCi, 'NOT_EXECUTED');
  assert.equal(state.github.previousTaskDelivery.status, 'CI_PASS');
  assert.match(
    state.evidence.local,
    /^(?:LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED|LOCAL_PASS_M3_P030_FULL_VERIFY)$/u,
  );
  assert.match(state.evidence.ci, /^(?:NOT_EXECUTED|CI_PASS_M3_P030_HEAD_[0-9a-f]{7})$/u);
  assert.match(taskLedger, /M1-P047[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M1-P066[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0Ledger, /P0-047[^\r\n]*CI_PASS/u);
  assert.match(evidenceLedger, /EVD-047[^\r\n]*CI_PASS/u);
});
