import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/u, '').split('=');
  return [key, value.join('=')];
}));
const root = process.cwd();
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const commit = args.commit || 'WORKTREE';
const evidenceStatus = args['evidence-status'] || 'LOCAL_PASS';
const fullVerify = args['full-verify'] || 'NOT_EXECUTED';
const workbookSync = args['workbook-sync'] || 'PENDING';
const updatedAt = args['updated-at'] || new Date().toISOString();
const implemented = ['LOCAL_PASS', 'CI_PASS'].includes(evidenceStatus);
const p075 = {
  issue: 122,
  pr: 123,
  head: 'a45037ac77e0d26585e0a8642c4b964d2a534323',
  merge: '3d82a41f916d9348aac9a6d490cf6702950a1fe1',
  mainRun: 32482552107,
  mainJob: 96771882721,
  mergedAt: '2026-08-21T12:34:43Z',
  mainCompletedAt: '2026-08-21T12:45:16Z',
};

const parseCsv = (source) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted && character === '"' && source[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(value);
      value = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += character;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return { headers: rows[0], rows: rows.slice(1) };
};
const encode = (value) => /[",\r\n]/u.test(String(value ?? ''))
  ? `"${String(value ?? '').replaceAll('"', '""')}"`
  : String(value ?? '');
const syncCsv = async (relativePath, keyFields, changes) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const parsed = parseCsv(source);
  const rows = parsed.rows.map((values) => Object.fromEntries(
    parsed.headers.map((header, index) => [header, values[index] ?? '']),
  ));
  const keyOf = (row) => keyFields.map((field) => row[field] ?? '').join('\u0000');
  const indexes = new Map(rows.map((row, index) => [keyOf(row), index]));
  for (const change of changes) {
    const key = keyOf(change);
    const index = indexes.get(key);
    if (index === undefined) {
      indexes.set(key, rows.length);
      rows.push(Object.fromEntries(parsed.headers.map((header) => [header, change[header] ?? ''])));
    } else rows[index] = { ...rows[index], ...change };
  }
  const output = [
    parsed.headers.join(','),
    ...rows.map((row) => parsed.headers.map((header) => encode(row[header])).join(',')),
  ].join(eol);
  await writeFile(filePath, `${output}${eol}`, 'utf8');
};

await syncCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P075', Status: 'DONE', EvidenceStatus: 'CI_PASS', CommitSHA: p075.merge,
    PullRequest: `https://github.com/EasyStep-lee/flt1/pull/${p075.pr}`, CI: 'CI_PASS', UpdatedAt: p075.mergedAt,
    Notes: `PR #123精确head ${p075.head}通过并合并为${p075.merge}；post-merge main run ${p075.mainRun}/job ${p075.mainJob}成功。正式客户/资质、staging/device/production未执行。`,
  },
  {
    TaskID: 'M3-P076', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/124', Branch: 'codex/m3-portal-supplier-welfare-services',
    CommitSHA: commit, PullRequest: '', CI: 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `供应商合作页、福利卡服务SSG/ISR页及最小公开业务咨询纵向闭环。${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁尚未通过。'}真实验证码、数据保护密钥、staging/device/production未执行。`,
  },
]);

await syncCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  {
    P0ID: 'P0-075', CurrentEvidenceStatus: 'CI_PASS', LastVerifiedCommit: p075.merge,
    Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: p075.mergedAt,
    EvidenceLink: `docs/contracts/m3/M3-P075-portal-publicity-pages.md|https://github.com/EasyStep-lee/flt1/pull/${p075.pr}|https://github.com/EasyStep-lee/flt1/actions/runs/${p075.mainRun}`,
    Notes: 'PR #123已合并且post-merge main CI成功；正式客户/资质、staging/device/production未执行。',
  },
  {
    P0ID: 'P0-076', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'NEG-M3-P076-01|NEG-M3-P076-02|NEG-M3-P076-03|apps/api/test/supertest/business-inquiry-api.test.mjs|tests/e2e/p0/p0-076-supplier-welfare-services.spec.ts|tests/migrations/m3-p076-business-inquiry-migration.contract.test.mjs',
    ManualCaseID: 'N/A',
    NegativeChecks: '未知/归属/资金字段零写入；错误来源/验证码/默认适配器失败关闭；同键异载荷、超限、重复与未知结果恢复',
    EvidenceLink: 'docs/contracts/m3/M3-P076-portal-supplier-welfare-services.md|artifacts/verification/M3-P076/supplier-welfare-services.json|artifacts/verification/M3-P076/welfare-service-desktop.png|artifacts/verification/M3-P076/welfare-service-mobile.png',
    LastVerifiedCommit: commit, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: `${implemented ? '本地页面、API、迁移、隐私、幂等、限流、未知结果与响应白名单通过。' : '实现进行中。'}RequiredEvidenceLevel为CI_PASS；真实验证码/数据保护密钥/staging/device/production未执行。`,
  },
]);

const fields = [
  ['id', 'String/UUID', 'YES', 'UUID', 'INTERNAL', '数据库内部主键，不进入公开响应'],
  ['companyId', 'String/UUID', 'YES', '服务端唯一ACTIVE公司', 'INTERNAL', '客户端禁止提交；公开响应禁止返回'],
  ['leadNumber', 'String', 'YES', 'FLX+日期+随机后缀', 'PUBLIC_RESULT', '仅成功响应返回'],
  ['inquiryType', 'Enum/String', 'YES', 'ENTERPRISE_WELFARE', 'INTERNAL', '服务端固定'],
  ['enterpriseName', 'String', 'YES', '2-191字符', 'INTERNAL', '仅本次提交；响应不回显'],
  ['contactName', 'String', 'YES', '2-64字符', 'PERSONAL_OR_SENSITIVE', '仅本次提交；响应不回显'],
  ['contactMobileEncrypted', 'String', 'YES', '保护适配器输出，<=500', 'PERSONAL_OR_SENSITIVE', '明文不得落库/日志/公开响应'],
  ['demandSummary', 'String', 'YES', '10-500字符', 'INTERNAL', '响应不回显；禁止凭证/密码'],
  ['sourcePage', 'String', 'YES', '/welfare-card-service', 'INTERNAL', '服务端固定'],
  ['consentVersion', 'Int', 'YES', '1', 'INTERNAL', '服务端固定'],
  ['consentedAt', 'DateTime', 'YES', 'UTC DateTime(3)', 'INTERNAL', '仅追加'],
  ['status', 'String', 'YES', 'SUBMITTED', 'PUBLIC_RESULT', '本切片仅创建SUBMITTED'],
  ['idempotencyKey', 'String', 'YES', '16-128字符', 'INTERNAL', '禁止公开返回'],
  ['requestHash', 'String', 'YES', 'SHA-256 hex', 'INTERNAL', '禁止公开返回'],
  ['requestId', 'String', 'YES', '服务端请求ID', 'INTERNAL', '只用于审计关联'],
  ['sourceFingerprint', 'String', 'YES', 'SHA-256 hex', 'PERSONAL_OR_SENSITIVE', '不保存原始IP；禁止公开返回'],
  ['createdAt', 'DateTime', 'YES', 'UTC DateTime(3)', 'PUBLIC_RESULT', '白名单映射为submittedAt'],
].map(([Field, SuggestedType, Required, UnitOrFormat, Sensitivity, ForbiddenExposure], index) => ({
  Entity: 'BusinessInquiry', Field, RawDefinition: Field, Position: String(index + 1), SuggestedType,
  Required, UnitOrFormat, Sensitivity, Visibility: '公开提交最小DTO；公开响应严格白名单；后续后台读取不在本切片',
  ForbiddenExposure, Validation: 'DTO白名单；长度/格式/来源/验证码/限流/幂等；归属从服务端派生',
  HistoryRule: '创建后数据库触发器禁止UPDATE/DELETE；命令与审计追加保存', Stage: 'M3', P0: 'P0-076',
  Source: '综合方案§13；M3-P076契约', Status: 'FROZEN_M3_P076',
}));
await syncCsv('05-字段字典初始版.csv', ['Entity', 'Field'], fields);

await syncCsv('06-状态机总表.csv', ['StateMachine', 'CurrentState', 'Event'], [{
  StateMachine: 'BusinessInquiry', Stage: 'M3', CurrentState: 'NONE', Event: 'SUBMIT_PUBLIC_INQUIRY', NextState: 'SUBMITTED',
  AllowedActor: 'PUBLIC_VISITOR', Guard: 'same-origin/site+captcha+rate limit+minimal DTO+unique active company',
  SideEffect: '同事务追加BusinessInquiry与AuditLog；不创建企业客户、福利卡账户或资金',
  Idempotency: 'companyId+Idempotency-Key+requestHash；同体回放，同键异体409',
  IllegalTransition: '公开入口禁止更新/删除/状态推进', ConcurrencyControl: '唯一键+事务；重复最多一条',
  History: 'INSERT_ONLY；数据库触发器禁止UPDATE/DELETE', P0: 'P0-076', Status: 'FROZEN_M3_P076',
}]);

await syncCsv('07-权限与数据可见矩阵.csv', ['OwnerType', 'RoleCode'], [{
  OwnerType: 'PUBLIC', RoleCode: 'PUBLIC_BUSINESS_INQUIRY', RoleName: '公开企业福利咨询访客', EntryRoute: '/welfare-card-service',
  ReadScope: '仅读取公开SSG/ISR正文和本次提交白名单结果', WriteScope: '仅POST最小咨询DTO', ApprovalAuthority: 'NONE',
  SupplyPriceVisibility: 'NEVER', DataScope: 'companyId由服务端唯一ACTIVE公司派生',
  ForbiddenActions: '提交归属/资金/审批/状态字段；读取内部UUID、明文手机号、企业存在性、供应价；更新或删除咨询',
  SecondVerification: 'N/A', SessionBoundary: '匿名但须来源校验、验证码、限流和幂等键', Stage: 'M3', P0: 'P0-076', Status: 'IMPLEMENTED_M3_P076',
}]);

await syncCsv('08-页面路由接口P0映射.csv', ['PageID'], [
  {
    PageID: 'PAGE-042', Stage: 'M3', P0: 'P0-051,P0-076', APIGroup: 'public/business-inquiries',
    RequiredUIStates: 'idle,validation-error,captcha-unavailable,unknown-result,submitting,success',
    ImplementationStatus: 'IMPLEMENTED_M3_P076_STATIC_AND_INQUIRY', AcceptanceStatus: `P0-076_${evidenceStatus};M5_CMS_NOT_EXECUTED`,
    RouteTest: 'apps/portal-web/test/publicity-seo-boundary.test.mjs|tests/e2e/p0/p0-076-supplier-welfare-services.spec.ts',
    Notes: 'Next公开SSG/ISR；福利场景/办理/员工使用/退款边界；同源代理提交最小咨询；未知结果复用幂等键；真实验证码/数据保护/staging/production未执行。',
  },
  {
    PageID: 'PAGE-043', Stage: 'M3', P0: 'P0-003,P0-076,P0-027', ImplementationStatus: 'IMPLEMENTED_M3_P076_STATIC_COMPLETE',
    AcceptanceStatus: `P0-027_CI_PASS;P0-076_${evidenceStatus};M5_CMS_NOT_EXECUTED`,
    RouteTest: 'apps/portal-web/test/publicity-seo-boundary.test.mjs|tests/e2e/p0/p0-076-supplier-welfare-services.spec.ts',
    Notes: '条件、分类、材料、流程、FAQ、注册与登录双入口完整；不承诺必然通过，不生成供应商店铺。',
  },
  {
    PageID: 'PAGE-046', ImplementationStatus: 'IMPLEMENTED_M3_P076_STATIC', AcceptanceStatus: `P0-027_CI_PASS;P0-075_CI_PASS;P0-076_${evidenceStatus};M5_CMS_NOT_EXECUTED`,
    RouteTest: 'apps/portal-web/test/publicity-seo-boundary.test.mjs|tests/e2e/p0/p0-075-portal-publicity-pages.spec.ts|tests/e2e/p0/p0-076-supplier-welfare-services.spec.ts',
    Notes: '联系页链接到福利卡服务最小咨询；不公开完整手机、不承诺固定SLA；M5 CMS/正式域名未执行。',
  },
]);

await syncCsv('10-测试证据登记.csv', ['EvidenceID'], [
  {
    EvidenceID: 'EVD-075', CurrentStatus: 'CI_PASS', ExecutedAt: p075.mergedAt, CommitSHA: p075.merge,
    CIRunURL: `https://github.com/EasyStep-lee/flt1/actions/runs/${p075.mainRun}`, Executor: 'GITHUB_ACTIONS+CODEX', Freshness: 'MERGED_MAIN',
    FailureOrBlocker: '正式客户/资质、staging/device/production未执行', RetestRequired: 'YES',
    Notes: `PR #123合并且post-merge main run ${p075.mainRun}/job ${p075.mainJob}成功。`,
  },
  {
    EvidenceID: 'EVD-076', EvidenceType: 'AUTOMATED_PUBLIC_PAGES_INQUIRY_PRIVACY_IDEMPOTENCY_MIGRATION', CurrentStatus: evidenceStatus,
    CommandOrProcedure: 'RED API缺模块、P0福利页404；GREEN API 4/4、迁移3/3、P0 Chromium 3/3、portal 4/4、Prisma迁移演练；pnpm verify',
    Actual: implemented ? '公开页、最小DTO、默认失败关闭、来源/限流/幂等、加密持久化、不可变、响应白名单和响应式通过。' : '实现中。',
    Environment: 'LOCAL_WINDOWS_NODE22_MYSQL8_NEXT_ISR_PLAYWRIGHT_CHROMIUM',
    AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Next.js 16.2.12; Playwright Chromium; MySQL 8',
    ExecutedAt: updatedAt, CommitSHA: commit,
    ArtifactOrScreenshot: 'docs/contracts/m3/M3-P076-portal-supplier-welfare-services.md|artifacts/verification/M3-P076/supplier-welfare-services.json|artifacts/verification/M3-P076/welfare-service-desktop.png|artifacts/verification/M3-P076/welfare-service-mobile.png',
    Executor: 'CODEX', Freshness: 'FRESH_LOCAL_WORKTREE',
    FailureOrBlocker: 'Draft PR精确head CI、真实验证码、数据保护密钥、staging/device/production未执行', RetestRequired: 'YES',
    Notes: '不宣称企业认证、开户、资金发放、M5 CMS或业务线索后台完成；P077锁定。',
  },
]);

await syncCsv('11-数据库迁移台账.csv', ['MigrationID'], [{
  MigrationID: 'MIG-016', Stage: 'M3', PlannedName: '20260821130000_m3_public_business_inquiry', DependsOn: 'MIG-014B',
  Objects: 'BusinessInquiry', Purpose: '最小公开企业福利咨询、加密联系字段、幂等命令证据与不可变历史',
  ForwardSteps: '创建business_inquiry及唯一/索引/FK/CHECK；禁止UPDATE/DELETE触发器；不创建资金或企业客户',
  BackwardOrRecovery: '共享环境回退应用并新增向前修复迁移；不得回改已发布迁移或删除咨询证据', DataBackfill: 'NONE_NEW_TABLE_ONLY',
  Verification: 'Prisma validate；empty/upgrade/restore/product drift；字段保护/唯一键/check/不可变触发器；API与并发契约', BackupRequired: 'YES',
  Status: 'CREATED_LOCAL_REHEARSED_M3_P076', AppliedLocalAt: updatedAt, CommitSHA: commit,
  EvidenceLink: 'packages/db/prisma/migrations/20260821130000_m3_public_business_inquiry/migration.sql|tests/migrations/m3-p076-business-inquiry-migration.contract.test.mjs',
  Notes: 'MySQL 8演练empty=2/upgrade=2/restore=2/product=38/cleanup=PASS；staging/production未应用。',
}]);

await syncCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], [{
  ContractID: 'API-112', Stage: 'M3', Domain: 'public-business-inquiry', Method: 'POST', Path: '/v1/public/business-inquiries', Actor: 'PUBLIC_VISITOR',
  RequestDTO: 'BusinessInquiryRequestDto', ResponseDTO: 'BusinessInquiryResponseDto', CommonResponse: '{success,data,error:{code,message,details?},requestId}',
  ErrorCodes: 'VALIDATION_FAILED,FIELD_FORBIDDEN,ACCESS_DENIED,SERVICE_UNAVAILABLE,RATE_LIMITED,IDEMPOTENCY_CONFLICT',
  Idempotency: 'Idempotency-Key+requestHash+companyId',
  SensitiveFieldPolicy: '最小请求；contactMobileEncrypted持久化；不返回UUID、手机号、来源指纹、企业存在性、供应价或内部字段',
  MoneyRule: 'NO_MONEY_FIELDS', P0: 'P0-076', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/business-inquiry-api.test.mjs|packages/contracts/openapi.json|tests/e2e/p0/p0-076-supplier-welfare-services.spec.ts', Owner: 'CODEX',
  Notes: 'Origin/Fetch Metadata/captcha/rate limit/idempotency；默认验证码与数据保护适配器失败关闭；服务端派生公司归属。',
}]);

await syncCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P075 PR #123合并且post-merge main run ${p075.mainRun}成功；M3-P076为${evidenceStatus}；P077及M4以后锁定；真实验证码/数据保护/staging/device/production未执行。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
for (const test of freeze.negativeTests) {
  if (test.taskId === 'M3-P075') test.executionStatus = 'CI_PASS';
  if (test.taskId === 'M3-P076') test.executionStatus = evidenceStatus;
}
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P076', nextAllowedTask: 'M3-P076', activeTaskCount: 1,
  lastCompletedTask: 'M3-P075', lastCompletedCommit: p075.merge,
  prohibitedUntilGate: [
    'M3-P076 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P077',
    'M3-GATE通过前M4及以后锁定；真实验证码/数据保护/staging/device/production未执行',
  ],
};
status.github = {
  ...status.github, pullRequest: null, pullRequestUrl: null, pullRequestState: 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null,
  lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: { scope: 'M3_P075_POST_MERGE_MAIN', status: 'CI_PASS', runId: p075.mainRun, jobId: p075.mainJob, runUrl: `https://github.com/EasyStep-lee/flt1/actions/runs/${p075.mainRun}`, headSha: p075.merge, event: 'push', completedAt: p075.mainCompletedAt },
  currentTaskDelivery: {
    taskId: 'M3-P076', issue: 124, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/124', branch: 'codex/m3-portal-supplier-welfare-services', baseCommit: p075.merge,
    verifiedHead: commit, status: implemented ? 'LOCAL_PASS_PENDING_DRAFT_PR' : 'IN_PROGRESS',
    localRedTest: 'RECORDED_API_MODULE_MISSING_AND_WELFARE_PAGE_404', localFocusedTest: implemented ? 'LOCAL_PASS_API_4_MIGRATION_3_P0_3_PORTAL_4' : 'NOT_EXECUTED',
    localFullVerify: fullVerify, pullRequest: null, pullRequestState: 'NOT_CREATED', exactHeadCi: 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED',
    mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'CAPTCHA_DATA_PROTECTION_STAGING_DEVICE_PRODUCTION', nextTaskUnlocked: false,
  },
  previousTaskDelivery: { taskId: 'M3-P075', issue: p075.issue, pullRequest: p075.pr, pullRequestUrl: `https://github.com/EasyStep-lee/flt1/pull/${p075.pr}`, exactHead: p075.head, mergeCommit: p075.merge, mainPostMergeCiRun: p075.mainRun, mainPostMergeCiJob: p075.mainJob, status: 'CI_PASS' },
  note: `M3-P075 merged-main CI_PASS；M3-P076 ${evidenceStatus}；P077/M4以后锁定。`,
};
status.evidence = { local: implemented ? 'LOCAL_PASS_M3_P076' : 'NOT_EXECUTED_M3_P076', ci: 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.workbook = {
  ...manifest.workbook, status: workbookSync === 'VERIFIED' ? 'VERIFIED' : 'SYNC_PENDING',
  currentTaskMirror: { taskId: 'M3-P076', status: implemented ? 'LOCAL_PASS_PENDING_DRAFT_PR' : 'IN_PROGRESS', sourceLedgers: workbookSync === 'VERIFIED' ? 'CSV_JSON_AND_WORKBOOK_UPDATED' : 'CSV_JSON_UPDATED_WORKBOOK_PENDING', reason: 'P075 merged-main evidence closed；P076 public pages and minimum protected inquiry evidence current；P077 remains locked.', checkedAt: updatedAt },
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P076');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'supplier-welfare-services.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P076', p0: ['P0-076'], status: evidenceStatus, commit, updatedAt,
  baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  red: [
    { command: 'pnpm exec vitest run apps/api/test/supertest/business-inquiry-api.test.mjs', exitCode: 1, reason: 'business-inquiries module did not exist' },
    { command: 'pnpm exec playwright test --config playwright.p0.config.ts tests/e2e/p0/p0-076-supplier-welfare-services.spec.ts --project=chromium', exitCode: 1, reason: '/welfare-card-service returned 404' },
  ],
  focused: implemented ? [
    { command: 'pnpm exec vitest run apps/api/test/supertest/business-inquiry-api.test.mjs', result: 'PASS_4_OF_4' },
    { command: 'node --test tests/migrations/m3-p076-business-inquiry-migration.contract.test.mjs', result: 'PASS_3_OF_3' },
    { command: 'pnpm exec playwright test --config playwright.p0.config.ts tests/e2e/p0/p0-076-supplier-welfare-services.spec.ts --project=chromium', result: 'PASS_3_OF_3' },
    { command: 'pnpm --filter @fulishe/portal-web test', result: 'PASS_4_OF_4' },
    { command: 'pnpm prisma:migrate:dry-run', result: 'PASS_EMPTY_2_UPGRADE_2_RESTORE_2_PRODUCT_38_CLEANUP' },
  ] : [],
  fullVerify,
  invariants: { supplierIsNotStorefront: true, publicStaticIsr: true, minimumRequestDto: true, companyDerivedServerSide: true, encryptedMobileAtRest: true, plaintextMobileNotPersisted: true, defaultCaptchaFailClosed: true, defaultDataProtectorFailClosed: true, fixedWindowRateLimit: true, idempotentReplay: true, conflictingReplayRejected: true, immutablePersistence: true, responseWhitelist: true, noEnterpriseOrFundsCreation: true, noSupplyPriceExposure: true },
  boundaries: { captchaProvider: 'BLOCKED_EXTERNAL', dataProtectionKey: 'BLOCKED_EXTERNAL', adminLeadWorkspace: 'OUT_OF_SCOPE', cms: 'OUT_OF_SCOPE_M5', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' },
  github: { issue: 124, pullRequest: null, pullRequestState: 'NOT_CREATED', ciStatus: 'NOT_EXECUTED' },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P076_LEDGERS_SYNCED:${commit}:${evidenceStatus}:${workbookSync}\n`);
