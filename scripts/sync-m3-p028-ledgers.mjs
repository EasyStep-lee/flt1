import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = process.env.M3_P028_UPDATED_AT ?? new Date().toISOString();
const commit = process.env.M3_P028_COMMIT ?? 'LOCAL_WORKTREE';
const pullRequest = process.env.M3_P028_PR ?? '';
const ciRun = process.env.M3_P028_CI_RUN ?? '';
const ciJob = process.env.M3_P028_CI_JOB ?? '';
const fullVerify = process.env.M3_P028_FULL_VERIFY ?? 'NOT_EXECUTED';
const ciStatus = ciRun ? 'CI_PASS' : 'LOCAL_PASS';
const pullRequestUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const ciUrl = ciRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${ciRun}` : '';

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

const updateCsv = async (relativePath, update) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const headers = parseLine(lines[0]);
  const output = [lines[0]];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const values = parseLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const result = update({ ...row });
    output.push(result === null ? line : headers.map((header) => encode(result[header])).join(','));
  }
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M3-P027') return {
    ...row,
    Status: 'DONE', EvidenceStatus: 'CI_PASS', CommitSHA: 'e17e25f58c8bda46e80dfc6175a2f60b4a3a9fbb',
    CI: 'CI_PASS', UpdatedAt: '2026-08-15T05:39:22Z',
    Notes: 'PR #90精确head e17e25f经授权合并；main merge 0691ae492771df9fa39422460501a41ad174c605，post-merge Actions run 31867042679/job 94969678834成功。M3-P028已解锁。',
  };
  if (row.TaskID === 'M3-P028') return {
    ...row,
    Status: 'IN_PROGRESS', EvidenceStatus: ciStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/91', Branch: 'codex/m3-enterprise-registration',
    CommitSHA: commit, PullRequest: pullRequestUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED：POST /v1/enterprise/registrations预期安全默认503、实际404。GREEN：企业草稿、主体/证照/联系人/开票/收货资料、签名注册凭据、补正/复审/激活/暂停、自然人自审隔离、幂等/并发版本、公司供应商运营审核区及PAGE-031首次提交通过。${ciRun ? `Draft PR精确head ${commit.slice(0, 7)} Actions run ${ciRun}/job ${ciJob}成功。` : '等待Draft PR与CI。'} P0-077完整预览/持久化进度/字段级补正体验与EXT-013法务财务验收未宣称完成。`,
  };
  if (row.TaskID === 'M3-P029') return {
    ...row, Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P028 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.P0ID === 'P0-028') return {
    ...row,
    CurrentEvidenceStatus: ciStatus,
    AutomatedTestID: 'apps/api/test/unit/enterprise-onboarding-policy.test.mjs|apps/api/test/supertest/enterprise-registration-api.test.mjs|tests/migrations/m3-p028-enterprise-registration-migration.contract.test.mjs|tests/e2e/p0/p0-028-enterprise-registration.spec.ts|apps/company-admin/test/shell-build.test.mjs',
    ManualCaseID: 'EXT-013_BLOCKED_EXTERNAL',
    NegativeChecks: '默认短信验证器失败关闭且零写入；所有者字段拒绝；签名凭据隔离；信用代码重复；幂等异体冲突；同一自然人自审禁止；并发审核仅一个成功；敏感字段脱敏',
    EvidenceLink: `docs/contracts/m3/M3-P028-enterprise-registration.md|artifacts/verification/M3-P028/enterprise-registration.json${pullRequestUrl ? `|${pullRequestUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
    LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
    Notes: 'P0-028自动化技术行为通过；真实短信/对象存储、企业合同/协议、对公转账、开票法务财务口径由EXT-013保留BLOCKED_EXTERNAL，不升级为正式合规验收。',
  };
  if (row.P0ID === 'P0-077') return {
    ...row,
    CurrentEvidenceStatus: 'NOT_EXECUTED',
    AutomatedTestID: `${row.AutomatedTestID}|PARTIAL:tests/e2e/p0/p0-028-enterprise-registration.spec.ts|apps/portal-web/test/seo-cache-boundary.test.mjs`,
    EvidenceLink: `${row.EvidenceLink}|PARTIAL:docs/contracts/m3/M3-P028-enterprise-registration.md`,
    Notes: 'M3-P028仅提供PAGE-031首次注册提交、响应式、重复/外部服务失败及noindex/no-store证据；完整预览、持久化进度、字段级补正与暂停影响体验留在主任务M3-P077，故保持NOT_EXECUTED。',
  };
  return null;
});

await updateCsv('05-字段字典初始版.csv', (row) =>
  ['EnterpriseCustomer', 'EnterpriseUser', 'EnterpriseAddress', 'EnterpriseInvoiceProfile', 'EnterpriseProcurementProfile'].includes(row.Entity)
    ? { ...row, Status: 'IMPLEMENTED_M3_P028' }
    : null,
);

await updateCsv('06-状态机总表.csv', (row) =>
  row.StateMachine === 'EnterpriseCustomer'
    ? { ...row, Status: 'IMPLEMENTED_M3_P028' }
    : null,
);

await updateCsv('07-权限与数据可见矩阵.csv', (row) => {
  if (row.RoleCode === 'COMPANY_SUPPLIER_OPS') return {
    ...row,
    ReadScope: '供应商主体、资质、状态；企业客户认证主体、证照引用、脱敏联系人/开票/收货摘要',
    WriteScope: '供应商及企业认证审核、补正、启停、退出流程',
    ApprovalAuthority: '供应商主体审核；企业采购主体认证审核',
    P0: [...new Set(`${row.P0},P0-028,P0-077`.split(',').filter(Boolean))].join(','),
  };
  return null;
});

await updateCsv('08-页面路由接口P0映射.csv', (row) => row.PageID === 'PAGE-031' ? {
  ...row,
  ImplementationStatus: 'IMPLEMENTED_M3_P028_INITIAL_REGISTRATION',
  AcceptanceStatus: `P0-028_${ciStatus};P0-077_PARTIAL_LOCAL_PASS`,
  RouteTest: 'apps/portal-web/test/seo-cache-boundary.test.mjs|tests/e2e/p0/p0-028-enterprise-registration.spec.ts',
  Notes: 'Next.js动态私有页完成主体、证照引用、联系人、开票、收货和首次提交；使用生成契约/openapi-fetch；noindex、private/no-store、PC+mobile响应式。完整预览、持久化进度、字段级补正与暂停说明由M3-P077继续，当前不得宣称P0-077完成。',
} : null);

await updateCsv('10-测试证据登记.csv', (row) => row.EvidenceID === 'EVD-028' ? {
  ...row,
  CurrentStatus: ciStatus,
  CommandOrProcedure: 'RED enterprise registration Supertest；GREEN API unit+Supertest 9 tests、MIG-011 contract、portal/company build tests、P0-028 Playwright、prisma validate/migrate dry-run、OpenAPI generate/check、pnpm verify',
  Actual: '企业认证完整状态链、字段白名单、签名凭据所有权、信用代码唯一、幂等、同自然人自审隔离、并发版本、不可变历史、公司独立职能审核区和门户首次提交通过。',
  Environment: 'LOCAL_WINDOWS_NODE22_MYSQL8_DOCKER_NEXTJS16_PLAYWRIGHT_CHROMIUM',
  AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Prisma 6.19.2; Next.js 16.2.12; Playwright Chromium',
  ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P028-enterprise-registration.md|artifacts/verification/M3-P028/enterprise-registration.json|artifacts/test-results/verification/pnpm-verify.json',
  Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_WORKTREE',
  FailureOrBlocker: 'EXT-013真实企业合同/协议、对公转账、开票法务财务；短信与对象存储账号；staging/production未执行；P0-077完整页面体验后续执行',
  RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES',
  Notes: 'Mock验证器与对象引用只证明技术行为，不升级为真实短信、证照存储或正式合规验收。',
} : null);

await updateCsv('11-数据库迁移台账.csv', (row) => row.MigrationID === 'MIG-011' ? {
  ...row,
  PlannedName: '20260815020000_m3_enterprise_identity_profile',
  ForwardSteps: '创建EnterpriseCustomer/User/Address/Invoice/StatusHistory/CertificationSnapshot/ProcurementProfile/OnboardingCommand；扩展企业认证审批枚举；添加唯一键、外键、版本检查及不可变触发器',
  DataBackfill: 'NONE_NEW_TABLES_ONLY',
  Verification: 'Prisma validate；空库/升级/恢复/产品schema drift dry-run；SQL contract；信用代码唯一、companyId范围、版本和不可变触发器',
  Status: 'CREATED_LOCAL_REHEARSED', AppliedLocalAt: updatedAt, CommitSHA: commit,
  EvidenceLink: 'packages/db/prisma/migrations/20260815020000_m3_enterprise_identity_profile/migration.sql|tests/migrations/m3-p028-enterprise-registration-migration.contract.test.mjs|artifacts/verification/M3-P028/enterprise-registration.json',
  Notes: 'prisma:migrate:dry-run PASS empty=2 upgrade=2 restore=2 product=29 cleanup=PASS；staging/production未应用；已发布后仅允许向前修复。',
} : null);

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (!['API-044', 'API-046'].includes(row.ContractID)) return null;
  return {
    ...row,
    RequestDTO: row.ContractID === 'API-044' ? 'EnterpriseRegistrationRequestDto' : 'EnterpriseReviewRequestDto',
    ResponseDTO: row.ContractID === 'API-044' ? 'EnterpriseRegistrationCreatedResponseDto' : 'EnterpriseRegistrationResponseDto',
    ErrorCodes: row.ContractID === 'API-044'
      ? 'VALIDATION_FAILED|FIELD_FORBIDDEN|IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_CONFLICT|CREDIT_CODE_DUPLICATE|SERVICE_UNAVAILABLE'
      : 'AUTHENTICATION_REQUIRED|ACCESS_DENIED|ENTERPRISE_NOT_FOUND|STATE_TRANSITION_INVALID|APPROVAL_VERSION_CONFLICT|SELF_APPROVAL_FORBIDDEN|IDEMPOTENCY_CONFLICT',
    SensitiveFieldPolicy: 'DTO_WHITE_LIST; mobile/creditCode/taxNumber/bankAccount masked; no companyId/identityId/verificationCode/supplyPrice/internal snapshot',
    MoneyRule: 'N/A_NO_MONEY_MUTATION',
    OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
    ContractTest: 'apps/api/test/supertest/enterprise-registration-api.test.mjs|packages/contracts/openapi.json|tests/openapi/openapi-generation.test.mjs',
    Notes: 'M3-P028运行时已实现；默认外部验证器失败关闭，所有权由签名注册凭据或固定公司职能会话派生；P0-077完整页面体验仍后续执行。',
  };
});

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row,
  Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS',
  Notes: `M3-P027由PR #90合并且main run 31867042679成功。M3-P028企业注册认证自动化技术行为${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；EXT-013、真实短信/对象存储、P0-077完整页面、staging/production未执行。M3-P029及后续锁定。`,
} : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P028', nextAllowedTask: 'M3-P028', activeTaskCount: 1,
  lastCompletedTask: 'M3-P027', lastCompletedCommit: '0691ae492771df9fa39422460501a41ad174c605', lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: [
    'M3-P028 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P029',
    'P0-077完整页面体验、M4及后续保持锁定',
  ],
};
status.github = {
  ...status.github,
  pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: pullRequestUrl || null,
  pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false,
  mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun
    ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt }
    : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: ciRun
    ? { scope: 'M3_P028_PR_HEAD', status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, event: 'pull_request', completedAt: updatedAt }
    : status.github.latestCi,
  currentTaskDelivery: {
    taskId: 'M3-P028', issue: 91, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/91', branch: 'codex/m3-enterprise-registration',
    baseCommit: '0691ae492771df9fa39422460501a41ad174c605', verifiedHead: commit,
    status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR',
    localRedTest: 'ENTERPRISE_REGISTRATION_EXPECTED_SAFE_DEFAULT_503_ACTUAL_404',
    localFocusedTest: 'LOCAL_PASS_API_9_MIGRATION_PORTAL_COMPANY_AND_P0_E2E', localFullVerify: fullVerify,
    pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED',
    exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED',
    blockingExternalItem: 'EXT_013_LEGAL_FINANCE_SMS_OBJECT_STORAGE_STAGING_PRODUCTION', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P027', pullRequest: 90, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/90',
    exactHead: 'e17e25f58c8bda46e80dfc6175a2f60b4a3a9fbb', mergeCommit: '0691ae492771df9fa39422460501a41ad174c605',
    mainPostMergeCiRun: 31867042679, mainPostMergeCiJob: 94969678834, status: 'CI_PASS',
  },
  note: `M3-P028企业注册认证自动化技术行为${ciRun ? 'Draft PR精确head CI_PASS' : 'LOCAL_PASS'}；EXT-013、真实短信/对象存储、P0-077完整页面、staging/production未执行；M3-P029锁定。`,
};
status.evidence = {
  local: fullVerify === 'PASS_17_OF_17'
    ? 'LOCAL_PASS_M3_P028_FULL_VERIFY'
    : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED',
  ci: ciRun ? `CI_PASS_M3_P028_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED',
  staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
};
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json');
const workbookPath = path.join(pack, '17-福礼社Codex5.6执行总控工作簿.xlsx');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.workbook = {
  status: 'VERIFIED',
  sha256: createHash('sha256').update(await readFile(workbookPath)).digest('hex').toUpperCase(),
  currentTaskMirror: {
    taskId: 'M3-P028', status: 'NOT_EXECUTED_TOOL_MARKER_UNAVAILABLE', sourceLedgers: 'CSV_AND_JSON_UPDATED',
    reason: 'Spreadsheet skill mandatory artifact-operation marker is unavailable in the installed runtime; workbook bytes were not changed.',
    checkedAt: updatedAt,
  },
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P028_LEDGERS_SYNCED:${commit}:${ciStatus}\n`);
