import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = process.env.M3_P029_UPDATED_AT ?? new Date().toISOString();
const commit = process.env.M3_P029_COMMIT ?? 'LOCAL_WORKTREE';
const pullRequest = process.env.M3_P029_PR ?? '';
const ciRun = process.env.M3_P029_CI_RUN ?? '';
const ciJob = process.env.M3_P029_CI_JOB ?? '';
const fullVerify = process.env.M3_P029_FULL_VERIFY ?? 'NOT_EXECUTED';
const evidenceStatus = ciRun ? 'CI_PASS' : 'LOCAL_PASS';
const prUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const ciUrl = ciRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${ciRun}` : '';

const parse = (line) => {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted && char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { values.push(value); value = ''; }
    else value += char;
  }
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(value);
  return values;
};
const encode = (value) => /[",\r\n]/u.test(String(value ?? ''))
  ? `"${String(value ?? '').replaceAll('"', '""')}"`
  : String(value ?? '');
const updateCsv = async (relative, mutate) => {
  const target = path.join(pack, relative);
  const source = await readFile(target, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const headers = parse(lines[0]);
  const output = [lines[0]];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const values = parse(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const changed = mutate({ ...row });
    output.push(changed ? headers.map((header) => encode(changed[header])).join(',') : line);
  }
  await writeFile(target, `${output.join(eol)}${eol}`, 'utf8');
};

await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M3-P028') return {
    ...row, Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX',
    Branch: 'codex/m3-enterprise-registration', CommitSHA: 'ee7fdff5170de7e06ae24da77abaf60e2eee89c2',
    PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/92', CI: 'CI_PASS', UpdatedAt: '2026-08-15T08:48:08Z',
    Notes: 'PR #92精确head ee7fdff经授权合并；main merge fa083beb195c769cc4168dcac38e817e3df2a873，post-merge Actions run 31874947792/job 94989178288成功。M3-P029已解锁。',
  };
  if (row.TaskID === 'M3-P029') return {
    ...row, Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/93', Branch: 'codex/m3-enterprise-procurement',
    CommitSHA: commit, PullRequest: prUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED：企业订单携带地址/发票/付款方式预期201、实际422。GREEN：跨供应商企业主订单、会话派生所有者、地址/发票不可变快照、微信/对公转账二选一、幂等冲突、脱敏DTO和付款状态联动通过。${ciRun ? `Draft PR精确head ${commit.slice(0, 7)} Actions run ${ciRun}/job ${ciJob}成功。` : '等待Draft PR与CI。'} P0-029完整配送、收货、售后、发票与P0-079/P0-080页面保持NOT_EXECUTED。`,
  };
  if (row.TaskID === 'M3-P030') return {
    ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P029 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => row.P0ID === 'P0-029' ? {
  ...row, CurrentEvidenceStatus: 'NOT_EXECUTED',
  AutomatedTestID: 'PARTIAL:apps/api/test/supertest/unified-enterprise-procurement-api.test.mjs|apps/api/test/unit/prisma-order-repository.test.mjs|apps/api/test/unit/prisma-payment-repository.test.mjs|apps/api/test/unit/prisma-enterprise-remittance-repository.test.mjs|tests/e2e/p0/p0-029-unified-enterprise-procurement.spec.ts',
  NegativeChecks: '非法/缺失字段零写入；客户端所有者字段拒绝；跨企业地址/发票拒绝；停用企业/无采购权限拒绝；同幂等键异体付款方式冲突；供应价与原始敏感字段不返回',
  EvidenceLink: `PARTIAL:docs/contracts/m3/M3-P029-unified-enterprise-procurement.md|artifacts/verification/M3-P029/unified-enterprise-procurement.json${prUrl ? `|${prUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
  LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
  Notes: 'M3-P029当前切片仅完成统一企业订单与付款路由技术闭环；企业统一配送、收货、售后、发票和完整门户页面仍属后续任务，故P0-029整体保持NOT_EXECUTED。',
} : null);

await updateCsv('05-字段字典初始版.csv', (row) => row.Entity === 'EnterpriseProcurementOrder'
  ? { ...row, Status: 'IMPLEMENTED_M3_P029' }
  : null);
await updateCsv('06-状态机总表.csv', (row) => row.StateMachine === 'EnterpriseProcurementOrder'
  ? { ...row, Status: 'IMPLEMENTED_M3_P029' }
  : null);

await updateCsv('10-测试证据登记.csv', (row) => row.EvidenceID === 'EVD-029' ? {
  ...row, CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'RED Supertest；GREEN API 10 tests、Prisma order/payment/remittance 13 tests、MIG-015 contract、P0-029 Playwright、prisma validate/migrate dry-run、OpenAPI generate/check、pnpm verify',
  Actual: '企业跨供应商主订单、地址/发票快照、付款路由、幂等、权限/归属、脱敏及微信/转账状态联动通过。',
  Environment: 'LOCAL_WINDOWS_NODE22_MYSQL8_DOCKER_PLAYWRIGHT_CHROMIUM',
  AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Prisma 6.19.2; Playwright Chromium',
  ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P029-unified-enterprise-procurement.md|artifacts/verification/M3-P029/unified-enterprise-procurement.json|artifacts/test-results/verification/pnpm-verify.json',
  Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_WORKTREE',
  FailureOrBlocker: 'P0-029完整门户页面、配送、收货、售后、发票；真实微信/银行、staging/device/production未执行',
  RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES',
  Notes: '自动化技术证据不得升级为真实微信支付、对公转账或完整P0-029业务验收。',
} : null);

await updateCsv('11-数据库迁移台账.csv', (row) => row.MigrationID === 'MIG-015' ? {
  ...row, PlannedName: '20260815030000_m3_enterprise_procurement_order',
  ForwardSteps: '创建EnterpriseProcurementOrder；BuyerOrder一对一；企业/采购员外键；地址/发票JSON快照；微信/对公转账付款路由与状态版本',
  DataBackfill: 'NONE_NEW_TABLE_ONLY',
  Verification: 'Prisma validate；空库/升级/恢复/product drift dry-run；快照不可变触发器；归属、付款路由和版本并发测试',
  Status: 'CREATED_LOCAL_REHEARSED', AppliedLocalAt: updatedAt, CommitSHA: commit,
  EvidenceLink: 'packages/db/prisma/migrations/20260815030000_m3_enterprise_procurement_order/migration.sql|tests/migrations/m3-p029-enterprise-procurement-migration.contract.test.mjs|artifacts/verification/M3-P029/unified-enterprise-procurement.json',
  Notes: 'prisma:migrate:dry-run PASS empty=2 upgrade=2 restore=2 product=30 cleanup=PASS；staging/production未应用；已发布后仅允许向前修复。',
} : null);

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => row.ContractID === 'API-048' ? {
  ...row, RequestDTO: 'CreateEnterpriseOrderRequestDto', ResponseDTO: 'CreateEnterpriseOrderResponseDto',
  ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCESS_DENIED|FIELD_FORBIDDEN|VALIDATION_FAILED|PRODUCT_NOT_SALEABLE|IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_CONFLICT|INVENTORY_INSUFFICIENT|INVENTORY_RESERVATION_CONFLICT|ENTERPRISE_NOT_ACTIVE|ENTERPRISE_SCOPE_FORBIDDEN|ENTERPRISE_PROFILE_INCOMPLETE',
  SensitiveFieldPolicy: 'NEVER_RETURN_SUPPLY_PRICE; DTO_WHITE_LIST; owner IDs server-derived; address mobile/tax number/registered phone masked; immutable selected profile snapshots',
  MoneyRule: 'INTEGER_CENTS; SERVER_RECALCULATED_ENTERPRISE_PRICE; WECHAT_PAY_OR_BANK_TRANSFER_ONLY',
  OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/unified-enterprise-procurement-api.test.mjs|apps/api/test/unit/prisma-order-repository.test.mjs|tests/e2e/p0/p0-029-unified-enterprise-procurement.spec.ts|packages/contracts/openapi.json',
  Notes: 'M3-P029统一企业主订单和付款路由已实现；配送、收货、售后、发票及完整门户页面仍后续执行。',
} : null);

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row, Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS',
  Notes: `M3-P028由PR #92合并且main run 31874947792成功。M3-P029统一企业订单技术切片${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；P0-029完整配送/收货/售后/发票、真实支付、staging/device/production未执行。M3-P030及后续锁定。`,
} : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P029', nextAllowedTask: 'M3-P029', activeTaskCount: 1,
  lastCompletedTask: 'M3-P028', lastCompletedCommit: 'fa083beb195c769cc4168dcac38e817e3df2a873', lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: ['M3-P029 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P030', 'P0-029后续页面/配送/售后/发票、M4及后续保持锁定'],
};
status.github = {
  ...status.github, pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: prUrl || null,
  pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null,
  lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun
    ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt }
    : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  currentTaskDelivery: {
    taskId: 'M3-P029', issue: 93, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/93', branch: 'codex/m3-enterprise-procurement',
    baseCommit: 'fa083beb195c769cc4168dcac38e817e3df2a873', verifiedHead: commit,
    status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR',
    localRedTest: 'ENTERPRISE_CHECKOUT_EXPECTED_201_ACTUAL_422', localFocusedTest: 'LOCAL_PASS_API_10_PRISMA_13_MIGRATION_AND_P0_E2E', localFullVerify: fullVerify,
    pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED',
    exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED',
    blockingExternalItem: 'P0_029_FULL_UI_DELIVERY_RECEIPT_AFTERSALES_INVOICE_REAL_PAYMENT_STAGING_DEVICE_PRODUCTION', nextTaskUnlocked: false,
  },
  previousTaskDelivery: { taskId: 'M3-P028', pullRequest: 92, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/92', exactHead: 'ee7fdff5170de7e06ae24da77abaf60e2eee89c2', mergeCommit: 'fa083beb195c769cc4168dcac38e817e3df2a873', mainPostMergeCiRun: 31874947792, mainPostMergeCiJob: 94989178288, status: 'CI_PASS' },
  note: `M3-P029统一企业订单技术切片${ciRun ? 'Draft PR精确head CI_PASS' : 'LOCAL_PASS'}；完整P0-029与真实外部环境未宣称完成；M3-P030锁定。`,
};
status.evidence = { local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P029_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED', ci: ciRun ? `CI_PASS_M3_P029_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json');
const workbookPath = path.join(pack, '17-福礼社Codex5.6执行总控工作簿.xlsx');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.workbook = { status: 'VERIFIED', sha256: createHash('sha256').update(await readFile(workbookPath)).digest('hex').toUpperCase(), currentTaskMirror: { taskId: 'M3-P029', status: 'NOT_EXECUTED_TOOL_MARKER_UNAVAILABLE', sourceLedgers: 'CSV_AND_JSON_UPDATED', reason: 'Repository task ledgers are CSV/JSON sources; workbook bytes intentionally preserved in this slice.', checkedAt: updatedAt } };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`M3_P029_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
