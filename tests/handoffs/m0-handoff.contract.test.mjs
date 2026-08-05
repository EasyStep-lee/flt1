import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const generatorPath = path.join(
  repositoryRoot,
  'scripts',
  'generate-m0-handoff-evidence.mjs',
);
const verifierPath = path.join(
  repositoryRoot,
  'scripts',
  'verify-m0-handoff-evidence.mjs',
);
const expectedTaskIds = Array.from(
  { length: 11 },
  (_, index) => `M0-${String(index + 1).padStart(3, '0')}`,
);

const runNode = (scriptPath, argumentsList) =>
  spawnSync(process.execPath, [scriptPath, ...argumentsList], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: process.env,
  });

const generateFixture = async (directory) => {
  const evidencePath = path.join(directory, 'm0-handoff-evidence.json');
  const handoffPath = path.join(directory, 'm0-handoff.md');
  const sourceCommit = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).stdout.trim();
  const result = runNode(generatorPath, [
    '--output',
    evidencePath,
    '--handoff-output',
    handoffPath,
    '--source-commit',
    sourceCommit,
  ]);
  assert.equal(result.status, 0, result.stderr);
  return { evidencePath, handoffPath };
};

test('root test chain exposes the M0 handoff evidence contract', async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  );

  assert.equal(
    packageJson.scripts['test:m0-handoff'],
    'node --test ./tests/handoffs/*.test.mjs',
  );
  assert.match(packageJson.scripts.test, /pnpm test:m0-handoff/u);
  assert.match(packageJson.scripts.lint, /scripts\/generate-m0-handoff-evidence\.mjs/u);
  assert.match(packageJson.scripts.lint, /tests\/handoffs/u);
});

test('generator derives M0 ancestry from one rev-list reachable set', async () => {
  const generator = await readFile(generatorPath, 'utf8');

  assert.match(
    generator,
    /const reachableCommitsFrom = \(sourceCommit\) =>\s*new Set\(/u,
  );
  assert.equal(
    generator.match(/\['rev-list', sourceCommit\]/gu)?.length,
    1,
  );
  assert.match(
    generator,
    /const sourceAncestors = reachableCommitsFrom\(sourceCommit\);/u,
  );
  assert.match(generator, /sourceAncestors\.has\(commit\)/u);
  assert.doesNotMatch(generator, /\['merge-base', '--is-ancestor'/u);
});

test('generator produces a complete, hash-bound, non-passing M0 handoff package', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fulishe-m0-012-contract-'));
  try {
    const { evidencePath, handoffPath } = await generateFixture(directory);
    const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
    const handoff = await readFile(handoffPath, 'utf8');

    assert.equal(evidence.taskId, 'M0-012');
    assert.equal(evidence.stage, 'M0');
    assert.equal(evidence.status, 'LOCAL_EVIDENCE_PACKAGE_GENERATED');
    assert.equal(
      evidence.stageConclusion,
      'NOT_COMPLETE_AWAITING_M0_GATE',
    );
    assert.equal(evidence.summary.p0Count, 0);
    assert.deepEqual(
      evidence.tasks.map(({ taskId }) => taskId),
      expectedTaskIds,
    );
    assert.ok(
      evidence.tasks.every(
        ({ status, evidenceStatus, commit, handoff: taskHandoff }) =>
          status === 'DONE' &&
          evidenceStatus === 'LOCAL_PASS' &&
          /^[0-9a-f]{40}$/u.test(commit) &&
          /^[0-9A-F]{64}$/u.test(taskHandoff.sha256),
      ),
    );
    assert.equal(evidence.github.ci, 'BLOCKED_EXTERNAL');
    assert.equal(evidence.github.pullRequest, 'NOT_EXECUTED');
    assert.equal(evidence.github.actions, 'NOT_EXECUTED');
    assert.equal(evidence.github.mainMerge, 'NOT_EXECUTED');
    assert.equal(evidence.github.mainReverify, 'NOT_EXECUTED');
    assert.equal(evidence.resume.nextAllowedTask, 'M0-GATE');
    assert.equal(evidence.resume.m1Unlocked, false);

    assert.match(handoff, /^# M0 未完成交接（待 M0-GATE）/u);
    for (const required of [
      '严格范围',
      'M0任务与提交索引',
      '新鲜验证',
      '外部与人工阻塞',
      '风险与回滚',
      '恢复命令',
      '下一任务',
      'NOT_COMPLETE_AWAITING_M0_GATE',
    ]) {
      assert.match(handoff, new RegExp(required, 'u'));
    }
    assert.doesNotMatch(
      handoff,
      /M0-GATE\s*(?:已通过|GATE_PASSED)|M1\s*已解锁|GitHub Actions\s*\|\s*`CI_PASS`/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('verifier rejects false CI and premature M1 claims', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fulishe-m0-012-tamper-'));
  try {
    const { evidencePath, handoffPath } = await generateFixture(directory);
    const valid = runNode(verifierPath, [
      '--evidence',
      evidencePath,
      '--handoff',
      handoffPath,
    ]);
    assert.equal(valid.status, 0, valid.stderr);

    const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
    evidence.github.ci = 'CI_PASS';
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    const falseCi = runNode(verifierPath, [
      '--evidence',
      evidencePath,
      '--handoff',
      handoffPath,
    ]);
    assert.notEqual(falseCi.status, 0);
    assert.match(falseCi.stderr, /M0_HANDOFF_FALSE_CI_CLAIM/u);

    evidence.github.ci = 'BLOCKED_EXTERNAL';
    evidence.resume.nextAllowedTask = 'M1-000';
    evidence.resume.m1Unlocked = true;
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    const prematureM1 = runNode(verifierPath, [
      '--evidence',
      evidencePath,
      '--handoff',
      handoffPath,
    ]);
    assert.notEqual(prematureM1.status, 0);
    assert.match(prematureM1.stderr, /M0_HANDOFF_PREMATURE_M1/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
