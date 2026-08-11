import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const executionPackRoot = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
);
const evidencePath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M1-GATE',
  'm1-gate-preflight.json',
);
const handoffPath = path.join(
  repositoryRoot,
  'docs',
  'handoffs',
  '2026-08-08-M1-gate-blocked-external.md',
);
const projectStatusPath = path.join(executionPackRoot, '16-项目状态.json');
const taskLedgerPath = path.join(executionPackRoot, '03-任务台账.csv');
const p0LedgerPath = path.join(
  executionPackRoot,
  '04-P0-1至P0-119验收矩阵.csv',
);
const stageGatePath = path.join(executionPackRoot, 'data', '阶段门禁.csv');
const externalDependencyPath = path.join(
  executionPackRoot,
  '09-外部依赖与人工事项.csv',
);

const candidateMain = '4ff02588379b1928448826d9f83b863c8c8b5bd8';
const p072Head = 'efb50c01049686ce5acf8463342a53d4e572a7cd';
const m1GateMerge = '162787ae1687116badf0972664005332220976f9';
const m1P0Ids = [
  'P0-001',
  'P0-002',
  'P0-003',
  'P0-004',
  'P0-005',
  'P0-045',
  'P0-046',
  'P0-047',
  'P0-066',
  'P0-067',
  'P0-068',
  'P0-069',
  'P0-070',
  'P0-072',
];

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  assert.equal(quoted, false, 'unterminated quoted CSV field');
  values.push(current);
  return values;
};

const parseCsvText = (source) => {
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
  });
};

const readCsv = async (filePath) =>
  parseCsvText(await readFile(filePath, 'utf8'));

test('M1 gate preflight binds all technical evidence without bypassing EXT-005', async () => {
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));

  assert.equal(evidence.schemaVersion, '1.0.0');
  assert.equal(evidence.taskId, 'M1-GATE');
  assert.equal(evidence.stage, 'M1');
  assert.equal(evidence.status, 'BLOCKED_EXTERNAL');
  assert.equal(evidence.gateConclusion, 'BLOCKED');
  assert.equal(evidence.technicalConclusion, 'LOCAL_PASS');
  assert.equal(evidence.baseline.verification, 'PASS');
  assert.equal(
    evidence.baseline.schemeSha256,
    '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  );

  assert.equal(evidence.candidate.mainSha, candidateMain);
  assert.equal(evidence.candidate.lastSlice.taskId, 'M1-P072');
  assert.equal(evidence.candidate.lastSlice.pullRequest, 32);
  assert.equal(evidence.candidate.lastSlice.headSha, p072Head);
  assert.equal(evidence.candidate.lastSlice.state, 'MERGED');
  assert.equal(evidence.candidate.lastSlice.mergeCommitSha, candidateMain);
  assert.equal(evidence.evidence.lastSlicePullRequestCi.status, 'CI_PASS');
  assert.equal(evidence.evidence.lastSlicePullRequestCi.runId, 31239438856);
  assert.equal(evidence.evidence.lastSlicePullRequestCi.headSha, p072Head);
  assert.equal(evidence.evidence.candidateMainCi.status, 'CI_PASS');
  assert.equal(evidence.evidence.candidateMainCi.runId, 31240531655);
  assert.equal(evidence.evidence.candidateMainCi.headSha, candidateMain);

  assert.equal(evidence.p0.mappedCount, 14);
  assert.deepEqual(
    evidence.p0.items.map(({ p0Id }) => p0Id),
    m1P0Ids,
  );
  assert.equal(
    evidence.p0.items.every(
      ({ status, candidateMainSha }) =>
        status === 'CI_PASS' && candidateMainSha === candidateMain,
    ),
    true,
  );
  assert.deepEqual(evidence.technicalChecks.failed, []);
  assert.equal(evidence.technicalChecks.m1Contract.testsPassed, 37);
  assert.equal(evidence.technicalChecks.p0E2e.testsPassed, 24);
  assert.equal(evidence.technicalChecks.migration.productMigrations, 11);
  assert.equal(evidence.technicalChecks.migration.cleanup, 'PASS');
  assert.equal(evidence.technicalChecks.fullVerify.stepsPassed, 17);

  assert.deepEqual(
    evidence.invariants.map(({ id }) => id),
    [
      'SINGLE_MERCHANT',
      'SUPPLIER_DATA_SCOPE',
      'FUNCTIONAL_WORKSPACE_ISOLATION',
      'NATURAL_PERSON_SEPARATION_OF_DUTIES',
      'SUPERADMIN_NO_BYPASS',
      'SENSITIVE_RESPONSE_WHITELIST',
    ],
  );
  assert.equal(evidence.invariants.every(({ status }) => status === 'PASS'), true);

  assert.deepEqual(evidence.blockers.map(({ id }) => id), ['EXT-005']);
  assert.equal(evidence.blockers[0].status, 'NOT_PROVIDED');
  assert.equal(evidence.blockers[0].blocksStage, true);
  assert.equal(evidence.externalItems.EXT006.blocksStage, false);
  assert.equal(evidence.decision.stagePassed, false);
  assert.equal(evidence.decision.m2Unlocked, false);
  assert.equal(evidence.decision.nextAllowedTask, 'M1-GATE');
});

test('M1 ledgers retain the exact-head gate while M2 advances one slice at a time', async () => {
  const [tasks, p0Rows, stageRows, externalRows] = await Promise.all([
    readCsv(taskLedgerPath),
    readCsv(p0LedgerPath),
    readCsv(stageGatePath),
    readCsv(externalDependencyPath),
  ]);

  const m1Prerequisites = tasks.filter(
    ({ TaskID }) => TaskID === 'M1-000' || /^M1-P\d{3}$/u.test(TaskID),
  );
  assert.equal(m1Prerequisites.length, 15);
  assert.equal(
    m1Prerequisites.every(
      ({ Status, EvidenceStatus, CI }) =>
        Status === 'DONE' && EvidenceStatus === 'CI_PASS' && CI === 'CI_PASS',
    ),
    true,
  );

  const m1Gate = tasks.find(({ TaskID }) => TaskID === 'M1-GATE');
  assert.equal(m1Gate.Status, 'DONE');
  assert.equal(m1Gate.EvidenceStatus, 'CI_PASS');
  assert.equal(m1Gate.Owner, 'CODEX');
  assert.equal(m1Gate.GitHubIssue, 'https://github.com/EasyStep-lee/flt1/issues/33');
  assert.equal(m1Gate.Branch, 'codex/m1-m1-gate');
  assert.equal(m1Gate.PullRequest, 'https://github.com/EasyStep-lee/flt1/pull/34');
  assert.equal(m1Gate.CommitSHA, m1GateMerge);
  assert.equal(m1Gate.CI, 'CI_PASS');
  assert.match(m1Gate.Notes, /f5febff/u);
  assert.match(m1Gate.Notes, /31295823535/u);

  const mappedRows = p0Rows.filter(({ P0ID }) => m1P0Ids.includes(P0ID));
  assert.equal(mappedRows.length, 14);
  assert.equal(
    mappedRows.every(
      ({ CurrentEvidenceStatus, LastVerifiedCommit }) =>
        CurrentEvidenceStatus === 'CI_PASS' &&
        /^[0-9a-f]{40}$/u.test(LastVerifiedCommit),
    ),
    true,
  );

  const m1Stage = stageRows.find(({ Stage }) => Stage === 'M1');
  const m2Stage = stageRows.find(({ Stage }) => Stage === 'M2');
  const m3Stage = stageRows.find(({ Stage }) => Stage === 'M3');
  assert.equal(m1Stage.Status, 'GATE_PASSED');
  assert.equal(m1Stage.EvidenceStatus, 'CI_PASS');
  assert.match(m1Stage.Notes, /31295823535/u);
  assert.equal(m2Stage.Status, 'IN_PROGRESS');
  assert.equal(m2Stage.EvidenceStatus, 'LOCAL_PASS');
  assert.equal(m3Stage.Status, 'LOCKED');
  assert.equal(m3Stage.EvidenceStatus, 'NOT_EXECUTED');

  const m2Contract = tasks.find(({ TaskID }) => TaskID === 'M2-000');
  const m2FirstSlice = tasks.find(({ TaskID }) => TaskID === 'M2-P006');
  const m2SecondSlice = tasks.find(({ TaskID }) => TaskID === 'M2-P007');
  const m2ThirdSlice = tasks.find(({ TaskID }) => TaskID === 'M2-P008');
  const m2EarlierSlice = tasks.find(({ TaskID }) => TaskID === 'M2-P010');
  const m2CompletedSlice = tasks.find(({ TaskID }) => TaskID === 'M2-P015');
  const m2CurrentSlice = tasks.find(({ TaskID }) => TaskID === 'M2-P016');
  assert.equal(m2Contract.Status, 'DONE');
  assert.equal(m2Contract.EvidenceStatus, 'CI_PASS');
  assert.equal(m2Contract.CI, 'CI_PASS');
  assert.equal(m2FirstSlice.Status, 'DONE');
  assert.equal(m2FirstSlice.EvidenceStatus, 'CI_PASS');
  assert.equal(m2FirstSlice.CI, 'CI_PASS');
  assert.equal(m2SecondSlice.Status, 'DONE');
  assert.equal(m2SecondSlice.EvidenceStatus, 'CI_PASS');
  assert.equal(m2SecondSlice.CI, 'CI_PASS');
  assert.equal(m2ThirdSlice.Status, 'DONE');
  assert.equal(m2ThirdSlice.EvidenceStatus, 'CI_PASS');
  assert.equal(m2ThirdSlice.CI, 'CI_PASS');
  assert.equal(m2EarlierSlice.Status, 'DONE');
  assert.equal(m2EarlierSlice.EvidenceStatus, 'CI_PASS');
  assert.equal(m2EarlierSlice.CI, 'CI_PASS');
  assert.equal(m2CompletedSlice.Status, 'DONE');
  assert.equal(m2CompletedSlice.EvidenceStatus, 'CI_PASS');
  assert.equal(m2CompletedSlice.CI, 'CI_PASS');
  assert.equal(m2CurrentSlice.Status, 'IN_PROGRESS');
  assert.equal(m2CurrentSlice.EvidenceStatus, 'LOCAL_PASS');
  assert.equal(m2CurrentSlice.CI, 'NOT_EXECUTED');

  const ext005 = externalRows.find(
    ({ DependencyID }) => DependencyID === 'EXT-005',
  );
  const ext006 = externalRows.find(
    ({ DependencyID }) => DependencyID === 'EXT-006',
  );
  assert.equal(ext005.CurrentStatus, 'PROVIDED');
  assert.equal(ext005.BlocksFormalAcceptance, 'YES');
  assert.equal(
    ext005.EvidenceLink,
    'artifacts/verification/M1-GATE/ext-005-company-confirmation.json',
  );
  assert.equal(ext006.CurrentStatus, 'NOT_PROVIDED');
  assert.equal(ext006.BlocksFormalAcceptance, 'NO');
});

test('project status records M1 gate success while historical blocked handoff stays immutable', async () => {
  const [projectStatus, handoff] = await Promise.all([
    readFile(projectStatusPath, 'utf8').then(JSON.parse),
    readFile(handoffPath, 'utf8'),
  ]);

  assert.equal(projectStatus.execution.status, 'M2_IN_PROGRESS');
  assert.equal(projectStatus.execution.currentStage, 'M2');
  assert.equal(projectStatus.execution.currentTask, 'M2-P016');
  assert.equal(projectStatus.execution.nextAllowedTask, 'M2-P016');
  assert.equal(projectStatus.execution.activeTaskCount, 1);
  assert.equal(projectStatus.execution.lastCompletedTask, 'M2-P015');
  assert.equal(projectStatus.execution.lastPassedGate, 'M1-GATE');
  assert.equal(
    projectStatus.execution.prohibitedUntilGate.some((item) => /M2/u.test(item)),
    true,
  );
  assert.equal(projectStatus.github.pullRequest, null);
  assert.equal(projectStatus.github.pullRequestState, 'NOT_CREATED');
  assert.equal(projectStatus.github.pullRequestMerged, false);
  assert.equal(projectStatus.github.mergeCommitSha, null);
  assert.equal(projectStatus.github.pullRequestCi.status, 'NOT_EXECUTED');
  assert.equal(projectStatus.github.pullRequestCi.headSha, null);
  assert.equal(projectStatus.github.latestCi.scope, 'CURRENT_SLICE_LOCAL');
  assert.equal(projectStatus.github.latestCi.status, 'LOCAL_PASS');
  assert.equal(projectStatus.github.latestCi.headSha, null);
  assert.equal(projectStatus.github.currentTaskDelivery.taskId, 'M2-P016');
  assert.equal(projectStatus.github.currentTaskDelivery.issue, 57);
  assert.equal(projectStatus.github.currentTaskDelivery.status, 'LOCAL_PASS');
  assert.equal(projectStatus.github.currentTaskDelivery.exactHeadCi, 'NOT_EXECUTED');
  assert.equal(projectStatus.github.currentTaskDelivery.m2p017StartAllowed, false);
  assert.equal(projectStatus.github.previousTaskDelivery.taskId, 'M2-P015');
  assert.equal(projectStatus.github.previousTaskDelivery.pullRequest, 56);
  assert.equal(
    projectStatus.github.previousTaskDelivery.exactHead,
    '7319f6f2fa13e490e46f262ba9aae7f0746016ad',
  );
  assert.equal(projectStatus.github.previousTaskDelivery.status, 'CI_PASS');
  assert.equal(projectStatus.evidence.local, 'LOCAL_PASS');
  assert.equal(projectStatus.evidence.ci, 'NOT_EXECUTED');
  assert.equal(projectStatus.evidence.staging, 'NOT_EXECUTED');
  assert.equal(projectStatus.evidence.device, 'NOT_EXECUTED');
  assert.equal(projectStatus.evidence.production, 'NOT_EXECUTED');

  assert.match(handoff, /^# M1-GATE 阶段门禁交接/u);
  assert.match(handoff, /阶段结论：`BLOCKED`/u);
  assert.match(handoff, /EXT-005/u);
  assert.match(handoff, /4ff02588379b1928448826d9f83b863c8c8b5bd8/u);
  assert.match(handoff, /31240531655/u);
  assert.match(handoff, /M2.*继续锁定/u);
  assert.match(handoff, /预发布.*`NOT_EXECUTED`/u);
  assert.match(handoff, /生产.*`NOT_EXECUTED`/u);
  assert.doesNotMatch(
    handoff,
    /阶段结论：`PASS`|M1-GATE[^\r\n]*GATE_PASSED|M2[^\r\n]*(?:已解锁|可开始)/u,
  );
});
