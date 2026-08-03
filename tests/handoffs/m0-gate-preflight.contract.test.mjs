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

test('M0 gate preflight stays blocked until GitHub governance and human merge evidence exist', async () => {
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  const handoff = await readFile(handoffPath, 'utf8');

  assert.equal(evidence.taskId, 'M0-GATE');
  assert.equal(evidence.status, 'PREFLIGHT_BLOCKED');
  assert.equal(evidence.gateConclusion, 'NOT_EXECUTED');
  assert.equal(evidence.stage, 'M0');
  assert.equal(evidence.p0.status, 'NOT_APPLICABLE');
  assert.equal(evidence.p0.mappedCount, 0);
  assert.match(evidence.candidate.headSha, /^[0-9a-f]{40}$/u);
  assert.equal(evidence.candidate.pullRequest, 2);
  assert.equal(evidence.candidate.draft, true);
  assert.equal(evidence.candidate.merged, false);
  assert.equal(evidence.evidence.ci.status, 'CI_PASS');
  assert.equal(evidence.evidence.ci.headSha, evidence.candidate.headSha);
  assert.equal(evidence.evidence.codeowners.errors, 0);

  const blockerIds = new Set(evidence.blockers.map(({ id }) => id));
  for (const required of [
    'GH_PLAN_BRANCH_PROTECTION_UNAVAILABLE',
    'GH_PLAN_ENVIRONMENT_REVIEWERS_UNAVAILABLE',
    'PR_STILL_DRAFT',
    'HUMAN_REVIEW_NOT_EXECUTED',
    'PR_NOT_MERGED',
    'MAIN_POST_MERGE_CI_NOT_EXECUTED',
  ]) {
    assert.equal(blockerIds.has(required), true, `missing blocker ${required}`);
  }

  assert.equal(evidence.resume.nextAllowedTask, 'M0-GATE');
  assert.equal(evidence.resume.m1Unlocked, false);
  assert.match(handoff, /门禁结论：`NOT_EXECUTED`/u);
  assert.match(handoff, /M1继续锁定/u);
  assert.doesNotMatch(
    handoff,
    /M0-GATE\s*(?:已通过|GATE_PASSED)|M1\s*(?:已解锁|可开始)/u,
  );
});
