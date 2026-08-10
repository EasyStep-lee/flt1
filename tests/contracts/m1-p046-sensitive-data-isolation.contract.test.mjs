import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

test('M1-P046 contract freezes all four negative tests and deferred boundaries', async () => {
  const contract = await readFile(
    path.join(repositoryRoot, 'docs', 'contracts', 'm1', 'M1-P046-sensitive-data-isolation.md'),
    'utf8',
  );
  for (const marker of [
    'NEG-M1-046-01',
    'NEG-M1-046-02',
    'NEG-M1-046-03',
    'NEG-M1-046-04',
    'FIELD_FORBIDDEN',
    'WORKSPACE_FORBIDDEN',
    'EXPORT_APPROVAL_REQUIRED',
    '企业统一配送不进入跑腿大厅',
    'M1-P047',
  ]) {
    assert.match(contract, new RegExp(marker, 'u'));
  }
});

test('M1-P046 policy is default-deny for price, settlement, runner address and export', async () => {
  const policy = await readFile(
    path.join(
      repositoryRoot,
      'apps',
      'api',
      'src',
      'sensitive-data',
      'sensitive-data.policy.ts',
    ),
    'utf8',
  );
  for (const marker of [
    'COMPANY_PRICE_REVIEW',
    'COMPANY_FINANCE',
    'SUPPLIER_PRICING',
    'SUPPLIER_FINANCE',
    'DELIVERY_ADDRESS',
    "channel === 'CONSUMER'",
    'EXPORT_APPROVAL_REQUIRED',
  ]) {
    assert.match(policy, new RegExp(marker, 'u'));
  }
  assert.doesNotMatch(policy, /COMPANY_SUPER_ADMIN[\s\S]*VISIBLE_WITH_AUDIT/u);
});

test('M1-P046 evidence remains closed after the project advances to P070', async () => {
  const [state, evidence, taskLedger, p0Ledger, migrationLedger] =
    await Promise.all([
      readFile(
        path.join(
          repositoryRoot,
          '福礼社Codex5.6开发执行包V1.1',
          '16-项目状态.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(
        path.join(
          repositoryRoot,
          'artifacts',
          'verification',
          'M1-P046',
          'sensitive-data-isolation.json',
        ),
        'utf8',
      ).then(JSON.parse),
      readFile(
        path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '03-任务台账.csv'),
        'utf8',
      ),
      readFile(
        path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '04-P0-1至P0-119验收矩阵.csv'),
        'utf8',
      ),
      readFile(
        path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1', '11-数据库迁移台账.csv'),
        'utf8',
      ),
    ]);

  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.greenEvidence.fullVerify, 'PASS_17_OF_17');
  assert.ok(['M2-P009', 'M2-P010'].includes(state.execution.lastCompletedTask));
  assert.equal(state.execution.currentTask, 'M2-P010');
  assert.equal(state.execution.nextAllowedTask, 'M2-P010');
  assert.ok([0, 1].includes(state.execution.activeTaskCount));
  assert.match(state.execution.prohibitedUntilGate.join('\n'), /M2-P010.*M2-P011/u);
  assert.match(taskLedger, /M1-P046[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(taskLedger, /M1-GATE[^\r\n]*DONE[^\r\n]*CI_PASS/u);
  assert.match(p0Ledger, /P0-046[^\r\n]*CI_PASS/u);
  assert.match(migrationLedger, /MIG-003[^\r\n]*APPLIED_LOCAL/u);
});
