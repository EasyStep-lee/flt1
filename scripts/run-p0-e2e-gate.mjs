import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const p0SuiteRoot = path.join(repositoryRoot, 'tests', 'e2e', 'p0');

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
  if (quoted) throw new Error('P0_E2E_STAGE_CSV_UNTERMINATED_QUOTE');
  values.push(current);
  return values;
};

const readStageGate = async (stage) => {
  const source = await readFile(
    path.join(
      repositoryRoot,
      '福礼社Codex5.6开发执行包V1.1',
      'data',
      '阶段门禁.csv',
    ),
    'utf8',
  );
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
    if (record.Stage === stage) return record;
  }
  throw new Error(`P0_E2E_STAGE_GATE_MISSING:${stage}`);
};

const readTask = async (taskId) => {
  const source = await readFile(
    path.join(
      repositoryRoot,
      '福礼社Codex5.6开发执行包V1.1',
      '03-任务台账.csv',
    ),
    'utf8',
  );
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
    if (record.TaskID === taskId) return record;
  }
  throw new Error(`P0_E2E_CURRENT_TASK_MISSING:${taskId}`);
};

const findP0Specs = async (directory) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findP0Specs(entryPath)));
    } else if (/\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files.sort();
};

const run = async () => {
  const state = JSON.parse(
    await readFile(
      path.join(
        repositoryRoot,
        '福礼社Codex5.6开发执行包V1.1',
        '16-项目状态.json',
      ),
      'utf8',
    ),
  );
  const stage = state.execution?.currentStage;
  if (!stage) throw new Error('P0_E2E_CURRENT_STAGE_MISSING');
  const currentTask = state.execution?.currentTask;
  if (!currentTask) throw new Error('P0_E2E_CURRENT_TASK_MISSING');
  const gate = await readStageGate(stage);
  const task = await readTask(currentTask);
  if (task.Stage !== stage) {
    throw new Error(
      `P0_E2E_CURRENT_TASK_STAGE_MISMATCH:${currentTask}:${task.Stage}:${stage}`,
    );
  }
  const p0Count = Number.parseInt(gate.P0Count, 10);
  if (!Number.isSafeInteger(p0Count) || p0Count < 0) {
    throw new Error(`P0_E2E_STAGE_COUNT_INVALID:${gate.P0Count}`);
  }

  const specifications = await findP0Specs(p0SuiteRoot);
  if (specifications.length === 0) {
    if (stage === 'M0' && p0Count === 0) {
      process.stdout.write(
        'P0_E2E_NOT_APPLICABLE:stage=M0:p0Count=0:reason=M0_HAS_NO_MAPPED_P0\n',
      );
      return;
    }
    const isPreBusinessContractSlice =
      currentTask === `${stage}-000` &&
      task.Type === 'CONTRACT_SLICE_PLAN' &&
      task.P0ID === '' &&
      ['READY', 'IN_PROGRESS'].includes(task.Status) &&
      task.EvidenceStatus === 'NOT_EXECUTED' &&
      gate.Status === 'READY' &&
      gate.EvidenceStatus === 'NOT_EXECUTED';
    const completedContractTaskId = state.execution?.lastCompletedTask;
    const completedContractTask =
      completedContractTaskId === `${stage}-000`
        ? await readTask(completedContractTaskId)
        : null;
    const isCompletedContractSliceAwaitingExternalGate =
      completedContractTask !== null &&
      completedContractTask.Type === 'CONTRACT_SLICE_PLAN' &&
      completedContractTask.P0ID === '' &&
      completedContractTask.Status === 'DONE' &&
      completedContractTask.EvidenceStatus === 'LOCAL_PASS' &&
      completedContractTask.CI === 'NOT_EXECUTED' &&
      task.Type === 'BUSINESS_VERTICAL_SLICE' &&
      task.Status === 'READY' &&
      task.EvidenceStatus === 'NOT_EXECUTED' &&
      task.Owner === 'UNASSIGNED' &&
      task.Branch === '' &&
      task.CommitSHA === '' &&
      state.execution?.activeTaskCount === 0 &&
      state.evidence?.ci === 'NOT_EXECUTED' &&
      gate.Status === 'IN_PROGRESS' &&
      gate.EvidenceStatus === 'NOT_EXECUTED';
    if (
      isPreBusinessContractSlice ||
      isCompletedContractSliceAwaitingExternalGate
    ) {
      const contractTaskId = isPreBusinessContractSlice
        ? currentTask
        : completedContractTaskId;
      process.stdout.write(
        `P0_E2E_NOT_APPLICABLE:stage=${stage}:task=${contractTaskId}:p0Count=${p0Count}:reason=CONTRACT_SLICE_HAS_NO_MAPPED_P0\n`,
      );
      return;
    }
    throw new Error(
      `P0_E2E_SUITE_REQUIRED:stage=${stage}:p0Count=${p0Count}`,
    );
  }

  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli || !/\.(?:cjs|mjs|js)$/iu.test(pnpmCli)) {
    throw new Error('P0_E2E_PNPM_EXEC_PATH_REQUIRED');
  }
  const applicationBuilds = [
    '@fulishe/api...',
    '@fulishe/portal-web',
    '@fulishe/supplier-portal',
    '@fulishe/company-admin',
    '@fulishe/user-miniapp',
  ];
  for (const application of applicationBuilds) {
    const build = spawnSync(
      process.execPath,
      [pnpmCli, '--filter', application, 'build'],
      { cwd: repositoryRoot, env: process.env, stdio: 'inherit' },
    );
    if (build.error) throw build.error;
    if (build.status !== 0) {
      throw new Error(
        `P0_E2E_APPLICATION_BUILD_FAILED:${application}:${build.status ?? 1}`,
      );
    }
  }
  const result = spawnSync(
    process.execPath,
    [
      pnpmCli,
      'exec',
      'playwright',
      'test',
      '--config',
      'playwright.p0.config.ts',
    ],
    { cwd: repositoryRoot, env: process.env, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`P0_E2E_FAILED:${result.status ?? 1}`);
  }
};

run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'P0_E2E_GATE_FAILED'}\n`,
  );
  process.exitCode = 1;
});
