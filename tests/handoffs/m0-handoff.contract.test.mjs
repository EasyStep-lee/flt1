import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
const taskLedgerPath = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
  '03-任务台账.csv',
);
const expectedTaskIds = Array.from(
  { length: 11 },
  (_, index) => `M0-${String(index + 1).padStart(3, '0')}`,
);

const runNode = (scriptPath, argumentsList, cwd = repositoryRoot) =>
  spawnSync(process.execPath, [scriptPath, ...argumentsList], {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });

const runGit = (argumentsList, cwd = repositoryRoot) =>
  spawnSync('git', argumentsList, {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });

const readRecordedTaskCommit = async (taskId) => {
  const ledger = await readFile(taskLedgerPath, 'utf8');
  const row = ledger
    .split(/\r?\n/u)
    .find((line) => line.startsWith(`${taskId},`));
  assert.ok(row, `Missing task ledger row for ${taskId}`);
  const commit = row.match(/(?:^|,)([0-9a-f]{40})(?:,|$)/u)?.[1];
  assert.match(commit ?? '', /^[0-9a-f]{40}$/u);
  return commit;
};

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

test('generator derives M0 ancestry from the raw commit parent graph', async () => {
  const generator = await readFile(generatorPath, 'utf8');

  assert.match(
    generator,
    /const commitParents = \(commit\) =>/u,
  );
  assert.match(generator, /\['cat-file', '-p', commit\]/u);
  assert.match(
    generator,
    /const reachableCommitsFrom = \(sourceCommit\) => \{/u,
  );
  assert.match(
    generator,
    /const sourceAncestors = reachableCommitsFrom\(sourceCommit\);/u,
  );
  assert.match(generator, /sourceAncestors\.has\(commit\)/u);
  assert.doesNotMatch(generator, /\['rev-list', sourceCommit\]/u);
  assert.doesNotMatch(generator, /\['merge-base', '--is-ancestor'/u);
});

test('generator follows raw parents when revision walk is shallow-truncated', async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'fulishe-m0-parent-graph-'),
  );
  const cloneRoot = path.join(directory, 'repository');
  try {
    const sourceCommit = runGit(['rev-parse', 'HEAD']).stdout.trim();
    const sourceGitDirectory = runGit([
      'rev-parse',
      '--absolute-git-dir',
    ]);
    assert.equal(sourceGitDirectory.status, 0, sourceGitDirectory.stderr);
    const clone = runGit([
      'clone',
      '--quiet',
      '--no-hardlinks',
      '--no-checkout',
      '--',
      repositoryRoot,
      cloneRoot,
    ]);
    assert.equal(clone.status, 0, clone.stderr);

    const checkout = runGit(
      ['checkout', '--quiet', '--detach', sourceCommit],
      cloneRoot,
    );
    assert.equal(checkout.status, 0, checkout.stderr);

    const cloneGeneratorPath = path.join(
      cloneRoot,
      'scripts',
      'generate-m0-handoff-evidence.mjs',
    );
    await writeFile(
      cloneGeneratorPath,
      await readFile(generatorPath, 'utf8'),
      'utf8',
    );
    const gitDirectory = runGit(
      ['rev-parse', '--absolute-git-dir'],
      cloneRoot,
    );
    assert.equal(gitDirectory.status, 0, gitDirectory.stderr);
    // A shallow source can suppress clone --shared, so expose its complete
    // object store explicitly before truncating this fixture's revision walk.
    const cloneObjectsInfoDirectory = path.join(
      gitDirectory.stdout.trim(),
      'objects',
      'info',
    );
    await mkdir(cloneObjectsInfoDirectory, { recursive: true });
    await writeFile(
      path.join(cloneObjectsInfoDirectory, 'alternates'),
      `${path.join(sourceGitDirectory.stdout.trim(), 'objects')}\n`,
      'utf8',
    );
    const recordedFirstTaskCommit = await readRecordedTaskCommit('M0-001');
    const completeObjectCheck = runGit(
      ['cat-file', '-e', `${recordedFirstTaskCommit}^{commit}`],
      cloneRoot,
    );
    assert.equal(
      completeObjectCheck.status,
      0,
      completeObjectCheck.stderr,
    );
    await writeFile(
      path.join(gitDirectory.stdout.trim(), 'shallow'),
      `${sourceCommit}\n`,
      'utf8',
    );

    const truncatedWalk = runGit(['rev-list', 'HEAD'], cloneRoot);
    assert.equal(truncatedWalk.status, 0, truncatedWalk.stderr);
    assert.equal(truncatedWalk.stdout.trim(), sourceCommit);

    const evidencePath = path.join(directory, 'evidence.json');
    const handoffPath = path.join(directory, 'handoff.md');
    const result = runNode(
      cloneGeneratorPath,
      [
        '--output',
        evidencePath,
        '--handoff-output',
        handoffPath,
        '--source-commit',
        sourceCommit,
      ],
      cloneRoot,
    );
    assert.equal(result.status, 0, result.stderr);

    const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
    assert.deepEqual(
      evidence.tasks.map(({ taskId }) => taskId),
      expectedTaskIds,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('generator still rejects a source before recorded M0 tasks', async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'fulishe-m0-non-ancestor-'),
  );
  try {
    const sourceCommit = await readRecordedTaskCommit('M0-001');
    const result = runNode(generatorPath, [
      '--output',
      path.join(directory, 'evidence.json'),
      '--handoff-output',
      path.join(directory, 'handoff.md'),
      '--source-commit',
      sourceCommit,
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /M0_HANDOFF_TASK_NOT_ANCESTOR:M0-002:[0-9a-f]{40}/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
