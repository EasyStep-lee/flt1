import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  materializeVerificationStep,
  resolveVerificationBaseRef,
  verificationSteps,
} from './verification-plan.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const reportRelativePath =
  'artifacts/test-results/verification/pnpm-verify.json';
const reportPath = path.join(
  repositoryRoot,
  ...reportRelativePath.split('/'),
);

const runGit = (arguments_) => {
  const result = spawnSync('git', arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `VERIFY_GIT_FAILED:${arguments_.join(' ')}:${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim();
};

const pnpmInvocation = () => {
  const cliPath = process.env.npm_execpath;
  if (!cliPath || !/\.(?:cjs|mjs|js)$/iu.test(cliPath)) {
    throw new Error('VERIFY_PNPM_EXEC_PATH_REQUIRED:run through pnpm verify');
  }
  return { executable: process.execPath, prefix: [cliPath] };
};

const describeStep = (step) =>
  step.runner === 'pnpm'
    ? `pnpm ${step.arguments.join(' ')}`
    : `node ${step.arguments.join(' ')}`;

const executeStep = (step, pnpm) => {
  const startedAt = new Date();
  process.stdout.write(`\n[verify:${step.id}] ${describeStep(step)}\n`);
  const executable = step.runner === 'pnpm' ? pnpm.executable : process.execPath;
  const arguments_ =
    step.runner === 'pnpm'
      ? [...pnpm.prefix, ...step.arguments]
      : step.arguments;
  const result = spawnSync(executable, arguments_, {
    cwd: repositoryRoot,
    env: { ...process.env, NO_COLOR: process.env.NO_COLOR ?? '1' },
    stdio: 'inherit',
  });
  const endedAt = new Date();
  const exitCode = result.status ?? 1;
  return {
    id: step.id,
    command: describeStep(step),
    status: exitCode === 0 ? 'PASS' : 'FAIL',
    exitCode,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    error: result.error?.message ?? null,
  };
};

const saveReport = async (report) => {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
};

const run = async () => {
  const startedAt = new Date();
  const report = {
    schemaVersion: '1.0.0',
    taskId: 'M0-011',
    environment:
      process.env.GITHUB_ACTIONS === 'true'
        ? 'GITHUB_ACTIONS_RUNTIME'
        : 'LOCAL_RUNTIME',
    startedAt: startedAt.toISOString(),
    endedAt: null,
    status: 'RUNNING',
    commit: null,
    baseRef: null,
    baseRefSource: null,
    steps: [],
    reportPath: reportRelativePath,
    failure: null,
  };

  try {
    const baseRef = resolveVerificationBaseRef();
    report.baseRef = baseRef.value;
    report.baseRefSource = baseRef.source;
    report.commit = runGit(['rev-parse', 'HEAD']);
    runGit(['rev-parse', '--verify', `${baseRef.value}^{commit}`]);
    const pnpm = pnpmInvocation();

    for (let index = 0; index < verificationSteps.length; index += 1) {
      const step = materializeVerificationStep(
        verificationSteps[index],
        baseRef.value,
      );
      const result = executeStep(step, pnpm);
      report.steps.push(result);
      if (result.status === 'FAIL') {
        for (const remaining of verificationSteps.slice(index + 1)) {
          const pending = materializeVerificationStep(remaining, baseRef.value);
          report.steps.push({
            id: pending.id,
            command: describeStep(pending),
            status: 'NOT_EXECUTED_AFTER_FAILURE',
            exitCode: null,
            startedAt: null,
            endedAt: null,
            durationMs: 0,
            error: null,
          });
        }
        report.status = 'FAIL';
        report.failure = `VERIFY_STEP_FAILED:${result.id}`;
        process.exitCode = result.exitCode;
        break;
      }
    }

    if (report.status === 'RUNNING') report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL';
    report.failure = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    report.endedAt = new Date().toISOString();
    await saveReport(report);
  }

  if (report.status === 'PASS') {
    process.stdout.write(
      `\nPNPM_VERIFY_OK:steps=${report.steps.length}:base=${report.baseRef}:report=${reportRelativePath}\n`,
    );
  } else {
    process.stderr.write(
      `\nPNPM_VERIFY_FAILED:${report.failure}:report=${reportRelativePath}\n`,
    );
  }
};

await run();
