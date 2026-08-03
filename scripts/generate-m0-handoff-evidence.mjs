import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const executionPackRoot = path.join(
  repositoryRoot,
  '福礼社Codex5.6开发执行包V1.1',
);
const expectedTaskIds = Array.from(
  { length: 11 },
  (_, index) => `M0-${String(index + 1).padStart(3, '0')}`,
);

const normalizePath = (value) => value.split(path.sep).join('/');
const relativePath = (value) => normalizePath(path.relative(repositoryRoot, value));

const parseArguments = (argumentsList) => {
  const values = {
    output: path.join(
      repositoryRoot,
      'artifacts',
      'verification',
      'M0-012',
      'm0-stage-handoff-evidence.json',
    ),
    handoffOutput: path.join(
      repositoryRoot,
      'docs',
      'handoffs',
      `${new Date().toISOString().slice(0, 10)}-M0-stage-handoff-not-complete.md`,
    ),
    sourceCommit: 'HEAD',
  };
  const argumentNames = new Map([
    ['--output', 'output'],
    ['--handoff-output', 'handoffOutput'],
    ['--source-commit', 'sourceCommit'],
  ]);
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!argumentNames.has(name) || !value) {
      throw new Error(`M0_HANDOFF_ARGUMENT_INVALID:${name ?? 'missing'}`);
    }
    values[argumentNames.get(name)] = value;
  }
  values.output = path.resolve(repositoryRoot, values.output);
  values.handoffOutput = path.resolve(repositoryRoot, values.handoffOutput);
  return values;
};

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
  if (quoted) throw new Error('M0_HANDOFF_CSV_UNTERMINATED_QUOTE');
  values.push(current);
  return values;
};

const readCsv = async (filePath) => {
  const source = await readFile(filePath, 'utf8');
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
  });
};

const runGit = (argumentsList, { allowFailure = false } = {}) => {
  const result = spawnSync('git', argumentsList, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `M0_HANDOFF_GIT_FAILED:${argumentsList.join(' ')}:${result.stderr.trim()}`,
    );
  }
  return result;
};

const resolveCommit = (reference) => {
  const commit = runGit(['rev-parse', `${reference}^{commit}`]).stdout.trim();
  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    throw new Error(`M0_HANDOFF_COMMIT_INVALID:${reference}`);
  }
  return commit;
};

const hashBuffer = (buffer) =>
  createHash('sha256').update(buffer).digest('hex').toUpperCase();

const describeFile = async (filePath) => {
  const buffer = await readFile(filePath);
  const fileStat = await stat(filePath);
  return {
    path: relativePath(filePath),
    bytes: fileStat.size,
    sha256: hashBuffer(buffer),
  };
};

const listFiles = async (directory) => {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(directory, entry.name))
      .sort((left, right) => left.localeCompare(right, 'en'));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return [];
    throw error;
  }
};

const changedFilesForCommit = (commit) =>
  runGit([
    '-c',
    'core.quotepath=false',
    'show',
    '--format=',
    '--name-only',
    commit,
  ])
    .stdout.split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);

const commitMetadata = (commit) => ({
  commit,
  subject: runGit(['show', '-s', '--format=%s', commit]).stdout.trim(),
  committedAt: runGit(['show', '-s', '--format=%cI', commit]).stdout.trim(),
});

const commitIsAncestor = (commit, sourceCommit) =>
  runGit(['merge-base', '--is-ancestor', commit, sourceCommit], {
    allowFailure: true,
  }).status === 0;

const readVerificationReport = async (sourceCommit) => {
  const reportPath = path.join(
    repositoryRoot,
    'artifacts',
    'test-results',
    'verification',
    'pnpm-verify.json',
  );
  try {
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    if (report.commit !== sourceCommit) {
      return {
        status: 'NOT_EXECUTED_FOR_SOURCE_COMMIT',
        reportCommit: report.commit ?? null,
      };
    }
    const passedSteps = Array.isArray(report.steps)
      ? report.steps.filter(({ status }) => status === 'PASS').length
      : 0;
    return {
      status: report.status,
      command: `pnpm verify -- --base-ref ${report.baseRef}`,
      commit: report.commit,
      baseRef: report.baseRef,
      baseRefSource: report.baseRefSource,
      startedAt: report.startedAt,
      endedAt: report.endedAt,
      stepCount: report.steps?.length ?? 0,
      passedSteps,
      report: await describeFile(reportPath),
    };
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return { status: 'NOT_EXECUTED_FOR_SOURCE_COMMIT', reportCommit: null };
    }
    throw error;
  }
};

const markdownCell = (value) =>
  String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/gu, ' ');

const renderHandoff = (evidence) => {
  const taskRows = evidence.tasks
    .map(
      (task) =>
        `| ${task.taskId} | ${markdownCell(task.title)} | \`${task.commit}\` | ${task.evidenceStatus} | \`${task.handoff.path}\` | ${task.changedFiles.length} |`,
    )
    .join('\n');
  const blockerRows = evidence.humanGates
    .map(
      (blocker) =>
        `| ${blocker.id} | ${markdownCell(blocker.requiredInputOrDecision)} | ${blocker.status} | ${blocker.blocksFormalAcceptance} | ${markdownCell(blocker.safetyBoundary)} |`,
    )
    .join('\n');
  const verification = evidence.verification;
  const verificationResult =
    verification.status === 'PASS'
      ? `PASS ${verification.passedSteps}/${verification.stepCount}，提交 \`${verification.commit}\`，基线 \`${verification.baseRef}\``
      : `${verification.status}；本交接候选提交仍需新鲜运行根门禁`;

  return `# M0 未完成交接（待 M0-GATE）

## 1. 身份与基线

- 阶段：\`M0 环境、工程底座与契约冻结\`
- 交接任务：\`M0-012 形成M0交接证据包\`
- 生成时间：${evidence.generatedAt}
- 工作目录：\`${evidence.repository.root}\`
- 开发分支：\`${evidence.repository.branch}\`
- 证据源提交：\`${evidence.repository.sourceCommit}\`
- 综合方案SHA-256：\`${evidence.baseline.schemeSha256}\`
- 提示词/执行包：\`V1.1 / ${evidence.baseline.executionPackVersion}\`

## 2. 严格范围

本交接只汇总并验证M0工程底座，不新增供应商、商品、价格、库存、订单、福利卡、微信支付、配送、对账、CMS或任何业务页面。M0没有映射业务P0；不得把基础Playwright、UI图片或本地命令写成业务P0通过。

## 3. M0本地结果

- M0-001至M0-011均为\`DONE/LOCAL_PASS\`，提交对象存在且均为证据源提交的祖先。
- M0-012交付本机器证据、未完成阶段交接和恢复入口；完成后只允许进入\`M0-GATE\`评审。
- 根级质量门禁、固定SHA的CI模板、确定性OpenAPI/统一类型、Web与小程序传输适配、迁移演练、五端应用壳和安全配置均有本地证据索引。
- 阶段结论固定为\`${evidence.stageConclusion}\`；本文件不是门禁批准记录。

## 4. M0任务与提交索引

| 任务 | 结果 | 实现提交 | 证据级别 | 独立交接 | 实现文件数 |
|---|---|---|---|---|---:|
${taskRows}

机器索引同时保存每个实现提交的完整变更文件列表、交接文件SHA-256及低层证据文件SHA-256：\`${evidence.output.evidencePath}\`。

## 5. 新鲜验证

| 检查 | 结果 |
|---|---|
| 根\`pnpm verify\` | ${verificationResult} |
| M0业务P0 | \`NOT_APPLICABLE\`；M0映射P0数量为0，不是业务E2E通过 |
| GitHub Actions | \`${evidence.github.actions}\` |
| Pull Request | \`${evidence.github.pullRequest}\` |
| main合并与复验 | \`${evidence.github.mainMerge} / ${evidence.github.mainReverify}\` |
| 正式M0门禁 | \`NOT_EXECUTED\` |

## 6. 环境与恢复命令

- Node：\`${evidence.runtime.node}\`；pnpm：\`${evidence.runtime.pnpm}\`；Turborepo：\`${evidence.runtime.turbo}\`。
- 冻结安装：\`pnpm install --frozen-lockfile --ignore-scripts\`
- 本地基础设施：\`pnpm infra:up\`；状态：\`pnpm infra:status\`；停止：\`pnpm infra:down\`
- 公司后台：\`pnpm --filter @fulishe/company-admin dev\`（127.0.0.1:5173）
- 供应商后台：\`pnpm --filter @fulishe/supplier-portal dev\`（127.0.0.1:5174）
- 企业门户：\`pnpm --filter @fulishe/portal-web dev\`（127.0.0.1:3000）
- API：先\`pnpm --filter @fulishe/api build\`，再\`pnpm --filter @fulishe/api start\`
- 全量验证：\`pnpm verify -- --base-ref <40位不可变基线提交>\`
- 交接自检：\`pnpm test:m0-handoff\`；正式证据自检：\`node ./scripts/verify-m0-handoff-evidence.mjs --require-fresh-verification\`

## 7. OpenAPI、迁移、数据与页面边界

- OpenAPI/DTO/错误码：M0只建立健康检查契约、统一错误结构、确定性生成和传输适配；没有业务API。
- Prisma/Migration：产品schema仍无业务模型，产品SQL迁移数量为0；三数据库演练使用临时夹具，不代表MIG-001已应用。
- 页面：五端只有可独立构建的应用壳与公开/私有缓存索引边界，没有业务页面闭环。
- 资金/供应价/订单/配送：均未实现；没有真实支付、退款、银行转账或生产数据变更。

## 8. 外部与人工阻塞

| ID | 需要提供或决定 | 状态 | 阻塞正式验收 | 安全边界 |
|---|---|---|---|---|
${blockerRows}

GitHub CLI认证只证明本机登录，不证明目标仓库、默认分支或写权限。没有可验证origin时不得推送、创建PR或伪造Actions结果。

## 9. 安全复核

- 未把真实密钥、证书、Token、个人资料或支付凭据写入交接。
- 用户原有未跟踪UI资产、预览图片和旧版本资料不属于本阶段提交，必须继续保留并精确暂存。
- 供应价、资金、自然人双审、个人/企业配送隔离等产品红线尚未进入业务实现阶段，M0证据不能替代后续P0测试。

## 10. 风险与回滚

- 主要风险：GitHub目标与权限未确认，工作流尚未在真实PR执行；CODEOWNERS仍为示例；Actions Secrets/Environment尚未配置。
- 证据风险：本地\`LOCAL_PASS\`不能替代\`CI_PASS\`、\`STAGING_PASS\`、\`DEVICE_PASS\`或\`PRODUCTION_PASS\`。
- 应用回滚：交接生成器提交使用\`git revert ${evidence.repository.sourceCommit}\`；各历史任务按机器索引中的\`rollback.command\`逐项回退。
- 数据恢复：M0-012不含迁移、数据回写或外部状态；不得删除用户未跟踪文件。
- 触发阈值：基线哈希、任务提交、交接/证据哈希、17步根门禁任一不一致即停止门禁评审并修复证据。

## 11. 下一任务

- 唯一允许开始：\`${evidence.resume.nextAllowedTask} M0阶段门禁验收\`。
- 建议先做：以只读方式独立运行最新\`pnpm verify\`、迁移演练、OpenAPI差异、交接自检，并核对真实GitHub/PR/Actions状态。
- 禁止提前执行：M1及以后业务开发、真实支付/退款、生产部署/迁移、直接修改或推送main。
- M1解锁：\`${evidence.resume.m1Unlocked}\`。

## 12. 门禁结论

- 结论：\`${evidence.stageConclusion}\`
- 正式\`M0-GATE\`：\`NOT_EXECUTED\`
- 审核人/时间：\`UNASSIGNED / NOT_EXECUTED\`
- 说明：只有授权人工确认GitHub目标与门禁要求，并由M0-GATE基于最新证据作出结论后，才可能讨论M1；本交接本身不批准阶段。
`;
};

const run = async () => {
  const options = parseArguments(process.argv.slice(2));
  const sourceCommit = resolveCommit(options.sourceCommit);
  const baseline = JSON.parse(
    await readFile(
      path.join(repositoryRoot, 'docs', 'product', 'baseline-lock.json'),
      'utf8',
    ),
  );
  const state = JSON.parse(
    await readFile(path.join(executionPackRoot, '16-项目状态.json'), 'utf8'),
  );
  const manifest = JSON.parse(
    await readFile(path.join(executionPackRoot, 'manifest.json'), 'utf8'),
  );
  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  );
  const taskRows = await readCsv(path.join(executionPackRoot, '03-任务台账.csv'));
  const externalRows = await readCsv(
    path.join(executionPackRoot, '09-外部依赖与人工事项.csv'),
  );
  const handoffFiles = await listFiles(
    path.join(repositoryRoot, 'docs', 'handoffs'),
  );

  const tasks = [];
  for (const taskId of expectedTaskIds) {
    const row = taskRows.find((entry) => entry.TaskID === taskId);
    if (!row) throw new Error(`M0_HANDOFF_TASK_MISSING:${taskId}`);
    if (row.Status !== 'DONE' || row.EvidenceStatus !== 'LOCAL_PASS') {
      throw new Error(
        `M0_HANDOFF_TASK_NOT_LOCAL_PASS:${taskId}:${row.Status}:${row.EvidenceStatus}`,
      );
    }
    const commit = resolveCommit(row.CommitSHA);
    if (!commitIsAncestor(commit, sourceCommit)) {
      throw new Error(`M0_HANDOFF_TASK_NOT_ANCESTOR:${taskId}:${commit}`);
    }
    const matchingHandoffs = handoffFiles.filter((filePath) =>
      path.basename(filePath).includes(taskId),
    );
    if (matchingHandoffs.length !== 1) {
      throw new Error(
        `M0_HANDOFF_TASK_HANDOFF_COUNT:${taskId}:${matchingHandoffs.length}`,
      );
    }
    let evidenceFiles = await listFiles(
      path.join(repositoryRoot, 'artifacts', 'verification', taskId),
    );
    if (taskId === 'M0-001' && evidenceFiles.length === 0) {
      evidenceFiles = [
        path.join(repositoryRoot, 'docs', 'product', 'baseline-lock.json'),
      ];
    }
    const changedFiles = changedFilesForCommit(commit);
    tasks.push({
      taskId,
      title: row.Title,
      status: row.Status,
      evidenceStatus: row.EvidenceStatus,
      branch: row.Branch,
      ...commitMetadata(commit),
      commitIsAncestor: true,
      ci: row.CI || 'BLOCKED_EXTERNAL',
      changedFiles,
      changedFilesSha256: hashBuffer(
        Buffer.from(`${changedFiles.join('\n')}\n`, 'utf8'),
      ),
      handoff: await describeFile(matchingHandoffs[0]),
      evidence: await Promise.all(evidenceFiles.map(describeFile)),
      rollback: { command: `git revert ${commit}` },
    });
  }

  const sourceChangedFiles = changedFilesForCommit(sourceCommit);
  const remotes = runGit(['remote', '-v']).stdout
    .split(/\r?\n/u)
    .filter(Boolean);
  const evidence = {
    schemaVersion: '1.0.0',
    taskId: 'M0-012',
    stage: 'M0',
    generatedAt: new Date().toISOString(),
    status: 'LOCAL_EVIDENCE_PACKAGE_GENERATED',
    stageConclusion: 'NOT_COMPLETE_AWAITING_M0_GATE',
    baseline: {
      baselineId: baseline.baselineId,
      schemePath: baseline.canonical.scheme.relativePath,
      schemeSha256: baseline.canonical.scheme.sha256,
      promptPackVersion: 'V1.1',
      executionPackVersion: manifest.version,
      p0Range: manifest.baseline.p0Range,
      workbookSha256: manifest.workbook.sha256,
    },
    repository: {
      root: repositoryRoot,
      branch: runGit(['branch', '--show-current']).stdout.trim(),
      sourceCommit,
      ...commitMetadata(sourceCommit),
      remotesConfigured: remotes.length > 0,
      remoteCount: remotes.length,
    },
    runtime: {
      node: process.version,
      pnpm: packageJson.packageManager.split('@').at(-1),
      turbo: packageJson.devDependencies.turbo,
      typescript: packageJson.devDependencies.typescript,
    },
    summary: {
      totalM0ExecutionTasks: 12,
      indexedCompletedPredecessorTasks: tasks.length,
      completedTasksIncludingHandoff: 12,
      p0Count: 0,
      handoffCount: tasks.length,
      lowLevelEvidenceFileCount: tasks.reduce(
        (total, task) => total + task.evidence.length,
        0,
      ),
    },
    tasks,
    verification: await readVerificationReport(sourceCommit),
    github: {
      repository: state.github.repository,
      defaultBranch: state.github.defaultBranch,
      remoteConfirmed: state.github.remoteConfirmed,
      authenticationConfirmed: state.github.authenticationConfirmed,
      writeAllowed: state.github.writeAllowed,
      pullRequest: 'NOT_EXECUTED',
      actions: 'NOT_EXECUTED',
      ci: 'BLOCKED_EXTERNAL',
      unresolvedComments: 'NOT_EXECUTED',
      mainMerge: 'NOT_EXECUTED',
      mainReverify: 'NOT_EXECUTED',
      note: state.github.note,
    },
    humanGates: externalRows
      .filter(({ EarliestStage }) => EarliestStage === 'M0')
      .map((entry) => ({
        id: entry.DependencyID,
        category: entry.Category,
        requiredInputOrDecision: entry.RequiredInputOrDecision,
        owner: entry.Owner,
        status: entry.CurrentStatus,
        evidenceRequired: entry.EvidenceRequired,
        safetyBoundary: entry.SafetyBoundary,
        blockingTask: entry.BlockingTask,
        blocksFormalAcceptance: entry.BlocksFormalAcceptance,
      })),
    scopeBoundary: {
      sourceChangedFiles,
      businessCodeChanged: sourceChangedFiles.some((file) =>
        /^(?:apps|packages)\//u.test(file),
      ),
      prismaSchemaChanged: sourceChangedFiles.includes(
        'packages/db/prisma/schema.prisma',
      ),
      productMigrationSqlChanged: sourceChangedFiles.some((file) =>
        /^packages\/db\/prisma\/migrations\/.+\/migration\.sql$/u.test(file),
      ),
      openApiContractChanged: sourceChangedFiles.some((file) =>
        /^packages\/contracts\/(?:openapi\.json|types\.ts)$/u.test(file),
      ),
      businessPagesChanged: sourceChangedFiles.some((file) =>
        /^apps\/.+\/src\/(?:app|pages)\//u.test(file),
      ),
      realExternalStateChanged: false,
      sensitiveMaterialIncluded: false,
    },
    evidenceBoundary: {
      local: 'LOCAL_PASS',
      ci: 'NOT_EXECUTED',
      staging: 'NOT_EXECUTED',
      device: 'NOT_EXECUTED',
      production: 'NOT_EXECUTED',
      formalM0Gate: 'NOT_EXECUTED',
    },
    resume: {
      projectStatePath: '福礼社Codex5.6开发执行包V1.1/16-项目状态.json',
      nextAllowedTask: 'M0-GATE',
      m1Unlocked: false,
      firstCommands: [
        'pwsh -NoProfile -File ./scripts/verify-product-baseline.ps1',
        'git status --short',
        'git branch --show-current',
        'git remote -v',
        'pnpm test:m0-handoff',
        'pnpm verify -- --base-ref <40位不可变基线提交>',
      ],
      prohibitedUntilGate: state.execution.prohibitedUntilGate,
    },
    output: {
      evidencePath: relativePath(options.output),
      handoffPath: relativePath(options.handoffOutput),
    },
  };

  const handoff = renderHandoff(evidence);
  await mkdir(path.dirname(options.output), { recursive: true });
  await mkdir(path.dirname(options.handoffOutput), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  await writeFile(options.handoffOutput, handoff, 'utf8');
  process.stdout.write(
    `M0_HANDOFF_GENERATED:tasks=${tasks.length}:source=${sourceCommit}:evidence=${relativePath(options.output)}:handoff=${relativePath(options.handoffOutput)}\n`,
  );
};

run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'M0_HANDOFF_GENERATION_FAILED'}\n`,
  );
  process.exitCode = 1;
});
