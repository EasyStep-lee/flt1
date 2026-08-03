import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const defaultEvidencePath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M0-012',
  'm0-stage-handoff-evidence.json',
);
const expectedTaskIds = Array.from(
  { length: 11 },
  (_, index) => `M0-${String(index + 1).padStart(3, '0')}`,
);

const fail = (marker) => {
  throw new Error(marker);
};

const parseArguments = (argumentsList) => {
  const values = {
    evidence: defaultEvidencePath,
    handoff: null,
    requireFreshVerification: false,
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const name = argumentsList[index];
    if (name === '--require-fresh-verification') {
      values.requireFreshVerification = true;
      continue;
    }
    if (name === '--evidence' || name === '--handoff') {
      const value = argumentsList[index + 1];
      if (!value) fail(`M0_HANDOFF_ARGUMENT_INVALID:${name}`);
      values[name.slice(2)] = path.resolve(repositoryRoot, value);
      index += 1;
      continue;
    }
    fail(`M0_HANDOFF_ARGUMENT_INVALID:${name}`);
  }
  return values;
};

const sha256 = (buffer) =>
  createHash('sha256').update(buffer).digest('hex').toUpperCase();

const verifyFileDescriptor = async (descriptor) => {
  if (!descriptor || !descriptor.path || !/^[0-9A-F]{64}$/u.test(descriptor.sha256)) {
    fail('M0_HANDOFF_FILE_DESCRIPTOR_INVALID');
  }
  const filePath = path.resolve(repositoryRoot, descriptor.path);
  const buffer = await readFile(filePath);
  if (buffer.length !== descriptor.bytes || sha256(buffer) !== descriptor.sha256) {
    fail(`M0_HANDOFF_FILE_HASH_MISMATCH:${descriptor.path}`);
  }
};

const verifyCommit = (commit) => {
  if (!/^[0-9a-f]{40}$/u.test(commit)) fail('M0_HANDOFF_COMMIT_INVALID');
  const result = spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) fail(`M0_HANDOFF_COMMIT_MISSING:${commit}`);
};

const verify = async (options) => {
  const evidence = JSON.parse(await readFile(options.evidence, 'utf8'));
  if (
    evidence.taskId !== 'M0-012' ||
    evidence.stage !== 'M0' ||
    evidence.status !== 'LOCAL_EVIDENCE_PACKAGE_GENERATED'
  ) {
    fail('M0_HANDOFF_IDENTITY_INVALID');
  }
  if (evidence.stageConclusion !== 'NOT_COMPLETE_AWAITING_M0_GATE') {
    fail('M0_HANDOFF_FALSE_STAGE_PASS');
  }
  if (evidence.summary?.p0Count !== 0) fail('M0_HANDOFF_M0_P0_COUNT_INVALID');
  if (
    evidence.github?.ci !== 'BLOCKED_EXTERNAL' ||
    evidence.github?.pullRequest !== 'NOT_EXECUTED' ||
    evidence.github?.actions !== 'NOT_EXECUTED' ||
    evidence.github?.mainMerge !== 'NOT_EXECUTED' ||
    evidence.github?.mainReverify !== 'NOT_EXECUTED'
  ) {
    fail('M0_HANDOFF_FALSE_CI_CLAIM');
  }
  if (
    evidence.resume?.nextAllowedTask !== 'M0-GATE' ||
    evidence.resume?.m1Unlocked !== false
  ) {
    fail('M0_HANDOFF_PREMATURE_M1');
  }
  if (evidence.evidenceBoundary?.formalM0Gate !== 'NOT_EXECUTED') {
    fail('M0_HANDOFF_FALSE_GATE_CLAIM');
  }
  verifyCommit(evidence.repository?.sourceCommit);

  if (
    !Array.isArray(evidence.tasks) ||
    evidence.tasks.length !== expectedTaskIds.length ||
    evidence.tasks.some((task, index) => task.taskId !== expectedTaskIds[index])
  ) {
    fail('M0_HANDOFF_TASK_INDEX_INVALID');
  }
  for (const task of evidence.tasks) {
    if (
      task.status !== 'DONE' ||
      task.evidenceStatus !== 'LOCAL_PASS' ||
      task.ci !== 'BLOCKED_EXTERNAL' ||
      task.commitIsAncestor !== true ||
      !Array.isArray(task.changedFiles) ||
      !/^[0-9A-F]{64}$/u.test(task.changedFilesSha256)
    ) {
      fail(`M0_HANDOFF_TASK_INVALID:${task.taskId}`);
    }
    verifyCommit(task.commit);
    await verifyFileDescriptor(task.handoff);
    for (const descriptor of task.evidence) {
      await verifyFileDescriptor(descriptor);
    }
  }

  if (
    options.requireFreshVerification &&
    (evidence.verification?.status !== 'PASS' ||
      evidence.verification?.commit !== evidence.repository.sourceCommit ||
      evidence.verification?.stepCount !== 17 ||
      evidence.verification?.passedSteps !== 17)
  ) {
    fail('M0_HANDOFF_FRESH_VERIFICATION_REQUIRED');
  }

  const handoffPath = options.handoff
    ? options.handoff
    : path.resolve(repositoryRoot, evidence.output.handoffPath);
  const handoff = await readFile(handoffPath, 'utf8');
  if (!handoff.startsWith('# M0 未完成交接（待 M0-GATE）')) {
    fail('M0_HANDOFF_TITLE_INVALID');
  }
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
    if (!handoff.includes(required)) fail(`M0_HANDOFF_SECTION_MISSING:${required}`);
  }
  if (
    /M0-GATE\s*(?:已通过|GATE_PASSED)|M1\s*已解锁|GitHub Actions\s*\|\s*`CI_PASS`/u.test(
      handoff,
    )
  ) {
    fail('M0_HANDOFF_FALSE_MARKDOWN_CLAIM');
  }
  process.stdout.write(
    `M0_HANDOFF_OK:tasks=${evidence.tasks.length}:source=${evidence.repository.sourceCommit}:verification=${evidence.verification.status}\n`,
  );
};

const options = parseArguments(process.argv.slice(2));
verify(options).catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'M0_HANDOFF_VERIFY_FAILED'}\n`,
  );
  process.exitCode = 1;
});
