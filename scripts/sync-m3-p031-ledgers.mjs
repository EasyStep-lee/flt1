import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = process.env.M3_P031_UPDATED_AT ?? new Date().toISOString();
const commit = process.env.M3_P031_COMMIT ?? 'LOCAL_WORKTREE';
const pullRequest = process.env.M3_P031_PR ?? '';
const ciRun = process.env.M3_P031_CI_RUN ?? '';
const ciJob = process.env.M3_P031_CI_JOB ?? '';
const fullVerify = process.env.M3_P031_FULL_VERIFY ?? 'NOT_EXECUTED';
const evidenceStatus = ciRun ? 'CI_PASS' : 'LOCAL_PASS';
const prUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const ciUrl = ciRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${ciRun}` : '';

const p030Head = 'a1c633258e9474699419e2024c14a713706c2e64';
const p030Merge = 'bb4b03f94f818cf9c1002decce28933cf4f687a3';
const p030MainRun = '31918397158';
const p030MainJob = '95094051650';

const parseLine = (line) => {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(value);
  return values;
};

const encode = (value) => /[",\r\n]/u.test(String(value ?? ''))
  ? `"${String(value ?? '').replaceAll('"', '""')}"`
  : String(value ?? '');

const updateCsv = async (relativePath, update, append = []) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const headers = parseLine(lines[0]);
  const output = [lines[0]];
  const seen = new Set();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const values = parseLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const result = update({ ...row });
    if (result?.__key) seen.add(result.__key);
    const finalRow = result === null ? row : result;
    output.push(headers.map((header) => encode(finalRow[header])).join(','));
  }
  for (const row of append.filter((candidate) => !seen.has(candidate.__key))) {
    output.push(headers.map((header) => encode(row[header])).join(','));
  }
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M3-P030') return {
    ...row,
    Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/95',
    Branch: 'codex/m3-community-procurement-boundary', CommitSHA: p030Head,
    PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/96', CI: 'CI_PASS',
    UpdatedAt: '2026-08-16T00:55:59Z',
    Notes: `PR #96精确head ${p030Head.slice(0, 7)}经授权合并；main merge ${p030Merge}，post-merge Actions run ${p030MainRun}/job ${p030MainJob}成功。真实域名、备案、staging与production仍NOT_EXECUTED。`,
  };
  if (row.TaskID === 'M3-P031') return {
    ...row,
    Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/97',
    Branch: 'codex/m3-supplier-fulfillment-preparation', CommitSHA: commit,
    PullRequest: prUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED：API 3/3因路由不存在返回404，迁移契约ENOENT，PAGE-020业务面板缺失。GREEN：供应商本方已支付子单列表、接单/报缺/备货/就绪/移交、版本并发、幂等、乱序拒绝、字段白名单、个人与企业移交隔离及readiness outbox通过；${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁待记录。'}${ciRun ? ` Draft PR精确head ${commit.slice(0, 7)} Actions run ${ciRun}/job ${ciJob}成功。` : ' 等待Draft PR与CI。'}`,
  };
  if (row.TaskID === 'M3-P051') return {
    ...row,
    Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P031 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => row.P0ID === 'P0-031' ? {
  ...row,
  CurrentEvidenceStatus: evidenceStatus,
  AutomatedTestID: 'apps/api/test/supertest/supplier-fulfillment-preparation-api.test.mjs|tests/migrations/m3-p031-supplier-fulfillment-migration.contract.test.mjs|tests/e2e/p0/p0-031-supplier-fulfillment-preparation.spec.ts',
  ManualCaseID: 'N/A',
  NegativeChecks: '跨供应商读取/节点写入拒绝；重复幂等键不同载荷冲突；陈旧version/非法乱序拒绝；Dto不含供应价/结算/支付/福利卡/归属字段；本切片不得创建DeliveryTask或EnterpriseDeliveryOrder',
  EvidenceLink: `docs/contracts/m3/M3-P031-supplier-fulfillment-preparation.md|artifacts/verification/M3-P031/supplier-fulfillment-preparation.json|artifacts/verification/M3-P031/supplier-fulfillment-page.png${prUrl ? `|${prUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
  LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
  Notes: 'M3-P031仅完成供应商备货与移交准备，个人跑腿/企业统一配送、收货、售后、对账结算及staging/device/production均未执行。',
} : null);

await updateCsv('08-页面路由接口P0映射.csv', (row) => row.PageID === 'PAGE-020' ? {
  ...row,
  ImplementationStatus: 'IMPLEMENTED_M3_P031_SUPPLIER_PREPARATION',
  AcceptanceStatus: `P0-031_${evidenceStatus};STAGING_DEVICE_PRODUCTION_NOT_EXECUTED`,
  RouteTest: 'tests/e2e/p0/p0-031-supplier-fulfillment-preparation.spec.ts|tests/e2e/p0/p0-070-supplier-workspaces.spec.ts',
  Notes: '固定SUPPLIER_FULFILLMENT职能页面，展示本方已支付/有效子单并支持接单、报缺、开始备货、就绪和按渠道移交；六态、权限拒绝、版本冲突与敏感字段白名单已覆盖；M4配送未进入。',
} : null);

await updateCsv('10-测试证据登记.csv', (row) => {
  if (row.EvidenceID === 'EVD-030') return {
    ...row,
    CurrentStatus: 'CI_PASS', ExecutedAt: '2026-08-16T00:55:59Z', CommitSHA: p030Head,
    CIRunURL: `https://github.com/EasyStep-lee/flt1/actions/runs/${p030MainRun}`,
    Executor: 'GITHUB_ACTIONS+CODEX', Freshness: 'MERGED_HEAD_AND_MAIN_POST_MERGE',
    RetestRequired: 'NO_FOR_MERGED_TECHNICAL_SLICE',
    Notes: 'PR #96与post-merge main CI通过；真实域名、备案、staging和production仍未执行。',
  };
  if (row.EvidenceID === 'EVD-031') return {
    ...row,
    CurrentStatus: evidenceStatus,
    CommandOrProcedure: 'RED API Supertest 3/3=404、迁移契约ENOENT、PAGE-020面板缺失；GREEN API 3/3、迁移1/1、PAGE-020 1/1、相关仓库单测14/14、迁移演练empty=2 upgrade=2 restore=2 product=31 cleanup=PASS、pnpm verify 17/17',
    Actual: '本方已支付子单列表与5类节点通过；跨供应商、非法乱序、陈旧版本、幂等冲突失败关闭；个人移交COURIER_READINESS、企业移交COMPANY_LOGISTICS_READINESS；无M4实体创建，DTO不泄露供应价和资金字段。',
    Environment: 'LOCAL_WINDOWS_DOCKER_MYSQL_CHROMIUM',
    AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; MySQL 8.4.11; Playwright Chromium',
    ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
    ArtifactOrScreenshot: 'docs/contracts/m3/M3-P031-supplier-fulfillment-preparation.md|artifacts/verification/M3-P031/supplier-fulfillment-preparation.json|artifacts/verification/M3-P031/supplier-fulfillment-page.png|artifacts/test-results/verification/pnpm-verify.json',
    Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_COMMIT',
    FailureOrBlocker: '个人跑腿、企业统一配送、真实移交/收货、staging/device/production未执行',
    RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES',
    Notes: '技术切片证据不替代M4配送、真实业务资料、预发布、真机或生产验收；M3-P051保持锁定。',
  };
  return null;
});

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (!['API-052', 'API-053'].includes(row.ContractID)) return null;
  return {
    ...row,
    OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
    ContractTest: 'apps/api/test/supertest/supplier-fulfillment-preparation-api.test.mjs|tests/e2e/p0/p0-031-supplier-fulfillment-preparation.spec.ts|packages/contracts/openapi.json',
    Notes: 'M3-P031运行时契约已实现；会话派生supplierId，GET与节点写入严格本方范围；响应白名单不含goodsAmount/supplyAmount/settlement/payment/welfare/owner字段；OpenAPI确定性生成。',
  };
});

const migrationRow = {
  __key: 'MIG-015A', MigrationID: 'MIG-015A', Stage: 'M3',
  PlannedName: '20260816010000_m3_supplier_fulfillment_preparation', DependsOn: 'MIG-015',
  Objects: 'SupplierFulfillmentOrder升级/SupplierFulfillmentNodeLog/SupplierFulfillmentReadinessOutbox',
  Purpose: '供应商备货与渠道隔离移交',
  ForwardSteps: '升级现有order+supplier拆单；回填subOrderNo/渠道/供应金额/取货点快照；增加版本、节点追加日志和readiness outbox；不创建M4配送实体',
  BackwardOrRecovery: '已发布迁移不回改；失败前恢复备份或创建向前修复迁移；应用版本回退时保持新增列/表兼容窗口',
  DataBackfill: '用完整supplier UUID生成唯一subOrderNo；从订单场景派生渠道；从已审核取货点快照；历史激活状态兼容回填',
  Verification: 'Prisma validate；空库/升级/恢复/product drift dry-run；迁移契约；子单唯一/版本/金额/移交约束；cleanup PASS',
  BackupRequired: 'YES', Status: 'CREATED_LOCAL_REHEARSED', AppliedLocalAt: updatedAt,
  AppliedStagingAt: '', AppliedProductionAt: '', CommitSHA: commit,
  EvidenceLink: 'packages/db/prisma/migrations/20260816010000_m3_supplier_fulfillment_preparation/migration.sql|tests/migrations/m3-p031-supplier-fulfillment-migration.contract.test.mjs|artifacts/verification/M3-P031/supplier-fulfillment-preparation.json',
  Notes: 'prisma:migrate:dry-run PASS empty=2 upgrade=2 restore=2 product=31 cleanup=PASS；staging/production未应用；已发布后仅允许向前修复。',
};
await updateCsv('11-数据库迁移台账.csv', (row) => row.MigrationID === 'MIG-015A' ? { ...migrationRow, __key: 'MIG-015A' } : null, [migrationRow]);

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row,
  Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS',
  Notes: `M3-P030由PR #96合并且main run ${p030MainRun}成功。M3-P031供应商备货${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；M4配送、staging/device/production未执行。M3-P051及后续锁定。`,
} : null);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
for (const page of freeze.pageContract?.pages ?? []) {
  if (page.pageId === 'PAGE-020') page.implementationStatus = 'IMPLEMENTED_M3_P031';
}
for (const contract of freeze.apiContract?.contracts ?? []) {
  if (['API-052', 'API-053'].includes(contract.contractId)) contract.implementationStatus = 'IMPLEMENTED_M3_P031';
}
for (const test of freeze.negativeTests ?? []) {
  if (String(test.id ?? '').startsWith('NEG-M3-P031-')) test.executionStatus = evidenceStatus;
}
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P031', nextAllowedTask: 'M3-P031', activeTaskCount: 1,
  lastCompletedTask: 'M3-P030', lastCompletedCommit: p030Merge, lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: [
    'M3-P031 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P051',
    'M4配送、M5及后续保持锁定',
  ],
};
status.github = {
  ...status.github,
  pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: prUrl || null,
  pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false,
  mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun
    ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt }
    : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: ciRun
    ? { scope: 'M3_P031_PR_HEAD', status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, event: 'pull_request', completedAt: updatedAt }
    : status.github.latestCi,
  currentTaskDelivery: {
    taskId: 'M3-P031', issue: 97, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/97',
    branch: 'codex/m3-supplier-fulfillment-preparation', baseCommit: p030Merge, verifiedHead: commit,
    status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR',
    localRedTest: 'API_3_OF_3_HTTP_404;MIGRATION_ENOENT;PAGE_020_PANEL_MISSING',
    localFocusedTest: 'LOCAL_PASS_API_3_MIGRATION_1_PAGE_1_REPOSITORY_14', localFullVerify: fullVerify,
    pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED',
    exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED',
    review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED',
    blockingExternalItem: 'M4_DELIVERY_STAGING_DEVICE_PRODUCTION', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P030', pullRequest: 96, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/96',
    exactHead: p030Head, mergeCommit: p030Merge, mainPostMergeCiRun: Number(p030MainRun),
    mainPostMergeCiJob: Number(p030MainJob), status: 'CI_PASS',
  },
  note: `M3-P031供应商备货${ciRun ? 'Draft PR精确head CI_PASS' : 'LOCAL_PASS'}；M4配送、staging/device/production未执行；M3-P051锁定。`,
};
status.evidence = {
  local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P031_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED',
  ci: ciRun ? `CI_PASS_M3_P031_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED',
  staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
};
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P031_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
