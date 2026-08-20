import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/u, '').split('='); return [key, rest.join('=')];
}));
const root = process.cwd();
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const commit = args.commit || 'WORKTREE';
const evidenceStatus = args['evidence-status'] || 'LOCAL_PASS';
const fullVerify = args['full-verify'] || 'NOT_EXECUTED';
const updatedAt = args['updated-at'] || new Date().toISOString();
const pullRequestNumber = Number(args['pull-request'] || 0) || null;
const pullRequestUrl = pullRequestNumber ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequestNumber}` : '';
const pullRequestState = pullRequestNumber ? 'DRAFT' : 'NOT_CREATED';
const pullRequestCi = args['pr-ci'] || 'NOT_EXECUTED';
const implemented = ['LOCAL_PASS', 'CI_PASS'].includes(evidenceStatus);
const fullVerifyPassed = fullVerify === 'PASS_17_OF_17';

const p058 = {
  head: '4ba2b7e4844f2ae661ae1a0567dce055cd5984dc', merge: 'a0fc8a6e785395f78362966c398a8fa1f1e37d98',
  pr: 113, prRun: 32338170541, prJob: 96331731930, mainRun: 32339750495, mainJob: 96336282159,
  mergedAt: '2026-08-20T06:28:34Z',
};

const parseLine = (line) => {
  const values = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  values.push(value); return values;
};
const encode = (value) => /[",\r\n]/u.test(String(value ?? '')) ? `"${String(value ?? '').replaceAll('"', '""')}"` : String(value ?? '');
const upsertCsv = async (relativePath, keyFields, changes) => {
  const filePath = path.join(pack, relativePath); const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n'; const lines = source.split(/\r?\n/u).filter(Boolean);
  const headers = parseLine(lines[0]); const rows = lines.slice(1).map((line) => {
    const values = parseLine(line); return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
  const keyOf = (row) => keyFields.map((field) => row[field] ?? '').join('\u0000');
  const byKey = new Map(rows.map((row, index) => [keyOf(row), index]));
  for (const change of changes) {
    const index = byKey.get(keyOf(change));
    if (index === undefined) { rows.push(Object.fromEntries(headers.map((header) => [header, change[header] ?? '']))); byKey.set(keyOf(change), rows.length - 1); }
    else rows[index] = { ...rows[index], ...change };
  }
  await writeFile(filePath, `${[headers.join(','), ...rows.map((row) => headers.map((header) => encode(row[header])).join(','))].join(eol)}${eol}`, 'utf8');
  return rows.length;
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P058', Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX', Branch: 'codex/m3-mixed-payment-split-refund', CommitSHA: p058.merge,
    PullRequest: `https://github.com/EasyStep-lee/flt1/pull/${p058.pr}`, CI: 'CI_PASS', UpdatedAt: p058.mergedAt,
    Notes: `PR #113精确head ${p058.head}经run ${p058.prRun}/job ${p058.prJob}验证并按授权合并为${p058.merge}；post-merge main run ${p058.mainRun}/job ${p058.mainJob}成功。真实微信/福利资金/staging/device/production未执行。`,
  },
  {
    TaskID: 'M3-P059', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX', Branch: 'codex/m3-welfare-card-ledger', CommitSHA: commit,
    PullRequest: pullRequestUrl, CI: pullRequestCi, UpdatedAt: updatedAt,
    Notes: `三种资金来源映射、全业务类型连续账本、账户白名单查询、财务调整/冲正自然人双人复核、并发与幂等已实现。${fullVerifyPassed ? 'pnpm verify 17/17通过。' : '完整门禁尚未通过。'}staging/device/production与真实资金未执行。`,
  },
  { TaskID: 'M3-P062', Status: 'NOT_STARTED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: 'M3-P059 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。' },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  {
    P0ID: 'P0-058', CurrentEvidenceStatus: 'CI_PASS', LastVerifiedCommit: p058.merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: p058.mergedAt,
    EvidenceLink: `docs/contracts/m3/M3-P058-mixed-payment-split-refund.md|https://github.com/EasyStep-lee/flt1/pull/${p058.pr}|https://github.com/EasyStep-lee/flt1/actions/runs/${p058.mainRun}`,
    Notes: 'PR #113合并且post-merge main CI成功；RequiredEvidenceLevel仍为STAGING_PASS，真实微信/福利资金/staging/device/production未执行。',
  },
  {
    P0ID: 'P0-059', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'NEG-M3-P059-01|NEG-M3-P059-02|NEG-M3-P059-03|apps/api/test/unit/welfare-card-ledger-policy.test.mjs|apps/api/test/unit/prisma-welfare-card-adjustment-repository.test.mjs|apps/api/test/supertest/welfare-card-ledger-api.test.mjs|apps/user-miniapp/test/welfare-card-ledger-build.test.mjs|tests/openapi/m3-p059-welfare-card-ledger.contract.test.mjs|tests/e2e/p0/p0-059-welfare-card-ledger.spec.ts',
    ManualCaseID: 'N/A', NegativeChecks: 'PERSONAL_RECHARGE与第四类来源零写入；越权账户关闭；同自然人自审；二次验证；重复/并发决定；重复冲正；CAS失败全事务回滚；账本断链关闭',
    EvidenceLink: 'docs/contracts/m3/M3-P059-welfare-card-ledger.md|artifacts/verification/M3-P059/welfare-card-ledger.json', LastVerifiedCommit: commit, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: `${implemented ? '本地自动化、MySQL 8迁移演练和页面行为通过；等待Draft PR精确head CI。' : '实现和验证进行中。'}RequiredEvidenceLevel为CI_PASS；staging/device/production与真实资金未执行。`,
  },
]);

const field = (Entity, Field, SuggestedType, Validation, HistoryRule, Sensitivity = 'INTERNAL') => ({
  Entity, Field, SuggestedType, Required: 'YES', Sensitivity, Validation, HistoryRule, Stage: 'M3', P0: 'P0-059',
  Source: '综合方案§9.7/§9.8/§13；M3-P059契约', Status: implemented ? 'IMPLEMENTED_M3_P059' : 'DESIGNED_M3_P059',
});
await upsertCsv('05-字段字典初始版.csv', ['Entity', 'Field'], [
  field('WelfareCardAccount', 'ledgerSequence', 'Int', '非负；与本账户最大账本sequence一致；事务内递增', '不单独人工修改；随资金事务原子更新'),
  field('WelfareCardLedger', 'sequence', 'Int', '从1连续；accountId+sequence唯一', '只追加；禁止更新删除'),
  field('WelfareCardLedger', 'adjustmentId', 'UUID?', '调整/冲正批准记录一对一；唯一FK', '只追加；禁止更新删除'),
  ...[
    ['id', 'UUID', '主键'], ['companyId', 'UUID', '必须来自固定公司会话'], ['accountId', 'UUID', '必须属于固定公司'],
    ['businessType', 'enum', 'ADJUSTMENT|REVERSAL'], ['direction', 'enum', 'CREDIT|DEBIT；冲正由原流水派生'], ['amount', 'Int', '正整数分；冲正由原流水派生'],
    ['reversalOfLedgerId', 'UUID?', '仅REVERSAL；引用同账户已批准ADJUSTMENT流水且唯一'], ['reason', 'String', '2..500'], ['status', 'enum', 'PENDING|APPROVED|REJECTED'],
    ['version', 'Int', '非负CAS版本'], ['applicantIdentityId', 'UUID', '自然人申请者；服务端派生'], ['applicantFunctionalAccountId', 'UUID', '公司财务职能；服务端派生'],
    ['reviewerIdentityId', 'UUID?', '必须与申请者不同自然人'], ['reviewerFunctionalAccountId', 'UUID?', '公司财务职能；服务端派生'], ['reviewOpinion', 'String?', '2..1000'],
    ['createdAt', 'DateTime(3)', '服务端时间'], ['updatedAt', 'DateTime(3)', '服务端时间'],
  ].map(([name, type, validation]) => field('WelfareCardAdjustment', name, type, validation, '状态和决定通过独立History追加；批准后不可改写', name.includes('Identity') ? 'RESTRICTED_INTERNAL' : 'INTERNAL')),
]);

await upsertCsv('06-状态机总表.csv', ['StateMachine', 'CurrentState', 'Event'], [
  { StateMachine: 'WelfareCardAdjustment', Stage: 'M3', CurrentState: 'NONE', Event: 'CREATE', NextState: 'PENDING', AllowedActor: 'COMPANY_FINANCE', Guard: '固定公司/账户；调整金额方向合法或冲正引用原ADJUSTMENT流水；业务键幂等', SideEffect: '仅追加申请/历史/审计，不改余额', Idempotency: 'scope+Idempotency-Key+requestHash', IllegalTransition: '个人充值/第四类来源/归属或最终余额字段拒绝', ConcurrencyControl: 'Serializable+唯一键', History: 'WelfareCardAdjustmentHistory append-only', P0: 'P0-045,P0-059,P0-072', Status: implemented ? 'IMPLEMENTED_M3_P059' : 'DESIGNED_M3_P059' },
  { StateMachine: 'WelfareCardAdjustment', Stage: 'M3', CurrentState: 'PENDING', Event: 'APPROVE', NextState: 'APPROVED', AllowedActor: 'COMPANY_FINANCE', Guard: '不同identityId；二次验证；version CAS；余额不低于冻结额', SideEffect: '原子更新账户并追加ADJUSTMENT或REVERSAL账本、历史和审计', Idempotency: 'adjustmentId+reviewerIdentityId+Idempotency-Key', IllegalTransition: '同人自审/旧版本/重复决定拒绝', ConcurrencyControl: 'Serializable+adjustment/account双CAS；冲突全事务回滚', History: '批准历史与账本只追加', P0: 'P0-045,P0-059,P0-072', Status: implemented ? 'IMPLEMENTED_M3_P059' : 'DESIGNED_M3_P059' },
  { StateMachine: 'WelfareCardAdjustment', Stage: 'M3', CurrentState: 'PENDING', Event: 'REJECT', NextState: 'REJECTED', AllowedActor: 'COMPANY_FINANCE', Guard: '不同identityId；二次验证；version CAS', SideEffect: '追加驳回历史和审计；零账本写入', Idempotency: 'adjustmentId+reviewerIdentityId+Idempotency-Key', IllegalTransition: '同人自审/旧版本/重复决定拒绝', ConcurrencyControl: 'Serializable+version CAS', History: '只追加', P0: 'P0-045,P0-059,P0-072', Status: implemented ? 'IMPLEMENTED_M3_P059' : 'DESIGNED_M3_P059' },
  { StateMachine: 'WelfareCardAccount', Stage: 'M3', CurrentState: 'ACTIVE', Event: 'ADJUSTMENT_OR_REVERSAL', NextState: 'ACTIVE', AllowedActor: 'COMPANY_FINANCE_CHECKER', Guard: '已批准调整；连续sequence；余额/冻结非负；冲正仅一次', SideEffect: '余额与ledgerSequence原子更新；追加账本', Idempotency: 'adjustmentId唯一', IllegalTransition: '直接改余额/重复冲正拒绝', ConcurrencyControl: 'account version/balance/frozen CAS+唯一sequence', History: 'WelfareCardLedger不可更新删除', P0: 'P0-059', Status: implemented ? 'IMPLEMENTED_M3_P059' : 'DESIGNED_M3_P059' },
]);

await upsertCsv('07-权限与数据可见矩阵.csv', ['OwnerType', 'RoleCode'], [
  { OwnerType: 'COMPANY', RoleCode: 'COMPANY_WELFARE_CARD', ReadScope: '计划、批次、账户脱敏摘要、连续追加式账本', WriteScope: '计划/批次；不直接写余额或财务调整', DataScope: '唯一公司福利卡域；账户归属自然人不进入DTO', ForbiddenActions: '不得改写账本、直接改余额、个人充值、查看自然人内部标识或用超级管理员绕过复核', Stage: 'M3', P0: 'P0-051,P0-052,P0-059,P0-067,P0-068', Status: implemented ? 'IMPLEMENTED_M3_P059_PARTIAL' : 'DESIGNED_M3_P059' },
  { OwnerType: 'COMPANY', RoleCode: 'COMPANY_FINANCE', ReadScope: '支付退款、企业转账、福利卡调整/冲正白名单、账单与凭证', WriteScope: '福利卡调整/冲正申请与独立复核；企业转账确认/驳回；后续对账和线下付款登记', ApprovalAuthority: '福利卡调整/冲正不同自然人复核；企业转账确认；结算与财务复核', DataScope: '唯一公司全财务数据；company/functionalAccount/identity从固定会话派生', ForbiddenActions: '不得同自然人自审、直接改余额、覆盖账本、个人充值、自动向供应商打款或确认其他公司订单', Stage: 'M3,M5', P0: 'P0-025,P0-029,P0-040,P0-042,P0-043,P0-059,P0-060,P0-065,P0-067,P0-068,P0-072', Status: implemented ? 'IMPLEMENTED_M3_P059_PARTIAL' : 'DESIGNED_M3_P059' },
]);

await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [
  { PageID: 'PAGE-008', ImplementationStatus: implemented ? 'IMPLEMENTED_M3_P051_P059_ACCOUNT_LEDGER' : 'IMPLEMENTED_M3_P051_P059_DESIGNED', AcceptanceStatus: `P0-067_CI_PASS;P0-068_CI_PASS;P0-051_CI_PASS;P0-059_${evidenceStatus};EXT-012_BLOCKED_EXTERNAL`, RouteTest: 'tests/e2e/p0/p0-051-welfare-card-programs-batches.spec.ts|tests/e2e/p0/p0-059-welfare-card-ledger.spec.ts|tests/e2e/p0/p0-067-company-workspaces.spec.ts|tests/e2e/p0/p0-068-company-workspace-completeness.spec.ts', Notes: '固定COMPANY_WELFARE_CARD独立页面；新增账户脱敏摘要和追加式账本；不提供直接改余额或个人充值。真实发行仍受EXT-012门禁。' },
  { PageID: 'PAGE-009', Stage: 'M3,M5', P0: 'P0-040,P0-042,P0-059,P0-060,P0-065,P0-067,P0-068,P0-072', ImplementationStatus: implemented ? 'IMPLEMENTED_M3_P059_FINANCE_ADJUSTMENT_PARTIAL' : 'IMPLEMENTED_M1_DIRECTORY_M3_P059_DESIGNED', AcceptanceStatus: `P0-067_CI_PASS;P0-068_CI_PASS;P0-059_${evidenceStatus};P0-040_P0-042_P0-060_P0-065_NOT_EXECUTED`, RouteTest: 'tests/e2e/p0/p0-059-welfare-card-ledger.spec.ts|tests/e2e/p0/p0-067-company-workspaces.spec.ts|tests/e2e/p0/p0-068-company-workspace-completeness.spec.ts', Notes: '固定COMPANY_FINANCE独立页面；M3仅实现福利卡调整/冲正申请与不同自然人二次验证复核；M5对账结算保持DEFERRED。' },
  { PageID: 'PAGE-063', ImplementationStatus: implemented ? 'IMPLEMENTED_M3_P059_LEDGER' : 'M3_P059_DESIGNED', AcceptanceStatus: `P0-059_${evidenceStatus};P0-053_CI_PASS;P0-097_NOT_EXECUTED;DEVICE_NOT_EXECUTED`, RouteTest: 'apps/user-miniapp/test/welfare-card-ledger-build.test.mjs|tests/openapi/m3-p059-welfare-card-ledger.contract.test.mjs', Notes: '通过miniapp-kit唯一wx.request适配器读取本人账户账本；展示loading/empty/error/permission/offline/success；不含充值、归属字段或供应价。真机未执行。' },
]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [{
  EvidenceID: 'EVD-058', CurrentStatus: 'CI_PASS', ExecutedAt: p058.mergedAt, CommitSHA: p058.merge,
  CIRunURL: `https://github.com/EasyStep-lee/flt1/actions/runs/${p058.mainRun}`,
  Executor: 'GITHUB_ACTIONS+CODEX', Freshness: 'MERGED_MAIN', FailureOrBlocker: '真实微信商户退款、真实福利资金、staging、device、production未执行', RetestRequired: 'YES',
  Notes: `PR #113精确head ${p058.head} CI成功并合并；post-merge main run ${p058.mainRun}/job ${p058.mainJob}成功。RequiredLevel仍为STAGING_PASS。`,
}, {
  EvidenceID: 'EVD-059', P0ID: 'P0-059', Stage: 'M3', TaskID: 'M3-P059', EvidenceType: 'AUTOMATED_APPEND_ONLY_LEDGER_FINANCE_MAKER_CHECKER', RequiredLevel: 'CI_PASS', CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'focused policy/repository/API/miniapp/OpenAPI/migration/P0 E2E；Prisma validate/migration rehearsal；pnpm verify',
  Expected: '三种合法来源映射到开账流水；完整业务类型连续；余额冻结守恒；财务调整/冲正不同自然人复核且精确一次；充值/第四来源零写入',
  Actual: implemented ? '本地覆盖连续链、断链关闭、来源映射、越权、同人自审、二次验证、重复/并发、冲正、CAS回滚、页面与DTO白名单。' : '实现中。',
  Environment: 'LOCAL_WINDOWS_MYSQL8_CHROMIUM_DETERMINISTIC_ADAPTER', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; MySQL 8; Playwright Chromium', ExecutedAt: updatedAt, CommitSHA: commit,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P059-welfare-card-ledger.md|artifacts/verification/M3-P059/welfare-card-ledger.json|artifacts/verification/M3-P059/welfare-card-account-ledger-page.png|artifacts/verification/M3-P059/welfare-card-adjustment-page.png', Executor: 'CODEX', Freshness: 'FRESH_LOCAL_WORKTREE',
  FailureOrBlocker: 'PR精确head CI尚未执行；staging/device/production与真实资金未执行', RetestRequired: 'YES', Notes: '只完成P059；P062/M4以后未进入。',
}]);

await upsertCsv('11-数据库迁移台账.csv', ['MigrationID'], [{
  MigrationID: 'MIG-014B', Stage: 'M3', PlannedName: '20260820090000_m3_welfare_card_ledger', DependsOn: 'MIG-014A,MIG-013A', Objects: 'WelfareCardAccount/WelfareCardLedger/WelfareCardAdjustment/WelfareCardAdjustmentHistory/WelfareCardAdjustmentCommand',
  Purpose: '增加每账户连续账本序号、完整业务类型约束、财务调整/冲正双人复核与不可变历史/命令',
  ForwardSteps: '回填sequence和ledgerSequence；添加唯一/FK/CHECK；新增调整/历史/命令表及不可变触发器；保留旧账本不可更新删除触发器',
  BackwardOrRecovery: '未发布时回退提交并重建开发库；共享环境只回退应用并新增向前修复迁移，不回改已发布迁移', DataBackfill: '按accountId、occurredAt、id确定性ROW_NUMBER回填sequence并同步账户最大序号',
  Verification: 'Prisma validate；空库/升级/恢复/product drift；业务类型/序号/余额冻结/CAS/不可变触发器；focused与全量门禁', BackupRequired: 'YES', Status: fullVerifyPassed ? 'CREATED_LOCAL_REHEARSED_M3_P059' : 'CREATED_LOCAL_REHEARSAL_PASS_M3_P059', AppliedLocalAt: updatedAt, CommitSHA: commit,
  EvidenceLink: 'packages/db/prisma/migrations/20260820090000_m3_welfare_card_ledger/migration.sql|tests/migrations/m3-p059-welfare-card-ledger-migration.contract.test.mjs', Notes: 'MySQL 8演练empty=2/upgrade=2/restore=2/product=37/cleanup=PASS；staging/production未应用；已发布后仅向前修复。',
}]);

const apiRows = [
  ['API-040', 'GET', '/v1/consumer/welfare-card-accounts/{accountId}/ledger', 'CONSUMER', 'Path(accountId)', 'ConsumerWelfareLedgerResponseDto', 'WELFARE_LEDGER_SCOPE_FORBIDDEN,WELFARE_LEDGER_INCONSISTENT', 'NONE', 'P0-059,P0-097'],
  ['API-107', 'GET', '/v1/company/welfare-card/accounts', 'COMPANY_WELFARE_CARD', 'None', 'CompanyWelfareAccountPageResponseDto', 'AUTHENTICATION_REQUIRED,WORKSPACE_FORBIDDEN', 'NONE', 'P0-059,P0-067,P0-068'],
  ['API-108', 'GET', '/v1/company/welfare-card/accounts/{accountId}/ledger', 'COMPANY_WELFARE_CARD', 'Path(accountId)', 'ConsumerWelfareLedgerResponseDto', 'WELFARE_LEDGER_SCOPE_FORBIDDEN,WELFARE_LEDGER_INCONSISTENT', 'NONE', 'P0-059'],
  ['API-109', 'POST', '/v1/company/welfare-card/accounts/{accountId}/adjustments', 'COMPANY_FINANCE', 'CreateWelfareCardAdjustmentRequestDto', 'WelfareCardAdjustmentResponseDto', 'FIELD_FORBIDDEN,PERSONAL_RECHARGE_FORBIDDEN,WELFARE_REVERSAL_INVALID,IDEMPOTENCY_CONFLICT', 'Idempotency-Key+requestHash', 'P0-045,P0-059,P0-072'],
  ['API-110', 'GET', '/v1/company/welfare-card/adjustments', 'COMPANY_FINANCE', 'None', 'WelfareCardAdjustmentPageResponseDto', 'AUTHENTICATION_REQUIRED,WORKSPACE_FORBIDDEN', 'NONE', 'P0-059,P0-072'],
  ['API-111', 'POST', '/v1/company/welfare-card/adjustments/{adjustmentId}/decision', 'COMPANY_FINANCE', 'DecideWelfareCardAdjustmentRequestDto', 'WelfareCardAdjustmentResponseDto', 'SAME_NATURAL_PERSON_REVIEW,SECOND_VERIFICATION_REQUIRED,WELFARE_ADJUSTMENT_VERSION_CONFLICT,WELFARE_ADJUSTMENT_STATE_INVALID', 'Idempotency-Key+requestHash', 'P0-045,P0-059,P0-072'],
].map(([ContractID, Method, Path, Actor, RequestDTO, ResponseDTO, ErrorCodes, Idempotency, P0]) => ({
  ContractID, Stage: 'M3', Domain: 'welfare-card-ledger', Method, Path, Actor, RequestDTO, ResponseDTO, CommonResponse: '{success,data,error:{code,message,details?},requestId}', ErrorCodes, Idempotency,
  SensitiveFieldPolicy: 'NEVER_RETURN_SUPPLY_PRICE；DTO白名单；company/consumer/functionalAccount/identity从会话派生；不返回归属自然人、申请/复核identity、卡号原文、供应价或二次验证码', MoneyRule: '整数分；余额/冻结/流水由服务端派生并校验连续', P0,
  OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED', ContractTest: 'apps/api/test/supertest/welfare-card-ledger-api.test.mjs|tests/openapi/m3-p059-welfare-card-ledger.contract.test.mjs|packages/contracts/openapi.json', Owner: 'CODEX', Notes: 'M3-P059任务内契约细化；private/no-store/noindex；个人充值路径永久不存在。',
}));
await upsertCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], apiRows);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P058 PR #113合并且main run ${p058.mainRun}成功。M3-P059福利卡追加式账本为${evidenceStatus}；P062及M4以后锁定；staging/device/production与真实资金未执行。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const visit = (value) => {
  if (Array.isArray(value)) for (const item of value) visit(item);
  else if (value && typeof value === 'object') {
    if (value.taskId === 'M3-P058') value.executionStatus = 'CI_PASS';
    if (value.taskId === 'M3-P059') value.executionStatus = evidenceStatus;
    for (const child of Object.values(value)) visit(child);
  }
};
visit(freeze); await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json'); const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P059', nextAllowedTask: 'M3-P059', activeTaskCount: 1, lastCompletedTask: 'M3-P058', lastCompletedCommit: p058.merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P059 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P062', 'M3-GATE通过前M4及以后保持锁定；staging/device/production与真实资金未执行'] };
status.github = { ...status.github, pullRequest: pullRequestNumber, pullRequestUrl: pullRequestUrl || null, pullRequestState, pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: pullRequestCi, runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: { scope: 'M3_P058_POST_MERGE_MAIN', status: 'CI_PASS', runId: p058.mainRun, jobId: p058.mainJob, runUrl: `https://github.com/EasyStep-lee/flt1/actions/runs/${p058.mainRun}`, headSha: p058.merge, event: 'push', completedAt: null },
  currentTaskDelivery: { taskId: 'M3-P059', issue: null, issueUrl: null, branch: 'codex/m3-welfare-card-ledger', baseCommit: p058.merge, verifiedHead: commit, status: pullRequestNumber ? 'DRAFT_PR_CI_PENDING' : implemented ? 'LOCAL_PASS_PENDING_DRAFT_PR' : 'IN_PROGRESS', localRedTest: 'RECORDED', localFocusedTest: implemented ? 'LOCAL_PASS_M3_P059_FOCUSED' : 'NOT_EXECUTED', localFullVerify: fullVerify, pullRequest: pullRequestNumber, pullRequestState, exactHeadCi: pullRequestCi, review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'STAGING_DEVICE_PRODUCTION_REAL_FUNDS', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P058', pullRequest: p058.pr, pullRequestUrl: `https://github.com/EasyStep-lee/flt1/pull/${p058.pr}`, exactHead: p058.head, mergeCommit: p058.merge, mainPostMergeCiRun: p058.mainRun, mainPostMergeCiJob: p058.mainJob, status: 'CI_PASS' },
  note: `M3-P058 merged-main CI_PASS；M3-P059福利卡追加式账本${evidenceStatus}；P062/M4以后锁定。` };
status.evidence = { local: implemented ? 'LOCAL_PASS_M3_P059' : 'NOT_EXECUTED_M3_P059', ci: pullRequestCi === 'CI_PASS' ? 'CI_PASS' : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
status.counts = { ...status.counts, fields: 788, stateTransitions: 119, migrations: 30, apiContracts: 111 };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json'); const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.counts = { ...manifest.counts, fields: 788, stateTransitions: 119, migrations: 30, apiContracts: 111 };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P059'); await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'welfare-card-ledger.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P059', p0: ['P0-059'], status: evidenceStatus, commit, updatedAt,
  baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  red: [
    { command: 'pnpm --filter @fulishe/api build && node --test apps/api/test/unit/welfare-card-ledger-policy.test.mjs', exitCode: 1, result: 'FAIL', reason: 'ERR_MODULE_NOT_FOUND before policy implementation' },
    { command: 'pnpm exec vitest run --project api-contract apps/api/test/supertest/welfare-card-ledger-api.test.mjs', exitCode: 1, result: 'FAIL_3_OF_3', reason: 'consumer/company ledger and finance routes returned 404 before controller implementation' },
    { command: 'pnpm --filter @fulishe/user-miniapp build && node --test apps/user-miniapp/test/welfare-card-ledger-build.test.mjs', exitCode: 1, result: 'FAIL_3_OF_3', reason: 'PAGE-063 missing from build artifact before build manifest implementation' },
  ],
  focused: implemented ? [
    { command: 'node --test welfare policy/binding/adjustment/miniapp/migration/openapi focused tests', result: 'PASS' },
    { command: 'vitest welfare ledger API and workspace API', result: 'PASS_8_OF_8' },
    { command: 'playwright P0-059 and company workspace focused', result: 'PASS_4_OF_4' },
    { command: 'pnpm prisma:migrate:dry-run', result: 'PASS_EMPTY_2_UPGRADE_2_RESTORE_2_PRODUCT_37_CLEANUP' },
  ] : [],
  fullVerify,
  invariants: { fundingSourcesExactlyThree: true, personalRechargeAbsent: true, integerCents: true, continuousPerAccountSequence: true, balanceAndFrozenNonNegative: true, appendOnlyLedger: true, ownerDerivedScope: true, makerCheckerNaturalPerson: true, superAdminBypassAbsent: true, adjustmentAtomicWithLedger: true, reversalExactlyOnce: true, casConflictRollsBack: true },
  boundaries: { realFunds: 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED', p062: 'LOCKED', m4AndLater: 'LOCKED' },
  github: { issue: null, pullRequest: pullRequestNumber, pullRequestState, ciStatus: pullRequestCi },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P059_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
