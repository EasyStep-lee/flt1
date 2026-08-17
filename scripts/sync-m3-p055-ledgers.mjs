import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/u, '').split('=');
  return [key, rest.join('=')];
}));
const root = process.cwd();
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const commit = args.commit || 'WORKTREE';
const evidenceStatus = args['evidence-status'] || 'LOCAL_PASS';
const fullVerify = args['full-verify'] || 'NOT_EXECUTED';
const pullRequest = args.pr || '';
const ciRun = args['ci-run'] || '';
const ciJob = args['ci-job'] || '';
const updatedAt = args['updated-at'] || new Date().toISOString();
const prUrl = pullRequest ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequest}` : '';
const ciUrl = ciRun ? `https://github.com/EasyStep-lee/flt1/actions/runs/${ciRun}` : '';
const p054Merge = 'b7cfd38383bedab10f6b4c894278d2cfc9b37715';
const p054MainRun = '31987603994';
const p054MainJob = '95265195156';

const parseLine = (line) => {
  const values = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value); value = ''; }
    else value += character;
  }
  if (quoted) throw new Error('CSV_UNTERMINATED_QUOTE');
  values.push(value); return values;
};
const encode = (value) => /[",\r\n]/u.test(String(value ?? '')) ? `"${String(value ?? '').replaceAll('"', '""')}"` : String(value ?? '');
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
    const index = byKey.get(keyOf(change));
    if (index === undefined) {
      const row = Object.fromEntries(headers.map((header) => [header, change[header] ?? '']));
      rows.push(row); byKey.set(keyOf(row), rows.length - 1);
    } else rows[index] = { ...rows[index], ...change };
  }
  const output = [headers.join(','), ...rows.map((row) => headers.map((header) => encode(row[header])).join(','))];
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P054', Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/105',
    Branch: 'codex/m3-welfare-card-scope-rules', CommitSHA: p054Merge, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/106', CI: 'CI_PASS', UpdatedAt: '2026-08-17T02:30:05Z',
    Notes: `PR #106经授权合并为 ${p054Merge.slice(0, 7)}；post-merge main Actions run ${p054MainRun}/job ${p054MainJob}成功。真实福利计划/商品、真机、staging/production未执行。`,
  },
  {
    TaskID: 'M3-P055', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/107',
    Branch: 'codex/m3-welfare-card-full-payment', CommitSHA: commit, PullRequest: prUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED API 4/4为404、小程序2项缺动作；GREEN仓储5/5、API 4/4、小程序6/6、迁移1/1、OpenAPI 1/1、P0 Chromium 1/1；迁移演练empty=2/upgrade=2/restore=2/product=34/cleanup=PASS。${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁待记录。'} 现金应付0且未创建PaymentTransaction/未调用微信。`,
  },
  { TaskID: 'M3-P056', Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: 'M3-P055 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。' },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  {
    P0ID: 'P0-054', CurrentEvidenceStatus: 'CI_PASS', EvidenceLink: `docs/contracts/m3/M3-P054-welfare-card-scope-rules.md|https://github.com/EasyStep-lee/flt1/pull/106|https://github.com/EasyStep-lee/flt1/actions/runs/${p054MainRun}`,
    LastVerifiedCommit: p054Merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-17T02:30:05Z', Notes: 'PR #106合并且post-merge main CI通过；自动化技术行为CI_PASS。真实计划/商品、真机、staging/production未执行。',
  },
  {
    P0ID: 'P0-055', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'apps/api/test/unit/prisma-welfare-card-payment-repository.test.mjs|apps/api/test/supertest/welfare-card-full-payment-api.test.mjs|apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/migrations/m3-p055-welfare-card-full-payment-migration.contract.test.mjs|tests/openapi/m3-p055-welfare-card-full-payment.contract.test.mjs|tests/e2e/p0/p0-055-welfare-card-full-payment.spec.ts',
    ManualCaseID: 'MANUAL-055_REAL_FUNDS_NOT_EXECUTED',
    NegativeChecks: '非法字段/UUID/幂等键零写；未登录/停用/跨用户拒绝；范围不适用/余额不足拒绝；同key改参冲突；并发重放一次扣款；晚期失败全事务回滚；零微信调用与零PaymentTransaction',
    EvidenceLink: `docs/contracts/m3/M3-P055-welfare-card-full-payment.md${prUrl ? `|${prUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
    LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
    Notes: '自动化证明福利卡全额支付原子与幂等；真实福利计划/资金、真机、staging/device/production未执行。P0-056混合支付未进入。',
  },
]);

await upsertCsv('05-字段字典初始版.csv', ['Entity', 'Field'], [
  ...['id','orderId','orderItemId','welfareCardAmount','cashAmount','allocationRuleVersion','createdAt'].map((Field) => ({ Entity: 'OrderPaymentAllocation', Field, Status: 'IMPLEMENTED_M3_P055' })),
  ...['id','accountId','orderId','refundId','businessType','direction','amount','beforeBalance','afterBalance','beforeFrozen','afterFrozen','idempotencyKey','occurredAt'].map((Field) => ({ Entity: 'WelfareCardLedger', Field, Status: 'IMPLEMENTED_M3_P055' })),
  ...[
    ['id','String(36)','UUID v4'], ['companyId','String(36)','session-derived company'], ['consumerUserId','String(36)','session-derived consumer'],
    ['orderId','String(36)','owned consumer order UUID'], ['accountId','String(36)','selected owned account UUID'], ['idempotencyKey','String(128)','Idempotency-Key'],
    ['requestHash','String(64)','SHA-256'], ['requestId','String(128)','request correlation id'], ['responseSnapshot','Json','private DTO snapshot'], ['createdAt','DateTime','UTC ISO-8601'],
  ].map(([Field, SuggestedType, UnitOrFormat], index) => ({
    Entity: 'WelfareCardPaymentCommand', Field, RawDefinition: Field, Position: String(index + 1), SuggestedType, Required: 'YES', UnitOrFormat,
    Sensitivity: 'FINANCIAL', Visibility: '公司财务与必要业务职能；消费者仅接收响应白名单', ForbiddenExposure: '不得返回owner/hash/request内部字段或供应价',
    Validation: 'server-owned identity; immutable idempotent command', HistoryRule: '追加不可变；禁止更新删除', Stage: 'M3', P0: 'P0-055', Source: '综合方案§9订单福利卡支付', Status: 'IMPLEMENTED_M3_P055',
  })),
]);

await upsertCsv('06-状态机总表.csv', ['StateMachine', 'CurrentState', 'Event'], [
  { StateMachine: 'WelfareCardAccount', CurrentState: 'ACTIVE', Event: 'FREEZE_ORDER_AMOUNT', Status: 'IMPLEMENTED_M3_P055' },
  { StateMachine: 'WelfareCardAccount', CurrentState: 'ACTIVE', Event: 'CAPTURE_ORDER_AMOUNT', Status: 'IMPLEMENTED_M3_P055' },
]);
await upsertCsv('07-权限与数据可见矩阵.csv', ['OwnerType', 'RoleCode'], [{
  OwnerType: 'CONSUMER', RoleCode: 'CONSUMER_USER',
  ReadScope: '公开商品、自身购物车/订单/福利卡账户白名单/地址；API-039资格与API-104支付仅本人订单和账户',
  WriteScope: '自身福利卡绑定、下单、福利卡全额支付、收货、售后、自身资料；API-104仅提交accountId',
  DataScope: 'companyId与consumerUserId从会话派生；订单金额/商品范围/余额/分摊/库存均服务端校验',
  ForbiddenActions: '不得提交归属、价格、配送费、抵扣/现金金额、范围规则；不得访问完整卡号、供应价、他人账户；不得个人充值；P055不得触发微信',
  Stage: 'M3', P0: 'P0-020,P0-021,P0-052,P0-053,P0-054,P0-055,P0-083,P0-092,P0-098', Status: 'IMPLEMENTED_M3_P055_PARTIAL',
}]);
await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [{
  PageID: 'PAGE-056', ImplementationStatus: 'IMPLEMENTED_M3_P055_FULL_WELFARE_PAYMENT_PARTIAL', AcceptanceStatus: `P0-053_CI_PASS;P0-054_CI_PASS;P0-055_${evidenceStatus};P0-091_PARTIAL;P0-092_PARTIAL_${evidenceStatus};DEVICE_NOT_EXECUTED`,
  RouteTest: 'apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/e2e/p0/p0-053-welfare-card-account-selection.spec.ts|tests/e2e/p0/p0-055-welfare-card-full-payment.spec.ts',
  Notes: '已接福利卡全额支付、未知结果同key重试和部分覆盖禁发；无微信/混合支付/退款；完整确认订单、真机与真实资金未执行。',
}]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [{
  EvidenceID: 'EVD-055', P0ID: 'P0-055', Stage: 'M3', TaskID: 'M3-P055', EvidenceType: 'AUTOMATED_TRANSACTION_API_MINIAPP_MIGRATION_OPENAPI_E2E', RequiredLevel: 'CI_PASS', CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'RED API 4/4 404 + miniapp 2 missing action; GREEN repository 5/5, API 4/4, miniapp 6/6, migration 1/1, OpenAPI 1/1, P0 Chromium 1/1; prisma migration rehearsal empty=2/upgrade=2/restore=2/product=34/cleanup=PASS; pnpm verify',
  Expected: '现金应付0；冻结转实扣、账本、分摊、订单PAID、库存确认、履约激活、outbox同一幂等事务；零微信/PaymentTransaction；失败全回滚',
  Actual: '正常、越权、范围、余额、幂等改参、并发重放、未知结果、晚期失败回滚、DTO隔离和永久无个人充值边界均有自动化行为证据。',
  Environment: 'LOCAL_WINDOWS_MYSQL8_CHROMIUM', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; MySQL 8; Playwright Chromium', ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P055-welfare-card-full-payment.md|artifacts/verification/M3-P055/welfare-card-full-payment.json|artifacts/test-results/verification/pnpm-verify.json',
  Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_WORKTREE', FailureOrBlocker: '真实福利计划/资金、真机、staging/device/production未执行；混合支付属于M3-P056', RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES', Notes: 'MIG-015向前迁移；回滚应用版本并以向前修复迁移处理已发布环境。',
}]);

await upsertCsv('11-数据库迁移台账.csv', ['MigrationID'], [{
  MigrationID: 'MIG-015', Stage: 'M3', PlannedName: '20260817030000_m3_welfare_card_full_payment', DependsOn: 'MIG-014', Objects: 'WelfareCardLedger constraint/guard; WelfareCardPaymentCommand',
  Purpose: '允许严格FREEZE/CAPTURE账本形状并保存每订单唯一、按消费者幂等域的不可变全额支付命令', ForwardSteps: '扩展账本check/余额触发器；新增支付命令表、唯一键、外键与不可变触发器；不创建PaymentTransaction',
  BackwardOrRecovery: '未发布时回退提交并重建开发库；已发布后回退应用版本并使用向前修复迁移，不删除财务账本/命令', DataBackfill: 'NONE_NEW_COMMANDS_ONLY',
  Verification: 'Prisma validate；empty/upgrade/restore/product drift dry-run；账本check/命令不可变；仓储并发与失败回滚测试', BackupRequired: 'YES', Status: 'CREATED_LOCAL_REHEARSED_M3_P055', AppliedLocalAt: updatedAt, CommitSHA: commit,
  EvidenceLink: 'packages/db/prisma/migrations/20260817030000_m3_welfare_card_full_payment/migration.sql|tests/migrations/m3-p055-welfare-card-full-payment-migration.contract.test.mjs', Notes: 'empty=2/upgrade=2/restore=2/product=34/cleanup=PASS；staging/production未应用。',
}]);
await upsertCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], [{
  ContractID: 'API-104', Stage: 'M3', Domain: 'welfare-card-payment', Method: 'POST', Path: '/v1/consumer/orders/{orderId}/welfare-card-full-payment', Actor: 'CONSUMER', RequestDTO: 'WelfareCardFullPaymentRequestDto', ResponseDTO: 'WelfareCardFullPaymentResponseDto', CommonResponse: '显式白名单DTO；private/no-store；noindex',
  ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCOUNT_SUSPENDED|FIELD_FORBIDDEN|VALIDATION_FAILED|IDEMPOTENCY_KEY_REQUIRED|ORDER_NOT_FOUND|ACCESS_DENIED|WELFARE_CARD_NOT_ELIGIBLE|WELFARE_CARD_INSUFFICIENT_BALANCE|PAYMENT_IDEMPOTENCY_CONFLICT|PAYMENT_STATE_INVALID|PAYMENT_CONCURRENT_CONFLICT',
  Idempotency: 'Idempotency-Key scoped by session companyId+consumerUserId; unique successful command per order', SensitiveFieldPolicy: 'NEVER_RETURN supplyPrice/account owner/full card/config/secret; SESSION_OWNER_DERIVED; request only accountId; no public cache',
  MoneyRule: 'integer cents; server-owned total; only full coverage; cashAmount=0; atomic FREEZE then CAPTURE; no PaymentTransaction or external adapter', P0: 'P0-055,P0-059,P0-092', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/welfare-card-full-payment-api.test.mjs|tests/openapi/m3-p055-welfare-card-full-payment.contract.test.mjs|packages/contracts/openapi.json', Owner: 'CODEX', Notes: '任务内契约细化：混合支付、取消/解冻、退款和真实资金不在P055。',
}]);
await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P054 PR #106合并且main run ${p054MainRun}成功。M3-P055福利卡全额支付${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；真实资金/真机/staging/production未执行；M3-P056及后续锁定。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const completedNegativeEvidence = new Map([
  ['M3-P031', 'CI_PASS'],
  ['M3-P051', 'CI_PASS'],
  ['M3-P052', 'LOCAL_PASS'],
  ['M3-P053', 'LOCAL_PASS'],
  ['M3-P054', 'CI_PASS'],
  ['M3-P055', evidenceStatus],
]);
const visit = (value) => {
  if (Array.isArray(value)) for (const item of value) visit(item);
  else if (value && typeof value === 'object') {
    if (value.pageId === 'PAGE-056') value.implementationStatus = 'IMPLEMENTED_M3_P055_FULL_WELFARE_PAYMENT_PARTIAL';
    if (completedNegativeEvidence.has(value.taskId)) value.executionStatus = completedNegativeEvidence.get(value.taskId);
    for (const child of Object.values(value)) visit(child);
  }
};
visit(freeze);
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P055', nextAllowedTask: 'M3-P055', activeTaskCount: 1, lastCompletedTask: 'M3-P054', lastCompletedCommit: p054Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P055 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P056', '真实福利计划/资金/真机/staging/production未完成；M4及后续保持锁定'] };
status.github = { ...status.github,
  pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: prUrl || null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null,
  lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt } : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  currentTaskDelivery: { taskId: 'M3-P055', issue: 107, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/107', branch: 'codex/m3-welfare-card-full-payment', baseCommit: p054Merge, verifiedHead: commit, status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR', localRedTest: 'API_4_OF_4_404;MINIAPP_2_PAYMENT_ACTION_MISSING', localFocusedTest: 'LOCAL_PASS_REPOSITORY_5_API_4_MINIAPP_6_MIGRATION_1_OPENAPI_1_P0_1', localFullVerify: fullVerify, pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'REAL_WELFARE_PROGRAM_FUNDS_AND_DEVICE', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P054', pullRequest: 106, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/106', exactHead: '0b6e9c63a474a39092d5151aac268acd3b478714', mergeCommit: p054Merge, mainPostMergeCiRun: Number(p054MainRun), mainPostMergeCiJob: Number(p054MainJob), status: 'CI_PASS' },
  note: `M3-P055福利卡全额支付${ciRun ? ' Draft PR精确head CI_PASS' : ' LOCAL_PASS'}；真实资金/真机/staging/device/production未执行；M3-P056锁定。`,
};
status.evidence = { local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P055_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED', ci: ciRun ? `CI_PASS_M3_P055_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P055');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'welfare-card-full-payment.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P055', p0: ['P0-055', 'P0-059_PARTIAL', 'P0-092_PARTIAL'], status: evidenceStatus,
  commit, updatedAt, baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  scope: 'atomic idempotent full welfare-card payment with zero external payable',
  red: ['API_4_OF_4_ROUTE_404', 'MINIAPP_2_OF_2_PAYMENT_ACTION_MISSING'], focused: ['REPOSITORY_5_OF_5', 'API_4_OF_4', 'MINIAPP_6_OF_6', 'MIGRATION_1_OF_1', 'OPENAPI_1_OF_1', 'P0_CHROMIUM_1_OF_1'],
  fullVerify, migrationRehearsal: 'empty=2;upgrade=2;restore=2;product=34;cleanup=PASS',
  invariants: { cashAmount: 0, wechatAdapterCalls: 0, paymentTransactionsCreated: 0, freezeLedger: 1, captureLedger: 1, appendOnly: true, atomicRollback: true },
  boundaries: { realFunds: 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED', mixedPayment: 'OUT_OF_SCOPE_M3_P056' },
  github: { issue: 107, pullRequest: pullRequest ? Number(pullRequest) : null, ciRun: ciRun ? Number(ciRun) : null },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P055_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
