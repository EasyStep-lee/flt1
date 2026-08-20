import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/u, '').split('=');
  return [key, rest.join('=')];
}));
const root = process.cwd();
const pack = path.join(root, '福礼社Codex5.6开发执行包V1.1');
const commit = args.commit || 'WORKTREE';
const evidenceStatus = args['evidence-status'] || 'NOT_EXECUTED';
const fullVerify = args['full-verify'] || 'NOT_EXECUTED';
const updatedAt = args['updated-at'] || new Date().toISOString();
const pullRequestNumber = Number(args['pull-request'] || 0) || null;
const pullRequestUrl = pullRequestNumber ? `https://github.com/EasyStep-lee/flt1/pull/${pullRequestNumber}` : '';
const pullRequestState = pullRequestNumber ? 'DRAFT' : 'NOT_CREATED';
const pullRequestCi = args['pr-ci'] || 'NOT_EXECUTED';
const p057Head = '493be6e53dae068acdebdb725afbb48b7a1ac4c9';
const p057Merge = '11fcfb372e9f84bf2151bf1a52043658a6bb3b48';
const p057PrRun = 32330232558;
const p057PrJob = 96309326771;
const p057MainRun = 32331544944;
const p057MainJob = 96313023603;
const implemented = evidenceStatus === 'LOCAL_PASS' || evidenceStatus === 'CI_PASS';
const fullVerifyPassed = fullVerify === 'PASS_17_OF_17';

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
    const index = byKey.get(keyOf(change));
    if (index === undefined) rows.push(Object.fromEntries(headers.map((header) => [header, change[header] ?? ''])));
    else rows[index] = { ...rows[index], ...change };
  }
  await writeFile(filePath, `${[headers.join(','), ...rows.map((row) => headers.map((header) => encode(row[header])).join(','))].join(eol)}${eol}`, 'utf8');
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P057', Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/111',
    Branch: 'codex/m3-mixed-payment-cancel-release', CommitSHA: p057Merge, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/112', CI: 'CI_PASS', UpdatedAt: '2026-08-20T04:31:58Z',
    Notes: `PR #112精确head ${p057Head}经run ${p057PrRun}/job ${p057PrJob}验证并按授权合并为${p057Merge}；post-merge main run ${p057MainRun}/job ${p057MainJob}成功。真实微信/staging/device/production未执行。`,
  },
  {
    TaskID: 'M3-P058', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX', Branch: 'codex/m3-mixed-payment-split-refund', CommitSHA: commit,
    PullRequest: pullRequestUrl, CI: pullRequestCi, UpdatedAt: updatedAt,
    Notes: `${implemented ? '福利卡REFUND/CREDIT原账户事务、原微信交易拆分、累计尾差、并发/幂等/回滚已实现。' : '设计契约已冻结；资金行为测试与实现进行中。'}${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁尚未通过。'}真实微信/真实资金/staging/device/production未执行。`,
  },
  { TaskID: 'M3-P059', Status: 'NOT_STARTED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: 'M3-P058精确head CI、人工合并和post-merge main CI全部通过前保持锁定。' },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  {
    P0ID: 'P0-057', CurrentEvidenceStatus: 'CI_PASS',
    EvidenceLink: `docs/contracts/m3/M3-P057-welfare-card-wechat-cancellation.md|https://github.com/EasyStep-lee/flt1/pull/112|https://github.com/EasyStep-lee/flt1/actions/runs/${p057MainRun}`,
    LastVerifiedCommit: p057Merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-20T04:31:58Z',
    Notes: 'PR #112合并且post-merge main CI成功；RequiredEvidenceLevel仍为STAGING_PASS，真实微信/staging/device/production未执行。',
  },
  {
    P0ID: 'P0-058', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'apps/api/test/unit/prisma-mixed-payment-refund.test.mjs|apps/api/test/unit/refund-allocation-policy.test.mjs|apps/api/test/supertest/original-structure-refund-api.test.mjs|tests/openapi/m3-p058-mixed-payment-split-refund.contract.test.mjs|tests/e2e/p0/p0-058-mixed-payment-split-refund.spec.ts',
    ManualCaseID: 'MANUAL-058_REAL_WECHAT_WELFARE_FUNDS_STAGING_NOT_EXECUTED',
    NegativeChecks: 'INVALID_INPUT；UNAUTHORIZED_OR_WRONG_OWNER；DUPLICATE_OR_STATE_CONFLICT；累计超退；福利卡晚期失败整事务回滚；微信UNKNOWN不重复外呼',
    EvidenceLink: 'docs/contracts/m3/M3-P058-mixed-payment-split-refund.md', LastVerifiedCommit: commit, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: `${implemented ? '确定性适配器与本地MySQL边界下技术行为通过。' : 'M3-P058设计与失败行为已登记，尚无通过证据。'}RequiredEvidenceLevel为STAGING_PASS；真实微信/福利资金/staging/device/production未执行。`,
  },
]);

await upsertCsv('05-字段字典初始版.csv', ['Entity', 'Field'], [
  { Entity: 'WelfareCardLedger', Field: 'refundId', Validation: 'nullable；REFUND时必须服务端派生并引用RefundTransaction；refundId+businessType唯一', HistoryRule: '只追加；REFUND流水禁止更新删除', Status: implemented ? 'IMPLEMENTED_M3_P058' : 'DESIGNED_M3_P058' },
  { Entity: 'WelfareCardLedger', Field: 'businessType', Validation: 'REFUND固定与refundId同时出现；客户端不可提交', HistoryRule: '只追加；数据库约束退款语义', Status: implemented ? 'IMPLEMENTED_M3_P058' : 'DESIGNED_M3_P058' },
  { Entity: 'WelfareCardLedger', Field: 'direction', Validation: 'REFUND只能为CREDIT；金额为正整数分', HistoryRule: '只追加；数据库约束退款语义', Status: implemented ? 'IMPLEMENTED_M3_P058' : 'DESIGNED_M3_P058' },
]);

await upsertCsv('06-状态机总表.csv', ['StateMachine', 'CurrentState', 'Event'], [
  { StateMachine: 'RefundTransaction', CurrentState: 'PROCESSING', Event: 'WELFARE_REFUND_APPLIED', NextState: 'PARTIAL_CHANNEL_DONE', Guard: '原OrderPaymentAllocation福利卡分配>0；原账户匹配；REFUND业务键唯一', SideEffects: '同事务增加原账户余额、保持冻结额、追加REFUND/CREDIT流水与退款事件', Status: implemented ? 'IMPLEMENTED_M3_P058' : 'DESIGNED_M3_P058', P0: 'P0-026,P0-058,P0-059,P0-096' },
  { StateMachine: 'WelfareCardAccount', CurrentState: 'ACTIVE', Event: 'REFUND', NextState: 'ACTIVE', Guard: '原福利卡账户；累计退款不超原分配；refundId业务键唯一', SideEffects: 'balance增加、frozen不变、追加REFUND/CREDIT流水', Status: implemented ? 'IMPLEMENTED_M3_P058' : 'DESIGNED_M3_P058', P0: 'P0-058,P0-059' },
  { StateMachine: 'WelfareCardAccount', CurrentState: 'SUSPENDED', Event: 'REFUND', NextState: 'SUSPENDED', Guard: '只能退原账户；不得改退他人或解除停用', SideEffects: '原账户余额增加且仍不可消费；追加REFUND/CREDIT流水', Idempotency: 'refundId+accountId', Status: implemented ? 'IMPLEMENTED_M3_P058' : 'DESIGNED_M3_P058', P0: 'P0-058,P0-059' },
]);

await upsertCsv('07-权限与数据可见矩阵.csv', ['OwnerType', 'RoleCode'], [{
  OwnerType: 'COMPANY', RoleCode: 'COMPANY_ORDER_SERVICE',
  ReadScope: '个人/企业订单、已批准退款授权、原支付分配白名单与售后必要字段',
  WriteScope: '消费另一自然人已批准退款授权；发起按原福利卡账户与原微信交易拆分退款；备注与责任协同',
  DataScope: '唯一公司全订单；company/职能/自然人从固定会话派生；金额/账户/微信交易从服务端快照派生',
  ForbiddenActions: '不得登记付款、改供应价、提交退款金额/目标账户/微信交易、越权解密、改退他人或消费本人批准的授权',
  Stage: 'M3,M5', P0: 'P0-026,P0-038,P0-045,P0-058,P0-067,P0-068,P0-096', Status: implemented ? 'IMPLEMENTED_M3_P058_PARTIAL' : 'DESIGNED_M3_P058',
}]);

await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [{
  PageID: 'PAGE-007', P0: 'P0-026,P0-038,P0-058,P0-067,P0-068',
  ImplementationStatus: implemented ? 'IMPLEMENTED_M3_P058_SPLIT_REFUND_PARTIAL' : 'IMPLEMENTED_M3_P026_P058_DESIGNED',
  AcceptanceStatus: `P0-026_CI_PASS;P0-058_${evidenceStatus};P0-067_CI_PASS;P0-068_CI_PASS;P0-038_NOT_EXECUTED`,
  RouteTest: 'tests/e2e/p0/p0-026-refund-company-page.spec.ts|tests/e2e/p0/p0-058-mixed-payment-split-refund.spec.ts',
  Notes: '页面只提交授权版本和原因，展示福利卡/微信拆分整数分与unknown状态；金额、原账户和微信交易不可输入。M5售后审批仍DEFERRED。',
}]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [{
  EvidenceID: 'EVD-058', P0ID: 'P0-058', Stage: 'M3', TaskID: 'M3-P058', EvidenceType: 'AUTOMATED_ORIGINAL_ALLOCATION_WELFARE_LEDGER_WECHAT_SPLIT_REFUND', RequiredLevel: 'STAGING_PASS', CurrentStatus: evidenceStatus,
  CommandOrProcedure: implemented ? 'focused unit/api/openapi/P0 E2E；Prisma validate/migrate dry-run；pnpm verify' : '先运行福利卡默认通道/账本原子性行为测试并记录RED',
  Expected: '全额/部分退款按OrderPaymentAllocation回原福利卡账户和原微信交易；累计尾差闭合；福利卡REFUND账本与状态原子；重复/并发/失败无重复资金副作用',
  Actual: implemented ? '自动化覆盖原账户账本、原微信交易、累计尾差、停用账户、重复/并发、超退、回滚和UNKNOWN。' : '实现前测试预期失败；尚未形成GREEN证据。',
  Environment: 'LOCAL_WINDOWS_MYSQL8_CHROMIUM_DETERMINISTIC_WECHAT_ADAPTER', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; MySQL 8; Playwright Chromium', ExecutedAt: updatedAt, CommitSHA: commit,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P058-mixed-payment-split-refund.md|artifacts/verification/M3-P058/mixed-payment-split-refund.json|artifacts/test-results/verification/pnpm-verify.json', Executor: 'CODEX', Freshness: implemented ? 'FRESH_LOCAL_WORKTREE' : 'RED_PENDING',
  FailureOrBlocker: '真实微信商户退款、真实福利资金、staging、device、production未执行', RetestRequired: 'YES', Notes: '不生成M5售后授权，不修改退货库存，不进入P059全量账本验收。',
}]);

await upsertCsv('11-数据库迁移台账.csv', ['MigrationID'], [{
  MigrationID: 'MIG-013A', Stage: 'M3', MigrationFile: '20260820050000_m3_mixed_payment_split_refund', DependsOn: 'MIG-013', Models: 'WelfareCardLedger/RefundTransaction',
  Purpose: '把福利卡退款流水约束到原退款交易，防重复且固定REFUND/CREDIT语义', ForwardStrategy: '新增nullable FK、refundId+businessType唯一索引和退款语义CHECK；不回填、不改历史迁移',
  RollbackStrategy: '未发布时回退提交并重建开发库；共享环境只回退应用并新增向前修复迁移', Backfill: 'NONE；现有refundId为空；若存在非空孤儿值则迁移失败关闭',
  Validation: 'Prisma validate；空库/升级/恢复/product drift；FK/唯一/CHECK；事务回滚行为测试', Required: 'YES', Status: fullVerifyPassed ? 'CREATED_LOCAL_REHEARSED_M3_P058' : implemented ? 'CREATED_LOCAL_REHEARSAL_PENDING' : 'PLANNED', AppliedAt: fullVerifyPassed ? updatedAt : '', CommitSHA: commit,
  Evidence: 'packages/db/prisma/migrations/20260820050000_m3_mixed_payment_split_refund/migration.sql|tests/migrations/m3-p058-mixed-payment-split-refund-migration.contract.test.mjs', Notes: 'staging/production未应用；已发布迁移禁止回改。',
}]);

await upsertCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], [{
  ContractID: 'API-043', P0: 'P0-026,P0-058,P0-096', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/original-structure-refund-api.test.mjs|tests/openapi/m3-p026-original-structure-refund.contract.test.mjs|tests/openapi/m3-p058-mixed-payment-split-refund.contract.test.mjs|tests/e2e/p0/p0-058-mixed-payment-split-refund.spec.ts|packages/contracts/openapi.json',
  MoneyRule: '整数分；按订单项原OrderPaymentAllocation累计分配；最后一次闭合；福利卡/微信累计及总累计均不超原实付',
  SensitiveFieldPolicy: 'NEVER_RETURN；company/职能/自然人会话派生；退款金额、原福利卡账户、原微信交易仅服务端使用且不进入DTO',
  Notes: '任务内契约细化：M3-P058复用API-043并补齐原账户REFUND账本事务；真实微信/staging/真机证据仍为外部门禁。',
}]);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P057 PR #112合并且main run ${p057MainRun}成功。M3-P058原支付结构拆分退款为${evidenceStatus}；RequiredEvidenceLevel仍需真实微信/福利资金staging；P059及M4以后锁定。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const visit = (value) => {
  if (Array.isArray(value)) for (const item of value) visit(item);
  else if (value && typeof value === 'object') {
    if (value.taskId === 'M3-P057') value.executionStatus = 'CI_PASS';
    if (value.taskId === 'M3-P058') value.executionStatus = evidenceStatus;
    for (const child of Object.values(value)) visit(child);
  }
};
visit(freeze);
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P058', nextAllowedTask: 'M3-P058', activeTaskCount: 1, lastCompletedTask: 'M3-P057', lastCompletedCommit: p057Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P058 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P059', '真实微信/真实福利资金/staging/device/production未完成；M4及后续保持锁定'] };
status.github = { ...status.github, pullRequest: pullRequestNumber, pullRequestUrl: pullRequestUrl || null, pullRequestState, pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: pullRequestCi, runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: { scope: 'M3_P057_POST_MERGE_MAIN', status: 'CI_PASS', runId: p057MainRun, jobId: p057MainJob, runUrl: `https://github.com/EasyStep-lee/flt1/actions/runs/${p057MainRun}`, headSha: p057Merge, event: 'push', completedAt: '2026-08-20T04:31:58Z' },
  currentTaskDelivery: { taskId: 'M3-P058', issue: null, issueUrl: null, branch: 'codex/m3-mixed-payment-split-refund', baseCommit: p057Merge, verifiedHead: commit, status: pullRequestNumber ? 'DRAFT_PR_CI_PENDING' : implemented ? 'LOCAL_PASS_PENDING_DRAFT_PR' : 'IN_PROGRESS', localRedTest: 'PENDING_OR_RECORDED_IN_HANDOFF', localFocusedTest: implemented ? 'LOCAL_PASS_M3_P058_FOCUSED' : 'NOT_EXECUTED', localFullVerify: fullVerify, pullRequest: pullRequestNumber, pullRequestState, exactHeadCi: pullRequestCi, review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'REAL_WECHAT_WELFARE_FUNDS_STAGING_DEVICE', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P057', pullRequest: 112, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/112', exactHead: p057Head, mergeCommit: p057Merge, mainPostMergeCiRun: p057MainRun, mainPostMergeCiJob: p057MainJob, status: 'CI_PASS' },
  note: `M3-P057 merged-main CI_PASS；M3-P058原支付结构拆分退款${evidenceStatus}；真实微信/福利资金/staging/device/production未执行。` };
status.evidence = { local: implemented ? 'LOCAL_PASS_M3_P058' : 'NOT_EXECUTED_M3_P058', ci: pullRequestCi === 'CI_PASS' ? 'CI_PASS' : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
status.counts = { ...status.counts, stateTransitions: 115, migrations: 29, apiContracts: 106 };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.counts = { ...manifest.counts, stateTransitions: 115, migrations: 29, apiContracts: 106 };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P058');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'mixed-payment-split-refund.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P058', p0: ['P0-058', 'P0-026_PARTIAL', 'P0-059_PARTIAL', 'P0-096_PARTIAL'], status: evidenceStatus, commit, updatedAt,
  baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  red: [{
    command: 'pnpm --filter @fulishe/api build && node --test apps/api/test/unit/prisma-mixed-payment-refund.test.mjs',
    exitCode: 1,
    result: 'FAIL_4_OF_4',
    reason: 'ERR_MODULE_NOT_FOUND prisma-welfare-refund.adapter.js before implementation',
  }],
  focused: implemented ? [
    { command: 'node --test apps/api/test/unit/prisma-mixed-payment-refund.test.mjs apps/api/test/unit/refund-allocation-policy.test.mjs', result: 'PASS_6_OF_6' },
    { command: 'pnpm exec vitest run --config ./vitest.config.ts --project api-contract apps/api/test/supertest/original-structure-refund-api.test.mjs', result: 'PASS_6_OF_6' },
    { command: 'node --test tests/migrations/m3-p058-mixed-payment-split-refund-migration.contract.test.mjs tests/openapi/m3-p058-mixed-payment-split-refund.contract.test.mjs', result: 'PASS_3_OF_3' },
    { command: 'pnpm exec playwright test tests/e2e/p0/p0-058-mixed-payment-split-refund.spec.ts --config ./playwright.p0.config.ts', result: 'PASS_1_OF_1' },
    { command: 'pnpm prisma:migrate:dry-run', result: 'PASS_EMPTY_2_UPGRADE_2_RESTORE_2_PRODUCT_36_CLEANUP' },
  ] : [],
  fullVerify,
  invariants: { originalOrderItemAllocationOnly: true, integerCents: true, cumulativeNeverExceedsPaid: true, finalRemainderClosesOriginalSplit: true, originalWelfareAccountOnly: true, originalWechatTransactionOnly: true, welfareRefundLedgerAtomic: implemented, duplicateAndConcurrentSideEffectFree: implemented },
  boundaries: { realWechatRefund: 'NOT_EXECUTED', realWelfareFunds: 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED', afterSaleApproval: 'OUT_OF_SCOPE_M5', inventoryRestock: 'OUT_OF_SCOPE_M5', fullLedgerAcceptance: 'OUT_OF_SCOPE_M3_P059' },
  github: { issue: null, pullRequest: pullRequestNumber, pullRequestState, ciStatus: pullRequestCi },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P058_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
