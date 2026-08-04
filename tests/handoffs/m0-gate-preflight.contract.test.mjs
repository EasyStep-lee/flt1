import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const evidencePath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M0-GATE',
  'm0-gate-preflight.json',
);
const handoffPath = path.join(
  repositoryRoot,
  'docs',
  'handoffs',
  '2026-08-03-M0-gate-preflight-blocked.md',
);
const projectStatusPath = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
  '16-项目状态.json',
);
const codeownersPath = path.join(repositoryRoot, '.github', 'CODEOWNERS');
const pullRequestTemplatePath = path.join(
  repositoryRoot,
  '.github',
  'pull_request_template.md',
);
const githubGatePath = path.join(
  repositoryRoot,
  'docs',
  'architecture',
  'GITHUB_CI_GATE.md',
);

test('M0 gate preflight waits for documented solo review and human merge evidence', async () => {
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  const handoff = await readFile(handoffPath, 'utf8');

  assert.equal(evidence.taskId, 'M0-GATE');
  assert.equal(evidence.status, 'READY_FOR_SOLO_REVIEW');
  assert.equal(evidence.gateConclusion, 'NOT_EXECUTED');
  assert.equal(evidence.stage, 'M0');
  assert.equal(evidence.p0.status, 'NOT_APPLICABLE');
  assert.equal(evidence.p0.mappedCount, 0);
  assert.equal(evidence.candidate.visibility, 'public');
  assert.match(evidence.candidate.headSha, /^[0-9a-f]{40}$/u);
  assert.equal(evidence.candidate.pullRequest, 2);
  assert.equal(evidence.candidate.draft, true);
  assert.equal(evidence.candidate.merged, false);
  assert.equal(evidence.evidence.ci.status, 'CI_PASS');
  assert.equal(evidence.evidence.ci.headSha, evidence.candidate.headSha);
  assert.equal(evidence.evidence.codeowners.errors, 0);
  assert.equal(evidence.governanceDecision.developmentMode, 'SOLO_DEVELOPMENT');
  assert.equal(evidence.governanceDecision.authorizedReviewer, '@EasyStep-lee');
  assert.equal(evidence.governanceDecision.githubAccountCount, 1);
  assert.equal(evidence.governanceDecision.additionalGithubAccountsRequired, false);
  assert.equal(evidence.governanceDecision.pullRequestApprovalMode, 'DOCUMENTED_SELF_REVIEW');
  assert.equal(evidence.governanceDecision.githubSelfApprovalSupported, false);
  assert.equal(evidence.governanceDecision.reviewEvidence, 'SUPERSEDED_BEFORE_MERGE');
  assert.equal(
    evidence.governanceDecision.reviewedHead,
    '0ad4dc64abd1523f70fd95f4ebcd39121bb49d08',
  );
  assert.equal(evidence.governanceDecision.currentHeadReviewRequired, true);
  assert.equal(evidence.evidence.environments.production.requiredReviewers, 'NOT_CONFIGURED');
  assert.equal(evidence.evidence.githubGovernance.branchProtection, 'NOT_CONFIGURED_HTTP_404');
  assert.equal(evidence.evidence.githubGovernance.rulesets, 'NOT_CONFIGURED_EMPTY');

  const blockerIds = new Set(evidence.blockers.map(({ id }) => id));
  for (const required of [
    'PR_STILL_DRAFT',
    'SINGLE_HUMAN_SELF_REVIEW_NOT_EXECUTED',
    'PR_NOT_MERGED',
    'MAIN_POST_MERGE_CI_NOT_EXECUTED',
  ]) {
    assert.equal(blockerIds.has(required), true, `missing blocker ${required}`);
  }
  for (const acceptedConstraint of [
    'MAIN_BRANCH_PROTECTION_NOT_CONFIGURED',
    'PRODUCTION_ENVIRONMENT_REVIEWER_NOT_CONFIGURED',
    'ACTIONS_REPOSITORY_POLICY_NOT_HARDENED',
  ]) {
    assert.equal(blockerIds.has(acceptedConstraint), false);
    assert.equal(
      evidence.knownConstraints.some(({ id }) => id === acceptedConstraint),
      true,
      `missing known constraint ${acceptedConstraint}`,
    );
  }
  assert.equal(
    evidence.knownConstraints.some(({ id }) => id.startsWith('GH_PLAN_')),
    false,
  );
  assert.equal(
    evidence.resume.requiredActions.some((action) => /independent|invite|new account/iu.test(action)),
    false,
  );

  assert.equal(evidence.resume.nextAllowedTask, 'M0-GATE');
  assert.equal(evidence.resume.m1Unlocked, false);
  assert.match(handoff, /门禁结论：`NOT_EXECUTED`/u);
  assert.match(handoff, /M1继续锁定/u);
  assert.match(handoff, /单人开发/u);
  assert.match(handoff, /不新增GitHub账号/u);
  assert.match(handoff, /仓库可见性：`public`/u);
  assert.match(handoff, /main.*HTTP 404/u);
  assert.doesNotMatch(handoff, /独立授权评审|邀请或指定独立|提供独立/u);
  assert.doesNotMatch(
    handoff,
    /M0-GATE\s*(?:已通过|GATE_PASSED)|M1\s*(?:已解锁|可开始)/u,
  );
});

test('project status supersedes the historical preflight after exact-head gate closure', async () => {
  const projectStatus = JSON.parse(await readFile(projectStatusPath, 'utf8'));

  assert.equal(projectStatus.execution.status, 'M0_GATE_PASSED');
  assert.equal(projectStatus.execution.currentStage, 'M1');
  assert.equal(projectStatus.execution.currentTask, 'M1-000');
  assert.equal(projectStatus.execution.nextAllowedTask, 'M1-000');
  assert.equal(projectStatus.execution.activeTaskCount, 0);
  assert.equal(projectStatus.execution.lastPassedGate, 'M0-GATE');
  assert.deepEqual(projectStatus.execution.prohibitedUntilGate, []);

  assert.equal(projectStatus.github.repository, 'EasyStep-lee/flt1');
  assert.equal(projectStatus.github.visibility, 'public');
  assert.equal(projectStatus.github.defaultBranch, 'main');
  assert.equal(projectStatus.github.remoteConfirmed, true);
  assert.equal(projectStatus.github.authenticationConfirmed, true);
  assert.equal(projectStatus.github.writeAllowed, true);
  assert.equal(projectStatus.github.connectorAccessConfirmed, true);
  assert.equal(projectStatus.github.pullRequest, 2);
  assert.equal(projectStatus.github.pullRequestState, 'MERGED');
  assert.equal(projectStatus.github.pullRequestMerged, true);
  assert.equal(projectStatus.github.reviewPolicy.mode, 'DOCUMENTED_SELF_REVIEW');
  assert.equal(projectStatus.github.reviewPolicy.authorizedReviewer, '@EasyStep-lee');
  assert.equal(projectStatus.github.reviewPolicy.additionalGithubAccountsRequired, false);
  assert.equal(
    projectStatus.github.reviewPolicy.reviewEvidence,
    'DOCUMENTED_SELF_REVIEW_COMPLETE',
  );
  assert.equal(
    projectStatus.github.reviewPolicy.reviewedHead,
    'cb3203c50a99e0a6b5fb27d92b3b9c3dadb90de6',
  );
  assert.equal(projectStatus.github.reviewPolicy.currentHeadReviewRequired, false);
  assert.match(projectStatus.github.lastVerifiedPullRequestHead, /^[0-9a-f]{40}$/u);
  assert.equal(projectStatus.github.latestCi.status, 'CI_PASS');
  assert.match(projectStatus.github.latestCi.headSha, /^[0-9a-f]{40}$/u);
  assert.equal(
    projectStatus.github.latestCi.headSha,
    '88b7a051300af763941c3e0ad0428111869f0182',
  );

  assert.equal(projectStatus.evidence.local, 'LOCAL_PASS');
  assert.equal(projectStatus.evidence.ci, 'CI_PASS');
  assert.equal(projectStatus.evidence.staging, 'NOT_EXECUTED');
  assert.equal(projectStatus.evidence.device, 'NOT_EXECUTED');
  assert.equal(projectStatus.evidence.production, 'NOT_EXECUTED');
});

test('repository documents one-account review without weakening CI or merge evidence', async () => {
  const [codeowners, pullRequestTemplate, githubGate] = await Promise.all([
    readFile(codeownersPath, 'utf8'),
    readFile(pullRequestTemplatePath, 'utf8'),
    readFile(githubGatePath, 'utf8'),
  ]);

  const owners = new Set(codeowners.match(/@[A-Za-z0-9-]+/gu) ?? []);
  assert.deepEqual([...owners], ['@EasyStep-lee']);
  assert.match(codeowners, /单人开发/u);
  assert.match(codeowners, /不新增GitHub账号/u);
  assert.match(pullRequestTemplate, /单人开发自审/u);
  assert.match(pullRequestTemplate, /GitHub不允许PR作者批准自己的PR/u);
  assert.match(githubGate, /DOCUMENTED_SELF_REVIEW/u);
  assert.match(githubGate, /CI通过不能替代人工自审/u);
  assert.match(githubGate, /公开仓库/u);
  assert.match(githubGate, /main.*未配置保护/u);
  assert.doesNotMatch(githubGate, /邀请.*独立.*账号|新增.*评审.*账号/u);
});
