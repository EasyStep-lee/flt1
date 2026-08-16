import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const updatedAt = process.env.M3_P052_UPDATED_AT ?? new Date().toISOString();
const commit = process.env.M3_P052_COMMIT ?? 'LOCAL_WORKTREE';
const pullRequest = process.env.M3_P052_PR ?? '';
const ciRun = process.env.M3_P052_CI_RUN ?? '';
const ciJob = process.env.M3_P052_CI_JOB ?? '';
const fullVerify = process.env.M3_P052_FULL_VERIFY ?? 'NOT_EXECUTED';
const evidenceStatus = ciRun ? 'CI_PASS' : 'LOCAL_PASS';
const prUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const ciUrl = ciRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${ciRun}` : '';
const p051Head = '823672611b8ed291cf29ce02f99d6fd60ab44b9c';
const p051Merge = '31839f8fd2daa8efb0910e7c7405cbc80fa9a752';
const p051MainRun = '31935845317';
const p051MainJob = '95137513626';

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

const upsertCsv = async (relativePath, keyFields, changes) => {
  const filePath = path.join(pack, relativePath);
  const source = await readFile(filePath, 'utf8');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u).filter(Boolean);
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
  const keyOf = (row) => keyFields.map((field) => row[field] ?? '').join('\u0000');
  const byKey = new Map(rows.map((row, index) => [keyOf(row), index]));
  for (const change of changes) {
    const key = keyOf(change);
    const index = byKey.get(key);
    if (index === undefined) {
      byKey.set(key, rows.length);
      rows.push(Object.fromEntries(headers.map((header) => [header, change[header] ?? ''])));
    } else rows[index] = { ...rows[index], ...change };
  }
  const output = [headers.join(','), ...rows.map((row) => headers.map((header) => encode(row[header])).join(','))];
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P051', Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/99', Branch: 'codex/m3-welfare-plan-batches',
    CommitSHA: p051Head, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/100', CI: 'CI_PASS', UpdatedAt: '2026-08-16T08:22:54Z',
    Notes: `PR #100精确head ${p051Head.slice(0, 7)}经授权合并；merge ${p051Merge}；post-merge main Actions run ${p051MainRun}/job ${p051MainJob}成功。EXT-012真实发行、staging/device/production仍未执行。`,
  },
  {
    TaskID: 'M3-P052', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/101', Branch: 'codex/m3-welfare-card-binding',
    CommitSHA: commit, PullRequest: prUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED：API 3/3因404、迁移ENOENT、小程序页面3/3缺失。GREEN：卡号密码/兑换码/扫码契约、会话归属、scrypt摘要、绑定并发/幂等/错误恢复、账户和不可变CLAIM账本、DTO白名单与小程序状态通过；${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁待记录。'} EXT-012真实发行和真机扫码仍未执行。${ciRun ? ` Draft PR精确head ${commit.slice(0, 7)} Actions run ${ciRun}/job ${ciJob}成功。` : ''}`,
  },
  {
    TaskID: 'M3-P053', Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P052 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [{
  P0ID: 'P0-052', CurrentEvidenceStatus: evidenceStatus,
  AutomatedTestID: 'apps/api/test/supertest/welfare-card-binding-api.test.mjs|apps/api/test/unit/prisma-welfare-card-binding-repository.test.mjs|tests/migrations/m3-p052-welfare-card-binding-migration.contract.test.mjs|tests/openapi/m3-p052-welfare-card-binding.contract.test.mjs|apps/user-miniapp/test/welfare-card-binding-build.test.mjs|tests/e2e/p0/p0-052-welfare-card-binding.spec.ts',
  ManualCaseID: 'MANUAL-052_DEVICE_NOT_EXECUTED',
  NegativeChecks: '未知/owner字段拒绝且零写；错误秘密、禁用/过期/冻结批次、他人已领取拒绝；同键异体冲突；并发不同用户仅一个领取；明文秘密不入库/响应/日志；PERSONAL_RECHARGE能力不存在',
  EvidenceLink: `docs/contracts/m3/M3-P052-welfare-card-binding.md|packages/db/prisma/migrations/20260816090000_m3_welfare_card_binding/migration.sql${prUrl ? `|${prUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
  LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
  Notes: '自动化技术子行为通过；真实卡码发行、真机扫码、staging/production均未执行。P0-053账户选择及支付/退款不在本切片。',
}]);

const fieldPath = path.join(pack, '05-字段字典初始版.csv');
const fieldSource = await readFile(fieldPath, 'utf8');
const fieldLines = fieldSource.split(/\r?\n/u).filter(Boolean);
const fieldHeaders = parseLine(fieldLines[0]);
const existingFields = fieldLines.slice(1).map((line) => {
  const values = parseLine(line);
  return Object.fromEntries(fieldHeaders.map((header, index) => [header, values[index] ?? '']));
});
const baseFieldChanges = existingFields
  .filter((row) => ['WelfareCardCode', 'WelfareCardAccount', 'WelfareCardLedger'].includes(row.Entity))
  .map((row) => ({ Entity: row.Entity, Field: row.Field, Status: 'IMPLEMENTED_M3_P052', ...(row.Entity === 'WelfareCardLedger' ? { P0: 'P0-052,P0-055,P0-056,P0-057,P0-058,P0-059' } : {}) }));
baseFieldChanges.push(
  { Entity: 'WelfareCardCode', Field: 'claimedByConsumerUserId', Required: 'CONDITIONAL', Validation: 'null while UNCLAIMED; server-derived consumerUserId on atomic claim' },
  { Entity: 'WelfareCardCode', Field: 'claimedAt', Required: 'CONDITIONAL', Validation: 'null while UNCLAIMED; server UTC time on atomic claim' },
  { Entity: 'WelfareCardLedger', Field: 'orderId', Required: 'CONDITIONAL', Validation: 'null for CLAIM; later order flows remain out of scope' },
  { Entity: 'WelfareCardLedger', Field: 'refundId', Required: 'CONDITIONAL', Validation: 'null for CLAIM; later refund flows remain out of scope' },
  { Entity: 'WelfareCardLedger', Field: 'beforeFrozen', SuggestedType: 'Int', UnitOrFormat: 'integer cents; >=0', Validation: 'integer cents; CLAIM requires zero' },
  { Entity: 'WelfareCardLedger', Field: 'afterFrozen', SuggestedType: 'Int', UnitOrFormat: 'integer cents; >=0', Validation: 'integer cents; CLAIM requires zero' },
  { Entity: 'WelfareCardAccount', Field: 'status', UnitOrFormat: 'ACTIVE|SUSPENDED|EXPIRED|CLOSED', Validation: 'binding creates ACTIVE; later transitions remain out of scope' },
  { Entity: 'WelfareCardCode', Field: 'version', RawDefinition: 'version', Position: '9', SuggestedType: 'Int', Required: 'YES', UnitOrFormat: 'non-negative integer', Sensitivity: 'INTERNAL', Visibility: '后端并发控制', ForbiddenExposure: '消费者DTO不返回', Validation: 'optimistic status+version update count must equal one', HistoryRule: '只增不减', Stage: 'M3', P0: 'P0-052', Source: 'M3-P052技术字段', Status: 'IMPLEMENTED_M3_P052' },
  { Entity: 'WelfareCardAccount', Field: 'cardCodeId', RawDefinition: 'cardCodeId', Position: '9', SuggestedType: 'String(36)', Required: 'YES', UnitOrFormat: 'UUID v4', Sensitivity: 'INTERNAL', Visibility: '服务端内部关联', ForbiddenExposure: '消费者DTO不返回', Validation: 'one card code maps to exactly one account', HistoryRule: '绑定后不可改写', Stage: 'M3', P0: 'P0-052', Source: 'M3-P052技术字段', Status: 'IMPLEMENTED_M3_P052' },
  ...['id', 'companyId', 'consumerUserId', 'idempotencyKey', 'requestHash', 'requestId', 'responseSnapshot', 'createdAt'].map((field, index) => ({ Entity: 'WelfareCardBindingCommand', Field: field, RawDefinition: field, Position: String(index + 1), SuggestedType: field === 'responseSnapshot' ? 'Json' : field === 'createdAt' ? 'DateTime' : 'String', Required: 'YES', UnitOrFormat: field === 'createdAt' ? 'UTC ISO-8601' : 'server-owned', Sensitivity: field === 'responseSnapshot' ? 'INTERNAL' : 'INTERNAL', Visibility: '服务端幂等恢复', ForbiddenExposure: '不返回归属字段或秘密；快照为白名单DTO', Validation: field === 'idempotencyKey' ? 'unique by companyId+consumerUserId+key' : 'server validated', HistoryRule: '触发器禁止更新删除', Stage: 'M3', P0: 'P0-052', Source: 'M3-P052技术实体', Status: 'IMPLEMENTED_M3_P052' })),
);
await upsertCsv('05-字段字典初始版.csv', ['Entity', 'Field'], baseFieldChanges);

await upsertCsv('06-状态机总表.csv', ['StateMachine', 'Event'], [{
  StateMachine: 'WelfareCardAccount', Event: 'BIND', Stage: 'M3', CurrentState: 'UNCLAIMED', NextState: 'ACTIVE', AllowedActor: 'CONSUMER_USER',
  Guard: '卡号/兑换码/扫码秘密摘要匹配；计划ACTIVE+APPROVED；批次ISSUED；卡码UNCLAIMED；协议版本一致；归属从会话派生',
  SideEffect: '原子领取卡码、创建唯一账户、追加CLAIM/CREDIT账本和不可变幂等命令', Idempotency: 'companyId+consumerUserId+Idempotency-Key；同键异体冲突',
  IllegalTransition: '稳定错误码；禁用/过期/冻结/重复/他人领取/错误秘密均零副作用', ConcurrencyControl: 'SERIALIZABLE重试+status/version条件更新+cardCodeId唯一键',
  History: 'WelfareCardLedger与WelfareCardBindingCommand触发器禁止更新删除', P0: 'P0-052', Status: 'IMPLEMENTED_M3_P052',
}]);

await upsertCsv('07-权限与数据可见矩阵.csv', ['OwnerType', 'RoleCode'], [{
  OwnerType: 'CONSUMER', RoleCode: 'CONSUMER_USER',
  ReadScope: '公开商品、自身购物车/订单/福利卡账户白名单/地址', WriteScope: '自身福利卡绑定、下单、支付、收货、售后、自身资料',
  DataScope: 'companyId与consumerUserId均从当前会话派生', ForbiddenActions: '不得提交归属字段；不得访问供应价、他人福利卡、明文卡密、个人充值/转账/提现',
  Stage: 'M3', P0: 'P0-020,P0-021,P0-052,P0-083,P0-098', Status: 'IMPLEMENTED_M3_P052_PARTIAL',
}]);

await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [
  { PageID: 'PAGE-062', ImplementationStatus: 'IMPLEMENTED_M3_P052_BINDING_ENTRY_PARTIAL', AcceptanceStatus: `P0-052_${evidenceStatus};P0-053_NOT_EXECUTED;P0-097_NOT_EXECUTED;DEVICE_NOT_EXECUTED`, RouteTest: 'apps/user-miniapp/test/welfare-card-binding-build.test.mjs|tests/e2e/p0/p0-052-welfare-card-binding.spec.ts', Notes: '福利卡首页绑定入口与加载/空态/错误/离线/成功状态已实现；账户选择、支付和真机验收未执行。' },
  { PageID: 'PAGE-064', ImplementationStatus: 'IMPLEMENTED_M3_P052', AcceptanceStatus: `P0-052_${evidenceStatus};P0-097_NOT_EXECUTED;DEVICE_NOT_EXECUTED`, RouteTest: 'apps/user-miniapp/test/welfare-card-binding-build.test.mjs|tests/e2e/p0/p0-052-welfare-card-binding.spec.ts', Notes: '卡号密码、兑换码、扫码解析、协议确认、幂等未知结果恢复和失败状态已实现；真实发行与真机扫码未执行。' },
]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [{
  EvidenceID: 'EVD-052', CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'RED API 3/3=404、迁移ENOENT、小程序3/3页面缺失；GREEN API 3/3、仓储4/4、迁移1/1、OpenAPI 1/1、小程序3/3、P0 Chromium 1/1；pnpm verify 17/17',
  Actual: '三种绑定方式契约、会话归属、秘密scrypt、重复/错误/禁用/过期/冻结/他人领取、并发、幂等恢复、唯一账户、CLAIM账本和DTO白名单通过。',
  Environment: 'LOCAL_WINDOWS_DOCKER_MYSQL_CHROMIUM', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; MySQL 8.4.11; Playwright Chromium',
  ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl, ArtifactOrScreenshot: 'docs/contracts/m3/M3-P052-welfare-card-binding.md|packages/db/prisma/migrations/20260816090000_m3_welfare_card_binding/migration.sql|artifacts/test-results/verification/pnpm-verify.json',
  Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_WORKTREE',
  FailureOrBlocker: 'EXT-012真实卡码发行资料未提供；真机扫码、staging/device/production未执行', RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES',
  Notes: '首轮仓储测试因dist未重建读取旧产物失败；API build后同组4/4通过。自动化证据不替代真实发行或真机验收。',
}]);

await upsertCsv('11-数据库迁移台账.csv', ['MigrationID'], [{
  MigrationID: 'MIG-014A', Stage: 'M3', PlannedName: '20260816090000_m3_welfare_card_binding', DependsOn: 'MIG-014',
  Objects: 'WelfareCardCode/WelfareCardAccount/WelfareCardLedger/WelfareCardBindingCommand', Purpose: '个人福利卡安全绑定、唯一账户、初始CLAIM账本与未知结果幂等恢复',
  ForwardSteps: '创建卡码摘要、账户、不可变CLAIM账本和绑定命令；约束整数金额、唯一领取、状态与来源；不创建个人充值或支付能力',
  BackwardOrRecovery: '未发布时回退提交并重建开发库；已发布后不回改迁移，应用版本回退并使用向前修复迁移', DataBackfill: 'NONE_NEW_TABLES_ONLY',
  Verification: 'Prisma validate；空库/升级/恢复/product drift dry-run；唯一键/check/不可变触发器；迁移与并发契约', BackupRequired: 'YES',
  Status: 'CREATED_LOCAL_REHEARSED_M3_P052', AppliedLocalAt: updatedAt, CommitSHA: commit,
  EvidenceLink: 'packages/db/prisma/migrations/20260816090000_m3_welfare_card_binding/migration.sql|tests/migrations/m3-p052-welfare-card-binding-migration.contract.test.mjs',
  Notes: '首次dry-run因本机MySQL停止而P1001失败；pnpm infra:up后empty=2/upgrade=2/restore=2/product=33/cleanup=PASS。staging/production未应用。',
}]);

await upsertCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], [{
  ContractID: 'API-038', Stage: 'M3', Domain: 'welfare-card', Method: 'POST', Path: '/v1/consumer/welfare-card-accounts/bind', Actor: 'CONSUMER',
  RequestDTO: 'WelfareCardBindRequestDto', ResponseDTO: 'WelfareCardAccountResponseDto', CommonResponse: '{success,data,error:{code,message,details?},requestId}',
  ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCOUNT_SUSPENDED|FIELD_FORBIDDEN|VALIDATION_FAILED|CARD_CODE_INVALID|CARD_ALREADY_CLAIMED|CARD_RECIPIENT_MISMATCH|IDEMPOTENCY_KEY_REQUIRED|IDEMPOTENCY_CONFLICT',
  Idempotency: 'Idempotency-Key scoped by session companyId+consumerUserId', SensitiveFieldPolicy: 'NEVER_RETURN_SECRET_OR_OWNER_FIELDS; companyId/consumerUserId derived from session; masked cardNo only; private/no-store/noindex',
  MoneyRule: 'integer cents only; binding creates equal CLAIM credit and account balance', P0: 'P0-052', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/welfare-card-binding-api.test.mjs|tests/openapi/m3-p052-welfare-card-binding.contract.test.mjs|packages/contracts/openapi.json', Owner: 'CODEX',
  Notes: '真实卡码发行和真机扫码未执行；P0-053账户选择、支付和退款不在API-038。',
}]);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: 'CI_PASS',
  Notes: `M3-P051由PR #100合并且main run ${p051MainRun}成功。M3-P052福利卡绑定${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；真实发行和真机扫码未执行；M3-P053及后续锁定。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const visit = (value) => {
  if (Array.isArray(value)) for (const item of value) visit(item);
  else if (value && typeof value === 'object') {
    if (value.pageId === 'PAGE-062') value.implementationStatus = 'IMPLEMENTED_M3_P052_BINDING_ENTRY_PARTIAL';
    if (value.pageId === 'PAGE-064' || value.contractId === 'API-038') value.implementationStatus = 'IMPLEMENTED_M3_P052';
    if (String(value.id ?? '').startsWith('NEG-M3-P052-')) value.executionStatus = evidenceStatus;
    for (const child of Object.values(value)) visit(child);
  }
};
visit(freeze);
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P052', nextAllowedTask: 'M3-P052', activeTaskCount: 1, lastCompletedTask: 'M3-P051', lastCompletedCommit: p051Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P052 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P053', 'EXT-012真实福利卡发行和真机扫码未完成；M4及后续保持锁定'] };
status.github = { ...status.github, pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: prUrl || null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt } : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  currentTaskDelivery: { taskId: 'M3-P052', issue: 101, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/101', branch: 'codex/m3-welfare-card-binding', baseCommit: p051Merge, verifiedHead: commit, status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR', localRedTest: 'API_3_OF_3_HTTP_404;MIGRATION_ENOENT;MINIAPP_3_OF_3_PAGES_MISSING', localFocusedTest: 'LOCAL_PASS_API_3_REPOSITORY_4_MIGRATION_1_OPENAPI_1_MINIAPP_3_P0_1', localFullVerify: fullVerify, pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'EXT-012_REAL_CARD_ISSUANCE_AND_DEVICE_SCAN', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P051', pullRequest: 100, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/100', exactHead: p051Head, mergeCommit: p051Merge, mainPostMergeCiRun: Number(p051MainRun), mainPostMergeCiJob: Number(p051MainJob), status: 'CI_PASS' },
  note: `M3-P052福利卡绑定${ciRun ? ' Draft PR精确head CI_PASS' : ' LOCAL_PASS'}；真实发行、真机扫码、staging/device/production未执行；M3-P053锁定。` };
status.evidence = { local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P052_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED', ci: ciRun ? `CI_PASS_M3_P052_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
status.counts = { ...status.counts, fields: Math.max(Number(status.counts?.fields ?? 0), 758), migrations: Math.max(Number(status.counts?.migrations ?? 0), 26) };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P052_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
