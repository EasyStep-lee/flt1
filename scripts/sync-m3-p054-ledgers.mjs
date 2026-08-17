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
const p053Head = '24f1a03be05820970503a6af4a9b5492e252d3da';
const p053Merge = '236285071ec6601b175cadaca341b0e46950d73d';
const p053MainRun = '31980331613';
const p053MainJob = '95245932370';

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
    const index = byKey.get(keyOf(change));
    if (index === undefined) throw new Error(`LEDGER_ROW_NOT_FOUND:${relativePath}:${keyOf(change)}`);
    rows[index] = { ...rows[index], ...change };
  }
  const output = [headers.join(','), ...rows.map((row) => headers.map((header) => encode(row[header])).join(','))];
  await writeFile(filePath, `${output.join(eol)}${eol}`, 'utf8');
};

await upsertCsv('03-任务台账.csv', ['TaskID'], [
  {
    TaskID: 'M3-P053', Status: 'DONE', EvidenceStatus: 'CI_PASS', Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/103', Branch: 'codex/m3-welfare-card-account-selection',
    CommitSHA: p053Head, PullRequest: 'https://github.com/EasyStep-lee/flt1/pull/104', CI: 'CI_PASS', UpdatedAt: '2026-08-16T23:52:04Z',
    Notes: `PR #104精确head ${p053Head.slice(0, 7)}经授权合并；merge ${p053Merge.slice(0, 7)}；post-merge main Actions run ${p053MainRun}/job ${p053MainJob}成功。真实资金、真机、staging/production仍未执行。`,
  },
  {
    TaskID: 'M3-P054', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus, Owner: 'CODEX',
    GitHubIssue: 'https://github.com/EasyStep-lee/flt1/issues/105', Branch: 'codex/m3-welfare-card-scope-rules',
    CommitSHA: commit, PullRequest: prUrl, CI: ciRun ? 'CI_PASS' : 'NOT_EXECUTED', UpdatedAt: updatedAt,
    Notes: `RED API复合范围账户缺失、三页面适用提示缺失；GREEN API 8/8、OpenAPI 2/2、小程序26/26、P0 Chromium 1/1。${fullVerify === 'PASS_17_OF_17' ? 'pnpm verify 17/17通过。' : '完整门禁待记录。'} 规则schema v2向后兼容且无迁移、资金或账本写入。`,
  },
  {
    TaskID: 'M3-P055', Status: 'LOCKED', EvidenceStatus: 'NOT_EXECUTED', Owner: 'UNASSIGNED',
    Notes: 'M3-P054 Draft PR精确head CI、人工合并和post-merge main CI全部通过前保持锁定。',
  },
]);

await upsertCsv('04-P0-1至P0-119验收矩阵.csv', ['P0ID'], [
  {
    P0ID: 'P0-053', CurrentEvidenceStatus: 'CI_PASS',
    EvidenceLink: 'docs/contracts/m3/M3-P053-welfare-card-account-selection.md|https://github.com/EasyStep-lee/flt1/pull/104|https://github.com/EasyStep-lee/flt1/actions/runs/31980331613',
    LastVerifiedCommit: p053Merge, Verifier: 'GITHUB_ACTIONS+CODEX', VerifiedAt: '2026-08-16T23:52:04Z',
    Notes: 'PR #104与post-merge main CI通过；自动化技术行为CI_PASS。实际资金、真机、staging/production仍未执行。',
  },
  {
    P0ID: 'P0-054', CurrentEvidenceStatus: evidenceStatus,
    AutomatedTestID: 'apps/api/test/supertest/welfare-card-eligibility-api.test.mjs|apps/api/test/supertest/welfare-card-programs-api.test.mjs|tests/openapi/m3-p054-welfare-card-scope-rules.contract.test.mjs|apps/user-miniapp/test/product-detail-build.test.mjs|apps/user-miniapp/test/cart-order-build.test.mjs|apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/e2e/p0/p0-053-welfare-card-account-selection.spec.ts',
    ManualCaseID: 'MANUAL-054_DEVICE_NOT_EXECUTED',
    NegativeChecks: '非法版本/字段/UUID/列表内重复拒绝且零写；未登录/停用/跨用户不泄露；商品黑名单覆盖白名单；并发重复读确定；配送费服务端拥有；三页面不复制规则',
    EvidenceLink: `docs/contracts/m3/M3-P054-welfare-card-scope-rules.md${prUrl ? `|${prUrl}` : ''}${ciUrl ? `|${ciUrl}` : ''}`,
    LastVerifiedCommit: commit, Verifier: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', VerifiedAt: updatedAt,
    Notes: '自动化技术行为通过；真实计划/商品、真机、staging/production未执行。P0-055扣款与支付未进入。',
  },
]);

await upsertCsv('05-字段字典初始版.csv', ['Entity', 'Field'], [
  { Entity: 'WelfareCardProgram', Field: 'scopeType', AllowedValues: 'ALL_PRODUCTS|CATEGORY|PRODUCT|SKU|COMPOSITE', Status: 'IMPLEMENTED_M3_P054', Validation: 'COMPOSITE requires scopeRules schemaVersion=2; v1 remains backward compatible' },
  { Entity: 'WelfareCardProgram', Field: 'scopeRules', Status: 'IMPLEMENTED_M3_P054', Validation: 'schemaVersion=1 legacy or schemaVersion=2 category/product/sku include/exclude lists; blacklist first; <=1000 UUIDs; reject unknown fields' },
  { Entity: 'WelfareCardProgram', Field: 'canPayDeliveryFee', Status: 'IMPLEMENTED_M3_P054', Validation: 'boolean plan rule; delivery fee and eligible amount remain server-owned; client amount forbidden' },
]);

await upsertCsv('07-权限与数据可见矩阵.csv', ['OwnerType', 'RoleCode'], [{
  OwnerType: 'CONSUMER', RoleCode: 'CONSUMER_USER',
  ReadScope: '公开商品、自身购物车/订单/福利卡账户白名单/地址；API-039仅本人当前订单逐SKU适用结论',
  WriteScope: '自身福利卡绑定、下单、支付、收货、售后、自身资料；API-039只读且零副作用',
  DataScope: 'companyId与consumerUserId从当前会话派生；SKU价格、白/黑名单优先级与配送费适用由服务端统一计算',
  ForbiddenActions: '不得提交归属、价格、配送费、抵扣金额或范围规则；不得访问完整卡号、规则清单、供应价、他人福利卡、个人充值/转账/提现',
  Stage: 'M3', P0: 'P0-020,P0-021,P0-052,P0-053,P0-054,P0-083,P0-092,P0-098', Status: 'IMPLEMENTED_M3_P054_PARTIAL',
}]);

await upsertCsv('08-页面路由接口P0映射.csv', ['PageID'], [
  { PageID: 'PAGE-053', ImplementationStatus: 'PARTIAL_IMPLEMENTED_M3_P054_SCOPE_HINT', AcceptanceStatus: `P0-054_${evidenceStatus};P0-088_NOT_EXECUTED;DEVICE_NOT_EXECUTED`, RouteTest: 'apps/user-miniapp/test/product-detail-build.test.mjs', Notes: '公开详情独立加载；登录后通过API-039显示全部/部分/不可用，资格失败不拖垮详情；真机与完整交易详情未执行。' },
  { PageID: 'PAGE-055', ImplementationStatus: 'PARTIAL_IMPLEMENTED_M3_P054_SCOPE_HINT', AcceptanceStatus: `P0-054_${evidenceStatus};P0-090_PARTIAL;DEVICE_NOT_EXECUTED`, RouteTest: 'apps/user-miniapp/test/cart-order-build.test.mjs', Notes: '购物车复用API-039逐SKU适用结论；资格失败不阻断普通结算；增删改与真机未执行。' },
  { PageID: 'PAGE-056', ImplementationStatus: 'IMPLEMENTED_M3_P054_SCOPE_PARTIAL', AcceptanceStatus: `P0-053_CI_PASS;P0-054_${evidenceStatus};P0-091_NOT_EXECUTED;P0-092_PARTIAL_${evidenceStatus};DEVICE_NOT_EXECUTED`, RouteTest: 'apps/user-miniapp/test/welfare-card-selection-build.test.mjs|tests/e2e/p0/p0-053-welfare-card-account-selection.spec.ts', Notes: '按账户显示服务端逐SKU原因和配送费适用；仍不执行冻结、扣款或支付，完整确认订单与真机未执行。' },
]);

await upsertCsv('10-测试证据登记.csv', ['EvidenceID'], [{
  EvidenceID: 'EVD-054', CurrentStatus: evidenceStatus,
  CommandOrProcedure: 'RED API 1/4复合账户缺失；小程序3项适用提示undefined；GREEN API 8/8、OpenAPI 2/2、小程序26/26、P0 Chromium 1/1；pnpm verify 17/17',
  Actual: '分类/商品/SKU白黑名单、商品黑名单优先、配送费计划标记、逐行金额/原因、三页面一致消费、非法规则关闭失败、并发重复读和DTO隔离通过；零资金/账本写入。',
  Environment: 'LOCAL_WINDOWS_CHROMIUM', AppOrBrowserVersion: 'Node 22.23.1; pnpm 10.12.1; Playwright Chromium',
  ExecutedAt: updatedAt, CommitSHA: commit, CIRunURL: ciUrl,
  ArtifactOrScreenshot: 'docs/contracts/m3/M3-P054-welfare-card-scope-rules.md|artifacts/test-results/verification/pnpm-verify.json',
  Executor: ciRun ? 'GITHUB_ACTIONS+CODEX' : 'CODEX', Freshness: ciRun ? 'FRESH_PR_HEAD' : 'FRESH_LOCAL_WORKTREE',
  FailureOrBlocker: '真实福利计划/商品、真机、staging/device/production未执行；扣款与支付属于M3-P055以后',
  RetestRequired: ciRun ? 'NO_FOR_CURRENT_PR_HEAD' : 'YES', Notes: '无数据库迁移；scopeRules JSON schema v2向后兼容v1。',
}]);

await upsertCsv('12-OpenAPI-DTO-错误码台账.csv', ['ContractID'], [{
  ContractID: 'API-039', Stage: 'M3', Domain: 'welfare-card', Method: 'GET', Path: '/v1/consumer/welfare-card-accounts/eligible', Actor: 'CONSUMER',
  RequestDTO: 'WelfareCardEligibilityQueryDto', ResponseDTO: 'EligibleWelfareAccountsResponseDto', CommonResponse: '显式白名单DTO',
  ErrorCodes: 'AUTHENTICATION_REQUIRED|ACCOUNT_SUSPENDED|FIELD_FORBIDDEN|VALIDATION_FAILED|PRODUCT_NOT_SALEABLE', Idempotency: 'NONE_READ_ONLY_DETERMINISTIC',
  SensitiveFieldPolicy: 'NEVER_RETURN; SESSION_OWNER_DERIVED; masked cardNo; line applicability only; no rule lists, owner IDs, full cardNo, supplier price or secret; private/no-store/noindex',
  MoneyRule: 'integer cents; server reprices lines, evaluates v1/v2 scope and plan delivery-fee flag, computes min(available,eligible); client price/delivery/deduction/rules forbidden',
  P0: 'P0-053,P0-054,P0-092', OpenAPIStatus: 'GENERATED', DTOStatus: 'IMPLEMENTED', ErrorCodeStatus: 'IMPLEMENTED',
  ContractTest: 'apps/api/test/supertest/welfare-card-eligibility-api.test.mjs|tests/openapi/m3-p053-welfare-card-eligibility.contract.test.mjs|tests/openapi/m3-p054-welfare-card-scope-rules.contract.test.mjs|packages/contracts/openapi.json',
  Owner: 'CODEX', Notes: 'API-039返回逐SKU稳定原因和配送费适用；冻结/扣款、账本、支付和退款不在本切片。',
}]);

await upsertCsv(path.join('data', '阶段门禁.csv'), ['Stage'], [{
  Stage: 'M3', Status: 'IN_PROGRESS', EvidenceStatus: evidenceStatus,
  Notes: `M3-P053由PR #104合并且main run ${p053MainRun}成功。M3-P054福利卡适用范围${ciRun ? `在Draft PR精确head ${commit.slice(0, 7)}取得CI_PASS` : '本地LOCAL_PASS'}；真实计划/商品/真机/staging/production未执行；M3-P055及后续锁定。`,
}]);

const freezePath = path.join(root, 'artifacts', 'verification', 'M3-000', 'm3-contract-freeze.json');
const freeze = JSON.parse(await readFile(freezePath, 'utf8'));
const visit = (value) => {
  if (Array.isArray(value)) for (const item of value) visit(item);
  else if (value && typeof value === 'object') {
    if (['PAGE-053', 'PAGE-055', 'PAGE-056'].includes(value.pageId)) value.implementationStatus = 'IMPLEMENTED_M3_P054_SCOPE_PARTIAL';
    if (value.contractId === 'API-039') value.implementationStatus = 'IMPLEMENTED_M3_P054';
    if (String(value.id ?? '').startsWith('NEG-M3-P054-')) value.executionStatus = evidenceStatus;
    for (const child of Object.values(value)) visit(child);
  }
};
visit(freeze);
await writeFile(freezePath, `${JSON.stringify(freeze, null, 2)}\n`, 'utf8');

const statusPath = path.join(pack, '16-项目状态.json');
const status = JSON.parse(await readFile(statusPath, 'utf8'));
status.updatedAt = updatedAt;
status.execution = { ...status.execution, status: 'M3_IN_PROGRESS', currentStage: 'M3', currentTask: 'M3-P054', nextAllowedTask: 'M3-P054', activeTaskCount: 1, lastCompletedTask: 'M3-P053', lastCompletedCommit: p053Merge, lastPassedGate: 'M2-GATE', prohibitedUntilGate: ['M3-P054 Draft PR精确head CI成功、人工合并且post-merge main CI成功前不得开始M3-P055', '真实福利卡计划/商品/真机/staging/production未完成；M4及后续保持锁定'] };
status.github = { ...status.github,
  pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestUrl: prUrl || null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', pullRequestMerged: false, mergeCommitSha: null, mergedAt: null,
  lastVerifiedPullRequestHead: ciRun ? commit : null,
  pullRequestCi: ciRun ? { status: 'CI_PASS', runId: Number(ciRun), jobId: Number(ciJob), runUrl: ciUrl, headSha: commit, completedAt: updatedAt } : { status: 'NOT_EXECUTED', runId: null, jobId: null, runUrl: null, headSha: null, completedAt: null },
  currentTaskDelivery: { taskId: 'M3-P054', issue: 105, issueUrl: 'https://github.com/EasyStep-lee/flt1/issues/105', branch: 'codex/m3-welfare-card-scope-rules', baseCommit: p053Merge, verifiedHead: commit, status: ciRun ? 'CI_PASS_PENDING_HUMAN_MERGE' : 'LOCAL_PASS_PENDING_DRAFT_PR', localRedTest: 'API_COMPOSITE_ACCOUNT_MISSING;MINIAPP_3_SCOPE_HINTS_UNDEFINED', localFocusedTest: 'LOCAL_PASS_API_8_OPENAPI_2_MINIAPP_26_P0_1', localFullVerify: fullVerify, pullRequest: pullRequest ? Number(pullRequest) : null, pullRequestState: pullRequest ? 'DRAFT' : 'NOT_CREATED', exactHeadCi: ciRun ? `CI_PASS_RUN_${ciRun}_JOB_${ciJob}` : 'NOT_EXECUTED', review: 'NOT_EXECUTED', merge: 'NOT_EXECUTED', mainPostMergeCi: 'NOT_EXECUTED', blockingExternalItem: 'REAL_WELFARE_PROGRAM_PRODUCT_AND_DEVICE_DATA', nextTaskUnlocked: false },
  previousTaskDelivery: { taskId: 'M3-P053', pullRequest: 104, pullRequestUrl: 'https://github.com/EasyStep-lee/flt1/pull/104', exactHead: p053Head, mergeCommit: p053Merge, mainPostMergeCiRun: Number(p053MainRun), mainPostMergeCiJob: Number(p053MainJob), status: 'CI_PASS' },
  note: `M3-P054福利卡适用范围${ciRun ? ' Draft PR精确head CI_PASS' : ' LOCAL_PASS'}；真实计划/商品、真机、staging/device/production未执行；M3-P055锁定。`,
};
status.evidence = { local: fullVerify === 'PASS_17_OF_17' ? 'LOCAL_PASS_M3_P054_FULL_VERIFY' : 'LOCAL_FOCUSED_PASS_FULL_VERIFY_NOT_EXECUTED', ci: ciRun ? `CI_PASS_M3_P054_HEAD_${commit.slice(0, 7)}` : 'NOT_EXECUTED', staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' };
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const artifactDir = path.join(root, 'artifacts', 'verification', 'M3-P054');
await mkdir(artifactDir, { recursive: true });
await writeFile(path.join(artifactDir, 'welfare-card-scope-rules.json'), `${JSON.stringify({
  schemaVersion: 1, taskId: 'M3-P054', p0: ['P0-054', 'P0-092_PARTIAL'], status: evidenceStatus,
  commit, updatedAt, baselineSha256: '1153157234D2DCCDF38F0C5E468BD5D93889140153F1C21F7FEBB8FA5316EF92',
  scope: 'server-owned composite welfare-card scope evaluation and three-page consistent presentation',
  red: ['API_COMPOSITE_ACCOUNT_MISSING', 'MINIAPP_PRODUCT_DETAIL_SCOPE_UNDEFINED', 'MINIAPP_CART_SCOPE_UNDEFINED', 'MINIAPP_CHECKOUT_SCOPE_UNDEFINED'],
  focused: ['API_8_OF_8', 'OPENAPI_2_OF_2', 'MINIAPP_26_OF_26', 'P0_CHROMIUM_1_OF_1'],
  fullVerify, migrations: 'NOT_REQUIRED_JSON_SCHEMA_V2_BACKWARD_COMPATIBLE',
  boundaries: { moneyMutation: false, ledgerWrite: false, payment: false, staging: 'NOT_EXECUTED', device: 'NOT_EXECUTED', production: 'NOT_EXECUTED' },
  github: { issue: 105, pullRequest: pullRequest ? Number(pullRequest) : null, ciRun: ciRun ? Number(ciRun) : null },
}, null, 2)}\n`, 'utf8');

process.stdout.write(`M3_P054_LEDGERS_SYNCED:${commit}:${evidenceStatus}\n`);
