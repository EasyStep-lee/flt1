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

const p059 = {
  issue: 114, pr: 115, head: '1a04f48fab630e78800b57596c5c4aa43b897e01', merge: 'ed1b37061761a057556a80b659e8317dc59b9164',
  prRun: 32356100768, prJob: 96385494719, mainRun: 32357516455, mainJob: 96389796027,
  mergedAt: '2026-08-20T10:09:16Z',
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
    const key = keyOf(change); const index = byKey.get(key);
    if (index === undefined) { rows.push(Object.fromEntries(headers.map((header) => [header, change[header] ?? '']))); byKey.set(key, rows.length - 1); }
    else rows[index] = { ...rows[index], ...change };
  }
  await writeFile(filePath, `${[headers.join(','), ...rows.map((row) => headers.map((header) => encode(row[header])).join(','))].join(eol)}${eol}`, 'utf8');
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P059', Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX', GitHubIssue: `https://github.com/EasyStep-lee/flt1/issues/${p059.issue}`,
    Branch: 'codex/m3-welfare-card-ledger', CommitSHA: p059.merge, PullRequest: `https://github.com/EasyStep-lee/flt1/pull/${p059.pr}`, CI: 'CI_PASS', UpdatedAt: p059.mergedAt,
    Notes: `PR #115精确head ${p059.head}经run ${p059.prRun}/job ${p059.prJob}验证并按授权合并为${p059.merge}；post-merge main run ${p059.mainRun}/job ${p059.mainJob}成功。真实福利资金/staging/device/production未执行。`,
  },
  {
    TaskID: 'M3-P062', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX', GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/116',
    Branch: 'codex/m3-enterprise-multi-supplier-order', CommitSHA: commit, PullRequest: pullRequestUrl, CI: pullRequestCi, UpdatedAt: updatedAt,
    Notes: `复用MIG-012/MIG-015和API-048；新增企业采购车/结算私有页面，至少3个供应商商品仅提交skuId+quantity，服务端重新定价并返回1张主订单+3个履约组。${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁尚未通过。'}staging/device/production未执行。`,
  },
  { TaskID: 'M3-P073', Status: 'NOT_STARTED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED', Notes: 'M3-P062 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。' },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  {
    P0ID: 'P0-059', CurrentEvidenceStatus: 'CI_PASS', LastVerifiedCommit: p059.merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: p059.mergedAt,
    EvidenceLink: `docs/contracts/m3/M3-P059-welfare-card-ledger.md|https://github.com/EasyStep-lee/flt1/pull/${p059.pr}|https://github.com/EasyStep-lee/flt1/actions/runs/${p059.mainRun}`,
    Notes: 'PR #115合并且post-merge main CI成功；真实福利资金/staging/device/production未执行。',
  },
  {
    P0ID: 'P0-062', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'NEG-M3-P062-01|NEG-M3-P062-02|NEG-M3-P062-03|apps/api/test/supertest/unified-enterprise-procurement-api.test.mjs|apps/api/test/unit/prisma-order-repository.test.mjs|tests/migrations/m3-p029-enterprise-procurement-migration.contract.test.mjs|tests/e2e/p0/p0-062-enterprise-multi-supplier-order.spec.ts',
    ManualCaseID: 'N/A', NegativeChecks: '伪造价格/供应商/企业归属字段拒绝；暂停企业/无采购权限/跨企业资料拒绝；同键重放原订单、异体冲突无第二张订单',
    EvidenceLink: 'docs/contracts/m3/M3-P062-enterprise-multi-supplier-order.md|artifacts/verification/M3-P062/enterprise-multi-supplier-order.json|artifacts/verification/M3-P062/enterprise-checkout-page.png|artifacts/verification/M3-P062/enterprise-order-result-page.png',
    LastVerifiedCommit: commit, Verifier: 'CODEX', VerifiedAt: updatedAt,
    Notes: `${implemented ? '本地API、迁移契约、私有页面、响应式和敏感字段负向行为通过。' : '实现进行中。'}RequiredEvidenceLevel为CI_PASS；尚无Draft PR精确head CI。`,
  },
]);

await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [
  { PageID: 'PAGE-036', ImplementationStatus: implemented ? 'IMPLEMENTED_M3_P062' : 'M3_P062_IN_PROGRESS', AcceptanceStatus: `P0-062_${evidenceStatus};P0-079_NOT_EXECUTED`, RouteTest: 'tests/e2e/p0/p0-062-enterprise-multi-supplier-order.spec.ts', Notes: '已验证企业会话private/no-store/noindex、三供应来源分组、整数分汇总、空态与移动端无横向溢出；P079完整收货/开票选择后续执行。' },
  { PageID: 'PAGE-037', ImplementationStatus: implemented ? 'IMPLEMENTED_M3_P062' : 'M3_P062_IN_PROGRESS', AcceptanceStatus: `P0-062_${evidenceStatus};P0-079_NOT_EXECUTED`, RouteTest: 'tests/e2e/p0/p0-062-enterprise-multi-supplier-order.spec.ts', Notes: '企业会话private/no-store/noindex；仅向API-048提交skuId+quantity；幂等键在未知结果时保留，成功后才清购物车；响应仅显示公司主订单和供应商履约白名单。' },
]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [{
  EvidenceID: 'EVD-059', CurrentStatus: 'CI_PASS', ExecutedAt: p059.mergedAt, CommitSHA: p059.merge,
  CIRunURL: `https://github.com/EasyStep-lee/flt1/actions/runs/${p059.mainRun}`, Executor: 'GITHUB_ACTIONS+CODEX', Freshness: 'MERGED_MAIN',
  FailureOrBlocker: '真实福利资金、staging、device、production未执行', RetestRequired: 'YES',
  Notes: `PR #115精确head ${p059.head} CI成功并合并；post-merge main run ${p059.mainRun}/job ${p059.mainJob}成功。`,
}, {
  EvidenceID: 'EVD-062', P0ID: 'P0-062', Stage: 'M3', TaskID: 'M3-P062', EvidenceType: 'AUTOMATED_API_AND_PORTAL_MULTI_SUPPLIER_ORDER', RequiredLevel: 'CI_PASS', CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'RED Playwright；GREEN API 5 tests；portal lint/typecheck/build；P0-062 Chromium 2 tests；migration/OpenAPI/full pnpm verify',
  Expected: '至少3个供应商商品一次提交1张公司主订单；按supplierId准确拆组；商品与金额守恒',
  Actual: implemented ? '三供应来源采购车、统一结算、服务端重定价、单主订单/三履约组、幂等/越权/字段隔离自动化通过。' : '实现中。',
  Environment: 'LOCAL_WINDOWS_NODE22_PLAYWRIGHT_CHROMIUM_DETERMINISTIC_API', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Playwright Chromium', ExecutedAt: updatedAt, CommitSHA: commit,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P062-enterprise-multi-supplier-order.md|artifacts/verification/M3-P062/enterprise-multi-supplier-order.json|artifacts/verification/M3-P062/enterprise-checkout-page.png|artifacts/verification/M3-P062/enterprise-order-result-page.png', Executor: 'CODEX', Freshness: 'FRESH_LOCAL_WORKTREE',
  FailureOrBlocker: 'Draft PR精确head CI尚未执行；staging/device/production未执行', RetestRequired: 'YES', Notes: '不宣称P079完整结算或P080工作台完成；不进入P073。',
}]);

await upsertCsv('11-数据库迁移台账.csv', ['MigrationID'], [
  {
    MigrationID: 'MIG-015', Stage: 'M3', PlannedName: '20260815030000_m3_enterprise_procurement_order', DependsOn: 'MIG-011', Objects: 'EnterpriseProcurementOrder', Purpose: '企业主订单与地址/发票/付款路由不可变快照',
    ForwardSteps: '创建EnterpriseProcurementOrder；BuyerOrder一对一；企业/采购员外键；地址/发票JSON快照；微信/对公转账付款路由与状态版本',
    BackwardOrRecovery: '已发布迁移不回改；回退应用并以新的向前迁移修复，保留订单快照', DataBackfill: 'NONE_NEW_TABLE_ONLY',
    Verification: 'Prisma validate；空库/升级/恢复/product drift；快照不可变；一主订单一企业采购聚合', BackupRequired: 'YES', Status: 'REUSED_LOCAL_REHEARSED_M3_P062', AppliedLocalAt: updatedAt, CommitSHA: commit,
    EvidenceLink: 'packages/db/prisma/migrations/20260815030000_m3_enterprise_procurement_order/migration.sql|tests/migrations/m3-p029-enterprise-procurement-migration.contract.test.mjs|docs/contracts/m3/M3-P062-enterprise-multi-supplier-order.md', Notes: 'M3-P062无新迁移；复用MIG-012按供应商拆分与MIG-015企业快照。staging/production未应用。',
  },
  {
    MigrationID: 'MIG-015B', Stage: 'M3', PlannedName: '20260817030000_m3_welfare_card_full_payment', DependsOn: 'MIG-014A', Objects: 'WelfareCardLedger constraint/guard; WelfareCardPaymentCommand', Purpose: '福利卡全额支付FREEZE/CAPTURE约束与幂等命令',
    ForwardSteps: '扩展账本check/余额触发器；新增支付命令表、唯一键、外键与不可变触发器', BackwardOrRecovery: '已发布后回退应用并新增向前修复；不删除财务账本/命令', DataBackfill: 'NONE_NEW_COMMANDS_ONLY', Verification: 'Prisma validate；迁移全链；账本check/命令不可变；并发与回滚', BackupRequired: 'YES', Status: 'REUSED_LOCAL_REHEARSED_M3_P056', AppliedLocalAt: '2026-08-17T04:03:43Z', CommitSHA: '904bb529e765dc0bfc83d8a8ec33f733182ee9a0', EvidenceLink: 'packages/db/prisma/migrations/20260817030000_m3_welfare_card_full_payment/migration.sql|tests/migrations/m3-p055-welfare-card-full-payment-migration.contract.test.mjs', Notes: '修正旧同步脚本与MIG-015企业迁移的编号冲突；不改SQL或迁移顺序。' },
]);

await upsertCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], [{
  ContractID: 'API-048', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/unified-enterprise-procurement-api.test.mjs|apps/api/test/unit/prisma-order-repository.test.mjs|tests/e2e/p0/p0-029-unified-enterprise-procurement.spec.ts|tests/e2e/p0/p0-062-enterprise-multi-supplier-order.spec.ts|packages/contracts/openapi.json',
  Notes: 'M3-P062门户仅提交items[skuId,quantity]；企业/归属/销售价/供应商由已验证会话和服务端商品真源派生；响应显式白名单且不返回供应价。',
}]);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P059 PR #115合并且main run ${p059.mainRun}成功。M3-P062多供应商企业主订单为${evidenceStatus}；P073及M4以后锁定；staging/device/production未执行。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const visit = (value) => {
  if (Array.isArray(value)) for (const item of value) visit(item);
  else if (value && typeof value === 'object') {
    if (value.taskId === 'M3-P059') value.executionStatus = 'CI_PASS';
    if (value.taskId === 'M3-P062') value.executionStatus = evidenceStatus;
    for (const child of Object.values(value)) visit(child);
  }
};
visit(freeze);
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P062', nextAllowedTask: 'M3-P062', activeTaskCount: 1, lastCompletedTask: 'M3-P059', lastCompletedCommit: p059.merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P062 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P073', 'M3-GATE通过前M4及以后保持锁定；staging/device/production未执行'] };
status.github = { ...status.github, pullRequest: pullRequestNumber, pullRequestUrl: pullRequestUrl || null, pullRequestState, pullRequestMerged: false, mergeCommitSha: null, mergedAt: null, lastVerifiedPullRequestHead: null,
  pullRequestCi: { status: pullRequestCi, runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  latestCi: { scope: 'M3_P059_POST_MERGE_MAIN', status: 'CI_PASS', runId: p059.mainRun, jobId: p059.mainJob, runUrl: `https://github.com/EasyStep-lee/flt1/actions/runs/${p059.mainRun}`, headSha: p059.merge, event: 'push', completedAt: '2026-08-20T10:19:04Z' },
  currentTaskDelivery: { taskId: 'M3-P062', issue: 116, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/116', branch: 'codex/m3-enterprise-multi-supplier-order', baseCommit: p059.merge, verifiedHead: commit, status: pullRequestNumber ? 'DRAFT_PR_CI_PENDING' : implemented ? 'LOCAL_PASS_PENDING_DRAFT_PR' : 'IN_PROGRESS', localRedTest: 'RECORDED_FAIL_2_OF_2_MISSING_ADD_TO_CART', localFocusedTest: implemented ? 'LOCAL_PASS_API_5_PORTAL_P0_2' : 'NOT_EXECUTED', localFullVerify: fullVerify, pullRequest: pullRequestNumber, pullRequestState, exactHeadCi: pullRequestCi, review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'STAGING_DEVICE_PRODUCTION_REAL_FUNDS', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P059', issue: 114, pullRequest: p059.pr, pullRequestUrl: `https://github.com/EasyStep-lee/flt1/pull/${p059.pr}`, exactHead: p059.head, mergeCommit: p059.merge, mainPostMergeCiRun: p059.mainRun, mainPostMergeCiJob: p059.mainJob, status: 'CI_PASS' },
  note: `M3-P059 merged-main CI_PASS；M3-P062多供应商企业主订单${evidenceStatus}；P073/M4以后锁定。` };
status.evidence = { local: implemented ? 'LOCAL_PASS_M3_P062' : 'NOT_EXECUTED_M3_P062', ci: pullRequestCi === 'CI_PASS' ? 'CI_PASS' : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
status.counts = { ...status.counts, migrations: 31 };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const manifestPath = path.join(pack, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.counts = { ...manifest.counts, migrations: 31 };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P062');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'enterprise-multi-supplier-order.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P062', p0: ['P0-062'], status: evidenceStatus, commit, updatedAt,
  baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  red: [{ command: 'pnpm exec playwright test tests/e2e/p0/p0-062-enterprise-multi-supplier-order.spec.ts --config playwright.p0.config.ts', exitCode: 1, result: 'FAIL_2_OF_2', reason: '商品详情尚无加入企业采购车按钮，两条测试等待按钮超时' }],
  focused: implemented ? [
    { command: 'pnpm exec vitest run --config ./vitest.config.ts --project api-contract apps/api/test/supertest/unified-enterprise-procurement-api.test.mjs', result: 'PASS_5_OF_5' },
    { command: 'pnpm --filter @fulishe/portal-web typecheck && lint && build', result: 'PASS_DYNAMIC_CART_AND_CHECKOUT' },
    { command: 'pnpm exec playwright test tests/e2e/p0/p0-062-enterprise-multi-supplier-order.spec.ts --config playwright.p0.config.ts', result: 'PASS_2_OF_2' },
  ] : [],
  fullVerify,
  invariants: { oneBuyerOrder: true, atLeastThreeSuppliers: true, oneFulfillmentPerSupplier: true, integerCents: true, mainAmountEqualsItemAndFulfillmentSums: true, serverRepricesAndDerivesOwnership: true, requestOnlySkuAndQuantity: true, sameIdempotencyKeyOnUnknown: true, supplierPriceNeverReturned: true },
  boundaries: { migration: 'REUSE_MIG_012_AND_MIG_015_NO_NEW_SQL', openapi: 'REUSE_API_048_NO_BREAKING_CHANGE', p079FullCheckoutProfiles: 'OUT_OF_SCOPE', p080WorkspaceOrders: 'OUT_OF_SCOPE', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' },
  github: { issue: 116, pullRequest: pullRequestNumber, pullRequestState, ciStatus: pullRequestCi },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P062_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
