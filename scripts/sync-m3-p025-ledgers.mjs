import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = '2026-08-14T10:09:04Z';
const p024AuthorizedHead = '04ba1bf61ed2e4537ae449e6373f6482b55e28e5';
const p024Merge = '1b15d5c4a019fe2868726284761c315454af2d5f';
const implementationCommit = 'e0423d5062f871d31314f8bdcf0c4283f341a226';
const verifiedHead = 'e1407aad12d2739722ba52fe4f9e195f5b78cc88';

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

const updateCsv = async (relativePath, update, append = [], keyFields = []) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const headers = parseLine(lines[0]);
  const output = [lines[0]];
  const keys = new Set();
  const rowKey = (row) => keyFields.length > 0
    ? keyFields.map((field) => row[field] ?? '').join('\u0000')
    : String(row[headers[0]] ?? '');
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const values = parseLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const result = update({ ...row });
    const finalRow = result === null ? row : result;
    keys.add(rowKey(finalRow));
    output.push(result === null ? line : headers.map((header) => encode(result[header])).join(','));
  }
  for (const row of append) {
    if (!keys.has(rowKey(row))) {
      output.push(headers.map((header) => encode(row[header])).join(','));
      keys.add(rowKey(row));
    }
  }
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await updateCsv('03-任务台账.csv', (row) => {
  if (row.TaskID === 'M3-P024') return {
    ...row,
    Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/83',
    Branch: 'codex/m3-payment-idempotency', CommitSHA: p024AuthorizedHead,
    PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/84', CI: 'CI_PASS',
    UpdatedAt: '2026-08-14T09:05:06Z',
    Notes: 'PR #84精确head 04ba1bf经授权转Ready并合并；merge 1b15d5c；post-merge main Actions run 31786009896/job 94721950214成功。纯微信幂等子切片在main完成；P0-024整体仍等待福利卡维度与真实微信/staging。',
  };
  if (row.TaskID === 'M3-P025') return {
    ...row,
    Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/85',
    Branch: 'codex/m3-company-unified-checkout', CommitSHA: verifiedHead,
    PullRequest: '', CI: 'LOCAL_PASS', UpdatedAt: updatedAt,
    Notes: 'RED：API-050/API-051端点404，3/3失败。GREEN：Prisma仓储3/3、Supertest 7/7、迁移契约1/1、P0 E2E2/2；pnpm verify 17/17通过。公司微信配置仅服务端派生；企业转账仅企业提交、公司财务确认；不创建配送。福利卡与真实资金/staging未执行，等待Draft PR精确head CI。',
  };
  if (row.TaskID === 'M3-P026') return {
    ...row,
    Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P025 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  };
  return null;
});

await updateCsv('04-P0-1至P0-119验收矩阵.csv', (row) => {
  if (row.P0ID === 'P0-024') return {
    ...row,
    CurrentEvidenceStatus: 'NOT_EXECUTED', LastVerifiedCommit: p024Merge,
    Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-14T09:05:06Z',
    EvidenceLink: 'docs/contracts/m3/M3-P024-payment-idempotency.md|https://github.com/EasyStep-lee/flt1/actions/runs/31786009896',
    Notes: '纯微信幂等子行为已在main取得CI_PASS；福利卡扣减维度与真实微信/staging尚未执行，P0整项保持NOT_EXECUTED。',
  };
  if (row.P0ID === 'P0-025') return {
    ...row,
    CurrentEvidenceStatus: 'NOT_EXECUTED',
    AutomatedTestID: 'NEG-M3-P025-01|NEG-M3-P025-02|NEG-M3-P025-03|apps/api/test/unit/prisma-enterprise-remittance-repository.test.mjs|apps/api/test/supertest/company-unified-checkout-api.test.mjs|apps/api/test/supertest/payment-idempotency-api.test.mjs|tests/e2e/p0/p0-025-company-unified-checkout.spec.ts',
    EvidenceLink: 'docs/contracts/m3/M3-P025-company-unified-checkout.md|packages/db/prisma/migrations/20260814092000_m3_company_unified_checkout/migration.sql|packages/contracts/openapi.json',
    LastVerifiedCommit: verifiedHead, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: '本地自动化子行为LOCAL_PASS：个人/企业微信只使用公司商户配置；企业转账仅由企业提交、公司财务确认；供应商不收款；ALIPAY/客户端归属被拒绝；确认幂等且不创建配送。福利卡由公司统一发行记账尚未实现，Draft PR/CI/staging/真实资金未执行，P0整项保持NOT_EXECUTED。',
  };
  return null;
});

await updateCsv('10-测试证据登记.csv', (row) => {
  if (row.EvidenceID === 'EVD-024') return {
    ...row,
    CurrentStatus: 'CI_PASS', ExecutedAt: '2026-08-14T09:05:06Z', CommitSHA: p024Merge,
    CIRunURL: 'https://github.com/EasyStep-lee/flt1/actions/runs/31786009896', Freshness: 'FRESH_MAIN_POST_MERGE',
    FailureOrBlocker: '福利卡维度、真实微信、staging、真机、production未执行',
    Notes: 'PR #84已合并；main@1b15d5c post-merge CI成功；P0-024整体仍NOT_EXECUTED。',
  };
  if (row.EvidenceID === 'EVD-025') return {
    ...row,
    CurrentStatus: 'LOCAL_PASS',
    CommandOrProcedure: 'RED Supertest 3/3预期201/422实际404；GREEN Prisma仓储3/3、Supertest 7/7、迁移契约1/1、P0 E2E2/2；prisma validate/migrate dry-run；OpenAPI generate/check/oasdiff；pnpm verify 17/17',
    Actual: '公司微信预支付从Company.wechatPayConfigRef派生且不向客户端暴露；企业转账只由本企业提交，公司财务精确金额/版本确认；重复/并发只确认一次订单、库存、履约和outbox；供应商不收款，不创建配送，ALIPAY被拒绝。',
    Environment: 'LOCAL_WINDOWS_NODE22_DOCKER_MYSQL84+DETERMINISTIC_WECHAT_AND_REMITTANCE_ADAPTERS',
    ExecutedAt: updatedAt, CommitSHA: verifiedHead, CIRunURL: '',
    ArtifactOrScreenshot: 'docs/contracts/m3/M3-P025-company-unified-checkout.md|artifacts/test-results/verification/pnpm-verify.json',
    Executor: 'CODEX', Freshness: 'FRESH_LOCAL_HEAD',
    FailureOrBlocker: 'Draft PR/CI、人工合并、post-merge main CI未执行；福利卡发行记账、真实微信/银行、staging/真机/production未执行',
    RetestRequired: 'YES',
    Notes: '本地子行为LOCAL_PASS；Mock不能升级为真实资金或CI_PASS；P0-025整体保持NOT_EXECUTED；M3-P026锁定。',
  };
  return null;
});

const migrationRow = {
  MigrationID: 'MIG-012B', Stage: 'M3', PlannedName: '20260814092000_m3_company_unified_checkout', DependsOn: 'MIG-012A',
  Objects: 'EnterpriseRemittanceSubmission/EnterpriseRemittanceReview/BuyerOrderEventActorType',
  Purpose: '企业对公转账凭证版本化；公司财务追加审核；确认公司应收并原子推进订单、库存、履约与outbox',
  ForwardSteps: '新增提交/审核表、金额和版本约束、审核不可变触发器；扩展订单事件与公司操作者；不创建配送、供应商钱包或其他支付通道',
  BackwardOrRecovery: '未发布时回退提交并重建开发库；已发布后不回改迁移，应用版本回退并使用向前修复迁移',
  DataBackfill: '无存量回填；只处理新企业转账凭证',
  Verification: 'prisma validate；空库/升级/恢复dry-run；schema drift；唯一键/check/不可变触发器；focused并发与幂等测试',
  BackupRequired: 'YES', Status: 'LOCAL_PASS', AppliedLocalAt: updatedAt, AppliedStagingAt: '', AppliedProductionAt: '', CommitSHA: verifiedHead,
  EvidenceLink: 'packages/db/prisma/migrations/20260814092000_m3_company_unified_checkout/migration.sql|tests/migrations/m3-p025-company-unified-checkout-migration.contract.test.mjs',
  Notes: 'MySQL演练empty=2/upgrade=2/restore=2/product=27/cleanup=PASS；staging/production未应用。',
};
await updateCsv(
  '11-数据库迁移台账.csv',
  (row) => row.MigrationID === migrationRow.MigrationID ? { ...row, ...migrationRow } : null,
  [migrationRow],
);

await updateCsv('12-OpenAPI-DTO-错误码台账.csv', (row) => {
  if (row.ContractID === 'API-041') return {
    ...row,
    OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
    ContractTest: 'apps/api/test/supertest/payment-idempotency-api.test.mjs|tests/e2e/p0/p0-024-payment-idempotency.spec.ts|packages/contracts/openapi.json',
    Notes: '订单归属与金额由服务端派生；只允许公司WECHAT_PAY；内部merchantConfigRef从Company读取并只传给适配器，响应仅公开公司收款主体与COMPANY_UNIFIED。',
  };
  if (row.ContractID === 'API-050') return {
    ...row,
    RequestDTO: 'EnterpriseRemittanceProofRequestDto', ResponseDTO: 'EnterpriseRemittanceResponseDto',
    CommonResponse: '显式白名单DTO；错误={statusCode,code,message,requestId}',
    ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCESS_DENIED|ORDER_NOT_FOUND|FIELD_FORBIDDEN|VALIDATION_FAILED|IDEMPOTENCY_KEY_REQUIRED|AMOUNT_MISMATCH|PAYMENT_METHOD_INVALID|REMITTANCE_ALREADY_SUBMITTED|PAYMENT_STATE_INVALID|IDEMPOTENCY_CONFLICT|APPROVAL_VERSION_CONFLICT',
    OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
    ContractTest: 'apps/api/test/supertest/company-unified-checkout-api.test.mjs|tests/e2e/p0/p0-025-company-unified-checkout.spec.ts|packages/contracts/openapi.json',
    Notes: '仅本企业采购员提交受控凭证对象键和整数分金额；企业/company归属从会话派生；拒绝ALIPAY及未知/归属字段；响应private/no-store、noindex。',
  };
  if (row.ContractID === 'API-051') return {
    ...row,
    RequestDTO: 'EnterpriseRemittanceReviewRequestDto', ResponseDTO: 'EnterpriseRemittanceResponseDto',
    CommonResponse: '显式白名单DTO；错误={statusCode,code,message,requestId}',
    ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCESS_DENIED|ORDER_NOT_FOUND|FIELD_FORBIDDEN|VALIDATION_FAILED|IDEMPOTENCY_KEY_REQUIRED|AMOUNT_MISMATCH|PAYMENT_STATE_INVALID|IDEMPOTENCY_CONFLICT|APPROVAL_VERSION_CONFLICT',
    OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
    ContractTest: 'apps/api/test/unit/prisma-enterprise-remittance-repository.test.mjs|apps/api/test/supertest/company-unified-checkout-api.test.mjs|tests/e2e/p0/p0-025-company-unified-checkout.spec.ts|packages/contracts/openapi.json',
    Notes: '仅/company-admin/workspaces/finance公司财务职能；精确金额/版本审核，审核记录不可变；确认原子推进订单、库存、履约和outbox，不创建配送。',
  };
  return null;
});

const fieldRows = [
  ['id','String(36)','UUID v4','INTERNAL'], ['buyerOrderId','String(36)','UUID v4','INTERNAL'],
  ['submissionVersion','Int','integer; >0','INTERNAL'], ['amount','Int','integer cents; >0','FINANCIAL'],
  ['proofObjectKey','String(512)','controlled object key','SENSITIVE'], ['submittedByEnterpriseUserId','String(36)','session-derived UUID','SENSITIVE'],
  ['idempotencyKey','String(128)','8..128 safe chars','INTERNAL'], ['requestHash','String(64)','SHA-256 hex','INTERNAL'],
  ['status','Enum<EnterpriseRemittanceStatus>','PENDING_REVIEW|CONFIRMED|REJECTED','FINANCIAL'], ['version','Int','integer; >=0','INTERNAL'],
  ['submittedAt','DateTime(3)','UTC','INTERNAL'], ['reviewedAt','DateTime(3)?','UTC nullable','INTERNAL'],
].map(([field, type, format, sensitivity], index) => ({
  Entity: 'EnterpriseRemittanceSubmission', Field: field, RawDefinition: field, Position: String(index + 1), SuggestedType: type,
  Required: field === 'reviewedAt' ? 'NO' : 'YES', UnitOrFormat: format, Sensitivity: sensitivity,
  Visibility: '本企业采购员与公司财务按会话数据域访问', ForbiddenExposure: '供应商/其他企业/公开DTO不可见；proofObjectKey不进入响应',
  Validation: 'DTO whitelist; ownership from verified session; integer cents; optimistic version and idempotency',
  HistoryRule: '按submissionVersion追加；已审核版本不可覆盖', Stage: 'M3', P0: 'P0-025,P0-029',
  Source: '综合方案§8.9,§9.1-§9.10', Status: 'IMPLEMENTED_M3_P025',
}));
const reviewFieldRows = [
  ['id','String(36)','UUID v4','INTERNAL'], ['submissionId','String(36)','UUID v4','INTERNAL'],
  ['decision','Enum<EnterpriseRemittanceDecision>','CONFIRM|REJECT','FINANCIAL'], ['reviewedAmount','Int','integer cents; >0','FINANCIAL'],
  ['reason','String(500)','2..500 chars','SENSITIVE'], ['reviewerFunctionalAccountId','String(36)','session-derived UUID','SENSITIVE'],
  ['reviewerIdentityId','String(36)','session-derived natural person','SENSITIVE'], ['idempotencyKey','String(128)','8..128 safe chars','INTERNAL'],
  ['requestHash','String(64)','SHA-256 hex','INTERNAL'], ['submissionVersion','Int','integer; >=0','INTERNAL'],
  ['createdAt','DateTime(3)','UTC','INTERNAL'],
].map(([field, type, format, sensitivity], index) => ({
  Entity: 'EnterpriseRemittanceReview', Field: field, RawDefinition: field, Position: String(index + 1), SuggestedType: type,
  Required: 'YES', UnitOrFormat: format, Sensitivity: sensitivity,
  Visibility: '公司财务与审计职能', ForbiddenExposure: '企业/供应商/公开DTO不返回审核人和内部原因',
  Validation: 'company finance workspace; exact amount/version; idempotency; immutable after insert',
  HistoryRule: '只追加；数据库触发器禁止UPDATE/DELETE', Stage: 'M3', P0: 'P0-025,P0-045,P0-072',
  Source: '综合方案§8.9,§9.1-§9.10', Status: 'IMPLEMENTED_M3_P025',
}));
await updateCsv('05-字段字典初始版.csv', () => null, [...fieldRows, ...reviewFieldRows], ['Entity', 'Field']);

const stateRows = [
  {
    StateMachine: 'EnterpriseRemittance', Stage: 'M3', CurrentState: 'NONE', Event: 'SUBMIT', NextState: 'PENDING_REVIEW', AllowedActor: 'ENTERPRISE_PURCHASER',
    Guard: '本企业订单；PENDING_PAYMENT；整数分金额=公司应收；无微信支付交易；旧版本仅可为REJECTED', SideEffect: '追加提交版本；订单externalPaymentMethod=BANK_TRANSFER；追加订单事件',
    Idempotency: 'buyerOrderId+Idempotency-Key+requestHash', IllegalTransition: '409稳定错误；事务回滚且不部分写入', ConcurrencyControl: 'Serializable+order version+unique keys',
    History: '提交版本追加，禁止覆盖', P0: 'P0-025,P0-029', Status: 'IMPLEMENTED_M3_P025',
  },
  {
    StateMachine: 'EnterpriseRemittance', Stage: 'M3', CurrentState: 'PENDING_REVIEW', Event: 'CONFIRM', NextState: 'CONFIRMED', AllowedActor: 'COMPANY_FINANCE',
    Guard: '公司财务workspace；company scope；精确金额/版本；订单待支付；库存预扣完整；无在线支付交易', SideEffect: '追加审核；订单PAID；库存reserved转sold；履约激活；事件与BUYER_ORDER_PAID_V1 outbox',
    Idempotency: 'submissionId+Idempotency-Key+requestHash', IllegalTransition: '409稳定错误；资金/库存/履约/outbox全部回滚', ConcurrencyControl: 'Serializable+submission/order/inventory version+unique keys',
    History: '审核只追加且不可变', P0: 'P0-025,P0-029', Status: 'IMPLEMENTED_M3_P025',
  },
  {
    StateMachine: 'EnterpriseRemittance', Stage: 'M3', CurrentState: 'PENDING_REVIEW', Event: 'REJECT', NextState: 'REJECTED', AllowedActor: 'COMPANY_FINANCE',
    Guard: '公司财务workspace；company scope；精确金额/版本；理由必填', SideEffect: '追加审核与订单事件；订单保持待支付，允许后续新提交版本',
    Idempotency: 'submissionId+Idempotency-Key+requestHash', IllegalTransition: '409稳定错误；不修改订单资金或库存', ConcurrencyControl: 'Serializable+submission/order version+unique keys',
    History: '审核只追加且不可变', P0: 'P0-025,P0-029', Status: 'IMPLEMENTED_M3_P025',
  },
];
await updateCsv('06-状态机总表.csv', () => null, stateRows, ['StateMachine', 'CurrentState', 'Event']);

await updateCsv('07-权限与数据可见矩阵.csv', (row) => {
  if (row.RoleCode === 'COMPANY_FINANCE') return {
    ...row,
    ReadScope: '支付退款、企业转账凭证、供应价快照、账单、凭证',
    WriteScope: '企业转账确认/驳回、对账调整、线下付款登记、冲正',
    ApprovalAuthority: '企业转账确认；结算与财务复核',
    DataScope: '唯一公司全财务数据；企业转账按companyId',
    ForbiddenActions: '不得覆盖已确认凭证/账单、自动向供应商打款或确认其他公司订单',
    Stage: 'M3,M5', P0: 'P0-025,P0-029,P0-040,P0-042,P0-043,P0-060,P0-065,P0-067,P0-068', Status: 'IMPLEMENTED_M3_P025_PARTIAL',
  };
  if (row.RoleCode === 'ENTERPRISE_PURCHASER') return {
    ...row,
    WriteScope: '采购车、下单、提交本企业转账凭证、收货、售后',
    ApprovalAuthority: 'NONE',
    ForbiddenActions: '不得访问供应价、个人福利卡、跑腿大厅、公司财务审核或其他企业订单',
    P0: 'P0-025,P0-029,P0-062,P0-078,P0-079', Status: 'IMPLEMENTED_M3_P025_PARTIAL',
  };
  return null;
});

await updateCsv(path.join('data', '阶段门禁.csv'), (row) => row.Stage === 'M3' ? {
  ...row,
  Status: 'IN_PROGRESS', EvidenceStatus: 'LOCAL_PASS',
  Notes: 'M3-P024已由PR #84合并且main run 31786009896成功。M3-P025 local head e1407aa pnpm verify 17/17通过；等待Draft PR精确head CI、人工合并和post-merge main CI。P0-025整体因福利卡与真实资金/staging保持NOT_EXECUTED；M3-P026及后续锁定。',
} : null);

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = {
  ...status.execution,
  status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P025', nextAllowedTask: 'M3-P025', activeTaskCount: 1,
  lastCompletedTask: 'M3-P024', lastCompletedCommit: p024Merge, lastPassedGate: 'M2-GATE',
  prohibitedUntilGate: [
    'M3-P025 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P026',
    '福利卡、退款、门户后续切片及M4配送保持锁定',
  ],
};
status.github = {
  ...status.github,
  pullRequest: null, pullRequestUrl: null, pullRequestState: 'NOT_CREATED', pullRequestMerged: false,
  mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: {
    scope: 'M3_P024_MAIN_POST_MERGE', status: 'CI_PASS', runId: 31786009896, jobId: 94721950214,
    runUrl: 'https://github.com/EasyStep-lee/flt1/actions/runs/31786009896', headSha: p024Merge,
    event: 'push', completedAt: '2026-08-14T09:05:06Z',
  },
  currentTaskDelivery: {
    taskId: 'M3-P025', issue: 85, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/85',
    branch: 'codex/m3-company-unified-checkout', baseCommit: p024Merge, implementationCommit, verifiedHead,
    status: 'LOCAL_PASS_PENDING_DRAFT_PR', localRedTest: 'API_BUILD_0_EXPECTED_201_OR_422_ACTUAL_404_3_OF_3',
    localFocusedTest: 'LOCAL_PASS_REPOSITORY_3_API_7_MIGRATION_1_P0_E2E_2',
    localFullVerify: 'PASS_17_OF_17_HEAD_E1407AA', pullRequest: null, pullRequestState: 'NOT_CREATED', exactHeadCi: 'NOT_EXECUTED',
    review: 'PENDING_SELF_REVIEW', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED',
    blockingExternalItem: 'REAL_WECHAT_BANK_AND_STAGING_EVIDENCE', nextTaskUnlocked: false,
  },
  previousTaskDelivery: {
    taskId: 'M3-P024', pullRequest: 84, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/84',
    exactHead: p024AuthorizedHead, mergeCommit: p024Merge, mainPostMergeCiRun: 31786009896,
    mainPostMergeCiJob: 94721950214, status: 'CI_PASS',
  },
  note: 'M3-P025本地17/17门禁通过；等待Draft PR及精确head CI。福利卡发行记账与真实资金证据未进入本切片，P0-025整体保持NOT_EXECUTED；M3-P026锁定。',
};
status.evidence = {
  local: 'LOCAL_PASS_M3_P025_FULL_VERIFY', ci: 'NOT_EXECUTED_M3_P025',
  staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED',
};
status.counts = {
  ...status.counts,
  fields: 711,
  stateTransitions: 112,
  migrations: 25,
};
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
