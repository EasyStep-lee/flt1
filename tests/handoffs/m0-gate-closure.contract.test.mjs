import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const executionPackRoot = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
);
const closureEvidencePath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M0-GATE',
  'm0-gate-closure.json',
);
const closureHandoffPath = path.join(
  repositoryRoot,
  'docs',
  'handoffs',
  '2026-08-03-M0-gate-passed.md',
);
const projectStatusPath = path.join(executionPackRoot, '16-项目状态.json');
const taskLedgerPath = path.join(executionPackRoot, '03-任务台账.csv');
const stageGatePath = path.join(executionPackRoot, 'data', '阶段门禁.csv');
const manifestPath = path.join(executionPackRoot, 'manifest.json');
const workbookPath = path.join(
  executionPackRoot,
  '17-福礼社Codex5.6执行总控工作簿.xlsx',
);

const reviewedHead = 'cb3203c50a99e0a6b5fb27d92b3b9c3dadb90de6';
const mergedMain = '88b7a051300af763941c3e0ad0428111869f0182';

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

const readCsv = async (filePath) => {
  const lines = (await readFile(filePath, 'utf8')).split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
  });
};

test('M0 gate closure binds the human review, merge, and post-merge main CI', async () => {
  const evidence = JSON.parse(await readFile(closureEvidencePath, 'utf8'));

  assert.equal(evidence.schemaVersion, '1.0.0');
  assert.equal(evidence.taskId, 'M0-GATE');
  assert.equal(evidence.stage, 'M0');
  assert.equal(evidence.status, 'GATE_PASSED');
  assert.equal(evidence.gateConclusion, 'PASS');
  assert.equal(evidence.baseline.verification, 'PASS');
  assert.equal(
    evidence.baseline.schemeSha256,
    '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  );
  assert.equal(evidence.p0.mappedCount, 0);
  assert.equal(evidence.p0.status, 'NOT_APPLICABLE');
  assert.equal(evidence.p0.businessE2eClaimedPassed, false);

  assert.equal(evidence.governanceDecision.mode, 'DOCUMENTED_SELF_REVIEW');
  assert.equal(evidence.governanceDecision.authorizedReviewer, '@EasyStep-lee');
  assert.equal(evidence.governanceDecision.reviewedHead, reviewedHead);
  assert.equal(evidence.governanceDecision.reviewCommentId, 5173933866);
  assert.equal(evidence.governanceDecision.reviewDecision, 'APPROVED_FOR_MERGE');
  assert.equal(evidence.governanceDecision.additionalGithubAccountsRequired, false);

  assert.equal(evidence.pullRequest.number, 2);
  assert.equal(evidence.pullRequest.state, 'MERGED');
  assert.equal(evidence.pullRequest.draft, false);
  assert.equal(evidence.pullRequest.headSha, reviewedHead);
  assert.equal(evidence.pullRequest.mergeCommitSha, mergedMain);
  assert.equal(evidence.pullRequest.issueClosed, 1);
  assert.match(evidence.pullRequest.mergedAt, /^2026-08-04T02:33:12Z$/u);

  assert.equal(evidence.evidence.pullRequestCi.status, 'CI_PASS');
  assert.equal(evidence.evidence.pullRequestCi.runId, 30871743642);
  assert.equal(evidence.evidence.pullRequestCi.jobId, 91874978928);
  assert.equal(evidence.evidence.pullRequestCi.headSha, reviewedHead);
  assert.equal(evidence.evidence.mainPostMergeCi.status, 'CI_PASS');
  assert.equal(evidence.evidence.mainPostMergeCi.runId, 30872133076);
  assert.equal(evidence.evidence.mainPostMergeCi.jobId, 91876116003);
  assert.equal(evidence.evidence.mainPostMergeCi.headSha, mergedMain);
  assert.equal(evidence.evidence.mainPostMergeCi.event, 'push');
  assert.equal(evidence.evidence.localClosureVerify.status, 'PASS');
  assert.equal(evidence.evidence.localClosureVerify.baseSha, mergedMain);
  assert.equal(evidence.evidence.localClosureVerify.stepsPassed, 17);
  assert.equal(evidence.evidence.localClosureVerify.finalTreeVerified, true);
  assert.match(evidence.evidence.localClosureVerify.startedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.match(evidence.evidence.localClosureVerify.endedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.match(
    evidence.evidence.localClosureVerify.note,
    /second complete local verification validated the final tree/u,
  );

  assert.deepEqual(evidence.blockers, []);
  assert.equal(evidence.decision.approved, true);
  assert.equal(evidence.decision.lastPassedGate, 'M0-GATE');
  assert.equal(evidence.decision.nextAllowedTask, 'M1-000');
  assert.equal(evidence.decision.m1Unlocked, true);
  assert.equal(evidence.resume.nextAllowedTask, 'M1-000');
  assert.equal(evidence.resume.m1Unlocked, true);

  const constraintIds = new Set(evidence.knownConstraints.map(({ id }) => id));
  for (const id of [
    'MAIN_BRANCH_PROTECTION_NOT_CONFIGURED',
    'PRODUCTION_ENVIRONMENT_REVIEWER_NOT_CONFIGURED',
    'ACTIONS_REPOSITORY_POLICY_NOT_HARDENED',
  ]) {
    assert.equal(constraintIds.has(id), true, `missing known constraint ${id}`);
  }
  const warningIds = new Set(evidence.warnings.map(({ id }) => id));
  assert.equal(warningIds.has('ACTIONS_NODE20_RUNTIME_DEPRECATED'), true);
  assert.equal(warningIds.has('DEPENDABOT_NPM_NODE_ENGINE_MISMATCH'), true);
  assert.equal(warningIds.has('DEPENDABOT_DOCKER_MANIFEST_NOT_FOUND'), true);
});

test('project status and machine ledgers advance only to M1-000', async () => {
  const [projectStatus, taskRows, stageRows] = await Promise.all([
    readFile(projectStatusPath, 'utf8').then(JSON.parse),
    readCsv(taskLedgerPath),
    readCsv(stageGatePath),
  ]);

  assert.equal(projectStatus.execution.status, 'M0_GATE_PASSED');
  assert.equal(projectStatus.execution.currentStage, 'M1');
  assert.equal(projectStatus.execution.currentTask, 'M1-000');
  assert.equal(projectStatus.execution.nextAllowedTask, 'M1-000');
  assert.equal(projectStatus.execution.activeTaskCount, 0);
  assert.equal(projectStatus.execution.lastCompletedTask, 'M0-GATE');
  assert.equal(projectStatus.execution.lastCompletedCommit, mergedMain);
  assert.equal(projectStatus.execution.lastPassedGate, 'M0-GATE');
  assert.deepEqual(projectStatus.execution.prohibitedUntilGate, []);
  assert.equal(projectStatus.github.pullRequest, 2);
  assert.equal(projectStatus.github.pullRequestState, 'MERGED');
  assert.equal(projectStatus.github.pullRequestMerged, true);
  assert.equal(projectStatus.github.mergeCommitSha, mergedMain);
  assert.equal(projectStatus.github.reviewPolicy.reviewedHead, reviewedHead);
  assert.equal(
    projectStatus.github.reviewPolicy.reviewEvidence,
    'DOCUMENTED_SELF_REVIEW_COMPLETE',
  );
  assert.equal(projectStatus.github.reviewPolicy.currentHeadReviewRequired, false);
  assert.equal(projectStatus.github.latestCi.scope, 'MAIN_POST_MERGE');
  assert.equal(projectStatus.github.latestCi.status, 'CI_PASS');
  assert.equal(projectStatus.github.latestCi.runId, 30872133076);
  assert.equal(projectStatus.github.latestCi.jobId, 91876116003);
  assert.equal(projectStatus.github.latestCi.headSha, mergedMain);

  const m0Gate = taskRows.find(({ TaskID }) => TaskID === 'M0-GATE');
  const m1000 = taskRows.find(({ TaskID }) => TaskID === 'M1-000');
  assert.equal(m0Gate.Status, 'DONE');
  assert.equal(m0Gate.EvidenceStatus, 'CI_PASS');
  assert.equal(m0Gate.Owner, 'EasyStep-lee');
  assert.equal(m0Gate.GitHubIssue, '1');
  assert.equal(m0Gate.Branch, 'codex/m0-m0-handoff');
  assert.equal(m0Gate.CommitSHA, mergedMain);
  assert.equal(m0Gate.PullRequest, '2');
  assert.equal(m0Gate.CI, 'CI_PASS');
  assert.match(m0Gate.Notes, /30872133076/u);
  assert.equal(m1000.Status, 'READY');
  assert.equal(m1000.EvidenceStatus, 'NOT_EXECUTED');

  const m0Stage = stageRows.find(({ Stage }) => Stage === 'M0');
  const m1Stage = stageRows.find(({ Stage }) => Stage === 'M1');
  assert.equal(m0Stage.Status, 'GATE_PASSED');
  assert.equal(m0Stage.EvidenceStatus, 'CI_PASS');
  assert.equal(m0Stage.ApprovedBy, '@EasyStep-lee');
  assert.equal(m0Stage.ApprovedAt, '2026-08-03T22:36:19-04:00');
  assert.match(m0Stage.Notes, /88b7a051/u);
  assert.equal(m1Stage.Status, 'READY');
  assert.equal(m1Stage.EvidenceStatus, 'NOT_EXECUTED');
});

test('closure handoff and workbook manifest preserve the evidence boundary', async () => {
  const [handoff, manifest, workbook] = await Promise.all([
    readFile(closureHandoffPath, 'utf8'),
    readFile(manifestPath, 'utf8').then(JSON.parse),
    readFile(workbookPath),
  ]);

  assert.match(handoff, /^# M0-GATE 门禁通过交接/u);
  assert.match(handoff, /门禁结论：`PASS`/u);
  assert.match(handoff, /88b7a051300af763941c3e0ad0428111869f0182/u);
  assert.match(handoff, /30872133076/u);
  assert.match(handoff, /本闭环树完整验证 \| `LOCAL_PASS`/u);
  assert.match(handoff, /下一唯一允许任务：`M1-000`/u);
  assert.match(handoff, /真机.*`NOT_EXECUTED`/u);
  assert.match(handoff, /预发布.*`NOT_EXECUTED`/u);
  assert.match(handoff, /生产.*`NOT_EXECUTED`/u);
  assert.match(handoff, /Dependabot/u);
  assert.doesNotMatch(handoff, /M1(?:业务)?已开始/u);

  const workbookSha = createHash('sha256').update(workbook).digest('hex').toUpperCase();
  assert.equal(manifest.workbook.status, 'VERIFIED');
  assert.equal(manifest.workbook.sha256, workbookSha);
});
