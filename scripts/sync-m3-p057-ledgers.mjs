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
const updatedAt = args['updated-at'] || new Date().toISOString();
const pullRequestNumber = Number(args['pull-request'] || 0) || null;
const pullRequestUrl = pullRequestNumber ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequestNumber}` : '';
const pullRequestState = pullRequestNumber ? 'DRAFT' : 'NOT_CREATED';
const pullRequestCi = args['pr-ci'] || 'NOT_EXECUTED';
const p056Merge = '0aec3095150ff713d5805fc51b7f1d7e0e6920e6';
const p056MainRun = '32009415143';
const p056MainJob = '95325570638';

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
    if (index === undefined) rows.push(Object.fromEntries(headers.map((header) => [header, change[header] ?? ''])));
    else rows[index] = { ...rows[index], ...change };
  }
  await writeFile(filePath, `${[headers.join(','), ...rows.map((row) => headers.map((header) => encode(row[header])).join(','))].join(eol)}${eol}`, 'utf8');
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P056', Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX', Branch: 'codex/m3-welfare-card-mixed-payment',
    CommitSHA: p056Merge, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/110', CI: 'CI_PASS', UpdatedAt: '2026-08-17T08:25:59Z',
    Notes: `PR #110精确head 3e81a84ebf7b6b6a02f822fbdc164c5448df05d2经授权合并为${p056Merge.slice(0, 7)}；post-merge main run ${p056MainRun}/job ${p056MainJob}成功。`,
  },
  {
    TaskID: 'M3-P057', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/111',
    Branch: 'codex/m3-mixed-payment-cancel-release', CommitSHA: commit, PullRequest: pullRequestUrl, CI: pullRequestCi, UpdatedAt: updatedAt,
    Notes: `RED API 5/5路由404、小程序1项缺恢复动作；GREEN API 5/5、仓储3/3、小程序8/8、OpenAPI 2/2。服务端先查微信；NOTPAY成功关单或CLOSED/PAYERROR才原子释放；UNKNOWN/USERPAYING零释放。${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁待记录。'}真实微信/staging/真机未执行。`,
  },
  { TaskID: 'M3-P058', Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: 'M3-P057 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。' },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  { P0ID: 'P0-056', CurrentEvidenceStatus: 'CI_PASS', EvidenceLink: `docs/contracts/m3/M3-P056-welfare-card-wechat-payment.md|https://github.com/EasyStep-lee/flt1/pull/110|https://github.com/EasyStep-lee/flt1/actions/runs/${p056MainRun}`, LastVerifiedCommit: p056Merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-17T08:25:59Z', Notes: 'PR #110合并且post-merge main CI通过；真实资金/真机/staging/production仍未执行。' },
  {
    P0ID: 'P0-057', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'apps/api/test/supertest/welfare-card-wechat-cancel-api.test.mjs|apps/api/test/unit/prisma-mixed-payment-cancellation.test.mjs|apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/openapi/m3-p057-welfare-card-wechat-cancellation.contract.test.mjs|tests/e2e/p0/p0-057-welfare-card-wechat-cancellation.spec.ts',
    ManualCaseID: 'MANUAL-057_REAL_WECHAT_STAGING_DEVICE_NOT_EXECUTED',
    NegativeChecks: '乱序已支付查询走确认链不释放；跨用户/归属字段拒绝；同key改参冲突；USERPAYING/UNKNOWN/查询或关单失败零释放；重复取消只释放一次；晚期审计失败整事务回滚',
    EvidenceLink: 'docs/contracts/m3/M3-P057-welfare-card-wechat-cancellation.md', LastVerifiedCommit: commit, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: '确定性适配器下技术行为LOCAL_PASS；RequiredEvidenceLevel为STAGING_PASS，真实微信/staging/device/production未执行。',
  },
]);

await upsertCsv('06-状态机总表.csv', ['StateMachine', 'CurrentState', 'Event'], [
  { StateMachine: 'PaymentTransaction', CurrentState: 'PREPAY_CREATED', Event: 'QUERY_UNKNOWN', NextState: 'UNKNOWN', Guard: '微信查询为USERPAYING/未知/超时；不得释放福利卡或库存', SideEffects: '追加PAYMENT_UNKNOWN订单事件与查询快照；资金和库存保持冻结', Status: 'IMPLEMENTED_M3_P057', P0: 'P0-057' },
  { StateMachine: 'PaymentTransaction', CurrentState: 'UNKNOWN', Event: 'QUERY_PAID', NextState: 'PAID', Guard: '主动查询返回可信SUCCESS且金额/商户/订单匹配', SideEffects: '复用支付确认事务；不得释放', Status: 'IMPLEMENTED_M3_P057', P0: 'P0-057' },
  { StateMachine: 'PaymentTransaction', CurrentState: 'UNKNOWN', Event: 'QUERY_CLOSED', NextState: 'CLOSED', Guard: '微信明确CLOSED/PAYERROR或NOTPAY后关单成功', SideEffects: '原子释放福利卡冻结和全SKU预留；取消履约；追加事件', Status: 'IMPLEMENTED_M3_P057', P0: 'P0-057' },
  { StateMachine: 'WelfareCardAccount', CurrentState: 'ACTIVE', Event: 'RELEASE_ORDER_AMOUNT', NextState: 'ACTIVE', Guard: '微信明确未支付并已关单；冻结额充足；幂等键唯一', SideEffects: '只减frozenAmount；balanceAmount不变；追加RELEASE/CREDIT账本', Status: 'IMPLEMENTED_M3_P057', P0: 'P0-057,P0-059' },
]);

await upsertCsv('07-权限与数据可见矩阵.csv', ['OwnerType', 'RoleCode'], [{
  OwnerType: 'CONSUMER', RoleCode: 'CONSUMER_USER',
  ReadScope: '公开商品、自身购物车/订单/福利卡账户白名单/地址；API-106仅查询本人订单支付取消结果',
  WriteScope: '自身福利卡绑定、下单、支付及API-106取消/超时恢复；服务端查询微信后决定确认、保持未知或释放',
  DataScope: 'companyId与consumerUserId从会话派生；微信商户配置、金额、归属、福利余额和库存均服务端派生',
  ForbiddenActions: '不得提交归属/金额/账户/商户配置；不得在未知状态重复预支付；不得客户端直接释放；不得访问供应价或他人订单',
  Stage: 'M3', P0: 'P0-024,P0-056,P0-057,P0-059,P0-093,P0-098', Status: 'IMPLEMENTED_M3_P057_PARTIAL',
}]);

await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [{
  PageID: 'PAGE-056', ImplementationStatus: 'IMPLEMENTED_M3_P057_MIXED_PAYMENT_CANCEL_RECOVERY_PARTIAL',
  AcceptanceStatus: `P0-053_CI_PASS;P0-054_CI_PASS;P0-055_CI_PASS;P0-056_CI_PASS;P0-057_${evidenceStatus};P0-093_PARTIAL;DEVICE_NOT_EXECUTED`,
  RouteTest: 'apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/e2e/p0/p0-056-welfare-card-wechat-payment.spec.ts|tests/e2e/p0/p0-057-welfare-card-wechat-cancellation.spec.ts',
  Notes: '未知结果按钮调用API-106查询式恢复，不创建第二笔预支付且不再次调用wx.requestPayment；未知时明确提示资金/库存尚未释放。',
}]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [{
  EvidenceID: 'EVD-057', P0ID: 'P0-057', Stage: 'M3', TaskID: 'M3-P057', EvidenceType: 'AUTOMATED_QUERY_CLOSE_ATOMIC_RELEASE_API_MINIAPP_OPENAPI_E2E', RequiredLevel: 'STAGING_PASS', CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'RED API 5/5 404 + miniapp恢复动作缺失；GREEN API 5/5、repository 3/3、miniapp 8/8、OpenAPI 2/2、P0 Chromium 1/1；Prisma validate/migrate dry-run；pnpm verify',
  Expected: '服务端先查微信；明确未支付且关单成功才释放福利卡冻结与全部库存；未知零释放；已支付走确认链；重复/并发/晚期失败不产生部分副作用',
  Actual: '查询/关单分支、归属/幂等、乱序已支付、UNKNOWN零释放、原子释放、重复取消、晚期失败回滚和小程序不重复支付均有自动化证据。',
  Environment: 'LOCAL_WINDOWS_MYSQL8_CHROMIUM_DETERMINISTIC_WECHAT_ADAPTER', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; MySQL 8; Playwright Chromium', ExecutedAt: updatedAt, CommitSHA: commit,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P057-welfare-card-wechat-cancellation.md|artifacts/verification/M3-P057/welfare-card-wechat-cancellation.json|artifacts/test-results/verification/pnpm-verify.json',
  Executor: 'CODEX', Freshness: 'FRESH_LOCAL_WORKTREE', FailureOrBlocker: '真实微信商户查询/关单、staging、真机和真实资金未执行；退款属于P058', RetestRequired: 'YES', Notes: 'MIG-012C仅扩展追加式订单支付事件枚举与生命周期约束；不新增支付通道或个人充值。',
}]);

await upsertCsv('11-数据库迁移台账.csv', ['MigrationID'], [{
  MigrationID: 'MIG-012C', Stage: 'M3', MigrationFile: '20260817090000_m3_mixed_payment_cancellation', DependsOn: 'MIG-012B',
  Models: 'BuyerOrderEventType/事件生命周期CHECK', Purpose: '支付未知与混合支付取消的追加审计事件',
  ForwardStrategy: '扩展buyer_order_event.event枚举并重建生命周期CHECK；不回填、不覆盖历史事件', RollbackStrategy: '未发布时回退提交并重建开发库；已发布后应用版本回退并以向前修复迁移处理',
  Backfill: 'NONE', Validation: 'Prisma validate；空库/升级/恢复/product drift dry-run；事件约束与事务行为测试', Required: 'YES', Status: 'CREATED_LOCAL_REHEARSED_M3_P057', AppliedAt: updatedAt, CommitSHA: commit,
  Evidence: 'packages/db/prisma/migrations/20260817090000_m3_mixed_payment_cancellation/migration.sql|apps/api/test/unit/prisma-mixed-payment-cancellation.test.mjs',
  Notes: 'empty=2/upgrade=2/restore=2/product=35/cleanup=PASS；staging/production未应用；已发布迁移禁止回改。',
}]);

await upsertCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], [{
  ContractID: 'API-106', Stage: 'M3', Domain: 'welfare-card-payment', Method: 'POST', Path: '/v1/consumer/orders/{orderId}/welfare-card-wechat-payment/cancel', Actor: 'CONSUMER', RequestDTO: 'WelfareCardWechatCancellationRequestDto', ResponseDTO: 'WelfareCardWechatCancellationResponseDto', CommonResponse: '显式白名单DTO；private/no-store；noindex',
  ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCOUNT_SUSPENDED|FIELD_FORBIDDEN|VALIDATION_FAILED|IDEMPOTENCY_KEY_REQUIRED|ORDER_NOT_FOUND|ACCESS_DENIED|PAYMENT_IDEMPOTENCY_CONFLICT|PAYMENT_STATE_INVALID|PAYMENT_CONCURRENT_CONFLICT|PAYMENT_AMOUNT_MISMATCH',
  Idempotency: 'Idempotency-Key plus PaymentAttempt(transaction,key)；未知可同key重复查询；终态重放不重复释放', SensitiveFieldPolicy: 'NEVER_RETURN accountId/balance/owner/config/supplyPrice/secret；SESSION_OWNER_DERIVED；request only reason；no public cache',
  MoneyRule: 'integer cents；UNKNOWN零释放；明确未支付且关单成功后只减冻结不减余额并释放全部SKU预留；PAID复用原确认链', P0: 'P0-024,P0-057,P0-059,P0-093', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/welfare-card-wechat-cancel-api.test.mjs|tests/openapi/m3-p057-welfare-card-wechat-cancellation.contract.test.mjs|packages/contracts/openapi.json', Owner: 'CODEX', Notes: '任务内契约细化：真实微信查询/关单适配器配置与staging/真机证据仍为外部门禁。',
}]);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P056 PR #110合并且main run ${p056MainRun}成功。M3-P057混合支付取消/未知恢复为${evidenceStatus}；RequiredEvidenceLevel仍需staging/真实微信；P058及M4以后锁定。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const visit = (value) => {
  if (Array.isArray(value)) for (const item of value) visit(item);
  else if (value && typeof value === 'object') {
    if (value.pageId === 'PAGE-056') value.implementationStatus = 'IMPLEMENTED_M3_P057_MIXED_PAYMENT_CANCEL_RECOVERY_PARTIAL';
    if (value.taskId === 'M3-P056') value.executionStatus = 'CI_PASS';
    if (value.taskId === 'M3-P057') value.executionStatus = evidenceStatus;
    for (const child of Object.values(value)) visit(child);
  }
};
visit(freeze);
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P057', nextAllowedTask: 'M3-P057', activeTaskCount: 1, lastCompletedTask: 'M3-P056', lastCompletedCommit: p056Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P057 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P058', '真实微信/staging/真机/真实资金未完成；M4及后续保持锁定'] };
status.github = { ...status.github, pullRequest: pullRequestNumber, pullRequestUrl: pullRequestUrl || null, pullRequestState, pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: pullRequestCi, runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: { scope: 'M3_P056_POST_MERGE_MAIN', status: 'CI_PASS', runId: Number(p056MainRun), jobId: Number(p056MainJob), runUrl: `https://github.com/EasyStep-lee/flt1/actions/runs/${p056MainRun}`, headSha: p056Merge, event: 'push', completedAt: '2026-08-17T08:25:59Z' },
  currentTaskDelivery: { taskId: 'M3-P057', issue: 111, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/111', branch: 'codex/m3-mixed-payment-cancel-release', baseCommit: p056Merge, verifiedHead: commit, status: pullRequestNumber ? 'DRAFT_PR_CI_PENDING' : 'LOCAL_PASS_PENDING_DRAFT_PR', localRedTest: 'API_5_OF_5_404;MINIAPP_RECOVERY_ACTION_MISSING', localFocusedTest: 'LOCAL_PASS_API_5_REPOSITORY_3_MINIAPP_8_OPENAPI_2_P0_1', localFullVerify: fullVerify, pullRequest: pullRequestNumber, pullRequestState, exactHeadCi: pullRequestCi, review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'REAL_WECHAT_QUERY_CLOSE_STAGING_DEVICE', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P056', pullRequest: 110, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/110', exactHead: '3e81a84ebf7b6b6a02f822fbdc164c5448df05d2', mergeCommit: p056Merge, mainPostMergeCiRun: Number(p056MainRun), mainPostMergeCiJob: Number(p056MainJob), status: 'CI_PASS' },
  note: 'M3-P057混合支付取消与未知恢复LOCAL_PASS；真实微信查询/关单、staging/device/production未执行；P058锁定。' };
status.evidence = { local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P057_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED', ci: 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
status.counts = { ...status.counts, migrations: 27, apiContracts: 106 };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P057');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'welfare-card-wechat-cancellation.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P057', p0: ['P0-057', 'P0-024_PARTIAL', 'P0-059_PARTIAL', 'P0-093_PARTIAL'], status: evidenceStatus,
  commit, updatedAt, baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  red: ['API_5_OF_5_ROUTE_404', 'MINIAPP_UNKNOWN_RECOVERY_ACTION_MISSING'], focused: ['API_5_OF_5', 'REPOSITORY_3_OF_3', 'MINIAPP_8_OF_8', 'OPENAPI_2_OF_2', 'P0_CHROMIUM_1_OF_1'], fullVerify,
  invariants: { queryBeforeRelease: true, unknownNeverReleases: true, explicitNotPaidRequiresClose: true, queriedPaidUsesConfirmationChain: true, welfareReleaseAppendOnly: true, inventoryReleaseAtomic: true, duplicateSkuLinesAggregated: true, duplicateCancellationSideEffectFree: true, lateFailureAtomicRollback: true, miniappNoSecondPrepayOrRequestPayment: true },
  boundaries: { realWechatQueryClose: 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED', refund: 'OUT_OF_SCOPE_M3_P058' },
  github: { issue: 111, pullRequest: pullRequestNumber, pullRequestState, ciStatus: pullRequestCi, ciRun: null },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P057_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
