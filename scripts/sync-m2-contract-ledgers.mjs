import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executionPackRoot = path.join(repositoryRoot, '福礼社Codex5.6开发执行包V1.1');
const freezePath = path.join(
  repositoryRoot,
  'artifacts',
  'verification',
  'M2-000',
  'm2-contract-freeze.json',
);
const frozenAt = '2026-08-09T02:00:00-04:00';
const mainCommit = '162787ae1687116badf0972664005332220976f9';

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
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(current);
  return values;
};

const encodeCsvCell = (value) => {
  const text = String(value ?? '');
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const updateCsv = async (relativePath, updateRow) => {
  const filePath = path.join(executionPackRoot, relativePath);
  const content = await readFile(filePath, 'utf8');
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/u);
  const header = parseCsvLine(lines[0]);
  const updatedLines = [lines[0]];

  for (const line of lines.slice(1)) {
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? '']),
    );
    const updated = updateRow({ ...row });
    updatedLines.push(
      updated === null
        ? line
        : header.map((column) => encodeCsvCell(updated[column])).join(','),
    );
  }

  await writeFile(filePath, `${updatedLines.join(lineEnding)}${lineEnding}`, 'utf8');
};

const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const fieldByKey = new Map(
  freeze.fieldContract.entities.flatMap(({ entity, fields }) =>
    fields.map((field) => [`${entity}.${field.name}`, field]),
  ),
);
const negativeByP0 = new Map(
  freeze.scope.p0Ids.map((p0Id) => [
    p0Id,
    freeze.negativeTests.filter((negativeTest) => negativeTest.p0Id === p0Id),
  ]),
);
const roleByCode = new Map(
  freeze.permissionContract.roles.map((role) => [role.roleCode, role]),
);
const pageById = new Map(freeze.pageContract.pages.map((page) => [page.pageId, page]));
const migrationById = new Map(
  freeze.migrationContract.map((migration) => [migration.migrationId, migration]),
);

await updateCsv('05-字段字典初始版.csv', (row) => {
  if (row.Stage !== 'M2') return null;
  const frozenField = fieldByKey.get(`${row.Entity}.${row.Field}`);
  if (!frozenField) throw new Error(`M2_FIELD_NOT_FROZEN:${row.Entity}.${row.Field}`);
  row.SuggestedType = frozenField.type;
  row.UnitOrFormat = frozenField.format;
  row.Sensitivity = frozenField.sensitivity;
  row.Validation = frozenField.validation;
  row.P0 = frozenField.p0Ids.join(',');
  row.Status = 'FROZEN_M2_000';
  return row;
});

await updateCsv('06-状态机总表.csv', (row) => {
  if (row.Stage !== 'M2') return null;
  row.Status = 'FROZEN_M2_000';
  return row;
});

await updateCsv('07-权限与数据可见矩阵.csv', (row) => {
  if (row.Stage !== 'M2') return null;
  const frozenRole = roleByCode.get(row.RoleCode);
  if (!frozenRole) throw new Error(`M2_ROLE_NOT_FROZEN:${row.RoleCode}`);
  row.SupplyPriceVisibility = frozenRole.supplyPriceVisibility;
  row.Status = 'FROZEN_M2_000';
  return row;
});

await updateCsv('08-页面路由接口P0映射.csv', (row) => {
  if (row.Stage !== 'M2') return null;
  const frozenPage = pageById.get(row.PageID);
  if (!frozenPage) throw new Error(`M2_PAGE_NOT_FROZEN:${row.PageID}`);
  row.Notes = `${row.Notes}；M2-000仅冻结业务契约，页面壳沿用M1证据，M2业务仍NOT_IMPLEMENTED/NOT_EXECUTED`;
  return row;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.Stage !== 'M2') return null;
  const plannedNegatives = negativeByP0.get(row.P0ID);
  if (!plannedNegatives) throw new Error(`M2_P0_NEGATIVE_PLAN_MISSING:${row.P0ID}`);
  row.AutomatedTestID = plannedNegatives.map(({ id }) => id).join('|');
  row.NegativeChecks = [...new Set(plannedNegatives.map(({ category }) => category))].join('；');
  row.EvidenceLink = 'artifacts/verification/M2-000/m2-contract-freeze.json#negativeTests';
  row.Notes = 'M2-000仅冻结测试ID、失败行为和证据要求；业务切片须逐项先RED再实现；当前仍为NOT_EXECUTED';
  return row;
});

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (row.Stage !== 'M2') return null;
  row.ContractTest =
    'FREEZE:tests/contracts/m2-contract-freeze.contract.test.mjs;RUNTIME:TO_BE_CREATED';
  row.Owner = 'CODEX';
  row.Notes = 'M2-000已冻结DTO、错误码、权限、幂等和敏感字段策略；OpenAPI及运行时实现仍为PLANNED/NOT_IMPLEMENTED';
  return row;
});

await updateCsv('11-数据库迁移台账.csv', (row) => {
  if (row.Stage !== 'M2') return null;
  const migration = migrationById.get(row.MigrationID);
  if (!migration) throw new Error(`M2_MIGRATION_NOT_FROZEN:${row.MigrationID}`);
  row.Status = 'PLANNED';
  row.EvidenceLink = 'artifacts/verification/M2-000/m2-contract-freeze.json#migrationContract';
  row.Notes = 'M2-000仅冻结迁移顺序、不变量与恢复策略；未创建或应用任何M2迁移';
  return row;
});

await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M1-GATE') {
    row.Status = 'DONE';
    row.EvidenceStatus = 'CI_PASS';
    row.CommitSHA = mainCommit;
    row.CI = 'CI_PASS';
    row.UpdatedAt = '2026-08-09T01:12:11-04:00';
    row.Notes = 'PR #34按精确head f5febff授权并合并为162787a；main CI run 31295823535在该合并提交成功，M1-GATE PASS。';
    return row;
  }
  if (row.TaskID === 'M2-000') {
    row.Status = 'DONE';
    row.EvidenceStatus = 'LOCAL_PASS';
    row.Owner = 'CODEX';
    row.GitHubIssue = 'https://github.com/EasyStep-lee/flt1/issues/35';
    row.Branch = 'codex/m2-contract-freeze';
    row.CI = 'NOT_EXECUTED';
    row.UpdatedAt = frozenAt;
    row.Notes = '113字段、11状态转换、5职能、5页面、13 API及18项P0失败行为已冻结；未实现业务、未创建M2迁移；等待本PR精确head CI与人工合并。';
    return row;
  }
  if (row.TaskID === 'M2-P006') {
    row.Status = 'READY';
    row.EvidenceStatus = 'NOT_EXECUTED';
    row.Owner = 'UNASSIGNED';
    row.Notes = '仅在M2-000 PR合并且main最新CI成功后开始；当前不得进入实现。';
    return row;
  }
  return null;
});

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => {
  if (row.Stage === 'M1') {
    row.Status = 'GATE_PASSED';
    row.EvidenceStatus = 'CI_PASS';
    row.ApprovedBy = '@EasyStep-lee';
    row.ApprovedAt = '2026-08-09T01:02:05-04:00';
    row.Notes = 'PR #34精确head f5febff授权合并为162787a；main CI run 31295823535成功；M1-GATE PASS。';
    return row;
  }
  if (row.Stage === 'M2') {
    row.Status = 'IN_PROGRESS';
    row.EvidenceStatus = 'NOT_EXECUTED';
    row.Notes = 'M2-000契约冻结本地通过；M2业务切片未开始，当前PR与main CI门禁尚未完成。';
    return row;
  }
  return null;
});

await updateCsv('10-测试证据登记.csv', (row) => {
  if (row.EvidenceID !== 'EVD-M1-GATE') return null;
  row.CurrentStatus = 'CI_PASS';
  row.Actual = 'M1合同、P0、迁移、OpenAPI和verify技术证据通过；EXT-005脱敏确认已提供；PR #34及合并后main CI成功。';
  row.ExecutedAt = '2026-08-09T01:12:11-04:00';
  row.CommitSHA = mainCommit;
  row.CIRunURL = 'https://github.com/EasyStep-lee/flt1/actions/runs/31295823535';
  row.Freshness = 'FRESH_MAIN_POST_MERGE';
  row.FailureOrBlocker = '';
  row.RetestRequired = 'NO';
  row.Notes = 'M1-GATE在main合并提交162787a取得CI_PASS；M2已解锁。';
  return row;
});

const projectStatusPath = path.join(executionPackRoot, '16-项目状态.json');
const projectStatus = JSON.parse(await readFile(projectStatusPath, 'utf8'));
projectStatus.updatedAt = frozenAt;
projectStatus.execution = {
  status: 'M2_IN_PROGRESS',
  currentStage: 'M2',
  currentTask: 'M2-P006',
  nextAllowedTask: 'M2-P006',
  activeTaskCount: 0,
  lastCompletedTask: 'M2-000',
  lastCompletedCommit: 'PENDING_LOCAL_COMMIT',
  lastPassedGate: 'M1-GATE',
  prohibitedUntilGate: [
    'M2-000 PR精确head CI、人工合并及合并后main CI完成前不得开始M2-P006',
    'M2-P006以后的M2业务切片必须继续按任务依赖逐项解锁',
  ],
  persistentRestrictions: [
    'M2-GATE通过前M3及以后阶段保持LOCKED/NOT_STARTED',
    '真实支付/退款',
    '生产部署/迁移',
    '直接修改或推送main',
  ],
};
projectStatus.github = {
  repository: 'EasyStep-lee/flt1',
  visibility: 'public',
  defaultBranch: 'main',
  remoteConfirmed: true,
  authenticationConfirmed: true,
  writeAllowed: true,
  connectorAccessConfirmed: true,
  pullRequest: 34,
  pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/34',
  pullRequestState: 'MERGED',
  pullRequestMerged: true,
  mergeCommitSha: mainCommit,
  mergedAt: '2026-08-09T05:02:05Z',
  reviewPolicy: {
    mode: 'DOCUMENTED_SELF_REVIEW',
    developmentMode: 'SOLO_DEVELOPMENT',
    authorizedReviewer: '@EasyStep-lee',
    githubAccountCount: 1,
    additionalGithubAccountsRequired: false,
    githubSelfApprovalSupported: false,
    reviewEvidence: 'USER_EXACT_HEAD_AUTHORIZATION',
    reviewedHead: 'f5febff9dffadf7506ccc395722021057b4a303c',
    reviewDecision: 'APPROVED_FOR_READY_AND_MERGE',
    reviewCommentId: null,
    reviewedAt: '2026-08-09T05:02:05Z',
    currentHeadReviewRequired: false,
    authorizationExactHead: true,
  },
  lastVerifiedPullRequestHead: 'f5febff9dffadf7506ccc395722021057b4a303c',
  pullRequestCi: {
    status: 'CI_PASS',
    runId: 31295412411,
    jobId: 93199598880,
    runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31295412411',
    headSha: 'f5febff9dffadf7506ccc395722021057b4a303c',
  },
  latestCi: {
    scope: 'MAIN_POST_MERGE',
    status: 'CI_PASS',
    runId: 31295823535,
    jobId: 93200635788,
    runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31295823535',
    headSha: mainCommit,
    event: 'push',
    completedAt: '2026-08-09T05:09:05Z',
  },
  currentTaskDelivery: {
    taskId: 'M2-000',
    issue: 35,
    issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/35',
    branch: 'codex/m2-contract-freeze',
    baseCommit: mainCommit,
    status: 'LOCAL_PASS',
    technicalConclusion: 'LOCAL_PASS',
    blockingExternalItem: null,
    pullRequest: null,
    pullRequestState: 'NOT_CREATED',
    exactHeadCi: 'NOT_EXECUTED',
    review: 'NOT_EXECUTED',
    merge: 'NOT_EXECUTED',
    mainPostMergeCi: 'NOT_EXECUTED',
    m2p006StartAllowed: false,
  },
  previousTaskDelivery: {
    taskId: 'M1-GATE',
    pullRequest: 34,
    exactHead: 'f5febff9dffadf7506ccc395722021057b4a303c',
    mergeCommit: mainCommit,
    mainPostMergeCiRun: 31295823535,
    status: 'CI_PASS',
  },
  note: 'M1-GATE已在main@162787a取得CI_PASS；M2-000仅完成本地契约冻结，Issue #35已创建，Draft PR尚未创建，M2-P006仍受PR/main门禁约束。',
};
projectStatus.evidence = {
  local: 'LOCAL_PASS',
  ci: 'NOT_EXECUTED',
  staging: 'NOT_EXECUTED',
  device: 'NOT_REQUIRED_M2_000_CONTRACT_ONLY',
  production: 'NOT_EXECUTED',
};
await writeFile(projectStatusPath, `${JSON.stringify(projectStatus, null, 2)}\n`, 'utf8');

process.stdout.write('M2_CONTRACT_LEDGERS_SYNCED\n');
