import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const executionPack = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
);
const receiptPath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M1-GATE',
  'ext-005-company-confirmation.json',
);
const evidencePath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M1-GATE',
  'm1-gate-ext-005-provided.json',
);
const handoffPath = path.join(
  repositoryRoot,
  'docs',
  'handoffs',
  '2026-08-09-M1-gate-ext-005-provided.md',
);
const validatorPath = path.join(
  repositoryRoot,
  'scripts',
  'verify-ext-005-company-confirmation.mjs',
);

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
};

const parseCsv = (source) => {
  const lines = source.replace(/^\uFEFF/u, '').trim().split(/\r?\n/u);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) =>
    Object.fromEntries(
      parseCsvLine(line).map((value, index) => [header[index], value]),
    ),
  );
};

test('EXT-005 authorized receipt is redacted and honestly records absent internal identifiers', async () => {
  const [{ validateExt005Confirmation }, receipt] = await Promise.all([
    import(pathToFileURL(validatorPath)),
    readFile(receiptPath, 'utf8').then(JSON.parse),
  ]);

  assert.deepEqual(validateExt005Confirmation(receipt), {
    ok: true,
    errors: [],
  });
  assert.equal(receipt.schemaVersion, '1.1.0');
  assert.equal(receipt.customerFacing.displayName, '福礼团');
  assert.equal(receipt.customerFacing.customerService.channel, 'PHONE');
  assert.match(receipt.customerFacing.customerService.redactedDisplay, /\*/u);
  assert.doesNotMatch(
    receipt.customerFacing.customerService.redactedDisplay,
    /\d{7,}/u,
  );
  for (const item of Object.values(receipt.controlledEvidence)) {
    assert.equal(item.storageStatus, 'CONTROLLED_STORAGE_CONFIRMED');
    assert.equal(item.referenceStatus, 'NO_INTERNAL_IDENTIFIER');
    assert.equal(item.reference, null);
  }
});

test('EXT-005 ledger is provided without exposing source documents or contact values', async () => {
  const rows = parseCsv(
    await readFile(
      path.join(executionPack, '09-外部依赖与人工事项.csv'),
      'utf8',
    ),
  );
  const dependency = rows.find(({ DependencyID }) => DependencyID === 'EXT-005');

  assert.ok(dependency);
  assert.equal(dependency.CurrentStatus, 'PROVIDED');
  assert.equal(
    dependency.EvidenceLink,
    'artifacts/verification/M1-GATE/ext-005-company-confirmation.json',
  );
  assert.match(dependency.ProvidedAt, /(?:Z|[+-]\d{2}:\d{2})$/u);
  assert.equal(dependency.ApprovedBy, 'COMPANY_AUTHORIZED_REVIEWER');
  assert.match(dependency.Notes, /NO_INTERNAL_IDENTIFIER/u);
  assert.doesNotMatch(JSON.stringify(dependency), /\d{7,}/u);
});

test('historical EXT-005 evidence stays locked while current state advances only after exact-head CI and merge', async () => {
  const [projectStatus, tasks, evidence, handoff] = await Promise.all([
    readFile(path.join(executionPack, '16-项目状态.json'), 'utf8').then(
      JSON.parse,
    ),
    readFile(path.join(executionPack, '03-任务台账.csv'), 'utf8').then(
      parseCsv,
    ),
    readFile(evidencePath, 'utf8').then(JSON.parse),
    readFile(handoffPath, 'utf8'),
  ]);
  const m1Gate = tasks.find(({ TaskID }) => TaskID === 'M1-GATE');
  const m2Contract = tasks.find(({ TaskID }) => TaskID === 'M2-000');
  const m2p006 = tasks.find(({ TaskID }) => TaskID === 'M2-P006');
  const m2p007 = tasks.find(({ TaskID }) => TaskID === 'M2-P007');
  const m2p008 = tasks.find(({ TaskID }) => TaskID === 'M2-P008');
  const m2p009 = tasks.find(({ TaskID }) => TaskID === 'M2-P009');
  const m2p010 = tasks.find(({ TaskID }) => TaskID === 'M2-P010');
  const m2p011 = tasks.find(({ TaskID }) => TaskID === 'M2-P011');
  const m2p012 = tasks.find(({ TaskID }) => TaskID === 'M2-P012');
  const m2p013 = tasks.find(({ TaskID }) => TaskID === 'M2-P013');

  assert.equal(projectStatus.execution.status, 'M2_IN_PROGRESS');
  assert.equal(projectStatus.execution.currentTask, 'M2-P013');
  assert.equal(projectStatus.execution.nextAllowedTask, 'M2-P013');
  assert.equal(
    projectStatus.execution.activeTaskCount,
    m2p013.Status === 'IN_PROGRESS' ? 1 : 0,
  );
  assert.equal(projectStatus.execution.lastPassedGate, 'M1-GATE');
  assert.equal(projectStatus.github.currentTaskDelivery.taskId, 'M2-P013');
  assert.equal(projectStatus.github.currentTaskDelivery.issue, 51);
  assert.equal(projectStatus.github.currentTaskDelivery.exactHeadCi, 'NOT_EXECUTED_NO_PR');
  assert.equal(projectStatus.github.currentTaskDelivery.m2p014StartAllowed, false);
  assert.equal(projectStatus.github.previousTaskDelivery.taskId, 'M2-P012');
  assert.equal(projectStatus.github.previousTaskDelivery.pullRequest, 50);
  assert.equal(projectStatus.github.previousTaskDelivery.status, 'CI_PASS');

  assert.equal(m1Gate.Status, 'DONE');
  assert.equal(m1Gate.EvidenceStatus, 'CI_PASS');
  assert.equal(m1Gate.PullRequest, 'https://github.com/EasyStep-lee/flt1/pull/34');
  assert.equal(m1Gate.CI, 'CI_PASS');
  assert.match(m1Gate.Notes, /f5febff/u);
  assert.match(m1Gate.Notes, /31295823535/u);
  assert.equal(m2Contract.Status, 'DONE');
  assert.equal(m2Contract.EvidenceStatus, 'CI_PASS');
  assert.equal(m2Contract.CI, 'CI_PASS');
  assert.equal(m2p006.Status, 'DONE');
  assert.equal(m2p006.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p006.CI, 'CI_PASS');
  assert.equal(m2p007.Status, 'DONE');
  assert.equal(m2p007.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p007.CI, 'CI_PASS');
  assert.equal(m2p008.Status, 'DONE');
  assert.equal(m2p008.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p008.CI, 'CI_PASS');
  assert.equal(m2p009.Status, 'DONE');
  assert.equal(m2p009.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p009.CI, 'CI_PASS');
  assert.equal(m2p010.Status, 'DONE');
  assert.equal(m2p010.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p011.Status, 'DONE');
  assert.equal(m2p011.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p011.CI, 'CI_PASS');
  assert.equal(m2p012.Status, 'DONE');
  assert.equal(m2p012.EvidenceStatus, 'CI_PASS');
  assert.equal(m2p012.CI, 'CI_PASS');
  assert.equal(m2p013.Status, 'DONE');
  assert.equal(m2p013.EvidenceStatus, 'LOCAL_PASS');
  assert.equal(m2p013.CI, '');

  assert.equal(evidence.schemaVersion, '1.0.0');
  assert.equal(evidence.taskId, 'M1-GATE-EXT005-PROVIDED');
  assert.equal(evidence.status, 'LOCAL_PASS');
  assert.equal(evidence.stageConclusion, 'PENDING_EXACT_HEAD_CI_AND_MERGE');
  assert.equal(evidence.externalEvidence.status, 'PROVIDED');
  assert.equal(evidence.externalEvidence.containsSensitiveSource, false);
  assert.equal(evidence.verification.ext005Receipt.status, 'PASS');
  assert.equal(evidence.verification.focused.status, 'PASS');
  assert.equal(evidence.verification.firstFullRun.status, 'FAIL');
  assert.equal(evidence.verification.firstFullRun.failedTests, 7);
  assert.equal(evidence.verification.full.status, 'PASS_17_OF_17');
  assert.equal(evidence.decision.stagePassed, false);
  assert.equal(evidence.decision.m2Unlocked, false);
  assert.equal(evidence.decision.nextAllowedTask, 'M1-GATE');

  assert.match(handoff, /阶段结论：`IN_PROGRESS`/u);
  assert.match(handoff, /EXT-005.*PROVIDED/u);
  assert.match(handoff, /PENDING_EXACT_HEAD_CI_AND_MERGE/u);
  assert.match(handoff, /M2.*锁定/u);
  assert.doesNotMatch(handoff, /阶段结论：`PASS`/u);
});
